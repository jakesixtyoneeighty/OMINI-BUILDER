import { workbenchStore } from './workbench';
import { activeProjectIdStore } from './project';
import { webcontainer } from '~/lib/webcontainer';

export interface SnapshotData {
  id: number;
  name: string;
  timestamp: string;
  files: Record<string, any>;
  messageIndex: number;
}

/**
 * Lightweight snapshot list entry — stores metadata only,
 * NOT the full file contents. File data is stored separately
 * and only kept for the most recent snapshots.
 */
export interface SnapshotMeta {
  id: number;
  name: string;
  timestamp: string;
  messageIndex: number;
  fileCount: number;
  /** Approximate size in bytes of the stored file data */
  dataSize: number;
}

const SNAPSHOTS_KEY = 'bolt.snapshots';
const MAX_SNAPSHOTS = 10; // Reduced from 30 to save space
const MAX_SNAPSHOT_DATA_BYTES = 2 * 1024 * 1024; // 2MB max for individual snapshot
const MAX_TOTAL_SNAPSHOT_BYTES = 3 * 1024 * 1024; // 3MB total across all snapshots
const LOCALSTORAGE_QUOTA_MARGIN = 512 * 1024; // Keep 512KB free for other data

export function getProjectSnapshotsKey(projectId: string) {
  return `${SNAPSHOTS_KEY}.${projectId}`;
}

/**
 * Safe localStorage setItem that catches QuotaExceededError
 * and attempts to free space before retrying.
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
      console.warn(`[Snapshots] localStorage quota exceeded for key ${key}, attempting cleanup...`);
      // Try to free space by removing oldest snapshot data
      if (tryFreeSpace()) {
        try {
          localStorage.setItem(key, value);
          return true;
        } catch {
          console.warn(`[Snapshots] Still no space after cleanup, giving up`);
          return false;
        }
      }
    }
    return false;
  }
}

/**
 * Estimate current localStorage usage in bytes
 */
function estimateLocalStorageSize(): number {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        total += key.length + (localStorage.getItem(key)?.length || 0);
      }
    }
  } catch {}
  // UTF-16 = 2 bytes per char
  return total * 2;
}

/**
 * Try to free localStorage space by removing oldest snapshot data.
 * Returns true if space was freed.
 */
function tryFreeSpace(): boolean {
  let freed = false;
  const prefix = 'bolt.snapshot.data.';

  // Collect all snapshot data keys with their sizes
  const entries: { key: string; size: number; id: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const val = localStorage.getItem(key);
        const id = parseInt(key.replace(prefix, ''), 10);
        entries.push({ key, size: (val?.length || 0) * 2, id });
      }
    }
  } catch {}

  // Sort by ID (oldest first)
  entries.sort((a, b) => a.id - b.id);

  // Remove only the oldest snapshots until we free enough space (target: 1MB free)
  const targetFree = 1 * 1024 * 1024; // 1MB
  const currentUsage = estimateLocalStorageSize();
  const estimatedMax = 5 * 1024 * 1024;
  let freedBytes = 0;
  const needed = currentUsage + targetFree - estimatedMax;

  for (const entry of entries) {
    if (needed > 0 && freedBytes >= needed) break; // Stop once we've freed enough
    try {
      localStorage.removeItem(entry.key);
      freedBytes += entry.size;
      freed = true;
      console.log(`[Snapshots] Removed snapshot data ${entry.id} (~${Math.round(entry.size / 1024)}KB)`);
    } catch {}
  }

  return freed;
}

export function loadSnapshots(projectId: string): SnapshotMeta[] {
  try {
    const raw = localStorage.getItem(getProjectSnapshotsKey(projectId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    // Handle both old format (SnapshotData[]) and new format (SnapshotMeta[])
    return parsed.map((s: any) => ({
      id: s.id,
      name: s.name,
      timestamp: s.timestamp,
      messageIndex: s.messageIndex ?? 0,
      fileCount: s.fileCount ?? (s.files ? Object.keys(s.files).length : 0),
      dataSize: s.dataSize ?? 0,
    }));
  } catch {
    return [];
  }
}

export function saveSnapshotToList(projectId: string, snapshots: SnapshotMeta[]) {
  const data = JSON.stringify(snapshots);
  safeSetItem(getProjectSnapshotsKey(projectId), data);
}

/**
 * Serialize file map, filtering out large/binary/node_modules files.
 * Returns { serialized, size } or null if too large.
 */
function serializeFiles(files: Record<string, any>): { json: string; size: number } | null {
  const filtered: Record<string, any> = {};
  let size = 0;

  for (const [path, dirent] of Object.entries(files)) {
    if (!dirent || dirent.type !== 'file' || dirent.isBinary) continue;
    if (path.includes('node_modules')) continue;
    if (path.includes('.git/')) continue;
    if (path.endsWith('.lock') || path.endsWith('.map')) continue;
    if (path.includes('/dist/') || path.includes('/build/')) continue;

    filtered[path] = { type: 'file', content: dirent.content };
    size += path.length + (dirent.content?.length || 0);
  }

  // UTF-16 = 2 bytes per character
  const estimatedBytes = size * 2;

  if (estimatedBytes > MAX_SNAPSHOT_DATA_BYTES) {
    console.warn(`[Snapshots] Snapshot data too large (${Math.round(estimatedBytes / 1024)}KB), skipping file data save`);
    return null;
  }

  try {
    const json = JSON.stringify(filtered);
    return { json, size: estimatedBytes };
  } catch {
    return null;
  }
}

export function saveSnapshotData(snapshot: SnapshotData): number {
  const serialized = serializeFiles(snapshot.files);
  if (!serialized) return 0;

  // Check total localStorage usage before saving
  const currentUsage = estimateLocalStorageSize();
  const estimatedMax = 5 * 1024 * 1024; // 5MB typical localStorage limit

  if (currentUsage + serialized.size > estimatedMax - LOCALSTORAGE_QUOTA_MARGIN) {
    console.warn('[Snapshots] Not enough localStorage space, skipping snapshot data save');
    return 0;
  }

  const success = safeSetItem(`bolt.snapshot.data.${snapshot.id}`, serialized.json);
  return success ? serialized.size : 0;
}

export function loadSnapshotData(id: number): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(`bolt.snapshot.data.${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function deleteSnapshotData(id: number) {
  try {
    localStorage.removeItem(`bolt.snapshot.data.${id}`);
  } catch {}
}

/**
 * Calculate total bytes used by all snapshot data across all projects.
 */
function getTotalSnapshotBytes(): number {
  let total = 0;
  const prefix = 'bolt.snapshot.data.';
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const val = localStorage.getItem(key);
        total += (val?.length || 0) * 2; // UTF-16
      }
    }
  } catch {}
  return total;
}

/**
 * Enforce total snapshot storage limit by removing oldest snapshots.
 */
function enforceTotalSizeLimit(projectId: string, snapshots: SnapshotMeta[]) {
  // getTotalSnapshotBytes already counts all snapshot data in localStorage
  // Don't double-count by adding dataSize from the meta list
  let totalBytes = getTotalSnapshotBytes();

  if (totalBytes <= MAX_TOTAL_SNAPSHOT_BYTES) return snapshots;

  console.warn(`[Snapshots] Total snapshot storage (${Math.round(totalBytes / 1024)}KB) exceeds limit, pruning...`);

  // Remove oldest until under limit
  while (totalBytes > MAX_TOTAL_SNAPSHOT_BYTES && snapshots.length > 1) {
    const removed = snapshots.shift();
    if (removed) {
      deleteSnapshotData(removed.id);
      totalBytes -= removed.dataSize;
      console.log(`[Snapshots] Pruned snapshot ${removed.id} (~${Math.round(removed.dataSize / 1024)}KB)`);
    }
  }

  return snapshots;
}

/**
 * Create a snapshot before an AI action. Used for error rollback.
 * Returns the snapshot ID so it can be used for rollback.
 */
export function createPreActionSnapshot(messageIndex: number): number | null {
  const projectId = activeProjectIdStore.get();
  const files = workbenchStore.files.get();
  const fileCount = Object.keys(files).length;

  if (fileCount === 0) {
    return null;
  }

  const snapshot: SnapshotData = {
    id: Date.now(),
    name: `Pre-Action ${new Date().toLocaleTimeString()}`,
    timestamp: new Date().toISOString(),
    files: { ...files },
    messageIndex,
  };

  const dataSize = saveSnapshotData(snapshot);

  const meta: SnapshotMeta = {
    id: snapshot.id,
    name: snapshot.name,
    timestamp: snapshot.timestamp,
    messageIndex: snapshot.messageIndex,
    fileCount,
    dataSize,
  };

  const snapshots = loadSnapshots(projectId);
  snapshots.push(meta);

  // Keep max snapshots
  while (snapshots.length > MAX_SNAPSHOTS) {
    const removed = snapshots.shift();
    if (removed) deleteSnapshotData(removed.id);
  }

  // Enforce total size limit
  enforceTotalSizeLimit(projectId, snapshots);

  saveSnapshotToList(projectId, snapshots);

  return snapshot.id;
}

export function createAutoSnapshot(messageIndex: number, description?: string): SnapshotData | null {
  const projectId = activeProjectIdStore.get();
  const files = workbenchStore.files.get();
  const fileCount = Object.keys(files).length;

  if (fileCount === 0) {
    return null;
  }

  const snapshot: SnapshotData = {
    id: Date.now(),
    name: description || `Auto ${new Date().toLocaleTimeString()}`,
    timestamp: new Date().toISOString(),
    files: { ...files },
    messageIndex,
  };

  const dataSize = saveSnapshotData(snapshot);

  const meta: SnapshotMeta = {
    id: snapshot.id,
    name: snapshot.name,
    timestamp: snapshot.timestamp,
    messageIndex: snapshot.messageIndex,
    fileCount,
    dataSize,
  };

  const snapshots = loadSnapshots(projectId);
  snapshots.push(meta);

  // Keep max snapshots
  while (snapshots.length > MAX_SNAPSHOTS) {
    const removed = snapshots.shift();
    if (removed) deleteSnapshotData(removed.id);
  }

  // Enforce total size limit
  enforceTotalSizeLimit(projectId, snapshots);

  saveSnapshotToList(projectId, snapshots);

  return snapshot;
}

/**
 * Fully restore a snapshot: writes files to WebContainer, updates file store, and refreshes editor documents.
 * This is the complete restore - unlike the old version which only set the store.
 */
export async function restoreSnapshot(id: number): Promise<boolean> {
  const files = loadSnapshotData(id);

  if (!files) {
    return false;
  }

  try {
    const wc = await webcontainer;

    // 1. Build set of directories to create
    const dirs = new Set<string>();
    for (const path of Object.keys(files)) {
      const parts = path.split('/').slice(0, -1);
      for (let i = 1; i <= parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'));
      }
    }

    // 2. Create directories in WebContainer
    for (const dir of dirs) {
      try {
        await wc.fs.mkdir(dir, { recursive: true });
      } catch {}
    }

    // 3. Write each file to WebContainer
    for (const [path, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        try {
          await wc.fs.writeFile(path, dirent.content || '');
        } catch (err) {
          console.warn(`restoreSnapshot: failed to write ${path}`, err);
        }
      }
    }

    // 4. Update the file store
    workbenchStore.files.set(files);

    // 5. Update editor documents so the editor shows the restored files
    workbenchStore.setDocuments(files);

    // 6. Save restored files to Supabase (cloud only)
    workbenchStore.saveEntireProject().catch(() => {});

    // 7. Clear unsaved changes
    workbenchStore.unsavedFiles.set(new Set());

    return true;
  } catch (err) {
    console.error('restoreSnapshot failed:', err);
    return false;
  }
}

/**
 * Get the most recent snapshot for the current project.
 */
export function getLatestSnapshot(): SnapshotData | null {
  const projectId = activeProjectIdStore.get();
  const snapshots = loadSnapshots(projectId);
  if (snapshots.length === 0) return null;

  const latest = snapshots[snapshots.length - 1];
  const files = loadSnapshotData(latest.id);

  return {
    ...latest,
    files: files || {},
  };
}

export function deleteSnapshot(projectId: string, id: number) {
  const snapshots = loadSnapshots(projectId);
  const filtered = snapshots.filter((s) => s.id !== id);
  saveSnapshotToList(projectId, filtered);
  deleteSnapshotData(id);
}

export function getAllSnapshotsForExport(): { projectId: string; snapshots: SnapshotData[] }[] {
  try {
    const projects = JSON.parse(localStorage.getItem('bolt.project.records') || '{}');
    const result: { projectId: string; snapshots: SnapshotData[] }[] = [];

    for (const id of Object.keys(projects)) {
      const snaps = loadSnapshots(id);

      if (snaps.length > 0) {
        const fullSnaps = snaps.map((s) => ({
          ...s,
          files: loadSnapshotData(s.id) || {},
        }));
        result.push({ projectId: id, snapshots: fullSnaps });
      }
    }

    return result;
  } catch {
    return [];
  }
}

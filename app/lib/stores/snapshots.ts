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

const SNAPSHOTS_KEY = 'bolt.snapshots';
const MAX_SNAPSHOTS = 30;

export function getProjectSnapshotsKey(projectId: string) {
  return `${SNAPSHOTS_KEY}.${projectId}`;
}

export function loadSnapshots(projectId: string): SnapshotData[] {
  try {
    const raw = localStorage.getItem(getProjectSnapshotsKey(projectId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSnapshotToList(projectId: string, snapshots: SnapshotData[]) {
  localStorage.setItem(getProjectSnapshotsKey(projectId), JSON.stringify(snapshots));
}

export function saveSnapshotData(snapshot: SnapshotData) {
  localStorage.setItem(`bolt.snapshot.data.${snapshot.id}`, JSON.stringify(snapshot.files));
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
  localStorage.removeItem(`bolt.snapshot.data.${id}`);
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

  const snapshots = loadSnapshots(projectId);
  snapshots.push(snapshot);

  // keep max snapshots
  if (snapshots.length > MAX_SNAPSHOTS) {
    const removed = snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
    for (const r of removed) {
      deleteSnapshotData(r.id);
    }
  }

  saveSnapshotToList(projectId, snapshots);
  saveSnapshotData(snapshot);

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

  const snapshots = loadSnapshots(projectId);
  snapshots.push(snapshot);

  // keep max snapshots
  if (snapshots.length > MAX_SNAPSHOTS) {
    const removed = snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
    for (const r of removed) {
      deleteSnapshotData(r.id);
    }
  }

  saveSnapshotToList(projectId, snapshots);
  saveSnapshotData(snapshot);

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

    // 6. Update file cache for persistence
    workbenchStore.filesStore.saveFilesToCache();

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
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
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

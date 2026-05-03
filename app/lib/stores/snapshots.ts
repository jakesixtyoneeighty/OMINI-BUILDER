import { workbenchStore } from './workbench';
import { activeProjectIdStore } from './project';

export interface SnapshotData {
  id: number;
  name: string;
  timestamp: string;
  files: Record<string, any>;
  messageIndex: number;
}

const SNAPSHOTS_KEY = 'bolt.snapshots';

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

  // keep max 20 snapshots
  if (snapshots.length > 20) {
    const removed = snapshots.splice(0, snapshots.length - 20);

    for (const r of removed) {
      deleteSnapshotData(r.id);
    }
  }

  saveSnapshotToList(projectId, snapshots);
  saveSnapshotData(snapshot);

  return snapshot;
}

export function restoreSnapshot(id: number): boolean {
  const files = loadSnapshotData(id);

  if (!files) {
    return false;
  }

  // restore files in workbench

  workbenchStore.files.set(files);

  return true;
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
        // include file data in export
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

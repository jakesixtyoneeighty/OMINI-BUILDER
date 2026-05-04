import { atom } from 'nanostores';

const AUTOSAVE_DRIVE_KEY = 'bolt.drive.autosave_enabled';

/**
 * Store for Google Drive autosave toggle state.
 * Persisted to localStorage so the user's preference survives page reloads.
 */
export const autosaveDriveEnabled = atom<boolean>(() => {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(AUTOSAVE_DRIVE_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
});

/**
 * Toggle the autosave state and persist it.
 */
export function toggleAutosaveDrive() {
  const current = autosaveDriveEnabled.get();
  const next = !current;
  autosaveDriveEnabled.set(next);
  try {
    localStorage.setItem(AUTOSAVE_DRIVE_KEY, String(next));
  } catch {}
}

/**
 * Set autosave state directly.
 */
export function setAutosaveDrive(enabled: boolean) {
  autosaveDriveEnabled.set(enabled);
  try {
    localStorage.setItem(AUTOSAVE_DRIVE_KEY, String(enabled));
  } catch {}
}

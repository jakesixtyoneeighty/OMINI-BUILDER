import { atom } from 'nanostores';

const AUTOSAVE_DB_KEY = 'bolt.db.autosave_enabled';

/**
 * Store for database auto-save toggle state.
 * Persisted to localStorage so the user's preference survives page reloads.
 */
export const autosaveDbEnabled = atom<boolean>(() => {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(AUTOSAVE_DB_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
});

/**
 * Toggle the auto-save state and persist it.
 */
export function toggleAutosaveDb() {
  const current = autosaveDbEnabled.get();
  const next = !current;
  autosaveDbEnabled.set(next);
  try {
    localStorage.setItem(AUTOSAVE_DB_KEY, String(next));
  } catch {}
}

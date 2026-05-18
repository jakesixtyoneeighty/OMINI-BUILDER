import { atom } from 'nanostores';
import { getSupabase } from '~/lib/supabase';
import { authStore } from './auth';

export const STORAGE_LIMIT_MB = 200;
export const STORAGE_LIMIT_BYTES = STORAGE_LIMIT_MB * 1024 * 1024;

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
  percentage: number;
  loaded: boolean;
}

const DEFAULT_USAGE: StorageUsage = {
  usedBytes: 0,
  limitBytes: STORAGE_LIMIT_BYTES,
  percentage: 0,
  loaded: false,
};

export const storageUsageStore = atom<StorageUsage>(DEFAULT_USAGE);

/**
 * Calculate storage usage by querying project_files from Supabase
 * and estimating IndexedDB + localStorage usage.
 */
// Track if the RPC function is missing so we don't keep trying
const STORAGE_RPC_FLAG = 'bolt.schema.storage_rpc_missing';
let _storageRpcMissing = false;

function isStorageRpcMissing(): boolean {
  if (_storageRpcMissing) return true;
  try {
    _storageRpcMissing = localStorage.getItem(STORAGE_RPC_FLAG) === 'true';
  } catch {}
  return _storageRpcMissing;
}
function setStorageRpcMissing(value: boolean) {
  _storageRpcMissing = value;
  try {
    localStorage.setItem(STORAGE_RPC_FLAG, String(value));
  } catch {}
}

export async function refreshStorageUsage() {
  const sb = getSupabase();
  const user = authStore.get().user;
  let totalBytes = 0;

  if (sb && user) {
    try {
      // Try the RPC function first (skip if we know it doesn't exist)
      if (!isStorageRpcMissing()) {
        const { data, error } = await sb.rpc('get_user_storage_usage', { user_id: user.id });

        if (!error && data !== null) {
          totalBytes = Number(data) || 0;
        } else if (error) {
          // RPC function doesn't exist — mark it so we stop trying
          console.warn('[storage] get_user_storage_usage RPC not available, using fallback estimation');
          setStorageRpcMissing(true);
        }
      }

      // Fallback: estimate storage from project count only (avoid querying 'messages' column)
      if (totalBytes === 0) {
        try {
          const { count, error } = await sb
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('owner_id', user.id);

          if (!error && count) {
            // Rough estimate: ~50KB per project (env vars, settings, etc.)
            totalBytes = count * 50 * 1024;
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore - will show 0 usage
    }
  }

  // Also estimate localStorage usage
  try {
    if (typeof localStorage !== 'undefined') {
      let lsSize = 0;
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('bolt.') || key.startsWith('omni-builder.')) {
          lsSize += (localStorage.getItem(key) || '').length * 2; // UTF-16 = 2 bytes per char
        }
      }
      totalBytes += lsSize;
    }
  } catch {
    // ignore
  }

  const percentage = Math.min(100, (totalBytes / STORAGE_LIMIT_BYTES) * 100);

  storageUsageStore.set({
    usedBytes: totalBytes,
    limitBytes: STORAGE_LIMIT_BYTES,
    percentage,
    loaded: true,
  });
}

export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns a color that transitions from blue (#3B82F6) to red (#EF4444)
 * based on the usage percentage.
 */
export function getStorageBarColor(percentage: number): string {
  if (percentage < 50) {
    // Blue
    return '#3B82F6';
  } else if (percentage < 75) {
    // Blue to orange transition
    const t = (percentage - 50) / 25;
    const r = Math.round(59 + (234 - 59) * t);
    const g = Math.round(130 + (179 - 130) * t);
    const b = Math.round(246 + (8 - 246) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Orange to red transition
    const t = (percentage - 75) / 25;
    const r = Math.round(234 + (239 - 234) * t);
    const g = Math.round(179 + (68 - 179) * t);
    const b = Math.round(8 + (68 - 8) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

import { atom } from 'nanostores';
import { getSupabase } from '~/lib/supabase';
import { authStore } from './auth';

const MAX_ITEMS = 20;

export interface RecentlyViewedItem {
  id: string;
  name: string;
  description: string;
  logo: string;
  timestamp: string;
  source: 'local' | 'cloud';
}

function loadRecentlyViewed(): RecentlyViewedItem[] {
  // Recently viewed is loaded from Supabase (cloud only) — no localStorage persistence
  return [];
}

export const recentlyViewedStore = atom<RecentlyViewedItem[]>(loadRecentlyViewed());

if (typeof window !== 'undefined') {
  // Recently viewed is saved to Supabase (cloud only) — no localStorage persistence
  // The recentlyViewedStore is populated from Supabase when the user logs in
}

/**
 * Add a project to recently viewed — saves to both localStorage and Supabase
 */
export function addRecentlyViewed(item: Omit<RecentlyViewedItem, 'timestamp'>) {
  const current = recentlyViewedStore.get();
  // Validate item
  if (!item.id || typeof item.id !== 'string') return;
  // Remove if already exists (to move to top)
  const filtered = current.filter((i) => i.id !== item.id);
  // Add to front with current timestamp
  const newItem: RecentlyViewedItem = {
    id: item.id,
    name: String(item.name || 'Untitled'),
    description: String(item.description || ''),
    logo: String(item.logo || ''),
    timestamp: new Date().toISOString(),
    source: item.source || 'local',
  };
  const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);
  recentlyViewedStore.set(updated);

  // Save to Supabase (fire-and-forget)
  saveRecentlyViewedToSupabase(item.id);
}

/**
 * Save a recently viewed entry to Supabase
 */
async function saveRecentlyViewedToSupabase(projectId: string) {
  const sb = getSupabase();
  const { user } = authStore.get();
  if (!sb || !user) return;

  try {
    // First delete existing entry (to update viewed_at)
    await sb
      .from('recently_viewed')
      .delete()
      .eq('user_id', user.id)
      .eq('project_id', projectId);

    // Insert new entry
    await sb
      .from('recently_viewed')
      .insert({
        user_id: user.id,
        project_id: projectId,
        viewed_at: new Date().toISOString(),
      });
  } catch {
    // ignore - non-critical
  }
}

/**
 * Load recently viewed from Supabase and merge with local data
 * This ensures the user's own projects appear first
 */
export async function loadRecentlyViewedFromSupabase() {
  const sb = getSupabase();
  const { user } = authStore.get();
  if (!sb || !user) return;

  try {
    // Get recently viewed projects with project details
    const { data, error } = await sb
      .from('recently_viewed')
      .select('project_id, viewed_at, projects(id, name, description, logo)')
      .eq('user_id', user.id)
      .order('viewed_at', { ascending: false })
      .limit(MAX_ITEMS);

    if (error || !data) return;

    const supabaseItems: RecentlyViewedItem[] = data
      .filter((entry: any) => entry.projects)
      .map((entry: any) => ({
        id: entry.project_id,
        name: entry.projects.name || 'Untitled',
        description: entry.projects.description || '',
        logo: entry.projects.logo || '',
        timestamp: entry.viewed_at,
        source: 'cloud' as const,
      }));

    // Merge with local items (Supabase takes precedence for same ids)
    const localItems = recentlyViewedStore.get();
    const seen = new Set(supabaseItems.map((i) => i.id));
    const localOnly = localItems.filter((i) => !seen.has(i.id));

    const merged = [...supabaseItems, ...localOnly].slice(0, MAX_ITEMS);
    recentlyViewedStore.set(merged);
  } catch {
    // ignore
  }
}

export function clearRecentlyViewed() {
  recentlyViewedStore.set([]);
}

import { atom } from 'nanostores';

const RECENTLY_VIEWED_KEY = 'omni-builder.recently-viewed';
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
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentlyViewedItem[];
  } catch {
    return [];
  }
}

export const recentlyViewedStore = atom<RecentlyViewedItem[]>(loadRecentlyViewed());

if (typeof window !== 'undefined') {
  recentlyViewedStore.subscribe((items) => {
    try {
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  });
}

export function addRecentlyViewed(item: Omit<RecentlyViewedItem, 'timestamp'>) {
  const current = recentlyViewedStore.get();
  // Remove if already exists (to move to top)
  const filtered = current.filter((i) => i.id !== item.id);
  // Add to front with current timestamp
  const newItem: RecentlyViewedItem = {
    ...item,
    timestamp: new Date().toISOString(),
  };
  const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);
  recentlyViewedStore.set(updated);
}

export function clearRecentlyViewed() {
  recentlyViewedStore.set([]);
}

import { atom } from 'nanostores';

const STARRED_KEY = 'omni-builder.starred.projects';

function loadStarred(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STARRED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export const starredProjectsStore = atom<Set<string>>(loadStarred());

if (typeof window !== 'undefined') {
  starredProjectsStore.subscribe((set) => {
    try {
      localStorage.setItem(STARRED_KEY, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
  });
}

export function toggleStar(projectId: string) {
  const current = starredProjectsStore.get();
  const next = new Set(current);
  if (next.has(projectId)) {
    next.delete(projectId);
  } else {
    next.add(projectId);
  }
  starredProjectsStore.set(next);
}

export function isStarred(projectId: string): boolean {
  return starredProjectsStore.get().has(projectId);
}

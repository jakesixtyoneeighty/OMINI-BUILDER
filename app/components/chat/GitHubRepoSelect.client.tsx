import { useStore } from '@nanostores/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { githubProviderTokenStore } from '~/lib/stores/auth';

interface Repo {
  full_name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
  updated_at: string;
}

interface Props {
  value: string;
  onChange: (fullName: string, defaultBranch?: string) => void;
  placeholder?: string;
  className?: string;
}

let cache: Repo[] | null = null;

export function GitHubRepoSelect({ value, onChange, placeholder = 'owner/name', className }: Props) {
  const ghToken = useStore(githubProviderTokenStore);
  const [repos, setRepos] = useState<Repo[]>(cache ?? []);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!ghToken || cache) return;
    setLoading(true);
    fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' },
    })
      .then((r) => (r.ok ? (r.json() as Promise<Repo[]>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        cache = data;
        setRepos(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ghToken]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return repos.slice(0, 50);
    return repos.filter((r) => r.full_name.toLowerCase().includes(f)).slice(0, 50);
  }, [repos, filter]);

  if (!ghToken) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          className ??
          'w-full px-3 py-2 rounded text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:border-bolt-elements-item-contentAccent'
        }
      />
    );
  }

  return (
    <div className="relative">
      <div className="flex">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setFilter(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={loading ? 'Loading your repos…' : placeholder}
          className={
            className ??
            'w-full px-3 py-2 rounded text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:border-bolt-elements-item-contentAccent'
          }
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="ml-1 px-2 rounded border border-bolt-elements-borderColor text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary"
          title="Browse your repos"
        >
          <div className="i-ph:caret-down text-xs" />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-[110]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-lg z-[111]">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-bolt-elements-textTertiary">
                {loading ? 'Loading…' : 'No matching repositories.'}
              </div>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.full_name}
                  type="button"
                  onClick={() => {
                    onChange(r.full_name, r.default_branch);
                    setFilter('');
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-bolt-elements-item-backgroundActive flex items-center gap-2"
                >
                  <div className={`${r.private ? 'i-ph:lock' : 'i-ph:globe'} text-bolt-elements-textTertiary text-sm`} />
                  <span className="text-bolt-elements-textPrimary truncate flex-1">{r.full_name}</span>
                  <span className="text-[10px] text-bolt-elements-textTertiary">{r.default_branch}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
import { useStore } from '@nanostores/react';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { githubProviderTokenStore } from '~/lib/stores/auth';
import { getActiveProject, updateActiveProjectSettings } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';

interface Repo {
  full_name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
  updated_at: string;
  language: string | null;
  stargazers_count: number;
}

export function GitHubPush() {
  const project = getActiveProject();
  const files = useStore(workbenchStore.files);
  const ghToken = useStore(githubProviderTokenStore);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'config' | 'pushing' | 'done'>('config');
  const [repo, setRepo] = useState(project.settings.github.repo);
  const [branch, setBranch] = useState(project.settings.github.branch || 'main');
  const [message, setMessage] = useState('Update from Omni-Builder');
  const [loading, setLoading] = useState(false);
  const [pushResult, setPushResult] = useState<{ url: string; pushed: number; commit: string } | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoFilter, setRepoFilter] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [repoExists, setRepoExists] = useState<boolean | null>(null);

  const fileCount = useMemo(() => {
    return Object.entries(files).filter(([_, f]) => f?.type === 'file' && !f.isBinary).length;
  }, [files]);

  useEffect(() => {
    if (open) {
      const p = getActiveProject();
      setRepo(p.settings.github.repo);
      setBranch(p.settings.github.branch || 'main');
      setStep('config');
      setPushResult(null);
      if (ghToken) {
        fetchRepos();
      }
    }
  }, [open, ghToken]);

  const fetchRepos = async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRepos(data);
    } catch {
      toast.error('Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  const selectRepo = (full_name: string, defaultBranch?: string, isPrivateRepo?: boolean) => {
    setRepo(full_name);
    if (defaultBranch) setBranch(defaultBranch);
    if (isPrivateRepo !== undefined) setIsPrivate(isPrivateRepo);
    setRepoExists(true);
  };

  const checkRepoExists = async (repoName: string) => {
    if (!ghToken || !repoName.trim()) { setRepoExists(null); return; }
    try {
      const res = await fetch(`https://api.github.com/repos/${repoName.trim()}`, {
        headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' },
      });
      if (res.ok) {
        const data = await res.json() as Repo;
        setRepoExists(true);
        setIsPrivate(data.private);
        if (data.default_branch && !branch) setBranch(data.default_branch);
      } else {
        setRepoExists(false);
      }
    } catch {
      setRepoExists(null);
    }
  };

  const filteredRepos = useMemo(() => {
    const f = repoFilter.trim().toLowerCase();
    if (!f) return repos.slice(0, 20);
    return repos.filter(r => r.full_name.toLowerCase().includes(f)).slice(0, 20);
  }, [repos, repoFilter]);

  async function submit() {
    const useToken = (ghToken || '').trim();
    if (!useToken || !repo.trim()) {
      toast.error('GitHub token and repository are required');
      return;
    }

    setLoading(true);
    setStep('pushing');
    try {
      await workbenchStore.saveAllFiles();
      updateActiveProjectSettings({ github: { token: useToken, repo: repo.trim(), branch: branch.trim() } });

      const res = await fetch('/api/github-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: useToken,
          repo: repo.trim(),
          branch: branch.trim(),
          message,
          private: isPrivate,
          createIfMissing: true,
          files: Object.entries(files)
            .filter(([_, f]) => f?.type === 'file' && !f.isBinary)
            .map(([path, f]) => ({ path: path.replace(/^\/+/, ''), content: (f as any).content })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).error || 'Push failed');
      }

      const data = await res.json();
      setPushResult(data);
      setStep('done');
      toast.success('Code pushed successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
      setStep('config');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center justify-center w-8 h-8 rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor transition-theme" title="Push to GitHub">
        <div className="i-ph:git-branch text-base" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-[520px] max-w-[95vw] bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-bolt-elements-borderColor">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-bolt-elements-background-depth-1 flex items-center justify-center">
                  <div className="i-ph:github-logo text-xl text-bolt-elements-textPrimary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-bolt-elements-textPrimary">Push to GitHub</h2>
                  <p className="text-xs text-bolt-elements-textTertiary">
                    {step === 'config' && 'Select a repository and push your code'}
                    {step === 'pushing' && 'Uploading your files to GitHub...'}
                    {step === 'done' && 'Your code has been pushed!'}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress bar for pushing */}
            {(step === 'pushing' || step === 'done') && (
              <div className="h-1 bg-bolt-elements-background-depth-1">
                <div
                  className={`h-full transition-all duration-700 ${step === 'done' ? 'bg-green-500 w-full' : 'bg-purple-500 animate-pulse w-2/3'}`}
                />
              </div>
            )}

            {/* Content */}
            <div className="p-6">
              {step === 'config' && (
                <div className="space-y-4">
                  {/* Token Status */}
                  {!ghToken && (
                    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <div className="i-ph:warning text-yellow-400 text-lg shrink-0" />
                      <p className="text-xs text-yellow-300">No GitHub token configured. Add one in Settings to browse your repos.</p>
                    </div>
                  )}

                  {/* Repo Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">Repository</label>
                    {ghToken && repos.length > 0 ? (
                      <div className="relative">
                        <div className="flex gap-2">
                          <input
                            value={repo}
                            onChange={(e) => { setRepo(e.target.value); setRepoFilter(e.target.value); setRepoExists(null); }}
                            onFocus={() => setRepoFilter(repo)}
                            onBlur={() => checkRepoExists(repo)}
                            placeholder="owner/repo or search..."
                            className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all placeholder:text-bolt-elements-textTertiary"
                          />
                          <button onClick={fetchRepos} disabled={loadingRepos} className="px-3 py-2.5 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all disabled:opacity-50">
                            <div className={`text-lg ${loadingRepos ? 'i-svg-spinners:90-ring-with-bg' : 'i-ph:arrow-clockwise'}`} />
                          </button>
                        </div>
                        {repoFilter && (
                          <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-xl z-10">
                            {filteredRepos.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-bolt-elements-textTertiary">No matching repositories</div>
                            ) : (
                              filteredRepos.map(r => (
                                <button
                                  key={r.full_name}
                                  onClick={() => { selectRepo(r.full_name, r.default_branch, r.private); setRepoFilter(''); }}
                                  className={`w-full text-left px-4 py-2.5 hover:bg-bolt-elements-item-backgroundActive transition-colors ${
                                    repo === r.full_name ? 'bg-purple-500/10' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`${r.private ? 'i-ph:lock-simple' : 'i-ph:git-branch'} text-sm ${r.private ? 'text-yellow-500' : 'text-green-500'}`} />
                                    <span className="text-sm font-medium text-bolt-elements-textPrimary">{r.full_name}</span>
                                    {r.language && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary">{r.language}</span>
                                    )}
                                    <span className="text-[10px] text-bolt-elements-textTertiary ml-auto">{r.default_branch}</span>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        value={repo}
                        onChange={(e) => setRepo(e.target.value)}
                        onBlur={() => checkRepoExists(repo)}
                        placeholder="owner/repo"
                        className="w-full px-4 py-2.5 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all placeholder:text-bolt-elements-textTertiary"
                      />
                    )}
                    {/* Repo exists indicator */}
                    {repoExists === true && (
                      <div className="flex items-center gap-1.5 mt-1.5 px-2">
                        <div className="i-ph:check-circle-fill text-green-400 text-xs" />
                        <span className="text-[11px] text-green-400 font-medium">Existing repo — will be updated</span>
                      </div>
                    )}
                    {repoExists === false && (
                      <div className="flex items-center gap-1.5 mt-1.5 px-2">
                        <div className="i-ph:plus-circle-fill text-blue-400 text-xs" />
                        <span className="text-[11px] text-blue-400 font-medium">New repo — will be created</span>
                      </div>
                    )}
                  </div>

                  {/* Private/Public Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">Visibility</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsPrivate(true)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                          isPrivate
                            ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                            : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary'
                        }`}
                      >
                        <div className={isPrivate ? 'i-ph:lock-simple-fill' : 'i-ph:lock-simple'} />
                        Private
                      </button>
                      <button
                        onClick={() => setIsPrivate(false)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                          !isPrivate
                            ? 'border-green-500 bg-green-500/10 text-green-400'
                            : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary'
                        }`}
                      >
                        <div className={!isPrivate ? 'i-ph:lock-simple-open-fill' : 'i-ph:lock-simple-open'} />
                        Public
                      </button>
                    </div>
                    {repoExists === false && (
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">
                        Visibility applies when creating a new repository
                      </p>
                    )}
                  </div>

                  {/* Branch & Commit Message */}
                  <div className="grid grid-cols-[140px_1fr] gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">Branch</label>
                      <input
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        placeholder="main"
                        className="w-full px-4 py-2.5 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all placeholder:text-bolt-elements-textTertiary font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">Commit Message</label>
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="What changed?"
                        className="w-full px-4 py-2.5 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all placeholder:text-bolt-elements-textTertiary"
                      />
                    </div>
                  </div>

                  {/* File count info */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                    <div className="i-ph:files text-bolt-elements-textTertiary" />
                    <span className="text-xs text-bolt-elements-textSecondary">
                      <span className="font-semibold text-bolt-elements-textPrimary">{fileCount}</span> files will be pushed
                    </span>
                  </div>
                </div>
              )}

              {step === 'pushing' && (
                <div className="py-8 flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/15 flex items-center justify-center">
                    <div className="i-svg-spinners:90-ring-with-bg text-2xl text-purple-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-bolt-elements-textPrimary">Pushing to GitHub</p>
                    <p className="text-xs text-bolt-elements-textTertiary mt-1">
                      Uploading {fileCount} files to {repo}/{branch}
                    </p>
                  </div>
                </div>
              )}

              {step === 'done' && pushResult && (
                <div className="py-6 flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
                    <div className="i-ph:check-circle text-3xl text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-bolt-elements-textPrimary">Push Successful!</p>
                    <p className="text-xs text-bolt-elements-textTertiary mt-1">
                      {pushResult.pushed} files pushed to <span className="font-medium text-bolt-elements-textPrimary">{repo}/{branch}</span>
                    </p>
                    <p className="text-[11px] text-bolt-elements-textTertiary mt-1 font-mono">
                      {pushResult.commit.slice(0, 7)}
                    </p>
                  </div>
                  <a
                    href={pushResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
                  >
                    <div className="i-ph:arrow-square-out" />
                    Open on GitHub
                  </a>
                </div>
              )}
            </div>

            {/* Footer */}
            {step !== 'pushing' && (
              <div className="px-6 py-4 border-t border-bolt-elements-borderColor flex justify-end gap-3">
                {step === 'done' ? (
                  <button onClick={() => setOpen(false)} className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-all">
                    Close
                  </button>
                ) : (
                  <>
                    <button onClick={() => setOpen(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={submit}
                      disabled={loading || !repo.trim()}
                      className="px-5 py-2.5 rounded-lg text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      <div className="i-ph:arrow-up-right text-base" />
                      Push Code
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

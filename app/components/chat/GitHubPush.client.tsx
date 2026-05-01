import { useStore } from '@nanostores/react';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { githubProviderTokenStore } from '~/lib/stores/auth';
import { activeProjectIdStore, getActiveProject, updateActiveProjectSettings } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';

interface Repo {
  full_name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
  updated_at: string;
}

export function GitHubPush({ trigger }: { trigger?: React.ReactNode }) {
  const project = getActiveProject();
  const files = useStore(workbenchStore.files);
  const ghToken = useStore(githubProviderTokenStore);
  const [open, setOpen] = useState(false);
  const [repo, setRepo] = useState(project.settings.github.repo);
  const [branch, setBranch] = useState(project.settings.github.branch || 'main');
  const [message, setMessage] = useState('Sync from Bolt');
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  useEffect(() => {
    if (open && ghToken) {
      fetchRepos();
    }
  }, [open, ghToken]);

  const fetchRepos = async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' }
      });
      if (!res.ok) throw new Error('Falha ao carregar repositórios');
      const data = await res.json();
      setRepos(data);
    } catch (err) {
      toast.error('Erro ao carregar repositórios');
    } finally {
      setLoadingRepos(false);
    }
  };

  const selectRepo = (full_name: string) => {
    setRepo(full_name);
    const selected = repos.find(r => r.full_name === full_name);
    if (selected) setBranch(selected.default_branch);
  };

  async function submit() {
    const useToken = (ghToken || '').trim();
    if (!useToken || !repo.trim()) {
      toast.error('Token GitHub ou Repositório não configurados.');
      return;
    }

    setLoading(true);
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
          files: Object.entries(files)
            .filter(([_, f]) => f?.type === 'file' && !f.isBinary)
            .map(([path, f]) => ({ path: path.replace(/^\/+/, ''), content: (f as any).content })),
        }),
      });

      if (!res.ok) throw new Error('Falha ao realizar push');
      toast.success('Código enviado ao GitHub com sucesso!');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center justify-center w-8 h-8 rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor transition-theme">
        <div className="i-ph:git-branch text-base" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-[500px] bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-bolt-elements-textPrimary">Push para GitHub</h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm text-bolt-elements-textSecondary mb-1 block">Repositório</label>
                <div className="relative">
                  <input 
                    value={repo} 
                    onChange={e => setRepo(e.target.value)} 
                    placeholder="usuario/repositorio" 
                    className="w-full p-2.5 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-sm"
                  />
                  {ghToken && (
                    <button 
                      onClick={() => fetchRepos()} 
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                    >
                      <div className="i-ph:arrow-circle-down text-lg" />
                    </button>
                  )}
                </div>
                {loadingRepos && (
                  <div className="text-xs text-bolt-elements-textTertiary mt-1">Carregando repositórios...</div>
                )}
                {repos.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-bolt-elements-borderColor rounded-lg">
                    {repos.map(r => (
                      <button 
                        key={r.full_name}
                        onClick={() => selectRepo(r.full_name)}
                        className="w-full text-left p-2 hover:bg-bolt-elements-item-backgroundActive text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`${r.private ? 'i-ph:lock' : 'i-ph:globe'} text-bolt-elements-textTertiary`} />
                          <span className="font-medium">{r.full_name}</span>
                          <span className="text-xs text-bolt-elements-textTertiary">{r.default_branch}</span>
                        </div>
                        {r.description && <div className="text-xs text-bolt-elements-textTertiary mt-1">{r.description}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="branch (ex: main)" className="w-full p-2.5 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-sm" />
              <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Mensagem do commit" className="w-full p-2.5 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-sm" />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-bolt-elements-textSecondary">Cancelar</button>
              <button onClick={submit} disabled={loading} className="px-4 py-2 bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent rounded-lg text-sm font-bold">
                {loading ? 'Enviando...' : 'Confirmar Push'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
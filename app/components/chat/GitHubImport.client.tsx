import { useStore } from '@nanostores/react';
import { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { githubProviderTokenStore } from '~/lib/stores/auth';
import { GitHubRepoSelect } from './GitHubRepoSelect.client';
import { useT } from '~/lib/i18n/useT';

interface ImportedFile {
  path: string;
  content: string;
}

interface ImportResult {
  files: ImportedFile[];
  stats: { totalBlobs: number; imported: number; skipped: number; truncated: boolean };
  owner?: string;
  repo?: string;
  ref?: string;
}

interface GitHubImportProps {
  onImport: (result: ImportResult) => void | Promise<void>;
  trigger?: React.ReactNode;
}

export function GitHubImport({ onImport, trigger }: GitHubImportProps) {
  const ghToken = useStore(githubProviderTokenStore);
  const [open, setOpen] = useState(false);
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const t = useT();
  
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  async function submitGitHub() {
    if (!repo.trim()) return;
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const useToken = (token.trim() || ghToken || '').trim();
      if (useToken) headers['x-github-token'] = useToken;
      
      const res = await fetch(`/api/github-import?repo=${encodeURIComponent(repo.trim())}`, { headers });
      const data = (await res.json()) as ImportResult & { error?: string };
      
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      
      await onImport(data);
      setOpen(false);
      setRepo('');
      toast.success(`${t('githubImport.imported')} ${data.stats.imported} ${t('githubImport.filesFromGitHub')}`);
    } catch (err) {
      toast.error(`${t('githubImport.gitHubImportFailed')} ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  }

  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/import-zip', { method: 'POST', body: formData });
      const data = (await res.json()) as ImportResult & { error?: string };
      
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      
      await onImport({ ...data, owner: 'local', repo: file.name });
      toast.success(`${t('githubImport.imported')} ${data.stats.imported} ${t('githubImport.filesFromZip')}`);
    } catch (err) {
      toast.error(`${t('githubImport.zipImportFailed')} ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    try {
      const importedFiles: ImportedFile[] = [];
      let skipped = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Skip large files and common ignored directories
        if (file.size > 200 * 1024 || file.webkitRelativePath.includes('node_modules/')) {
          skipped++;
          continue;
        }

        const content = await file.text();
        importedFiles.push({
          path: file.webkitRelativePath,
          content
        });
      }

      const result: ImportResult = {
        files: importedFiles,
        stats: {
          totalBlobs: files.length,
          imported: importedFiles.length,
          skipped,
          truncated: false
        },
        owner: 'local',
        repo: 'folder-upload'
      };

      await onImport(result);
      toast.success(`${t('githubImport.imported')} ${importedFiles.length} ${t('githubImport.filesFromFolder')}`);
    } catch (err) {
      toast.error(`${t('githubImport.folderImportFailed')} ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(true)}
          className="mojo-btn-secondary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-contentAccent/30 hover:border-mojo-sky/40"
        >
          <div className="i-ph:github-logo text-lg" />
          {t('githubImport.github')}
        </button>
        
        <button
          onClick={() => zipInputRef.current?.click()}
          disabled={loading}
          className="mojo-btn-secondary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          <div className="i-ph:archive text-lg" />
          {t('githubImport.zip')}
        </button>

        <button
          onClick={() => folderInputRef.current?.click()}
          disabled={loading}
          className="mojo-btn-secondary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          <div className="i-ph:folder-open text-lg" />
          {t('githubImport.folder')}
        </button>
      </div>

      {/* Hidden Inputs */}
      <input
        type="file"
        ref={zipInputRef}
        onChange={handleZipChange}
        accept=".zip"
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderChange}
        {...({ webkitdirectory: "", directory: "" } as any)}
        className="hidden"
      />

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !loading && setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[460px] max-w-[92vw] rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="i-ph:github-logo text-3xl text-bolt-elements-textPrimary" />
                <h2 className="text-xl font-bold text-bolt-elements-textPrimary">{t('github.import')}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors">
                <div className="i-ph:x text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                  {t('github.repositoryUrl')}
                </label>
                <GitHubRepoSelect value={repo} onChange={(v) => setRepo(v)} placeholder="e.g. stackblitz/bolt.new" />
              </div>

              {!ghToken && (
                <div>
                  <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                    {t('github.githubTokenOptional')}
                  </label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_..."
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-bolt-elements-item-contentAccent/30 transition-all"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
              >
                {t('github.cancel')}
              </button>
              <button
                onClick={submitGitHub}
                disabled={loading || !repo.trim()}
                className="px-6 py-2 rounded-lg text-sm font-bold bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border border-bolt-elements-item-contentAccent hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {loading ? t('github.importing') : t('github.importRepository')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
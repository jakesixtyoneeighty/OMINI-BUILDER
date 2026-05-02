import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { getActiveProject } from '~/lib/stores/project';
import { supabaseEnabled, googleProviderTokenStore, authStore, signInWithGoogleDrive } from '~/lib/stores/auth';

const DRIVE_SAVE_PENDING_KEY = 'bolt.drive.save_pending';

export function SaveToDrive() {
  const isSupabase = supabaseEnabled;
  const { user, session } = useStore(authStore);
  const googleToken = useStore(googleProviderTokenStore);
  const isLoggedInGoogle = user?.app_metadata?.provider === 'google' && !!googleToken;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'idle' | 'auth' | 'creating' | 'uploading' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [driveUrl, setDriveUrl] = useState('');
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState('');

  // Auto-abre o dialog apos redirect OAuth (detecta ?drive_save=1 na URL)
  useEffect(() => {
    if (!isSupabase) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('drive_save') === '1') {
      const url = new URL(window.location.href);
      url.searchParams.delete('drive_save');
      window.history.replaceState({}, '', url.pathname);
      setOpen(true);
    }
  }, [isSupabase]);

  // Quando o token do Google fica disponivel e ha save pendente, iniciar upload
  useEffect(() => {
    if (!open || !isSupabase || !googleToken) return;
    const pending = localStorage.getItem(DRIVE_SAVE_PENDING_KEY);
    if (pending) {
      localStorage.removeItem(DRIVE_SAVE_PENDING_KEY);
      setAccessToken(googleToken);
      setStep('auth');
    }
  }, [open, isSupabase, googleToken]);

  // Se o usuario ja esta logado com Google via Supabase e abre o dialog, usar o token direto
  const handleSaveClick = useCallback(() => {
    if (!isSupabase) {
      toast.error('Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      return;
    }

    if (!isLoggedInGoogle) {
      // Nao esta logado com Google — precisa fazer login via Supabase OAuth
      handleSupabaseAuth();
      return;
    }

    // Ja esta logado com Google — usar o token existente
    setAccessToken(googleToken);
    setStep('auth');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupabase, isLoggedInGoogle, googleToken]);

  const handleSupabaseAuth = async () => {
    try {
      setStep('auth');
      await signInWithGoogleDrive();
      // O usuario vai ser redirecionado para o Google OAuth via Supabase
      // Apos o callback, o useEffect acima vai detectar o save_pending e retomar
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : 'Falha na autenticação');
      toast.error(err instanceof Error ? err.message : 'Falha na autenticação');
    }
  };

  // Watch for access token to trigger upload
  useEffect(() => {
    if (accessToken && step === 'auth') {
      uploadToDrive(accessToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, step]);

  const createFolder = async (token: string, folderName: string): Promise<string> => {
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error?.message || 'Failed to create folder');
    }

    const data = await res.json();
    return data.id;
  };

  const searchExistingFolder = async (token: string, folderName: string): Promise<string | null> => {
    const query = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=files(id,name)&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  };

  const deleteFolderContents = async (token: string, folderId: string) => {
    let pageToken = '';
    do {
      const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
      let url = `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=files(id)&pageSize=100`;
      if (pageToken) url += `&pageToken=${pageToken}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) break;

      const data = await res.json();
      if (data.files) {
        for (const file of data.files) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
      }
      pageToken = data.nextPageToken || '';
    } while (pageToken);
  };

  const uploadFile = async (token: string, folderId: string, filePath: string, content: string): Promise<void> => {
    const fileName = filePath.split('/').pop() || filePath;

    const mimeMap: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.jsx': 'text/typescript',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.svg': 'image/svg+xml',
      '.xml': 'application/xml',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.py': 'text/x-python',
      '.env': 'text/plain',
      '.txt': 'text/plain',
      '.sh': 'text/x-shellscript',
      '.astro': 'text/astro',
      '.svelte': 'text/svelte',
      '.vue': 'text/vue',
      '.scss': 'text/scss',
      '.less': 'text/less',
    };

    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
    const mimeType = mimeMap[ext] || 'application/octet-stream';

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    // Se o path tem subdiretorios, cria-as como pastas no Drive
    const pathParts = filePath.split('/').slice(0, -1);
    let parentId = folderId;

    for (const dirName of pathParts) {
      if (!dirName) continue;

      const query = encodeURIComponent(`name='${dirName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=files(id)&pageSize=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          parentId = searchData.files[0].id;
          continue;
        }
      }

      const folderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: dirName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        }),
      });

      if (folderRes.ok) {
        const folderData = await folderRes.json();
        parentId = folderData.id;
      }
    }

    const metadata = { name: fileName, mimeType, parents: [parentId] };
    const base64Content = btoa(unescape(encodeURIComponent(content)));

    const multipartBody =
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}${delimiter}Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Content}${closeDelimiter}`;

    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to upload ${fileName}: ${(err as any).error?.message || 'Unknown error'}`);
    }
  };

  const uploadToDrive = async (token: string) => {
    try {
      setStep('creating');

      const project = getActiveProject();
      const projectName = project.name || 'Omni-Builder Project';
      const safeName = projectName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Omni-Builder-Project';

      // Salva arquivos nao salvos primeiro
      await workbenchStore.saveAllFiles();

      // Pega todos os arquivos do workbench
      const files = workbenchStore.files.get();
      const fileEntries = Object.entries(files).filter(
        ([path, dirent]) =>
          dirent?.type === 'file' &&
          !dirent.isBinary &&
          !path.includes('node_modules') &&
          !path.includes('.git'),
      );

      if (fileEntries.length === 0) {
        toast.error('Nenhum arquivo para salvar. Crie alguns arquivos primeiro!');
        setStep('error');
        setError('Nenhum arquivo encontrado no projeto.');
        return;
      }

      setTotalFiles(fileEntries.length);

      // Verifica se pasta ja existe
      let folderId = await searchExistingFolder(token, safeName);

      if (folderId) {
        await deleteFolderContents(token, folderId);
        toast.info('Atualizando pasta do projeto...');
      } else {
        folderId = await createFolder(token, safeName);
        toast.info('Pasta criada no Google Drive');
      }

      setStep('uploading');
      setProgress(0);

      for (let i = 0; i < fileEntries.length; i++) {
        const [path, dirent] = fileEntries[i];
        const content = (dirent as any).content || '';
        const cleanPath = path.replace(/^\/+/, '');

        try {
          await uploadFile(token, folderId, cleanPath, content);
        } catch (err) {
          console.warn(`Arquivo ignorado ${cleanPath}:`, err);
        }

        setProgress(Math.round(((i + 1) / fileEntries.length) * 100));
      }

      const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      setDriveUrl(folderUrl);

      setStep('done');
      toast.success(`${fileEntries.length} arquivos salvos no Google Drive!`);
    } catch (err) {
      console.error('Google Drive save failed:', err);
      setStep('error');
      setError(err instanceof Error ? err.message : 'Erro inesperado');
      toast.error(`Falha ao salvar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  const resetAndClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep('idle');
      setProgress(0);
      setDriveUrl('');
      setError('');
      setAccessToken('');
    }, 300);
  };

  // Se Supabase nao esta configurado, nao mostra o botao
  if (!isSupabase) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor transition-theme"
        title="Save to Google Drive"
      >
        <div className="i-ph:google-drive-logo text-base" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={resetAndClose}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[500px] max-w-[95vw] rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-bolt-elements-borderColor">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                  <div className="i-ph:google-drive-logo text-blue-400 text-xl" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-bolt-elements-textPrimary">Save to Google Drive</h2>
                  <p className="text-xs text-bolt-elements-textTertiary">
                    {step === 'done' ? 'Projeto salvo com sucesso!'
                      : step === 'error' ? 'Algo deu errado'
                      : 'Salve seus arquivos no Google Drive'}
                  </p>
                </div>
              </div>
              <button onClick={resetAndClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all">
                <div className="i-ph:x text-lg" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* === IDLE: Info + Sign In === */}
              {step === 'idle' && (
                <div className="space-y-4">
                  {/* Status da autenticacao */}
                  <div>
                    <label className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider block mb-2">
                      Autenticacao
                    </label>

                    {isLoggedInGoogle ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/8 border border-green-500/20">
                        <div className="i-ph:check-circle-fill text-green-400 text-sm shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-green-400 font-medium">Logado via Supabase (Google)</span>
                          <span className="text-[10px] text-green-400/60 block truncate">{user?.email}</span>
                        </div>
                        <span className="text-[9px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full font-semibold shrink-0">OK</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
                        <div className="i-ph:warning-circle text-amber-400 text-sm shrink-0" />
                        <span className="text-xs text-amber-400">
                          {user ? 'Voce esta logado, mas nao via Google. Faca login com Google para salvar no Drive.' : 'Faca login com Google via Supabase para salvar no Drive.'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info box */}
                  <div className="p-4 rounded-xl bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="i-ph:folder-open text-amber-400 text-lg mt-0.5 shrink-0" />
                      <div className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                        Uma pasta com o nome do seu projeto sera criada (ou atualizada) no Google Drive. A estrutura de diretorios e preservada.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="i-ph:shield-check text-green-400 text-lg mt-0.5 shrink-0" />
                      <div className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                        Usa a autenticacao do Supabase com Google OAuth. O acesso ao Drive usa o escopo minimo (<code className="text-xs bg-bolt-elements-background-depth-2 px-1 py-0.5 rounded">drive.file</code>).
                      </div>
                    </div>
                  </div>

                  {/* Botao principal */}
                  <button
                    onClick={handleSaveClick}
                    className="w-full py-3 px-4 bg-blue-500/12 text-blue-400 rounded-xl text-sm font-semibold border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isLoggedInGoogle ? (
                      <>
                        <div className="i-ph:cloud-arrow-up text-base" />
                        Salvar no Google Drive
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Sign in with Google & Save
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* === AUTH: Waiting === */}
              {step === 'auth' && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="i-svg-spinners:90-ring-with-bg text-2xl text-blue-400" />
                  <p className="text-sm text-bolt-elements-textSecondary">Autenticando com Google via Supabase...</p>
                  <p className="text-xs text-bolt-elements-textTertiary">Complete o login na janela que abriu</p>
                </div>
              )}

              {/* === CREATING FOLDER === */}
              {step === 'creating' && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="i-svg-spinners:90-ring-with-bg text-2xl text-blue-400" />
                  <p className="text-sm text-bolt-elements-textSecondary">Preparando seu projeto...</p>
                  <p className="text-xs text-bolt-elements-textTertiary">Criando pasta no Google Drive</p>
                </div>
              )}

              {/* === UPLOADING: Progress === */}
              {step === 'uploading' && (
                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-bolt-elements-textPrimary">Enviando arquivos...</p>
                    <p className="text-sm text-bolt-elements-textSecondary">{progress}%</p>
                  </div>

                  <div className="w-full h-2.5 bg-bolt-elements-background-depth-1 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-bolt-elements-textTertiary">
                    <div className="i-svg-spinners:90-ring-with-bg text-sm" />
                    <span>Salvando arquivos no Google Drive...</span>
                  </div>
                </div>
              )}

              {/* === DONE: Success === */}
              {step === 'done' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center py-4 gap-3">
                    <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                      <div className="i-ph:check-circle-fill text-green-400 text-3xl" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-green-400">Projeto salvo!</p>
                      <p className="text-xs text-bolt-elements-textTertiary mt-1">
                        {totalFiles} arquivos enviados com sucesso
                      </p>
                    </div>
                  </div>

                  {driveUrl && (
                    <a
                      href={driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-500/12 text-blue-400 rounded-xl text-sm font-semibold border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                    >
                      <div className="i-ph:folder-open text-base" />
                      Abrir no Google Drive
                    </a>
                  )}

                  <button
                    onClick={() => {
                      setStep('idle');
                      setProgress(0);
                      setDriveUrl('');
                      setAccessToken('');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
                  >
                    Salvar novamente
                  </button>
                </div>
              )}

              {/* === ERROR === */}
              {step === 'error' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center py-4 gap-3">
                    <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center">
                      <div className="i-ph:warning-circle-fill text-red-400 text-3xl" />
                    </div>
                    <div className="text-center max-w-[80%]">
                      <p className="text-sm font-semibold text-red-400">Falha ao salvar</p>
                      <p className="text-xs text-bolt-elements-textTertiary mt-1 break-words">{error}</p>
                    </div>
                  </div>

                  {error.includes('access') || error.includes('token') || error.includes('scope') ? (
                    <div className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                      <p className="text-xs text-amber-400">
                        O token do Google pode nao ter permissao de Drive. Tente fazer login novamente clicando em "Tentar novamente".
                      </p>
                    </div>
                  ) : null}

                  <button
                    onClick={() => {
                      setStep('idle');
                      setError('');
                      setAccessToken('');
                    }}
                    className="w-full py-3 px-4 bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary rounded-xl text-sm font-semibold border border-bolt-elements-borderColor hover:bg-bolt-elements-item-backgroundAccent transition-all flex items-center justify-center gap-2"
                  >
                    <div className="i-ph:arrow-counter-clockwise text-base" />
                    Tentar novamente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Exported autosave function - can be called from anywhere
let autosaveInProgress = false;

export async function autosaveToDrive(): Promise<boolean> {
  if (autosaveInProgress) return false;

  if (!supabaseEnabled) return false;

  const token = googleProviderTokenStore.get();
  if (!token) return false;

  autosaveInProgress = true;

  try {
    const { workbenchStore: wb } = await import('~/lib/stores/workbench');
    const { getActiveProject: getProject } = await import('~/lib/stores/project');

    await wb.saveAllFiles();

    const files = wb.files.get();
    const fileEntries = Object.entries(files).filter(
      ([path, dirent]) =>
        dirent?.type === 'file' &&
        !dirent.isBinary &&
        !path.includes('node_modules') &&
        !path.includes('.git'),
    );

    if (fileEntries.length === 0) {
      autosaveInProgress = false;
      return false;
    }

    const project = getProject();
    const projectName = (project.name || 'Omni-Builder Project').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Omni-Builder-Project';

    // Search/create folder
    const query = encodeURIComponent(`name='${projectName}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=files(id)&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let folderId: string;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files?.length > 0) {
        folderId = searchData.files[0].id;
      } else {
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName, mimeType: 'application/vnd.google-apps.folder' }),
        });
        const createData = await createRes.json();
        folderId = createData.id;
      }
    } else {
      autosaveInProgress = false;
      return false;
    }

    // Upload each file (simplified - no subdirectory creation for autosave speed)
    const mimeMap: Record<string, string> = {
      '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
      '.ts': 'text/typescript', '.tsx': 'text/typescript', '.jsx': 'text/typescript',
      '.json': 'application/json', '.md': 'text/markdown', '.svg': 'image/svg+xml',
      '.py': 'text/x-python', '.env': 'text/plain', '.txt': 'text/plain',
    };

    for (const [path, dirent] of fileEntries) {
      const content = (dirent as any).content || '';
      const fileName = path.split('/').pop() || path;
      const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
      const mimeType = mimeMap[ext] || 'application/octet-stream';

      const boundary = '-------auto' + Date.now();
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;
      const metadata = { name: fileName, mimeType, parents: [folderId] };
      const base64Content = btoa(unescape(encodeURIComponent(content)));
      const multipartBody =
        `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}${delimiter}Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Content}${closeDelimiter}`;

      await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipartBody,
      }).catch(() => {});
    }

    autosaveInProgress = false;
    return true;
  } catch {
    autosaveInProgress = false;
    return false;
  }
}

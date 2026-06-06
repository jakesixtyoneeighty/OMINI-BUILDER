import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { getActiveProject } from '~/lib/stores/project';
import { supabaseEnabled, googleProviderTokenStore, authStore, signInWithGoogleDrive } from '~/lib/stores/auth';
import { chatId } from '~/lib/persistence/useChatHistory';
import { autosaveDriveEnabled, toggleAutosaveDrive } from '~/lib/stores/drive';
import { useT } from '~/lib/i18n/useT';

const DRIVE_SAVE_PENDING_KEY = 'bolt.drive.save_pending';
const MOJO_FOLDER_NAME = 'mojo';

export function SaveToDrive() {
  const isSupabase = supabaseEnabled;
  const { user, session } = useStore(authStore);
  const googleToken = useStore(googleProviderTokenStore);
  const isLoggedInGoogle = user?.app_metadata?.provider === 'google' && !!googleToken;
  const autosaveOn = useStore(autosaveDriveEnabled);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'idle' | 'auth' | 'creating' | 'uploading' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [driveUrl, setDriveUrl] = useState('');
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const t = useT();

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
      toast.error(t('saveToDrive.supabaseNotConfigured'));
      return;
    }

    if (!isLoggedInGoogle) {
      handleSupabaseAuth();
      return;
    }

    setAccessToken(googleToken);
    setStep('auth');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupabase, isLoggedInGoogle, googleToken]);

  const handleSupabaseAuth = async () => {
    try {
      setStep('auth');
      await signInWithGoogleDrive();
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : t('saveToDrive.authFailed'));
      toast.error(err instanceof Error ? err.message : t('saveToDrive.authFailed'));
    }
  };

  // Watch for access token to trigger upload
  useEffect(() => {
    if (accessToken && step === 'auth') {
      uploadToDrive(accessToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, step]);

  /**
   * Search for the "omini" parent folder in root. Create if not found.
   */
  const ensureMojoFolder = async (token: string): Promise<string> => {
    const query = encodeURIComponent(
      `name='${MOJO_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=files(id,name)&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // Create omini folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: MOJO_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error((err as any).error?.message || 'Failed to create omini folder');
    }

    const createData = await createRes.json();
    return createData.id;
  };

  const createFolder = async (token: string, folderName: string, parentId: string): Promise<string> => {
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error?.message || 'Failed to create folder');
    }

    const data = await res.json();
    return data.id;
  };

  const searchExistingFolder = async (token: string, folderName: string, parentId: string): Promise<string | null> => {
    const query = encodeURIComponent(
      `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=files(id,name)&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

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

      const query = encodeURIComponent(
        `name='${dirName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      );
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=files(id)&pageSize=1`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

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
      const projectName = project.name || 'Mojo Builder Project';
      const safeName = projectName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Mojo-Builder-Project';

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
        toast.error(t('saveToDrive.noFilesToSave'));
        setStep('error');
        setError(t('saveToDrive.noFilesFound'));
        return;
      }

      setTotalFiles(fileEntries.length);

      // Ensure the "omini" parent folder exists
      const ominiFolderId = await ensureMojoFolder(token);
      toast.info(t('saveToDrive.checkingFolder'));

      // Verifica se pasta do projeto ja existe dentro de omini
      let folderId = await searchExistingFolder(token, safeName, ominiFolderId);

      if (folderId) {
        await deleteFolderContents(token, folderId);
        toast.info(t('saveToDrive.updatingFolder'));
      } else {
        folderId = await createFolder(token, safeName, ominiFolderId);
        toast.info(t('saveToDrive.folderCreated'));
      }

      setStep('uploading');
      setProgress(0);

      // Save chat history alongside files
      const historyMessages = _getChatHistoryMessages();

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

      // Upload chat history as JSON if available
      if (historyMessages.length > 0) {
        try {
          const historyContent = JSON.stringify(
            {
              id: chatId.get() || null,
              exportedAt: new Date().toISOString(),
              messageCount: historyMessages.length,
              messages: historyMessages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            },
            null,
            2,
          );
          await uploadFile(token, folderId, 'chat-history.json', historyContent);
        } catch (err) {
          console.warn('Failed to upload chat history:', err);
        }
      }

      const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      setDriveUrl(folderUrl);

      setStep('done');
      toast.success(`${fileEntries.length} ${t('saveToDrive.filesSaved')}`);
    } catch (err) {
      console.error('Google Drive save failed:', err);
      setStep('error');
      setError(err instanceof Error ? err.message : t('saveToDrive.unexpectedError'));
      toast.error(`${t('saveToDrive.saveFailed')} ${err instanceof Error ? err.message : t('saveToDrive.unknownError')}`);
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
    <div className="flex items-center gap-1.5">
      {/* Autosave toggle */}
      <button
        onClick={() => toggleAutosaveDrive()}
        className={`flex items-center justify-center w-8 h-8 rounded-md border transition-theme ${
          autosaveOn
            ? 'text-green-400 bg-green-500/10 border-green-500/25 hover:bg-green-500/20'
            : 'text-bolt-elements-textTertiary bg-bolt-elements-item-backgroundActive border-bolt-elements-borderColor hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundAccent'
        }`}
        title={autosaveOn ? t('saveToDrive.autoSaveOn') : t('saveToDrive.autoSaveOff')}
      >
        <div className={autosaveOn ? 'i-ph:cloud-arrow-up-fill text-base' : 'i-ph:cloud-arrow-up text-base'} />
      </button>

      {/* Save to Drive button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor transition-theme"
        title={t('saveToDrive.saveToGoogleDrive')}
      >
        <div className="i-ph:google-drive-logo text-base" />
      </button>

      {/* Save dialog */}
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
                  <h2 className="text-base font-bold text-bolt-elements-textPrimary">{t('saveToDrive.title')}</h2>
                  <p className="text-xs text-bolt-elements-textTertiary">
                    {step === 'done' ? t('saveToDrive.projectSavedSuccess') : step === 'error' ? t('saveToDrive.somethingWentWrong') : t('saveToDrive.saveFilesToDrive')}
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
                      {t('saveToDrive.authentication')}
                    </label>

                    {isLoggedInGoogle ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/8 border border-green-500/20">
                        <div className="i-ph:check-circle-fill text-green-400 text-sm shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-green-400 font-medium">{t('saveToDrive.loggedInViaGoogle')}</span>
                          <span className="text-[10px] text-green-400/60 block truncate">{user?.email}</span>
                        </div>
                        <span className="text-[9px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full font-semibold shrink-0">OK</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
                        <div className="i-ph:warning-circle text-amber-400 text-sm shrink-0" />
                        <span className="text-xs text-amber-400">
                          {user
                            ? t('saveToDrive.loginNotViaGoogle')
                            : t('saveToDrive.loginWithGoogle')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info box */}
                  <div className="p-4 rounded-xl bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="i-ph:folder-open text-amber-400 text-lg mt-0.5 shrink-0" />
                      <div className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                        {t('saveToDrive.folderInfo')}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="i-ph:chat-circle-text text-purple-400 text-lg mt-0.5 shrink-0" />
                      <div className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                        {t('saveToDrive.chatHistoryInfo')}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="i-ph:shield-check text-green-400 text-lg mt-0.5 shrink-0" />
                      <div className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                        {t('saveToDrive.securityInfo')}
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
                        {t('saveToDrive.saveToGoogleDrive')}
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        {t('saveToDrive.signInWithGoogleAndSave')}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* === AUTH: Waiting === */}
              {step === 'auth' && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="i-svg-spinners:90-ring-with-bg text-2xl text-blue-400" />
                  <p className="text-sm text-bolt-elements-textSecondary">{t('saveToDrive.authenticatingWithGoogle')}</p>
                  <p className="text-xs text-bolt-elements-textTertiary">{t('saveToDrive.completeLoginInWindow')}</p>
                </div>
              )}

              {/* === CREATING FOLDER === */}
              {step === 'creating' && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="i-svg-spinners:90-ring-with-bg text-2xl text-blue-400" />
                  <p className="text-sm text-bolt-elements-textSecondary">{t('saveToDrive.preparingProject')}</p>
                  <p className="text-xs text-bolt-elements-textTertiary">{t('saveToDrive.creatingFolderInMojo')}</p>
                </div>
              )}

              {/* === UPLOADING: Progress === */}
              {step === 'uploading' && (
                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-bolt-elements-textPrimary">{t('saveToDrive.uploadingFiles')}</p>
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
                    <span>{t('saveToDrive.savingFilesToDrive')}</span>
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
                      <p className="text-sm font-semibold text-green-400">{t('saveToDrive.projectSaved')}</p>
                      <p className="text-xs text-bolt-elements-textTertiary mt-1">{totalFiles} {t('saveToDrive.filesUploadedSuccess')}</p>
                      <p className="text-xs text-bolt-elements-textTertiary mt-0.5">Folder: mojo/{getActiveProject().name || 'Mojo Builder Project'}</p>
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
                      {t('saveToDrive.openInGoogleDrive')}
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
                    {t('saveToDrive.saveAgain')}
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
                      <p className="text-sm font-semibold text-red-400">{t('saveToDrive.saveFailed')}</p>
                      <p className="text-xs text-bolt-elements-textTertiary mt-1 break-words">{error}</p>
                    </div>
                  </div>

                  {error.includes('access') || error.includes('token') || error.includes('scope') ? (
                    <div className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                      <p className="text-xs text-amber-400">
                        {t('saveToDrive.tokenPermissionError')}
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
                    {t('common.retry')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Global ref for chat messages — written by Chat.client.tsx, read by SaveToDrive
export const chatMessagesRef: { current: { role: string; content: string }[] } = { current: [] };

// Helper to get current chat messages
function _getChatHistoryMessages(): { role: string; content: string }[] {
  return chatMessagesRef.current;
}

// Exported autosave function - can be called from anywhere (respects the autosave toggle)
let autosaveInProgress = false;

export async function autosaveToDrive(): Promise<boolean> {
  if (autosaveInProgress) return false;
  if (!supabaseEnabled) return false;

  // Respect the autosave toggle
  if (!autosaveDriveEnabled.get()) return false;

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
        dirent?.type === 'file' && !dirent.isBinary && !path.includes('node_modules') && !path.includes('.git'),
    );

    if (fileEntries.length === 0) {
      autosaveInProgress = false;
      return false;
    }

    const project = getProject();
    const projectName = (project.name || 'Mojo Builder Project').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Mojo-Builder-Project';

    // Ensure the "omini" parent folder exists
    const ominiQuery = encodeURIComponent(
      `name='${MOJO_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
    );
    const ominiSearchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${ominiQuery}&fields=files(id)&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    let ominiFolderId: string;
    if (ominiSearchRes.ok) {
      const ominiData = await ominiSearchRes.json();
      if (ominiData.files?.length > 0) {
        ominiFolderId = ominiData.files[0].id;
      } else {
        const ominiCreateRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: MOJO_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
        });
        const ominiCreateData = await ominiCreateRes.json();
        ominiFolderId = ominiCreateData.id;
      }
    } else {
      autosaveInProgress = false;
      return false;
    }

    // Search/create project folder inside omini
    const query = encodeURIComponent(
      `name='${projectName}' and mimeType='application/vnd.google-apps.folder' and '${ominiFolderId}' in parents and trashed=false`,
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=files(id)&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    let folderId: string;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files?.length > 0) {
        folderId = searchData.files[0].id;
      } else {
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName, mimeType: 'application/vnd.google-apps.folder', parents: [ominiFolderId] }),
        });
        const createData = await createRes.json();
        folderId = createData.id;
      }
    } else {
      autosaveInProgress = false;
      return false;
    }

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
      '.py': 'text/x-python',
      '.env': 'text/plain',
      '.txt': 'text/plain',
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

    // Also save chat history in autosave
    const historyMessages = _getChatHistoryMessages();
    if (historyMessages.length > 0) {
      try {
        const { chatId: chatIdStore } = await import('~/lib/persistence/useChatHistory');
        const historyContent = JSON.stringify(
          {
            id: chatIdStore.get() || null,
            exportedAt: new Date().toISOString(),
            messageCount: historyMessages.length,
            messages: historyMessages.map((m) => ({ role: m.role, content: m.content })),
          },
          null,
          2,
        );
        const chatBoundary = '-------auto-chat' + Date.now();
        const chatDelimiter = `\r\n--${chatBoundary}\r\n`;
        const chatCloseDelimiter = `\r\n--${chatBoundary}--`;
        const chatMetadata = { name: 'chat-history.json', mimeType: 'application/json', parents: [folderId] };
        const chatBase64 = btoa(unescape(encodeURIComponent(historyContent)));
        const chatMultipartBody =
          `${chatDelimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(chatMetadata)}${chatDelimiter}Content-Type: application/json\r\nContent-Transfer-Encoding: base64\r\n\r\n${chatBase64}${chatCloseDelimiter}`;

        await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${chatBoundary}` },
          body: chatMultipartBody,
        }).catch(() => {});
      } catch {
        // Silently ignore chat history autosave failures
      }
    }

    autosaveInProgress = false;
    return true;
  } catch {
    autosaveInProgress = false;
    return false;
  }
}

import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { getActiveProject, projectsStore, activeProjectIdStore, updateActiveProjectSettings } from '~/lib/stores/project';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

declare global {
  interface Window {
    google: any;
    googleAccountsId: any;
  }
}

interface TokenResponse {
  access_token: string;
  error?: string;
}

export function SaveToDrive() {
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[activeId];
  const settings = project?.settings;

  const clientId = settings?.googleDrive?.clientId || '';

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'idle' | 'auth' | 'creating' | 'uploading' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [driveUrl, setDriveUrl] = useState('');
  const [error, setError] = useState('');
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [localClientId, setLocalClientId] = useState('');
  const [showClientIdInput, setShowClientIdInput] = useState(false);

  // Sync localClientId with the stored clientId
  useEffect(() => {
    if (open) {
      setLocalClientId(clientId);
      setShowClientIdInput(!clientId);
    }
  }, [open, clientId]);

  // Load Google Identity Services script
  useEffect(() => {
    if (document.getElementById('gis-script')) {
      if (window.google?.accounts) {
        setGisLoaded(true);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'gis-script';
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setGisLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load Google Identity Services');
    };
    document.head.appendChild(script);
  }, []);

  // Initialize token client once GIS is loaded and clientId is available
  useEffect(() => {
    if (!gisLoaded || !window.google?.accounts?.oauth2) return;

    const effectiveClientId = localClientId.trim();

    if (!effectiveClientId) {
      setTokenClient(null);
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: effectiveClientId,
      scope: SCOPES,
      callback: (response: TokenResponse) => {
        if (response.error) {
          toast.error(`Authentication error: ${response.error}`);
          setStep('error');
          setError(response.error);
          return;
        }
        setAccessToken(response.access_token);
      },
    });

    setTokenClient(client);
  }, [gisLoaded, localClientId]);

  const requestAuth = useCallback(() => {
    if (!localClientId.trim()) {
      toast.error('Please enter your Google OAuth Client ID first.');
      return;
    }
    if (!tokenClient) {
      toast.error('Google Identity Services is still loading. Try again in a moment.');
      return;
    }

    // Save the Client ID to settings before authenticating
    if (localClientId.trim() !== clientId) {
      updateActiveProjectSettings({ googleDrive: { clientId: localClientId.trim() } });
    }

    setStep('auth');
    tokenClient.requestAccessToken();
  }, [tokenClient, localClientId, clientId]);

  // Watch for access token changes to trigger upload
  useEffect(() => {
    if (accessToken && step === 'auth') {
      uploadToDrive(accessToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

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

    // If the file path has subdirectories, create them as folders in Drive
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

      // Save any unsaved files first
      await workbenchStore.saveAllFiles();

      // Get all files from the workbench
      const files = workbenchStore.files.get();
      const fileEntries = Object.entries(files).filter(
        ([path, dirent]) =>
          dirent?.type === 'file' &&
          !dirent.isBinary &&
          !path.includes('node_modules') &&
          !path.includes('.git'),
      );

      if (fileEntries.length === 0) {
        toast.error('No files to save. Create some files first!');
        setStep('error');
        setError('No files found in the project.');
        return;
      }

      setTotalFiles(fileEntries.length);

      // Check if folder already exists (to update instead of duplicate)
      let folderId = await searchExistingFolder(token, safeName);

      if (folderId) {
        await deleteFolderContents(token, folderId);
        toast.info('Updating existing project folder...');
      } else {
        folderId = await createFolder(token, safeName);
        toast.info('Created project folder in Google Drive');
      }

      setStep('uploading');
      setProgress(0);

      // Upload each file sequentially
      for (let i = 0; i < fileEntries.length; i++) {
        const [path, dirent] = fileEntries[i];
        const content = (dirent as any).content || '';
        const cleanPath = path.replace(/^\/+/, '');

        try {
          await uploadFile(token, folderId, cleanPath, content);
        } catch (err) {
          console.warn(`Skipped file ${cleanPath}:`, err);
        }

        setProgress(Math.round(((i + 1) / fileEntries.length) * 100));
      }

      const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      setDriveUrl(folderUrl);

      setStep('done');
      toast.success(`${fileEntries.length} files saved to Google Drive!`);
    } catch (err) {
      console.error('Google Drive save failed:', err);
      setStep('error');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      toast.error(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
                    {step === 'done' ? 'Project saved successfully!'
                      : step === 'error' ? 'Something went wrong'
                      : 'Save your project files to Google Drive'}
                  </p>
                </div>
              </div>
              <button onClick={resetAndClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all">
                <div className="i-ph:x text-lg" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* === IDLE: Show info + Client ID config + Sign In === */}
              {step === 'idle' && (
                <div className="space-y-4">
                  {/* Google Client ID input */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider">
                        Google OAuth Client ID
                      </label>
                      {clientId && (
                        <button
                          onClick={() => setShowClientIdInput(!showClientIdInput)}
                          className="text-[11px] text-blue-400 hover:underline"
                        >
                          {showClientIdInput ? 'Hide' : 'Change'}
                        </button>
                      )}
                    </div>

                    {!showClientIdInput && clientId ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/8 border border-green-500/20">
                        <div className="i-ph:check-circle-fill text-green-400 text-sm shrink-0" />
                        <span className="text-xs text-green-400 font-mono truncate flex-1">
                          {clientId.slice(0, 20)}...{clientId.slice(-8)}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={localClientId}
                          onChange={(e) => setLocalClientId(e.target.value)}
                          placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                          className="w-full px-3 py-2.5 rounded-lg text-xs font-mono bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                        />
                        <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15">
                          <p className="text-[11px] text-bolt-elements-textTertiary leading-relaxed">
                            <span className="text-blue-400 font-semibold">How to get your Client ID:</span> Go to{' '}
                            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                              Google Cloud Console
                            </a>
                            {' '}→ Create a new project (or select existing) → Enable Google Drive API → Create OAuth 2.0 Client ID (Web application) → Add your domain to Authorized JavaScript Origins → Copy the Client ID.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info box */}
                  <div className="p-4 rounded-xl bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="i-ph:folder-open text-amber-400 text-lg mt-0.5 shrink-0" />
                      <div className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                        A folder named after your project will be created (or updated if it already exists). Each file is uploaded individually with the directory structure preserved.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="i-ph:shield-check text-green-400 text-lg mt-0.5 shrink-0" />
                      <div className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                        Uses the Google Drive API with minimal scope (<code className="text-xs bg-bolt-elements-background-depth-2 px-1 py-0.5 rounded">drive.file</code>). Only accesses files created by this app.
                      </div>
                    </div>
                  </div>

                  {/* Sign In button */}
                  <button
                    onClick={requestAuth}
                    disabled={!gisLoaded || !localClientId.trim()}
                    className="w-full py-3 px-4 bg-blue-500/12 text-blue-400 rounded-xl text-sm font-semibold border border-blue-500/20 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {!gisLoaded ? (
                      <>
                        <div className="i-svg-spinners:90-ring-with-bg text-base" />
                        Loading Google Sign-In...
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

              {/* === AUTH: Waiting for Google popup === */}
              {step === 'auth' && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="i-svg-spinners:90-ring-with-bg text-2xl text-blue-400" />
                  <p className="text-sm text-bolt-elements-textSecondary">Waiting for Google authentication...</p>
                  <p className="text-xs text-bolt-elements-textTertiary">Complete the sign-in in the pop-up window</p>
                </div>
              )}

              {/* === CREATING FOLDER === */}
              {step === 'creating' && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="i-svg-spinners:90-ring-with-bg text-2xl text-blue-400" />
                  <p className="text-sm text-bolt-elements-textSecondary">Preparing your project...</p>
                  <p className="text-xs text-bolt-elements-textTertiary">Creating folder in Google Drive</p>
                </div>
              )}

              {/* === UPLOADING: Progress bar === */}
              {step === 'uploading' && (
                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-bolt-elements-textPrimary">Uploading files...</p>
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
                    <span>Saving files to Google Drive...</span>
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
                      <p className="text-sm font-semibold text-green-400">Project saved!</p>
                      <p className="text-xs text-bolt-elements-textTertiary mt-1">
                        {totalFiles} files uploaded successfully
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
                      Open in Google Drive
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
                    Save again
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
                      <p className="text-sm font-semibold text-red-400">Save failed</p>
                      <p className="text-xs text-bolt-elements-textTertiary mt-1 break-words">{error}</p>
                    </div>
                  </div>

                  {error.includes('Client ID') && (
                    <div className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                      <p className="text-xs text-amber-400">
                        Make sure your OAuth Client ID is correct and your domain is added to Authorized JavaScript Origins in Google Cloud Console.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setStep('idle');
                      setError('');
                      setAccessToken('');
                    }}
                    className="w-full py-3 px-4 bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary rounded-xl text-sm font-semibold border border-bolt-elements-borderColor hover:bg-bolt-elements-item-backgroundAccent transition-all flex items-center justify-center gap-2"
                  >
                    <div className="i-ph:arrow-counter-clockwise text-base" />
                    Try again
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

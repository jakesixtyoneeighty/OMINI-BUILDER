import { useState, useEffect, useRef, useCallback } from 'react';
import { WebContainer } from '@webcontainer/api';
import { useT } from '~/lib/i18n/useT';

interface DeployData {
  deploy: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
  };
  files: { path: string; content: string }[];
}

type ViewerState = 'loading' | 'booting' | 'installing' | 'running' | 'error';

export function DeployViewer({ deployId }: { deployId: string }) {
  const t = useT();
  const [state, setState] = useState<ViewerState>('loading');
  const [deployData, setDeployData] = useState<DeployData | null>(null);
  const [error, setError] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wcRef = useRef<WebContainer | null>(null);

  // Fetch deploy data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/deploy-view?id=${deployId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as any).error || t('deployViewer.failedToLoadDeploy'));
        }
        const data: DeployData = await res.json();
        setDeployData(data);
        setState('booting');
      } catch (err) {
        setError(err instanceof Error ? err.message : t('deployViewer.unknownError'));
        setState('error');
      }
    })();
  }, [deployId]);

  // Boot WebContainer and run the project
  useEffect(() => {
    if (!deployData || state !== 'booting') return;

    let cancelled = false;

    (async () => {
      try {
        // Boot WebContainer
        const wc = await WebContainer.boot({ workdirName: 'project' });
        if (cancelled) return;
        wcRef.current = wc;

        // Write files to WebContainer
        for (const file of deployData.files) {
          const path = file.path.startsWith('/') ? file.path : `/${file.path}`;

          // Create directories if needed
          const dirParts = path.split('/').slice(1, -1);
          let currentDir = '';
          for (const part of dirParts) {
            currentDir += '/' + part;
            try {
              await wc.fs.mkdir(currentDir);
            } catch {
              // directory might already exist
            }
          }

          await wc.fs.writeFile(path, file.content);
        }

        // Listen for server-ready event
        wc.on('server-ready', (_port, url) => {
          if (!cancelled) {
            setPreviewUrl(url);
            setState('running');
          }
        });

        // Detect project type and run accordingly
        const hasPackageJson = deployData.files.some(f => f.path.endsWith('package.json') || f.path === '/package.json');
        const packageJsonFile = deployData.files.find(f => f.path.endsWith('package.json') || f.path === '/package.json');

        if (hasPackageJson && packageJsonFile) {
          try {
            const pkg = JSON.parse(packageJsonFile.content);
            const hasDevDeps = pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0;
            const hasDeps = pkg.dependencies && Object.keys(pkg.dependencies).length > 0;

            if (hasDevDeps || hasDeps) {
              setState('installing');

              // Install dependencies
              const installProcess = await wc.spawn('npm', ['install']);
              const installExitCode = await installProcess.exit;

              if (installExitCode !== 0) {
                // Try with --legacy-peer-deps
                const fallbackProcess = await wc.spawn('npm', ['install', '--legacy-peer-deps']);
                const fallbackExitCode = await fallbackProcess.exit;

                if (fallbackExitCode !== 0) {
                  console.warn('npm install failed, trying to run anyway...');
                }
              }
            }

            if (cancelled) return;

            // Run the start/dev script
            const startScript = pkg.scripts?.dev || pkg.scripts?.start;
            if (startScript) {
              const isDev = !!pkg.scripts?.dev;
              const runProcess = await wc.spawn('npm', ['run', isDev ? 'dev' : 'start']);

              runProcess.output.pipeTo(new WritableStream({
                write(data) {
                  console.log('[wc]', data);
                },
              }));
            } else {
              // No start script, try npx vite or node index.js
              if (pkg.devDependencies?.vite || pkg.dependencies?.vite) {
                const runProcess = await wc.spawn('npx', ['vite', '--host', '0.0.0.0']);
                runProcess.output.pipeTo(new WritableStream({
                  write(data) { console.log('[wc]', data); },
                }));
              } else {
                const runProcess = await wc.spawn('node', ['index.js']);
                runProcess.output.pipeTo(new WritableStream({
                  write(data) { console.log('[wc]', data); },
                }));
              }
            }
          } catch (err) {
            console.error('Failed to run Node.js project:', err);
            setError(t('deployViewer.failedToStartProject'));
            setState('error');
          }
        } else {
          // Static HTML project — serve it directly via a simple server
          const htmlFile = deployData.files.find(f =>
            f.path.endsWith('index.html') || f.path === '/index.html'
          );

          if (htmlFile) {
            // Create a simple server for static files
            const serverCode = `
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let filePath = '.' + (req.url === '/' ? '/index.html' : req.url);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
`;
            await wc.fs.writeFile('/server.js', serverCode);

            const runProcess = await wc.spawn('node', ['server.js']);
            runProcess.output.pipeTo(new WritableStream({
              write(data) { console.log('[wc]', data); },
            }));
          } else {
            setError(t('deployViewer.noIndexOrPackageJson'));
            setState('error');
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('WebContainer boot failed:', err);
          setError(err instanceof Error ? err.message : t('deployViewer.failedToStartWebContainer'));
          setState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deployData, state]);

  const refresh = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  const openInNewTab = useCallback(() => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  }, [previewUrl]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0">
        {/* Logo + Name */}
        <div className="flex items-center gap-2 shrink-0">
          <img src="/omni-builder-logo.svg" alt="Omni" className="h-5 w-5" />
          <span className="text-xs font-semibold text-gray-300">
            {deployData?.deploy?.name || t('common.loading')}
          </span>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium">
          {state === 'loading' && (
            <>
              <div className="i-svg-spinners:90-ring-with-bg text-xs text-blue-400" />
              <span className="text-blue-400">{t('deployViewer.loadingFiles')}</span>
            </>
          )}
          {state === 'booting' && (
            <>
              <div className="i-svg-spinners:90-ring-with-bg text-xs text-amber-400" />
              <span className="text-amber-400">{t('deployViewer.startingContainer')}</span>
            </>
          )}
          {state === 'installing' && (
            <>
              <div className="i-svg-spinners:90-ring-with-bg text-xs text-orange-400" />
              <span className="text-orange-400">{t('deployViewer.installingDependencies')}</span>
            </>
          )}
          {state === 'running' && (
            <>
              <div className="i-ph:circle-fill text-[8px] text-emerald-400" />
              <span className="text-emerald-400">{t('deployViewer.live')}</span>
            </>
          )}
          {state === 'error' && (
            <>
              <div className="i-ph:circle-fill text-[8px] text-red-400" />
              <span className="text-red-400">{t('common.error')}</span>
            </>
          )}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        {state === 'running' && (
          <>
            <button
              onClick={refresh}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
              title={t('workbench.refresh')}
            >
              <div className="i-ph:arrow-clockwise text-sm" />
            </button>
            <button
              onClick={openInNewTab}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
              title={t('workbench.newTab')}
            >
              <div className="i-ph:arrow-square-out text-sm" />
            </button>
          </>
        )}

        {/* Powered by Omni Builder */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-400 text-[10px] font-medium shrink-0">
          <div className="i-ph:cube-duotone text-xs" />
          {t('deployViewer.omniBuilder')}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
        {/* Loading states */}
        {(state === 'loading' || state === 'booting' || state === 'installing') && (
          <div className="flex items-center justify-center h-full w-full">
            <div className="text-center max-w-sm">
              <div className="mb-6">
                {state === 'loading' && (
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                    <div className="i-ph:download-simple-duotone text-3xl text-blue-400" />
                  </div>
                )}
                {state === 'booting' && (
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <div className="i-ph:cube-duotone text-3xl text-amber-400 animate-pulse" />
                  </div>
                )}
                {state === 'installing' && (
                  <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                    <div className="i-ph:package-duotone text-3xl text-orange-400 animate-pulse" />
                  </div>
                )}
              </div>
              <p className="text-sm font-medium text-gray-300 mb-1">
                {state === 'loading' && t('deployViewer.loadingProjectFiles')}
                {state === 'booting' && t('deployViewer.startingWebContainer')}
                {state === 'installing' && t('deployViewer.installingDependencies')}
              </p>
              <p className="text-xs text-gray-500">
                {state === 'loading' && t('deployViewer.fetchingProject')}
                {state === 'booting' && t('deployViewer.bootingRuntime')}
                {state === 'installing' && t('deployViewer.mayTakeAMoment')}
              </p>
              <div className="mt-4 w-48 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full animate-progress" />
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="flex items-center justify-center h-full w-full">
            <div className="text-center max-w-md px-6">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <div className="i-ph:warning-circle-duotone text-3xl text-red-400" />
              </div>
              <p className="text-sm font-medium text-gray-300 mb-2">{t('deployViewer.failedToLoadProject')}</p>
              <p className="text-xs text-gray-500 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all"
              >
                <div className="i-ph:arrow-clockwise text-sm" />
                {t('deployViewer.tryAgain')}
              </button>
            </div>
          </div>
        )}

        {/* Running state — iframe preview */}
        {state === 'running' && previewUrl && (
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="absolute inset-0 w-full h-full border-0 bg-bolt-elements-bg-depth-1"
            title={t('deployViewer.deployedProjectPreview')}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            allow="cross-origin-isolated"
          />
        )}
      </div>
    </div>
  );
}

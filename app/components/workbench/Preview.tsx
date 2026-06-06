import { useStore } from '@nanostores/react';
import { memo, useRef, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { AnnotationMode } from './AnnotationMode';
import {
  SandpackProvider,
  SandpackPreview as SPPreview,
  getSandpackCssText,
} from '@codesandbox/sandpack-react';
import { workbenchStore } from '~/lib/stores/workbench';
import { errorStore } from '~/lib/stores/errors';
import { PortDropdown } from './PortDropdown';
import { projectsStore, activeProjectIdStore } from '~/lib/stores/project';
import { SandpackPreview, detectProjectType, type ProjectType } from './SandpackPreview';
import { ReactLivePreview } from './ReactLivePreview';
import { PlayCodePreview } from './PlayCodePreview';
import { PistonPreview } from './PistonPreview';
import type { PreviewMode } from '~/lib/stores/project';
import type { FileMap, File as WFile } from '~/lib/stores/files';
import { AppInspector } from './AppInspector.client';
import { useT } from '~/lib/i18n/useT';

/**
 * Wrapper that catches errors from preview iframes and reports them.
 */
function PreviewErrorCatcher({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.type === 'preview-error') {
        const { message, source } = customEvent.detail;
        errorStore.addError({
          type: 'runtime',
          source: source || t('workbench.preview'),
          message: message || t('preview.previewError'),
        });
      }
    };

    el.addEventListener('preview-error', handler);
    return () => el.removeEventListener('preview-error', handler);
  }, []);

  return <div ref={ref}>{children}</div>;
}

function getPreviewOptions(t: (key: string) => string): { mode: PreviewMode; label: string; icon: string; desc: string }[] {
  return [
    { mode: 'webcontainer', label: t('appSettings.webcontainer'), icon: 'i-ph:cube-duotone', desc: t('preview.webcontainerShortDesc') },
    { mode: 'sandpack', label: t('appSettings.sandpack'), icon: 'i-ph:browser-duotone', desc: t('preview.sandpackShortDesc') },
    { mode: 'iframe', label: t('appSettings.iframe'), icon: 'i-ph:code-duotone', desc: t('preview.iframeShortDesc') },
    { mode: 'reactlive', label: t('appSettings.reactlive'), icon: 'i-ph:atom-duotone', desc: t('preview.reactliveShortDesc') },
    { mode: 'playcode', label: t('appSettings.playcode'), icon: 'i-ph:code-block-duotone', desc: t('preview.playcodeShortDesc') },
    { mode: 'piston', label: t('appSettings.piston'), icon: 'i-ph:rocket-duotone', desc: t('preview.pistonShortDesc') },
    { mode: 'newtab', label: t('appSettings.newtab'), icon: 'i-ph:arrow-square-out-duotone', desc: t('preview.newtabShortDesc') },
  ];
}

const PREVIEW_OPTIONS: { mode: PreviewMode; label: string; icon: string; desc: string }[] = [
  { mode: 'webcontainer', label: 'WebContainer', icon: 'i-ph:cube-duotone', desc: 'Full preview with server, terminal, and hot reload' },
  { mode: 'sandpack', label: 'Sandpack', icon: 'i-ph:browser-duotone', desc: 'Fast in-browser preview with React, Vue, HTML support' },
  { mode: 'iframe', label: 'Iframe SrcDoc', icon: 'i-ph:code-duotone', desc: 'Lightweight iframe preview with React/JSX support' },
  { mode: 'reactlive', label: 'React Live', icon: 'i-ph:atom-duotone', desc: 'Live React editing with instant preview powered by react-live' },
  { mode: 'playcode', label: 'PlayCode', icon: 'i-ph:code-block-duotone', desc: 'CodeSandbox API embed for full build and preview' },
  { mode: 'piston', label: 'Piston', icon: 'i-ph:rocket-duotone', desc: 'Run Python, C++, Java, Go, Rust and 25+ languages via Piston API' },
  { mode: 'newtab', label: 'New Tab', icon: 'i-ph:arrow-square-out-duotone', desc: 'Open preview in a new browser tab' },
];

/**
 * Build static HTML for plain (non-React) iframe rendering
 */
function buildStaticHtml(files: FileMap): string {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);
  if (entries.length === 0) return '';

  const htmlEntry = entries.find(([p]) => p.endsWith('/index.html')) || entries.find(([p]) => p.endsWith('.html'));
  let html = htmlEntry?.[1].content || '';

  const cssFiles = entries.filter(([p]) => p.endsWith('.css') && !p.includes('node_modules'));
  const jsFiles = entries.filter(([p]) => (p.endsWith('.js') || p.endsWith('.mjs')) && !p.includes('node_modules'));

  if (html) {
    if (!html.includes('tailwindcss') && !html.includes('tailwind')) {
      html = html.replace('<head>', '<head>\n  <script src="https://cdn.tailwindcss.com"><\/script>');
    }
    if (cssFiles.length > 0) {
      const cssBlock = cssFiles.map(([, f]) => `<style>\n${f.content}\n</style>`).join('\n');
      html = html.includes('</head>') ? html.replace('</head>', `${cssBlock}\n</head>`) : html + cssBlock;
    }
    if (jsFiles.length > 0) {
      const jsBlock = jsFiles.map(([, f]) => `<script>\n${f.content}\n<\/script>`).join('\n');
      html = html.includes('</body>') ? html.replace('</body>', `${jsBlock}\n</body>`) : html + jsBlock;
    }
  } else {
    const css = cssFiles.map(([, f]) => f.content).join('\n');
    const js = jsFiles.map(([, f]) => f.content).join('\n');
    html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"><\/script><style>${css}</style></head><body><div id="root"></div><script>${js}<\/script></body></html>`;
  }
  return html;
}

/**
 * Map workspace files to Sandpack format
 * For Vite-React templates, files are mapped to root level (/App.tsx, /index.tsx)
 */
function mapToSandpackFiles(files: FileMap, projectType: ProjectType) {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);
  const sandpackFiles: Record<string, { code: string; hidden?: boolean }> = {};
  const isReactLike = projectType === 'react' || projectType === 'react-ts';
  const isTS = projectType === 'react-ts';

  for (const [path, file] of entries) {
    if (path.includes('node_modules') || path.endsWith('.lock')) continue;
    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.ico')) continue;
    let spath = path.startsWith('/') ? path : `/${path}`;

    if (isReactLike) {
      // For Vite-React templates: map files to root level
      if (!spath.startsWith('/public/') && !spath.endsWith('/package.json')) {
        const filename = spath.split('/').pop() || '';
        if (filename === 'main.tsx' || filename === 'main.jsx') {
          spath = isTS ? '/index.tsx' : '/index.jsx';
        } else if (filename === 'index.tsx' || filename === 'index.jsx') {
          spath = isTS ? '/index.tsx' : '/index.jsx';
        } else {
          spath = `/${filename}`;
        }
      }
    }

    sandpackFiles[spath] = { code: file.content };
  }

  // Ensure entry files exist for React/Vite
  if (isReactLike) {
    const indexFile = isTS ? '/index.tsx' : '/index.jsx';
    const scriptSrc = indexFile;

    if (!sandpackFiles[indexFile]) {
      sandpackFiles[indexFile] = {
        code: isTS
          ? `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\n\nconst root = createRoot(document.getElementById("root") as HTMLElement);\nroot.render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);`
          : `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\n\nconst root = createRoot(document.getElementById("root"));\nroot.render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);`,
        hidden: true,
      };
    }

    if (!sandpackFiles['/index.html']) {
      sandpackFiles['/index.html'] = {
        code: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title></head><body><div id="root"></div><script type="module" src="${scriptSrc}"></script></body></html>`,
      };
    }
  }

  if (projectType === 'vanilla') {
    const hasIndexHtml = entries.some(([p]) => p.endsWith('/index.html') || p.endsWith('.html'));
    if (!hasIndexHtml) {
      const cssFiles = entries.filter(([p]) => p.endsWith('.css'));
      const jsFiles = entries.filter(([p]) => p.endsWith('.js') || p.endsWith('.mjs'));
      const inlineCSS = cssFiles.map(([, f]) => f.content).join('\n');
      const inlineJS = jsFiles.map(([, f]) => f.content).join('\n');
      sandpackFiles['/index.html'] = {
        code: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title><style>${inlineCSS}</style></head><body><div id="app"></div><script>${inlineJS}</script></body></html>`,
      };
    }
  }

  return sandpackFiles;
}

function getTemplateConfig(projectType: ProjectType, files: FileMap) {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);

  switch (projectType) {
    case 'react-ts': {
      // Use vite-react-ts template (much faster than CRA, no timeout)
      return { template: 'vite-react-ts' as const, customSetup: { entry: '/index.tsx' } };
    }
    case 'react': {
      // Use vite-react template (much faster than CRA, no timeout)
      return { template: 'vite-react' as const, customSetup: { entry: '/index.jsx' } };
    }
    case 'vue':
      return { template: 'vue' as const, customSetup: { entry: '/src/main.js' } };
    case 'vanilla':
    default:
      return { template: 'vanilla' as const, customSetup: { entry: '/index.js', environment: 'parcel' as const } };
  }
}

const SANDBOX_STYLES = `
.sp-wrapper { width: 100% !important; height: 100% !important; border: none !important; background: var(--bolt-elements-bg-depth-1, #09090b) !important; display: flex !important; flex-direction: column !important; }
.sp-preview { height: 100% !important; flex: 1 !important; min-height: 0 !important; }
.sp-preview-iframe { height: 100% !important; width: 100% !important; }
.sp-layout { border: none !important; height: 100% !important; background: transparent !important; flex: 1 !important; }
.sp-preview-container { height: 100% !important; flex: 1 !important; }
.sp-preview-iframe-container { height: 100% !important; width: 100% !important; }
.sp-stack { height: 100% !important; }
`;

/**
 * IframePreview — supports both React (via Sandpack) and static HTML (via srcdoc)
 */
function IframePreview() {
  const t = useT();
  const files = useStore(workbenchStore.files);
  const projectType = useMemo(() => detectProjectType(files), [files]);
  const isReactProject = projectType === 'react' || projectType === 'react-ts' || projectType === 'vue';

  const staticHtml = useMemo(() => buildStaticHtml(files), [files]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcdoc, setSrcdoc] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSrcdoc(staticHtml), 60);
    return () => clearTimeout(timer);
  }, [staticHtml]);

  const fileCount = Object.values(files).filter((f): f is WFile => f?.type === 'file' && !f.isBinary).length;

  if (fileCount === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full text-bolt-elements-textTertiary">
        <div className="text-center">
          <div className="i-ph:code-duotone text-4xl mb-3 mx-auto" />
          <p className="text-sm">{t('preview.noFilesToPreview')}</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">{t('preview.createOrImport')}</p>
        </div>
      </div>
    );
  }

  // For React/Vue projects, use Sandpack inside the iframe area
  if (isReactProject) {
    const sandpackFiles = useMemo(() => mapToSandpackFiles(files, projectType), [files, projectType]);
    const { template, customSetup } = useMemo(() => getTemplateConfig(projectType, files), [files, projectType]);

    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <style dangerouslySetInnerHTML={{ __html: SANDBOX_STYLES }} />
        <style dangerouslySetInnerHTML={{ __html: getSandpackCssText() }} />
        <SandpackProvider
          key={template + '-' + fileCount}
          template={template}
          files={sandpackFiles}
          customSetup={customSetup}
          theme="dark"
          options={{
            showNavigator: false,
            showTabs: false,
            showLineNumbers: false,
            showInlineErrors: true,
            editorHeight: '100%',
            recompileMode: 'delayed',
            recompileDelay: 500,
            autoReload: true,
          }}
        >
          <SPPreview
            showNavigator={false}
            showRefreshButton={false}
            showOpenInCodeSandbox={false}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </SandpackProvider>
      </div>
    );
  }

  // For plain HTML/CSS/JS, use srcdoc
  return <iframe ref={iframeRef} className="w-full h-full border-0 bg-bolt-elements-bg-depth-1" srcDoc={srcdoc} title="Iframe Preview" sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups" />;
}

/**
 * NewTabPreview — opens preview in a new tab
 */
function NewTabPreview() {
  const t = useT();
  const files = useStore(workbenchStore.files);
  const projectType = useMemo(() => detectProjectType(files), [files]);
  const isReactProject = projectType === 'react' || projectType === 'react-ts' || projectType === 'vue';

  const staticHtml = useMemo(() => buildStaticHtml(files), [files]);
  const [opened, setOpened] = useState(false);

  const fileCount = Object.values(files).filter((f): f is WFile => f?.type === 'file' && !f.isBinary).length;

  const openInNewTab = () => {
    if (isReactProject) {
      // For React projects, open a blob URL with Sandpack's standalone runtime
      // We'll use the static HTML as a fallback with a note
      const blob = new Blob([staticHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else {
      const blob = new Blob([staticHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
    setOpened(true);
  };

  if (fileCount === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full text-bolt-elements-textTertiary">
        <div className="text-center">
          <div className="i-ph:arrow-square-out-duotone text-4xl mb-3 mx-auto" />
          <p className="text-sm">{t('preview.noFilesToPreview')}</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">{t('preview.createOrImportNewTab')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-pink-500/10 flex items-center justify-center mx-auto">
          <div className="i-ph:arrow-square-out-duotone text-3xl text-pink-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-bolt-elements-textPrimary">{t('preview.newTabPreview')}</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">
            {fileCount} {t('preview.files')}
            {isReactProject ? ' (React — best viewed with WebContainer or Sandpack)' : ''}
          </p>
        </div>
        <button
          onClick={openInNewTab}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-pink-500/15 text-pink-400 hover:bg-pink-500/25 transition-all border border-pink-500/20"
        >
          <div className="i-ph:arrow-square-out text-base" />
          {t('preview.openInNewTab')}
        </button>
        {opened && (
          <p className="text-[11px] text-bolt-elements-textTertiary">{t('preview.tabOpened')}</p>
        )}
      </div>
    </div>
  );
}


// Wrapper that adds annotation mode and watermark
function PreviewWithAnnotations({ children, mode }: { children: React.ReactNode; mode: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [annotationActive, setAnnotationActive] = useState(false);

  const supportsAnnotation = ['webcontainer', 'sandpack', 'iframe'].includes(mode);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {children}
      
      {supportsAnnotation && !annotationActive && (
        <button
          className="annotation-fab"
          onClick={() => setAnnotationActive(true)}
          title="Annotate & Send to Chat"
        >
          <div className="i-ph:pencil-simple-line-duotone text-lg" />
        </button>
      )}

      {annotationActive && (
        <AnnotationMode
          containerRef={containerRef as any}
          onExit={() => setAnnotationActive(false)}
        />
      )}

      <div className="preview-watermark">
        <img src="/omini-favicon.png" alt="Mojo Builder" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <span>{t('workbench.builtWithMojo')}</span>
      </div>
    </div>
  );
}

export const Preview = memo(function Preview() {
  const t = useT();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const [inspectorActive, setInspectorActive] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [showNoPreview, setShowNoPreview] = useState(true);
  const [annotationActive, setAnnotationActive] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[activeId];
  const previewMode: PreviewMode = project?.settings?.previewMode || 'webcontainer';

  // Track preview loading state
  useEffect(() => {
    if (activePreview?.baseUrl) {
      setPreviewLoaded(false);
      // Give the iframe time to load, then mark as loaded
      const timer = setTimeout(() => {
        setPreviewLoaded(true);
        // Fade out the no-preview message
        setTimeout(() => setShowNoPreview(false), 300);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setPreviewLoaded(false);
      setShowNoPreview(true);
    }
  }, [activePreview?.baseUrl]);

  const refresh = useCallback(() => {
    if (iframeRef.current) {
      if (previewMode === 'webcontainer') {
        iframeRef.current.src = iframeRef.current.src;
      } else if (previewMode === 'iframe' || previewMode === 'sandpack') {
        const src = iframeRef.current.srcdoc;
        iframeRef.current.srcdoc = '';
        requestAnimationFrame(() => { iframeRef.current!.srcdoc = src; });
      }
    }
  }, [previewMode]);

  const toggleFullscreen = () => {
    const el = document.querySelector('[data-preview-content]');
    if (el) el.requestFullscreen();
  };

  // WebContainer mode (default)
  if (previewMode === 'webcontainer') {
    return (
      <PreviewWithAnnotations mode="webcontainer">
      <div className="w-full h-full flex flex-col bg-bolt-elements-bg-depth-1">
        <div className="flex items-center h-12 px-4 gap-3 shrink-0 bg-bolt-elements-bg-depth-1 border-b border-bolt-elements-borderColor/30">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-contentAccent border border-bolt-elements-item-contentAccent/20 text-xs font-semibold">
            <div className="i-ph:globe-duotone text-base" />
            <span>Preview</span>
          </div>
          
          <div className="h-6 w-[1px] bg-bolt-elements-borderColor/20 mx-1" />
          
          <div className="flex-1 flex items-center bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor/30 rounded-full px-4 py-1.5 text-[11px] text-bolt-elements-textTertiary font-medium truncate">
            <div className="i-ph:link-duotone mr-2 opacity-50" />
            {activePreview?.baseUrl || t('preview.noPreviewAvailable')}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="p-1.5 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all"
              title={t('workbench.refresh')}
            >
              <div className="i-ph:arrow-clockwise text-lg" />
            </button>
            <button
              onClick={() => {
                if (activePreview?.baseUrl) {
                  const previewPageUrl = `/preview?url=${encodeURIComponent(activePreview.baseUrl)}`;
                  window.open(previewPageUrl, '_blank');
                }
              }}
              className="p-1.5 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all"
              title={t('workbench.newTab')}
              disabled={!activePreview?.baseUrl}
            >
              <div className="i-ph:arrow-square-out text-lg" />
            </button>
            <div className="h-6 w-[1px] bg-bolt-elements-borderColor/20 mx-1" />
            <div className="relative">
              <AppInspector
                isActive={inspectorActive}
                onToggle={() => setInspectorActive(!inspectorActive)}
              />
            </div>
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          {activePreview ? (
            <>
              <PreviewErrorCatcher>
                <iframe
                  ref={iframeRef}
                  className="webcontainer-preview-frame"
                  src={activePreview.baseUrl}
                  title={t('workbench.preview')}
                  onLoad={() => {
                    setPreviewLoaded(true);
                    setTimeout(() => setShowNoPreview(false), 300);
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: 'var(--bolt-elements-bg-depth-1)',
                    margin: 0,
                    padding: 0,
                  }}
                />
              </PreviewErrorCatcher>
              {/* Loading overlay - fades out when preview loads */}
              {!previewLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-bolt-elements-background-depth-1 z-10 transition-opacity duration-500">
                  <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      {/* Spinning ring */}
                      <div className="absolute inset-0 rounded-full border-2 border-bolt-elements-borderColor" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 animate-spin" />
                      {/* Center icon */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="i-ph:eye text-xl text-bolt-elements-textTertiary" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-bolt-elements-textSecondary">{t('preview.loadingPreview')}</p>
                    <p className="text-xs text-bolt-elements-textTertiary mt-1">{t('preview.compilingApp')}</p>
                    {/* Animated dots */}
                    <div className="flex items-center justify-center gap-1 mt-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={`flex items-center justify-center h-full text-bolt-elements-textTertiary transition-opacity duration-500 ${showNoPreview ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  {/* Pulsing rings */}
                  <div className="absolute inset-0 rounded-full border border-bolt-elements-borderColor/50 animate-ping opacity-20" style={{ animationDuration: '2s' }} />
                  <div className="absolute inset-2 rounded-full border border-bolt-elements-borderColor/40 animate-ping opacity-15" style={{ animationDuration: '2.5s', animationDelay: '0.3s' }} />
                  <div className="absolute inset-4 rounded-full border border-bolt-elements-borderColor/30 animate-ping opacity-10" style={{ animationDuration: '3s', animationDelay: '0.6s' }} />
                  {/* Center icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor flex items-center justify-center">
                      <div className="i-ph:browser text-2xl text-bolt-elements-textTertiary" />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-medium text-bolt-elements-textSecondary">{t('preview.noPreviewAvailable')}</p>
                <p className="text-xs text-bolt-elements-textTertiary mt-1">{t('preview.startChatToPreview')}</p>
                {/* Subtle floating particles */}
                <div className="flex items-center justify-center gap-2 mt-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500/20 animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500/20 animate-pulse" style={{ animationDelay: '200ms' }} />
                  <div className="w-2 h-2 rounded-full bg-cyan-500/20 animate-pulse" style={{ animationDelay: '400ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500/20 animate-pulse" style={{ animationDelay: '600ms' }} />
                  <div className="w-2 h-2 rounded-full bg-purple-500/20 animate-pulse" style={{ animationDelay: '800ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </PreviewWithAnnotations>
    );
  }

  // Sandpack mode — full Sandpack with React/Vue/HTML support
  if (previewMode === 'sandpack') {
    return (
      <PreviewWithAnnotations mode="sandpack">
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1 sm:gap-2 border-b border-bolt-elements-borderColor shrink-0 overflow-x-auto">
          <IconButton icon="i-ph:arrow-clockwise" onClick={refresh} title={t('workbench.refresh')} />
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title={t('preview.fullscreen')} />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 text-xs font-medium shrink-0">
            <div className="i-ph:browser-duotone text-sm" />
            <span className="hidden sm:inline">{t('appSettings.sandpack')}</span>
          </div>
          <div className="flex-1 hidden sm:block text-xs text-bolt-elements-textTertiary truncate">
            {t('preview.reactVueHtmlPreview')}
          </div>
          {/* Inspector toggle */}
          <div className="relative">
            <AppInspector
              isActive={inspectorActive}
              onToggle={() => setInspectorActive(!inspectorActive)}
            />
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          <SandpackPreview />
        </div>
      </div>
      </PreviewWithAnnotations>
    );
  }

  // Iframe srcdoc mode — uses Sandpack for React, srcdoc for static
  if (previewMode === 'iframe') {
    return (
      <PreviewWithAnnotations mode="iframe">
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1 sm:gap-2 border-b border-bolt-elements-borderColor shrink-0 overflow-x-auto">
          <IconButton icon="i-ph:arrow-clockwise" onClick={refresh} title={t('workbench.refresh')} />
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title={t('preview.fullscreen')} />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-medium shrink-0">
            <div className="i-ph:code-duotone text-sm" />
            <span className="hidden sm:inline">{t('appSettings.iframe')}</span>
          </div>
          <div className="flex-1 hidden sm:block text-xs text-bolt-elements-textTertiary truncate">
            {t('preview.iframeReactSupported')}
          </div>
          {/* Inspector toggle */}
          <div className="relative">
            <AppInspector
              isActive={inspectorActive}
              onToggle={() => setInspectorActive(!inspectorActive)}
            />
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          <IframePreview />
        </div>
      </div>
      </PreviewWithAnnotations>
    );
  }

  // React Live mode
  if (previewMode === 'reactlive') {
    return (
      <PreviewWithAnnotations mode="reactlive">
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1 sm:gap-2 border-b border-bolt-elements-borderColor shrink-0 overflow-x-auto">
          <IconButton icon="i-ph:arrow-clockwise" onClick={refresh} title={t('workbench.refresh')} />
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title={t('preview.fullscreen')} />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 text-xs font-medium shrink-0">
            <div className="i-ph:atom-duotone text-sm" />
            <span className="hidden sm:inline">{t('appSettings.reactlive')}</span>
          </div>
          <div className="flex-1 hidden sm:block text-xs text-bolt-elements-textTertiary truncate">
            {t('preview.liveReactComponentPreview')}
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          <ReactLivePreview />
        </div>
      </div>
      </PreviewWithAnnotations>
    );
  }

  // PlayCode mode
  if (previewMode === 'playcode') {
    return (
      <PreviewWithAnnotations mode="playcode">
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1 sm:gap-2 border-b border-bolt-elements-borderColor shrink-0 overflow-x-auto">
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title={t('preview.fullscreen')} />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-400 text-xs font-medium shrink-0">
            <div className="i-ph:code-block-duotone text-sm" />
            <span className="hidden sm:inline">{t('appSettings.playcode')}</span>
          </div>
          <div className="flex-1 hidden sm:block text-xs text-bolt-elements-textTertiary truncate">
            {t('preview.codeSandboxApiEmbed')}
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          <PlayCodePreview />
        </div>
      </div>
      </PreviewWithAnnotations>
    );
  }

  // Piston mode — code execution engine
  if (previewMode === 'piston') {
    return (
      <PreviewWithAnnotations mode="piston">
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1 sm:gap-2 border-b border-bolt-elements-borderColor shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 text-xs font-medium shrink-0">
            <div className="i-ph:rocket-duotone text-sm" />
            <span className="hidden sm:inline">{t('appSettings.piston')}</span>
          </div>
          <div className="flex-1 hidden sm:block text-xs text-bolt-elements-textTertiary truncate">
            {t('preview.remoteCodeExecution')}
          </div>
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title={t('preview.fullscreen')} />
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          <PistonPreview />
        </div>
      </div>
      </PreviewWithAnnotations>
    );
  }

  // New Tab mode
  if (previewMode === 'newtab') {
    return (
      <PreviewWithAnnotations mode="newtab">
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1 sm:gap-2 border-b border-bolt-elements-borderColor shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-pink-500/10 text-pink-400 text-xs font-medium shrink-0">
            <div className="i-ph:arrow-square-out-duotone text-sm" />
            <span className="hidden sm:inline">{t('appSettings.newtab')}</span>
          </div>
          <div className="flex-1 hidden sm:block text-xs text-bolt-elements-textTertiary truncate">
            {t('preview.opensInNewBrowserTab')}
          </div>
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title={t('preview.fullscreen')} />
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          <NewTabPreview />
        </div>
      </div>
      </PreviewWithAnnotations>
    );
  }

  // Fallback
  return null;
});


export { PREVIEW_OPTIONS, getPreviewOptions };

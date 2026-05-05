import { useStore } from '@nanostores/react';
import { memo, useRef, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { IconButton } from '~/components/ui/IconButton';
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
import type { PreviewMode } from '~/lib/stores/project';
import type { FileMap, File as WFile } from '~/lib/stores/files';

/**
 * Wrapper that catches errors from preview iframes and reports them.
 */
function PreviewErrorCatcher({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.type === 'preview-error') {
        const { message, source } = customEvent.detail;
        errorStore.addError({
          type: 'runtime',
          source: source || 'Preview',
          message: message || 'Erro no preview',
        });
      }
    };

    el.addEventListener('preview-error', handler);
    return () => el.removeEventListener('preview-error', handler);
  }, []);

  return <div ref={ref}>{children}</div>;
}

const PREVIEW_OPTIONS: { mode: PreviewMode; label: string; icon: string; desc: string }[] = [
  { mode: 'webcontainer', label: 'WebContainer', icon: 'i-ph:cube-duotone', desc: 'Full preview with server, terminal, and hot reload' },
  { mode: 'sandpack', label: 'Sandpack', icon: 'i-ph:browser-duotone', desc: 'Fast in-browser preview with React, Vue, HTML support' },
  { mode: 'iframe', label: 'Iframe SrcDoc', icon: 'i-ph:code-duotone', desc: 'Lightweight iframe preview with React/JSX support' },
  { mode: 'reactlive', label: 'React Live', icon: 'i-ph:atom-duotone', desc: 'Live React editing with instant preview powered by react-live' },
  { mode: 'playcode', label: 'PlayCode', icon: 'i-ph:code-block-duotone', desc: 'CodeSandbox API embed for full build and preview' },
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
 */
function mapToSandpackFiles(files: FileMap, projectType: ProjectType) {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);
  const sandpackFiles: Record<string, { code: string; hidden?: boolean }> = {};
  const isReactLike = projectType === 'react' || projectType === 'react-ts';

  for (const [path, file] of entries) {
    if (path.includes('node_modules') || path.endsWith('.lock')) continue;
    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.ico')) continue;
    let spath = path.startsWith('/') ? path : `/${path}`;
    if (isReactLike) {
      if (!spath.startsWith('/src/') && !spath.startsWith('/public/') && !spath.endsWith('/package.json')) {
        const parts = spath.split('/');
        spath = `/src/${parts[parts.length - 1]}`;
      }
    }
    sandpackFiles[spath] = { code: file.content };
  }

  if (isReactLike && !sandpackFiles['/index.html']) {
    sandpackFiles['/index.html'] = {
      code: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
    };
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
    case 'react-ts':
    case 'react': {
      // Use Vite-based react template (faster, no timeout)
      return { template: 'react' as const, customSetup: { entry: '/src/main.tsx' } };
    }
    case 'vue':
      return { template: 'vue' as const, customSetup: { entry: '/src/main.js' } };
    case 'vanilla':
    default:
      return { template: 'vanilla' as const, customSetup: { entry: '/index.js', environment: 'parcel' as const } };
  }
}

const SANDBOX_STYLES = `
.sp-wrapper { width: 100% !important; height: 100% !important; border: none !important; background: white !important; display: flex !important; flex-direction: column !important; }
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
  const files = useStore(workbenchStore.files);
  const projectType = useMemo(() => detectProjectType(files), [files]);
  const isReactProject = projectType === 'react' || projectType === 'react-ts' || projectType === 'vue';

  const staticHtml = useMemo(() => buildStaticHtml(files), [files]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcdoc, setSrcdoc] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSrcdoc(staticHtml), 60);
    return () => clearTimeout(t);
  }, [staticHtml]);

  const fileCount = Object.values(files).filter((f): f is WFile => f?.type === 'file' && !f.isBinary).length;

  if (fileCount === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full text-bolt-elements-textTertiary">
        <div className="text-center">
          <div className="i-ph:code-duotone text-4xl mb-3 mx-auto" />
          <p className="text-sm">No files to preview</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">Create or import files to see a preview</p>
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
  return <iframe ref={iframeRef} className="w-full h-full border-0 bg-white" srcDoc={srcdoc} title="Iframe Preview" sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups" />;
}

/**
 * NewTabPreview — opens preview in a new tab
 */
function NewTabPreview() {
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
          <p className="text-sm">No files to preview</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">Create or import files to open in a new tab</p>
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
          <p className="text-sm font-semibold text-bolt-elements-textPrimary">New Tab Preview</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">
            {fileCount} files
            {isReactProject ? ' (React — best viewed with WebContainer or Sandpack)' : ''}
          </p>
        </div>
        <button
          onClick={openInNewTab}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-pink-500/15 text-pink-400 hover:bg-pink-500/25 transition-all border border-pink-500/20"
        >
          <div className="i-ph:arrow-square-out text-base" />
          Open in New Tab
        </button>
        {opened && (
          <p className="text-[11px] text-bolt-elements-textTertiary">Tab opened! Check your pop-up blocker if nothing happened.</p>
        )}
      </div>
    </div>
  );
}

export const Preview = memo(function Preview() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[activeId];
  const previewMode: PreviewMode = project?.settings?.previewMode || 'webcontainer';

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
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-3 py-1.5 flex items-center gap-2 border-b border-bolt-elements-borderColor shrink-0">
          <IconButton icon="i-ph:arrow-clockwise" onClick={refresh} title="Refresh" />
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title="Fullscreen" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
            <div className="i-ph:cube-duotone text-sm" />
            WebContainer
          </div>
          <div className="flex-1 flex items-center bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-1 text-xs text-bolt-elements-textSecondary truncate">
            {activePreview?.baseUrl || 'No preview available'}
          </div>
          {previews.length > 0 && (
            <PortDropdown
              activePreviewIndex={activePreviewIndex}
              setActivePreviewIndex={setActivePreviewIndex}
              isDropdownOpen={isPortDropdownOpen}
              setIsDropdownOpen={setIsPortDropdownOpen}
              setHasSelectedPreview={() => {}}
              previews={previews}
            />
          )}
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          {activePreview ? (
            <PreviewErrorCatcher>
              <iframe
                ref={iframeRef}
                className="webcontainer-preview-frame"
                src={activePreview.baseUrl}
                title="Preview"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: 'white',
                  margin: 0,
                  padding: 0,
                }}
              />
            </PreviewErrorCatcher>
          ) : (
            <div className="flex items-center justify-center h-full text-bolt-elements-textTertiary">
              <div className="text-center">
                <div className="i-ph:globe-simple text-3xl mb-2 mx-auto" />
                <p className="text-sm">No preview available</p>
                <p className="text-xs text-bolt-elements-textTertiary mt-1">Start a chat to generate a preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Sandpack mode — full Sandpack with React/Vue/HTML support
  if (previewMode === 'sandpack') {
    return (
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-3 py-1.5 flex items-center gap-2 border-b border-bolt-elements-borderColor shrink-0">
          <IconButton icon="i-ph:arrow-clockwise" onClick={refresh} title="Refresh" />
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title="Fullscreen" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 text-xs font-medium">
            <div className="i-ph:browser-duotone text-sm" />
            Sandpack
          </div>
          <div className="flex-1 text-xs text-bolt-elements-textTertiary truncate">
            React, Vue, HTML Preview
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          <SandpackPreview />
        </div>
      </div>
    );
  }

  // Iframe srcdoc mode — uses Sandpack for React, srcdoc for static
  if (previewMode === 'iframe') {
    return (
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-3 py-1.5 flex items-center gap-2 border-b border-bolt-elements-borderColor shrink-0">
          <IconButton icon="i-ph:arrow-clockwise" onClick={refresh} title="Refresh" />
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title="Fullscreen" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-medium">
            <div className="i-ph:code-duotone text-sm" />
            Iframe SrcDoc
          </div>
          <div className="flex-1 text-xs text-bolt-elements-textTertiary truncate">
            Iframe preview (React supported)
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          <IframePreview />
        </div>
      </div>
    );
  }

  // React Live mode
  if (previewMode === 'reactlive') {
    return (
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-3 py-1.5 flex items-center gap-2 border-b border-bolt-elements-borderColor shrink-0">
          <IconButton icon="i-ph:arrow-clockwise" onClick={refresh} title="Refresh" />
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title="Fullscreen" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 text-xs font-medium">
            <div className="i-ph:atom-duotone text-sm" />
            React Live
          </div>
          <div className="flex-1 text-xs text-bolt-elements-textTertiary truncate">
            Live React component preview
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          <ReactLivePreview />
        </div>
      </div>
    );
  }

  // PlayCode mode
  if (previewMode === 'playcode') {
    return (
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-3 py-1.5 flex items-center gap-2 border-b border-bolt-elements-borderColor shrink-0">
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title="Fullscreen" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-400 text-xs font-medium">
            <div className="i-ph:code-block-duotone text-sm" />
            PlayCode
          </div>
          <div className="flex-1 text-xs text-bolt-elements-textTertiary truncate">
            CodeSandbox API embed
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          <PlayCodePreview />
        </div>
      </div>
    );
  }

  // New Tab mode
  if (previewMode === 'newtab') {
    return (
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-3 py-1.5 flex items-center gap-2 border-b border-bolt-elements-borderColor shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-pink-500/10 text-pink-400 text-xs font-medium">
            <div className="i-ph:arrow-square-out-duotone text-sm" />
            New Tab
          </div>
          <div className="flex-1 text-xs text-bolt-elements-textTertiary truncate">
            Preview opens in a new browser tab
          </div>
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title="Fullscreen" />
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content style={{ minHeight: 0 }}>
          <NewTabPreview />
        </div>
      </div>
    );
  }

  // Fallback
  return null;
});

export { PREVIEW_OPTIONS };

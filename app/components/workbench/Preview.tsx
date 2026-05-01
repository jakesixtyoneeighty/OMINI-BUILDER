import { useStore } from '@nanostores/react';
import { memo, useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { PortDropdown } from './PortDropdown';
import { projectsStore, activeProjectIdStore } from '~/lib/stores/project';
import { SandpackPreview } from './SandpackPreview';
import type { PreviewMode } from '~/lib/stores/project';
import type { FileMap, File as WFile } from '~/lib/stores/files';

const PREVIEW_OPTIONS: { mode: PreviewMode; label: string; icon: string; desc: string }[] = [
  { mode: 'webcontainer', label: 'WebContainer', icon: 'i-ph:cube-duotone', desc: 'Full preview with server, terminal, and hot reload' },
  { mode: 'sandpack', label: 'Sandpack', icon: 'i-ph:browser-duotone', desc: 'Fast in-browser HTML/CSS/JS preview' },
  { mode: 'iframe', label: 'Iframe SrcDoc', icon: 'i-ph:code-duotone', desc: 'Lightweight srcdoc iframe, no external services' },
  { mode: 'newtab', label: 'New Tab', icon: 'i-ph:arrow-square-out-duotone', desc: 'Open preview in a new browser tab' },
];

function buildPreviewHtml(files: FileMap): string {
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

function IframePreview() {
  const files = useStore(workbenchStore.files);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcdoc, setSrcdoc] = useState('');

  const html = useMemo(() => buildPreviewHtml(files), [files]);

  useEffect(() => {
    const t = setTimeout(() => setSrcdoc(html), 60);
    return () => clearTimeout(t);
  }, [html]);

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

  return <iframe ref={iframeRef} className="w-full h-full border-0 bg-white" srcDoc={srcdoc} title="Iframe Preview" sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups" />;
}

function NewTabPreview() {
  const files = useStore(workbenchStore.files);
  const [opened, setOpened] = useState(false);

  const html = useMemo(() => buildPreviewHtml(files), [files]);

  const fileCount = Object.values(files).filter((f): f is WFile => f?.type === 'file' && !f.isBinary).length;

  const openInNewTab = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setOpened(true);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
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
            {fileCount} files ready to preview
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
      <div className="w-full h-full flex flex-col absolute inset-0 bg-bolt-elements-background-depth-1">
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
        <div className="flex-1 relative overflow-hidden" data-preview-content>
          {activePreview ? (
            <iframe ref={iframeRef} className="w-full h-full bg-white border-0" src={activePreview.baseUrl} />
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

  // Sandpack mode
  if (previewMode === 'sandpack') {
    return (
      <div className="w-full h-full flex flex-col absolute inset-0 bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-3 py-1.5 flex items-center gap-2 border-b border-bolt-elements-borderColor shrink-0">
          <IconButton icon="i-ph:arrow-clockwise" onClick={refresh} title="Refresh" />
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title="Fullscreen" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 text-xs font-medium">
            <div className="i-ph:browser-duotone text-sm" />
            Sandpack
          </div>
          <div className="flex-1 text-xs text-bolt-elements-textTertiary truncate">
            Inline HTML/CSS/JS Preview
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content>
          <SandpackPreview />
        </div>
      </div>
    );
  }

  // Iframe srcdoc mode
  if (previewMode === 'iframe') {
    return (
      <div className="w-full h-full flex flex-col absolute inset-0 bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-3 py-1.5 flex items-center gap-2 border-b border-bolt-elements-borderColor shrink-0">
          <IconButton icon="i-ph:arrow-clockwise" onClick={refresh} title="Refresh" />
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title="Fullscreen" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-medium">
            <div className="i-ph:code-duotone text-sm" />
            Iframe SrcDoc
          </div>
          <div className="flex-1 text-xs text-bolt-elements-textTertiary truncate">
            Lightweight iframe preview
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content>
          <IframePreview />
        </div>
      </div>
    );
  }

  // New Tab mode
  if (previewMode === 'newtab') {
    return (
      <div className="w-full h-full flex flex-col absolute inset-0 bg-bolt-elements-background-depth-1">
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
        <div className="flex-1 relative overflow-hidden" data-preview-content>
          <NewTabPreview />
        </div>
      </div>
    );
  }

  // Fallback
  return null;
});

export { PREVIEW_OPTIONS };

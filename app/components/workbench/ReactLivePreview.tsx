import { useStore } from '@nanostores/react';
import { memo, useMemo, useState, useEffect } from 'react';
import { LiveProvider, LivePreview as RLivePreview, LiveError } from 'react-live';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap, File as WFile } from '~/lib/stores/files';

/**
 * Extract React component code from workspace files and build
 * a noRender string suitable for react-live's LiveProvider.
 */
function buildReactLiveCode(files: FileMap): { code: string; scope: Record<string, unknown> } {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);

  // Find App component or the main component
  const appFile = entries.find(([p]) =>
    p.endsWith('/App.tsx') || p.endsWith('/App.jsx') ||
    p.endsWith('/app.tsx') || p.endsWith('/app.jsx')
  );

  const indexFile = entries.find(([p]) =>
    p.endsWith('/index.tsx') || p.endsWith('/index.jsx') ||
    p.endsWith('/main.tsx') || p.endsWith('/main.jsx')
  );

  // Collect CSS content for injection
  const cssFiles = entries.filter(([p]) => p.endsWith('.css') && !p.includes('node_modules'));
  const cssContent = cssFiles.map(([, f]) => f.content).join('\n\n');

  // Collect helper/component files (not index, not App, not CSS)
  const componentFiles = entries.filter(([p]) => {
    if (p.includes('node_modules')) return false;
    if (p.endsWith('.css')) return false;
    if (p.endsWith('.html')) return false;
    if (p.endsWith('.json')) return false;
    if (p === appFile?.[0]) return false;
    if (p === indexFile?.[0]) return false;
    if (p.endsWith('.ts') && !p.endsWith('.tsx')) return false;
    return p.endsWith('.tsx') || p.endsWith('.jsx') || p.endsWith('.js') || p.endsWith('.mjs');
  });

  // Build the code: component helpers + App component + render call
  let code = '';

  // Add CSS as a style tag inside the component
  if (cssContent) {
    code += `function _StyleInjector() {\n  if (typeof document !== 'undefined') {\n    const id = 'react-live-styles';\n    let el = document.getElementById(id);\n    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }\n    el.textContent = ${JSON.stringify(cssContent)};\n  }\n  return null;\n}\n\n`;
  }

  // Add Tailwind CDN script injection
  code += `function _TailwindLoader() {\n  if (typeof document !== 'undefined' && !document.getElementById('tailwind-cdn')) {\n    const s = document.createElement('script');\n    s.id = 'tailwind-cdn';\n    s.src = 'https://cdn.tailwindcss.com';\n    document.head.appendChild(s);\n  }\n  return null;\n}\n\n`;

  // Add component files (these are imports that react-live can't handle,
  // so we inline them)
  for (const [path, file] of componentFiles) {
    const content = file.content
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '') // Remove imports
      .replace(/^export\s+default\s+/gm, '') // Remove default export
      .replace(/^export\s+/gm, ''); // Remove named exports
    code += `${content}\n\n`;
  }

  // Add the App component
  if (appFile) {
    const appContent = appFile[1].content
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '') // Remove imports
      .replace(/^export\s+default\s+/gm, ''); // Remove default export
    code += `${appContent}\n\n`;
  }

  // The render expression for react-live
  code += `render(<><_TailwindLoader /><_StyleInjector /><App /></>)`;

  return { code, scope: {} };
}

function buildFallbackHtmlCode(files: FileMap): string {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);
  const htmlFile = entries.find(([p]) => p.endsWith('/index.html') || p.endsWith('.html'));
  const cssFiles = entries.filter(([p]) => p.endsWith('.css') && !p.includes('node_modules'));
  const jsFiles = entries.filter(([p]) => (p.endsWith('.js') || p.endsWith('.mjs')) && !p.includes('node_modules'));

  let html = htmlFile?.[1].content || '';
  const css = cssFiles.map(([, f]) => f.content).join('\n');
  const js = jsFiles.map(([, f]) => f.content).join('\n');

  if (!html) {
    html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"><\/script><style>${css}</style></head><body><div id="root"></div><script>${js}<\/script></body></html>`;
  }
  return html;
}

const LIVE_PREVIEW_STYLES = `
.react-live-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.react-live-preview-area {
  flex: 1;
  overflow: auto;
  padding: 0;
  background: white;
}
.react-live-error {
  background: #1a1a2e;
  color: #f87171;
  padding: 12px 16px;
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  border-top: 1px solid #374151;
  max-height: 150px;
  overflow-y: auto;
}
`;

export const ReactLivePreview = memo(function ReactLivePreview() {
  const files = useStore(workbenchStore.files);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [fallbackSrcdoc, setFallbackSrcdoc] = useState('');
  const [useReactLive, setUseReactLive] = useState(true);

  const { code, scope } = useMemo(() => buildReactLiveCode(files), [files]);
  const fallbackHtml = useMemo(() => buildFallbackHtmlCode(files), [files]);

  const fileCount = useMemo(() => {
    return Object.values(files).filter((f): f is WFile => f?.type === 'file' && !f.isBinary).length;
  }, [files]);

  const hasReactFiles = useMemo(() => {
    return Object.entries(files).some(([p]) => p.endsWith('.tsx') || p.endsWith('.jsx'));
  }, [files]);

  useEffect(() => {
    setUseReactLive(hasReactFiles);
    if (!hasReactFiles) {
      setFallbackSrcdoc(fallbackHtml);
    }
  }, [hasReactFiles, fallbackHtml]);

  if (fileCount === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full text-bolt-elements-textTertiary">
        <div className="text-center">
          <div className="i-ph:atom text-4xl mb-3 mx-auto" />
          <p className="text-sm">No files to preview</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">Create or import files to see a preview</p>
        </div>
      </div>
    );
  }

  // If no React files, use iframe fallback
  if (!useReactLive) {
    return <iframe ref={iframeRef} className="w-full h-full border-0 bg-white" srcDoc={fallbackSrcdoc} title="Preview" sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups" />;
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <style dangerouslySetInnerHTML={{ __html: LIVE_PREVIEW_STYLES }} />
      <div className="react-live-wrapper">
        <LiveProvider code={code} scope={scope} noInline={false} theme={{ plain: {}, styles: [] }}>
          <div className="react-live-preview-area">
            <RLivePreview />
          </div>
          <LiveError className="react-live-error" />
        </LiveProvider>
      </div>
    </div>
  );
});

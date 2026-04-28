// ============================================================
// Omni-Builder — LivePreview Component (Iframe Sandbox)
// ============================================================
'use client';

import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useProjectStore, usePreviewStore } from '@/store';
import {
  RefreshCw,
  ExternalLink,
  Smartphone,
  Monitor,
  Tablet,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

type ViewportMode = 'desktop' | 'tablet' | 'mobile';

const VIEWPORT_SIZES: Record<ViewportMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export default function LivePreview() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const projectFiles = useProjectStore((s) => s.project.files);
  const status = usePreviewStore((s) => s.status);
  const setStatus = usePreviewStore((s) => s.setStatus);
  const setError = usePreviewStore((s) => s.setError);
  const setUrl = usePreviewStore((s) => s.setUrl);
  const lastBuildKey = useRef(0);

  // Bundle the project files into a single HTML document
  const htmlContent = useMemo(() => {
    const indexHtml = projectFiles['index.html'];
    const mainTsx = projectFiles['src/main.tsx'];
    const appTsx = projectFiles['src/App.tsx'];
    const globalCss = projectFiles['src/styles/globals.css'] ?? '';

    if (!indexHtml && !appTsx) return null;

    // If we have a proper index.html, we'll construct a self-contained HTML doc
    const appCode = appTsx?.content ?? '';

    // Extract CSS from Tailwind CDN (simulated preview)
    const tailwindCss = globalCss || '';

    return buildPreviewHtml(indexHtml?.content, appCode, tailwindCss, projectFiles);
  }, [projectFiles]);

  // Rebuild preview when files change
  useEffect(() => {
    if (!htmlContent) {
      setStatus('idle');
      return;
    }

    setStatus('building');

    const timer = setTimeout(() => {
      if (iframeRef.current) {
        try {
          iframeRef.current.srcdoc = htmlContent;
          setStatus('ready');
          setError(null);
          setUrl('preview://local');
        } catch (err: any) {
          setError(err.message);
          setStatus('error');
        }
      }
    }, 500); // debounce

    return () => clearTimeout(timer);
  }, [htmlContent, setStatus, setError, setUrl]);

  const refresh = useCallback(() => {
    lastBuildKey.current += 1;
    if (iframeRef.current && htmlContent) {
      setStatus('building');
      iframeRef.current.srcdoc = '';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.srcdoc = htmlContent;
          setStatus('ready');
        }
      }, 100);
    }
  }, [htmlContent, setStatus]);

  const openInNewTab = useCallback(() => {
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }, [htmlContent]);

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        {/* Viewport toggle */}
        <div className="flex items-center bg-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewport('desktop')}
            className={`p-1.5 rounded-md transition ${
              viewport === 'desktop'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Desktop"
          >
            <Monitor size={14} />
          </button>
          <button
            onClick={() => setViewport('tablet')}
            className={`p-1.5 rounded-md transition ${
              viewport === 'tablet'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Tablet"
          >
            <Tablet size={14} />
          </button>
          <button
            onClick={() => setViewport('mobile')}
            className={`p-1.5 rounded-md transition ${
              viewport === 'mobile'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Mobile"
          >
            <Smartphone size={14} />
          </button>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 ml-2">
          {status === 'building' && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <Loader2 size={12} className="animate-spin" /> Building...
            </span>
          )}
          {status === 'ready' && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Ready
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle size={12} /> Error
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={refresh}
          className="p-1.5 text-zinc-400 hover:text-white transition"
          title="Refresh preview"
        >
          <RefreshCw size={14} />
        </button>
        <button
          onClick={openInNewTab}
          className="p-1.5 text-zinc-400 hover:text-white transition"
          title="Open in new tab"
        >
          <ExternalLink size={14} />
        </button>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 flex items-start justify-center overflow-auto bg-zinc-950 p-2">
        <div
          className="h-full bg-white rounded-lg overflow-hidden shadow-2xl transition-all duration-300"
          style={{
            width: VIEWPORT_SIZES[viewport],
            maxWidth: '100%',
          }}
        >
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
            title="Live Preview"
          />
        </div>
      </div>
    </div>
  );
}

// ---- Preview HTML Builder ----

function buildPreviewHtml(
  indexHtml: string | undefined,
  appCode: string,
  globalCss: string,
  allFiles: Record<string, { content: string; language: string }>
): string {
  // Gather all component files
  const componentFiles: string[] = [];
  for (const [path, file] of Object.entries(allFiles)) {
    if (
      path.startsWith('src/components/') &&
      (path.endsWith('.tsx') || path.endsWith('.jsx'))
    ) {
      componentFiles.push(file.content);
    }
  }

  // Gather all hook files
  const hookFiles: string[] = [];
  for (const [path, file] of Object.entries(allFiles)) {
    if (
      path.startsWith('src/hooks/') &&
      (path.endsWith('.ts') || path.endsWith('.tsx'))
    ) {
      hookFiles.push(file.content);
    }
  }

  // Gather all service/utility files
  const libFiles: string[] = [];
  for (const [path, file] of Object.entries(allFiles)) {
    if (
      path.startsWith('src/lib/') &&
      (path.endsWith('.ts') || path.endsWith('.tsx'))
    ) {
      libFiles.push(file.content);
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {},
      },
    }
  </script>
  <style>
    ${globalCss}
    * { box-sizing: border-box; }
  </style>
  <script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  ${allFiles['src/styles/globals.css'] ? '' : `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  </style>
  `}
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer, useContext, createContext } = React;

    // ---- Injected Hook Files ----
    ${hookFiles.join('\n\n')}

    // ---- Injected Lib Files ----
    ${libFiles.join('\n\n')}

    // ---- Injected Component Files ----
    ${componentFiles.join('\n\n')}

    // ---- App Component ----
    ${appCode}

    // ---- Render ----
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  <\/script>
</body>
</html>`;
}

import { useStore } from '@nanostores/react';
import React, { createElement as h, memo, useMemo, useState, useEffect, useRef, Fragment } from 'react';
import { LiveProvider, LivePreview as RLivePreview, LiveError } from 'react-live';
import { transform } from 'sucrase';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap, File as WFile } from '~/lib/stores/files';

/**
 * Transpile TypeScript/JSX code to plain JavaScript using Sucrase.
 * Uses the automatic JSX runtime to avoid _jsxFileName duplicate declarations.
 */
function transpileCode(code: string, filePath: string): string {
  try {
    const isTSX = filePath.endsWith('.tsx');
    const isJSX = filePath.endsWith('.jsx');
    const isTS = filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');

    if (!isTSX && !isJSX && !isTS) return code;

    const result = transform(code, {
      transforms: isTSX || isTS ? ['typescript', 'jsx'] : ['jsx'],
      jsxRuntime: 'automatic',
      production: true,
    });

    let output = result.code;

    // Remove automatic runtime imports since we provide React in scope
    // react-live executes code in its own scope, not as ES modules
    output = output
      .replace(/import\s+\{[^}]*\}\s+from\s+['"]react\/jsx-runtime['"];?\s*/g, '')
      .replace(/import\s+React\s+from\s+['"]react['"];?\s*/g, '');

    // Replace _jsx and _jsxs calls with React.createElement
    // The automatic runtime uses _jsx/_jsxs which we don't have
    output = convertJsxRuntimeToCreateElement(output);

    return output;
  } catch (err) {
    console.warn(`[ReactLive] Transpilation failed for ${filePath}:`, err);
    return code;
  }
}

/**
 * Convert _jsx/_jsxs calls from the automatic runtime to React.createElement calls.
 * This is needed because react-live doesn't support ES module imports,
 * so we can't import from 'react/jsx-runtime'.
 *
 * _jsx(Component, {prop1: value1, children: [...]}, key)
 * → React.createElement(Component, {prop1: value1}, ...children)
 *
 * _jsxs(Component, {prop1: value1, children: [...]}, key)
 * → React.createElement(Component, {prop1: value1}, ...children)
 */
function convertJsxRuntimeToCreateElement(code: string): string {
  // Replace _jsxs(Component, { ...children... }, key) and _jsx(Component, { ... }, key)
  // with React.createElement equivalents
  let result = code;

  // Remove any remaining _jsxFileName declarations (shouldn't exist with automatic + production, but just in case)
  result = result.replace(/const\s+_jsxFileName\s*=\s*[^;]+;/g, '');

  // Simple replacement: _jsx( → React.createElement(
  // and _jsxs( → React.createElement(
  result = result.replace(/\b_jsxs?\s*\(/g, 'React.createElement(');

  // The automatic runtime passes children as a prop in the props object.
  // React.createElement spreads children as additional arguments.
  // For react-live, this simple conversion works well enough since
  // React.createElement handles both patterns.

  return result;
}

/**
 * Strip TypeScript-specific syntax that Sucrase might miss
 * (interface declarations, type aliases, type imports, etc.)
 */
function stripTypeScriptSyntax(code: string): string {
  return code
    // Remove interface declarations (multiline)
    .replace(/^interface\s+\w+(\s+extends\s+[\w,\s]+)?\s*\{[\s\S]*?\}/gm, '')
    // Remove type alias declarations
    .replace(/^type\s+\w+(\s*<[^>]+>)?\s*=\s*[^;]+;/gm, '')
    // Remove type-only imports
    .replace(/^import\s+type\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
    // Remove type-only exports
    .replace(/^export\s+type\s+.*?;?\s*$/gm, '')
    // Remove enum declarations
    .replace(/^enum\s+\w+\s*\{[\s\S]*?\}/gm, '')
    // Remove `as Type` assertions
    .replace(/\s+as\s+[A-Z]\w+(\[\])?/g, '')
    // Remove `implements Interface` from class declarations
    .replace(/\s+implements\s+\w+/g, '')
    // Remove readonly modifier
    .replace(/\breadonly\s+/g, '')
    // Clean up multiple blank lines
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Extract React component code from workspace files and build
 * a code string suitable for react-live's LiveProvider.
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
    if (p.endsWith('.d.ts')) return false;
    if (p.endsWith('.config.ts') || p.endsWith('.config.js')) return false;
    if (p === appFile?.[0]) return false;
    if (p === indexFile?.[0]) return false;
    return p.endsWith('.tsx') || p.endsWith('.jsx') || p.endsWith('.js') || p.endsWith('.mjs');
  });

  // Build the scope with React essentials
  const scope: Record<string, unknown> = {
    React,
    useState: React.useState,
    useEffect: React.useEffect,
    useCallback: React.useCallback,
    useMemo: React.useMemo,
    useRef: React.useRef,
    useContext: React.useContext,
    useReducer: React.useReducer,
    Fragment: React.Fragment,
    createElement: React.createElement,
  };

  // Build the code: component helpers + App component + render call
  let code = '';

  // Add CSS as a style tag inside the component
  if (cssContent) {
    code += `function _StyleInjector() {\n  if (typeof document !== 'undefined') {\n    const id = 'react-live-styles';\n    let el = document.getElementById(id);\n    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }\n    el.textContent = ${JSON.stringify(cssContent)};\n  }\n  return null;\n}\n\n`;
  }

  // Add Tailwind CDN script injection
  code += `function _TailwindLoader() {\n  if (typeof document !== 'undefined' && !document.getElementById('tailwind-cdn')) {\n    const s = document.createElement('script');\n    s.id = 'tailwind-cdn';\n    s.src = 'https://cdn.tailwindcss.com';\n    document.head.appendChild(s);\n  }\n  return null;\n}\n\n`;

  // Add component files (these are imports that react-live can't handle,
  // so we inline them after transpiling)
  for (const [path, file] of componentFiles) {
    // First strip imports and exports, then transpile
    let content = file.content
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '') // Remove imports
      .replace(/^export\s+default\s+/gm, '') // Remove default export
      .replace(/^export\s+/gm, ''); // Remove named exports

    // Transpile TypeScript/JSX to JavaScript
    content = transpileCode(content, path);

    // Additional cleanup for any remaining TypeScript syntax
    content = stripTypeScriptSyntax(content);

    code += `${content}\n\n`;
  }

  // Add the App component
  if (appFile) {
    let appContent = appFile[1].content
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '') // Remove imports
      .replace(/^export\s+default\s+/gm, ''); // Remove default export

    // Transpile TypeScript/JSX
    appContent = transpileCode(appContent, appFile[0]);
    appContent = stripTypeScriptSyntax(appContent);

    code += `${appContent}\n\n`;
  }

  // The render expression for react-live — use React.createElement to avoid JSX in render
  code += `render(React.createElement(React.Fragment, null, React.createElement(_TailwindLoader), React.createElement(_StyleInjector), React.createElement(App)))`;

  return { code, scope };
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
        <LiveProvider code={code} scope={scope} noInline={true} theme={{ plain: {}, styles: [] }}>
          <div className="react-live-preview-area">
            <RLivePreview />
          </div>
          <LiveError className="react-live-error" />
        </LiveProvider>
      </div>
    </div>
  );
});

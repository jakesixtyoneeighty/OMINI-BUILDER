import { useStore } from '@nanostores/react';
import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap, File as WFile } from '~/lib/stores/files';

/**
 * PlayCodePreview — Uses a self-contained iframe with inline HTML/CSS/JS.
 * For React projects, falls back to rendering a static preview with a note.
 *
 * This avoids external API dependencies (CodeSandbox/StackBlitz) that
 * cause connection timeouts.
 */
function buildPreviewHtml(files: FileMap): { html: string; isReact: boolean } {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);

  const hasReact = entries.some(([p]) => p.endsWith('.tsx') || p.endsWith('.jsx'));
  const hasVue = entries.some(([p]) => p.endsWith('.vue'));
  const htmlFile = entries.find(([p]) => p.endsWith('/index.html') || (p.endsWith('.html') && !p.endsWith('/public/index.html')));

  const cssFiles = entries.filter(([p]) => p.endsWith('.css') && !p.includes('node_modules'));
  const jsFiles = entries.filter(([p]) =>
    (p.endsWith('.js') || p.endsWith('.mjs')) && !p.includes('node_modules')
  );

  // For plain HTML projects, build a complete standalone page
  if (!hasReact && !hasVue) {
    let html = htmlFile?.[1].content || '';

    const css = cssFiles.map(([, f]) => f.content).join('\n\n');
    const js = jsFiles.map(([, f]) => f.content).join('\n\n');

    if (html) {
      // Inject Tailwind CDN if not present
      if (!html.includes('tailwindcss') && !html.includes('tailwind')) {
        html = html.replace('<head>', '<head>\n  <script src="https://cdn.tailwindcss.com"><\/script>');
      }
      // Inject CSS
      if (css) {
        const styleBlock = `<style>\n${css}\n</style>`;
        html = html.includes('</head>') ? html.replace('</head>', `${styleBlock}\n</head>`) : html + styleBlock;
      }
      // Inject JS
      if (js) {
        const scriptBlock = `<script>\n${js}\n<\/script>`;
        html = html.includes('</body>') ? html.replace('</body>', `${scriptBlock}\n</body>`) : html + scriptBlock;
      }
    } else {
      html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script>${js}<\/script>
</body>
</html>`;
    }

    return { html, isReact: false };
  }

  // For React/Vue projects, build a simple HTML preview that renders the component source
  // This is a lightweight fallback — for full React support, use Sandpack or WebContainer
  const componentFiles = entries.filter(([p]) => {
    if (p.includes('node_modules')) return false;
    if (p.endsWith('.css')) return false;
    if (p.endsWith('.html')) return false;
    if (p.endsWith('.json')) return false;
    return p.endsWith('.tsx') || p.endsWith('.jsx') || p.endsWith('.js') || p.endsWith('.mjs');
  });

  let codeDisplay = '';
  for (const [path, file] of componentFiles.slice(0, 5)) {
    const filename = path.split('/').pop() || path;
    codeDisplay += `<div class="file-block"><div class="file-name">${escapeHtml(filename)}</div><pre><code>${escapeHtml(file.content.substring(0, 3000))}${file.content.length > 3000 ? '\n// ... (truncated)' : ''}</code></pre></div>\n`;
  }

  const css = cssFiles.map(([, f]) => f.content).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; background: var(--bolt-elements-bg-depth-1, #0a0a0f); color: #e2e8f0; }
    .file-block { margin-bottom: 16px; border-radius: 8px; overflow: hidden; border: 1px solid var(--bolt-elements-borderColor, #2a2a3e); }
    .file-name { background: var(--bolt-elements-bg-depth-2, #1a1a2e); padding: 8px 12px; font-size: 12px; font-weight: 600; color: #a78bfa; border-bottom: 1px solid var(--bolt-elements-borderColor, #2a2a3e); }
    pre { margin: 0; padding: 12px; overflow-x: auto; background: #11111b; }
    code { font-family: 'Fira Code', 'Cascadia Code', monospace; font-size: 12px; line-height: 1.6; color: var(--bolt-elements-textSecondary, #c4b5fd); }
    .notice { text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; }
    .notice strong { color: #a78bfa; }
    ${css}
  </style>
</head>
<body>
  <div class="notice">
    <p style="font-size:18px;margin-bottom:8px;">React/Vue Project Detected</p>
    <p>For full interactive preview, switch to <strong>Sandpack</strong> or <strong>WebContainer</strong> mode.</p>
    <p style="margin-top:4px;">Below are the source files:</p>
  </div>
  ${codeDisplay}
</body>
</html>`;

  return { html, isReact: true };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const PlayCodePreview = memo(function PlayCodePreview() {
  const files = useStore(workbenchStore.files);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcdoc, setSrcdoc] = useState('');

  const { html, isReact } = useMemo(() => buildPreviewHtml(files), [files]);

  const fileCount = useMemo(() => {
    return Object.values(files).filter((f): f is WFile => f?.type === 'file' && !f.isBinary).length;
  }, [files]);

  useEffect(() => {
    const t = setTimeout(() => setSrcdoc(html), 80);
    return () => clearTimeout(t);
  }, [html]);

  if (fileCount === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full text-bolt-elements-textTertiary">
        <div className="text-center">
          <div className="i-ph:code-block text-4xl mb-3 mx-auto" />
          <p className="text-sm">No files to preview</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">Create or import files to see a preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0 bg-bolt-elements-bg-depth-1"
        srcDoc={srcdoc}
        title="PlayCode Preview"
        sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
      />
    </div>
  );
});

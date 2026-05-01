import { useStore } from '@nanostores/react';
import { memo, useMemo, useRef, useEffect, useState } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap, File as WFile } from '~/lib/stores/files';

/**
 * Builds a combined HTML document from the workspace files for srcdoc rendering.
 */
function buildSrcdoc(files: FileMap): string {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);
  if (entries.length === 0) return '';

  // Find an HTML file (prefer index.html)
  const htmlEntry = entries.find(([p]) => p.endsWith('/index.html')) || entries.find(([p]) => p.endsWith('.html'));
  let htmlContent = htmlEntry?.[1].content || '';

  // Collect CSS and JS files (excluding node_modules)
  const cssFiles = entries.filter(([p]) => p.endsWith('.css') && !p.includes('node_modules'));
  const jsFiles = entries.filter(([p]) => (p.endsWith('.js') || p.endsWith('.mjs')) && !p.includes('node_modules'));

  if (htmlContent) {
    // Inject Tailwind if not present
    if (!htmlContent.includes('tailwindcss') && !htmlContent.includes('tailwind')) {
      htmlContent = htmlContent.replace(
        '<head>',
        '<head>\n  <script src="https://cdn.tailwindcss.com"><\/script>'
      );
    }

    // Inject inline CSS before </head> if we have separate CSS files
    if (cssFiles.length > 0) {
      const cssBlock = cssFiles.map(([, f]) => `<style>\n${f.content}\n</style>`).join('\n');
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', `${cssBlock}\n</head>`);
      }
    }

    // Inject inline JS before </body> if we have separate JS files
    if (jsFiles.length > 0) {
      const jsBlock = jsFiles.map(([, f]) => `<script>\n${f.content}\n<\/script>`).join('\n');
      if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', `${jsBlock}\n</body>`);
      }
    }
  } else {
    // No HTML file found — build one from scratch
    const inlineCSS = cssFiles.map(([, f]) => f.content).join('\n\n');
    const inlineJS = jsFiles.map(([, f]) => f.content).join('\n\n');

    htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>${inlineCSS}</style>
</head>
<body>
  <div id="root"></div>
  <script>${inlineJS}<\/script>
</body>
</html>`;
  }

  return htmlContent;
}

export const SandpackPreview = memo(function SandpackPreview() {
  const files = useStore(workbenchStore.files);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcdoc, setSrcdoc] = useState('');

  const htmlContent = useMemo(() => buildSrcdoc(files), [files]);

  useEffect(() => {
    // Small delay to ensure smooth transition
    const timer = setTimeout(() => setSrcdoc(htmlContent), 80);
    return () => clearTimeout(timer);
  }, [htmlContent]);

  const fileCount = useMemo(() => {
    return Object.values(files).filter((f): f is WFile => f?.type === 'file' && !f.isBinary).length;
  }, [files]);

  if (fileCount === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full text-bolt-elements-textTertiary">
        <div className="text-center">
          <div className="i-ph:cube-duotone text-4xl mb-3 mx-auto" />
          <p className="text-sm">No files to preview</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">Create or import files to see a preview</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0 bg-white"
      srcDoc={srcdoc}
      title="Sandpack Preview"
      sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
    />
  );
});

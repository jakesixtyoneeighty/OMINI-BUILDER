import { useStore } from '@nanostores/react';
import { memo, useMemo, useRef, useEffect, useState } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import { projectsStore, activeProjectIdStore } from '~/lib/stores/project';

function detectType(files: Record<string, any>): 'react' | 'html' | 'vanilla' {
  const keys = Object.keys(files);
  if (keys.some(k => k.endsWith('.jsx') || k.endsWith('.tsx'))) return 'react';
  if (keys.some(k => k.endsWith('.html'))) return 'html';
  return 'vanilla';
}

function buildSrcdoc(files: Record<string, any>): string {
  const keys = Object.keys(files);
  const type = detectType(files);

  // Find the main HTML file
  const htmlFile = keys.find(k => k.endsWith('/index.html'));
  let htmlContent = htmlFile ? files[htmlFile].content : '';

  // If no HTML file, build one
  if (!htmlContent) {
    if (type === 'html') {
      const first = keys.find(k => k.endsWith('.html'));
      htmlContent = first ? files[first].content : '';
    }
  }

  if (!htmlContent) {
    // Build a simple HTML wrapper
    const cssFiles = keys.filter(k => k.endsWith('.css'));
    const jsFiles = keys.filter(k => k.endsWith('.js') && !k.includes('node_modules'));

    const inlineCSS = cssFiles.map(k => `/* ${k} */\n${files[k].content}`).join('\n\n');
    const inlineJS = jsFiles.map(k => `/* ${k} */\n${files[k].content}`).join('\n\n');

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
  } else {
    // Inject Tailwind if not present
    if (!htmlContent.includes('tailwindcss') && !htmlContent.includes('tailwind')) {
      htmlContent = htmlContent.replace(
        '<head>',
        '<head>\n  <script src="https://cdn.tailwindcss.com"><\/script>'
      );
    }
  }

  return htmlContent;
}

export const SandpackPreview = memo(() => {
  const files = useStore(workbenchStore.files);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcdoc, setSrcdoc] = useState('');

  const htmlContent = useMemo(() => buildSrcdoc(files), [files]);

  useEffect(() => {
    setSrcdoc(htmlContent);
  }, [htmlContent]);

  const refresh = () => {
    if (iframeRef.current) {
      setSrcdoc('');
      setTimeout(() => setSrcdoc(htmlContent), 50);
    }
  };

  if (Object.keys(files).length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full text-bolt-elements-textTertiary">
        <div className="text-center">
          <div className="i-ph:cube-duotone text-4xl mb-3 mx-auto" />
          <p className="text-sm">No files to preview</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">Import or create files to see a preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col absolute inset-0">
      {srcdoc && (
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0 bg-white"
          srcDoc={srcdoc}
          title="Preview"
          sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
        />
      )}
    </div>
  );
});

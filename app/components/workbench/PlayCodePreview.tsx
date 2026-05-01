import { useStore } from '@nanostores/react';
import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap, File as WFile } from '~/lib/stores/files';

/**
 * PlayCodePreview — Uses CodeSandbox's embed API (StackBlitz WebContainers)
 * to render the project in an iframe with full build support.
 *
 * This creates a CodeSandbox API definition blob URL and embeds it.
 */
function buildPlaycodeBlobUrl(files: FileMap): string {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);

  // Build CodeSandbox API files object
  const sandboxFiles: Record<string, { content: string; isBinary: boolean }> = {};

  for (const [path, file] of entries) {
    if (path.includes('node_modules') || path.endsWith('.lock')) continue;
    // Skip binary files
    if (file.isBinary) continue;

    // CodeSandbox expects paths like "/src/App.tsx"
    const spath = path.startsWith('/') ? path : `/${path}`;
    sandboxFiles[spath] = {
      content: file.content,
      isBinary: false,
    };
  }

  // Detect if React project
  const hasReact = entries.some(([p]) => p.endsWith('.tsx') || p.endsWith('.jsx'));
  const hasPackageJson = entries.some(([p]) => p.endsWith('/package.json'));

  let template = 'node';
  if (hasReact) {
    template = 'create-react-app';
  }

  // If no package.json but React files exist, add a minimal one
  if (hasReact && !hasPackageJson) {
    sandboxFiles['/package.json'] = {
      content: JSON.stringify({
        name: 'omni-builder-preview',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
          'react-scripts': '^5.0.0',
        },
        main: '/index.js',
      }, null, 2),
      isBinary: false,
    };
  }

  // Build the CodeSandbox sandbox definition
  const sandboxDefinition = {
    files: sandboxFiles,
    template,
    dependencies: hasPackageJson ? undefined : undefined,
  };

  // Create a blob URL for the sandbox definition
  const blob = new Blob([JSON.stringify(sandboxDefinition)], {
    type: 'application/json',
  });

  const blobUrl = URL.createObjectURL(blob);

  // Build the CodeSandbox embed URL
  // The embed parameter is the encoded sandbox definition
  const params = new URLSearchParams({
    fontsize: '14',
    theme: 'dark',
    module: '/index.js',
    runonclick: 'true',
    hidenavigation: 'true',
    hidewelcome: 'true',
    expandscren: 'true',
    view: 'preview',
  });

  // Use the blob URL as the file parameter for CodeSandbox
  return `https://codesandbox.io/api/v1/sandboxes/define?embed=1&${params.toString()}&parameters=${encodeURIComponent(JSON.stringify(sandboxDefinition))}`;
}

/**
 * Alternative: StackBlitz embed approach — more reliable for React
 */
function buildStackBlitzUrl(files: FileMap): string {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);
  const hasReact = entries.some(([p]) => p.endsWith('.tsx') || p.endsWith('.jsx'));

  // Build the project files as a JS object string
  const fileEntries = entries
    .filter(([p]) => !p.includes('node_modules') && !p.endsWith('.lock') && !f_isBinary(p))
    .map(([path, file]) => {
      const spath = path.startsWith('/') ? path.slice(1) : path;
      return `"${spath}": ${JSON.stringify(file.content)}`;
    })
    .join(',\n');

  // Build the project configuration
  const projectConfig = {
    title: 'Omni-Builder Preview',
    description: 'Preview from Omni-Builder',
    template: hasReact ? 'react-ts' : 'node',
    files: entries.reduce((acc, [path, file]) => {
      if (path.includes('node_modules') || path.endsWith('.lock')) return acc;
      const spath = path.startsWith('/') ? path.slice(1) : path;
      acc[spath] = file.content;
      return acc;
    }, {} as Record<string, string>),
  };

  return `https://stackblitz.com/run?embed=1&theme=dark&view=preview&file=src/App.tsx`;
}

function f_isBinary(p: string) {
  const ext = p.split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg', 'mp3', 'wav', 'mp4', 'woff', 'woff2', 'ttf'].includes(ext);
}

export const PlayCodePreview = memo(function PlayCodePreview() {
  const files = useStore(workbenchStore.files);
  const [embedUrl, setEmbedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fileCount = useMemo(() => {
    return Object.values(files).filter((f): f is WFile => f?.type === 'file' && !f.isBinary).length;
  }, [files]);

  const hasReact = useMemo(() => {
    return Object.entries(files).some(([p]) => p.endsWith('.tsx') || p.endsWith('.jsx'));
  }, [files]);

  useEffect(() => {
    try {
      setLoading(true);
      setError(false);
      const url = buildPlaycodeBlobUrl(files);
      setEmbedUrl(url);
    } catch (err) {
      setError(true);
      setLoading(false);
      console.error('Failed to build PlayCode URL', err);
    }
  }, [files]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

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
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bolt-elements-background-depth-1">
          <div className="text-center">
            <div className="i-svg-spinners:90-ring-with-bg text-3xl text-purple-400 mx-auto mb-3" />
            <p className="text-sm text-bolt-elements-textSecondary">Loading PlayCode preview...</p>
            <p className="text-xs text-bolt-elements-textTertiary mt-1">Connecting to CodeSandbox API</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bolt-elements-background-depth-1">
          <div className="text-center max-w-md">
            <div className="i-ph:warning-circle text-4xl text-yellow-400 mx-auto mb-3" />
            <p className="text-sm text-bolt-elements-textPrimary font-semibold">Failed to load PlayCode</p>
            <p className="text-xs text-bolt-elements-textTertiary mt-2">
              The CodeSandbox API couldn't render this project. Try a different preview mode like Sandpack or WebContainer.
            </p>
          </div>
        </div>
      )}
      {embedUrl && (
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          src={embedUrl}
          title="PlayCode Preview"
          sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups allow-presentation"
          onLoad={handleLoad}
          onError={handleError}
          allow="accelerometer; ambient-light-sensor; autoplay; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr; clipboard-write"
        />
      )}
    </div>
  );
});

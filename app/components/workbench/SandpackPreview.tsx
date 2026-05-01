import { useStore } from '@nanostores/react';
import { memo, useMemo, useState, useEffect } from 'react';
import {
  SandpackProvider,
  SandpackPreview as SPPreview,
  getSandpackCssText,
} from '@codesandbox/sandpack-react';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap, File as WFile } from '~/lib/stores/files';

/**
 * Detect whether the project is React, Vue, or plain HTML/JS
 */
type ProjectType = 'react' | 'react-ts' | 'vue' | 'vanilla';

function detectProjectType(files: FileMap): ProjectType {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);

  // Check package.json for framework hints
  const pkgFile = entries.find(([p]) => p.endsWith('/package.json'));
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile[1].content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['react'] || deps['react-dom']) {
        // Check for TypeScript
        const hasTs = entries.some(([p]) => p.endsWith('.tsx') || p.endsWith('.ts'));
        return hasTs ? 'react-ts' : 'react';
      }
      if (deps['vue']) return 'vue';
    } catch {
      /* ignore */
    }
  }

  // Fallback: check file extensions
  const hasJsx = entries.some(([p]) => p.endsWith('.jsx'));
  const hasTsx = entries.some(([p]) => p.endsWith('.tsx'));
  if (hasTsx) return 'react-ts';
  if (hasJsx) return 'react';
  if (entries.some(([p]) => p.endsWith('.vue'))) return 'vue';

  return 'vanilla';
}

/**
 * Map workspace files to Sandpack format: { '/path': { code: '...' } }
 * Also determines the entry point and custom setup.
 */
function mapToSandpackFiles(files: FileMap, projectType: ProjectType) {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);
  const sandpackFiles: Record<string, { code: string; hidden?: boolean }> = {};

  for (const [path, file] of entries) {
    // Skip common non-essential files
    if (path.includes('node_modules') || path.endsWith('.lock')) continue;
    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.ico')) continue;

    // Sandpack expects absolute paths starting with /
    const spath = path.startsWith('/') ? path : `/${path}`;
    sandpackFiles[spath] = { code: file.content, hidden: false };
  }

  // For vanilla/HTML projects: ensure there's an index.html
  if (projectType === 'vanilla') {
    const hasIndexHtml = entries.some(([p]) => p.endsWith('/index.html') || p.endsWith('.html'));
    if (!hasIndexHtml) {
      const cssFiles = entries.filter(([p]) => p.endsWith('.css'));
      const jsFiles = entries.filter(([p]) => p.endsWith('.js') || p.endsWith('.mjs'));
      const inlineCSS = cssFiles.map(([, f]) => f.content).join('\n');
      const inlineJS = jsFiles.map(([, f]) => f.content).join('\n');

      sandpackFiles['/index.html'] = {
        code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>${inlineCSS}</style>
</head>
<body>
  <div id="app"></div>
  <script>${inlineJS}</script>
</body>
</html>`,
      };
    }
  }

  return sandpackFiles;
}

/**
 * Determine the Sandpack template and entry point based on project type
 */
function getTemplateConfig(projectType: ProjectType, files: FileMap) {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);

  switch (projectType) {
    case 'react-ts':
    case 'react': {
      // Try to find the entry point
      const indexJs = entries.find(([p]) =>
        p.endsWith('/index.js') || p.endsWith('/index.tsx') || p.endsWith('/index.jsx')
      );
      const mainJs = entries.find(([p]) =>
        p.endsWith('/main.js') || p.endsWith('/main.tsx') || p.endsWith('/main.jsx')
      );
      const entry = indexJs ? `/${indexJs[0].split('/').pop()}` : mainJs ? `/${mainJs[0].split('/').pop()}` : '/index.js';

      return {
        template: 'react' as const,
        customSetup: {
          entry,
          environment: 'create-react-app' as const,
        },
      };
    }
    case 'vue': {
      return {
        template: 'vue' as const,
        customSetup: {
          entry: '/src/main.js',
        },
      };
    }
    case 'vanilla':
    default: {
      return {
        template: 'vanilla' as const,
        customSetup: {
          entry: '/index.js',
          environment: 'parcel' as const,
        },
      };
    }
  }
}

// Shared styles to hide Sandpack chrome and make preview fill the container
const SANDBOX_STYLES = `
.sp-wrapper {
  width: 100% !important;
  height: 100% !important;
  border: none !important;
  background: white !important;
}
.sp-preview {
  height: 100% !important;
}
.sp-preview-iframe {
  height: 100% !important;
}
.sp-layout {
  border: none !important;
  height: 100% !important;
  background: transparent !important;
}
.sp-preview-container {
  height: 100% !important;
}
`;

function SandpackPreviewInner({ files, projectType }: { files: FileMap; projectType: ProjectType }) {
  const sandpackFiles = useMemo(() => mapToSandpackFiles(files, projectType), [files, projectType]);
  const { template, customSetup } = useMemo(() => getTemplateConfig(projectType, files), [files, projectType]);

  const fileCount = Object.keys(sandpackFiles).length;
  if (fileCount === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full text-bolt-elements-textTertiary">
        <div className="text-center">
          <div className="i-ph:browser-duotone text-4xl mb-3 mx-auto" />
          <p className="text-sm">No files to preview</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">Create or import files to see a preview</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
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

export const SandpackPreview = memo(function SandpackPreview() {
  const files = useStore(workbenchStore.files);
  const projectType = useMemo(() => detectProjectType(files), [files]);

  const fileCount = useMemo(() => {
    return Object.values(files).filter((f): f is WFile => f?.type === 'file' && !f.isBinary).length;
  }, [files]);

  if (fileCount === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full text-bolt-elements-textTertiary">
        <div className="text-center">
          <div className="i-ph:browser-duotone text-4xl mb-3 mx-auto" />
          <p className="text-sm">No files to preview</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">Create or import files to see a preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <SandpackPreviewInner files={files} projectType={projectType} />
    </div>
  );
});

export { detectProjectType, type ProjectType };

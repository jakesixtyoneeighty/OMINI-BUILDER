import { useStore } from '@nanostores/react';
import { memo, useMemo } from 'react';
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewCore,
  SandpackCodeEditor,
  SandpackLayout,
} from '@codesandbox/sandpack-react';
import { workbenchStore } from '~/lib/stores/workbench';
import { getActiveProject } from '~/lib/stores/project';

function detectTemplate(files: Record<string, { content: string; type: string }>): 'react' | 'vue' | 'vanilla' | 'static' {
  const keys = Object.keys(files);

  if (keys.some(k => k.endsWith('package.json'))) {
    const pkg = files[keys.find(k => k.endsWith('package.json'))!];
    try {
      const parsed = JSON.parse(pkg.content);
      const deps = { ...parsed.dependencies, ...parsed.devDependencies };
      if (deps['react'] || deps['next']) return 'react';
      if (deps['vue'] || deps['nuxt']) return 'vue';
    } catch {}
  }

  if (keys.some(k => k.endsWith('.jsx') || k.endsWith('.tsx'))) return 'react';
  if (keys.some(k => k.endsWith('.vue'))) return 'vue';
  if (keys.some(k => k.endsWith('.html'))) return 'static';

  return 'react';
}

function buildSandpackFiles(files: Record<string, { content: string; type: string }>): Record<string, string> {
  const result: Record<string, string> = {};
  const prefix = '/home/project/';

  for (const [path, file] of Object.entries(files)) {
    if (file.type === 'file' && !file.isBinary) {
      let cleanPath = path;
      if (cleanPath.startsWith(prefix) || cleanPath.startsWith('./')) {
        cleanPath = cleanPath.replace(/^\.\//, '').replace(prefix, '');
      }
      if (cleanPath && !cleanPath.startsWith('.') && !cleanPath.includes('node_modules')) {
        result['/' + cleanPath] = file.content;
      }
    }
  }

  if (Object.keys(result).length === 0) {
    result['/index.html'] = `<!DOCTYPE html>
<html>
<head><title>Preview</title></head>
<body><div id="root"><p>No files to preview</p></div></body>
</html>`;
  }

  return result;
}

export const SandpackPreview = memo(() => {
  const files = useStore(workbenchStore.files);
  const project = getActiveProject();

  const { template, sandpackFiles, entryFile } = useMemo(() => {
    const t = detectTemplate(files);
    const sf = buildSandpackFiles(files);
    
    let entry = '/App.jsx';
    
    if (t === 'static') {
      entry = '/index.html';
    } else if (t === 'react') {
      if (sf['/index.jsx']) entry = '/index.jsx';
      else if (sf['/index.tsx']) entry = '/index.tsx';
      else if (sf['/src/App.jsx']) entry = '/src/App.jsx';
      else if (sf['/src/App.tsx']) entry = '/src/App.tsx';
      else if (sf['/src/main.jsx']) entry = '/src/main.jsx';
      else if (sf['/src/main.tsx']) entry = '/src/main.tsx';
      else {
        const firstJsx = Object.keys(sf).find(k => k.endsWith('.jsx') || k.endsWith('.tsx'));
        if (firstJsx) entry = firstJsx;
      }
    } else if (t === 'vue') {
      entry = '/src/App.vue';
      if (!sf[entry]) {
        const firstVue = Object.keys(sf).find(k => k.endsWith('.vue'));
        if (firstVue) entry = firstVue;
      }
    }

    return { template: t, sandpackFiles: sf, entryFile: entry };
  }, [files]);

  if (Object.keys(sandpackFiles).length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-bolt-elements-textTertiary">
        <div className="text-center">
          <div className="i-ph:cube-duotone text-4xl mb-2" />
          <p>No files to preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-bolt-elements-background-depth-1">
      <SandpackProvider
        template={template as any}
        files={sandpackFiles}
        customSetup={{
          entry: entryFile,
        }}
        theme="dark"
        options={{
          externalResources: [
            'https://cdn.tailwindcss.com',
          ],
        }}
      >
        <SandpackLayout style={{ height: '100%', border: 'none' }}>
          <SandpackPreviewCore
            showNavigator
            showRefreshButton
            style={{ height: '100%' }}
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
});

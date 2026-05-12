/**
 * Deploy Build Utility
 *
 * Before deploying to Cloudflare Pages, we need to build the project
 * in the WebContainer and read the built output (dist/ directory).
 * Cloudflare Pages Direct Upload doesn't run a build step — it just
 * serves files as-is, so raw source files (TSX, etc.) cause a 404.
 */
import type { WebContainer } from '@webcontainer/api';
import { webcontainer } from '~/lib/webcontainer';

export interface BuildFile {
  path: string;
  content: string;
}

export interface BuildResult {
  files: BuildFile[];
  buildOutputDir: string;
  buildLog: string;
  success: boolean;
  error?: string;
}

/**
 * Detects the project type and build configuration by reading package.json
 * from the WebContainer.
 */
async function detectProjectConfig(wc: WebContainer): Promise<{
  hasPackageJson: boolean;
  buildScript: string | null;
  framework: 'vite' | 'next' | 'nuxt' | 'astro' | 'react-scripts' | 'unknown';
  outputDir: string;
}> {
  try {
    const pkgContent = await wc.fs.readFile('package.json', 'utf8');
    const pkg = JSON.parse(pkgContent);

    const scripts = pkg.scripts || {};
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Detect framework
    let framework: 'vite' | 'next' | 'nuxt' | 'astro' | 'react-scripts' | 'unknown' = 'unknown';
    let outputDir = 'dist';

    if (deps['next'] || deps['next.js']) {
      framework = 'next';
      outputDir = 'out'; // Next.js static export
    } else if (deps['nuxt'] || deps['nuxt3']) {
      framework = 'nuxt';
      outputDir = 'dist';
    } else if (deps['astro']) {
      framework = 'astro';
      outputDir = 'dist';
    } else if (deps['vite'] || deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-vue']) {
      framework = 'vite';
      outputDir = 'dist';
    } else if (deps['react-scripts']) {
      framework = 'react-scripts';
      outputDir = 'build';
    }

    // Check for build script
    let buildScript: string | null = null;
    if (scripts['build']) {
      buildScript = 'npm run build';
    }

    // Check vite.config for custom outDir
    if (framework === 'vite') {
      try {
        const viteConfig = await wc.fs.readFile('vite.config.ts', 'utf8').catch(() => '');
        const viteConfigJs = await wc.fs.readFile('vite.config.js', 'utf8').catch(() => '');
        const config = viteConfig || viteConfigJs;
        const outDirMatch = config.match(/outDir\s*:\s*['"`]([^'"`]+)['"`]/);
        if (outDirMatch) {
          outputDir = outDirMatch[1];
        }
      } catch {
        // Ignore errors reading vite config
      }
    }

    return {
      hasPackageJson: true,
      buildScript,
      framework,
      outputDir,
    };
  } catch {
    // No package.json — likely a plain HTML project
    return {
      hasPackageJson: false,
      buildScript: null,
      framework: 'unknown',
      outputDir: 'dist',
    };
  }
}

/**
 * Check if there's an index.html at the root (simple static site).
 */
async function hasRootIndexHtml(wc: WebContainer): Promise<boolean> {
  try {
    await wc.fs.readFile('index.html', 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a build command in the WebContainer and wait for completion.
 */
async function runBuildCommand(wc: WebContainer, command: string): Promise<{ exitCode: number; log: string }> {
  // NOTE: Do NOT pass a custom `env` object — it replaces (not merges) the entire
  // environment, which wipes out PATH and causes "exit code 127" (command not found).
  // Instead, we prefix the command with the env vars we need.
  const process = await wc.spawn('jsh', ['-c', `npm_config_yes=true NODE_ENV=production ${command}`]);

  let log = '';
  process.output.pipeTo(
    new WritableStream({
      write(data) {
        // Strip ANSI escape codes for the log
        log += data.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\]654;[^\x07]*\x07/g, '');
      },
    }),
  );

  const exitCode = await process.exit;
  return { exitCode, log };
}

/**
 * Recursively read all files from a directory in the WebContainer.
 */
async function readDirectoryRecursive(wc: WebContainer, dir: string, basePath: string = ''): Promise<BuildFile[]> {
  const files: BuildFile[] = [];

  let entries;
  try {
    entries = await wc.fs.readdir(dir, { withFileTypes: true });
  } catch {
    // Directory doesn't exist
    return files;
  }

  for (const entry of entries) {
    const fullPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      // Skip hidden dirs and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const subFiles = await readDirectoryRecursive(wc, fullPath, relativePath);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      try {
        const content = await wc.fs.readFile(fullPath, 'utf8');
        files.push({ path: relativePath, content });
      } catch {
        // Binary file or read error — skip
        console.warn(`[deploy-build] Skipping binary/unreadable file: ${fullPath}`);
      }
    }
  }

  return files;
}

/**
 * Build the project in the WebContainer and return the output files.
 *
 * Strategy:
 * 1. If there's a package.json with a build script → run build, read dist/
 * 2. If there's an index.html at root → deploy raw files (it's a static site)
 * 3. If neither → try to run npm install + build anyway
 */
export async function buildProjectForDeploy(): Promise<BuildResult> {
  const wc = await webcontainer;

  const config = await detectProjectConfig(wc);

  // Case 1: No package.json, check for index.html (static site)
  if (!config.hasPackageJson) {
    if (await hasRootIndexHtml(wc)) {
      // Plain HTML project — read all files from root
      const files = await readDirectoryRecursive(wc, '.');
      return {
        files,
        buildOutputDir: '.',
        buildLog: 'Static HTML project — no build needed',
        success: true,
      };
    }

    return {
      files: [],
      buildOutputDir: '.',
      buildLog: '',
      success: false,
      error: 'No package.json and no index.html found. Cannot determine how to build the project.',
    };
  }

  // Case 2: Has package.json but no build script — check for index.html
  if (!config.buildScript) {
    if (await hasRootIndexHtml(wc)) {
      const files = await readDirectoryRecursive(wc, '.');
      return {
        files,
        buildOutputDir: '.',
        buildLog: 'No build script found — deploying as static site',
        success: true,
      };
    }

    return {
      files: [],
      buildOutputDir: config.outputDir,
      buildLog: '',
      success: false,
      error: 'No build script found in package.json and no index.html at root.',
    };
  }

  // Case 3: Has build script — run it!
  console.log(`[deploy-build] Running build: ${config.buildScript} (framework: ${config.framework})`);

  // First, ensure dependencies are installed
  const installResult = await runBuildCommand(wc, 'npm install');
  if (installResult.exitCode !== 0) {
    // Try with pnpm as fallback
    const pnpmResult = await runBuildCommand(wc, 'pnpm install 2>/dev/null || npm install');
    if (pnpmResult.exitCode !== 0) {
      return {
        files: [],
        buildOutputDir: config.outputDir,
        buildLog: installResult.log + '\n' + pnpmResult.log,
        success: false,
        error: `Failed to install dependencies (exit code: ${installResult.exitCode})`,
      };
    }
  }

  // Run the build
  const buildResult = await runBuildCommand(wc, config.buildScript);
  if (buildResult.exitCode !== 0) {
    return {
      files: [],
      buildOutputDir: config.outputDir,
      buildLog: buildResult.log,
      success: false,
      error: `Build failed (exit code: ${buildResult.exitCode})`,
    };
  }

  // Read the build output
  const outputFiles = await readDirectoryRecursive(wc, config.outputDir);

  if (outputFiles.length === 0) {
    // Try alternative output directories
    const altDirs = ['dist', 'build', 'out', '.output', '.next'];
    for (const altDir of altDirs) {
      if (altDir === config.outputDir) continue;
      const altFiles = await readDirectoryRecursive(wc, altDir);
      if (altFiles.length > 0) {
        return {
          files: altFiles,
          buildOutputDir: altDir,
          buildLog: buildResult.log + `\n\nUsed alternative output dir: ${altDir}`,
          success: true,
        };
      }
    }

    return {
      files: [],
      buildOutputDir: config.outputDir,
      buildLog: buildResult.log,
      success: false,
      error: `Build succeeded but no output files found in ${config.outputDir}/`,
    };
  }

  return {
    files: outputFiles,
    buildOutputDir: config.outputDir,
    buildLog: buildResult.log,
    success: true,
  };
}

/**
 * Fallback: get raw source files from the workbench store.
 * Used when the build fails but the user still wants to deploy.
 */
export async function getRawSourceFiles(): Promise<BuildFile[]> {
  const wc = await webcontainer;
  const files = await readDirectoryRecursive(wc, '.');
  return files;
}

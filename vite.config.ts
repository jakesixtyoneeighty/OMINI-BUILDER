import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig((config) => {
  return {
    // Only expose VITE_ and WEBCONTAINER_ prefixed env vars to the client.
    // NEVER expose SUPABASE_ (includes SERVICE_ROLE_KEY) or VERCEL_TOKEN here —
    // they are server-side secrets that must NOT be embedded in the client bundle.
    envPrefix: ['VITE_', 'WEBCONTAINER_'],
    server: {
      host: '0.0.0.0',
      port: 5000,
      strictPort: true,
      allowedHosts: true,
      hmr: {
        protocol: 'wss',
        clientPort: 443,
      },
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
    build: {
      target: 'esnext',
      // CSS code splitting for smaller initial load
      cssCodeSplit: true,
      // Rollup options for chunk splitting
      rollupOptions: {
        output: {
          // Manual chunks to split heavy dependencies
          // Using function form to safely skip external modules (react, react-dom are externalized by Cloudflare)
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // Terminal — heavy, only needed in workbench (~200KB)
              if (id.includes('@xterm/xterm') || id.includes('@xterm/addon-fit') || id.includes('@xterm/addon-web-links')) {
                return 'vendor-terminal';
              }
              // CodeMirror — heavy editor, only in workbench (~400KB)
              if (id.includes('@codemirror/') || id.includes('@lezer/')) {
                return 'vendor-codemirror';
              }
              // AI/SDK — only needed during chat
              if (id.includes('@ai-sdk/') || id.includes('/ai/')) {
                return 'vendor-ai';
              }
              // Markdown rendering — only in chat messages
              if (id.includes('react-markdown') || id.includes('rehype-') || id.includes('remark-') || id.includes('unified') || id.includes('unist-') || id.includes('bail') || id.includes('is-plain-') || id.includes('trough') || id.includes('vfile')) {
                return 'vendor-markdown';
              }
              // Animation — only in workbench transitions
              if (id.includes('framer-motion')) {
                return 'vendor-motion';
              }
              // Sandpack — only in sandpack preview mode
              if (id.includes('@codesandbox/sandpack')) {
                return 'vendor-sandpack';
              }
              // Supabase — auth + DB
              if (id.includes('@supabase/')) {
                return 'vendor-supabase';
              }
              // Sucrase — transpilation for react-live
              if (id.includes('sucrase')) {
                return 'vendor-sucrase';
              }
              // Shiki — syntax highlighting (heavy)
              if (id.includes('shiki')) {
                return 'vendor-shiki';
              }
              // Nanostores — state management
              if (id.includes('nanostores') || id.includes('@nanostores/')) {
                return 'vendor-state';
              }
              // Radix UI primitives
              if (id.includes('@radix-ui/')) {
                return 'vendor-radix';
              }
            }
          },
        },
      },
      // Minification settings
      minify: 'esbuild',
      // Reduce chunk size warnings threshold
      chunkSizeWarningLimit: 600,
    },
    plugins: [
      nodePolyfills({
        include: ['path', 'buffer'],
      }),
      config.mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    ],
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );

            return;
          }
        }

        next();
      });
    },
  };
}

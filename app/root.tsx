import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/cloudflare';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
  useNavigate,
} from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect, useState } from 'react';
import { initPerformanceOptimizer, cleanupResources } from './lib/performance';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/omini-favicon.png',
    type: 'image/png',
  },
  {
    rel: 'apple-touch-icon',
    href: '/apple-touch-icon.png',
  },
  {
    rel: 'manifest',
    href: '/manifest.json',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = 'dark';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#6366f1" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Omni Builder" />
    <Meta />
    <Links />
    <script src="/coi-serviceworker.js"></script>
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    // Initialize performance optimizer on first mount
    initPerformanceOptimizer();
  }, []);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);

    if (window.crossOriginIsolated === false) {
      console.warn('A página não está isolada de origem cruzada. O WebContainer pode falhar.');
    }
  }, [theme]);

  return (
    <>
      {children}
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const [showFullStack, setShowFullStack] = useState(false);
  const [copied, setCopied] = useState(false);

  let title = 'Erro Fatal na Aplicação';
  let message = 'Ocorreu um erro inesperado.';
  let stackTrace = '';
  let errorName = '';
  let status = '';
  let statusText = '';
  let errorData: any = null;
  let rawError = '';

  if (isRouteErrorResponse(error)) {
    status = String(error.status);
    statusText = error.statusText;
    title = `${error.status} — ${error.statusText}`;
    message = error.data?.message || error.data || 'Erro de rota.';
    errorData = error.data;
  } else if (error instanceof Error) {
    errorName = error.name || 'Error';
    message = error.message || 'Ocorreu um erro inesperado.';
    stackTrace = error.stack || '';
  } else if (typeof error === 'string') {
    rawError = error;
  } else if (error && typeof error === 'object') {
    rawError = JSON.stringify(error, null, 2);
    message = (error as any)?.message || (error as any)?.error || rawError || 'Erro desconhecido.';
    stackTrace = (error as any)?.stack || '';
    errorName = (error as any)?.name || '';
  }

  const fullReport = [
    '=== Omni-Builder — Relatório de Erro Fatal ===',
    '',
    `Timestamp: ${new Date().toISOString()}`,
    `URL: ${typeof window !== 'undefined' ? window.location.href : 'unknown'}`,
    `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`,
    status ? `HTTP Status: ${status} ${statusText}` : '',
    errorName ? `Error Type: ${errorName}` : '',
    '',
    `Message: ${message}`,
    '',
    stackTrace ? '--- Stack Trace ---\n' + stackTrace : '',
    errorData ? '--- Error Data ---\n' + JSON.stringify(errorData, null, 2) : '',
    rawError ? '--- Raw Error ---\n' + rawError : '',
  ]
    .filter(Boolean)
    .join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleGoBack = () => {
    try {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    } catch {
      window.location.href = '/';
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleClearAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bolt-elements-bg-depth-1 text-bolt-elements-textPrimary p-6 overflow-y-auto">
      <div className="w-full max-w-2xl">
        {/* Error icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-lg shadow-red-500/5">
            <svg
              className="w-10 h-10 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
        </div>

        {/* Title & Message */}
        <h1 className="text-2xl font-bold text-center mb-2 text-red-400">{title}</h1>
        <p className="text-bolt-elements-textSecondary text-center text-sm mb-4 leading-relaxed">{message}</p>

        {/* Context info */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-bolt-elements-textTertiary mb-6">
          <span>{new Date().toLocaleString()}</span>
          {typeof window !== 'undefined' && (
            <span className="font-mono truncate max-w-[300px]">{window.location.href}</span>
          )}
        </div>

        {/* Error details card */}
        {(stackTrace || errorData || rawError || status) && (
          <div className="mb-6 rounded-xl bg-bolt-elements-bg-depth-2 border border-red-500/20 overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3 bg-red-500/5 border-b border-red-500/15">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-xs font-semibold text-red-300 uppercase tracking-wider">
                  Detalhes Completos do Erro
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors px-2 py-1 rounded-lg hover:bg-purple-500/10"
              >
                <div className={`i-ph:${copied ? 'check' : 'copy'} text-sm`} />
                {copied ? 'Copiado!' : 'Copiar Tudo'}
              </button>
            </div>

            {/* Status badge (for route errors) */}
            {status && (
              <div className="px-4 py-2 border-b border-bolt-elements-borderColor">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-300 text-xs font-mono">
                  HTTP {status} {statusText}
                </span>
              </div>
            )}

            {/* Error name badge */}
            {errorName && errorName !== 'Error' && (
              <div className="px-4 py-2 border-b border-bolt-elements-borderColor">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 text-xs font-mono">
                  {errorName}
                </span>
              </div>
            )}

            {/* Stack trace (collapsible) */}
            {stackTrace && (
              <div>
                <button
                  onClick={() => setShowFullStack(!showFullStack)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-button-secondary-backgroundHover transition-colors border-b border-bolt-elements-borderColor"
                >
                  <span className="font-medium">Stack Trace ({stackTrace.split('\n').length} linhas)</span>
                  <div className={`i-ph:${showFullStack ? 'caret-up' : 'caret-down'} text-sm`} />
                </button>
                <pre
                  className={`font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words overflow-auto transition-all duration-200 ${
                    showFullStack ? 'max-h-[500px] p-4 text-red-300/80' : 'max-h-0 overflow-hidden'
                  }`}
                >
                  {stackTrace}
                </pre>
              </div>
            )}

            {/* Error data (for route errors with data) */}
            {errorData && typeof errorData === 'object' && (
              <div className="border-t border-bolt-elements-borderColor">
                <div className="px-4 py-2 border-b border-bolt-elements-borderColor text-xs text-bolt-elements-textTertiary font-medium">
                  Error Data
                </div>
                <pre className="p-4 text-[11px] text-amber-300/80 font-mono overflow-auto max-h-[200px] whitespace-pre-wrap break-words">
                  {JSON.stringify(errorData, null, 2)}
                </pre>
              </div>
            )}

            {/* Raw error (for non-standard errors) */}
            {rawError && !stackTrace && (
              <div className="border-t border-bolt-elements-borderColor">
                <div className="px-4 py-2 border-b border-bolt-elements-borderColor text-xs text-bolt-elements-textTertiary font-medium">
                  Raw Error
                </div>
                <pre className="p-4 text-[11px] text-red-300/70 font-mono overflow-auto max-h-[200px] whitespace-pre-wrap break-words">
                  {rawError}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleGoBack}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-bolt-elements-button-secondary-backgroundHover border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:bg-bolt-elements-button-secondary-backgroundHover/80 hover:text-bolt-elements-textPrimary transition-all"
          >
            <div className="i-ph:arrow-left text-base" />
            Voltar
          </button>
          <button
            onClick={handleClearAndReload}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-bolt-elements-button-secondary-backgroundHover border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:bg-bolt-elements-button-secondary-backgroundHover/80 hover:text-bolt-elements-textPrimary transition-all"
          >
            <div className="i-ph:trash text-base" />
            Limpar Cache
          </button>
          <button
            onClick={handleReload}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all"
          >
            <div className="i-ph:arrow-clockwise text-base" />
            Recarregar
          </button>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-bolt-elements-textTertiary mt-6">
          Omni-Builder v1.0 — Se o erro persistir, copie os detalhes e abra uma issue no GitHub.
        </p>
      </div>
    </div>
  );
}

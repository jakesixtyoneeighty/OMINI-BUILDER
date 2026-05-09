import { type MetaFunction } from '@remix-run/cloudflare';
import { useSearchParams } from '@remix-run/react';
import { useState, useCallback } from 'react';

export const meta: MetaFunction = () => {
  return [
    { title: 'Omni-Builder — Preview' },
    { name: 'description', content: 'Full-screen preview of your app running in WebContainer' },
  ];
};

/**
 * /preview?url=<webcontainer_url>
 *
 * Full-page preview that embeds a WebContainer URL in an iframe.
 * This route exists because WebContainer URLs like /webcontainer/connect/xxx
 * are internal paths that only work inside an iframe context — opening them
 * directly as a top-level URL would result in a 404 from Remix.
 */
export default function PreviewPage() {
  const [searchParams] = useSearchParams();
  const previewUrl = searchParams.get('url') || '';
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setError(true);
  }, []);

  if (!previewUrl) {
    return (
      <div className="flex flex-col items-center justify-center w-screen h-screen bg-[#0a0a0f] text-white">
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <div className="i-ph:link-break text-3xl text-red-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">URL do preview nao encontrada</h1>
        <p className="text-sm text-gray-400 mb-6 text-center max-w-md">
          Abra o preview a partir do Omni-Builder clicando no botao "Abrir em nova aba" no painel de preview.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all"
        >
          <div className="i-ph:arrow-left text-base" />
          Voltar ao Omni-Builder
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Minimal toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d0d1a] border-b border-[#1a1a2e] shrink-0">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
          <div className="i-ph:cube-duotone text-sm" />
          WebContainer
        </div>
        <div className="flex-1 flex items-center bg-[#0a0a0f] border border-[#1a1a2e] rounded-md px-3 py-1 text-xs text-gray-400 truncate font-mono">
          {previewUrl}
        </div>
        <button
          onClick={() => {
            setLoaded(false);
            setError(false);
            const iframe = document.querySelector('iframe');
            if (iframe) iframe.src = iframe.src;
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-gray-400 hover:text-white hover:bg-[#1a1a2e] transition-all"
          title="Atualizar preview"
        >
          <div className="i-ph:arrow-clockwise text-sm" />
        </button>
        <a
          href="/"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-gray-400 hover:text-white hover:bg-[#1a1a2e] transition-all"
          title="Voltar ao Omni-Builder"
        >
          <div className="i-ph:arrow-left text-sm" />
          Voltar
        </a>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f] z-10">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-[#1a1a2e]" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="i-ph:eye text-xl text-gray-500" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-400">Carregando preview...</p>
              <p className="text-xs text-gray-600 mt-1">Aguarde enquanto o app e compilado</p>
              <div className="flex items-center justify-center gap-1 mt-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f] z-10">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <div className="i-ph:warning-circle text-3xl text-red-400" />
              </div>
              <p className="text-sm font-medium text-gray-300 mb-1">Falha ao carregar o preview</p>
              <p className="text-xs text-gray-500 mb-4">O WebContainer pode ter sido encerrado ou a URL expirou.</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setError(false);
                    setLoaded(false);
                    const iframe = document.querySelector('iframe');
                    if (iframe) iframe.src = iframe.src;
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all"
                >
                  <div className="i-ph:arrow-clockwise text-sm" />
                  Tentar novamente
                </button>
                <a
                  href="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 hover:text-white transition-all"
                >
                  Voltar ao Omni-Builder
                </a>
              </div>
            </div>
          </div>
        )}

        <iframe
          src={previewUrl}
          className="w-full h-full border-0 bg-white"
          title="App Preview"
          onLoad={handleLoad}
          onError={handleError}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            background: 'white',
          }}
        />
      </div>
    </div>
  );
}

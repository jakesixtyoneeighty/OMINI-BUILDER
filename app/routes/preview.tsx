import { type MetaFunction } from '@remix-run/cloudflare';
import { useSearchParams } from '@remix-run/react';
import { useState, useCallback } from 'react';
import { useT } from '~/lib/i18n/useT';

export const meta: MetaFunction = () => {
  return [
    { title: 'Mojo Builder — Preview' },
    { name: 'description', content: 'Full-screen preview of your app running in WebContainer' },
  ];
};

/**
 * /preview?url=<webcontainer_url>
 *
 * Full-page preview that embeds a WebContainer URL in an iframe.
 */
export default function PreviewPage() {
  const t = useT();
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
      <div className="flex flex-col items-center justify-center w-screen h-screen bg-bolt-elements-bg-depth-1 text-bolt-elements-textPrimary">
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <div className="i-ph:link-break text-3xl text-red-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">{t('previewPage.urlNotFound')}</h1>
        <p className="text-sm text-bolt-elements-textSecondary mb-6 text-center max-w-md">
          {t('previewPage.openFromBuilder')}
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all"
        >
          <div className="i-ph:arrow-left text-base" />
          {t('previewPage.backToBuilder')}
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-bolt-elements-bg-depth-1 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-bolt-elements-bg-depth-2 border-b border-bolt-elements-borderColor shrink-0">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
          <div className="i-ph:cube-duotone text-sm" />
          WebContainer
        </div>
        <div className="flex-1 flex items-center bg-bolt-elements-bg-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-1 text-xs text-bolt-elements-textSecondary truncate font-mono">
          {previewUrl}
        </div>
        <button
          onClick={() => {
            setLoaded(false);
            setError(false);
            const iframe = document.querySelector('iframe');
            if (iframe) iframe.src = iframe.src;
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-button-secondary-backgroundHover transition-all"
          title={t('previewPage.refreshPreview')}
        >
          <div className="i-ph:arrow-clockwise text-sm" />
        </button>
        <a
          href="/"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-button-secondary-backgroundHover transition-all"
          title={t('previewPage.backToBuilder')}
        >
          <div className="i-ph:arrow-left text-sm" />
          {t('previewPage.back')}
        </a>
      </div>

      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-bolt-elements-bg-depth-1 z-10">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-bolt-elements-borderColor" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="i-ph:eye text-xl text-bolt-elements-textTertiary" />
                </div>
              </div>
              <p className="text-sm font-medium text-bolt-elements-textSecondary">{t('preview.loadingPreview')}</p>
              <p className="text-xs text-bolt-elements-textTertiary mt-1">{t('previewPage.compilingWait')}</p>
              <div className="flex items-center justify-center gap-1 mt-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-bolt-elements-bg-depth-1 z-10">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <div className="i-ph:warning-circle text-3xl text-red-400" />
              </div>
              <p className="text-sm font-medium text-bolt-elements-textSecondary mb-1">{t('previewPage.loadFailed')}</p>
              <p className="text-xs text-bolt-elements-textTertiary mb-4">{t('previewPage.webcontainerExpired')}</p>
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
                  {t('previewPage.tryAgain')}
                </button>
                <a
                  href="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-bolt-elements-button-secondary-backgroundHover border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-all"
                >
                  {t('previewPage.backToBuilder')}
                </a>
              </div>
            </div>
          </div>
        )}

        <iframe
          src={previewUrl}
          className="w-full h-full border-0 bg-bolt-elements-bg-depth-1"
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
            background: 'var(--bolt-elements-bg-depth-1, #09090b)',
          }}
        />
      </div>
    </div>
  );
}

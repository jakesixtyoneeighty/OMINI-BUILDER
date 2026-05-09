import { useState } from 'react';
import { toast } from 'react-toastify';

interface CloneSiteProps {
  onClone: (url: string) => void | Promise<void>;
}

export function CloneSite({ onClone }: CloneSiteProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  function isValidUrl(str: string): boolean {
    try {
      const u = new URL(str.startsWith('http') ? str : `https://${str}`);
      return u.hostname.includes('.');
    } catch {
      return false;
    }
  }

  async function fetchScreenshot(siteUrl: string) {
    try {
      // Use a free screenshot API (thumbnail.ws or similar)
      const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
      // Use Google's PageSpeed screenshot API as fallback - it's free and reliable
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(normalizedUrl)}&strategy=mobile&category=performance`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        const screenshotData = data?.lighthouseResult?.audits?.['final-screenshot']?.details?.data;
        if (screenshotData) {
          setScreenshot(screenshotData);
          return;
        }
      }
      setScreenshot(null);
    } catch {
      setScreenshot(null);
    }
  }

  async function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;

    if (!isValidUrl(trimmed)) {
      toast.error('URL invalida. Use um formato como: example.com ou https://example.com');
      return;
    }

    setLoading(true);
    const normalizedUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;

    // Try to fetch screenshot
    await fetchScreenshot(normalizedUrl);

    try {
      await onClone(normalizedUrl);
      setOpen(false);
      setUrl('');
      setScreenshot(null);
    } catch (err) {
      toast.error(`Erro ao clonar site: ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
      >
        <div className="i-ph:globe text-lg" />
        Clonar Site
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[520px] max-w-[92vw] rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <div className="i-ph:globe text-xl text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-bolt-elements-textPrimary">Clonar Site</h2>
                  <p className="text-xs text-bolt-elements-textTertiary">Cole a URL do site que deseja clonar</p>
                </div>
              </div>
              <button
                onClick={() => !loading && setOpen(false)}
                className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
              >
                <div className="i-ph:x text-xl" />
              </button>
            </div>

            {/* Screenshot preview */}
            {screenshot && (
              <div className="px-6 pb-3">
                <div className="rounded-lg overflow-hidden border border-bolt-elements-borderColor/50">
                  <img
                    src={screenshot}
                    alt="Site preview"
                    className="w-full h-auto max-h-[200px] object-cover"
                  />
                </div>
              </div>
            )}

            {/* URL Input */}
            <div className="px-6 pb-4">
              <div className="relative">
                <div className="i-ph:globe absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-bolt-elements-textTertiary" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) handleSubmit();
                  }}
                  placeholder="https://example.com"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                />
              </div>
              <p className="text-[11px] text-bolt-elements-textTertiary mt-2 ml-1">
                A IA vai analisar o site e recriar o design e funcionalidades
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !url.trim()}
                className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <>
                    <div className="i-svg-spinners:90-ring-with-bg text-sm" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <div className="i-ph:copy text-sm" />
                    Clonar Site
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

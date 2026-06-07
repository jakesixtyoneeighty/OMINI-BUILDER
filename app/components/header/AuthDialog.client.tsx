import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useT } from '~/lib/i18n/useT';
import { signInWithGitHub, signInWithGoogle } from '~/lib/stores/auth';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
}

type OAuthProvider = 'github' | 'google';

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const [loading, setLoading] = useState<OAuthProvider | null>(null);
  const t = useT();

  useEffect(() => {
    if (!open) {
      setLoading(null);
      return;
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, loading, onClose]);

  if (!open) return null;

  async function handleProvider(provider: OAuthProvider) {
    setLoading(provider);
    try {
      if (provider === 'google') await signInWithGoogle();
      else await signInWithGitHub();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('auth.authFailed'));
      setLoading(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={() => !loading && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Ambient glow */}
      <div
        className="mojo-ambient-glow pointer-events-none absolute w-[280px] h-[280px] -top-10 left-1/2 -translate-x-1/2 opacity-60"
        aria-hidden
      />
      <div
        className="mojo-ambient-glow pointer-events-none absolute w-[200px] h-[200px] bottom-8 right-1/4 opacity-40"
        style={{ animationDelay: '2s' }}
        aria-hidden
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Gradient border */}
        <div
          className="absolute inset-0 rounded-2xl opacity-80"
          style={{
            background: 'linear-gradient(135deg, var(--mojo-sky, #4a90e2) 0%, var(--mojo-orange, #f16529) 55%, var(--mojo-blue, #1d4e89) 100%)',
          }}
          aria-hidden
        />

        <div className="relative m-[1px] rounded-2xl border border-bolt-elements-borderColor/40 bg-bolt-elements-background-depth-2 shadow-2xl shadow-black/40 overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="relative px-6 pt-6 pb-5 text-center border-b border-bolt-elements-borderColor/30">
            <button
              type="button"
              onClick={() => !loading && onClose()}
              disabled={!!loading}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all disabled:opacity-40"
              aria-label={t('auth.close')}
            >
              <div className="i-ph:x text-lg" />
            </button>

            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-mojo-blue/20 to-mojo-sky/10 border border-mojo-sky/20 mb-4 shadow-inner">
              <img
                src="/omini-favicon.png"
                alt="Mojo Builder"
                className="w-8 h-8"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            <h2 className="text-xl font-bold mojo-gradient-text tracking-tight">{t('auth.welcomeBack')}</h2>
            <p className="text-sm text-bolt-elements-textTertiary mt-2 max-w-[280px] mx-auto leading-relaxed">
              {t('auth.loginSubtitle')}
            </p>
          </div>

          {/* OAuth buttons */}
          <div className="px-6 py-6 space-y-3">
            <button
              type="button"
              onClick={() => handleProvider('github')}
              disabled={!!loading}
              className="mojo-interactive mojo-hover-lift group w-full flex items-center gap-3.5 h-12 px-4 rounded-xl text-sm font-semibold border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-3 text-bolt-elements-textPrimary hover:border-mojo-sky/40 hover:bg-bolt-elements-item-backgroundActive/30 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor/60 shrink-0 group-hover:border-mojo-sky/30 transition-colors">
                {loading === 'github' ? (
                  <div className="i-svg-spinners:90-ring-with-bg text-base text-mojo-sky" />
                ) : (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                )}
              </span>
              <span className="flex-1 text-left">
                {loading === 'github' ? t('auth.redirecting') : t('auth.continueWithGitHub')}
              </span>
              {loading !== 'github' && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-bolt-elements-textTertiary px-2 py-0.5 rounded-md bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-contentAccent border border-bolt-elements-item-contentAccent/15">
                  {t('auth.repoAccess')}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleProvider('google')}
              disabled={!!loading}
              className="mojo-interactive mojo-hover-lift group w-full flex items-center gap-3.5 h-12 px-4 rounded-xl text-sm font-semibold border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-3 text-bolt-elements-textPrimary hover:border-mojo-orange/35 hover:bg-bolt-elements-item-backgroundActive/30 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-bolt-elements-borderColor/40 shrink-0 shadow-sm">
                {loading === 'google' ? (
                  <div className="i-svg-spinners:90-ring-with-bg text-base text-mojo-orange" />
                ) : (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
              </span>
              <span className="flex-1 text-left">
                {loading === 'google' ? t('auth.redirecting') : t('auth.continueWithGoogle')}
              </span>
            </button>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-bolt-elements-borderColor/30 bg-bolt-elements-background-depth-1/40">
            <p className="text-[11px] text-center text-bolt-elements-textTertiary leading-relaxed">
              {t('auth.oauthNote')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

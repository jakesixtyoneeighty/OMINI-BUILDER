import { useState } from 'react';
import { toast } from 'react-toastify';
import { useT } from '~/lib/i18n/useT';
import { signInWithEmail, signInWithGitHub, signInWithGoogle, signUpWithEmail } from '~/lib/stores/auth';
import { BrandAsset } from '~/components/ui/BrandAsset';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const t = useT();

  if (!open) return null;

  async function handleEmail() {
    if (!email.trim() || !password.trim()) {
      toast.error(t('auth.emailPasswordRequired'));
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email.trim(), password);
        toast.success(t('auth.welcomeBackToast'));
        onClose();
      } else {
        await signUpWithEmail(email.trim(), password);
        toast.success(t('auth.accountCreated'));
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('auth.authFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleProvider(provider: 'google' | 'github') {
    setLoading(true);
    try {
      if (provider === 'google') await signInWithGoogle();
      else await signInWithGitHub();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('auth.authFailed'));
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => !loading && onClose()}>
      {/* Backdrop overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Content */}
      <div onClick={(e) => e.stopPropagation()} className="relative z-10 w-full max-w-md mx-4">
        {/* Close button */}
        <button
          onClick={() => !loading && onClose()}
          className="absolute -top-12 right-0 flex items-center justify-center w-8 h-8 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
        >
          <div className="i-ph:x text-lg" />
        </button>

        <div className="rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 backdrop-blur-xl shadow-2xl shadow-black/20 p-8 space-y-6">
          {/* Logo + Title */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/25">
              <BrandAsset src="/omini-favicon.html" title="Omini" className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-bolt-elements-textPrimary tracking-tight">
                {mode === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
              </h1>
              <p className="text-sm text-bolt-elements-textSecondary mt-1.5">
                {mode === 'login' ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
              </p>
            </div>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-2.5">
            <button
              onClick={() => handleProvider('github')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border border-bolt-elements-borderColor text-bolt-elements-textPrimary bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover hover:border-bolt-elements-borderColorActive transition-all duration-200 disabled:opacity-40"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              {t('auth.continueWithGitHub')}
            </button>
            <button
              onClick={() => handleProvider('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border border-bolt-elements-borderColor text-bolt-elements-textPrimary bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover hover:border-bolt-elements-borderColorActive transition-all duration-200 disabled:opacity-40"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t('auth.continueWithGoogle')}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-bolt-elements-borderColor to-transparent" />
            <span className="text-[11px] uppercase tracking-widest text-bolt-elements-textTertiary font-medium">
              {t('auth.or')}
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-bolt-elements-borderColor to-transparent" />
          </div>

          {/* Email form */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-bolt-elements-textSecondary uppercase tracking-wider">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl text-sm bg-bolt-elements-button-secondary-background border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-bolt-elements-borderColorActive focus:ring-1 focus:ring-bolt-elements-borderColorActive/25 transition-all duration-200 disabled:opacity-40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-bolt-elements-textSecondary uppercase tracking-wider">
                {t('auth.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmail()}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl text-sm bg-bolt-elements-button-secondary-background border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-bolt-elements-borderColorActive focus:ring-1 focus:ring-bolt-elements-borderColorActive/25 transition-all duration-200 disabled:opacity-40"
              />
            </div>
            <button
              onClick={handleEmail}
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-indigo-500 hover:shadow-purple-500/30 disabled:opacity-40 disabled:shadow-none transition-all duration-200 mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="i-svg-spinners:90-ring-with-bg text-base" />
                  {mode === 'login' ? t('auth.loggingIn') : t('auth.creatingAccount')}
                </span>
              ) : mode === 'login' ? (
                t('auth.loginButton')
              ) : (
                t('auth.signupButton')
              )}
            </button>
          </div>

          {/* Toggle mode */}
          <p className="text-center text-sm text-bolt-elements-textTertiary">
            {mode === 'login' ? (
              <>
                {t('auth.noAccount')}{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  {t('auth.signupButton')}
                </button>
              </>
            ) : (
              <>
                {t('auth.hasAccount')}{' '}
                <button
                  onClick={() => setMode('login')}
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  {t('auth.loginButton')}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { toast } from 'react-toastify';
import {
  signInWithEmail,
  signInWithGitHub,
  signInWithGoogle,
  signUpWithEmail,
} from '~/lib/stores/auth';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleEmail() {
    if (!email.trim() || !password.trim()) {
      toast.error('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email.trim(), password);
        toast.success('Welcome back!');
        onClose();
      } else {
        await signUpWithEmail(email.trim(), password);
        toast.success('Account created. Check your email to confirm.');
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Auth failed');
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
      toast.error(err instanceof Error ? err.message : 'Auth failed');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => !loading && onClose()}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] max-w-[92vw] rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">
            {mode === 'login' ? 'Sign in to Bolt' : 'Create your account'}
          </h2>
          <button onClick={onClose} className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary">
            <div className="i-ph:x text-lg" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => handleProvider('github')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm border border-bolt-elements-borderColor text-bolt-elements-textPrimary bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-item-backgroundActive disabled:opacity-50"
          >
            <div className="i-ph:github-logo text-base" />
            Continue with GitHub
          </button>
          <button
            onClick={() => handleProvider('google')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm border border-bolt-elements-borderColor text-bolt-elements-textPrimary bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-item-backgroundActive disabled:opacity-50"
          >
            <div className="i-ph:google-logo text-base" />
            Continue with Google
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-bolt-elements-borderColor" />
          <span className="text-[11px] uppercase text-bolt-elements-textTertiary">or</span>
          <div className="h-px flex-1 bg-bolt-elements-borderColor" />
        </div>

        <div className="space-y-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="w-full px-3 py-2 rounded text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:border-bolt-elements-item-contentAccent"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEmail()}
            placeholder="Password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full px-3 py-2 rounded text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:border-bolt-elements-item-contentAccent"
          />
          <button
            onClick={handleEmail}
            disabled={loading || !email.trim() || !password.trim()}
            className="w-full px-3 py-2 rounded text-sm bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border border-bolt-elements-item-contentAccent disabled:opacity-50"
          >
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </div>

        <div className="text-center text-[12px] text-bolt-elements-textTertiary">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button onClick={() => setMode('signup')} className="text-bolt-elements-item-contentAccent hover:underline">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-bolt-elements-item-contentAccent hover:underline">
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

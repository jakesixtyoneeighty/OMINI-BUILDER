import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { authStore, githubProviderTokenStore, initAuth, signOut, supabaseEnabled } from '~/lib/stores/auth';
import { AuthDialog } from './AuthDialog.client';

let initialized = false;

export function AuthButton() {
  const { user, initialized: authInit } = useStore(authStore);
  const ghToken = useStore(githubProviderTokenStore);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!initialized) {
      initialized = true;
      initAuth();
    }
  }, []);

  const label = user ? 'Account' : 'Sign in';

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (user) {
            setMenu((v) => !v);
            return;
          }
          setOpen(true);
        }}
        disabled={supabaseEnabled && !authInit}
        className="px-3 py-1.5 rounded-md text-sm bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border border-bolt-elements-item-contentAccent disabled:opacity-50"
      >
        {label}
      </button>
      <AuthDialog open={open} onClose={() => setOpen(false)} />
      {user && menu && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-lg z-[91] py-1 text-sm">
          <div className="px-3 py-2 border-b border-bolt-elements-borderColor">
            <div className="font-medium text-bolt-elements-textPrimary truncate">{user.user_metadata?.full_name || user.email || 'Account'}</div>
            <div className="text-[11px] text-bolt-elements-textTertiary truncate">{user.email}</div>
            {user.app_metadata?.provider && (
              <div className="text-[11px] text-bolt-elements-textTertiary mt-0.5 flex items-center gap-1">
                <div className={`text-xs ${user.app_metadata.provider === 'github' ? 'i-ph:github-logo' : 'i-ph:google-logo'}`} />
                via {user.app_metadata.provider}
                {user.app_metadata.provider === 'github' && ghToken && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent">repo access</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              setMenu(false);
              await signOut();
            }}
            className="w-full text-left px-3 py-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive flex items-center gap-2"
          >
            <div className="i-ph:sign-out text-base" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

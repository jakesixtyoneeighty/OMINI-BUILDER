import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { authStore, githubProviderTokenStore, initAuth, signOut, supabaseEnabled } from '~/lib/stores/auth';
import { AuthDialog } from './AuthDialog.client';
import { AccountSettingsDialog } from './AccountSettingsDialog.client';

let initialized = false;

export function AuthButton() {
  const { user, initialized: authInit } = useStore(authStore);
  const ghToken = useStore(githubProviderTokenStore);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);

  useEffect(() => {
    if (!initialized) {
      initialized = true;
      initAuth();
    }
  }, []);

  const userAvatar = user?.user_metadata?.avatar_url || '';
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const userEmail = user?.email || '';
  const displayName = userName || userEmail || 'Account';

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
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-all disabled:opacity-50"
      >
        {user && userAvatar ? (
          <img src={userAvatar} alt={displayName} className="w-5 h-5 rounded-full object-cover" />
        ) : user ? (
          <div className="w-5 h-5 rounded-full bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText flex items-center justify-center text-[10px] font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
        ) : null}
        <span>{user ? displayName : 'Sign in'}</span>
      </button>
      <AuthDialog open={open} onClose={() => setOpen(false)} />
      {user && menu && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-2xl z-[91] overflow-hidden">
          <div className="px-4 py-3 border-b border-bolt-elements-borderColor flex items-center gap-3">
            {userAvatar ? (
              <img src={userAvatar} alt={displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText flex items-center justify-center text-sm font-bold shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-medium text-sm text-bolt-elements-textPrimary truncate">{displayName}</div>
              <div className="text-[11px] text-bolt-elements-textTertiary truncate">{userEmail}</div>
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
          </div>
          <button
            onClick={() => {
              setMenu(false);
              setAccountSettingsOpen(true);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive flex items-center gap-2 transition-all"
          >
            <div className="i-ph:user-circle text-base" />
            Account Settings
          </button>
          <button
            onClick={async () => {
              setMenu(false);
              await signOut();
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive flex items-center gap-2 transition-all"
          >
            <div className="i-ph:sign-out text-base" />
            Sign out
          </button>
        </div>
      )}
      <AccountSettingsDialog open={accountSettingsOpen} onClose={() => setAccountSettingsOpen(false)} />
    </div>
  );
}

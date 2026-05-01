import { useStore } from '@nanostores/react';
import { useState, useRef, useCallback } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { AuthButton } from './AuthButton.client';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { SettingsDialog } from './SettingsDialog.client';
import { AppSettingsDialog } from './AppSettingsDialog.client';
import { GitHubPush } from '~/components/chat/GitHubPush.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { SaveProjectButton } from './SaveProjectButton.client';

export function Header() {
  const chat = useStore(chatStore);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'preview' | 'deploy' | 'env' | 'versions'>('general');
  const appSettingsRef = useRef<{ setTab: (t: string) => void } | null>(null);

  const openDeploy = useCallback(() => {
    setSettingsTab('deploy');
    setAppSettingsOpen(true);
  }, []);

  return (
    <header className="flex items-center justify-between bg-bolt-elements-background-depth-1 p-5 border-b h-[var(--header-height)] border-bolt-elements-borderColor">
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <div className="i-ph:sidebar-simple-duotone text-xl" />
        <a href="/" className="text-2xl font-semibold text-accent flex items-center">
          <span className="i-bolt:logo-text?mask w-[180px] inline-block" />
        </a>
      </div>
      <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
        <ClientOnly>{() => <ChatDescription />}</ClientOnly>
      </span>
      <div className="flex items-center gap-2 shrink-0 relative z-[50]">
        <ClientOnly>
          {() => (
            <>
              {chat.started && (
                <>
                  <button onClick={openDeploy} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-teal-600 text-white hover:bg-teal-700 text-xs font-medium shadow-sm">
                    <div className="i-ph:rocket-launch-duotone" /> Deploy
                  </button>
                  <SaveProjectButton />
                  <GitHubPush />
                  <button onClick={() => { setSettingsTab('general'); setAppSettingsOpen(true); }} className="flex items-center justify-center w-8 h-8 rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor transition-theme">
                    <div className="i-ph:sliders-horizontal text-base" />
                  </button>
                  <AppSettingsDialog open={appSettingsOpen} onClose={() => setAppSettingsOpen(false)} defaultTab={settingsTab} />
                </>
              )}
              <SettingsDialog />
              <AuthButton />
              <HeaderActionButtons />
            </>
          )}
        </ClientOnly>
      </div>
    </header>
  );
}

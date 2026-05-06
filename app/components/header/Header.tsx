import { useStore } from '@nanostores/react';
import { useState, useCallback } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { AuthButton } from './AuthButton.client';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { SettingsDialog } from './SettingsDialog.client';
import { AppSettingsDialog } from './AppSettingsDialog.client';
import { DeployButton } from './DeployButton.client';
import { GitHubPush } from '~/components/chat/GitHubPush.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { SaveProjectButton } from './SaveProjectButton.client';
import { SaveToDrive } from '~/components/chat/SaveToDrive.client';
import { PublishToGalleryButton } from './PublishToGalleryButton.client';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';

export function Header() {
  const chat = useStore(chatStore);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'preview' | 'deploy' | 'env' | 'versions'>('general');

  const openDeploySettings = useCallback(() => {
    setSettingsTab('deploy');
    setAppSettingsOpen(true);
  }, []);

  const openGeneralSettings = useCallback(() => {
    setSettingsTab('general');
    setAppSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setAppSettingsOpen(false);
  }, []);

  return (
    <header className="flex items-center justify-between bg-bolt-elements-background-depth-1 px-4 py-1.5 border-b h-[var(--header-height)] border-bolt-elements-borderColor">
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <a href="/" className="flex items-center">
          <img src="/omni-builder-logo.svg" alt="Omni-Builder" className="h-8 omni-logo-themed" />
        </a>
        <a
          href="/gallery"
          className="ml-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-bolt-elements-button-secondary-background text-bolt-elements-textSecondary border border-bolt-elements-borderColor hover:bg-bolt-elements-button-secondary-backgroundHover hover:text-bolt-elements-textPrimary transition-all"
        >
          <div className="i-ph:storefront-duotone text-xs" />
          Gallery
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
                  {/* Save buttons: Cloud (Supabase) + Google Drive */}
                  <ClientOnly>{() => <SaveProjectButton />}</ClientOnly>
                  <ClientOnly>{() => <SaveToDrive />}</ClientOnly>
                  <ClientOnly>{() => <PublishToGalleryButton />}</ClientOnly>
                  <ClientOnly>{() => <DeployButton onOpenSettings={openDeploySettings} />}</ClientOnly>
                  <ClientOnly>{() => <ThemeSwitch />}</ClientOnly>
                  <ClientOnly>{() => <GitHubPush />}</ClientOnly>
                  <button onClick={openGeneralSettings} className="flex items-center justify-center w-8 h-8 rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor transition-theme">
                    <div className="i-ph:sliders-horizontal text-base" />
                  </button>
                  <AppSettingsDialog open={appSettingsOpen} onClose={closeSettings} defaultTab={settingsTab} />
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

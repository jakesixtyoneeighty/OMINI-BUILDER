import { useStore } from '@nanostores/react';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { themeStore, toggleTheme } from '~/lib/stores/theme';
import { AuthButton } from './AuthButton.client';
import { SettingsDialog } from './SettingsDialog.client';
import { AppSettingsDialog } from './AppSettingsDialog.client';
import { DeployButton } from './DeployButton.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { SaveProjectButton } from './SaveProjectButton.client';
import { SaveToDrive } from '~/components/chat/SaveToDrive.client';
import { PublishToGalleryButton } from './PublishToGalleryButton.client';
import { GitHubPush } from '~/components/chat/GitHubPush.client';
import { classNames } from '~/utils/classNames';

type TabType = 'chat' | 'code' | 'preview';

export function Header() {
  const chat = useStore(chatStore);
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  const selectedView = useStore(workbenchStore.currentView);
  const previews = useStore(workbenchStore.previews);

  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'preview' | 'deploy' | 'env' | 'versions'>('general');
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Determine active tab
  const activeTab: TabType = useMemo(() => {
    if (!showWorkbench && showChat) return 'chat';
    if (showWorkbench && selectedView === 'code') return 'code';
    if (showWorkbench && selectedView === 'preview') return 'preview';
    return 'chat';
  }, [showWorkbench, showChat, selectedView]);

  const setActiveTab = useCallback((tab: TabType) => {
    switch (tab) {
      case 'chat':
        chatStore.setKey('showChat', true);
        workbenchStore.showWorkbench.set(false);
        break;
      case 'code':
        workbenchStore.showWorkbench.set(true);
        workbenchStore.currentView.set('code');
        chatStore.setKey('showChat', true);
        break;
      case 'preview':
        workbenchStore.showWorkbench.set(true);
        workbenchStore.currentView.set('preview');
        chatStore.setKey('showChat', true);
        break;
    }
  }, []);

  const openDeploySettings = useCallback(() => {
    setSettingsTab('deploy');
    setAppSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setAppSettingsOpen(false);
  }, []);

  // Close more menu on outside click
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreMenuOpen]);

  // Preview URL for address bar
  const previewUrl = previews.length > 0 ? previews[0].baseUrl : '';

  return (
    <header className="flex items-center h-[var(--header-height)] bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor select-none">
      {/* LEFT: Logo */}
      <div className="flex items-center gap-2 px-3 shrink-0">
        <a href="/" className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all" title="Home">
          <img src="/omni-builder-logo.svg" alt="Omni-Builder" className="h-5 w-5 omni-logo-themed" />
        </a>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-bolt-elements-borderColor" />

      {/* Tab Navigation */}
      <div className="flex items-center h-full px-1">
        <TabButton
          active={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
          icon="i-bolt:chat"
          label="Chat"
        />
        <TabButton
          active={activeTab === 'code'}
          onClick={() => setActiveTab('code')}
          icon="i-ph:code-bold"
          label="Code"
        />
        <TabButton
          active={activeTab === 'preview'}
          onClick={() => setActiveTab('preview')}
          icon="i-ph:browser"
          label="Preview"
        />
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-bolt-elements-borderColor" />

      {/* CENTER: URL bar (when preview is active) or chat description */}
      <div className="flex-1 flex items-center justify-center px-3 min-w-0">
        {activeTab === 'preview' && previewUrl ? (
          <div className="flex items-center gap-1.5 w-full max-w-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg px-2.5 py-1">
            <button className="flex items-center justify-center w-5 h-5 rounded text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all shrink-0" title="Back">
              <div className="i-ph:caret-left text-xs" />
            </button>
            <button className="flex items-center justify-center w-5 h-5 rounded text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all shrink-0" title="Forward">
              <div className="i-ph:caret-right text-xs" />
            </button>
            <button className="flex items-center justify-center w-5 h-5 rounded text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all shrink-0" title="Refresh">
              <div className="i-ph:arrow-clockwise text-[10px]" />
            </button>
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <div className="i-ph:lock-simple-fill text-[9px] text-emerald-400 shrink-0" />
              <span className="text-[11px] text-bolt-elements-textSecondary truncate">{previewUrl.replace(/^https?:\/\//, '')}</span>
            </div>
            <button className="flex items-center justify-center w-5 h-5 rounded text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all shrink-0" title="Open in new tab">
              <div className="i-ph:arrow-square-out text-[10px]" />
            </button>
          </div>
        ) : (
          <span className="truncate text-sm text-bolt-elements-textSecondary max-w-md">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
        )}
      </div>

      {/* RIGHT: Action buttons */}
      <div className="flex items-center gap-1 px-2 shrink-0 relative z-[50]">
        <ClientOnly>
          {() => (
            <>
              {chat.started && (
                <>
                  {/* Deploy button */}
                  <DeployButton onOpenSettings={openDeploySettings} />

                  {/* Publish / Share */}
                  <ClientOnly>{() => <PublishToGalleryButton />}</ClientOnly>
                </>
              )}

              {/* More menu (⋮) */}
              <div ref={moreRef} className="relative">
                <button
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
                  title="More"
                >
                  <div className="i-ph:dots-three-vertical text-base" />
                </button>

                {moreMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-[100] overflow-hidden">
                    {/* Save options */}
                    {chat.started && (
                      <div className="p-1 border-b border-bolt-elements-borderColor">
                        <ClientOnly>{() => <SaveProjectButton />}</ClientOnly>
                        <ClientOnly>{() => <SaveToDrive />}</ClientOnly>
                      </div>
                    )}

                    {/* Actions */}
                    {chat.started && (
                      <div className="p-1 border-b border-bolt-elements-borderColor">
                        <ClientOnly>{() => <GitHubPush />}</ClientOnly>
                      </div>
                    )}

                    {/* Settings & Theme */}
                    <div className="p-1">
                      <button
                        onClick={() => { toggleTheme(); setMoreMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                      >
                        <div className={themeStore.get() === 'dark' ? 'i-ph:sun-dim-duotone text-base text-amber-400' : 'i-ph:moon-stars-duotone text-base text-indigo-400'} />
                        <span>{themeStore.get() === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                      </button>
                      <button
                        onClick={() => { setSettingsDialogOpen(true); setMoreMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                      >
                        <div className="i-ph:gear-six text-base" />
                        <span>API Keys & Settings</span>
                      </button>
                      <button
                        onClick={() => { setSettingsTab('general'); setAppSettingsOpen(true); setMoreMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                      >
                        <div className="i-ph:sliders-horizontal text-base" />
                        <span>Project Settings</span>
                      </button>
                      <a
                        href="/gallery"
                        onClick={() => setMoreMenuOpen(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                      >
                        <div className="i-ph:storefront text-base" />
                        <span>Gallery</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <SettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />
              <AppSettingsDialog open={appSettingsOpen} onClose={closeSettings} defaultTab={settingsTab} />
              <AuthButton />
            </>
          )}
        </ClientOnly>
      </div>
    </header>
  );
}

/* ===== Tab Button ===== */
function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'relative flex items-center gap-1.5 px-3 h-full text-xs font-medium transition-all',
        active
          ? 'text-bolt-elements-textPrimary'
          : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary',
      )}
    >
      <div className={icon + ' text-sm'} />
      <span className="hidden sm:inline">{label}</span>
      {/* Active indicator bar */}
      {active && (
        <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#818cf8] rounded-t-full" />
      )}
    </button>
  );
}

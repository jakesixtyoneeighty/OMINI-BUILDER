import { useStore } from '@nanostores/react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { themeStore, toggleTheme } from '~/lib/stores/theme';
import { AuthButton } from './AuthButton.client';
import { SettingsDialog } from './SettingsDialog.client';
import { AppSettingsDialog } from './AppSettingsDialog.client';
import { DeployButton } from './DeployButton.client';
import { EditableProjectName } from './EditableProjectName.client';
import { SaveProjectButton } from './SaveProjectButton.client';
import { SaveToDrive } from '~/components/chat/SaveToDrive.client';
import { PublishToGalleryButton } from './PublishToGalleryButton.client';
import { GitHubPush } from '~/components/chat/GitHubPush.client';
import { SearchDialog } from './SearchDialog.client';
import { ModelPicker } from './ModelPicker.client';
import { languageStore, type AppLanguage, LANGUAGE_FLAGS, LANGUAGE_NAMES } from '~/lib/stores/language';
import { classNames } from '~/utils/classNames';

export function Header() {
  const chat = useStore(chatStore);

  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'preview' | 'deploy' | 'env' | 'versions'>('general');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Global Ctrl+K shortcut to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
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

  // If chat hasn't started, show the homepage header
  if (!chat.started) {
    return (
      <>
        <HomepageHeader onSearchOpen={() => setSearchOpen(true)} />
        <ClientOnly>{() => <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />}</ClientOnly>
      </>
    );
  }

  return (
    <header className="flex items-center h-[var(--header-height)] bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor select-none">
      {/* LEFT: Logo */}
      <div className="flex items-center gap-2 px-3 shrink-0">
        <a href="/" className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all" title="Home">
          <img src="/omni-builder-logo.svg" alt="Omni-Builder" className="h-8 w-8 omni-logo-themed" />
        </a>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-bolt-elements-borderColor" />

      {/* Model Picker */}
      <ClientOnly>{() => <ModelPicker />}</ClientOnly>

      {/* Separator */}
      <div className="w-px h-5 bg-bolt-elements-borderColor" />

      {/* CENTER: Editable project name */}
      <div className="flex-1 flex items-center justify-center px-3 min-w-0">
        <ClientOnly>{() => <EditableProjectName />}</ClientOnly>
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
                        onClick={() => { setAppSettingsOpen(true); setMoreMenuOpen(false); }}
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

              <ClientOnly>{() => <SettingsDialog isStreaming={chat.started} />}</ClientOnly>
              <AppSettingsDialog open={appSettingsOpen} onClose={closeSettings} defaultTab={settingsTab} />
              <AuthButton />
            </>
          )}
        </ClientOnly>
      </div>
      <ClientOnly>{() => <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />}</ClientOnly>
    </header>
  );
}

/* ===== Homepage Header ===== */
function HomepageHeader({ onSearchOpen }: { onSearchOpen: () => void }) {
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const currentLang = useStore(languageStore);
  const resourcesRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resourcesOpen) return;
    const handler = (e: MouseEvent) => {
      if (resourcesRef.current && !resourcesRef.current.contains(e.target as Node)) {
        setResourcesOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [resourcesOpen]);

  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [langOpen]);

  return (
    <header className="flex items-center h-[var(--header-height)] bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor select-none">
      {/* LEFT: Logo */}
      <div className="flex items-center gap-2.5 px-4 shrink-0">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/omni-builder-logo.svg" alt="Omni-Builder" className="h-9 w-9 omni-logo-themed" />
          <span className="text-base font-bold text-bolt-elements-textPrimary">Omni Builder</span>
        </a>
      </div>

      {/* CENTER: Search bar */}
      <div className="flex-1 flex items-center justify-center px-4 max-w-xl mx-auto">
        <button
          onClick={onSearchOpen}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive transition-all cursor-text text-left"
        >
          <div className="i-ph:magnifying-glass text-sm text-bolt-elements-textTertiary" />
          <span className="text-sm text-bolt-elements-textTertiary">Search projects...</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* RIGHT: Navigation links */}
      <div className="flex items-center gap-1 px-4 shrink-0">
        <a
          href="https://discord.gg/stackblitz"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center px-3 py-1.5 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
        >
          Community
        </a>

        {/* Language selector */}
        <div ref={langRef} className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
          >
            <span>{LANGUAGE_FLAGS[currentLang]}</span>
            <span className="hidden lg:inline">{LANGUAGE_NAMES[currentLang]}</span>
            <div className={`i-ph:caret-down text-[10px] transition-transform duration-150 ${langOpen ? 'rotate-180' : ''}`} />
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-[100] overflow-hidden p-1">
              {(['pt', 'en', 'es', 'zh'] as AppLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    languageStore.set(lang);
                    setLangOpen(false);
                  }}
                  className={classNames(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left',
                    currentLang === lang
                      ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-item-contentAccent'
                      : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary',
                  )}
                >
                  <span className="text-base">{LANGUAGE_FLAGS[lang]}</span>
                  <span className="font-medium">{LANGUAGE_NAMES[lang]}</span>
                  {currentLang === lang && (
                    <div className="i-ph:check-bold text-xs ml-auto text-bolt-elements-item-contentAccent" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <a
          href="#"
          className="hidden md:flex items-center px-3 py-1.5 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
        >
          Enterprise
        </a>
        <div ref={resourcesRef} className="relative hidden md:block">
          <button
            onClick={() => setResourcesOpen(!resourcesOpen)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
          >
            Resources
            <div className={`i-ph:caret-down text-[10px] transition-transform duration-150 ${resourcesOpen ? 'rotate-180' : ''}`} />
          </button>
          {resourcesOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-[100] overflow-hidden p-1">
              <a
                href="/gallery"
                onClick={() => setResourcesOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
              >
                <div className="i-ph:storefront text-base" />
                Gallery
              </a>
              <a
                href="https://github.com/stackblitz/bolt.new"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setResourcesOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
              >
                <div className="i-ph:book-open-text text-base" />
                Documentation
              </a>
              <a
                href="https://github.com/stackblitz/bolt.new"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setResourcesOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
              >
                <div className="i-ph:github-logo text-base" />
                GitHub
              </a>
            </div>
          )}
        </div>

        <ClientOnly>{() => <AuthButton />}</ClientOnly>
      </div>
    </header>
  );
}

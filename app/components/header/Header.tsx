import { useStore } from '@nanostores/react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { themeStore, toggleTheme } from '~/lib/stores/theme';
import { AuthButton } from './AuthButton.client';
import { SettingsDialog } from './SettingsDialog.client';
import { openSettingsPanel, type SettingsTab } from '~/lib/stores/layout';
import { DeployButton } from './DeployButton.client';
import { ShareButton } from './ShareButton.client';
import { EditableProjectName } from './EditableProjectName.client';
import { SaveProjectButton } from './SaveProjectButton.client';
import { SaveToDrive } from '~/components/chat/SaveToDrive.client';
import { PublishToGalleryButton } from './PublishToGalleryButton.client';
import { GitHubPush } from '~/components/chat/GitHubPush.client';
import { SearchDialog } from './SearchDialog.client';
import { ModelPicker } from './ModelPicker.client';
import { languageStore, type AppLanguage, LANGUAGE_FLAGS, LANGUAGE_NAMES } from '~/lib/stores/language';
import { useT } from '~/lib/i18n/useT';
import { classNames } from '~/utils/classNames';
import { BrandAsset } from '~/components/ui/BrandAsset';

export function Header() {
  const chat = useStore(chatStore);
  const t = useT();
  const currentLang = useStore(languageStore);

  const openProjectSettings = useCallback((tab?: SettingsTab) => {
    openSettingsPanel(tab);
  }, []);
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
    openSettingsPanel('deploy');
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
    <header className="flex items-center h-[var(--header-height)] bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor/30 select-none">
      {/* LEFT: Logo */}
      <div className="flex items-center px-2 sm:px-4 shrink-0">
        <a
          href="/"
          className="flex items-center rounded-lg px-1 py-1.5 hover:bg-bolt-elements-item-backgroundActive/30 transition-all duration-200"
          title="Home"
        >
          <BrandAsset src="/omini-logo.html" title="Omini" className="h-8 sm:h-10 w-[100px] sm:w-[190px] max-w-full omni-logo-themed" />
        </a>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-bolt-elements-borderColor/20 hidden sm:block mx-2" />

      {/* Model Picker - visible on all screens */}
      <div className="shrink-0">
        <ClientOnly>{() => <ModelPicker />}</ClientOnly>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-bolt-elements-borderColor/20 hidden sm:block mx-2" />

      {/* CENTER: Editable project name */}
      <div className="flex-1 hidden sm:flex items-center justify-center px-3 min-w-0">
        <ClientOnly>{() => <EditableProjectName />}</ClientOnly>
      </div>

      {/* RIGHT: Action buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 shrink-0 relative z-[50]">
        <ClientOnly>
          {() => (
            <>
              {chat.started && (
                <>
                  {/* Save button */}
                  <div className="hidden sm:block">
                    <ClientOnly>{() => <SaveProjectButton />}</ClientOnly>
                  </div>

                  {/* Deploy button */}
                  <div className="hidden sm:block">
                    <DeployButton onOpenSettings={openDeploySettings} />
                  </div>

                  {/* Share button */}
                  <div className="hidden sm:block">
                    <ShareButton onOpenSettings={openDeploySettings} />
                  </div>

                  {/* Publish / Gallery */}
                  <ClientOnly>{() => <PublishToGalleryButton />}</ClientOnly>
                </>
              )}

              {/* More menu (⋮) */}
              <div ref={moreRef} className="relative">
                <button
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all duration-200"
                  title="More"
                >
                  <div className="i-ph:dots-three-vertical text-lg" />
                </button>

                {moreMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor/30 rounded-xl shadow-xl z-[100] overflow-hidden">
                    {/* Save options (mobile only - on desktop save is already visible) */}
                    {chat.started && (
                      <div className="p-1.5 border-b border-bolt-elements-borderColor/20 sm:hidden">
                        <ClientOnly>{() => <SaveProjectButton />}</ClientOnly>
                      </div>
                    )}

                    {/* Actions */}
                    {chat.started && (
                      <div className="p-1.5 border-b border-bolt-elements-borderColor/20">
                        <ClientOnly>{() => <SaveToDrive />}</ClientOnly>
                        <ClientOnly>{() => <GitHubPush />}</ClientOnly>
                      </div>
                    )}

                    {/* Settings & Theme */}
                    <div className="p-1.5">
                      <button
                        onClick={() => {
                          toggleTheme();
                          setMoreMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all text-left"
                      >
                        <div
                          className={
                            themeStore.get() === 'dark'
                              ? 'i-ph:sun-dim-duotone text-base text-amber-400'
                              : 'i-ph:moon-stars-duotone text-base text-indigo-400'
                          }
                        />
                        <span>{themeStore.get() === 'dark' ? t('header.lightMode') : t('header.darkMode')}</span>
                      </button>

                      {/* Language sub-menu */}
                      <div className="relative group/lang">
                        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all text-left">
                          <span className="text-base">{LANGUAGE_FLAGS[currentLang]}</span>
                          <span>{LANGUAGE_NAMES[currentLang]}</span>
                          <div className="i-ph:caret-right text-[10px] ml-auto" />
                        </button>
                        <div className="absolute left-full top-0 ml-1 w-40 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor/30 rounded-xl shadow-xl z-[110] overflow-hidden p-1.5 opacity-0 invisible group-hover/lang:opacity-100 group-hover/lang:visible transition-all">
                          {(['pt', 'en', 'es', 'zh'] as AppLanguage[]).map((lang) => (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => {
                                languageStore.set(lang);
                                setMoreMenuOpen(false);
                              }}
                              className={classNames(
                                'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all text-left',
                                currentLang === lang
                                  ? 'bg-bolt-elements-item-backgroundActive/50 text-bolt-elements-item-contentAccent'
                                  : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/50 hover:text-bolt-elements-textPrimary',
                              )}
                            >
                              <span className="text-sm">{LANGUAGE_FLAGS[lang]}</span>
                              <span className="font-medium">{LANGUAGE_NAMES[lang]}</span>
                              {currentLang === lang && (
                                <div className="i-ph:check-bold text-[10px] ml-auto text-bolt-elements-item-contentAccent" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('open-api-settings'));
                          setMoreMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                      >
                        <div className="i-ph:gear-six text-base" />
                        <span>{t('header.apiKeysSettings')}</span>
                      </button>
                      <div className="border-t border-bolt-elements-borderColor/20 my-1.5" />
                      <button
                        onClick={() => {
                          openProjectSettings('general');
                          setMoreMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all text-left"
                      >
                        <div className="i-ph:folder-open text-base" />
                        <span>{t('header.projectSettings')}</span>
                      </button>
                      <a
                        href="/gallery"
                        onClick={() => setMoreMenuOpen(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all text-left"
                      >
                        <div className="i-ph:storefront text-base" />
                        <span>{t('header.gallery')}</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <ClientOnly>{() => <SettingsDialog />}</ClientOnly>
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const currentLang = useStore(languageStore);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const resourcesRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const t = useT();

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileMenuOpen]);

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
      {/* LEFT: Logo on mobile, spacing on desktop */}
      <div className="flex items-center pl-3 sm:pl-4 shrink-0">
        <a
          href="/"
          className="flex items-center rounded-lg px-1 py-1 hover:bg-bolt-elements-item-backgroundActive/30 transition-all duration-200"
          title="Home"
        >
          <BrandAsset src="/omini-logo.html" title="Omini" className="h-8 sm:h-10 w-[100px] sm:w-[190px] max-w-full omni-logo-themed" />
        </a>
      </div>

      {/* CENTER: Search bar + Model Picker - desktop only search, mobile just model picker */}
      <div className="flex-1 flex items-center justify-center px-2 sm:px-4 max-w-3xl mx-auto gap-2">
        {/* Search - hidden on mobile, shown on sm+ */}
        <button
          onClick={onSearchOpen}
          className="hidden sm:flex flex-1 items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor/30 hover:border-bolt-elements-borderColor/50 transition-all duration-200 cursor-text text-left min-w-0"
        >
          <div className="i-ph:magnifying-glass text-base text-bolt-elements-textTertiary shrink-0" />
          <span className="text-sm text-bolt-elements-textTertiary truncate">{t('search.placeholder')}</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded text-xs font-mono text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor/30 shrink-0">
            Ctrl+K
          </kbd>
        </button>
        <div className="shrink-0">
          <ClientOnly>{() => <ModelPicker />}</ClientOnly>
        </div>
      </div>

      {/* RIGHT: Desktop navigation links */}
      <div className="hidden md:flex items-center gap-1 px-4 shrink-0">
        {/* API Settings button */}
        <ClientOnly>{() => <SettingsDialog />}</ClientOnly>

        {/* Docs link */}
        <a
          href="/docs"
          className="hidden lg:flex items-center px-3 py-1.5 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
        >
          <div className="i-ph:book-open-text text-sm mr-1.5" />
          {t('header.documentation')}
        </a>

        {/* Language selector */}
        <div ref={langRef} className="relative hidden lg:block">
          <button
            type="button"
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
          >
            <span>{LANGUAGE_FLAGS[currentLang]}</span>
            <span className="hidden xl:inline">{LANGUAGE_NAMES[currentLang]}</span>
            <div
              className={`i-ph:caret-down text-[10px] transition-transform duration-150 ${langOpen ? 'rotate-180' : ''}`}
            />
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

        <div ref={resourcesRef} className="relative hidden lg:block">
          <button
            onClick={() => setResourcesOpen(!resourcesOpen)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
          >
            {t('header.resources')}
            <div
              className={`i-ph:caret-down text-[10px] transition-transform duration-150 ${resourcesOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {resourcesOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-[100] overflow-hidden p-1">
              <a
                href="/gallery"
                onClick={() => setResourcesOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
              >
                <div className="i-ph:storefront text-base" />
                {t('header.gallery')}
              </a>
              <a
                href="/docs"
                onClick={() => setResourcesOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
              >
                <div className="i-ph:book-open-text text-base" />
                {t('header.documentation')}
              </a>
            </div>
          )}
        </div>

        <ClientOnly>{() => <AuthButton />}</ClientOnly>
      </div>

      {/* RIGHT: Mobile hamburger menu */}
      <div className="flex md:hidden items-center gap-1 pr-2 shrink-0">
        {/* Search icon on mobile */}
        <button
          onClick={onSearchOpen}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all"
          title="Search"
        >
          <div className="i-ph:magnifying-glass text-lg" />
        </button>

        <ClientOnly>{() => <SettingsDialog />}</ClientOnly>

        {/* Mobile menu */}
        <div ref={mobileMenuRef} className="relative">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all"
            title="Menu"
          >
            <div className="i-ph:list text-lg" />
          </button>

          {mobileMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor/30 rounded-xl shadow-xl z-[100] overflow-hidden">
              {/* Theme toggle */}
              <div className="p-1.5">
                <button
                  onClick={() => {
                    toggleTheme();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all text-left"
                >
                  <div
                    className={
                      themeStore.get() === 'dark'
                        ? 'i-ph:sun-dim-duotone text-lg text-amber-400'
                        : 'i-ph:moon-stars-duotone text-lg text-indigo-400'
                    }
                  />
                  <span>{themeStore.get() === 'dark' ? t('header.lightMode') : t('header.darkMode')}</span>
                </button>
              </div>

              <div className="border-t border-bolt-elements-borderColor/20" />

              {/* Language */}
              <div className="p-1.5">
                <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-bolt-elements-textTertiary font-semibold">{t('header.language') || 'Language'}</p>
                {(['pt', 'en', 'es', 'zh'] as AppLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      languageStore.set(lang);
                      setMobileMenuOpen(false);
                    }}
                    className={classNames(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left',
                      currentLang === lang
                        ? 'bg-bolt-elements-item-backgroundActive/50 text-bolt-elements-item-contentAccent'
                        : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/50 hover:text-bolt-elements-textPrimary',
                    )}
                  >
                    <span>{LANGUAGE_FLAGS[lang]}</span>
                    <span className="font-medium">{LANGUAGE_NAMES[lang]}</span>
                    {currentLang === lang && (
                      <div className="i-ph:check-bold text-xs ml-auto text-bolt-elements-item-contentAccent" />
                    )}
                  </button>
                ))}
              </div>

              <div className="border-t border-bolt-elements-borderColor/20" />

              {/* Links */}
              <div className="p-1.5">
                <a
                  href="/gallery"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all"
                >
                  <div className="i-ph:storefront text-base" />
                  {t('header.gallery')}
                </a>
                <a
                  href="/docs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all"
                >
                  <div className="i-ph:book-open-text text-base" />
                  {t('header.documentation')}
                </a>
              </div>

              <div className="border-t border-bolt-elements-borderColor/20" />

              {/* Auth */}
              <div className="p-1.5 flex items-center">
                <ClientOnly>{() => <AuthButton />}</ClientOnly>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

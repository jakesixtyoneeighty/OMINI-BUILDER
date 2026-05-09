import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { themeStore, toggleTheme } from '~/lib/stores/theme';
import { workbenchStore } from '~/lib/stores/workbench';
import { authStore, supabaseEnabled, githubProviderTokenStore } from '~/lib/stores/auth';
import { autosaveDbEnabled, toggleAutosaveDb } from '~/lib/stores/auto-save';
import { autosaveDriveEnabled, toggleAutosaveDrive } from '~/lib/stores/drive';
import { projectsStore, activeProjectIdStore, updateActiveProjectSettings, getActiveProject } from '~/lib/stores/project';
import { useT } from '~/lib/i18n/useT';

interface HeaderMoreMenuProps {
  onOpenSettings: (tab: string) => void;
  onSaveProject: () => void;
  onSaveToDrive: () => void;
  onGitHubPush: () => void;
  onPublish: () => void;
}

export function HeaderMoreMenu({ onOpenSettings, onSaveProject, onSaveToDrive, onGitHubPush, onPublish }: HeaderMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const theme = useStore(themeStore);
  const { user } = useStore(authStore);
  const ghToken = useStore(githubProviderTokenStore);
  const autoSaveOn = useStore(autosaveDbEnabled);
  const autoSaveDriveOn = useStore(autosaveDriveEnabled);
  const chat = useStore(chatStore);
  const t = useT();

  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const isActive = !!(activeId && activeId !== 'default');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleAction = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
        title={t('headerMore.moreActions')}
      >
        <div className="i-ph:dots-three-vertical text-base" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Save section */}
          {chat.started && (
            <>
              <div className="px-3 py-2 border-b border-bolt-elements-borderColor">
                <span className="text-[10px] font-semibold text-bolt-elements-textTertiary uppercase tracking-wider">{t('headerMore.save')}</span>
              </div>
              <div className="p-1">
                {isActive && (
                  <button
                    onClick={() => handleAction(onSaveProject)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                  >
                    <div className="i-ph:cloud-arrow-up text-base text-emerald-400" />
                    <span className="flex-1">{t('saveProject.saveToCloud')}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleAutosaveDb(); }}
                        className={`flex items-center justify-center w-5 h-5 rounded transition-all ${
                          autoSaveOn && user ? 'text-emerald-400 bg-emerald-500/15' : 'text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1'
                        }`}
                        title={autoSaveOn && user ? t('saveProject.autoSaveOn') : t('saveProject.autoSaveOff')}
                      >
                        <div className={`text-[10px] ${autoSaveOn && user ? 'i-ph:check-bold' : 'i-ph:x-bold'}`} />
                      </button>
                    </div>
                  </button>
                )}
                {supabaseEnabled && (
                  <button
                    onClick={() => handleAction(onSaveToDrive)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                  >
                    <div className="i-ph:google-drive-logo text-base text-blue-400" />
                    <span className="flex-1">{t('headerMore.saveToDrive')}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleAutosaveDrive(); }}
                      className={`flex items-center justify-center w-5 h-5 rounded transition-all ${
                        autoSaveDriveOn ? 'text-green-400 bg-green-500/15' : 'text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1'
                      }`}
                      title={autoSaveDriveOn ? t('headerMore.autoSaveDriveOn') : t('headerMore.autoSaveDriveOff')}
                    >
                      <div className={`text-[10px] ${autoSaveDriveOn ? 'i-ph:check-bold' : 'i-ph:x-bold'}`} />
                    </button>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Share section */}
          {chat.started && (
            <>
              <div className="px-3 py-2 border-b border-bolt-elements-borderColor border-t border-bolt-elements-borderColor">
                <span className="text-[10px] font-semibold text-bolt-elements-textTertiary uppercase tracking-wider">{t('headerMore.share')}</span>
              </div>
              <div className="p-1">
                <button
                  onClick={() => handleAction(onPublish)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                >
                  <div className="i-ph:storefront-duotone text-base text-purple-400" />
                  <span>{t('publishToGallery.publish')}</span>
                </button>
                <button
                  onClick={() => handleAction(onGitHubPush)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                >
                  <div className="i-ph:github-logo text-base text-bolt-elements-textPrimary" />
                  <span>{t('github.pushToGitHub')}</span>
                  {ghToken && (
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent font-medium">{t('headerMore.connected')}</span>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Settings section */}
          <div className="px-3 py-2 border-b border-bolt-elements-borderColor border-t border-bolt-elements-borderColor">
            <span className="text-[10px] font-semibold text-bolt-elements-textTertiary uppercase tracking-wider">{t('common.settings')}</span>
          </div>
          <div className="p-1">
            <button
              onClick={() => handleAction(() => toggleTheme())}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
            >
              {theme === 'dark' ? (
                <div className="i-ph:sun-dim-duotone text-base text-amber-400" />
              ) : (
                <div className="i-ph:moon-stars-duotone text-base text-indigo-400" />
              )}
              <span>{theme === 'dark' ? t('header.lightMode') : t('header.darkMode')}</span>
            </button>
            <button
              onClick={() => handleAction(() => onOpenSettings('general'))}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
            >
              <div className="i-ph:sliders-horizontal text-base" />
              <span>{t('header.projectSettings')}</span>
            </button>
            <a
              href="/gallery"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
            >
              <div className="i-ph:storefront text-base" />
              <span>{t('headerMore.browseGallery')}</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

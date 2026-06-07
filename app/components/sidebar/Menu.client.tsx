import { motion, type Variants } from 'framer-motion';
import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { AccountSettingsDialog } from '~/components/header/AccountSettingsDialog.client';
import { getDb, deleteById, getAll, chatId, type ChatHistoryItem } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { activeProjectIdStore, projectsStore, type ProjectRecord, isValidUUID } from '~/lib/stores/project';
import { authStore } from '~/lib/stores/auth';
import { starredProjectsStore } from '~/lib/stores/starred';
import {
  recentlyViewedStore,
  addRecentlyViewed,
  loadRecentlyViewedFromSupabase,
  type RecentlyViewedItem,
} from '~/lib/stores/recently-viewed';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { ClientOnly } from 'remix-utils/client-only';
import { StorageBar } from './StorageBar.client';
import { useT } from '~/lib/i18n/useT';
import { BrandAsset } from '~/components/ui/BrandAsset';

const sidebarVariants = {
  closed: {
    x: '-100%',
    transition: {
      duration: 0.25,
      ease: cubicEasingFn,
    },
  },
  open: {
    x: 0,
    transition: {
      duration: 0.25,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent = { type: 'delete'; item: ChatHistoryItem } | null;

type NavItem = {
  icon: string;
  label: string;
  href?: string;
  active?: boolean;
  external?: boolean;
  onClick?: () => void;
  svgIcon?: JSX.Element;
};

const COLLAPSED_KEY = 'omni-builder.sidebar.collapsed';

export function Menu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navSection, setNavSection] = useState<'main' | 'chats' | 'starred'>('main');
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const { user } = useStore(authStore);
  const chatStarted = useStore(chatStore).started;
  const starred = useStore(starredProjectsStore);
  const projects = useStore(projectsStore);
  const recentlyViewed = useStore(recentlyViewedStore);
  const t = useT();

  // Sort recently viewed so user's own projects (cloud source) appear first
  const sortedRecentlyViewed = useMemo(() => {
    if (!user) return recentlyViewed;
    const cloud = recentlyViewed.filter((i) => i.source === 'cloud');
    const local = recentlyViewed.filter((i) => i.source !== 'cloud');
    return [...cloud, ...local];
  }, [recentlyViewed, user]);

  const sidebarWidth = collapsed ? 60 : 240;

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleNewChat = useCallback(() => {
    chatStore.set({ started: false, aborted: false, showChat: true, planMode: false });
    workbenchStore.showWorkbench.set(false);
    workbenchStore.currentView.set('code');
    workbenchStore.clearWorkspace();
    workbenchStore.artifacts.set({});
    workbenchStore.artifactIdList = [];
    localStorage.removeItem('omni-builder.files.cache');
    localStorage.removeItem('bolt.files.cache');
    const pid = activeProjectIdStore.get();
    if (pid) {
      localStorage.removeItem(`bolt.snapshots.${pid}`);
    }
    activeProjectIdStore.set('default');
    window.location.href = '/';
  }, []);

  // Get starred project details from projects store
  const starredProjectEntries = Array.from(starred)
    .map((id) => {
      const proj = projects[id];
      if (!proj || !isValidUUID(id)) return null;
      return {
        id,
        name: proj.name || t('sidebar.untitled'),
        description: proj.settings?.description || '',
        logo: proj.settings?.logo || '',
        source: 'local' as const,
      };
    })
    .filter(Boolean) as { id: string; name: string; description: string; logo: string; source: 'local' }[];

  // Filter starred items from chat history (for chats that aren't in projects store)
  const starredChatItems = list.filter((item) => {
    const id = item.urlId || item.id;
    return starred.has(id) && !projects[id];
  });

  // Navigation items
  const navItems: NavItem[] = [
    {
      icon: 'i-ph:house',
      label: t('sidebar.home'),
      onClick: handleNewChat,
      active: !chatStarted,
      svgIcon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 640 640"
          className={collapsed ? 'w-5 h-5' : 'w-4 h-4'}
          fill="currentColor"
        >
          <path d="M304 70.1C313.1 61.9 326.9 61.9 336 70.1L568 278.1C577.9 286.9 578.7 302.1 569.8 312C560.9 321.9 545.8 322.7 535.9 313.8L527.9 306.6L527.9 511.9C527.9 547.2 499.2 575.9 463.9 575.9L175.9 575.9C140.6 575.9 111.9 547.2 111.9 511.9L111.9 306.6L103.9 313.8C94 322.6 78.9 321.8 70 312C61.1 302.2 62 287 71.8 278.1L304 70.1zM320 120.2L160 263.7L160 512C160 520.8 167.2 528 176 528L224 528L224 424C224 384.2 256.2 352 296 352L344 352C383.8 352 416 384.2 416 424L416 528L464 528C472.8 528 480 520.8 480 512L480 263.7L320 120.3zM272 528L368 528L368 424C368 410.7 357.3 400 344 400L296 400C282.7 400 272 410.7 272 424L272 528z" />
        </svg>
      ),
    },
    {
      icon: 'i-ph:folder-open',
      label: t('sidebar.projects'),
      href: '/projects',
      svgIcon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 640 640"
          className={collapsed ? 'w-5 h-5' : 'w-4 h-4'}
          fill="currentColor"
        >
          <path d="M128 464L512 464C520.8 464 528 456.8 528 448L528 208C528 199.2 520.8 192 512 192L362.7 192C345.4 192 328.5 186.4 314.7 176L276.3 147.2C273.5 145.1 270.2 144 266.7 144L128 144C119.2 144 112 151.2 112 160L112 448C112 456.8 119.2 464 128 464zM512 512L128 512C92.7 512 64 483.3 64 448L64 160C64 124.7 92.7 96 128 96L266.7 96C280.5 96 294 100.5 305.1 108.8L343.5 137.6C349 141.8 355.8 144 362.7 144L512 144C547.3 144 576 172.7 576 208L576 448C576 483.3 547.3 512 512 512z" />
        </svg>
      ),
    },
    {
      icon: 'i-ph:star',
      label: t('sidebar.starred'),
      onClick: () => setNavSection('starred'),
      svgIcon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 640 640"
          className={collapsed ? 'w-5 h-5' : 'w-4 h-4'}
          fill="currentColor"
        >
          <path d="M320.1 32C329.1 32 337.4 37.1 341.5 45.1L415 189.3L574.9 214.7C583.8 216.1 591.2 222.4 594 231C596.8 239.6 594.5 249 588.2 255.4L473.7 369.9L499 529.8C500.4 538.7 496.7 547.7 489.4 553C482.1 558.3 472.4 559.1 464.4 555L320.1 481.6L175.8 555C167.8 559.1 158.1 558.3 150.8 553C143.5 547.7 139.8 538.8 141.2 529.8L166.4 369.9L52 255.4C45.6 249 43.4 239.6 46.2 231C49 222.4 56.3 216.1 65.3 214.7L225.2 189.3L298.8 45.1C302.9 37.1 311.2 32 320.2 32zM320.1 108.8L262.3 222C258.8 228.8 252.3 233.6 244.7 234.8L119.2 254.8L209 344.7C214.4 350.1 216.9 357.8 215.7 365.4L195.9 490.9L309.2 433.3C316 429.8 324.1 429.8 331 433.3L444.3 490.9L424.5 365.4C423.3 357.8 425.8 350.1 431.2 344.7L521 254.8L395.5 234.8C387.9 233.6 381.4 228.8 377.9 222L320.1 108.8z" />
        </svg>
      ),
    },
    { icon: 'i-ph:clock-counter-clockwise', label: t('sidebar.recentlyViewed'), onClick: () => setNavSection('chats') },
    {
      icon: 'i-ph:book-open-text',
      label: t('sidebar.docsHelp'),
      href: '/docs',
    },
  ];

  const loadEntries = useCallback(() => {
    getDb().then((database) => {
      if (database) {
        getAll(database)
          .then((list) => list.filter((item) => item.urlId && item.description))
          .then(setList)
          .catch((error) => toast.error(error.message));
      }
    });
  }, []);

  const deleteItem = useCallback((event: React.UIEvent, item: ChatHistoryItem) => {
    event.preventDefault();

    getDb().then((database) => {
      if (database) {
        deleteById(database, item.id)
          .then(() => {
            loadEntries();

            if (chatId.get() === item.id) {
              window.location.pathname = '/';
            }
          })
          .catch((error) => {
            toast.error(t('sidebar.failedToDelete'));
            logger.error(error);
          });
      }
    });
  }, []);

  const closeDialog = () => {
    setDialogContent(null);
  };

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Load recently viewed from Supabase when user logs in
  useEffect(() => {
    if (user) {
      loadRecentlyViewedFromSupabase();
    }
  }, [user]);

  // Close mobile sidebar on route change or chat start
  useEffect(() => {
    setMobileOpen(false);
  }, [chatStarted]);

  // Close mobile sidebar on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileOpen]);

  // Total starred count (projects + chats)
  const totalStarred = starredProjectEntries.length + starredChatItems.length;

  const renderChatList = (items: ChatHistoryItem[], showDateBinning = true) => (
    <>
      {!collapsed && items.length === 0 && (
        <div className="pl-2 text-sm text-bolt-elements-textTertiary">{t('sidebar.noConversations')}</div>
      )}
      {collapsed && items.length === 0 && (
        <div className="flex items-center justify-center py-2" title={t('sidebar.noConversations')}>
          <div className="i-ph:chat-circle-dots text-base text-bolt-elements-textTertiary" />
        </div>
      )}
      <DialogRoot open={dialogContent !== null}>
        {showDateBinning
          ? binDates(items).map(({ category, items: dateItems }) => (
              <div key={category} className="mt-3 first:mt-0 space-y-1">
                {!collapsed && (
                  <div className="text-bolt-elements-textTertiary sticky top-0 z-1 bg-bolt-elements-sidebar-background pl-2 pt-2 pb-1 text-xs font-medium">
                    {category}
                  </div>
                )}
                {dateItems.map((item) => (
                  <HistoryItem key={item.id} item={item} onDelete={() => setDialogContent({ type: 'delete', item })} />
                ))}
              </div>
            ))
          : items.map((item) => (
              <HistoryItem key={item.id} item={item} onDelete={() => setDialogContent({ type: 'delete', item })} />
            ))}
        <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
          {dialogContent?.type === 'delete' && (
            <>
              <DialogTitle>{t('sidebar.deleteChat')}</DialogTitle>
              <DialogDescription asChild>
                <div>
                  <p>
                    {t('sidebar.deleteChatConfirm')} <strong>{dialogContent.item.description}</strong>.
                  </p>
                  <p className="mt-1">{t('sidebar.deleteChatConfirm2')}</p>
                </div>
              </DialogDescription>
              <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
                <DialogButton type="secondary" onClick={closeDialog}>
                  {t('common.cancel')}
                </DialogButton>
                <DialogButton
                  type="danger"
                  onClick={(event) => {
                    deleteItem(event, dialogContent.item);
                    closeDialog();
                  }}
                >
                  {t('common.delete')}
                </DialogButton>
              </div>
            </>
          )}
        </Dialog>
      </DialogRoot>
    </>
  );

  // Render a project card (compact sidebar version)
  const renderProjectCard = (project: {
    id: string;
    name: string;
    description?: string;
    logo?: string;
    source?: string;
    timestamp?: string;
  }) => (
    <a
      key={project.id}
      href={`/chat/${project.id}`}
      className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-all"
    >
      {/* Project icon */}
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-contentAccent shrink-0">
        {project.logo ? (
          <img src={project.logo} alt="" className="w-4 h-4 rounded" />
        ) : (
          <div className="i-ph:code text-xs" />
        )}
      </div>
      {/* Project info */}
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{project.name || t('sidebar.untitled')}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {project.source === 'cloud' && (
              <span className="text-[9px] px-1 py-0 rounded bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-contentAccent font-medium">
                {t('sidebar.cloud')}
              </span>
            )}
            {project.description && (
              <span className="text-[10px] text-bolt-elements-textTertiary truncate">{project.description}</span>
            )}
          </div>
        </div>
      )}
    </a>
  );

  // Render a recently viewed item
  const renderRecentlyViewedItem = (item: RecentlyViewedItem) => (
    <a
      key={item.id}
      href={`/chat/${item.id}`}
      className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-all"
    >
      {/* Project icon */}
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-contentAccent shrink-0">
        {item.logo ? <img src={item.logo} alt="" className="w-4 h-4 rounded" /> : <div className="i-ph:code text-xs" />}
      </div>
      {/* Project info */}
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{item.name || t('sidebar.untitled')}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {item.source === 'cloud' && (
              <span className="text-[9px] px-1 py-0 rounded bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-contentAccent font-medium">
                {t('sidebar.cloud')}
              </span>
            )}
            {item.description && (
              <span className="text-[10px] text-bolt-elements-textTertiary truncate">{item.description}</span>
            )}
          </div>
        </div>
      )}
    </a>
  );

  const sidebar = (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Brand / sidebar controls */}
      <div className={`w-full border-b border-bolt-elements-borderColor ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="group relative flex items-center justify-center w-full h-10 rounded-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
            title={t('sidebar.expandSidebar')}
          >
            <BrandAsset
              src="/omini-favicon.html"
              title="Mojo Builder"
              className="w-5 h-5 transition-all duration-200 group-hover:opacity-0 group-hover:scale-75"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200">
              <div className="i-ph:caret-double-right text-lg" />
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewChat}
              className="flex items-center flex-1 min-w-0 rounded-xl px-2 py-2 bg-transparent hover:bg-bolt-elements-item-backgroundActive transition-all"
              title={t('sidebar.startNewChat')}
            >
              <BrandAsset src="/omini-logo.html" title="Mojo Builder" className="h-10 w-[140px] max-w-full omni-logo-themed" />
            </button>
            <button
              type="button"
              onClick={() => setAccountSettingsOpen(true)}
              className="flex items-center justify-center w-9 h-9 rounded-xl text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all shrink-0"
              title={t('sidebar.accountSettings')}
            >
              <div className="i-ph:gear-six text-base" />
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex items-center justify-center w-9 h-9 rounded-xl text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all shrink-0"
              title={t('sidebar.collapseSidebar')}
            >
              <div className="i-ph:caret-line-left text-base" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation items */}
      {navSection === 'main' ? (
        <div className={`flex flex-col ${collapsed ? 'px-1.5 py-2' : 'px-2 py-2'}`}>
          {navItems.map((item) => {
            const content = (
              <>
                {item.svgIcon ? (
                  <div className="shrink-0 flex items-center justify-center">{item.svgIcon}</div>
                ) : (
                  <div className={`${item.icon} ${collapsed ? 'text-lg' : 'text-base'} shrink-0`} />
                )}
                {!collapsed && <span className="text-sm truncate">{item.label}</span>}
                {!collapsed && item.active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-bolt-elements-item-contentAccent" />
                )}
                {!collapsed && item.external && (
                  <div className="i-ph:arrow-square-out text-xs ml-auto text-bolt-elements-textTertiary" />
                )}
                {/* Starred badge */}
                {!collapsed && item.label === t('sidebar.starred') && totalStarred > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-full bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent text-[10px] font-bold leading-none">
                    {totalStarred}
                  </span>
                )}
              </>
            );

            const cls = `flex items-center ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'} rounded-lg transition-all duration-150 group relative ${
              item.active
                ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-4 before:rounded-r-full before:bg-bolt-elements-item-contentAccent'
                : 'bg-transparent text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive'
            }`;

            const titleAttr = collapsed ? item.label : undefined;

            if (item.href && item.external) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cls}
                  title={titleAttr}
                >
                  {content}
                </a>
              );
            }

            if (item.href) {
              return (
                <a key={item.label} href={item.href} className={cls} title={titleAttr}>
                  {content}
                </a>
              );
            }

            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={`${cls} text-left w-full`}
                title={titleAttr}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : navSection === 'starred' ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Back to main nav */}
          <div className={collapsed ? 'px-1.5 pt-2' : 'px-2 pt-2'}>
            <button
              type="button"
              onClick={() => setNavSection('main')}
              className={`flex items-center bg-transparent ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2 px-3 py-2 w-full'} rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all`}
              title={collapsed ? t('sidebar.back') : undefined}
            >
              <div className="i-ph:caret-left text-base shrink-0" />
              {!collapsed && <span>{t('sidebar.back')}</span>}
            </button>
          </div>

          {/* Starred section header */}
          {!collapsed && (
            <div className="text-bolt-elements-textPrimary font-medium px-5 my-2 text-xs uppercase tracking-wider flex items-center gap-2">
              <div className="i-ph:star text-sm text-yellow-400" />
              {t('sidebar.favorites')}
            </div>
          )}
          <div className={`flex-1 overflow-y-auto ${collapsed ? 'px-1.5' : 'px-3'} pb-3`}>
            {totalStarred === 0 ? (
              collapsed ? (
                <div className="flex items-center justify-center py-2" title={t('sidebar.noFavorites')}>
                  <div className="i-ph:star text-base text-bolt-elements-textTertiary" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-bolt-elements-textTertiary">
                  <div className="i-ph:star text-2xl mb-2 opacity-30" />
                  <p className="text-sm">{t('sidebar.noFavorites')}</p>
                  <p className="text-[11px] mt-1 opacity-70">{t('sidebar.clickStarToFavorite')}</p>
                </div>
              )
            ) : (
              <>
                {/* Starred projects */}
                {starredProjectEntries.map((project) => renderProjectCard(project))}
                {/* Starred chat items (that aren't in projects store) */}
                {starredChatItems.length > 0 && (
                  <>
                    {!collapsed && starredProjectEntries.length > 0 && (
                      <div className="text-[10px] text-bolt-elements-textTertiary px-2.5 pt-3 pb-1 uppercase tracking-wider">
                        {t('sidebar.favoriteChats')}
                      </div>
                    )}
                    {renderChatList(starredChatItems, false)}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Back to main nav */}
          <div className={collapsed ? 'px-1.5 pt-2' : 'px-2 pt-2'}>
            <button
              type="button"
              onClick={() => setNavSection('main')}
              className={`flex items-center bg-transparent ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2 px-3 py-2 w-full'} rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all`}
              title={collapsed ? t('sidebar.back') : undefined}
            >
              <div className="i-ph:caret-left text-base shrink-0" />
              {!collapsed && <span>{t('sidebar.back')}</span>}
            </button>
          </div>

          {/* Start new chat */}
          {!collapsed && (
            <div className="px-3 pt-2">
              <button
                onClick={handleNewChat}
                className="flex gap-2 items-center bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover rounded-lg p-2.5 transition-theme w-full text-left text-sm font-medium"
              >
                <span className="inline-block i-bolt:chat scale-110" />
                {t('sidebar.startNewChat')}
              </button>
            </div>
          )}
          {collapsed && (
            <div className="px-1.5 pt-2">
              <button
                onClick={handleNewChat}
                className="flex items-center justify-center py-2.5 rounded-lg bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover transition-all w-full"
                title={t('sidebar.startNewChat')}
              >
                <span className="inline-block i-bolt:chat text-base" />
              </button>
            </div>
          )}

          {/* Recently viewed section header */}
          {!collapsed && (
            <div className="text-bolt-elements-textPrimary font-medium px-5 my-2 text-xs uppercase tracking-wider flex items-center gap-2">
              <div className="i-ph:clock-counter-clockwise text-sm text-bolt-elements-item-contentAccent" />
              {t('sidebar.recentlyViewedTitle')}
            </div>
          )}
          <div className={`flex-1 overflow-y-auto ${collapsed ? 'px-1.5' : 'px-3'} pb-3`}>
            {sortedRecentlyViewed.length === 0 ? (
              collapsed ? (
                <div className="flex items-center justify-center py-2" title={t('sidebar.noRecentlyViewed')}>
                  <div className="i-ph:clock-counter-clockwise text-base text-bolt-elements-textTertiary" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-bolt-elements-textTertiary">
                  <div className="i-ph:clock-counter-clockwise text-2xl mb-2 opacity-30" />
                  <p className="text-sm">{t('sidebar.noRecentlyViewed')}</p>
                  <p className="text-[11px] mt-1 opacity-70">{t('sidebar.projectsWillAppearHere')}</p>
                </div>
              )
            ) : (
              sortedRecentlyViewed.map((item) => renderRecentlyViewedItem(item))
            )}
          </div>
        </div>
      )}

      {/* Bottom section: storage bar + collapse toggle + social links + theme switch */}
      <div className="mt-auto border-t border-bolt-elements-borderColor">
        {/* Storage bar - only when not collapsed */}
        {!collapsed && (
          <div className="border-b border-bolt-elements-borderColor">
            <StorageBar />
          </div>
        )}
        {/* Collapsed storage indicator */}
        {collapsed && (
          <div className="flex justify-center py-1.5 border-b border-bolt-elements-borderColor">
            <div className="i-ph:cloud text-xs text-bolt-elements-textTertiary" title={t('sidebar.cloudStorage')} />
          </div>
        )}

        {/* Social links + theme switch */}
        <div className={`flex items-center ${collapsed ? 'justify-center px-0' : 'gap-1 px-4'} py-2.5`}>
          {!collapsed && (
            <>
              <a
                href="https://www.linkedin.com/in/pedro-berbis-freire/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
                title="LinkedIn"
              >
                <div className="i-ph:linkedin-logo text-base" />
              </a>
              <a
                href="https://www.reddit.com/user/Dangerous-Big6345/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
                title="Reddit"
              >
                <div className="i-ph:reddit-logo text-base" />
              </a>

              <div className="ml-auto">
                <ThemeSwitch />
              </div>
            </>
          )}
          {collapsed && (
            <div className="flex flex-col items-center gap-1">
              <ThemeSwitch />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger toggle */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-[1000] flex items-center justify-center w-9 h-9 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-all"
        aria-label={t('sidebar.toggleSidebar')}
      >
        <div className={mobileOpen ? 'i-ph:x text-base' : 'i-ph:list text-base'} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-[998]" onClick={() => setMobileOpen(false)} />
      )}

      {/* Desktop sidebar - collapsible */}
      <div
        className="hidden lg:flex h-full shrink-0 bg-bolt-elements-sidebar-background border-r border-bolt-elements-borderColor transition-[width] duration-200 ease-in-out"
        style={{ width: `${sidebarWidth}px` }}
      >
        {sidebar}
      </div>

      {/* Mobile sidebar - slide in/out */}
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={mobileOpen ? 'open' : 'closed'}
        variants={sidebarVariants}
        className="lg:hidden fixed top-0 left-0 w-[280px] h-full bg-bolt-elements-sidebar-background border-r border-bolt-elements-borderColor z-[999] shadow-xl"
      >
        {sidebar}
      </motion.div>
      <AccountSettingsDialog open={accountSettingsOpen} onClose={() => setAccountSettingsOpen(false)} />
    </>
  );
}

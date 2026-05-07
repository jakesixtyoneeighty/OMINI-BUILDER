import { motion, type Variants } from 'framer-motion';
import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { AccountSettingsDialog } from '~/components/header/AccountSettingsDialog.client';
import { getDb, deleteById, getAll, chatId, type ChatHistoryItem } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { activeProjectIdStore } from '~/lib/stores/project';
import { authStore } from '~/lib/stores/auth';
import { starredProjectsStore } from '~/lib/stores/starred';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';

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

  // Filter starred items
  const starredItems = list.filter((item) => starred.has(item.urlId || item.id));

  // Navigation items
  const navItems: NavItem[] = [
    { icon: 'i-ph:house', label: 'Home', onClick: handleNewChat, active: !chatStarted },
    { icon: 'i-ph:folder-open', label: 'Projects', href: '/projects' },
    { icon: 'i-ph:star', label: 'Starred', onClick: () => setNavSection('starred') },
    { icon: 'i-ph:clock-counter-clockwise', label: 'Recently viewed', onClick: () => setNavSection('chats') },
    {
      icon: 'i-ph:book-open-text',
      label: 'Docs & Help center',
      href: 'https://github.com/stackblitz/bolt.new',
      external: true,
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
            toast.error('Failed to delete conversation');
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

  const userEmail = user?.email || '';
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const userAvatar = user?.user_metadata?.avatar_url || '';
  const displayName = userName || userEmail || 'Guest';

  const renderChatList = (items: ChatHistoryItem[], showDateBinning = true) => (
    <>
      {!collapsed && items.length === 0 && <div className="pl-2 text-sm text-bolt-elements-textTertiary">No previous conversations</div>}
      {collapsed && items.length === 0 && (
        <div className="flex items-center justify-center py-2" title="No previous conversations">
          <div className="i-ph:chat-circle-dots text-base text-bolt-elements-textTertiary" />
        </div>
      )}
      <DialogRoot open={dialogContent !== null}>
        {showDateBinning ? (
          binDates(items).map(({ category, items: dateItems }) => (
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
        ) : (
          items.map((item) => (
            <HistoryItem key={item.id} item={item} onDelete={() => setDialogContent({ type: 'delete', item })} />
          ))
        )}
        <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
          {dialogContent?.type === 'delete' && (
            <>
              <DialogTitle>Delete Chat?</DialogTitle>
              <DialogDescription asChild>
                <div>
                  <p>
                    You are about to delete <strong>{dialogContent.item.description}</strong>.
                  </p>
                  <p className="mt-1">Are you sure you want to delete this chat?</p>
                </div>
              </DialogDescription>
              <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
                <DialogButton type="secondary" onClick={closeDialog}>
                  Cancel
                </DialogButton>
                <DialogButton
                  type="danger"
                  onClick={(event) => {
                    deleteItem(event, dialogContent.item);
                    closeDialog();
                  }}
                >
                  Delete
                </DialogButton>
              </div>
            </>
          )}
        </Dialog>
      </DialogRoot>
    </>
  );

  const sidebar = (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* User account section - clickable to open settings */}
      <button
        onClick={() => setAccountSettingsOpen(true)}
        className={`w-full flex items-center gap-3 border-b border-bolt-elements-borderColor hover:bg-bolt-elements-item-backgroundActive transition-all ${collapsed ? 'px-2 py-3 justify-center' : 'px-4 py-3'}`}
        title={collapsed ? `${displayName} — Account Settings` : 'Account Settings'}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-full bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText text-xs font-bold shrink-0 overflow-hidden"
        >
          {userAvatar ? (
            <img src={userAvatar} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span>{displayName.charAt(0).toUpperCase()}</span>
          )}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">{displayName}</div>
            {userEmail && (
              <div className="text-[11px] text-bolt-elements-textTertiary truncate">{userEmail}</div>
            )}
          </div>
        )}
        {!collapsed && (
          <div className="i-ph:gear-six text-sm text-bolt-elements-textTertiary" />
        )}
      </button>

      {/* Navigation items */}
      {navSection === 'main' ? (
        <div className={`flex flex-col ${collapsed ? 'px-1.5 py-2' : 'px-2 py-2'}`}>
          {navItems.map((item) => {
            const content = (
              <>
                <div className={`${item.icon} ${collapsed ? 'text-lg' : 'text-base'} shrink-0`} />
                {!collapsed && (
                  <span className="text-sm truncate">{item.label}</span>
                )}
                {!collapsed && item.active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-bolt-elements-item-contentAccent" />
                )}
                {!collapsed && item.external && (
                  <div className="i-ph:arrow-square-out text-xs ml-auto text-bolt-elements-textTertiary" />
                )}
                {/* Starred badge */}
                {!collapsed && item.label === 'Starred' && starredItems.length > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-full bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent text-[10px] font-bold leading-none">
                    {starredItems.length}
                  </span>
                )}
              </>
            );

            const cls = `flex items-center ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'} rounded-lg transition-all duration-150 group relative ${
              item.active
                ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-4 before:rounded-r-full before:bg-bolt-elements-item-contentAccent'
                : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive'
            }`;

            const titleAttr = collapsed ? item.label : undefined;

            if (item.href && item.external) {
              return (
                <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className={cls} title={titleAttr}>
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
              <button key={item.label} type="button" onClick={item.onClick} className={`${cls} text-left w-full`} title={titleAttr}>
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
              className={`flex items-center ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2 px-3 py-2 w-full'} rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all`}
              title={collapsed ? 'Back' : undefined}
            >
              <div className="i-ph:caret-left text-base shrink-0" />
              {!collapsed && <span>Back</span>}
            </button>
          </div>

          {/* Starred section header */}
          {!collapsed && (
            <div className="text-bolt-elements-textPrimary font-medium px-5 my-2 text-xs uppercase tracking-wider flex items-center gap-2">
              <div className="i-ph:star text-sm text-yellow-400" />
              Favoritos
            </div>
          )}
          <div className={`flex-1 overflow-y-auto ${collapsed ? 'px-1.5' : 'px-3'} pb-3`}>
            {starredItems.length === 0 ? (
              collapsed ? (
                <div className="flex items-center justify-center py-2" title="Nenhum favorito ainda">
                  <div className="i-ph:star text-base text-bolt-elements-textTertiary" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-bolt-elements-textTertiary">
                  <div className="i-ph:star text-2xl mb-2 opacity-30" />
                  <p className="text-sm">Nenhum favorito ainda</p>
                  <p className="text-[11px] mt-1 opacity-70">Clique na estrela ao lado de um chat para favoritar</p>
                </div>
              )
            ) : (
              renderChatList(starredItems, false)
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
              className={`flex items-center ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2 px-3 py-2 w-full'} rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all`}
              title={collapsed ? 'Back' : undefined}
            >
              <div className="i-ph:caret-left text-base shrink-0" />
              {!collapsed && <span>Back</span>}
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
                Start new chat
              </button>
            </div>
          )}
          {collapsed && (
            <div className="px-1.5 pt-2">
              <button
                onClick={handleNewChat}
                className="flex items-center justify-center py-2.5 rounded-lg bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover transition-all w-full"
                title="Start new chat"
              >
                <span className="inline-block i-bolt:chat text-base" />
              </button>
            </div>
          )}

          {/* Chat history */}
          {!collapsed && (
            <div className="text-bolt-elements-textPrimary font-medium px-5 my-2 text-xs uppercase tracking-wider">
              Your Chats
            </div>
          )}
          <div className={`flex-1 overflow-y-auto ${collapsed ? 'px-1.5' : 'px-3'} pb-3`}>
            {renderChatList(list)}
          </div>
        </div>
      )}

      {/* Bottom section: collapse toggle + social links + theme switch */}
      <div className="mt-auto border-t border-bolt-elements-borderColor">
        {/* Social links + theme switch */}
        <div className={`flex items-center ${collapsed ? 'justify-center px-0' : 'gap-1 px-4'} py-2.5`}>
          {!collapsed && (
            <>
              <a
                href="https://discord.gg/stackblitz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
                title="Discord"
              >
                <div className="i-ph:discord-logo text-base" />
              </a>
              <a
                href="https://linkedin.com/company/stackblitz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
                title="LinkedIn"
              >
                <div className="i-ph:linkedin-logo text-base" />
              </a>
              <a
                href="https://twitter.com/stackblitz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
                title="Twitter"
              >
                <div className="i-ph:x-logo text-base" />
              </a>
              <a
                href="https://reddit.com/r/stackblitz"
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

        {/* Collapse toggle button */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-end px-3'} pb-2.5`}>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <div className={`i-ph:caret-line-left text-base transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
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
        aria-label="Toggle sidebar"
      >
        <div className={mobileOpen ? 'i-ph:x text-base' : 'i-ph:list text-base'} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[998]"
          onClick={() => setMobileOpen(false)}
        />
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

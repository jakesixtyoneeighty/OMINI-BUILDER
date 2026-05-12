import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { Header } from '~/components/header/Header';
import { Menu } from '~/components/sidebar/Menu.client';
import { getDb, getAll, type ChatHistoryItem } from '~/lib/persistence';
import { deleteProject, renameProject, projectsStore, type ProjectRecord, MAX_PROJECTS_PER_USER } from '~/lib/stores/project';
import { authStore } from '~/lib/stores/auth';
import { getSupabase } from '~/lib/supabase';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { useT } from '~/lib/i18n/useT';

export const meta: MetaFunction = () => {
  return [{ title: 'Projects — Omni-Builder' }, { name: 'description', content: 'View and manage your Omni-Builder projects' }];
};

export const loader = () => json({});

export default function ProjectsPage() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <ClientOnly>{() => <Menu />}</ClientOnly>
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <Header />
        <ClientOnly fallback={<ProjectsSkeleton />}>
          {() => <ProjectsContent />}
        </ClientOnly>
      </div>
    </div>
  );
}

/* ===== Skeleton for server render ===== */
function ProjectsSkeleton() {
  return (
    <div className="flex-1 overflow-auto bg-bolt-elements-bg-depth-1 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-7 w-32 bg-bolt-elements-bg-depth-3 rounded-lg animate-pulse mb-2" />
            <div className="h-4 w-48 bg-bolt-elements-bg-depth-3 rounded-lg animate-pulse" />
          </div>
          <div className="h-9 w-32 bg-bolt-elements-bg-depth-3 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 overflow-hidden animate-pulse">
              <div className="w-full h-28 bg-bolt-elements-bg-depth-3" />
              <div className="p-4 space-y-2.5">
                <div className="h-4 w-3/4 bg-bolt-elements-bg-depth-3 rounded" />
                <div className="h-3 w-full bg-bolt-elements-bg-depth-3 rounded" />
                <div className="h-3 w-1/2 bg-bolt-elements-bg-depth-3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== Project card type for merged projects ===== */
interface ProjectCard {
  id: string;
  name: string;
  description: string;
  logo: string;
  timestamp: string;
  messageCount: number;
  source: 'local' | 'cloud';
}

/* ===== Main client content ===== */
function ProjectsContent() {
  const t = useT();
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [dialogContent, setDialogContent] = useState<{ type: 'delete'; project: ProjectCard } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Subscribe to auth state reactively
  const { user } = useStore(authStore);
  const userIdRef = useRef<string | null>(null);

  const loadProjects = useCallback(() => {
    async function load() {
      setLoading(true);
      const cardMap = new Map<string, ProjectCard>();

      // Load from IndexedDB (chat history)
      try {
        const database = await getDb();
        if (database) {
          const list = await getAll(database);
          const filtered = list.filter((item) => item.urlId && item.description);
          for (const item of filtered) {
            cardMap.set(item.urlId || item.id, {
              id: item.urlId || item.id,
              name: item.description || t('projects.untitled'),
              description: '',
              logo: '',
              timestamp: item.timestamp,
              messageCount: item.messages?.length || 0,
              source: 'local',
            });
          }
        }
      } catch (error) {
        console.error('Failed to load from IndexedDB:', error);
      }

      // Load from Supabase (cloud projects) — use reactive user from hook
      const sb = getSupabase();
      const currentUser = user || authStore.get().user;
      if (sb && currentUser) {
        try {
          const { data, error } = await sb
            .from('projects')
            .select('id, name, description, logo, updated_at, created_at, messages')
            .eq('owner_id', currentUser.id)
            .order('updated_at', { ascending: false });
          if (!error && data) {
            for (const p of data) {
              const existing = cardMap.get(p.id);
              if (existing) {
                // Merge: Supabase data takes precedence for name/logo/description
                cardMap.set(p.id, {
                  ...existing,
                  name: p.name || existing.name,
                  description: p.description || existing.description,
                  logo: p.logo || existing.logo,
                  timestamp: p.updated_at || existing.timestamp,
                  source: 'cloud',
                });
              } else {
                cardMap.set(p.id, {
                  id: p.id,
                  name: p.name || t('projects.untitled'),
                  description: p.description || '',
                  logo: p.logo || '',
                  timestamp: p.updated_at || p.created_at || '',
                  messageCount: Array.isArray(p.messages) ? p.messages.length : 0,
                  source: 'cloud',
                });
              }
            }
          } else if (error) {
            console.error('Supabase query error:', error.message);
          }
        } catch (error) {
          console.error('Failed to load from Supabase:', error);
        }
      } else if (!sb) {
        console.warn('[Projects] Supabase not configured — cloud projects will not appear. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
      }

      // Sort by timestamp descending
      const sorted = Array.from(cardMap.values()).sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      });

      setProjects(sorted);
      setLoading(false);
    }
    load();
  }, [user, t]);

  // Reload when user changes (login/logout)
  useEffect(() => {
    const currentUserId = user?.id || null;
    if (currentUserId !== userIdRef.current) {
      userIdRef.current = currentUserId;
      loadProjects();
    }
  }, [user, loadProjects]);

  // Initial load
  useEffect(() => {
    loadProjects();
  }, []);

  const filtered = search
    ? projects.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase()))
    : projects;

  const formatDate = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t('projects.today');
    if (diffDays === 1) return t('projects.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('projects.daysAgo')}`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${t('projects.weeksAgo')}`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} ${t('projects.monthsAgo')}`;
    return date.toLocaleDateString('pt-BR');
  };

  const handleNewProject = () => {
    window.location.href = '/';
  };

  const handleDeleteProject = async (project: ProjectCard) => {
    try {
      await deleteProject(project.id);
      toast.success(t('projects.projectDeleted'));
      loadProjects();
    } catch (error) {
      toast.error(t('projects.deleteFailed'));
    }
    setDialogContent(null);
  };

  const handleRenameProject = async (projectId: string, newName: string) => {
    if (!newName.trim()) {
      toast.error(t('projects.nameCannotBeEmpty'));
      return;
    }
    try {
      await renameProject(projectId, newName.trim());
      toast.success(t('projects.projectRenamed'));
      loadProjects();
    } catch (error) {
      toast.error(t('projects.renameFailed'));
    }
    setEditingId(null);
  };

  // Color gradients for cards
  const CARD_ACCENTS = [
    'from-violet-500/10 to-purple-500/5',
    'from-blue-500/10 to-cyan-500/5',
    'from-rose-500/10 to-pink-500/5',
    'from-emerald-500/10 to-green-500/5',
    'from-amber-500/10 to-yellow-500/5',
    'from-fuchsia-500/10 to-pink-500/5',
    'from-teal-500/10 to-emerald-500/5',
    'from-orange-500/10 to-red-500/5',
  ];

  const getAccent = (id: string) => {
    const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return CARD_ACCENTS[hash % CARD_ACCENTS.length];
  };

  const CARD_ICONS = [
    'i-ph:code',
    'i-ph:globe',
    'i-ph:rocket',
    'i-ph:lightning',
    'i-ph:cube',
    'i-ph:paint-brush',
    'i-ph:chart-line',
    'i-ph:device-mobile',
  ];

  const getIcon = (id: string) => {
    const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return CARD_ICONS[hash % CARD_ICONS.length];
  };

  return (
    <div className="flex-1 overflow-auto bg-bolt-elements-bg-depth-1">
      <div className="max-w-6xl mx-auto p-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('projects.title')}</h1>
            <p className="text-sm text-bolt-elements-textTertiary mt-1">
              {projects.length}/{MAX_PROJECTS_PER_USER} {t('projects.count')}
            </p>
          </div>
          <button
            onClick={handleNewProject}
            disabled={projects.length >= MAX_PROJECTS_PER_USER}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="i-ph:plus text-base" />
            {t('projects.newProject')}
          </button>
        </div>

        {/* Search bar */}
        {projects.length > 0 && (
          <div className="mb-6">
            <div className="relative max-w-md">
              <div className="i-ph:magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sm text-bolt-elements-textTertiary" />
              <input
                type="text"
                placeholder={t('projects.searchProjects')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-lg text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-bolt-elements-borderColorActive transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
                >
                  <div className="i-ph:x text-sm" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 overflow-hidden animate-pulse">
                <div className="w-full h-28 bg-bolt-elements-bg-depth-3" />
                <div className="p-4 space-y-2.5">
                  <div className="h-4 w-3/4 bg-bolt-elements-bg-depth-3 rounded" />
                  <div className="h-3 w-1/2 bg-bolt-elements-bg-depth-3 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Projects grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((project) => (
              <div
                key={project.id}
                className={`group rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 hover:border-bolt-elements-borderColorActive hover:shadow-lg transition-all duration-200 relative ${menuOpenId === project.id ? 'z-50 overflow-visible' : 'overflow-hidden'}`}
              >
                {/* Card visual header */}
                <a href={`/chat/${project.id}`} className="block">
                  <div className={`relative w-full h-28 bg-gradient-to-br ${getAccent(project.id)} overflow-hidden`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {project.logo ? (
                        <img src={project.logo} alt="" className="w-12 h-12 rounded-lg shadow-lg" />
                      ) : (
                        <div className={`${getIcon(project.id)} text-4xl text-bolt-elements-textTertiary/20 group-hover:scale-110 transition-transform duration-300`} />
                      )}
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-bolt-elements-item-backgroundAccent/0 group-hover:bg-bolt-elements-item-backgroundAccent/30 flex items-center justify-center transition-all duration-200">
                      <div className="w-10 h-10 rounded-full bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-200 shadow-lg">
                        <div className="i-ph:arrow-right text-lg" />
                      </div>
                    </div>
                    {/* Source badge */}
                    {project.source === 'cloud' && (
                      <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded-md bg-bolt-elements-item-backgroundAccent/20 text-bolt-elements-item-contentAccent font-medium backdrop-blur-sm">
                        {t('sidebar.cloud')}
                      </span>
                    )}
                    {/* Menu button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === project.id ? null : project.id);
                      }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/30 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-[60]"
                    >
                      <div className="i-ph:dots-three text-base" />
                    </button>
                  </div>
                </a>

                {/* Dropdown menu */}
                {menuOpenId === project.id && (
                  <div className="absolute top-0 right-2 z-[9999] w-44 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl overflow-hidden">
                    <button
                      onClick={() => {
                        setMenuOpenId(null);
                        setEditingId(project.id);
                        setEditName(project.name);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                    >
                      <div className="i-ph:pencil-simple text-base" />
                      {t('projects.rename')}
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpenId(null);
                        navigator.clipboard.writeText(`${window.location.origin}/chat/${project.id}`);
                        toast.success(t('projects.linkCopied'));
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                    >
                      <div className="i-ph:link text-base" />
                      {t('projects.copyLink')}
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpenId(null);
                        setDialogContent({ type: 'delete', project });
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-left"
                    >
                      <div className="i-ph:trash text-base" />
                      {t('projects.delete')}
                    </button>
                  </div>
                )}

                {/* Card content */}
                <div className="p-4">
                  {editingId === project.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameProject(project.id, editName);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="flex-1 px-2 py-1 bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColorActive rounded text-sm text-bolt-elements-textPrimary focus:outline-none"
                      />
                      <button
                        onClick={() => handleRenameProject(project.id, editName)}
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:brightness-110 transition-all"
                      >
                        <div className="i-ph:check text-sm" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-bolt-elements-bg-depth-3 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-all"
                      >
                        <div className="i-ph:x text-sm" />
                      </button>
                    </div>
                  ) : (
                    <a href={`/chat/${project.id}`} className="block">
                      <h3 className="text-sm font-semibold text-bolt-elements-textPrimary truncate group-hover:text-bolt-elements-item-contentAccent transition-colors">
                        {project.name || t('projects.untitled')}
                      </h3>
                    </a>
                  )}
                  {project.description && (
                    <p className="text-xs text-bolt-elements-textTertiary truncate mt-1">{project.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-bolt-elements-textTertiary">
                    {project.timestamp && (
                      <div className="flex items-center gap-1.5">
                        <div className="i-ph:clock text-xs" />
                        <span>{formatDate(project.timestamp)}</span>
                      </div>
                    )}
                    {project.messageCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="i-ph:chat-circle-dots text-xs" />
                        <span>{project.messageCount} {t('projects.messages')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-20 h-20 rounded-2xl bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor flex items-center justify-center mx-auto mb-5">
              <div className="i-ph:folder-open text-4xl text-bolt-elements-textTertiary" />
            </div>
            <p className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">{t('projects.noProjectsYet')}</p>
            <p className="text-sm text-bolt-elements-textTertiary mb-6">{t('projects.startNewChat')}</p>
            <button
              onClick={handleNewProject}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover text-sm font-medium transition-all"
            >
              <div className="i-ph:plus text-base" />
              {t('projects.newProject')}
            </button>
          </div>
        )}

        {/* Search empty state */}
        {!loading && filtered.length === 0 && projects.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-xl bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor flex items-center justify-center mx-auto mb-4">
              <div className="i-ph:magnifying-glass text-2xl text-bolt-elements-textTertiary" />
            </div>
            <p className="text-sm font-medium text-bolt-elements-textPrimary mb-1">{t('projects.noResults')}</p>
            <p className="text-sm text-bolt-elements-textTertiary">{t('projects.tryAdjustingSearch')}</p>
          </div>
        )}
      </div>

      {/* Delete dialog */}
      <DialogRoot open={dialogContent !== null}>
        <Dialog onBackdrop={() => setDialogContent(null)} onClose={() => setDialogContent(null)}>
          {dialogContent?.type === 'delete' && (
            <>
              <DialogTitle>{t('projects.deleteProject')}</DialogTitle>
              <DialogDescription asChild>
                <div>
                  <p>
                    {t('projects.deleteProjectConfirm')} <strong>{dialogContent.project.name}</strong>.
                  </p>
                  <p className="mt-1">{t('projects.deleteProjectConfirm2')}</p>
                </div>
              </DialogDescription>
              <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
                <DialogButton type="secondary" onClick={() => setDialogContent(null)}>
                  {t('common.cancel')}
                </DialogButton>
                <DialogButton
                  type="danger"
                  onClick={() => handleDeleteProject(dialogContent.project)}
                >
                  {t('projects.delete')}
                </DialogButton>
              </div>
            </>
          )}
        </Dialog>
      </DialogRoot>

      {/* Close dropdown on outside click */}
      {menuOpenId && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => setMenuOpenId(null)}
        />
      )}
    </div>
  );
}

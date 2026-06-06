import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { Header } from '~/components/header/Header';
import { Menu } from '~/components/sidebar/Menu.client';
import { getDb, getAll, type ChatHistoryItem } from '~/lib/persistence';
import { deleteProject, renameProject, projectsStore, loadAllProjectsFromSupabase, type ProjectRecord, MAX_PROJECTS_PER_USER } from '~/lib/stores/project';
import { authStore } from '~/lib/stores/auth';
import { getSupabase } from '~/lib/supabase';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { useT } from '~/lib/i18n/useT';

export const meta: MetaFunction = () => {
  return [{ title: 'Projects — Mojo Builder' }, { name: 'description', content: 'View and manage your Mojo Builder projects' }];
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

/* ===== Time grouping ===== */
type TimeGroup = 'today' | 'yesterday' | 'thisWeek' | 'older';

function getTimeGroup(timestamp: string): TimeGroup {
  if (!timestamp) return 'older';
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'thisWeek';
  return 'older';
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

      // Load from Supabase (cloud projects) FIRST — this is the primary source
      const sb = getSupabase();
      const currentUser = user || authStore.get().user;
      if (sb && currentUser) {
        try {
          const { data, error } = await sb
            .from('projects')
            .select('id, name, description, logo, updated_at, created_at')
            .eq('owner_id', currentUser.id)
            .order('updated_at', { ascending: false });
          if (!error && data) {
            for (const p of data) {
              cardMap.set(p.id, {
                id: p.id,
                name: p.name || t('projects.untitled'),
                description: p.description || '',
                logo: p.logo || '',
                timestamp: p.updated_at || p.created_at || '',
                messageCount: 0, // Will be populated from IndexedDB below
                source: 'cloud',
              });
            }
          } else if (error) {
            console.error('[Projects] Supabase query error:', error.message, 'for user:', currentUser.id);
          }
        } catch (error) {
          console.error('Failed to load from Supabase:', error);
        }
      }

      // Load from IndexedDB (chat history) — merge with cloud data
      try {
        const database = await getDb();
        if (database) {
          const list = await getAll(database);
          const filtered = list.filter((item) => item.urlId && item.description);
          for (const item of filtered) {
            const existing = cardMap.get(item.urlId || item.id);
            if (!existing) {
              cardMap.set(item.urlId || item.id, {
                id: item.urlId || item.id,
                name: item.description || t('projects.untitled'),
                description: '',
                logo: '',
                timestamp: item.timestamp,
                messageCount: item.messages?.length || 0,
                source: 'local',
              });
            } else {
              // Merge message count from IndexedDB into cloud project
              const msgCount = item.messages?.length || 0;
              if (msgCount > 0) {
                cardMap.set(existing.id, { ...existing, messageCount: msgCount });
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load from IndexedDB:', error);
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
      // Also populate the projectsStore for sidebar
      if (currentUserId) {
        loadAllProjectsFromSupabase().catch(() => {});
      }
      loadProjects();
    }
  }, [user, loadProjects]);

  // Initial load
  useEffect(() => {
    loadProjects();
  }, []);

  // Retry loading cloud projects after auth is fully initialized
  useEffect(() => {
    if (!user) return;
    const timeout = setTimeout(() => {
      loadProjects();
    }, 2000);
    return () => clearTimeout(timeout);
  }, [user]);

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
      const success = await deleteProject(project.id);
      if (success) {
        toast.success(t('projects.projectDeleted'));
        loadProjects();
      } else {
        toast.error(t('projects.deleteFailed'));
      }
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

  // Group projects by time period
  const groupedProjects = filtered.reduce<Record<TimeGroup, ProjectCard[]>>((acc, project) => {
    const group = getTimeGroup(project.timestamp);
    if (!acc[group]) acc[group] = [];
    acc[group].push(project);
    return acc;
  }, { today: [], yesterday: [], thisWeek: [], older: [] });

  const groupLabels: Record<TimeGroup, string> = {
    today: t('projects.today'),
    yesterday: t('projects.yesterday'),
    thisWeek: t('projects.thisWeek'),
    older: t('projects.older'),
  };

  const groupOrder: TimeGroup[] = ['today', 'yesterday', 'thisWeek', 'older'];

  return (
    <div className="flex-1 overflow-auto bg-bolt-elements-bg-depth-1">
      <div className="max-w-7xl mx-auto p-6">
        {/* Page header - modern gradient background */}
        <div className="relative mb-8 p-6 rounded-2xl bg-gradient-to-br from-bolt-elements-bg-depth-2 via-bolt-elements-bg-depth-1 to-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-violet-500/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-500/5 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/10 border border-violet-500/20 flex items-center justify-center">
                  <div className="i-ph:folder-simple-star text-xl text-violet-400" />
                </div>
                <h1 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('projects.title')}</h1>
              </div>
              <p className="text-sm text-bolt-elements-textTertiary">
                <span className="font-semibold text-bolt-elements-textPrimary">{projects.length}</span>
                <span className="mx-1">/</span>
                <span>{MAX_PROJECTS_PER_USER}</span>
                <span className="ml-1.5">{t('projects.count')}</span>
              </p>
            </div>
            <button
              onClick={handleNewProject}
              disabled={projects.length >= MAX_PROJECTS_PER_USER}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500/90 to-blue-500/90 text-white hover:from-violet-500 hover:to-blue-500 text-sm font-semibold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="i-ph:plus text-base" />
              {t('projects.newProject')}
              <div className="i-ph:arrow-right text-sm opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>

        {/* Search bar - modern style */}
        {projects.length > 0 && (
          <div className="mb-8">
            <div className="relative max-w-md group">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-blue-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center gap-3 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-xl px-4 py-2.5 focus-within:border-violet-500/50 focus-within:bg-bolt-elements-bg-depth-1 transition-all duration-200">
                <div className="i-ph:magnifying-glass text-base text-bolt-elements-textTertiary group-focus-within:text-violet-400 transition-colors" />
                <input
                  type="text"
                  placeholder={t('projects.searchProjects')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none"
                />
                {search ? (
                  <button
                    onClick={() => setSearch('')}
                    className="w-6 h-6 rounded-lg bg-bolt-elements-bg-depth-3 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-all"
                  >
                    <div className="i-ph:x text-xs" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-bolt-elements-textTertiary bg-bolt-elements-bg-depth-3 rounded border border-bolt-elements-borderColor">
                    <span>/</span>
                  </kbd>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 overflow-hidden animate-pulse">
                <div className="w-full h-40 bg-gradient-to-br from-bolt-elements-bg-depth-3 to-bolt-elements-bg-depth-2" />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-3/4 bg-bolt-elements-bg-depth-3 rounded-lg" />
                  <div className="h-4 w-1/2 bg-bolt-elements-bg-depth-3 rounded-lg" />
                  <div className="h-3 w-1/3 bg-bolt-elements-bg-depth-3 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Projects grouped by time - modern layout with previews */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-10">
            {groupOrder.map((group) => {
              const projectsInGroup = groupedProjects[group];
              if (projectsInGroup.length === 0) return null;
              
              return (
                <div key={group}>
                  {/* Section header - modern style */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${group === 'today' ? 'bg-violet-500/20 text-violet-400' : group === 'yesterday' ? 'bg-blue-500/20 text-blue-400' : group === 'thisWeek' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-bolt-elements-bg-depth-3 text-bolt-elements-textTertiary'}`}>
                      <div className={group === 'today' ? 'i-ph:sun-horizon text-sm' : group === 'yesterday' ? 'i-ph:moon-stars text-sm' : group === 'thisWeek' ? 'i-ph:calendar-blank text-sm' : 'i-ph:clock-clockwise text-sm'} />
                    </div>
                    <h2 className="text-sm font-semibold text-bolt-elements-textSecondary uppercase tracking-wide">
                      {groupLabels[group]}
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-bolt-elements-borderColor/50 to-transparent" />
                    <span className="text-xs text-bolt-elements-textTertiary bg-bolt-elements-bg-depth-2 px-2 py-1 rounded-full">
                      {projectsInGroup.length}
                    </span>
                  </div>

                  {/* Projects grid for this group with previews */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {projectsInGroup.map((project) => (
                      <ProjectCardWithPreview
                        key={project.id}
                        project={project}
                        menuOpenId={menuOpenId}
                        setMenuOpenId={setMenuOpenId}
                        editingId={editingId}
                        setEditingId={setEditingId}
                        editName={editName}
                        setEditName={setEditName}
                        handleRenameProject={handleRenameProject}
                        setDialogContent={setDialogContent}
                        getAccent={getAccent}
                        getIcon={getIcon}
                        formatDate={formatDate}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state - modern illustration style */}
        {!loading && filtered.length === 0 && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            {/* Decorative background */}
            <div className="relative mb-8">
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-violet-500/20 via-blue-500/10 to-transparent flex items-center justify-center border border-violet-500/20 shadow-2xl shadow-violet-500/10">
                <div className="i-ph:folder-simple-plus text-5xl text-violet-400/80" />
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/30 to-orange-400/20 border border-amber-400/20 flex items-center justify-center">
                <div className="i-ph:sparkle text-sm text-amber-400" />
              </div>
              <div className="absolute -bottom-3 -left-3 w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400/30 to-green-400/20 border border-emerald-400/20 flex items-center justify-center">
                <div className="i-ph:star text-xs text-emerald-400" />
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-bolt-elements-textPrimary mb-2">{t('projects.noProjectsYet')}</h3>
            <p className="text-sm text-bolt-elements-textTertiary mb-8 max-w-sm text-center">{t('projects.startNewChat')}</p>
            
            <button
              onClick={handleNewProject}
              className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white font-semibold hover:from-violet-400 hover:to-blue-400 transition-all duration-300 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="i-ph:rocket text-lg" />
              {t('projects.newProject')}
              <div className="i-ph:arrow-right text-sm opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        )}

        {/* Search empty state - modern style */}
        {!loading && filtered.length === 0 && projects.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-bolt-elements-bg-depth-2 to-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor flex items-center justify-center shadow-inner">
                <div className="i-ph:magnifying-glass text-3xl text-bolt-elements-textTertiary" />
              </div>
              {/* Search ring decoration */}
              <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-bolt-elements-borderColor -m-2" />
            </div>
            <p className="text-base font-semibold text-bolt-elements-textPrimary mb-1">{t('projects.noResults')}</p>
            <p className="text-sm text-bolt-elements-textTertiary">{t('projects.tryAdjustingSearch')}</p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-violet-500/30 transition-all"
              >
                <div className="i-ph:x text-sm" />
                {t('projects.clearSearch')}
              </button>
            )}
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

/* ===== Project Card with Preview Component ===== */
interface ProjectCardProps {
  project: ProjectCard;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  editName: string;
  setEditName: (name: string) => void;
  handleRenameProject: (id: string, name: string) => void;
  setDialogContent: (content: { type: 'delete'; project: ProjectCard } | null) => void;
  getAccent: (id: string) => string;
  getIcon: (id: string) => string;
  formatDate: (timestamp: string) => string;
  t: (key: string) => string;
}

function ProjectCardWithPreview({
  project,
  menuOpenId,
  setMenuOpenId,
  editingId,
  setEditingId,
  editName,
  setEditName,
  handleRenameProject,
  setDialogContent,
  getAccent,
  getIcon,
  formatDate,
  t,
}: ProjectCardProps) {
  const [imageError, setImageError] = useState(false);
  const accent = getAccent(project.id);
  
  // Generate preview URL - fallback to gradient if screenshot fails
  const previewUrl = !imageError ? `/api/screenshot?url=${encodeURIComponent(`https://preview.omnibuilder.dev/project/${project.id}`)}` : null;

  return (
    <div
      className={`group rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300 relative ${menuOpenId === project.id ? 'z-[10000] overflow-visible' : 'overflow-hidden'}`}
    >
      {/* Card visual header with preview */}
      <a href={`/chat/${project.id}`} className="block">
        <div className={`relative w-full h-40 bg-gradient-to-br ${accent} overflow-hidden`}>
          {/* Decorative grid pattern */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '20px 20px'
          }} />
          
          {/* Preview image overlay */}
          {previewUrl && !imageError && (
            <div className="absolute inset-0">
              <img
                src={previewUrl}
                alt={`${project.name} preview`}
                className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-500"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bolt-elements-bg-depth-2 via-transparent to-transparent" />
            </div>
          )}
          
          <div className="absolute inset-0 flex items-center justify-center">
            {project.logo ? (
              <img src={project.logo} alt="" className="w-14 h-14 rounded-xl shadow-xl ring-2 ring-white/10" />
            ) : (
              <div className={`${getIcon(project.id)} text-5xl text-white/10 group-hover:text-white/20 group-hover:scale-110 transition-all duration-500`} />
            )}
          </div>
          
          {/* Hover overlay - glass morphism */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 flex items-end justify-center pb-4 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-bolt-elements-item-backgroundActive/60 backdrop-blur-md flex items-center justify-center shadow-lg ring-2 ring-bolt-elements-borderColor/40">
              <div className="i-ph:play-bold text-xl text-bolt-elements-textPrimary" />
            </div>
          </div>
          
          {/* Source badge - modern pill */}
          {project.source === 'cloud' && (
            <span className="absolute top-3 left-3 flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-violet-500/30 backdrop-blur-md text-violet-200 font-semibold border border-violet-400/20">
              <div className="i-ph:cloud text-xs" />
              {t('sidebar.cloud')}
            </span>
          )}
          
          {/* Preview indicator badge */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-md text-white/60 text-[10px] opacity-0 group-hover:opacity-100 transition-all duration-200">
            <div className="i-ph:image text-xs" />
            <span>Preview</span>
          </div>
          
          {/* Menu button - glass effect */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpenId(menuOpenId === project.id ? null : project.id);
            }}
            className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-black/40 backdrop-blur-md text-white/60 hover:text-white hover:bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-white/10 hover:border-white/20"
          >
            <div className="i-ph:dots-three-vertical text-base" />
          </button>
        </div>
      </a>

      {/* Dropdown menu - modern glass morphism */}
      {menuOpenId === project.id && (
        <div className="absolute top-40 right-3 z-[9999] w-48 bg-bolt-elements-bg-depth-2/95 backdrop-blur-xl border border-bolt-elements-borderColor rounded-xl shadow-2xl shadow-black/30 overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="p-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(null);
                setEditingId(project.id);
                setEditName(project.name);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left rounded-lg"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <div className="i-ph:pencil-simple text-sm" />
              </div>
              {t('projects.rename')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(null);
                navigator.clipboard.writeText(`${window.location.origin}/chat/${project.id}`);
                toast.success(t('projects.linkCopied'));
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left rounded-lg"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <div className="i-ph:link text-sm" />
              </div>
              {t('projects.copyLink')}
            </button>
            <div className="h-px bg-bolt-elements-borderColor my-1.5" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(null);
                setDialogContent({ type: 'delete', project });
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-left rounded-lg"
            >
              <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
                <div className="i-ph:trash text-sm" />
              </div>
              {t('projects.delete')}
            </button>
          </div>
        </div>
      )}

      {/* Card content - modern typography */}
      <div className="p-5">
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
              className="flex-1 px-3 py-2 bg-bolt-elements-bg-depth-3 border border-violet-500/50 rounded-lg text-sm text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
            />
            <button
              onClick={() => handleRenameProject(project.id, editName)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500 text-white hover:bg-emerald-400 transition-all"
            >
              <div className="i-ph:check text-sm" />
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-bolt-elements-bg-depth-3 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-red-500/10 hover:text-red-400 transition-all"
            >
              <div className="i-ph:x text-sm" />
            </button>
          </div>
        ) : (
          <a href={`/chat/${project.id}`} className="block">
            <h3 className="text-base font-semibold text-bolt-elements-textPrimary truncate group-hover:text-violet-400 transition-colors mb-1">
              {project.name || t('projects.untitled')}
            </h3>
          </a>
        )}
        {project.description && (
          <p className="text-xs text-bolt-elements-textTertiary truncate mb-3">{project.description}</p>
        )}
        <div className="flex items-center gap-4 text-[11px] text-bolt-elements-textTertiary">
          {project.timestamp && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-bolt-elements-bg-depth-3">
              <div className="i-ph:clock text-xs" />
              <span>{formatDate(project.timestamp)}</span>
            </div>
          )}
          {project.messageCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-bolt-elements-bg-depth-3">
              <div className="i-ph:chat-circle-dots text-xs" />
              <span>{project.messageCount} {t('projects.messages')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

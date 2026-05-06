import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useState, useEffect, useCallback } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { toast } from 'react-toastify';
import { Header } from '~/components/header/Header';
import { Menu } from '~/components/sidebar/Menu.client';
import { db, getAll, type ChatHistoryItem } from '~/lib/persistence';

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
    <div className="flex-1 overflow-auto bg-bolt-elements-background p-6">
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

/* ===== Main client content ===== */
function ProjectsContent() {
  const [projects, setProjects] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadProjects = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setProjects)
        .catch((error) => toast.error(error.message))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filtered = search
    ? projects.filter((p) => p.description?.toLowerCase().includes(search.toLowerCase()))
    : projects;

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  const handleNewProject = () => {
    window.location.href = '/';
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
    <div className="flex-1 overflow-auto bg-bolt-elements-background">
      <div className="max-w-6xl mx-auto p-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-bolt-elements-textPrimary">Projects</h1>
            <p className="text-sm text-bolt-elements-textTertiary mt-1">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleNewProject}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover text-sm font-medium transition-all"
          >
            <div className="i-ph:plus text-base" />
            New Project
          </button>
        </div>

        {/* Search bar */}
        {projects.length > 0 && (
          <div className="mb-6">
            <div className="relative max-w-md">
              <div className="i-ph:magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sm text-bolt-elements-textTertiary" />
              <input
                type="text"
                placeholder="Search projects..."
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
              <a
                key={project.id}
                href={`/chat/${project.urlId}`}
                className="group rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 overflow-hidden hover:border-bolt-elements-borderColorActive hover:shadow-lg transition-all duration-200"
              >
                {/* Card visual header */}
                <div className={`relative w-full h-28 bg-gradient-to-br ${getAccent(project.id)} overflow-hidden`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`${getIcon(project.id)} text-4xl text-bolt-elements-textTertiary/20 group-hover:scale-110 transition-transform duration-300`} />
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-bolt-elements-item-backgroundAccent/0 group-hover:bg-bolt-elements-item-backgroundAccent/30 flex items-center justify-center transition-all duration-200">
                    <div className="w-10 h-10 rounded-full bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-200 shadow-lg">
                      <div className="i-ph:arrow-right text-lg" />
                    </div>
                  </div>
                </div>

                {/* Card content */}
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary truncate group-hover:text-bolt-elements-item-contentAccent transition-colors">
                    {project.description || 'Untitled'}
                  </h3>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-bolt-elements-textTertiary">
                    <div className="i-ph:clock text-xs" />
                    <span>{formatDate(project.timestamp)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-bolt-elements-textTertiary">
                    <div className="i-ph:chat-circle-dots text-xs" />
                    <span>{project.messages?.length || 0} messages</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-20 h-20 rounded-2xl bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor flex items-center justify-center mx-auto mb-5">
              <div className="i-ph:folder-open text-4xl text-bolt-elements-textTertiary" />
            </div>
            <p className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">No projects yet</p>
            <p className="text-sm text-bolt-elements-textTertiary mb-6">Start a new chat to create your first project</p>
            <button
              onClick={handleNewProject}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover text-sm font-medium transition-all"
            >
              <div className="i-ph:plus text-base" />
              New Project
            </button>
          </div>
        )}

        {/* Search empty state */}
        {!loading && filtered.length === 0 && projects.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-xl bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor flex items-center justify-center mx-auto mb-4">
              <div className="i-ph:magnifying-glass text-2xl text-bolt-elements-textTertiary" />
            </div>
            <p className="text-sm font-medium text-bolt-elements-textPrimary mb-1">No results found</p>
            <p className="text-sm text-bolt-elements-textTertiary">Try adjusting your search terms</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { type MetaFunction } from '@remix-run/cloudflare';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { authStore } from '~/lib/stores/auth';
import { useT } from '~/lib/i18n/useT';

export const meta: MetaFunction = () => {
  return [
    { title: 'Galeria — Omni-Builder' },
    { name: 'description', content: 'Explore projetos publicados pela comunidade no Omni-Builder Gallery.' },
  ];
};

interface GalleryProject {
  id: string;
  author_id?: string;
  author_name: string;
  name: string;
  description: string;
  thumbnail: string;
  cover_image: string;
  logo: string;
  tags: string[];
  category: string;
  likes: number;
  views: number;
  is_featured: boolean;
  published_at: string;
}

const CATEGORIES = [
  { id: 'all', nameKey: 'gallery.all', icon: 'i-ph:squares-four' },
  { id: 'web-apps', nameKey: 'gallery.webApps', icon: 'i-ph:globe-duotone' },
  { id: 'games', nameKey: 'gallery.games', icon: 'i-ph:game-controller-duotone' },
  { id: 'business', nameKey: 'gallery.business', icon: 'i-ph:briefcase-duotone' },
  { id: 'education', nameKey: 'gallery.education', icon: 'i-ph:graduation-cap-duotone' },
  { id: 'tools', nameKey: 'gallery.tools', icon: 'i-ph:wrench-duotone' },
  { id: 'dashboard', nameKey: 'gallery.dashboards', icon: 'i-ph:chart-bar-duotone' },
  { id: 'social', nameKey: 'gallery.social', icon: 'i-ph:chat-circle-dots-duotone' },
  { id: 'ecommerce', nameKey: 'gallery.ecommerce', icon: 'i-ph:shopping-cart-duotone' },
];

const SORT_OPTIONS = [
  { id: 'newest', labelKey: 'gallery.newest', icon: 'i-ph:clock-counter-clockwise' },
  { id: 'popular', labelKey: 'gallery.popular', icon: 'i-ph:heart' },
  { id: 'most-viewed', labelKey: 'gallery.mostViewed', icon: 'i-ph:eye' },
  { id: 'featured', labelKey: 'gallery.featured', icon: 'i-ph:star' },
];

const CARD_GRADIENTS = [
  'from-violet-600/30 via-purple-500/20 to-fuchsia-500/30',
  'from-blue-600/30 via-cyan-500/20 to-teal-500/30',
  'from-rose-600/30 via-pink-500/20 to-orange-500/30',
  'from-emerald-600/30 via-green-500/20 to-lime-500/30',
  'from-amber-600/30 via-yellow-500/20 to-orange-400/30',
  'from-indigo-600/30 via-blue-500/20 to-cyan-500/30',
  'from-fuchsia-600/30 via-pink-500/20 to-rose-500/30',
  'from-teal-600/30 via-emerald-500/20 to-green-400/30',
];

function getGradientForProject(project: GalleryProject): string {
  const hash = project.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length];
}

type ViewMode = 'grid' | 'list';
type GalleryTab = 'explore' | 'my';

function GalleryContent() {
  const t = useT();
  const [projects, setProjects] = useState<GalleryProject[]>([]);
  const [myProjects, setMyProjects] = useState<GalleryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [tab, setTab] = useState<GalleryTab>('explore');
  const [selectedProject, setSelectedProject] = useState<GalleryProject | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const navigate = useNavigate();
  const { user } = useStore(authStore);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useCallback((value: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setSearch(value), 300);
  }, []);

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortOpen]);

  const fetchProjects = useCallback(async (loadMore = false) => {
    if (!loadMore) setLoading(true);
    try {
      const offset = loadMore ? projects.length : 0;
      const params = new URLSearchParams({ limit: '24', offset: String(offset), category, sort });
      if (search) params.set('search', search);

      const res = await fetch(`/api/gallery?${params}`);
      const data = await res.json();

      if (data.projects) {
        setProjects((prev) => loadMore ? [...prev, ...data.projects] : data.projects);
        setTotal(data.total || 0);
        setHasMore((loadMore ? projects.length + data.projects.length : data.projects.length) < (data.total || 0));
      }
    } catch (err) {
      console.error('Failed to fetch gallery:', err);
    } finally {
      setLoading(false);
    }
  }, [category, search, sort, projects.length]);

  const fetchMyProjects = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'my', userId: user.id }),
      });
      const data = await res.json();
      if (data.projects) setMyProjects(data.projects);
    } catch (err) {
      console.error('Failed to fetch my projects:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (tab === 'my') fetchMyProjects();
  }, [tab, fetchMyProjects]);

  const featuredProjects = useMemo(() => projects.filter((p) => p.is_featured), [projects]);
  const regularProjects = useMemo(() => projects.filter((p) => !p.is_featured), [projects]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t('gallery.today');
    if (diffDays === 1) return t('gallery.yesterday');
    if (diffDays < 7) return t('gallery.daysAgo', { count: diffDays });
    if (diffDays < 30) return t('gallery.weeksAgo', { count: Math.floor(diffDays / 7) });
    if (diffDays < 365) return t('gallery.monthsAgo', { count: Math.floor(diffDays / 30) });
    return date.toLocaleDateString();
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return String(num);
  };

  const handleShare = async (e: React.MouseEvent, project: GalleryProject) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?gallery=${project.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback
    }
  };

  const displayProjects = tab === 'my' ? myProjects : (featuredProjects.length > 0 && category === 'all' && !search && sort === 'newest' ? regularProjects : projects);

  const currentSortKey = SORT_OPTIONS.find((o) => o.id === sort)?.labelKey || 'gallery.newest';

  return (
    <div className="min-h-screen bg-bolt-elements-bg-depth-1 text-bolt-elements-textPrimary">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-bolt-elements-bg-depth-1/70 border-b border-bolt-elements-borderColor">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors">
              <div className="i-ph:arrow-left text-lg" />
            </a>
            <a href="/" className="flex items-center">
              <img src="/omni-builder-logo.svg" alt="Omni" className="h-7 omni-logo-themed" />
            </a>
            <div className="hidden sm:block w-px h-5 bg-bolt-elements-borderColor" />
            <span className="hidden sm:flex items-center gap-2 text-sm font-semibold text-bolt-elements-textPrimary">
              <div className="i-ph:storefront-duotone text-indigo-400" />
              {t('gallery.gallery')}
            </span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <div className="i-ph:magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary text-sm" />
            <input
              type="text"
              placeholder={t('gallery.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); debouncedSearch(e.target.value); }}
              className="w-full pl-9 pr-4 py-2 bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor rounded-xl text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearch(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary transition-colors"
              >
                <div className="i-ph:x text-sm" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="hidden md:flex items-center bg-bolt-elements-bg-depth-3 rounded-lg border border-bolt-elements-borderColor p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary' : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary'}`}
                title={t('gallery.grid')}
              >
                <div className="i-ph:squares-four text-sm" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary' : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary'}`}
                title={t('gallery.list')}
              >
                <div className="i-ph:list text-sm" />
              </button>
            </div>

            <a
              href="/"
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 transition-all"
            >
              <div className="i-ph:plus-circle text-base" />
              {t('gallery.createProject')}
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero Banner */}
        {tab === 'explore' && !loading && projects.length > 0 && category === 'all' && !search && sort === 'newest' && (
          <section className="mb-8">
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-bolt-elements-borderColor">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/[0.08] via-purple-600/[0.12] via-40% to-fuchsia-600/[0.08]" />
              <div className="absolute top-0 right-[20%] w-[400px] h-[400px] bg-indigo-500/[0.07] rounded-full blur-[100px] -translate-y-1/2" />
              <div className="absolute bottom-0 left-[10%] w-[300px] h-[300px] bg-purple-500/[0.07] rounded-full blur-[80px] translate-y-1/2" />
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <div className="relative z-10 px-6 py-8 sm:px-12 sm:py-12">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-xs font-medium text-indigo-300/80 uppercase tracking-widest">{t('gallery.community')}</span>
                </div>
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-bolt-elements-textPrimary mb-3 tracking-tight">
                  {t('gallery.galleryTitle')}{' '}
                  <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                    Omni Builder
                  </span>
                </h1>
                <p className="text-sm sm:text-lg text-bolt-elements-textSecondary max-w-xl mb-6 leading-relaxed">
                  {t('gallery.heroSubtitle')}
                </p>
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  <a
                    href="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover shadow-lg shadow-bolt-elements-item-contentAccent/20 transition-all"
                  >
                    <div className="i-ph:plus-circle text-base" />
                    {t('gallery.createProject')}
                  </a>
                  <div className="flex items-center gap-4 sm:gap-5 text-sm text-bolt-elements-textTertiary">
                    <span className="flex items-center gap-1.5">
                      <div className="i-ph:cube-duotone text-base text-indigo-400/60" />
                      {total} {t('gallery.projectsCount')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="i-ph:sparkle text-base text-purple-400/60" />
                      {t('gallery.madeWithAI')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tabs: Explore / My Projects */}
        {user && (
          <div className="flex items-center gap-1 mb-6 p-1 bg-bolt-elements-bg-depth-2 rounded-xl border border-bolt-elements-borderColor w-fit">
            <button
              onClick={() => setTab('explore')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'explore'
                  ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary shadow-sm'
                  : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary'
              }`}
            >
              <div className="i-ph:compass-duotone text-sm" />
              {t('gallery.explore')}
            </button>
            <button
              onClick={() => setTab('my')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'my'
                  ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary shadow-sm'
                  : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary'
              }`}
            >
              <div className="i-ph:user-circle-duotone text-sm" />
              {t('gallery.myProjects')}
              {myProjects.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                  {myProjects.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Filters row: Categories + Sort + Results count */}
        {tab === 'explore' && (
          <div className="flex flex-col gap-4 mb-6">
            {/* Category pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    category === cat.id
                      ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text shadow-md shadow-bolt-elements-item-contentAccent/20'
                      : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor'
                  }`}
                >
                  <div className={`${cat.icon} text-sm`} />
                  {t(cat.nameKey)}
                </button>
              ))}
            </div>

            {/* Sort + results count row */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-bolt-elements-textTertiary">
                {loading ? t('gallery.loading') : `${total} ${t('gallery.projectsCount')} ${t('gallery.found')}`}
              </span>

              {/* Sort dropdown */}
              <div ref={sortRef} className="relative">
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-bolt-elements-borderColorActive transition-all"
                >
                  <div className={`${SORT_OPTIONS.find((o) => o.id === sort)?.icon || 'i-ph:sort-ascending'} text-sm`} />
                  {t(currentSortKey)}
                  <div className={`i-ph:caret-down text-[10px] transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
                </button>

                {sortOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-50 overflow-hidden p-1">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => { setSort(opt.id); setSortOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                          sort === opt.id
                            ? 'bg-indigo-500/20 text-indigo-300 font-medium'
                            : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive'
                        }`}
                      >
                        <div className={`${opt.icon} text-sm`} />
                        {t(opt.labelKey)}
                        {sort === opt.id && (
                          <div className="i-ph:check text-xs ml-auto text-indigo-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Featured Projects - Large horizontal cards */}
        {tab === 'explore' && featuredProjects.length > 0 && category === 'all' && !search && sort === 'newest' && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="i-ph:sparkle-fill text-amber-400 text-base" />
              <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">{t('gallery.featured')}</h2>
              <span className="text-xs text-bolt-elements-textTertiary ml-1">({featuredProjects.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredProjects.map((project, i) => (
                <div key={project.id} style={{ animationDelay: `${i * 80}ms` }} className="animate-[fadeInUp_0.4s_ease-out_forwards] opacity-0">
                  <FeaturedCard project={project} formatDate={formatDate} formatNumber={formatNumber} onShare={handleShare} onSelect={setSelectedProject} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section header for regular projects */}
        {tab === 'explore' && featuredProjects.length > 0 && category === 'all' && !search && sort === 'newest' && regularProjects.length > 0 && (
          <div className="flex items-center gap-2 mb-4 mt-8">
            <div className="i-ph:clock-duotone text-blue-400 text-base" />
            <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">{t('gallery.recent')}</h2>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
            : 'flex flex-col gap-3'
          }>
            {Array.from({ length: 8 }).map((_, i) => (
              viewMode === 'grid' ? (
                <div key={i} className="rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 overflow-hidden animate-pulse">
                  <div className="w-full aspect-[16/10] bg-bolt-elements-bg-depth-3" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 w-3/4 bg-bolt-elements-bg-depth-4 rounded-lg" />
                    <div className="h-3 w-full bg-bolt-elements-bg-depth-3 rounded-lg" />
                    <div className="flex justify-between pt-2">
                      <div className="h-3 w-20 bg-bolt-elements-bg-depth-3 rounded-lg" />
                      <div className="h-3 w-16 bg-bolt-elements-bg-depth-3 rounded-lg" />
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-center gap-4 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 p-4 animate-pulse">
                  <div className="w-16 h-12 rounded-lg bg-bolt-elements-bg-depth-3 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 bg-bolt-elements-bg-depth-4 rounded-lg" />
                    <div className="h-3 w-2/3 bg-bolt-elements-bg-depth-3 rounded-lg" />
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* Projects Grid / List */}
        {!loading && displayProjects.length > 0 && (
          <>
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
              : 'flex flex-col gap-3'
            }>
              {(tab === 'explore'
                ? (featuredProjects.length > 0 && category === 'all' && !search && sort === 'newest' ? regularProjects : projects)
                : myProjects
              ).map((project, i) => (
                <div key={project.id} style={{ animationDelay: `${i * 50}ms` }} className="animate-[fadeInUp_0.35s_ease-out_forwards] opacity-0">
                  {viewMode === 'grid' ? (
                    <ProjectCard project={project} formatDate={formatDate} formatNumber={formatNumber} onShare={handleShare} onSelect={setSelectedProject} />
                  ) : (
                    <ListCard project={project} formatDate={formatDate} formatNumber={formatNumber} onShare={handleShare} onSelect={setSelectedProject} />
                  )}
                </div>
              ))}
            </div>

            {/* Load More */}
            {tab === 'explore' && hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => fetchProjects(true)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:bg-bolt-elements-bg-depth-4 hover:border-bolt-elements-borderColorActive transition-all"
                >
                  <div className="i-ph:arrow-clockwise text-sm" />
                  {t('gallery.loadMore')}
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && displayProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-bolt-elements-borderColor flex items-center justify-center">
                {tab === 'my' ? (
                  <div className="i-ph:folder-open text-4xl text-bolt-elements-textTertiary" />
                ) : (
                  <div className="i-ph:storefront text-4xl text-bolt-elements-textTertiary" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <div className="i-ph:plus text-sm text-indigo-400" />
              </div>
            </div>
            <p className="text-xl font-semibold text-bolt-elements-textSecondary mb-2">
              {tab === 'my' ? t('gallery.noProjectsPublished') : t('gallery.noProjectsFound')}
            </p>
            <p className="text-sm text-bolt-elements-textTertiary mb-6 max-w-md text-center">
              {search
                ? t('gallery.tryAdjusting')
                : tab === 'my'
                  ? t('gallery.publishFirst')
                  : t('gallery.beFirst')}
            </p>
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 transition-all"
              >
                <div className="i-ph:plus-circle text-base" />
                {t('gallery.createProject')}
              </a>
              {search && (
                <button
                  onClick={() => { setSearch(''); setSearchInput(''); setCategory('all'); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-bolt-elements-bg-depth-3 text-bolt-elements-textSecondary hover:bg-bolt-elements-bg-depth-4 border border-bolt-elements-borderColor transition-all"
                >
                  <div className="i-ph:arrow-counter-clockwise text-base" />
                  {t('gallery.clearFilters')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* My Projects empty state - not published yet */}
        {tab === 'my' && !loading && myProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor flex items-center justify-center mx-auto mb-5">
              <div className="i-ph:rocket-launch text-4xl text-bolt-elements-textTertiary" />
            </div>
            <p className="text-lg font-semibold text-bolt-elements-textSecondary mb-2">{t('gallery.publishYourFirst')}</p>
            <p className="text-sm text-bolt-elements-textTertiary mb-6 max-w-sm text-center">
              {t('gallery.createIncredible')}
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 transition-all"
            >
              <div className="i-ph:plus-circle text-base" />
              {t('gallery.createAndPublish')}
            </a>
          </div>
        )}
      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          formatDate={formatDate}
          formatNumber={formatNumber}
          onClose={() => setSelectedProject(null)}
          onOpen={() => {
            navigate(`/?gallery=${selectedProject.id}`);
            setSelectedProject(null);
          }}
          onShare={handleShare}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-bolt-elements-borderColor mt-16">
        <div className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-bolt-elements-textTertiary">
          <div className="flex items-center gap-3">
            <span>{t('gallery.galleryFooter')}</span>
            <span className="text-bolt-elements-textTertiary">·</span>
            <span>{t('gallery.madeWithAIFooter')}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/gallery" className="hover:text-bolt-elements-textSecondary transition-colors">{t('gallery.gallery')}</a>
            <a href="/" className="hover:text-bolt-elements-textSecondary transition-colors">{t('gallery.editor')}</a>
          </div>
        </div>
      </footer>

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ============================================
   Project Detail Modal
   ============================================ */
function ProjectDetailModal({
  project,
  formatDate,
  formatNumber,
  onClose,
  onOpen,
  onShare,
}: {
  project: GalleryProject;
  formatDate: (d: string) => string;
  formatNumber: (n: number) => string;
  onClose: () => void;
  onOpen: () => void;
  onShare: (e: React.MouseEvent, p: GalleryProject) => void;
}) {
  const t = useT();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(project.likes);
  const mainImage = project.cover_image || project.thumbnail;
  const hasImage = !!mainImage;
  const catInfo = CATEGORIES.find((c) => c.id === project.category);
  const gradient = getGradientForProject(project);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((prev) => prev + (newLiked ? 1 : -1));
    try {
      await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', projectId: project.id }),
      });
    } catch {
      setLiked(!newLiked);
      setLikeCount((prev) => prev + (newLiked ? -1 : 1));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-black/40 backdrop-blur-sm border border-bolt-elements-borderColor flex items-center justify-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-bolt-elements-borderColorActive transition-all"
        >
          <div className="i-ph:x text-sm" />
        </button>

        {/* Cover image */}
        <div className="relative w-full aspect-[16/9] overflow-hidden rounded-t-2xl">
          {!hasImage ? (
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-8xl text-white/10`} />
              </div>
            </div>
          ) : (
            <img
              src={mainImage}
              alt={project.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bolt-elements-bg-depth-2 via-bolt-elements-bg-depth-2/30 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-6 -mt-16 relative z-10">
          <div className="flex items-start gap-4 mb-4">
            {/* Logo */}
            {project.logo ? (
              <img src={project.logo} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-white/10 shadow-xl bg-white" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor flex items-center justify-center shrink-0">
                <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-2xl text-white/50`} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-bolt-elements-textPrimary truncate">{project.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-bolt-elements-textSecondary">{t('gallery.by')} {project.author_name}</span>
                <span className="text-bolt-elements-textTertiary">·</span>
                <span className="text-sm text-bolt-elements-textTertiary">{formatDate(project.published_at)}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mb-4">
            <span className="flex items-center gap-1.5 text-sm text-bolt-elements-textSecondary">
              <div className="i-ph:eye text-base" /> {formatNumber(project.views)} views
            </span>
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? 'text-red-400' : 'text-bolt-elements-textSecondary hover:text-red-400'}`}
            >
              <div className={`${liked ? 'i-ph:heart-fill' : 'i-ph:heart'} text-base`} />
              {formatNumber(likeCount)}
            </button>
            <button
              onClick={(e) => onShare(e, project)}
              className="flex items-center gap-1.5 text-sm text-bolt-elements-textSecondary hover:text-indigo-400 transition-colors"
            >
              <div className="i-ph:share-network text-base" /> {t('gallery.share')}
            </button>
          </div>

          {/* Category + Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {catInfo && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 text-xs font-medium border border-indigo-500/20">
                <div className={`${catInfo.icon} text-xs`} />
                {t(catInfo.nameKey)}
              </span>
            )}
            {project.tags?.map((tag: string) => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-bolt-elements-bg-depth-3 text-[11px] text-bolt-elements-textSecondary border border-bolt-elements-borderColor">
                {tag}
              </span>
            ))}
          </div>

          {/* Description */}
          <p className="text-sm text-bolt-elements-textSecondary leading-relaxed mb-6">
            {project.description || t('gallery.noDescription')}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpen}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 transition-all"
            >
              <div className="i-ph:play-fill text-base" />
              {t('gallery.openProject')}
            </button>
            <button
              onClick={(e) => onShare(e, project)}
              className="flex items-center justify-center w-11 h-11 rounded-xl bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-bg-depth-4 transition-all"
              title={t('gallery.share')}
            >
              <div className="i-ph:share-network text-base" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================
   Featured Card
   ============================================ */
function FeaturedCard({
  project,
  formatDate,
  formatNumber,
  onShare,
  onSelect,
}: {
  project: GalleryProject;
  formatDate: (d: string) => string;
  formatNumber: (n: number) => string;
  onShare: (e: React.MouseEvent, p: GalleryProject) => void;
  onSelect: (p: GalleryProject) => void;
}) {
  const t = useT();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(project.likes);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((prev) => prev + (newLiked ? 1 : -1));
    try {
      await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', projectId: project.id }),
      });
    } catch {
      setLiked(!newLiked);
      setLikeCount((prev) => prev + (newLiked ? -1 : 1));
    }
  };

  const mainImage = project.cover_image || project.thumbnail;
  const hasImage = !!mainImage;
  const catInfo = CATEGORIES.find((c) => c.id === project.category);
  const gradient = getGradientForProject(project);

  return (
    <div
      onClick={() => onSelect(project)}
      className="group relative cursor-pointer rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 overflow-hidden transition-all duration-300 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/[0.06] hover:scale-[1.01]"
    >
      <div className="relative w-full aspect-[16/9] overflow-hidden">
        {!hasImage ? (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-6xl text-white/10`} />
            </div>
          </div>
        ) : (
          <img
            src={mainImage}
            alt={project.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bolt-elements-bg-depth-1 via-bolt-elements-bg-depth-1/40 to-transparent" />

        {/* Featured badge */}
        <div className="absolute top-3 left-3">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/90 text-[10px] font-bold text-black backdrop-blur-sm shadow-sm">
            <div className="i-ph:star-fill text-[9px]" /> {t('gallery.featuredBadge')}
          </span>
        </div>

        {/* Share button */}
        <button
          onClick={(e) => onShare(e, project)}
          className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-black/40 backdrop-blur-sm border border-bolt-elements-borderColor flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
        >
          <div className="i-ph:share-network text-xs" />
        </button>

        {/* Hover action */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary text-sm font-semibold shadow-2xl backdrop-blur-sm">
            <div className="i-ph:play-fill text-base" />
            {t('gallery.openProject')}
          </div>
        </div>

        {/* Logo + name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-end gap-3">
            {project.logo ? (
              <img src={project.logo} alt="" className="w-11 h-11 rounded-xl object-cover border-2 border-white/20 shadow-xl flex-shrink-0 bg-white" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center flex-shrink-0">
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-bolt-elements-textPrimary drop-shadow-lg truncate">{project.name}</h3>
              <p className="text-[11px] text-white/50 truncate mt-0.5">{project.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-bolt-elements-textTertiary">
            <div className="i-ph:user text-xs" /> {project.author_name}
          </span>
          <span className="text-bolt-elements-textTertiary">·</span>
          <span className="text-[11px] text-bolt-elements-textTertiary">{formatDate(project.published_at)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-bolt-elements-textTertiary">
            <div className="i-ph:eye text-xs" /> {formatNumber(project.views)}
          </span>
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-[11px] transition-colors ${liked ? 'text-red-400' : 'text-bolt-elements-textTertiary hover:text-red-400'}`}
          >
            <div className={`${liked ? 'i-ph:heart-fill' : 'i-ph:heart'} text-xs`} />
            {formatNumber(likeCount)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================
   Project Card — Grid view
   ============================================ */
function ProjectCard({
  project,
  formatDate,
  formatNumber,
  onShare,
  onSelect,
}: {
  project: GalleryProject;
  formatDate: (d: string) => string;
  formatNumber: (n: number) => string;
  onShare: (e: React.MouseEvent, p: GalleryProject) => void;
  onSelect: (p: GalleryProject) => void;
}) {
  const t = useT();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(project.likes);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((prev) => prev + (newLiked ? 1 : -1));
    try {
      await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', projectId: project.id }),
      });
    } catch {
      setLiked(!newLiked);
      setLikeCount((prev) => prev + (newLiked ? -1 : 1));
    }
  };

  const mainImage = project.cover_image || project.thumbnail;
  const hasImage = !!mainImage;
  const catInfo = CATEGORIES.find((c) => c.id === project.category);
  const gradient = getGradientForProject(project);

  return (
    <div
      onClick={() => onSelect(project)}
      className="group relative cursor-pointer flex flex-col rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 overflow-hidden transition-all duration-300 hover:border-bolt-elements-borderColorActive hover:shadow-2xl hover:shadow-indigo-500/[0.04]"
    >
      {/* Cover image */}
      <div className="relative w-full aspect-[16/10] overflow-hidden bg-bolt-elements-bg-depth-2">
        {!hasImage ? (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-5xl text-white/[0.08]`} />
            </div>
          </div>
        ) : (
          <img
            src={mainImage}
            alt={project.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bolt-elements-bg-depth-1/80 via-transparent to-transparent" />

        {/* Category badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-black/40 text-white/70 backdrop-blur-sm border border-bolt-elements-borderColor">
            {catInfo ? t(catInfo.nameKey) : project.category}
          </span>
        </div>

        {/* Share button */}
        <button
          onClick={(e) => onShare(e, project)}
          className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md bg-black/40 backdrop-blur-sm border border-bolt-elements-borderColor flex items-center justify-center text-white/50 hover:text-white transition-all opacity-0 group-hover:opacity-100"
        >
          <div className="i-ph:share-network text-[10px]" />
        </button>

        {/* Hover play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="w-12 h-12 rounded-2xl bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary flex items-center justify-center shadow-2xl backdrop-blur-sm transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <div className="i-ph:play-fill text-xl ml-0.5" />
          </div>
        </div>

        {/* Bottom: icon + name on image */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-center gap-2.5">
            {project.logo ? (
              <img src={project.logo} alt="" className="w-8 h-8 rounded-lg object-cover border-2 border-white/20 shadow-lg flex-shrink-0 bg-white" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center flex-shrink-0">
                <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-sm text-white/60`} />
              </div>
            )}
            <h3 className="text-sm font-semibold text-bolt-elements-textPrimary drop-shadow-md truncate">{project.name}</h3>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <p className="text-[11px] text-bolt-elements-textTertiary leading-relaxed line-clamp-2 min-h-[28px]">{project.description}</p>

        {project.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {project.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="px-1.5 py-0.5 rounded-md bg-bolt-elements-bg-depth-3 text-[9px] text-bolt-elements-textTertiary border border-bolt-elements-borderColor">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-bolt-elements-textTertiary truncate max-w-[70px]">{project.author_name}</span>
            <span className="text-bolt-elements-textTertiary">·</span>
            <span className="text-[10px] text-bolt-elements-textTertiary">{formatDate(project.published_at)}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-0.5 text-[10px] text-bolt-elements-textTertiary">
              <div className="i-ph:eye text-[10px]" /> {formatNumber(project.views)}
            </span>
            <button
              onClick={handleLike}
              className={`flex items-center gap-0.5 text-[10px] transition-colors ${liked ? 'text-red-400' : 'text-bolt-elements-textTertiary hover:text-red-400'}`}
            >
              <div className={`${liked ? 'i-ph:heart-fill' : 'i-ph:heart'} text-[10px]`} />
              {formatNumber(likeCount)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================
   List Card — List view
   ============================================ */
function ListCard({
  project,
  formatDate,
  formatNumber,
  onShare,
  onSelect,
}: {
  project: GalleryProject;
  formatDate: (d: string) => string;
  formatNumber: (n: number) => string;
  onShare: (e: React.MouseEvent, p: GalleryProject) => void;
  onSelect: (p: GalleryProject) => void;
}) {
  const t = useT();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(project.likes);
  const catInfo = CATEGORIES.find((c) => c.id === project.category);
  const gradient = getGradientForProject(project);
  const mainImage = project.cover_image || project.thumbnail;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((prev) => prev + (newLiked ? 1 : -1));
    try {
      await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', projectId: project.id }),
      });
    } catch {
      setLiked(!newLiked);
      setLikeCount((prev) => prev + (newLiked ? -1 : 1));
    }
  };

  return (
    <div
      onClick={() => onSelect(project)}
      className="group cursor-pointer flex items-center gap-4 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 p-3 hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-bg-depth-3 transition-all duration-200"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-bolt-elements-bg-depth-2 shrink-0">
        {mainImage ? (
          <img src={mainImage} alt={project.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-lg text-white/20`} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {project.logo ? (
            <img src={project.logo} alt="" className="w-5 h-5 rounded object-cover bg-white shrink-0" />
          ) : (
            <div className="w-5 h-5 rounded bg-bolt-elements-bg-depth-3 flex items-center justify-center shrink-0">
              <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-[10px] text-white/40`} />
            </div>
          )}
          <h3 className="text-sm font-semibold text-bolt-elements-textPrimary truncate">{project.name}</h3>
          {catInfo && (
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-bolt-elements-bg-depth-3 text-bolt-elements-textTertiary border border-bolt-elements-borderColor hidden sm:inline">
              {t(catInfo.nameKey)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-bolt-elements-textTertiary truncate mt-0.5">{project.description}</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="flex items-center gap-1 text-[10px] text-bolt-elements-textTertiary">
          <div className="i-ph:eye text-[10px]" /> {formatNumber(project.views)}
        </span>
        <button
          onClick={handleLike}
          className={`flex items-center gap-1 text-[10px] transition-colors ${liked ? 'text-red-400' : 'text-bolt-elements-textTertiary hover:text-red-400'}`}
        >
          <div className={`${liked ? 'i-ph:heart-fill' : 'i-ph:heart'} text-[10px]`} />
          {formatNumber(likeCount)}
        </button>
        <button
          onClick={(e) => onShare(e, project)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-bg-depth-3 transition-all"
          title={t('gallery.share')}
        >
          <div className="i-ph:share-network text-xs" />
        </button>
        <span className="text-[10px] text-bolt-elements-textTertiary hidden sm:block">{formatDate(project.published_at)}</span>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  return (
    <ClientOnly fallback={<GallerySkeleton />}>
      {() => <GalleryContent />}
    </ClientOnly>
  );
}

function GallerySkeleton() {
  return (
    <div className="min-h-screen bg-bolt-elements-bg-depth-1">
      <nav className="h-16 border-b border-bolt-elements-borderColor" />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="h-48 rounded-3xl bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor mb-10 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 overflow-hidden animate-pulse">
              <div className="w-full aspect-[16/10] bg-bolt-elements-bg-depth-3" />
              <div className="p-5 space-y-3">
                <div className="h-4 w-3/4 bg-bolt-elements-bg-depth-3 rounded-lg" />
                <div className="h-3 w-full bg-bolt-elements-bg-depth-3 rounded-lg" />
                <div className="h-3 w-2/3 bg-bolt-elements-bg-depth-3 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

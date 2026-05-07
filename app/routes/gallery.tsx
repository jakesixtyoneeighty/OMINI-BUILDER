import { type MetaFunction } from '@remix-run/cloudflare';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { authStore } from '~/lib/stores/auth';

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
  { id: 'all', name: 'Todos', icon: 'i-ph:squares-four' },
  { id: 'web-apps', name: 'Web Apps', icon: 'i-ph:globe-duotone' },
  { id: 'games', name: 'Jogos', icon: 'i-ph:game-controller-duotone' },
  { id: 'business', name: 'Negocios', icon: 'i-ph:briefcase-duotone' },
  { id: 'education', name: 'Educacao', icon: 'i-ph:graduation-cap-duotone' },
  { id: 'tools', name: 'Ferramentas', icon: 'i-ph:wrench-duotone' },
  { id: 'dashboard', name: 'Dashboards', icon: 'i-ph:chart-bar-duotone' },
  { id: 'social', name: 'Social', icon: 'i-ph:chat-circle-dots-duotone' },
  { id: 'ecommerce', name: 'E-Commerce', icon: 'i-ph:shopping-cart-duotone' },
];

const SORT_OPTIONS = [
  { id: 'newest', label: 'Mais recentes', icon: 'i-ph:clock-counter-clockwise' },
  { id: 'popular', label: 'Mais populares', icon: 'i-ph:heart' },
  { id: 'most-viewed', label: 'Mais vistos', icon: 'i-ph:eye' },
  { id: 'featured', label: 'Destaques', icon: 'i-ph:star' },
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
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays}d atras`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mes`;
    return date.toLocaleDateString('pt-BR');
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

  const currentSortLabel = SORT_OPTIONS.find((o) => o.id === sort)?.label || 'Mais recentes';

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-[#09090b]/70 border-b border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
              <div className="i-ph:arrow-left text-lg" />
            </a>
            <a href="/" className="flex items-center">
              <img src="/omni-builder-logo.svg" alt="Omni" className="h-7 omni-logo-themed" />
            </a>
            <div className="hidden sm:block w-px h-5 bg-white/10" />
            <span className="hidden sm:flex items-center gap-2 text-sm font-semibold text-white">
              <div className="i-ph:storefront-duotone text-indigo-400" />
              Galeria
            </span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <div className="i-ph:magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
            <input
              type="text"
              placeholder="Buscar projetos, tags, categorias..."
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); debouncedSearch(e.target.value); }}
              className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearch(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <div className="i-ph:x text-sm" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="hidden md:flex items-center bg-white/[0.04] rounded-lg border border-white/[0.06] p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/[0.1] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Grid"
              >
                <div className="i-ph:squares-four text-sm" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/[0.1] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Lista"
              >
                <div className="i-ph:list text-sm" />
              </button>
            </div>

            <a
              href="/"
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 transition-all"
            >
              <div className="i-ph:plus-circle text-base" />
              Criar Projeto
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero Banner */}
        {tab === 'explore' && !loading && projects.length > 0 && category === 'all' && !search && sort === 'newest' && (
          <section className="mb-8">
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/[0.06]">
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
                  <span className="text-xs font-medium text-indigo-300/80 uppercase tracking-widest">Comunidade</span>
                </div>
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 tracking-tight">
                  Galeria do{' '}
                  <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                    Omni Builder
                  </span>
                </h1>
                <p className="text-sm sm:text-lg text-zinc-400 max-w-xl mb-6 leading-relaxed">
                  Explore projetos criados pela comunidade com IA. Se inspire, copie e construa seus proprios apps incriveis.
                </p>
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  <a
                    href="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-200 shadow-lg shadow-white/[0.05] transition-all"
                  >
                    <div className="i-ph:plus-circle text-base" />
                    Criar Projeto
                  </a>
                  <div className="flex items-center gap-4 sm:gap-5 text-sm text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <div className="i-ph:cube-duotone text-base text-indigo-400/60" />
                      {total} projetos
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="i-ph:sparkle text-base text-purple-400/60" />
                      Feito com IA
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tabs: Explore / My Projects */}
        {user && (
          <div className="flex items-center gap-1 mb-6 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit">
            <button
              onClick={() => setTab('explore')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'explore'
                  ? 'bg-white/[0.08] text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className="i-ph:compass-duotone text-sm" />
              Explorar
            </button>
            <button
              onClick={() => setTab('my')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'my'
                  ? 'bg-white/[0.08] text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className="i-ph:user-circle-duotone text-sm" />
              Meus Projetos
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
                      ? 'bg-white text-zinc-900 shadow-md shadow-white/[0.05]'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
                  }`}
                >
                  <div className={`${cat.icon} text-sm`} />
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Sort + results count row */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-600">
                {loading ? 'Carregando...' : `${total} projeto${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
              </span>

              {/* Sort dropdown */}
              <div ref={sortRef} className="relative">
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.12] transition-all"
                >
                  <div className={`${SORT_OPTIONS.find((o) => o.id === sort)?.icon || 'i-ph:sort-ascending'} text-sm`} />
                  {currentSortLabel}
                  <div className={`i-ph:caret-down text-[10px] transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
                </button>

                {sortOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden p-1">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => { setSort(opt.id); setSortOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                          sort === opt.id
                            ? 'bg-indigo-500/20 text-indigo-300 font-medium'
                            : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className={`${opt.icon} text-sm`} />
                        {opt.label}
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
              <h2 className="text-lg font-semibold text-white">Destaques</h2>
              <span className="text-xs text-zinc-600 ml-1">({featuredProjects.length})</span>
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
            <h2 className="text-lg font-semibold text-white">Recentes</h2>
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
                <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-pulse">
                  <div className="w-full aspect-[16/10] bg-white/[0.04]" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 w-3/4 bg-white/[0.06] rounded-lg" />
                    <div className="h-3 w-full bg-white/[0.04] rounded-lg" />
                    <div className="flex justify-between pt-2">
                      <div className="h-3 w-20 bg-white/[0.04] rounded-lg" />
                      <div className="h-3 w-16 bg-white/[0.04] rounded-lg" />
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 animate-pulse">
                  <div className="w-16 h-12 rounded-lg bg-white/[0.04] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 bg-white/[0.06] rounded-lg" />
                    <div className="h-3 w-2/3 bg-white/[0.04] rounded-lg" />
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
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all"
                >
                  <div className="i-ph:arrow-clockwise text-sm" />
                  Carregar mais
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && displayProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/[0.06] flex items-center justify-center">
                {tab === 'my' ? (
                  <div className="i-ph:folder-open text-4xl text-zinc-600" />
                ) : (
                  <div className="i-ph:storefront text-4xl text-zinc-600" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <div className="i-ph:plus text-sm text-indigo-400" />
              </div>
            </div>
            <p className="text-xl font-semibold text-zinc-300 mb-2">
              {tab === 'my' ? 'Nenhum projeto publicado' : 'Nenhum projeto encontrado'}
            </p>
            <p className="text-sm text-zinc-600 mb-6 max-w-md text-center">
              {search
                ? 'Tente ajustar os termos de busca ou filtros'
                : tab === 'my'
                  ? 'Publique seu primeiro projeto na galeria para que todos vejam!'
                  : 'Seja o primeiro a publicar um projeto na comunidade!'}
            </p>
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 transition-all"
              >
                <div className="i-ph:plus-circle text-base" />
                Criar Projeto
              </a>
              {search && (
                <button
                  onClick={() => { setSearch(''); setSearchInput(''); setCategory('all'); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.06] text-zinc-200 hover:bg-white/[0.1] border border-white/[0.08] transition-all"
                >
                  <div className="i-ph:arrow-counter-clockwise text-base" />
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {/* My Projects empty state - not published yet */}
        {tab === 'my' && !loading && myProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
              <div className="i-ph:rocket-launch text-4xl text-zinc-600" />
            </div>
            <p className="text-lg font-semibold text-zinc-300 mb-2">Publique seu primeiro projeto!</p>
            <p className="text-sm text-zinc-600 mb-6 max-w-sm text-center">
              Crie um projeto incrivel com IA e publique na galeria para compartilhar com a comunidade.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 transition-all"
            >
              <div className="i-ph:plus-circle text-base" />
              Criar e Publicar
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
      <footer className="border-t border-white/[0.04] mt-16">
        <div className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <div className="flex items-center gap-3">
            <span>Omni-Builder Gallery</span>
            <span className="text-zinc-800">·</span>
            <span>Projetos feitos com IA</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/gallery" className="hover:text-zinc-400 transition-colors">Galeria</a>
            <a href="/" className="hover:text-zinc-400 transition-colors">Editor</a>
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
        className="relative bg-[#111114] border border-white/[0.08] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-black/40 backdrop-blur-sm border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/[0.2] transition-all"
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#111114] via-[#111114]/30 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-6 -mt-16 relative z-10">
          <div className="flex items-start gap-4 mb-4">
            {/* Logo */}
            {project.logo ? (
              <img src={project.logo} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-white/10 shadow-xl bg-white" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-2xl text-white/50`} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{project.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-zinc-400">por {project.author_name}</span>
                <span className="text-zinc-700">·</span>
                <span className="text-sm text-zinc-500">{formatDate(project.published_at)}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mb-4">
            <span className="flex items-center gap-1.5 text-sm text-zinc-400">
              <div className="i-ph:eye text-base" /> {formatNumber(project.views)} views
            </span>
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? 'text-red-400' : 'text-zinc-400 hover:text-red-400'}`}
            >
              <div className={`${liked ? 'i-ph:heart-fill' : 'i-ph:heart'} text-base`} />
              {formatNumber(likeCount)}
            </button>
            <button
              onClick={(e) => onShare(e, project)}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-indigo-400 transition-colors"
            >
              <div className="i-ph:share-network text-base" /> Compartilhar
            </button>
          </div>

          {/* Category + Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {catInfo && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 text-xs font-medium border border-indigo-500/20">
                <div className={`${catInfo.icon} text-xs`} />
                {catInfo.name}
              </span>
            )}
            {project.tags?.map((tag: string) => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[11px] text-zinc-400 border border-white/[0.06]">
                {tag}
              </span>
            ))}
          </div>

          {/* Description */}
          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
            {project.description || 'Sem descricao disponivel.'}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpen}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 transition-all"
            >
              <div className="i-ph:play-fill text-base" />
              Abrir Projeto
            </button>
            <button
              onClick={(e) => onShare(e, project)}
              className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all"
              title="Compartilhar"
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
      className="group relative cursor-pointer rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all duration-300 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/[0.06] hover:scale-[1.01]"
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent" />

        {/* Featured badge */}
        <div className="absolute top-3 left-3">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/90 text-[10px] font-bold text-black backdrop-blur-sm shadow-sm">
            <div className="i-ph:star-fill text-[9px]" /> Destaque
          </span>
        </div>

        {/* Share button */}
        <button
          onClick={(e) => onShare(e, project)}
          className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-black/40 backdrop-blur-sm border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
        >
          <div className="i-ph:share-network text-xs" />
        </button>

        {/* Hover action */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/[0.95] text-black text-sm font-semibold shadow-2xl backdrop-blur-sm">
            <div className="i-ph:play-fill text-base" />
            Abrir Projeto
          </div>
        </div>

        {/* Logo + name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-end gap-3">
            {project.logo ? (
              <img src={project.logo} alt="" className="w-11 h-11 rounded-xl object-cover border-2 border-white/20 shadow-xl flex-shrink-0 bg-white" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center flex-shrink-0">
                <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-xl text-white/70`} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white drop-shadow-lg truncate">{project.name}</h3>
              <p className="text-[11px] text-white/50 truncate mt-0.5">{project.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
            <div className="i-ph:user text-xs" /> {project.author_name}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-[11px] text-zinc-600">{formatDate(project.published_at)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
            <div className="i-ph:eye text-xs" /> {formatNumber(project.views)}
          </span>
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-[11px] transition-colors ${liked ? 'text-red-400' : 'text-zinc-500 hover:text-red-400'}`}
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
      className="group relative cursor-pointer flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all duration-300 hover:border-white/[0.12] hover:shadow-2xl hover:shadow-indigo-500/[0.04]"
    >
      {/* Cover image */}
      <div className="relative w-full aspect-[16/10] overflow-hidden bg-white/[0.02]">
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b]/80 via-transparent to-transparent" />

        {/* Category badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-black/40 text-white/70 backdrop-blur-sm border border-white/[0.06]">
            {catInfo?.name || project.category}
          </span>
        </div>

        {/* Share button */}
        <button
          onClick={(e) => onShare(e, project)}
          className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md bg-black/40 backdrop-blur-sm border border-white/[0.06] flex items-center justify-center text-white/50 hover:text-white transition-all opacity-0 group-hover:opacity-100"
        >
          <div className="i-ph:share-network text-[10px]" />
        </button>

        {/* Hover play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.95] text-black flex items-center justify-center shadow-2xl backdrop-blur-sm transform scale-75 group-hover:scale-100 transition-transform duration-300">
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
            <h3 className="text-sm font-semibold text-white drop-shadow-md truncate">{project.name}</h3>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2 min-h-[28px]">{project.description}</p>

        {project.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {project.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="px-1.5 py-0.5 rounded-md bg-white/[0.04] text-[9px] text-zinc-500 border border-white/[0.04]">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 truncate max-w-[70px]">{project.author_name}</span>
            <span className="text-zinc-800">·</span>
            <span className="text-[10px] text-zinc-700">{formatDate(project.published_at)}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-0.5 text-[10px] text-zinc-600">
              <div className="i-ph:eye text-[10px]" /> {formatNumber(project.views)}
            </span>
            <button
              onClick={handleLike}
              className={`flex items-center gap-0.5 text-[10px] transition-colors ${liked ? 'text-red-400' : 'text-zinc-600 hover:text-red-400'}`}
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
      className="group cursor-pointer flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-200"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-white/[0.02] shrink-0">
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
            <div className="w-5 h-5 rounded bg-white/[0.06] flex items-center justify-center shrink-0">
              <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-[10px] text-white/40`} />
            </div>
          )}
          <h3 className="text-sm font-semibold text-white truncate">{project.name}</h3>
          {catInfo && (
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.04] text-zinc-500 border border-white/[0.04] hidden sm:inline">
              {catInfo.name}
            </span>
          )}
        </div>
        <p className="text-[11px] text-zinc-500 truncate mt-0.5">{project.description}</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="flex items-center gap-1 text-[10px] text-zinc-600">
          <div className="i-ph:eye text-[10px]" /> {formatNumber(project.views)}
        </span>
        <button
          onClick={handleLike}
          className={`flex items-center gap-1 text-[10px] transition-colors ${liked ? 'text-red-400' : 'text-zinc-600 hover:text-red-400'}`}
        >
          <div className={`${liked ? 'i-ph:heart-fill' : 'i-ph:heart'} text-[10px]`} />
          {formatNumber(likeCount)}
        </button>
        <button
          onClick={(e) => onShare(e, project)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-600 hover:text-white hover:bg-white/[0.06] transition-all"
          title="Compartilhar"
        >
          <div className="i-ph:share-network text-xs" />
        </button>
        <span className="text-[10px] text-zinc-700 hidden sm:block">{formatDate(project.published_at)}</span>
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
    <div className="min-h-screen bg-[#09090b]">
      <nav className="h-16 border-b border-white/[0.06]" />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="h-48 rounded-3xl bg-white/[0.02] border border-white/[0.04] mb-10 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-pulse">
              <div className="w-full aspect-[16/10] bg-white/[0.03]" />
              <div className="p-5 space-y-3">
                <div className="h-4 w-3/4 bg-white/[0.04] rounded-lg" />
                <div className="h-3 w-full bg-white/[0.03] rounded-lg" />
                <div className="h-3 w-2/3 bg-white/[0.03] rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';

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
  { id: 'games', name: 'Games', icon: 'i-ph:game-controller-duotone' },
  { id: 'business', name: 'Business', icon: 'i-ph:briefcase-duotone' },
  { id: 'education', name: 'Educacao', icon: 'i-ph:graduation-cap-duotone' },
  { id: 'tools', name: 'Ferramentas', icon: 'i-ph:wrench-duotone' },
  { id: 'dashboard', name: 'Dashboards', icon: 'i-ph:chart-bar-duotone' },
  { id: 'social', name: 'Social', icon: 'i-ph:chat-circle-dots-duotone' },
  { id: 'ecommerce', name: 'E-Commerce', icon: 'i-ph:shopping-cart-duotone' },
];

const SORT_OPTIONS = [
  { id: 'newest', label: 'Recentes' },
  { id: 'popular', label: 'Populares' },
  { id: 'featured', label: 'Destaques' },
];

// Color palettes for cards without images (Lovable-style gradient backgrounds)
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

function GalleryContent() {
  const [projects, setProjects] = useState<GalleryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [total, setTotal] = useState(0);

  const navigate = useNavigate();

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '60', offset: '0', category, sort });
      if (search) params.set('search', search);

      const res = await fetch(`/api/gallery?${params}`);
      const data = await res.json();

      if (data.projects) {
        setProjects(data.projects);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch gallery:', err);
    } finally {
      setLoading(false);
    }
  }, [category, search, sort]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return String(num);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-[#09090b]/70 border-b border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
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
              placeholder="Buscar projetos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                <div className="i-ph:x text-sm" />
              </button>
            )}
          </div>

          <a
            href="/"
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 transition-all"
          >
            <div className="i-ph:plus-circle text-base" />
            Criar Projeto
          </a>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Hero Banner - Lovable style */}
        {!loading && projects.length > 0 && category === 'all' && !search && sort === 'newest' && (
          <section className="mb-10">
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.06]">
              {/* Animated gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/[0.08] via-purple-600/[0.12] via-40% to-fuchsia-600/[0.08]" />
              <div className="absolute top-0 right-[20%] w-[400px] h-[400px] bg-indigo-500/[0.07] rounded-full blur-[100px] -translate-y-1/2" />
              <div className="absolute bottom-0 left-[10%] w-[300px] h-[300px] bg-purple-500/[0.07] rounded-full blur-[80px] translate-y-1/2" />
              {/* Grid pattern */}
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <div className="relative z-10 px-8 py-10 sm:px-12 sm:py-14">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-xs font-medium text-indigo-300/80 uppercase tracking-widest">Comunidade</span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 tracking-tight">
                  Galeria do{' '}
                  <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                    Omni Builder
                  </span>
                </h1>
                <p className="text-base sm:text-lg text-zinc-400 max-w-xl mb-6 leading-relaxed">
                  Explore projetos criados pela comunidade com IA. Se inspire, copie e construa seus proprios apps incríveis.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <a
                    href="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-200 shadow-lg shadow-white/[0.05] transition-all"
                  >
                    <div className="i-ph:plus-circle text-base" />
                    Criar Projeto
                  </a>
                  <div className="flex items-center gap-5 text-sm text-zinc-500">
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

        {/* Filters row: Categories + Sort */}
        <div className="flex items-center justify-between gap-4 mb-8">
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

          {/* Sort pills */}
          <div className="hidden md:flex items-center gap-1 shrink-0">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSort(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  sort === opt.id
                    ? 'bg-white/[0.08] text-white border border-white/[0.12]'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Projects - Large horizontal cards */}
        {featuredProjects.length > 0 && category === 'all' && !search && sort === 'newest' && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <div className="i-ph:sparkle-fill text-amber-400 text-base" />
              <h2 className="text-lg font-semibold text-white">Destaques</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredProjects.map((project) => (
                <FeaturedCard key={project.id} project={project} formatDate={formatDate} formatNumber={formatNumber} />
              ))}
            </div>
          </section>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-pulse">
                <div className="w-full aspect-[16/10] bg-white/[0.04]" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-3/4 bg-white/[0.06] rounded-lg" />
                  <div className="h-3 w-full bg-white/[0.04] rounded-lg" />
                  <div className="flex justify-between pt-2">
                    <div className="h-3 w-20 bg-white/[0.04] rounded-lg" />
                    <div className="h-3 w-16 bg-white/[0.04] rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* All Projects Grid */}
        {!loading && regularProjects.length > 0 && (
          <>
            {featuredProjects.length > 0 && category === 'all' && !search && sort === 'newest' && (
              <div className="flex items-center gap-2 mb-5 mt-6">
                <div className="i-ph:clock-duotone text-blue-400 text-base" />
                <h2 className="text-lg font-semibold text-white">Recentes</h2>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {regularProjects.map((project) => (
                <ProjectCard key={project.id} project={project} formatDate={formatDate} formatNumber={formatNumber} />
              ))}
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-20 h-20 rounded-3xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
              <div className="i-ph:storefront text-4xl text-zinc-600" />
            </div>
            <p className="text-xl font-semibold text-zinc-300 mb-2">Nenhum projeto encontrado</p>
            <p className="text-sm text-zinc-600 mb-6">
              {search ? 'Tente ajustar os termos de busca' : 'Seja o primeiro a publicar!'}
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.06] text-zinc-200 hover:bg-white/[0.1] border border-white/[0.08] transition-all"
            >
              <div className="i-ph:plus-circle text-base" />
              Criar e Publicar
            </a>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] mt-16">
        <div className="max-w-[1400px] mx-auto px-6 py-8 flex items-center justify-between text-xs text-zinc-600">
          <span>Omni-Builder Gallery — Projetos feitos com IA</span>
          <a href="/" className="hover:text-zinc-400 transition-colors">Voltar ao Editor</a>
        </div>
      </footer>
    </div>
  );
}

/* ============================================
   Featured Card — Large horizontal card with cover image
   ============================================ */
function FeaturedCard({
  project,
  formatDate,
  formatNumber,
}: {
  project: GalleryProject;
  formatDate: (d: string) => string;
  formatNumber: (n: number) => string;
}) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(project.likes);

  const handleUse = () => navigate(`/?gallery=${project.id}`);

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
  const hasLogo = !!project.logo;
  const catInfo = CATEGORIES.find((c) => c.id === project.category);
  const gradient = getGradientForProject(project);

  return (
    <div
      onClick={handleUse}
      className="group relative cursor-pointer rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all duration-300 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/[0.06] hover:scale-[1.01]"
    >
      {/* Cover image area */}
      <div className="relative w-full aspect-[16/9] overflow-hidden">
        {!hasImage && (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-6xl text-white/10`} />
            </div>
          </div>
        )}
        {hasImage && (
          <img
            src={mainImage}
            alt={project.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent" />

        {/* Featured badge */}
        <div className="absolute top-3 left-3">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/90 text-[10px] font-bold text-black backdrop-blur-sm shadow-sm">
            <div className="i-ph:star-fill text-[9px]" /> Destaque
          </span>
        </div>

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
            {hasLogo ? (
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
   Project Card — Compact card with prominent cover image
   ============================================ */
function ProjectCard({
  project,
  formatDate,
  formatNumber,
}: {
  project: GalleryProject;
  formatDate: (d: string) => string;
  formatNumber: (n: number) => string;
}) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(project.likes);

  const handleUse = () => navigate(`/?gallery=${project.id}`);

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
  const hasLogo = !!project.logo;
  const catInfo = CATEGORIES.find((c) => c.id === project.category);
  const gradient = getGradientForProject(project);

  return (
    <div
      onClick={handleUse}
      className="group relative cursor-pointer flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all duration-300 hover:border-white/[0.12] hover:shadow-2xl hover:shadow-indigo-500/[0.04]"
    >
      {/* Cover image — the main visual */}
      <div className="relative w-full aspect-[16/10] overflow-hidden bg-white/[0.02]">
        {!hasImage && (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-5xl text-white/[0.08]`} />
            </div>
          </div>
        )}
        {hasImage && (
          <img
            src={mainImage}
            alt={project.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        )}
        {/* Gradient overlay from bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b]/80 via-transparent to-transparent" />

        {/* Category badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-black/40 text-white/70 backdrop-blur-sm border border-white/[0.06]">
            {catInfo?.name || project.category}
          </span>
        </div>

        {/* Hover play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.95] text-black flex items-center justify-center shadow-2xl backdrop-blur-sm transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <div className="i-ph:play-fill text-xl ml-0.5" />
          </div>
        </div>

        {/* Bottom: logo + name on image */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-center gap-2.5">
            {hasLogo ? (
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
        {/* Description */}
        <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2 min-h-[28px]">{project.description}</p>

        {/* Tags */}
        {project.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {project.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="px-1.5 py-0.5 rounded-md bg-white/[0.04] text-[9px] text-zinc-500 border border-white/[0.04]">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Bottom bar: author + stats + like */}
        <div className="mt-auto pt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasLogo ? (
              <img src={project.logo} alt="" className="w-4 h-4 rounded-full object-cover opacity-60" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-white/[0.06] flex items-center justify-center">
                <div className="i-ph:user text-[8px] text-zinc-600" />
              </div>
            )}
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

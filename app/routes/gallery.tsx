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
  author_name: string;
  name: string;
  description: string;
  thumbnail: string;
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
  { id: 'newest', label: 'Recentes', icon: 'i-ph:clock' },
  { id: 'popular', label: 'Populares', icon: 'i-ph:heart' },
  { id: 'featured', label: 'Destaques', icon: 'i-ph:sparkle' },
];

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
      const params = new URLSearchParams({
        limit: '60',
        offset: '0',
        category,
        sort,
      });
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
    if (diffDays < 7) return `${diffDays} dias atras`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atras`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses atras`;
    return date.toLocaleDateString('pt-BR');
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return String(num);
  };

  return (
    <div className="min-h-screen bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-bolt-elements-background-depth-1/80 border-b border-bolt-elements-borderColor">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left */}
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2 text-bolt-elements-textPrimary hover:text-bolt-elements-textSecondary transition-colors">
                <div className="i-ph:arrow-left text-lg" />
              </a>
              <div className="w-px h-6 bg-bolt-elements-borderColor" />
              <a href="/" className="flex items-center gap-2">
                <img src="/omni-builder-logo.svg" alt="Omni" className="h-7 omni-logo-themed" />
              </a>
              <div className="w-px h-6 bg-bolt-elements-borderColor" />
              <div className="flex items-center gap-2">
                <div className="i-ph:storefront-duotone text-xl text-indigo-400" />
                <h1 className="text-lg font-bold text-bolt-elements-textPrimary">Galeria</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {total} projetos
                </span>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full max-w-sm mx-4">
              <div className="i-ph:magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary text-sm" />
              <input
                type="text"
                placeholder="Buscar projetos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
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

            {/* Sort */}
            <div className="hidden md:flex items-center gap-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSort(opt.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sort === opt.id
                      ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                      : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary border border-transparent hover:bg-bolt-elements-background-depth-2'
                  }`}
                >
                  <div className={`${opt.icon} text-xs`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Hero Banner */}
        {!loading && projects.length > 0 && category === 'all' && !search && sort === 'newest' && (
          <section className="mb-8">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 border border-indigo-500/20 p-6 sm:p-8">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="i-ph:sparkle-duotone text-yellow-400 text-lg" />
                  <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Comunidade</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-bolt-elements-textPrimary mb-2">
                  Galeria do Omni Builder
                </h2>
                <p className="text-sm text-bolt-elements-textSecondary max-w-lg mb-4">
                  Explore projetos criados pela comunidade. Publique seus proprios projetos e compartilhe com o mundo!
                </p>
                <div className="flex items-center gap-4">
                  <a
                    href="/"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-sm transition-all"
                  >
                    <div className="i-ph:plus-circle text-base" />
                    Criar Projeto
                  </a>
                  <div className="flex items-center gap-3 text-xs text-bolt-elements-textTertiary">
                    <span className="flex items-center gap-1">
                      <div className="i-ph:cube-duotone text-sm text-blue-400" />
                      {total} projetos
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="i-ph:users-duotone text-sm text-green-400" />
                      Comunidade ativa
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-5 scrollbar-thin">
          {CATEGORIES.map((cat) => {
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shadow-sm'
                    : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary border border-bolt-elements-borderColor hover:border-bolt-elements-textTertiary'
                }`}
              >
                <div className={`${cat.icon} text-base`} />
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Featured Projects */}
        {featuredProjects.length > 0 && category === 'all' && !search && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="i-ph:star-duotone text-yellow-400 text-lg" />
              <h2 className="text-base font-semibold text-bolt-elements-textPrimary">Destaques</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {featuredProjects.map((project) => (
                <GalleryCard key={project.id} project={project} formatDate={formatDate} formatNumber={formatNumber} />
              ))}
            </div>
          </section>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 overflow-hidden animate-pulse">
                <div className="w-full aspect-[4/3] bg-bolt-elements-background-depth-1" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 bg-bolt-elements-background-depth-1 rounded" />
                  <div className="h-3 w-full bg-bolt-elements-background-depth-1 rounded" />
                  <div className="h-3 w-2/3 bg-bolt-elements-background-depth-1 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* All Projects Grid */}
        {!loading && regularProjects.length > 0 && (
          <>
            {featuredProjects.length > 0 && category === 'all' && !search && (
              <div className="flex items-center gap-2 mb-4 mt-2">
                <div className="i-ph:clock-duotone text-blue-400 text-lg" />
                <h2 className="text-base font-semibold text-bolt-elements-textPrimary">Recentes</h2>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {regularProjects.map((project) => (
                <GalleryCard key={project.id} project={project} formatDate={formatDate} formatNumber={formatNumber} />
              ))}
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-bolt-elements-textTertiary">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <div className="i-ph:storefront text-3xl text-indigo-400" />
            </div>
            <p className="text-lg font-medium mb-1">Nenhum projeto encontrado</p>
            <p className="text-sm opacity-70 mb-4">
              {search ? 'Tente ajustar os termos de busca' : 'Seja o primeiro a publicar!'}
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-colors border border-indigo-500/20"
            >
              <div className="i-ph:plus-circle text-base" />
              Criar e Publicar
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryCard({
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

  const handleUse = () => {
    // Navigate to home and load the gallery project
    navigate(`/?gallery=${project.id}`);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((prev) => prev + (newLiked ? 1 : -1));

    try {
      await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'like',
          projectId: project.id,
        }),
      });
    } catch {
      // Revert on error
      setLiked(!newLiked);
      setLikeCount((prev) => prev + (newLiked ? -1 : 1));
    }
  };

  const catInfo = CATEGORIES.find((c) => c.id === project.category);

  return (
    <div className="group relative flex flex-col rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 overflow-hidden transition-all duration-200 hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 hover:scale-[1.01]">
      {/* Thumbnail */}
      <button onClick={handleUse} className="relative w-full aspect-[4/3] overflow-hidden bg-gradient-to-br from-bolt-elements-background-depth-1 to-bolt-elements-background-depth-2 cursor-pointer">
        {/* Fallback gradient thumbnail with icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`${catInfo?.icon || 'i-ph:cube-duotone'} text-5xl text-bolt-elements-textTertiary/20`} />
        </div>

        {/* If project has a thumbnail image */}
        {project.thumbnail && (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Featured badge */}
        {project.is_featured && (
          <div className="absolute top-2 left-2">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/90 text-[10px] font-bold text-black backdrop-blur-sm">
              <div className="i-ph:star-fill text-[8px]" /> Destaque
            </span>
          </div>
        )}

        {/* Category badge */}
        <div className={`absolute top-2 ${project.is_featured ? 'left-24' : 'left-2'}`}>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/50 text-white backdrop-blur-sm border border-white/10">
            {catInfo?.name || project.category}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-colors duration-200 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/90 text-black text-xs font-semibold shadow-lg backdrop-blur-sm">
            <div className="i-ph:play-fill text-sm" />
            Abrir Projeto
          </span>
        </div>

        {/* Name overlay */}
        <div className="absolute bottom-2 left-2 right-2">
          <h3 className="text-sm font-bold text-white drop-shadow-md truncate">{project.name}</h3>
        </div>
      </button>

      {/* Content */}
      <div className="p-3.5 flex flex-col flex-1">
        <p className="text-[11px] text-bolt-elements-textSecondary leading-relaxed line-clamp-2">{project.description}</p>

        {/* Author + stats */}
        <div className="flex items-center justify-between mt-3 mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <div className="i-ph:user text-[10px] text-indigo-400" />
            </div>
            <span className="text-[10px] text-bolt-elements-textTertiary font-medium truncate max-w-[80px]">
              {project.author_name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-bolt-elements-textTertiary">
            <span className="flex items-center gap-0.5">
              <div className="i-ph:eye text-[10px]" />
              {formatNumber(project.views)}
            </span>
            <span className="flex items-center gap-0.5">
              <div className="i-ph:heart text-[10px]" />
              {formatNumber(likeCount)}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {project.tags?.slice(0, 3).map((tag: string) => (
            <span key={tag} className="px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-1 text-[9px] text-bolt-elements-textTertiary border border-bolt-elements-borderColor">
              {tag}
            </span>
          ))}
        </div>

        {/* Date */}
        <p className="text-[9px] text-bolt-elements-textTertiary/60">{formatDate(project.published_at)}</p>

        {/* Bottom actions */}
        <div className="mt-auto pt-3 flex items-center gap-2">
          <button
            onClick={handleUse}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.97]"
          >
            <div className="i-ph:play-fill text-sm" />
            Abrir
          </button>
          <button
            onClick={handleLike}
            className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all border ${
              liked
                ? 'bg-red-500/15 text-red-400 border-red-500/25'
                : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary border-bolt-elements-borderColor hover:text-red-400 hover:border-red-400/30'
            }`}
          >
            <div className={`${liked ? 'i-ph:heart-fill' : 'i-ph:heart'} text-sm`} />
          </button>
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
    <div className="min-h-screen bg-bolt-elements-background-depth-1">
      <header className="border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 h-16" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 overflow-hidden animate-pulse">
              <div className="w-full aspect-[4/3] bg-bolt-elements-background-depth-1" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 bg-bolt-elements-background-depth-1 rounded" />
                <div className="h-3 w-full bg-bolt-elements-background-depth-1 rounded" />
                <div className="h-3 w-2/3 bg-bolt-elements-background-depth-1 rounded" />
                <div className="h-8 bg-bolt-elements-background-depth-1 rounded-xl mt-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

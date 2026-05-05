import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useState, useMemo } from 'react';
import { useNavigate } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { templates, categories, type Template, type TemplateCategory } from '~/data/templates';

export const meta: MetaFunction = () => {
  return [
    { title: 'Templates — Omni-Builder' },
    { name: 'description', content: 'Explore templates prontos para usar no Omni-Builder. Jogos, web apps, ferramentas e muito mais.' },
  ];
};

export const loader = () => json({});

function TemplatesContent() {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      const matchesSearch =
        searchQuery === '' ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesDifficulty = difficultyFilter === 'all' || template.difficulty === difficultyFilter;
      return matchesCategory && matchesSearch && matchesDifficulty;
    });
  }, [selectedCategory, searchQuery, difficultyFilter]);

  const featuredTemplates = templates.filter((t) => t.featured);

  const navigate = useNavigate();

  const handleUseTemplate = (template: Template) => {
    navigate(`/?prompt=${encodeURIComponent(template.prompt)}`);
  };

  const handleImportGitHub = (template: Template) => {
    navigate(`/?import=${encodeURIComponent(template.githubUrl)}`);
  };

  const difficultyConfig: Record<string, { label: string; className: string }> = {
    beginner: { label: 'Iniciante', className: 'bg-green-500/15 text-green-400 border-green-500/25' },
    intermediate: { label: 'Intermediario', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
    advanced: { label: 'Avancado', className: 'bg-red-500/15 text-red-400 border-red-500/25' },
  };

  return (
    <div className="min-h-screen bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-bolt-elements-background-depth-1/80 border-b border-bolt-elements-borderColor">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: back + title */}
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
                <div className="i-ph:layout-grid-duotone text-xl text-blue-400" />
                <h1 className="text-lg font-bold text-bolt-elements-textPrimary">Templates</h1>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full max-w-sm mx-4">
              <div className="i-ph:magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary text-sm" />
              <input
                type="text"
                placeholder="Buscar templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
                >
                  <div className="i-ph:x text-sm" />
                </button>
              )}
            </div>

            {/* Difficulty filter */}
            <div className="hidden md:flex items-center gap-1">
              {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficultyFilter(level)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    difficultyFilter === level
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                      : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary border border-transparent hover:bg-bolt-elements-background-depth-2'
                  }`}
                >
                  {level === 'all' ? 'Todos' : difficultyConfig[level]?.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Featured Section */}
        {selectedCategory === 'all' && searchQuery === '' && difficultyFilter === 'all' && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="i-ph:sparkle-duotone text-yellow-400 text-lg" />
              <h2 className="text-base font-semibold text-bolt-elements-textPrimary">Destaques</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {featuredTemplates.map((template) => (
                <FeaturedCard
                  key={template.id}
                  template={template}
                  onUse={handleUseTemplate}
                />
              ))}
            </div>
          </section>
        )}

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-5 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25 shadow-sm'
                : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary border border-bolt-elements-borderColor hover:border-bolt-elements-textTertiary'
            }`}
          >
            <div className="i-ph:squares-four text-base" />
            Todos
            <span className="text-xs opacity-60">({templates.length})</span>
          </button>
          {categories.map((cat) => {
            const count = templates.filter((t) => t.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25 shadow-sm'
                    : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary border border-bolt-elements-borderColor hover:border-bolt-elements-textTertiary'
                }`}
              >
                <div className={`${cat.icon} text-base`} />
                {cat.name}
                <span className="text-xs opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Category Description */}
        {selectedCategory !== 'all' && (
          <div className="mb-5 p-4 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">
            <div className="flex items-center gap-3">
              <div className={`${categories.find((c) => c.id === selectedCategory)?.icon} text-2xl text-blue-400`} />
              <div>
                <h2 className="font-semibold text-bolt-elements-textPrimary">
                  {categories.find((c) => c.id === selectedCategory)?.name}
                </h2>
                <p className="text-sm text-bolt-elements-textSecondary">
                  {categories.find((c) => c.id === selectedCategory)?.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results count */}
        <p className="text-xs text-bolt-elements-textTertiary mb-4">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
        </p>

        {/* Templates Grid */}
        {filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={handleUseTemplate}
                onImport={handleImportGitHub}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-bolt-elements-textTertiary">
            <div className="i-ph:magnifying-glass-minus text-5xl mb-4 opacity-40" />
            <p className="text-lg font-medium mb-1">Nenhum template encontrado</p>
            <p className="text-sm opacity-70">Tente ajustar os filtros ou termos de busca</p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
                setDifficultyFilter('all');
              }}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-500/15 text-blue-400 text-sm font-medium hover:bg-blue-500/25 transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== Featured Card (horizontal with thumbnail) ========== */
function FeaturedCard({
  template,
  onUse,
}: {
  template: Template;
  onUse: (t: Template) => void;
}) {
  const diff = difficultyConfigMap(template.difficulty);

  return (
    <button
      onClick={() => onUse(template)}
      className="group flex flex-col rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 overflow-hidden transition-all duration-200 hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-500/5 hover:scale-[1.02] text-left"
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-bolt-elements-background-depth-1">
        <img
          src={template.thumbnail}
          alt={template.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {/* Badge */}
        <div className="absolute top-2 left-2">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/90 text-[10px] font-bold text-black backdrop-blur-sm">
            <div className="i-ph:star-fill text-[8px]" /> Destaque
          </span>
        </div>
        {/* Difficulty */}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border backdrop-blur-sm ${diff.className}`}>
            {diff.label}
          </span>
        </div>
        {/* Name overlay */}
        <div className="absolute bottom-2 left-2 right-2">
          <h3 className="text-sm font-bold text-white drop-shadow-md truncate">{template.name}</h3>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-[11px] text-bolt-elements-textSecondary leading-relaxed line-clamp-2">{template.description}</p>
        <div className="flex items-center gap-1.5 mt-2">
          {template.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-1 text-[9px] text-bolt-elements-textTertiary border border-bolt-elements-borderColor">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

/* ========== Template Card (vertical with thumbnail) ========== */
function TemplateCard({
  template,
  onUse,
  onImport,
}: {
  template: Template;
  onUse: (t: Template) => void;
  onImport: (t: Template) => void;
}) {
  const [importing, setImporting] = useState(false);

  const handleImport = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImporting(true);
    onImport(template);
  };

  const handleUse = () => {
    onUse(template);
  };

  const diff = difficultyConfigMap(template.difficulty);

  return (
    <div className="group relative flex flex-col rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 overflow-hidden transition-all duration-200 hover:border-bolt-elements-textTertiary/30 hover:shadow-xl hover:shadow-black/10 hover:scale-[1.01]">
      {/* Thumbnail */}
      <button onClick={handleUse} className="relative w-full aspect-[4/3] overflow-hidden bg-bolt-elements-background-depth-1 cursor-pointer">
        <img
          src={template.thumbnail}
          alt={template.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Difficulty badge */}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border backdrop-blur-sm ${diff.className}`}>
            {diff.label}
          </span>
        </div>

        {/* Category */}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/50 text-white backdrop-blur-sm border border-white/10">
            {categories.find((c) => c.id === template.category)?.name}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors duration-200 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/90 text-black text-xs font-semibold shadow-lg backdrop-blur-sm">
            <div className="i-ph:sparkle text-sm" />
            Gerar com IA
          </span>
        </div>
      </button>

      {/* Content */}
      <div className="p-3.5 flex flex-col flex-1">
        <h3 className="font-semibold text-sm text-bolt-elements-textPrimary truncate">{template.name}</h3>
        <p className="text-[11px] text-bolt-elements-textSecondary leading-relaxed line-clamp-2 mt-1">{template.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {template.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-1 text-[9px] text-bolt-elements-textTertiary border border-bolt-elements-borderColor">
              {tag}
            </span>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="mt-auto pt-3 flex items-center gap-2">
          <button
            onClick={handleUse}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.97]"
          >
            <div className="i-ph:sparkle text-sm" />
            Gerar
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:border-bolt-elements-textTertiary transition-all disabled:opacity-50"
          >
            {importing ? (
              <div className="i-svg-spinners:90-ring-with-bg text-sm" />
            ) : (
              <div className="i-ph:github-logo text-sm" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========== Helpers ========== */
function difficultyConfigMap(difficulty: string) {
  const config: Record<string, { label: string; className: string }> = {
    beginner: { label: 'Iniciante', className: 'bg-green-500/80 text-white border-green-500' },
    intermediate: { label: 'Intermediario', className: 'bg-yellow-500/80 text-black border-yellow-500' },
    advanced: { label: 'Avancado', className: 'bg-red-500/80 text-white border-red-500' },
  };
  return config[difficulty] || config.beginner;
}

export default function TemplatesPage() {
  return (
    <>
      <ClientOnly fallback={<TemplatesSkeleton />}>
        {() => <TemplatesContent />}
      </ClientOnly>
    </>
  );
}

function TemplatesSkeleton() {
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
                <div className="flex gap-1.5 mt-3">
                  <div className="h-5 w-12 bg-bolt-elements-background-depth-1 rounded" />
                  <div className="h-5 w-12 bg-bolt-elements-background-depth-1 rounded" />
                </div>
                <div className="h-8 bg-bolt-elements-background-depth-1 rounded-xl mt-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

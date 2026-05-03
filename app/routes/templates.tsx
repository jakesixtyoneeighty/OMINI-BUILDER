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

  const difficultyBadge = (difficulty: string) => {
    const config: Record<string, { label: string; className: string }> = {
      beginner: { label: 'Iniciante', className: 'bg-green-500/15 text-green-400 border-green-500/25' },
      intermediate: { label: 'Intermediario', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
      advanced: { label: 'Avancado', className: 'bg-red-500/15 text-red-400 border-red-500/25' },
    };
    const c = config[difficulty] || config.beginner;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.className}`}>
        {difficulty === 'beginner' && <div className="i-ph:star text-xs" />}
        {difficulty === 'intermediate' && <div className="i-ph:lightning text-xs" />}
        {difficulty === 'advanced' && <div className="i-ph:flame text-xs" />}
        {c.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-bolt-elements-background-depth-1/80 border-b border-bolt-elements-borderColor">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2 text-bolt-elements-textPrimary hover:text-bolt-elements-textSecondary transition-colors">
                <div className="i-ph:arrow-left text-lg" />
                <span className="text-sm font-medium hidden sm:inline">Voltar</span>
              </a>
              <div className="w-px h-6 bg-bolt-elements-borderColor" />
              <div className="flex items-center gap-2">
                <div className="i-ph:layout-grid-duotone text-xl text-purple-400" />
                <h1 className="text-xl font-bold">
                  <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-purple-600 bg-clip-text text-transparent">Templates</span>
                </h1>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full max-w-md mx-4">
              <div className="i-ph:magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary text-sm" />
              <input
                type="text"
                placeholder="Buscar templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all"
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
            <div className="flex items-center gap-1.5">
              {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficultyFilter(level)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    difficultyFilter === level
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2 border border-transparent'
                  }`}
                >
                  {level === 'all' ? 'Todos' : level === 'beginner' ? 'Iniciante' : level === 'intermediate' ? 'Intermediario' : 'Avancado'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Featured Templates Section */}
        {selectedCategory === 'all' && searchQuery === '' && difficultyFilter === 'all' && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <div className="i-ph:sparkle-duotone text-yellow-400 text-lg" />
              <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Destaques</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {featuredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={handleUseTemplate}
                  onImport={handleImportGitHub}
                  difficultyBadge={difficultyBadge}
                  featured
                />
              ))}
            </div>
          </section>
        )}

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-sm shadow-purple-500/10'
                : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary border border-bolt-elements-borderColor hover:border-bolt-elements-textTertiary'
            }`}
          >
            <div className="i-ph:squares-four text-base" />
            Todos
            <span className="text-xs opacity-70">({templates.length})</span>
          </button>
          {categories.map((cat) => {
            const count = templates.filter((t) => t.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-sm shadow-purple-500/10'
                    : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary border border-bolt-elements-borderColor hover:border-bolt-elements-textTertiary'
                }`}
              >
                <div className={`${cat.icon} text-base`} />
                {cat.name}
                <span className="text-xs opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Category Description */}
        {selectedCategory !== 'all' && (
          <div className="mb-6 p-4 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">
            <div className="flex items-center gap-3">
              <div className={`${categories.find((c) => c.id === selectedCategory)?.icon} text-2xl text-purple-400`} />
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
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-bolt-elements-textSecondary">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} encontrado{filteredTemplates.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={handleUseTemplate}
                onImport={handleImportGitHub}
                difficultyBadge={difficultyBadge}
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
              className="mt-4 px-4 py-2 rounded-lg bg-purple-500/15 text-purple-400 text-sm font-medium hover:bg-purple-500/25 transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
  onImport,
  difficultyBadge,
  featured = false,
}: {
  template: Template;
  onUse: (t: Template) => void;
  onImport: (t: Template) => void;
  difficultyBadge: (d: string) => React.ReactNode;
  featured?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    setImporting(true);
    onImport(template);
  };

  const repoName = template.githubUrl.replace('https://github.com/', '');

  return (
    <div
      className={`group relative flex flex-col rounded-xl border transition-all duration-200 overflow-hidden ${
        featured
          ? 'bg-gradient-to-br from-purple-500/5 via-bolt-elements-background-depth-2 to-violet-500/5 border-purple-500/20 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/5'
          : 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor hover:border-bolt-elements-textTertiary hover:shadow-lg hover:shadow-black/10'
      }`}
    >
      {/* Featured badge */}
      {featured && (
        <div className="absolute top-3 right-3 z-10">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold border border-yellow-500/30">
            <div className="i-ph:star-fill text-[8px]" /> Destaque
          </span>
        </div>
      )}

      {/* Card Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${template.gradient} flex items-center justify-center shadow-lg`}>
            <div className={`${template.icon} text-xl text-white`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-bolt-elements-textPrimary truncate">{template.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {difficultyBadge(template.difficulty)}
              <span className="text-[10px] text-bolt-elements-textTertiary capitalize">
                {categories.find((c) => c.id === template.category)?.name}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="mt-3 text-xs text-bolt-elements-textSecondary leading-relaxed line-clamp-2">
          {template.description}
        </p>

        {/* GitHub info */}
        <div className="flex items-center gap-1.5 mt-2.5 px-2 py-1.5 rounded-md bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor w-fit">
          <div className="i-ph:github-logo text-xs text-bolt-elements-textTertiary" />
          <span className="text-[10px] text-bolt-elements-textTertiary font-mono truncate max-w-[160px]">{repoName}</span>
          {template.stars && template.stars > 0 && (
            <>
              <div className="w-px h-3 bg-bolt-elements-borderColor" />
              <div className="i-ph:star-fill text-[9px] text-yellow-500" />
              <span className="text-[10px] text-bolt-elements-textTertiary">{template.stars >= 1000 ? `${(template.stars / 1000).toFixed(1)}k` : template.stars}</span>
            </>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md bg-bolt-elements-background-depth-1 text-[10px] text-bolt-elements-textTertiary border border-bolt-elements-borderColor"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Prompt Preview (collapsible) */}
      {expanded && (
        <div className="px-4 pb-3">
          <div className="p-3 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor max-h-40 overflow-y-auto">
            <p className="text-[11px] text-bolt-elements-textTertiary leading-relaxed whitespace-pre-wrap font-mono">
              {template.prompt}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto px-4 pb-4 pt-2">
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {importing ? (
              <div className="i-svg-spinners:90-ring-with-bg text-sm" />
            ) : (
              <div className="i-ph:github-logo text-sm" />
            )}
            Importar Repo
          </button>
          <button
            onClick={() => onUse(template)}
            className="px-2.5 py-2 rounded-lg text-xs border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:border-bolt-elements-textTertiary transition-all"
            title="Gerar com IA"
          >
            <div className="i-ph:sparkle text-sm" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`px-2.5 py-2 rounded-lg text-xs border transition-all ${
              expanded
                ? 'bg-purple-500/15 text-purple-400 border-purple-500/25'
                : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary border-bolt-elements-borderColor hover:text-bolt-elements-textSecondary'
            }`}
            title="Ver prompt"
          >
            <div className={`i-ph:${expanded ? 'eye-slash' : 'eye'} text-sm`} />
          </button>
        </div>
      </div>
    </div>
  );
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
            <div key={i} className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-bolt-elements-background-depth-1" />
                <div className="flex-1">
                  <div className="h-4 w-3/4 bg-bolt-elements-background-depth-1 rounded" />
                  <div className="h-3 w-1/2 bg-bolt-elements-background-depth-1 rounded mt-2" />
                </div>
              </div>
              <div className="mt-3 h-3 w-full bg-bolt-elements-background-depth-1 rounded" />
              <div className="mt-2 h-3 w-5/6 bg-bolt-elements-background-depth-1 rounded" />
              <div className="mt-4 flex gap-1.5">
                <div className="h-5 w-12 bg-bolt-elements-background-depth-1 rounded" />
                <div className="h-5 w-12 bg-bolt-elements-background-depth-1 rounded" />
                <div className="h-5 w-16 bg-bolt-elements-background-depth-1 rounded" />
              </div>
              <div className="mt-4 h-8 bg-bolt-elements-background-depth-1 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useStore } from '@nanostores/react';
import { recentlyViewedStore } from '~/lib/stores/recently-viewed';

export function RecentlyViewed() {
  const items = useStore(recentlyViewedStore);

  if (items.length === 0) return null;

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Agora';
    if (diffMinutes < 60) return `${diffMinutes}min atras`;
    if (diffHours < 24) return `${diffHours}h atras`;
    if (diffDays < 7) return `${diffDays}d atras`;
    return date.toLocaleDateString('pt-BR');
  };

  const GRADIENTS = [
    'from-violet-500/70 via-purple-400/50 to-blue-500/70',
    'from-emerald-500/70 via-teal-400/50 to-cyan-500/70',
    'from-orange-500/70 via-amber-400/50 to-yellow-500/70',
    'from-rose-500/70 via-pink-400/50 to-fuchsia-500/70',
    'from-blue-500/70 via-indigo-400/50 to-violet-500/70',
  ];

  const getGradient = (id: string) => {
    const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return GRADIENTS[hash % GRADIENTS.length];
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Vistos recentemente</h3>
        <a
          href="/projects"
          className="flex items-center gap-1 text-xs font-medium text-bolt-elements-item-contentAccent hover:underline transition-all"
        >
          Ver todos
          <div className="i-ph:arrow-right text-[10px]" />
        </a>
      </div>

      {/* Project cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.slice(0, 6).map((project) => (
          <a
            key={project.id}
            href={`/chat/${project.id}`}
            className="group relative rounded-xl overflow-hidden border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:border-bolt-elements-borderColorActive transition-all cursor-pointer hover:shadow-lg block"
          >
            {/* Preview thumbnail */}
            <div className={`relative h-28 bg-gradient-to-br ${getGradient(project.id)} overflow-hidden`}>
              {/* Decorative grid overlay */}
              <div className="absolute inset-0 opacity-20">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
                    backgroundSize: '16px 16px',
                  }}
                />
              </div>
              {/* Decorative mock UI elements */}
              <div className="absolute inset-3 flex flex-col gap-1.5 opacity-40">
                <div className="h-2 w-16 rounded-full bg-white/60" />
                <div className="flex-1 flex gap-1.5">
                  <div className="w-1/3 rounded-md bg-white/20" />
                  <div className="flex-1 rounded-md bg-white/15" />
                </div>
                <div className="flex gap-1">
                  <div className="h-1.5 w-8 rounded-full bg-white/30" />
                  <div className="h-1.5 w-12 rounded-full bg-white/25" />
                  <div className="h-1.5 w-6 rounded-full bg-white/30" />
                </div>
              </div>

              {/* Source badge */}
              {project.source === 'cloud' && (
                <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded-md bg-bolt-elements-item-backgroundAccent/20 text-bolt-elements-item-contentAccent font-medium backdrop-blur-sm">
                  Cloud
                </span>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-bolt-elements-item-backgroundAccent/0 group-hover:bg-bolt-elements-item-backgroundAccent/30 flex items-center justify-center transition-all duration-200">
                <div className="w-10 h-10 rounded-full bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-200 shadow-lg">
                  <div className="i-ph:arrow-right text-lg" />
                </div>
              </div>
            </div>

            {/* Card footer */}
            <div className="px-3 py-2.5">
              <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">{project.name}</div>
              <div className="text-[11px] text-bolt-elements-textTertiary mt-0.5">{formatTime(project.timestamp)}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

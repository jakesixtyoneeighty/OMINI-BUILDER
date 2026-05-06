import { useState } from 'react';

interface ProjectCard {
  id: string;
  title: string;
  gradient: string;
  starred: boolean;
}

const PLACEHOLDER_PROJECTS: ProjectCard[] = [
  {
    id: '1',
    title: 'E-commerce Dashboard',
    gradient: 'from-violet-500/70 via-purple-400/50 to-blue-500/70',
    starred: false,
  },
  {
    id: '2',
    title: 'Chat Application',
    gradient: 'from-emerald-500/70 via-teal-400/50 to-cyan-500/70',
    starred: true,
  },
  {
    id: '3',
    title: 'Portfolio Website',
    gradient: 'from-orange-500/70 via-amber-400/50 to-yellow-500/70',
    starred: false,
  },
];

export function RecentlyViewed() {
  const [projects] = useState<ProjectCard[]>(PLACEHOLDER_PROJECTS);
  const [starredIds, setStarredIds] = useState<Set<string>>(
    new Set(PLACEHOLDER_PROJECTS.filter((p) => p.starred).map((p) => p.id)),
  );

  const toggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Recently viewed</h3>
        <button className="flex items-center gap-1 text-xs font-medium text-bolt-elements-item-contentAccent hover:underline transition-all">
          View all
          <div className="i-ph:arrow-right text-[10px]" />
        </button>
      </div>

      {/* Project cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {projects.map((project) => (
          <div
            key={project.id}
            className="group relative rounded-xl overflow-hidden border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:border-bolt-elements-borderColorActive transition-all cursor-pointer hover:shadow-lg"
          >
            {/* Preview thumbnail */}
            <div className={`relative h-28 bg-gradient-to-br ${project.gradient} overflow-hidden`}>
              {/* Decorative grid overlay */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
                  backgroundSize: '16px 16px',
                }} />
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

              {/* Star button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStar(project.id);
                }}
                className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-lg bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-all opacity-0 group-hover:opacity-100"
                title={starredIds.has(project.id) ? 'Unstar' : 'Star'}
              >
                <div
                  className={
                    starredIds.has(project.id)
                      ? 'i-ph:star-fill text-amber-400 text-sm'
                      : 'i-ph:star text-white/70 text-sm hover:text-amber-400'
                  }
                />
              </button>
            </div>

            {/* Card footer */}
            <div className="px-3 py-2.5">
              <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">{project.title}</div>
              <div className="text-[11px] text-bolt-elements-textTertiary mt-0.5">Edited 2h ago</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useStore } from '@nanostores/react';
import { useMemo } from 'react';
import { projectsStore, activeProjectIdStore, type ProjectRecord } from '~/lib/stores/project';
import { authStore } from '~/lib/stores/auth';
import { getSupabase } from '~/lib/supabase';
import { useState, useEffect } from 'react';

interface SupabaseProject {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  updated_at?: string;
  created_at?: string;
}

export function UserProjects() {
  const projects = useStore(projectsStore);
  const activeId = useStore(activeProjectIdStore);
  const auth = useStore(authStore);
  const [supabaseProjects, setSupabaseProjects] = useState<SupabaseProject[]>([]);
  const [loading, setLoading] = useState(false);

  // Load projects from Supabase if user is logged in
  useEffect(() => {
    async function loadSupabaseProjects() {
      const sb = getSupabase();
      const user = authStore.get().user;
      if (!sb || !user) {
        setSupabaseProjects([]);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await sb
          .from('projects')
          .select('id, name, description, logo, updated_at, created_at')
          .eq('owner_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(20);
        if (!error && data) {
          setSupabaseProjects(data as SupabaseProject[]);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadSupabaseProjects();
  }, [auth.user]);

  // Merge local and Supabase projects
  const allProjects = useMemo(() => {
    const localProjects = Object.values(projects)
      .filter((p) => p.id !== 'default' && p.name)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.settings?.description || '',
        logo: p.settings?.logo || '',
        updated_at: '',
        source: 'local' as const,
      }));

    const sbProjects = supabaseProjects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      logo: p.logo || '',
      updated_at: p.updated_at || '',
      source: 'cloud' as const,
    }));

    // Deduplicate by id (Supabase takes precedence)
    const seen = new Set<string>();
    const merged: typeof localProjects = [];
    for (const p of sbProjects) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
    }
    for (const p of localProjects) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
    }

    return merged;
  }, [projects, supabaseProjects]);

  if (allProjects.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="w-full max-w-xl mx-auto px-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-bolt-elements-textPrimary flex items-center gap-2">
          <div className="i-ph:folder-open text-base text-bolt-elements-item-contentAccent" />
          Seus Projetos
        </h2>
        {loading && (
          <div className="i-svg-spinners:90-ring-with-bg text-sm text-bolt-elements-textTertiary" />
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {allProjects.map((project) => (
          <a
            key={project.id}
            href={`/chat/${project.id}`}
            className="group flex items-start gap-3 p-3 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-item-backgroundActive hover:border-bolt-elements-borderColorActive transition-all"
          >
            {/* Project icon */}
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-contentAccent shrink-0">
              {project.logo ? (
                <img src={project.logo} alt="" className="w-6 h-6 rounded" />
              ) : (
                <div className="i-ph:code text-lg" />
              )}
            </div>
            {/* Project info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-bolt-elements-textPrimary truncate group-hover:text-bolt-elements-item-contentAccent transition-colors">
                {project.name || 'Untitled'}
              </div>
              {project.description && (
                <div className="text-xs text-bolt-elements-textTertiary truncate mt-0.5">
                  {project.description}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                {project.source === 'cloud' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-contentAccent font-medium">
                    Cloud
                  </span>
                )}
                {project.updated_at && (
                  <span className="text-[10px] text-bolt-elements-textTertiary">
                    {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

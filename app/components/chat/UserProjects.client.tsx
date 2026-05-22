import { useStore } from '@nanostores/react';
import { useMemo } from 'react';
import { projectsStore, activeProjectIdStore, type ProjectRecord } from '~/lib/stores/project';
import { authStore } from '~/lib/stores/auth';
import { getSupabase } from '~/lib/supabase';
import { useState, useEffect } from 'react';
import { useT } from '~/lib/i18n/useT';

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
  const t = useT();

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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-bolt-elements-textPrimary flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/10 flex items-center justify-center">
            <div className="i-ph:folder-simple-star text-sm text-violet-400" />
          </div>
          {t('userProjects.yourProjects')}
        </h2>
        {loading && (
          <div className="w-5 h-5 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
        )}
      </div>
      
      {/* Projects grid - modern cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {allProjects.map((project) => (
          <a
            key={project.id}
            href={`/chat/${project.id}`}
            className="group flex items-start gap-3 p-3.5 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-item-backgroundActive hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-200"
          >
            {/* Project icon - modern gradient with decorative pattern */}
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/15 to-blue-500/10 text-violet-400 shrink-0 overflow-hidden">
              {/* Decorative pattern */}
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)',
                backgroundSize: '8px 8px'
              }} />
              {project.logo ? (
                <img src={project.logo} alt="" className="w-6 h-6 rounded-lg relative z-10" />
              ) : (
                <div className="i-ph:code text-lg relative z-10" />
              )}
            </div>
            
            {/* Project info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-bolt-elements-textPrimary truncate group-hover:text-violet-400 transition-colors mb-0.5">
                {project.name || t('projects.untitled')}
              </div>
              {project.description && (
                <div className="text-xs text-bolt-elements-textTertiary truncate mb-1.5">
                  {project.description}
                </div>
              )}
              <div className="flex items-center gap-2">
                {project.source === 'cloud' && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">
                    <div className="i-ph:cloud text-[8px]" />
                    {t('userProjects.cloud')}
                  </span>
                )}
                {project.updated_at && (
                  <span className="text-[10px] text-bolt-elements-textTertiary">
                    {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            
            {/* Arrow indicator */}
            <div className="w-6 h-6 rounded-lg bg-bolt-elements-bg-depth-3 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200">
              <div className="i-ph:arrow-right text-xs text-bolt-elements-textTertiary" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

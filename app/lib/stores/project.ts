import { atom, map } from 'nanostores';
import { getSupabase } from '~/lib/supabase';
import { authStore } from './auth';
import { getDb, getMessages, setMessages } from '~/lib/persistence';
import type { Message } from 'ai';

export interface EnvVar {
  key: string;
  value: string;
}

export type PreviewMode = 'webcontainer' | 'sandpack' | 'iframe' | 'newtab' | 'reactlive' | 'playcode' | 'piston';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export interface OmniDBConfig {
  enabled: boolean;
  projectId: string;
}

export interface ProjectSettings {
  name: string;
  description: string;
  logo: string;
  envVars: EnvVar[];
  previewMode: PreviewMode;
  provider: 'anthropic' | 'openrouter' | 'google';
  model: string;
  lastDeploy: {
    url: string;
    provider: string;
    siteId: string;
    deployedAt: string;
  };
  netlify: {
    token: string;
    siteId: string;
  };
  vercel: {
    token: string;
    projectName: string;
    framework: string;
  };
  cloudRun: {
    projectId: string;
    region: string;
    serviceAccountKey: string;
    serviceName: string;
    allowUnauthenticated: boolean;
  };
  github: {
    token: string;
    repo: string;
    branch: string;
  };
  database: {
    type: 'none' | 'firebase' | 'supabase' | 'omni';
    firebase: FirebaseConfig;
    supabase: SupabaseConfig;
    omni: OmniDBConfig;
  };
  googleDrive: {
    clientId: string;
  };
  customRules: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  settings: ProjectSettings;
}

const ACTIVE_PROJECT_KEY = 'bolt.project.active';

const DEFAULT_SETTINGS: ProjectSettings = {
  name: '',
  description: '',
  logo: '',
  envVars: [],
  previewMode: 'webcontainer',
  provider: 'openrouter',
  model: 'openrouter/free',
  lastDeploy: { url: '', provider: '', siteId: '', deployedAt: '' },
  netlify: { token: '', siteId: '' },
  vercel: { token: '', projectName: '', framework: 'vite' },
  cloudRun: { projectId: '', region: 'us-central1', serviceAccountKey: '', serviceName: '', allowUnauthenticated: true },
  github: { token: '', repo: '', branch: 'main' },
  database: {
    type: 'none',
    firebase: { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', measurementId: '' },
    supabase: { url: '', anonKey: '', serviceRoleKey: '' },
    omni: { enabled: false, projectId: '' },
  },
  googleDrive: { clientId: '' },
  customRules: '',
};

function loadProjects(): Record<string, ProjectRecord> {
  // Projects are loaded from Supabase (cloud only) — no localStorage persistence
  return {};
}

function loadActiveProjectId(): string {
  if (typeof localStorage === 'undefined') return 'default';
  return localStorage.getItem(ACTIVE_PROJECT_KEY) || 'default';
}

export const activeProjectIdStore = atom<string>(loadActiveProjectId());
export const projectsStore = map<Record<string, ProjectRecord>>(loadProjects());

if (typeof window !== 'undefined') {
  // Projects are saved to Supabase (cloud only) — no localStorage persistence
  // The projectsStore is populated from Supabase when the user logs in
  // activeProjectId is still persisted locally for convenience (which project to open)
  activeProjectIdStore.subscribe((value) => {
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, value);
    } catch {
      /* ignore */
    }
  });
}

export function getActiveProject(): ProjectRecord {
  const projects = projectsStore.get();
  const id = activeProjectIdStore.get();
  return projects[id] ?? { id, name: '', settings: DEFAULT_SETTINGS };
}

export function setActiveProject(id: string, name = '') {
  activeProjectIdStore.set(id);
  const projects = projectsStore.get();
  if (!projects[id]) {
    projectsStore.setKey(id, { id, name, settings: DEFAULT_SETTINGS });
  }
}

export async function updateActiveProjectSettings(patch: Partial<ProjectSettings>) {
  const id = activeProjectIdStore.get();
  const current = getActiveProject();
  
  const updatedSettings = {
    ...DEFAULT_SETTINGS,
    ...current.settings,
    ...patch,
    github: { ...DEFAULT_SETTINGS.github, ...current.settings.github, ...(patch.github ?? {}) },
    netlify: { ...DEFAULT_SETTINGS.netlify, ...current.settings.netlify, ...(patch.netlify ?? {}) },
    vercel: { ...DEFAULT_SETTINGS.vercel, ...current.settings.vercel, ...(patch.vercel ?? {}) },
    cloudRun: { ...DEFAULT_SETTINGS.cloudRun, ...current.settings.cloudRun, ...(patch.cloudRun ?? {}) },
    database: { ...DEFAULT_SETTINGS.database, ...current.settings.database, ...(patch.database ?? {}), firebase: { ...DEFAULT_SETTINGS.database.firebase, ...current.settings.database.firebase, ...(patch.database?.firebase ?? {}) }, supabase: { ...DEFAULT_SETTINGS.database.supabase, ...current.settings.database.supabase, ...(patch.database?.supabase ?? {}) }, omni: { ...DEFAULT_SETTINGS.database.omni, ...current.settings.database.omni, ...(patch.database?.omni ?? {}) } },
    googleDrive: { ...DEFAULT_SETTINGS.googleDrive, ...current.settings.googleDrive, ...(patch.googleDrive ?? {}) },
  };

  const updatedProject = {
    ...current,
    name: patch.name || current.name,
    settings: updatedSettings,
  };

  projectsStore.setKey(id, updatedProject);

  const sb = getSupabase();
  const { user } = authStore.get();

  if (sb && user) {
    const projectData = {
      owner_id: user.id,
      name: updatedProject.name || 'Untitled Project',
      description: updatedSettings.description,
      logo: updatedSettings.logo,
      custom_rules: updatedSettings.customRules,
      preview_mode: updatedSettings.previewMode,
      provider: updatedSettings.provider,
      model: updatedSettings.model,
      env_vars: updatedSettings.envVars,
      last_deploy: {
        url: updatedSettings.lastDeploy.url,
        provider: updatedSettings.lastDeploy.provider,
        siteId: updatedSettings.lastDeploy.siteId,
        deployedAt: updatedSettings.lastDeploy.deployedAt,
      },
      github_repo: updatedSettings.github.repo,
      github_branch: updatedSettings.github.branch,
      github_token: updatedSettings.github.token,
      netlify_config: {
        token: updatedSettings.netlify.token,
        siteId: updatedSettings.netlify.siteId,
      },
      vercel_config: {
        token: updatedSettings.vercel.token,
        projectName: updatedSettings.vercel.projectName,
        framework: updatedSettings.vercel.framework,
      },
      cloudrun_config: {
        projectId: updatedSettings.cloudRun.projectId,
        region: updatedSettings.cloudRun.region,
        serviceAccountKey: updatedSettings.cloudRun.serviceAccountKey,
        serviceName: updatedSettings.cloudRun.serviceName,
        allowUnauthenticated: updatedSettings.cloudRun.allowUnauthenticated,
      },
      database_config: {
        type: updatedSettings.database.type,
        firebase: updatedSettings.database.firebase,
        supabase: updatedSettings.database.supabase,
        omni: updatedSettings.database.omni,
      },
      google_drive_config: {
        clientId: updatedSettings.googleDrive.clientId,
      },
      updated_at: new Date().toISOString(),
    };

    if (id !== 'default' && id.length > 10) {
      await sb.from('projects').upsert({ id, ...projectData });
    } else {
      // New project creation — check the project limit first
      const currentCount = await getProjectCount();
      if (currentCount >= MAX_PROJECTS_PER_USER) {
        throw new Error(`Limite de ${MAX_PROJECTS_PER_USER} projetos atingido. Exclua um projeto antes de criar um novo.`);
      }
      const { data } = await sb.from('projects').insert(projectData).select().single();
      if (data) {
        activeProjectIdStore.set(data.id);
        projectsStore.setKey(data.id, { ...updatedProject, id: data.id });
      }
    }
  }
}

/**
 * Load all projects for the current user from Supabase and populate the local store.
 * This replaces the old localStorage-based project loading.
 */
export async function loadAllProjectsFromSupabase(): Promise<number> {
  const sb = getSupabase();
  const { user } = authStore.get();
  if (!sb || !user) return 0;

  try {
    const { data, error } = await sb
      .from('projects')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false });

    if (error || !data) return 0;

    // Clear existing local projects and replace with Supabase data
    const newProjects: Record<string, ProjectRecord> = {};

    for (const p of data) {
      const settings: ProjectSettings = {
        name: p.name || '',
        description: p.description || '',
        logo: p.logo || '',
        customRules: p.custom_rules || '',
        previewMode: p.preview_mode || 'webcontainer',
        provider: p.provider === 'freeapi' ? 'openrouter' : (p.provider || 'openrouter'),
        model: p.model || 'gpt-4o-mini',
        envVars: Array.isArray(p.env_vars) ? p.env_vars : [],
        lastDeploy: {
          url: p.last_deploy?.url || '',
          provider: p.last_deploy?.provider || '',
          siteId: p.last_deploy?.siteId || '',
          deployedAt: p.last_deploy?.deployedAt || '',
        },
        github: {
          token: p.github_token || '',
          repo: p.github_repo || '',
          branch: p.github_branch || 'main',
        },
        netlify: {
          token: p.netlify_config?.token || '',
          siteId: p.netlify_config?.siteId || '',
        },
        vercel: {
          token: p.vercel_config?.token || '',
          projectName: p.vercel_config?.projectName || '',
          framework: p.vercel_config?.framework || 'vite',
        },
        cloudRun: {
          projectId: p.cloudrun_config?.projectId || '',
          region: p.cloudrun_config?.region || 'us-central1',
          serviceAccountKey: p.cloudrun_config?.serviceAccountKey || '',
          serviceName: p.cloudrun_config?.serviceName || '',
          allowUnauthenticated: p.cloudrun_config?.allowUnauthenticated ?? true,
        },
        database: {
          type: p.database_config?.type || 'none',
          firebase: p.database_config?.firebase || { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', measurementId: '' },
          supabase: p.database_config?.supabase || { url: '', anonKey: '', serviceRoleKey: '' },
          omni: p.database_config?.omni || { enabled: false, projectId: '' },
        },
        googleDrive: {
          clientId: p.google_drive_config?.clientId || '',
        },
      };

      newProjects[p.id] = {
        id: p.id,
        name: p.name || '',
        settings,
      };
    }

    projectsStore.set(newProjects);
    return data.length;
  } catch {
    return 0;
  }
}

/**
 * Get the count of projects for the current user from Supabase.
 * Used to enforce the project limit.
 */
export async function getProjectCount(): Promise<number> {
  const sb = getSupabase();
  const { user } = authStore.get();
  if (!sb || !user) return 0;

  try {
    const { count, error } = await sb
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id);

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

export const MAX_PROJECTS_PER_USER = 10;
export async function loadProjectFromSupabase(projectId: string): Promise<ProjectRecord | null> {
  const sb = getSupabase();
  const { user } = authStore.get();
  if (!sb || !user) return null;

  try {
    const { data, error } = await sb
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('owner_id', user.id)
      .single();

    if (error || !data) return null;

    const settings: ProjectSettings = {
      name: data.name || '',
      description: data.description || '',
      logo: data.logo || '',
      customRules: data.custom_rules || '',
      previewMode: data.preview_mode || 'webcontainer',
      provider: data.provider === 'freeapi' ? 'openrouter' : (data.provider || 'openrouter'),
      model: data.model || 'gpt-4o-mini',
      envVars: Array.isArray(data.env_vars) ? data.env_vars : [],
      lastDeploy: {
        url: data.last_deploy?.url || '',
        provider: data.last_deploy?.provider || '',
        siteId: data.last_deploy?.siteId || '',
        deployedAt: data.last_deploy?.deployedAt || '',
      },
      github: {
        token: data.github_token || '',
        repo: data.github_repo || '',
        branch: data.github_branch || 'main',
      },
      netlify: {
        token: data.netlify_config?.token || '',
        siteId: data.netlify_config?.siteId || '',
      },
      vercel: {
        token: data.vercel_config?.token || '',
        projectName: data.vercel_config?.projectName || '',
        framework: data.vercel_config?.framework || 'vite',
      },
      cloudRun: {
        projectId: data.cloudrun_config?.projectId || '',
        region: data.cloudrun_config?.region || 'us-central1',
        serviceAccountKey: data.cloudrun_config?.serviceAccountKey || '',
        serviceName: data.cloudrun_config?.serviceName || '',
        allowUnauthenticated: data.cloudrun_config?.allowUnauthenticated ?? true,
      },
      database: {
        type: data.database_config?.type || 'none',
        firebase: data.database_config?.firebase || { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', measurementId: '' },
        supabase: data.database_config?.supabase || { url: '', anonKey: '', serviceRoleKey: '' },
        omni: data.database_config?.omni || { enabled: false, projectId: '' },
      },
      googleDrive: {
        clientId: data.google_drive_config?.clientId || '',
      },
    };

    const record: ProjectRecord = {
      id: data.id,
      name: data.name || '',
      settings,
    };

    // Update local store
    projectsStore.setKey(data.id, record);

    return record;
  } catch {
    return null;
  }
}

/**
 * Delete a project from Supabase and local store
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  const sb = getSupabase();
  const { user } = authStore.get();

  // Remove from local store
  const projects = { ...projectsStore.get() };
  delete projects[projectId];
  projectsStore.set(projects);

  if (sb && user) {
    try {
      const { error } = await sb.from('projects').delete().eq('id', projectId).eq('owner_id', user.id);
      if (error) {
        console.error('Failed to delete project from Supabase:', error);
        return false;
      }
    } catch {
      return false;
    }
  }

  // If this was the active project, reset
  if (activeProjectIdStore.get() === projectId) {
    activeProjectIdStore.set('default');
  }

  return true;
}

/**
 * Rename a project (updates both local and Supabase)
 */
export async function renameProject(projectId: string, newName: string): Promise<boolean> {
  const projects = projectsStore.get();
  const project = projects[projectId];
  if (!project) return false;

  projectsStore.setKey(projectId, { ...project, name: newName, settings: { ...project.settings, name: newName } });

  const sb = getSupabase();
  const { user } = authStore.get();

  if (sb && user) {
    try {
      const { error } = await sb.from('projects').update({ name: newName, updated_at: new Date().toISOString() }).eq('id', projectId).eq('owner_id', user.id);
      if (error) return false;
    } catch {
      return false;
    }
  }

  return true;
}

export function envVarsToFile(envVars: EnvVar[]): string {
  return envVars.filter((v) => v.key.trim()).map((v) => `${v.key.trim()}=${v.value}`).join('\n') + '\n';
}

/**
 * Save messages for a project to Supabase.
 * Also saves to IndexedDB as a local cache/fallback.
 */
export async function saveProjectMessages(projectId: string, messages: Message[], description?: string): Promise<void> {
  // Always save to IndexedDB first (fast local cache)
  try {
    const database = await getDb();
    if (database) {
      await setMessages(database, projectId, messages, undefined, description);
    }
  } catch (err) {
    console.warn('[saveProjectMessages] Failed to cache in IndexedDB:', err);
  }

  // Save to Supabase (cloud)
  const sb = getSupabase();
  const { user } = authStore.get();
  if (!sb || !user) return;

  try {
    const update: Record<string, any> = {
      messages: messages as any,
      updated_at: new Date().toISOString(),
    };
    if (description) {
      update.description = description;
    }

    const { error } = await sb
      .from('projects')
      .update(update)
      .eq('id', projectId)
      .eq('owner_id', user.id);

    if (error) {
      console.error('[saveProjectMessages] Supabase error:', error.message);
    }
  } catch (err) {
    console.error('[saveProjectMessages] Failed to save to cloud:', err);
  }
}

/**
 * Load messages for a project from Supabase (cloud-first), falling back to IndexedDB.
 */
export async function loadProjectMessages(projectId: string): Promise<Message[]> {
  // Try Supabase first
  const sb = getSupabase();
  const { user } = authStore.get();
  if (sb && user) {
    try {
      const { data, error } = await sb
        .from('projects')
        .select('messages, description')
        .eq('id', projectId)
        .eq('owner_id', user.id)
        .single();

      if (!error && data && Array.isArray(data.messages) && data.messages.length > 0) {
        // Cache to IndexedDB for offline access
        try {
          const database = await getDb();
          if (database) {
            await setMessages(database, projectId, data.messages as Message[], undefined, data.description || undefined);
          }
        } catch {}
        return data.messages as Message[];
      }
    } catch (err) {
      console.warn('[loadProjectMessages] Supabase load failed, trying IndexedDB:', err);
    }
  }

  // Fallback to IndexedDB
  try {
    const database = await getDb();
    if (database) {
      const stored = await getMessages(database, projectId);
      if (stored && stored.messages.length > 0) {
        return stored.messages;
      }
    }
  } catch (err) {
    console.warn('[loadProjectMessages] IndexedDB load failed:', err);
  }

  return [];
}

export async function writeEnvFile(envVars: EnvVar[]) {
  const { webcontainer } = await import('~/lib/webcontainer');
  const { WORK_DIR } = await import('~/utils/constants');
  const nodePath = await import('node:path');
  const wc = await webcontainer;
  await wc.fs.writeFile(nodePath.join(WORK_DIR, '.env'), envVarsToFile(envVars));
}

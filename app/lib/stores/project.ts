import { atom, map } from 'nanostores';
import { getSupabase } from '~/lib/supabase';
import { authStore } from './auth';

export interface EnvVar {
  key: string;
  value: string;
}

export type PreviewMode = 'webcontainer' | 'sandpack' | 'iframe' | 'newtab' | 'reactlive' | 'playcode';

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

export interface ProjectSettings {
  name: string;
  description: string;
  logo: string;
  envVars: EnvVar[];
  previewMode: PreviewMode;
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
    type: 'none' | 'firebase' | 'supabase';
    firebase: FirebaseConfig;
    supabase: SupabaseConfig;
  };
  googleDrive: {
    clientId: string;
  };
}

export interface ProjectRecord {
  id: string;
  name: string;
  settings: ProjectSettings;
}

const PROJECTS_KEY = 'bolt.project.records';
const ACTIVE_PROJECT_KEY = 'bolt.project.active';

const DEFAULT_SETTINGS: ProjectSettings = {
  name: '',
  description: '',
  logo: '',
  envVars: [],
  previewMode: 'webcontainer',
  netlify: { token: '', siteId: '' },
  vercel: { token: '', projectName: '', framework: 'vite' },
  cloudRun: { projectId: '', region: 'us-central1', serviceAccountKey: '', serviceName: '', allowUnauthenticated: true },
  github: { token: '', repo: '', branch: 'main' },
  database: {
    type: 'none',
    firebase: { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', measurementId: '' },
    supabase: { url: '', anonKey: '', serviceRoleKey: '' },
  },
  googleDrive: { clientId: '' },
};

function loadProjects(): Record<string, ProjectRecord> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ProjectRecord>;
  } catch {
    return {};
  }
}

function loadActiveProjectId(): string {
  if (typeof localStorage === 'undefined') return 'default';
  return localStorage.getItem(ACTIVE_PROJECT_KEY) || 'default';
}

export const activeProjectIdStore = atom<string>(loadActiveProjectId());
export const projectsStore = map<Record<string, ProjectRecord>>(loadProjects());

if (typeof window !== 'undefined') {
  projectsStore.subscribe((state) => {
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  });
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
    database: { ...DEFAULT_SETTINGS.database, ...current.settings.database, ...(patch.database ?? {}), firebase: { ...DEFAULT_SETTINGS.database.firebase, ...current.settings.database.firebase, ...(patch.database?.firebase ?? {}) }, supabase: { ...DEFAULT_SETTINGS.database.supabase, ...current.settings.database.supabase, ...(patch.database?.supabase ?? {}) } },
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
      env_vars: updatedSettings.envVars,
      github_repo: updatedSettings.github.repo,
      github_branch: updatedSettings.github.branch,
      github_token: updatedSettings.github.token,
      updated_at: new Date().toISOString(),
    };

    if (id !== 'default' && id.length > 10) {
      await sb.from('projects').upsert({ id, ...projectData });
    } else {
      const { data } = await sb.from('projects').insert(projectData).select().single();
      if (data) {
        activeProjectIdStore.set(data.id);
        projectsStore.setKey(data.id, { ...updatedProject, id: data.id });
      }
    }
  }
}

export function envVarsToFile(envVars: EnvVar[]): string {
  return envVars.filter((v) => v.key.trim()).map((v) => `${v.key.trim()}=${v.value}`).join('\n') + '\n';
}

export async function writeEnvFile(envVars: EnvVar[]) {
  const { webcontainer } = await import('~/lib/webcontainer');
  const { WORK_DIR } = await import('~/utils/constants');
  const nodePath = await import('node:path');
  const wc = await webcontainer;
  await wc.fs.writeFile(nodePath.join(WORK_DIR, '.env'), envVarsToFile(envVars));
}
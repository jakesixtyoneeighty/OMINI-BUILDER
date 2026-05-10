import { atom, map } from 'nanostores';
import { getSupabase } from '~/lib/supabase';
import { activeProjectIdStore, projectsStore } from './project';

export type ProviderId = 'anthropic' | 'openrouter' | 'google' | 'freeapi';

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  google: 'Google Gemini',
  freeapi: 'Free API (apifreellm.com)',
};

export interface ModelInfo {
  id: string;
  label: string;
}

export interface LLMState {
  provider: ProviderId;
  model: string;
  keys: Record<ProviderId, string>;
}

const STORAGE_KEY = 'bolt.llm.settings';

const DEFAULT_STATE: LLMState = {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20240620',
  keys: { anthropic: '', openrouter: '', google: '', freeapi: '' },
};

function loadInitial(): LLMState {
  if (typeof localStorage === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider ?? DEFAULT_STATE.provider,
      model: parsed.model ?? DEFAULT_STATE.model,
      keys: { ...DEFAULT_STATE.keys, ...(parsed.keys ?? {}) },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export const llmStore = map<LLMState>(loadInitial());

export const modelsStore = map<Record<ProviderId, ModelInfo[]>>({
  anthropic: [],
  openrouter: [],
  google: [],
  freeapi: [],
});

export const modelsLoadingStore = map<Record<ProviderId, boolean>>({
  anthropic: false,
  openrouter: false,
  google: false,
  freeapi: false,
});

export const modelsErrorStore = atom<string | null>(null);

if (typeof window !== 'undefined') {
  llmStore.subscribe((state) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  });

  // Sync project-specific provider/model when switching projects
  projectsStore.subscribe((projects) => {
    const projectId = activeProjectIdStore.get();
    const project = projects[projectId];
    if (project?.settings?.provider || project?.settings?.model) {
      const current = llmStore.get();
      const newProvider = project.settings.provider || current.provider;
      const newModel = project.settings.model || current.model;
      // Only update if different to avoid infinite loops
      if (current.provider !== newProvider || current.model !== newModel) {
        llmStore.setKey('provider', newProvider);
        llmStore.setKey('model', newModel);
      }
    }
  });
} 

export async function syncKeysToSupabase() {
  const sb = getSupabase();
  const { authStore } = await import('./auth');
  const { user } = authStore.get();
  const { keys, provider, model } = llmStore.get();

  if (sb && user) {
    await sb.from('profiles').upsert({
      id: user.id,
      anthropic_key: keys.anthropic,
      openrouter_key: keys.openrouter,
      google_key: keys.google,
      freeapi_key: keys.freeapi,
      last_provider: provider,
      last_model: model,
      updated_at: new Date().toISOString(),
    });
  }
}

export async function loadKeysFromSupabase() {
  const sb = getSupabase();
  const { authStore } = await import('./auth');
  const { user } = authStore.get();

  if (sb && user) {
    const { data, error } = await sb
      .from('profiles')
      .select('anthropic_key, openrouter_key, google_key, freeapi_key, last_provider, last_model')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      const current = llmStore.get();
      llmStore.set({
        provider: (data.last_provider as ProviderId) || current.provider,
        model: data.last_model || current.model,
        keys: {
          anthropic: data.anthropic_key || current.keys.anthropic,
          openrouter: data.openrouter_key || current.keys.openrouter,
          google: data.google_key || current.keys.google,
          freeapi: (data as any).freeapi_key || current.keys.freeapi,
        },
      });
    }
  }
}

export function setProvider(provider: ProviderId) {
  llmStore.setKey('provider', provider);
}

export function setModel(model: string) {
  llmStore.setKey('model', model);
}

export function selectProviderModel(provider: ProviderId, model: string) {
  llmStore.setKey('provider', provider);
  llmStore.setKey('model', model);

  // Save to active project settings so each project remembers its model
  const projectId = activeProjectIdStore.get();
  if (projectId && projectId !== 'default') {
    import('./project').then(({ updateActiveProjectSettings }) => {
      updateActiveProjectSettings({ provider, model });
    });
  }

  // Persist last used model to Supabase so the user gets it back on any device
  syncKeysToSupabase().catch(() => {});
}

export async function setApiKey(provider: ProviderId, key: string) {
  const current = llmStore.get();
  llmStore.setKey('keys', { ...current.keys, [provider]: key });
  await syncKeysToSupabase();
}

export function getChatBody() {
  const { provider, model, keys } = llmStore.get();
  return { provider, model, apiKey: keys[provider] || '' };
}

export async function fetchModelsFor(provider: ProviderId): Promise<ModelInfo[]> {
  const key = llmStore.get().keys[provider];
  // For freeapi, we can fetch models even without a user-provided key
  // because the server has LLM_FREE_API env var
  if (!key && provider !== 'freeapi') {
    modelsStore.setKey(provider, []);
    return [];
  }
  modelsLoadingStore.setKey(provider, true);
  modelsErrorStore.set(null);
  try {
    const headers: Record<string, string> = {};
    if (key) {
      headers['x-api-key'] = key;
    }
    const res = await fetch(`/api/models?provider=${provider}`, { headers });
    const data = (await res.json()) as { models?: ModelInfo[]; error?: string };
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const models = data.models ?? [];
    modelsStore.setKey(provider, models);
    return models;
  } catch (e) {
    modelsErrorStore.set(`${PROVIDER_LABELS[provider]}: ${e instanceof Error ? e.message : e}`);
    modelsStore.setKey(provider, []);
    return [];
  } finally {
    modelsLoadingStore.setKey(provider, false);
  }
}

export async function refreshAllConfiguredModels() {
  const { keys } = llmStore.get();
  await Promise.all(
    (Object.keys(keys) as ProviderId[])
      .filter((p) => keys[p] || p === 'freeapi') // Always try freeapi since server may have key
      .map((p) => fetchModelsFor(p)),
  );
}

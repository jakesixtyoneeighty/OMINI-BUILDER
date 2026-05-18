import { atom, map } from 'nanostores';
import { getSupabase } from '~/lib/supabase';
import { activeProjectIdStore, projectsStore, isValidUUID } from './project';

export type ProviderId = 'anthropic' | 'openrouter' | 'google';

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  google: 'Google Gemini',
};

// Agent Omini — the default free model powered by qwen3-coder via OpenRouter
// Uses the server's OPENROUTER_API_KEY so users don't need their own key
export const AGENT_OMINI_MODEL_ID = 'qwen/qwen3-coder:free';
export const AGENT_OMINI_LABEL = 'Agent Omini';

// Other free models available on OpenRouter (verified as of 2025-05)
export const FREE_MODELS = [
  { id: 'qwen/qwen3-coder:free', label: 'Agent Omini' },
  { id: 'deepseek/deepseek-v4-flash:free', label: 'DeepSeek V4 Flash (Free)' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)' },
  { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (Free)' },
  { id: 'qwen/qwen3-next-80b-a3b-instruct:free', label: 'Qwen3 Next 80B (Free)' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super (Free)' },
];

export const FREE_MODEL_ID = AGENT_OMINI_MODEL_ID;
export const FREE_MODEL_LABEL = AGENT_OMINI_LABEL;
export const FREE_PROVIDER: ProviderId = 'openrouter';

/**
 * Check if a model ID is one of the known free models
 */
export function isFreeModel(modelId: string): boolean {
  return FREE_MODELS.some((m) => m.id === modelId) ||
    modelId === AGENT_OMINI_MODEL_ID ||
    // Also match old free model IDs that may be stored in localStorage
    modelId === 'deepseek/deepseek-chat:free' ||
    modelId === 'deepseek/deepseek-r1:free' ||
    modelId === 'openrouter/free';
}

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
  provider: 'openrouter',
  model: FREE_MODEL_ID,
  keys: { anthropic: '', openrouter: '', google: '' },
};

function loadInitial(): LLMState {
  if (typeof localStorage === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    let provider = (parsed.provider as ProviderId) ?? DEFAULT_STATE.provider;
    let model = parsed.model ?? DEFAULT_STATE.model;
    const keys = { ...DEFAULT_STATE.keys, ...(parsed.keys ?? {}) };

    // Migrate: if the stored provider was 'freeapi', fall back to openrouter
    if (provider === 'freeapi') {
      provider = 'openrouter';
      model = FREE_MODEL_ID;
    }

    // Migrate: if the stored provider has no key and it's not openrouter with free models, fall back to openrouter
    if (provider !== 'openrouter' && !keys[provider]) {
      return { provider: 'openrouter', model: FREE_MODEL_ID, keys };
    }

    // Migrate: if the stored model is the old default, update to Agent Omini
    if (model === 'gpt-4o-mini' || model === 'deepseek/deepseek-chat:free' || model === 'deepseek/deepseek-r1:free' || model === 'openrouter/free') {
      model = FREE_MODEL_ID;
      provider = 'openrouter';
    }

    return { provider, model, keys };
  } catch {
    return DEFAULT_STATE;
  }
}

export const llmStore = map<LLMState>(loadInitial());

export const modelsStore = map<Record<ProviderId, ModelInfo[]>>({
  anthropic: [],
  openrouter: [],
  google: [],
});

export const modelsLoadingStore = map<Record<ProviderId, boolean>>({
  anthropic: false,
  openrouter: false,
  google: false,
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
  // BUT: only switch if the project has a REAL saved model (not the default placeholder)
  projectsStore.subscribe((projects) => {
    const projectId = activeProjectIdStore.get();
    const project = projects[projectId];
    if (!project?.settings) return;

    const savedProvider = project.settings.provider;
    const savedModel = project.settings.model;
    const current = llmStore.get();

    // Skip if the project's model is still the default — this means it's a new/unsaved project
    // that hasn't been configured yet. We should keep whatever model the user was using.
    const isDefaultModel = (savedProvider === 'openrouter' && isFreeModel(savedModel || '')) ||
                           (savedModel === 'gpt-4o-mini') ||
                           (!savedProvider && !savedModel);

    if (isDefaultModel) return; // Keep the current model selection

    let newProvider = (savedProvider as ProviderId) || current.provider;
    const newModel = savedModel || current.model;

    // Migrate: if the project's saved provider was freeapi, fall back to openrouter
    if (newProvider === 'freeapi') {
      newProvider = 'openrouter';
    }
    // Migrate: if the project's saved provider has no key and it's not openrouter, fall back
    if (newProvider !== 'openrouter' && !current.keys[newProvider]) {
      newProvider = 'openrouter';
    }
    // Only update if different to avoid infinite loops
    if (current.provider !== newProvider || current.model !== newModel) {
      llmStore.setKey('provider', newProvider);
      llmStore.setKey('model', newProvider === 'openrouter' && current.provider !== 'openrouter' ? FREE_MODEL_ID : newModel);
    }
  });
}

export async function syncKeysToSupabase() {
  const sb = getSupabase();
  const { authStore } = await import('./auth');
  const { user } = authStore.get();
  const { keys, provider, model } = llmStore.get();

  if (sb && user) {
    const { error } = await sb.from('profiles').upsert({
      id: user.id,
      anthropic_key: keys.anthropic,
      openrouter_key: keys.openrouter,
      google_key: keys.google,
      last_provider: provider,
      last_model: model,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      // Columns may not exist yet if migration hasn't been run — log silently
      console.warn('[llm] Could not sync keys to Supabase (migration may not be run yet):', error.message);
    }
  }
}

export async function loadKeysFromSupabase() {
  const sb = getSupabase();
  const { authStore } = await import('./auth');
  const { user } = authStore.get();

  if (sb && user) {
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('anthropic_key, openrouter_key, google_key, last_provider, last_model')
        .eq('id', user.id)
        .single();

      // If the columns don't exist yet (migration not run), fall back gracefully
      if (error) {
        console.warn('[llm] Could not load keys from Supabase (migration may not be run yet):', error.message);
        return;
      }

      if (data) {
        const current = llmStore.get();
        let restoredProvider = (data.last_provider as ProviderId) || current.provider;
        let restoredModel = data.last_model || current.model;

        // Merge keys: prefer non-empty values (local or remote), never overwrite with empty
        const restoredKeys = {
          anthropic: data.anthropic_key || current.keys.anthropic,
          openrouter: data.openrouter_key || current.keys.openrouter,
          google: data.google_key || current.keys.google,
        };

        // If we have local keys that are NOT in Supabase, sync them up
        const needsSync =
          (current.keys.anthropic && !data.anthropic_key) ||
          (current.keys.openrouter && !data.openrouter_key) ||
          (current.keys.google && !data.google_key);

        // Migrate: if the restored provider was 'freeapi', fall back to openrouter
        if (restoredProvider === 'freeapi') {
          restoredProvider = 'openrouter';
          restoredModel = FREE_MODEL_ID;
        }

        // Migrate: if the restored provider has no key and it's not openrouter, fall back to openrouter
        if (restoredProvider !== 'openrouter' && !restoredKeys[restoredProvider]) {
          llmStore.set({
            provider: 'openrouter',
            model: FREE_MODEL_ID,
            keys: restoredKeys,
          });
        } else if (restoredProvider === 'openrouter' && isFreeModel(restoredModel)) {
          // Migrate: update old default model to new free model
          llmStore.set({
            provider: 'openrouter',
            model: FREE_MODEL_ID,
            keys: restoredKeys,
          });
        } else {
          llmStore.set({
            provider: restoredProvider,
            model: restoredModel,
            keys: restoredKeys,
          });
        }

        // Sync local keys to Supabase if they were missing there
        if (needsSync) {
          syncKeysToSupabase().catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[llm] Failed to load keys from Supabase, keeping localStorage keys:', err);
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
  if (isValidUUID(projectId)) {
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
  // Migrate: freeapi no longer exists, redirect to openrouter
  if (provider === 'freeapi' as any) {
    provider = 'openrouter';
    const current = llmStore.get();
    if (current.provider === 'freeapi' as any) {
      llmStore.set({ ...current, provider: 'openrouter', model: FREE_MODEL_ID });
    }
  }

  const key = llmStore.get().keys[provider];
  if (!key) {
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
      .filter((p) => keys[p])
      .map((p) => fetchModelsFor(p)),
  );
}

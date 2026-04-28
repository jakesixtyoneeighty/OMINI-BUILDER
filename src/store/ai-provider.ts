// ============================================================
// Omni-Builder — AI Provider Store (Zustand)
// ============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIProviderId, AIModel, ProviderConfig } from '@/services/ai-providers';
import { AI_PROVIDERS } from '@/services/ai-providers';

interface AIProviderStore {
  config: ProviderConfig;
  models: AIModel[];
  isLoadingModels: boolean;
  modelError: string | null;

  setProvider: (provider: AIProviderId) => void;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setModels: (models: AIModel[]) => void;
  setIsLoadingModels: (v: boolean) => void;
  setModelError: (e: string | null) => void;
  isConfigured: () => boolean;
}

export const useAIProviderStore = create<AIProviderStore>()(
  persist(
    (set, get) => ({
      config: {
        provider: 'openrouter',
        apiKey: '',
        model: 'anthropic/claude-sonnet-4',
      },
      models: AI_PROVIDERS[0].defaultModels,
      isLoadingModels: false,
      modelError: null,

      setProvider: (provider) => {
        const providerDef = AI_PROVIDERS.find((p) => p.id === provider);
        set({
          config: {
            ...get().config,
            provider,
            model: providerDef?.defaultModels[0]?.id ?? '',
          },
          models: providerDef?.defaultModels ?? [],
          modelError: null,
        });
      },

      setApiKey: (apiKey) =>
        set((s) => ({
          config: { ...s.config, apiKey },
          modelError: null,
        })),

      setModel: (model) =>
        set((s) => ({
          config: { ...s.config, model },
        })),

      setModels: (models) => set({ models }),
      setIsLoadingModels: (v) => set({ isLoadingModels: v }),
      setModelError: (modelError) => set({ modelError }),

      isConfigured: () => {
        const { config } = get();
        return config.apiKey.length > 0 && config.model.length > 0;
      },
    }),
    {
      name: 'omni-builder-ai-config',
      partialize: (state) => ({
        config: state.config,
      }),
    }
  )
);

export type AIProviderId = 'openrouter' | 'google' | 'openai' | 'claude';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProviderId;
}

export interface ProviderConfig {
  provider: AIProviderId;
  apiKey: string;
  model: string;
}

export interface AIProviderDef {
  id: AIProviderId;
  name: string;
  description: string;
  icon: string; // emoji
  placeholder: string; // API key placeholder text
  defaultModels: AIModel[];
}

export const AI_PROVIDERS: AIProviderDef[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access 100+ models including GPT-4, Claude, Llama, Mistral',
    icon: '🔀',
    placeholder: 'sk-or-v1-...',
    defaultModels: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'openrouter' },
      { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openrouter' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'openrouter' },
      { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'openrouter' },
      { id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'openrouter' },
    ],
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini models via Google AI Studio',
    icon: '🔷',
    placeholder: 'AIza...',
    defaultModels: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4, GPT-3.5 directly from OpenAI',
    icon: '🤖',
    placeholder: 'sk-...',
    defaultModels: [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
      { id: 'o1-mini', name: 'o1 Mini', provider: 'openai' },
    ],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    description: 'Claude models directly from Anthropic',
    icon: '🟠',
    placeholder: 'sk-ant-...',
    defaultModels: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'claude' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'claude' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'claude' },
    ],
  },
];

export async function fetchProviderModels(config: ProviderConfig): Promise<AIModel[]> {
  const provider = AI_PROVIDERS.find(p => p.id === config.provider);
  if (!provider) return provider?.defaultModels ?? [];

  try {
    switch (config.provider) {
      case 'openrouter': {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${config.apiKey}` },
        });
        if (!res.ok) throw new Error('Failed to fetch OpenRouter models');
        const data = await res.json();
        const models: AIModel[] = (data.data || [])
          .filter((m: any) => m.id && m.name)
          .map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            provider: 'openrouter' as const,
          }));
        // Sort by name and return top 50
        return models.sort((a: AIModel, b: AIModel) => a.name.localeCompare(b.name)).slice(0, 50);
      }
      case 'google': {
        // Google AI doesn't have a list models endpoint we can easily call
        return provider.defaultModels;
      }
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${config.apiKey}` },
        });
        if (!res.ok) throw new Error('Failed to fetch OpenAI models');
        const data = await res.json();
        const chatModels = (data.data || [])
          .filter((m: any) => m.id.startsWith('gpt-') || m.id.startsWith('o1'))
          .map((m: any) => ({
            id: m.id,
            name: m.id,
            provider: 'openai' as const,
          }));
        return chatModels.sort((a: AIModel, b: AIModel) => a.name.localeCompare(b.name));
      }
      case 'claude': {
        // Anthropic doesn't expose a public models list endpoint
        return provider.defaultModels;
      }
      default:
        return provider.defaultModels;
    }
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return provider.defaultModels;
  }
}

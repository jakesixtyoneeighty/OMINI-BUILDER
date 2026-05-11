import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

export type ProviderId = 'anthropic' | 'openrouter' | 'google' | 'freeapi';

// Default base URL for the freeapi provider — configurable via LLM_FREE_API_BASE env var
export const DEFAULT_FREEAPI_BASE = 'https://openrouter.ai/api/v1';

export interface FreeApiConfig {
  baseURL?: string;
}

export function getModel(provider: ProviderId, modelId: string, apiKey: string, freeApiConfig?: FreeApiConfig) {
  switch (provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelId);
    }
    case 'openrouter': {
      const openrouter = createOpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        compatibility: 'compatible',
        headers: {
          'HTTP-Referer': 'https://bolt.new',
          'X-Title': 'Omni-Builder',
        },
      });
      return openrouter(modelId, {
        structuredOutputs: false,
      });
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelId);
    }
    case 'freeapi': {
      const baseURL = freeApiConfig?.baseURL || DEFAULT_FREEAPI_BASE;
      const freeapi = createOpenAI({
        apiKey,
        baseURL,
        compatibility: 'compatible',
        headers: {
          'HTTP-Referer': 'https://bolt.new',
          'X-Title': 'Omni-Builder',
        },
      });
      return freeapi(modelId, {
        structuredOutputs: false,
      });
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export function getAnthropicModel(apiKey: string) {
  return getModel('anthropic', 'claude-3-5-sonnet-20240620', apiKey);
}

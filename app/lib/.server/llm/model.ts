import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

export type ProviderId = 'anthropic' | 'openrouter' | 'google';

// Timeout for LLM API requests (5 minutes — large models can take a while to start streaming)
const LLM_TIMEOUT_MS = 5 * 60 * 1000;

export function getModel(provider: ProviderId, modelId: string, apiKey: string) {
  switch (provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey, timeout: LLM_TIMEOUT_MS, maxRetries: 0 });
      return anthropic(modelId);
    }
    case 'openrouter': {
      const openrouter = createOpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        compatibility: 'compatible',
        timeout: LLM_TIMEOUT_MS,
        // Disable automatic retries so errors surface immediately instead of
        // "Failed after 3 attempts. Last error: Provider returned error"
        maxRetries: 0,
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
      const google = createGoogleGenerativeAI({ apiKey, timeout: LLM_TIMEOUT_MS });
      return google(modelId, {
        // Disable automatic retries so errors surface immediately
        maxRetries: 0,
      });
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export function getAnthropicModel(apiKey: string) {
  return getModel('anthropic', 'claude-3-5-sonnet-20240620', apiKey);
}

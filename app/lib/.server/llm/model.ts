import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

export type ProviderId = 'anthropic' | 'openrouter' | 'google';

export function getModel(provider: ProviderId, modelId: string, apiKey: string) {
  switch (provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelId);
    }
    case 'openrouter': {
      const openrouter = createOpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': 'https://bolt.new',
          'X-Title': 'Bolt',
        },
      });
      return openrouter(modelId);
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelId);
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export function getAnthropicModel(apiKey: string) {
  return getModel('anthropic', 'claude-3-5-sonnet-20240620', apiKey);
}

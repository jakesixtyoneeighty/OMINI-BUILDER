import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { getModel, type ProviderId } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

export interface ModelSelection {
  provider: ProviderId;
  model: string;
  apiKey: string;
}

export function streamText(messages: Messages, selection: ModelSelection, options?: StreamingOptions) {
  const extra: { headers?: Record<string, string> } = {};

  if (selection.provider === 'anthropic') {
    extra.headers = { 'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15' };
  }

  return _streamText({
    model: getModel(selection.provider, selection.model, selection.apiKey) as any,
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    ...extra,
    messages: convertToCoreMessages(messages),
    ...options,
  });
}
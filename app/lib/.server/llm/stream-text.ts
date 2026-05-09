import { streamText as _streamText, convertToCoreMessages, type CoreMessage } from 'ai';
import { getModel, type ProviderId } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt, type DatabaseContext } from './prompts';
import { buildTools } from './tools';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Attachment {
  name?: string;
  contentType?: string;
  url: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
  experimental_attachments?: Attachment[];
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

export interface ModelSelection {
  provider: ProviderId;
  model: string;
  apiKey: string;
}

export function streamText(
  messages: Messages,
  selection: ModelSelection,
  options?: StreamingOptions,
  dbContext?: DatabaseContext,
  planMode?: boolean,
  customRules?: string,
  language?: string,
  supabaseUrl?: string,
  supabaseKey?: string,
  serverOrigin?: string,
) {
  const extra: { headers?: Record<string, string> } = {};

  if (selection.provider === 'anthropic') {
    extra.headers = { 'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15' };
  }

  // Convert messages to core messages, handling tool invocations
  const coreMessages = convertToCoreMessages(messages as any);

  // Build tools including omni_db if Omni DB is configured
  const projectId = dbContext?.type === 'omni' ? dbContext.omni?.projectId : undefined;
  const activeTools = buildTools(projectId, supabaseUrl, supabaseKey);

  return _streamText({
    model: getModel(selection.provider, selection.model, selection.apiKey) as any,
    system: getSystemPrompt(undefined, dbContext, planMode, customRules, language, serverOrigin),
    maxTokens: MAX_TOKENS,
    tools: activeTools,
    ...extra,
    messages: coreMessages,
    ...options,
  });
}

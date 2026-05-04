import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type ModelSelection, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import type { ProviderId } from '~/lib/.server/llm/model';
import type { DatabaseContext } from '~/lib/.server/llm/prompts';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

interface ClientDatabaseConfig {
  type: 'none' | 'firebase' | 'supabase';
  firebase?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  supabase?: {
    url: string;
    anonKey: string;
  };
}

interface ChatRequest {
  messages: Messages;
  provider?: ProviderId;
  model?: string;
  apiKey?: string;
  databaseConfig?: ClientDatabaseConfig;
  planMode?: boolean;
  customRules?: string;
}

function resolveSelection(body: ChatRequest, env: Env): ModelSelection {
  const provider = (body.provider ?? 'anthropic') as ProviderId;
  const apiKey =
    body.apiKey ||
    (provider === 'anthropic'
      ? (typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : undefined) || env.ANTHROPIC_API_KEY
      : undefined);

  if (!apiKey) {
    throw new Response(
      JSON.stringify({ error: `Missing API key for provider "${provider}". Configure it in Settings.` }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  const model = body.model || (provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : '');

  if (!model) {
    throw new Response(JSON.stringify({ error: 'No model selected.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  return { provider, model, apiKey };
}

function resolveDbContext(config?: ClientDatabaseConfig): DatabaseContext | undefined {
  if (!config || config.type === 'none') {
    return undefined;
  }

  if (config.type === 'firebase' && config.firebase?.apiKey) {
    return {
      type: 'firebase',
      firebase: {
        apiKey: config.firebase.apiKey,
        authDomain: config.firebase.authDomain || '',
        projectId: config.firebase.projectId || '',
        storageBucket: config.firebase.storageBucket || '',
        messagingSenderId: config.firebase.messagingSenderId || '',
        appId: config.firebase.appId || '',
      },
    };
  }

  if (config.type === 'supabase' && config.supabase?.url) {
    return {
      type: 'supabase',
      supabase: {
        url: config.supabase.url,
        anonKey: config.supabase.anonKey || '',
      },
    };
  }

  return undefined;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const body = await request.json<ChatRequest>();
  const { messages } = body;
  const selection = resolveSelection(body, context.cloudflare.env);
  const dbContext = resolveDbContext(body.databaseConfig);
  const planMode = body.planMode ?? false;
  const customRules = body.customRules;

  const stream = new SwitchableStream();

  try {
    const options: StreamingOptions = {
      toolChoice: 'none',
      onFinish: async ({ text: content, finishReason, usage }) => {
        if (usage) {
          const usagePayload = JSON.stringify({
            type: 'token_usage',
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.promptTokens + usage.completionTokens,
          });
          // Use AI SDK data stream part (code "2") so useChat can parse it
          stream.appendData(`2:${JSON.stringify([usagePayload])}\n`);
        }

        if (finishReason !== 'length') {
          return stream.close();
        }

        if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
          throw Error('Cannot continue message: Maximum segments reached');
        }

        const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

        console.log(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

        messages.push({ role: 'assistant', content });
        messages.push({ role: 'user', content: CONTINUE_PROMPT });

        const result = await streamText(messages, selection, options, dbContext, planMode, customRules);

        return stream.switchSource(result.toAIStream());
      },
    };

    const result = await streamText(messages, selection, options, dbContext, planMode, customRules);

    stream.switchSource(result.toAIStream());

    return new Response(stream.readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.log(error);

    const message = error instanceof Error ? error.message : 'Internal Server Error';

    throw new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

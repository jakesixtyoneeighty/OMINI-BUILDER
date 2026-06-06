import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type ModelSelection, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import type { ProviderId } from '~/lib/.server/llm/model';
import type { DatabaseContext } from '~/lib/.server/llm/prompts';

// Virtual model IDs that the server translates to real provider/model pairs
// The client sends these virtual IDs; the server resolves them internally
// so the user never sees the real provider/model in the UI.
const AGENT_OMINI_VIRTUAL_ID = 'agent-omini';

// Real provider/model that Agent Omini uses internally
// NOTE: gemini-2.0-flash-lite is DEPRECATED — use gemini-2.5-flash instead (current, stable, fast, free-tier eligible)
const AGENT_OMINI_REAL_PROVIDER: ProviderId = 'google';
const AGENT_OMINI_REAL_MODEL = 'gemini-2.5-flash';

// Old free model IDs that may be stored in localStorage — auto-migrate to agent-omini
const LEGACY_FREE_MODEL_IDS = [
  'qwen/qwen3-coder:free',
  'deepseek/deepseek-v4-flash:free',
  'deepseek/deepseek-chat:free',
  'deepseek/deepseek-r1:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openrouter/free',
];

function isVirtualModel(modelId: string): boolean {
  return modelId === AGENT_OMINI_VIRTUAL_ID || LEGACY_FREE_MODEL_IDS.includes(modelId);
}

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

interface ClientDatabaseConfig {
  type: 'none' | 'firebase' | 'supabase' | 'omni';
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
  omni?: {
    projectId: string;
    enabled: boolean;
  };
}

interface ChatRequest {
  messages: Messages;
  provider?: ProviderId;
  model?: string;
  apiKey?: string;
  databaseConfig?: ClientDatabaseConfig;
  planMode?: boolean;
  thinkMode?: boolean;
  customRules?: string;
  language?: string;
}

function resolveSelection(body: ChatRequest, env: Env): ModelSelection {
  let provider = (body.provider ?? 'openrouter') as ProviderId;
  let model = body.model || '';

  // Migrate legacy free model IDs to agent-omini
  if (LEGACY_FREE_MODEL_IDS.includes(model)) {
    model = AGENT_OMINI_VIRTUAL_ID;
  }

  // Resolve virtual models to real provider/model pairs
  // Agent Omini is the virtual name — internally uses Google Gemini
  const isVirtual = isVirtualModel(model);
  let realProvider = provider;
  let realModel = model;

  if (model === AGENT_OMINI_VIRTUAL_ID) {
    realProvider = AGENT_OMINI_REAL_PROVIDER;
    realModel = AGENT_OMINI_REAL_MODEL;
  }

  // Resolve API key for the REAL provider
  // CRITICAL: For virtual models (Agent Omini), we must NOT use body.apiKey
  // because the client sends the key for the DISPLAYED provider (e.g. OpenRouter),
  // but the real provider is different (e.g. Google). Using the wrong key causes
  // "API key not valid" errors. Virtual models always use the server's env key.
  let apiKey: string | undefined;

  if (isVirtual) {
    // Virtual models: ONLY use the server's environment variable for the real provider
    // Never use body.apiKey (it's for the wrong provider)
    if (realProvider === 'anthropic') {
      apiKey = (typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : undefined) || env.ANTHROPIC_API_KEY;
    } else if (realProvider === 'openrouter') {
      apiKey = (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : undefined) || env.OPENROUTER_API_KEY;
    } else if (realProvider === 'google') {
      apiKey = (typeof process !== 'undefined' ? process.env?.GOOGLE_GENERATIVE_AI_API_KEY : undefined) || env.GOOGLE_GENERATIVE_AI_API_KEY;
    }
  } else {
    // Non-virtual models: client key > server env key
    apiKey =
      body.apiKey ||
      (realProvider === 'anthropic'
        ? (typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : undefined) || env.ANTHROPIC_API_KEY
        : realProvider === 'openrouter'
          ? (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : undefined) || env.OPENROUTER_API_KEY
          : realProvider === 'google'
            ? (typeof process !== 'undefined' ? process.env?.GOOGLE_GENERATIVE_AI_API_KEY : undefined) || env.GOOGLE_GENERATIVE_AI_API_KEY
            : undefined);
  }

  // Virtual models (Agent Omini) use the server's API key
  if (!apiKey && !isVirtual) {
    throw new Response(
      JSON.stringify({ error: `Missing API key for provider "${provider}". Configure your key in Settings. Get a free key at https://openrouter.ai` }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  if (!apiKey && isVirtual) {
    const providerName = realProvider === 'google' ? 'GOOGLE_GENERATIVE_AI_API_KEY' : realProvider === 'openrouter' ? 'OPENROUTER_API_KEY' : `${realProvider.toUpperCase()}_API_KEY`;
    throw new Response(
      JSON.stringify({
        error: `The server does not have the API key configured (${providerName}). Agent Mojo needs this key to work. You can: (1) wait for the administrator to configure the key on the server, or (2) use your own model in Settings > API Keys.`,
        errorType: 'MISSING_API_KEY',
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  if (!realModel) {
    realModel = realProvider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : realProvider === 'openrouter' ? 'openai/gpt-4o-mini' : realProvider === 'google' ? 'gemini-2.0-flash' : '';
  }

  if (!realModel) {
    throw new Response(JSON.stringify({ error: 'No model selected.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' } },
    );
  }

  console.log(`[chat] virtualModel=${model} -> realProvider=${realProvider} realModel=${realModel} hasApiKey=${!!apiKey} isVirtual=${isVirtual} usedServerKey=${isVirtual}`);

  return { provider: realProvider, model: realModel, apiKey };
}

function resolveDbContext(config?: ClientDatabaseConfig): DatabaseContext | undefined {
  if (!config || config.type === 'none') {
    return undefined;
  }

  if (config.type === 'omni' && config.omni?.enabled) {
    return {
      type: 'omni',
      omni: {
        projectId: config.omni.projectId || '',
      },
    };
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
  const env = context.cloudflare.env;
  const selection = resolveSelection(body, env);
  const dbContext = resolveDbContext(body.databaseConfig);
  const planMode = body.planMode ?? false;
  const thinkMode = body.thinkMode ?? false;
  const customRules = body.customRules;
  const language = body.language || 'en';

  // Get Supabase credentials for Omni DB tool
  const supabaseUrl = env.SUPABASE_URL || '';
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '';

  // Determine server origin from request for absolute URLs in SDK
  const url = new URL(request.url);
  const serverOrigin = `${url.protocol}//${url.host}`;

  // Pass the request's abort signal so the LLM stream cancels when the client disconnects
  const abortSignal = request.signal;

  const stream = new SwitchableStream(120_000); // 120s idle timeout — force-close if no chunks arrive

  try {
    const options: StreamingOptions = {
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

        const result = await streamText(messages, selection, options, dbContext, planMode, thinkMode, customRules, language, supabaseUrl, supabaseKey, serverOrigin, abortSignal);
        return stream.switchSource(result.toAIStream());
      },
    };

    const result = await streamText(messages, selection, options, dbContext, planMode, thinkMode, customRules, language, supabaseUrl, supabaseKey, serverOrigin, abortSignal);

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

    console.error('[chat] Error:', error);
    // Log the full error structure for debugging (hide API keys)
    if (error instanceof Error) {
      console.error('[chat] Error name:', error.name);
      console.error('[chat] Error message:', error.message);
      // The Vercel AI SDK wraps provider errors — check the cause chain
      let cause: any = (error as any).cause;
      let depth = 0;
      while (cause && depth < 5) {
        console.error(`[chat] Cause[${depth}]:`, typeof cause === 'object' ? JSON.stringify(cause, null, 2).substring(0, 2000) : cause);
        cause = cause?.cause;
        depth++;
      }
    }

    let message = error instanceof Error ? error.message : 'Internal Server Error';
    let errorType = 'UNKNOWN';

    // Extract HTTP status from AI SDK errors
    const statusCode = (error as any)?.statusCode || (error as any)?.status || (error as any)?.cause?.statusCode || (error as any)?.cause?.status;
    console.error('[chat] Extracted statusCode:', statusCode);

    // Provide helpful error messages for common API failures
    if (abortSignal.aborted) {
      // Client disconnected — no need to send error response
      console.log('[chat] Client disconnected (abort signal)');
      return new Response(null, { status: 499 });
    } else if (message.includes('abort') || message.includes('cancel') || message.includes('Timeout') || message.includes('ETIMEDOUT') || message.includes('timed out')) {
      message = `The model took too long to respond. This can happen with free models or when the server is overloaded. Try again in a few seconds.`;
      errorType = 'TIMEOUT';
    } else if (message.includes('Not Found') || message.includes('"error":"Not Found"') || statusCode === 404) {
      message = `Model "${selection.model}" was not found on OpenRouter. This model may have been discontinued or renamed. Try selecting another model.`;
      errorType = 'MODEL_NOT_FOUND';
    } else if (message.includes('401') || message.includes('Unauthorized') || message.includes('Authentication') || statusCode === 401) {
      message = `Invalid or expired API key for OpenRouter. If you are using Agent Mojo (free model), the server needs a valid key. You can add your own free key in Settings > API Keys > OpenRouter. Get one at https://openrouter.ai`;
      errorType = 'AUTH_ERROR';
    } else if (message.includes('403') || statusCode === 403) {
      message = `Access denied by OpenRouter. Your API key may not have permission to use model "${selection.model}". Check your key in Settings.`;
      errorType = 'FORBIDDEN';
    } else if (message.includes('429') || message.includes('rate') || message.includes('Rate') || statusCode === 429) {
      message = `Request limit reached for OpenRouter. Free models have usage limits. Wait a few seconds and try again.`;
      errorType = 'RATE_LIMITED';
    } else if (message.includes('503') || message.includes('Service Unavailable') || message.includes('Overloaded') || statusCode === 503) {
      message = `The model server is temporarily unavailable or overloaded. Free models may have limited availability. Try again in a few seconds.`;
      errorType = 'SERVICE_UNAVAILABLE';
    } else if (message.includes('Provider returned error') || message.includes('Failed after')) {
      // Generic AI SDK error — give helpful message without revealing internal provider
      message = `Agent Mojo returned an error. Possible causes: (1) The server API key is invalid or expired, (2) The model is temporarily unavailable, (3) Usage limit reached. Try again in a few seconds. If the problem persists, configure your own API key in Settings.`;
      errorType = 'PROVIDER_ERROR';
    } else if (message.includes('Invalid') && message.includes('API key')) {
      message = `Invalid API key for OpenRouter. Get a free key at https://openrouter.ai and add it in Settings.`;
      errorType = 'INVALID_KEY';
    } else if (message.includes('Insufficient') || message.includes('credits') || message.includes('balance')) {
      message = `Insufficient balance on OpenRouter account. Free models do not require balance, but your key may be linked to an account without access to free models.`;
      errorType = 'INSUFFICIENT_CREDITS';
    }

    throw new Response(JSON.stringify({ error: message, errorType }), {
      status: 500,
      headers: { 'content-type': 'application/json' } },
    );
  }
}

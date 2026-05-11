import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type ModelSelection, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import type { ProviderId } from '~/lib/.server/llm/model';
import { DEFAULT_FREEAPI_BASE, type FreeApiConfig } from '~/lib/.server/llm/model';
import type { DatabaseContext } from '~/lib/.server/llm/prompts';

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
  customRules?: string;
  language?: string;
}

function resolveSelection(body: ChatRequest, env: Env): ModelSelection {
  let provider = (body.provider ?? 'freeapi') as ProviderId;
  let apiKey =
    body.apiKey ||
    (provider === 'anthropic'
      ? (typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : undefined) || env.ANTHROPIC_API_KEY
      : provider === 'freeapi'
        ? (typeof process !== 'undefined' ? process.env?.LLM_FREE_API : undefined) || env.LLM_FREE_API
        : provider === 'openrouter'
          ? (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : undefined) || env.OPENROUTER_API_KEY
          : provider === 'google'
            ? (typeof process !== 'undefined' ? process.env?.GOOGLE_GENERATIVE_AI_API_KEY : undefined) || env.GOOGLE_GENERATIVE_AI_API_KEY
            : undefined);

  // Smart fallback: if no API key for the selected provider, fall back to freeapi (server has LLM_FREE_API)
  if (!apiKey && provider !== 'freeapi') {
    const freeApiKey = (typeof process !== 'undefined' ? process.env?.LLM_FREE_API : undefined) || env.LLM_FREE_API;
    if (freeApiKey) {
      console.log(`No API key for provider "${provider}", falling back to freeapi`);
      provider = 'freeapi';
      apiKey = freeApiKey;
    }
  }

  if (!apiKey) {
    throw new Response(
      JSON.stringify({ error: `Missing API key for provider "${provider}". Configure it in Settings or set the LLM_FREE_API env var on the server. You can get a free API key at https://openrouter.ai` }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  // Determine the freeapi base URL from env var (allows switching from apifreellm to OpenRouter etc.)
  const freeApiBaseURL = (typeof process !== 'undefined' ? process.env?.LLM_FREE_API_BASE : undefined) || env.LLM_FREE_API_BASE || DEFAULT_FREEAPI_BASE;
  const freeApiModel = (typeof process !== 'undefined' ? process.env?.LLM_FREE_API_MODEL : undefined) || env.LLM_FREE_API_MODEL;

  // Determine model — use env var override for freeapi, then body, then defaults
  let model: string;
  if (provider === 'freeapi' && freeApiModel) {
    model = freeApiModel; // Server-side override takes precedence
  } else {
    model = body.model || (provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : provider === 'freeapi' ? 'openrouter/free' : provider === 'google' ? 'gemini-2.0-flash' : '');
  }

  if (!model) {
    throw new Response(JSON.stringify({ error: 'No model selected.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' } },
    );
  }

  const freeApiConfig: FreeApiConfig = { baseURL: freeApiBaseURL };

  console.log(`[chat] provider=${provider} model=${model} baseURL=${freeApiBaseURL}`);

  return { provider, model, apiKey, freeApiConfig };
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
  const customRules = body.customRules;
  const language = body.language || 'pt';

  // Get Supabase credentials for Omni DB tool
  const supabaseUrl = env.SUPABASE_URL || '';
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '';

  // Determine server origin from request for absolute URLs in SDK
  const url = new URL(request.url);
  const serverOrigin = `${url.protocol}//${url.host}`;

  const stream = new SwitchableStream();

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

        const result = await streamText(messages, selection, options, dbContext, planMode, customRules, language, supabaseUrl, supabaseKey, serverOrigin);

        return stream.switchSource(result.toAIStream());
      },
    };

    const result = await streamText(messages, selection, options, dbContext, planMode, customRules, language, supabaseUrl, supabaseKey, serverOrigin);

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

    let message = error instanceof Error ? error.message : 'Internal Server Error';

    // Provide helpful error messages for common API failures
    if (message.includes('Not Found') || message.includes('"error":"Not Found"')) {
      message = `O modelo "${selection.model}" nao foi encontrado no servidor LLM. Verifique se o LLM_FREE_API_BASE e LLM_FREE_API_MODEL estao configurados corretamente no servidor. Dica: use OpenRouter (https://openrouter.ai) para modelos gratuitos.`;
    } else if (message.includes('401') || message.includes('Unauthorized') || message.includes('Authentication')) {
      message = `Chave de API invalida para o provedor "${selection.provider}". Verifique sua chave nas Configuracoes ou configure LLM_FREE_API no servidor.`;
    } else if (message.includes('429') || message.includes('rate') || message.includes('Rate')) {
      message = `Limite de requisicoes atingido para o provedor "${selection.provider}". Aguarde um momento e tente novamente.`;
    }

    throw new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' } },
    );
  }
}

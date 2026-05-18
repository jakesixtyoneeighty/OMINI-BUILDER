import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type ModelSelection, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import type { ProviderId } from '~/lib/.server/llm/model';
import type { DatabaseContext } from '~/lib/.server/llm/prompts';

// Known free model IDs on OpenRouter (must match llm.ts FREE_MODELS)
const KNOWN_FREE_MODELS = [
  'qwen/qwen3-coder:free',
  'deepseek/deepseek-v4-flash:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

function isFreeModelId(modelId: string): boolean {
  return KNOWN_FREE_MODELS.includes(modelId) ||
    modelId === 'deepseek/deepseek-chat:free' ||
    modelId === 'deepseek/deepseek-r1:free' ||
    modelId === 'openrouter/free';
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
  customRules?: string;
  language?: string;
}

function resolveSelection(body: ChatRequest, env: Env): ModelSelection {
  const provider = (body.provider ?? 'openrouter') as ProviderId;
  const apiKey =
    body.apiKey ||
    (provider === 'anthropic'
      ? (typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : undefined) || env.ANTHROPIC_API_KEY
      : provider === 'openrouter'
        ? (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : undefined) || env.OPENROUTER_API_KEY
        : provider === 'google'
          ? (typeof process !== 'undefined' ? process.env?.GOOGLE_GENERATIVE_AI_API_KEY : undefined) || env.GOOGLE_GENERATIVE_AI_API_KEY
          : undefined);

  // For free models, the server provides the API key via OPENROUTER_API_KEY
  // Users can use free models without providing their own key, OR use their own key
  const isFreeModel = provider === 'openrouter' && isFreeModelId(body.model || '');

  if (!apiKey && !isFreeModel) {
    throw new Response(
      JSON.stringify({ error: `Chave de API ausente para o provedor "${provider}". Configure sua chave nas Configuracoes. Obtenha uma chave gratuita em https://openrouter.ai` }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  if (!apiKey && isFreeModel) {
    throw new Response(
      JSON.stringify({
        error: 'O servidor nao possui a chave OpenRouter configurada (OPENROUTER_API_KEY). Modelos gratuitos (como Agent Omini) precisam de uma chave OpenRouter para funcionar. Voce pode: (1) adicionar sua propria chave gratuita nas Configuracoes > API Keys > OpenRouter, ou (2) o administrador precisa configurar OPENROUTER_API_KEY no servidor. Obtenha uma chave gratuita em https://openrouter.ai',
        errorType: 'MISSING_API_KEY',
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  const model = body.model || (provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : provider === 'openrouter' ? KNOWN_FREE_MODELS[0] : provider === 'google' ? 'gemini-2.0-flash' : '');

  if (!model) {
    throw new Response(JSON.stringify({ error: 'No model selected.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' } },
    );
  }

  console.log(`[chat] provider=${provider} model=${model} hasApiKey=${!!apiKey} isFreeModel=${isFreeModel} clientKey=${!!body.apiKey} envKey=${!!(typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : undefined) || !!env.OPENROUTER_API_KEY}`);

  return { provider, model, apiKey };
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

        const result = await streamText(messages, selection, options, dbContext, planMode, customRules, language, supabaseUrl, supabaseKey, serverOrigin, abortSignal);

        return stream.switchSource(result.toAIStream());
      },
    };

    const result = await streamText(messages, selection, options, dbContext, planMode, customRules, language, supabaseUrl, supabaseKey, serverOrigin, abortSignal);

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
      message = `O modelo demorou demais para responder. Isso pode acontecer com modelos gratuitos ou quando o servidor esta sobrecarregado. Tente novamente em alguns segundos.`;
      errorType = 'TIMEOUT';
    } else if (message.includes('Not Found') || message.includes('"error":"Not Found"') || statusCode === 404) {
      message = `O modelo "${selection.model}" nao foi encontrado no OpenRouter. Pode ser que este modelo tenha sido descontinuado ou renomeado. Tente selecionar outro modelo.`;
      errorType = 'MODEL_NOT_FOUND';
    } else if (message.includes('401') || message.includes('Unauthorized') || message.includes('Authentication') || statusCode === 401) {
      message = `Chave de API invalida ou expirada para o OpenRouter. Se voce esta usando o Agent Omini (modelo gratuito), o servidor precisa de uma chave valida. Voce pode adicionar sua propria chave gratuita nas Configuracoes > API Keys > OpenRouter. Obtenha em https://openrouter.ai`;
      errorType = 'AUTH_ERROR';
    } else if (message.includes('403') || statusCode === 403) {
      message = `Acesso negado pelo OpenRouter. Sua chave de API pode nao ter permissao para usar o modelo "${selection.model}". Verifique sua chave nas Configuracoes.`;
      errorType = 'FORBIDDEN';
    } else if (message.includes('429') || message.includes('rate') || message.includes('Rate') || statusCode === 429) {
      message = `Limite de requisicoes atingido para o OpenRouter. Modelos gratuitos tem limites de uso. Aguarde alguns segundos e tente novamente.`;
      errorType = 'RATE_LIMITED';
    } else if (message.includes('503') || message.includes('Service Unavailable') || message.includes('Overloaded') || statusCode === 503) {
      message = `O servidor do modelo esta temporariamente indisponivel ou sobrecarregado. Modelos gratuitos podem ter disponibilidade limitada. Tente novamente em alguns segundos.`;
      errorType = 'SERVICE_UNAVAILABLE';
    } else if (message.includes('Provider returned error') || message.includes('Failed after')) {
      // This is the generic AI SDK error — try to give a more helpful message
      if (isFreeModelId(selection.model)) {
        message = `O modelo "${selection.model}" retornou um erro. Possiveis causas: (1) A chave OpenRouter do servidor esta invalida ou expirada, (2) O modelo gratuito esta temporariamente indisponivel, (3) Limite de uso atingido. Voce pode adicionar sua propria chave OpenRouter gratuita nas Configuracoes > API Keys > OpenRouter. Obtenha em https://openrouter.ai`;
      } else {
        message = `O provedor retornou um erro ao processar sua requisicao. Verifique se sua chave de API e modelo estao corretos nas Configuracoes.`;
      }
      errorType = 'PROVIDER_ERROR';
    } else if (message.includes('Invalid') && message.includes('API key')) {
      message = `Chave de API invalida para o OpenRouter. Obtenha uma chave gratuita em https://openrouter.ai e adicione nas Configuracoes.`;
      errorType = 'INVALID_KEY';
    } else if (message.includes('Insufficient') || message.includes('credits') || message.includes('balance')) {
      message = `Saldo insuficiente na conta OpenRouter. Modelos gratuitos nao exigem saldo, mas sua chave pode estar vinculada a uma conta sem acesso aos modelos gratuitos.`;
      errorType = 'INSUFFICIENT_CREDITS';
    }

    throw new Response(JSON.stringify({ error: message, errorType }), {
      status: 500,
      headers: { 'content-type': 'application/json' } },
    );
  }
}

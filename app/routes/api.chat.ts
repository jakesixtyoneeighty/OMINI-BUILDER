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

  // For the free model, the server provides the API key via OPENROUTER_API_KEY (a.k.a. OPENROUTER_DEFAULT_API)
  // Users can use the free model without providing their own key
  const isFreeModel = provider === 'openrouter' && (body.model === 'deepseek/deepseek-v4-flash:free' || body.model === 'nvidia/nemotron-3-super-120b-a12b:free' || body.model === 'openrouter/free');

  if (!apiKey && !isFreeModel) {
    throw new Response(
      JSON.stringify({ error: `Chave de API ausente para o provedor "${provider}". Configure sua chave nas Configuracoes. Obtenha uma chave gratuita em https://openrouter.ai` }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  if (!apiKey && isFreeModel) {
    throw new Response(
      JSON.stringify({ error: 'O servidor nao possui a chave OpenRouter configurada (OPENROUTER_API_KEY). Contate o administrador.' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  const model = body.model || (provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : provider === 'openrouter' ? 'deepseek/deepseek-v4-flash:free' : provider === 'google' ? 'gemini-2.0-flash' : '');

  if (!model) {
    throw new Response(JSON.stringify({ error: 'No model selected.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' } },
    );
  }

  console.log(`[chat] provider=${provider} model=${model}`);

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

  const stream = new SwitchableStream(60_000); // 60s idle timeout — force-close if no chunks arrive

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

    let message = error instanceof Error ? error.message : 'Internal Server Error';

    // Provide helpful error messages for common API failures
    if (abortSignal.aborted) {
      // Client disconnected — no need to send error response
      console.log('[chat] Client disconnected (abort signal)');
      return new Response(null, { status: 499 });
    } else if (message.includes('abort') || message.includes('cancel') || message.includes('Timeout') || message.includes('ETIMEDOUT') || message.includes('timed out')) {
      message = `O modelo demorou demais para responder. Isso pode acontecer com modelos gratuitos ou quando o servidor esta sobrecarregado. Tente novamente em alguns segundos.`;
    } else if (message.includes('Not Found') || message.includes('"error":"Not Found"')) {
      message = `O modelo "${selection.model}" nao foi encontrado no servidor LLM. Verifique se a chave de API esta correta e se o modelo esta disponivel.`;
    } else if (message.includes('401') || message.includes('Unauthorized') || message.includes('Authentication')) {
      message = `Chave de API invalida para o provedor "${selection.provider}". Verifique sua chave nas Configuracoes.`;
    } else if (message.includes('429') || message.includes('rate') || message.includes('Rate')) {
      message = `Limite de requisicoes atingido para o provedor "${selection.provider}". Aguarde um momento e tente novamente.`;
    } else if (message.includes('503') || message.includes('Service Unavailable') || message.includes('Overloaded')) {
      message = `O servidor do modelo esta temporariamente indisponivel ou sobrecarregado. Tente novamente em alguns segundos.`;
    }

    throw new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' } },
    );
  }
}

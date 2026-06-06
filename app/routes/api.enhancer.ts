import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { StreamingTextResponse, parseStreamPart } from 'ai';
import { streamText, type ModelSelection } from '~/lib/.server/llm/stream-text';
import type { ProviderId } from '~/lib/.server/llm/model';
import { stripIndents } from '~/utils/stripIndent';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

interface EnhancerRequest {
  message: string;
  provider?: ProviderId;
  model?: string;
  apiKey?: string;
}

async function enhancerAction({ context, request }: ActionFunctionArgs) {
  const body = await request.json<EnhancerRequest>();
  const env = context.cloudflare.env;
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

  // For the free model, use the server's OPENROUTER_API_KEY
  const isFreeModel = provider === 'openrouter' && (
    body.model === 'qwen/qwen3-coder:free' ||
    body.model === 'deepseek/deepseek-v4-flash:free' ||
    body.model === 'meta-llama/llama-3.3-70b-instruct:free' ||
    body.model === 'google/gemma-4-31b-it:free' ||
    body.model === 'qwen/qwen3-next-80b-a3b-instruct:free' ||
    body.model === 'nvidia/nemotron-3-super-120b-a12b:free' ||
    body.model === 'deepseek/deepseek-chat:free' ||
    body.model === 'openrouter/free'
  );

  if (!apiKey && !isFreeModel) {
    return new Response(JSON.stringify({ error: `Missing API key for provider "${provider}". Configure your key in Settings.` }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const model = body.model || (provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : provider === 'openrouter' ? 'qwen/qwen3-coder:free' : provider === 'google' ? 'gemini-2.0-flash' : '');

  if (!model) {
    return new Response(JSON.stringify({ error: 'No model selected.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const selection: ModelSelection = { provider, model, apiKey };

  try {
    const result = await streamText(
      [
        {
          role: 'user',
          content: stripIndents`
          I want you to improve the user prompt that is wrapped in \`<original_prompt>\` tags.

          IMPORTANT: Only respond with the improved prompt and nothing else!

          <original_prompt>
            ${body.message}
          </original_prompt>
        `,
        },
      ],
      selection,
    );

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const processedChunk = decoder
          .decode(chunk)
          .split('\n')
          .filter((line) => line !== '')
          .map(parseStreamPart)
          .map((part) => part.value)
          .join('');

        controller.enqueue(encoder.encode(processedChunk));
      },
    });

    const transformedStream = result.toAIStream().pipeThrough(transformStream);

    return new StreamingTextResponse(transformedStream);
  } catch (error) {
    console.error('[enhancer] Error:', error);

    let message = error instanceof Error ? error.message : 'Internal Server Error';

    if (message.includes('Not Found') || message.includes('"error":"Not Found"')) {
      message = `Model "${model}" was not found. Check your API key and selected model.`;
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

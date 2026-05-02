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
  const provider = (body.provider ?? 'anthropic') as ProviderId;
  const apiKey =
    body.apiKey ||
    (provider === 'anthropic'
      ? (typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : undefined) ||
        context.cloudflare.env.ANTHROPIC_API_KEY
      : undefined);

  if (!apiKey) {
    return new Response(JSON.stringify({ error: `Missing API key for provider "${provider}".` }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const model = body.model || (provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : '');

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
    console.log(error);

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Server Error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

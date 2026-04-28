// ============================================================
// Omni-Builder — AI Code Generation API Route (Streaming)
// ============================================================
import { NextRequest } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { SYSTEM_PROMPT } from '@/services/system-prompt';
import type { ProjectFile } from '@/types';

export const maxDuration = 120;

/**
 * Build context from the current project files to send to the LLM.
 * This ensures the AI knows what already exists.
 */
function buildProjectContext(files: Record<string, ProjectFile>): string {
  const entries = Object.values(files);
  if (entries.length === 0) return '';

  let context = '\n\n## Current Project Files\n\n';
  for (const file of files) {
    const content =
      file.content.length > 3000
        ? file.content.substring(0, 3000) + '\n// ... (truncated)'
        : file.content;
    context += `### ${file.path}\n\`\`\`${file.language}\n${content}\n\`\`\`\n\n`;
  }
  return context;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, files, history = [] } = body as {
      prompt: string;
      files: Record<string, ProjectFile>;
      history: { role: string; content: string }[];
    };

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const zai = await ZAI.create();

    // Build message array with context awareness
    const projectContext = buildProjectContext(files);
    const systemMessage = SYSTEM_PROMPT + (projectContext ? projectContext : '');

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemMessage },
      // Include recent conversation history for context (last 10 messages)
      ...history.slice(-10).map((h) => ({
        role: h.role,
        content: h.content,
      })),
      { role: 'user', content: prompt },
    ];

    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const completion = await zai.chat.completions.create({
            messages: messages as any,
            temperature: 0.3,
            max_tokens: 16000,
            stream: true,
          });

          // Process the stream
          if ('body' in completion && completion.body instanceof ReadableStream) {
            const reader = completion.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    continue;
                  }

                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                      );
                    }
                  } catch {
                    // Skip unparseable chunks
                  }
                }
              }
            }
          } else {
            // Non-streaming fallback
            const responseText =
              (completion as any).choices?.[0]?.message?.content ?? '';
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: responseText })}\n\n`)
            );
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          }
        } catch (error: any) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: error.message ?? 'Generation failed' })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message ?? 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

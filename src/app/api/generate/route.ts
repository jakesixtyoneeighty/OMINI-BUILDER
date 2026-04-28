// ============================================================
// Omni-Builder — Multi-Provider AI Code Generation API Route
// ============================================================
import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '@/services/system-prompt';
import type { ProjectFile } from '@/types';

export const maxDuration = 120;

type ProviderId = 'openrouter' | 'google' | 'openai' | 'claude';

interface GenerateRequest {
  prompt: string;
  files: Record<string, ProjectFile>;
  history: { role: string; content: string }[];
  providerConfig: {
    provider: ProviderId;
    apiKey: string;
    model: string;
  };
}

function buildProjectContext(files: Record<string, ProjectFile>): string {
  const entries = Object.values(files);
  if (entries.length === 0) return '';

  let context = '\n\n## Current Project Files\n\n';
  for (const file of entries) {
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
    const body: GenerateRequest = await request.json();
    const { prompt, files, history = [], providerConfig } = body;

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!providerConfig?.apiKey) {
      return new Response(
        JSON.stringify({ error: 'Please configure your AI provider API key in Settings.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { provider, apiKey, model } = providerConfig;
    const projectContext = buildProjectContext(files);
    const systemMessage = SYSTEM_PROMPT + (projectContext ? projectContext : '');

    const messages = [
      { role: 'system', content: systemMessage },
      ...history.slice(-10),
      { role: 'user', content: prompt },
    ];

    let accumulated = '';

    // Create the streaming response
    const finalStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          switch (provider as ProviderId) {
            case 'openrouter': {
              const client = new OpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey,
                dangerouslyAllowBrowser: false,
              });
              const responseStream = await client.chat.completions.create({
                model,
                messages: messages as any,
                temperature: 0.3,
                max_tokens: 16000,
                stream: true,
              });
              for await (const chunk of responseStream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                  accumulated += content;
                  send({ content });
                }
              }
              break;
            }

            case 'openai': {
              const client = new OpenAI({
                baseURL: 'https://api.openai.com/v1',
                apiKey,
                dangerouslyAllowBrowser: false,
              });
              const responseStream = await client.chat.completions.create({
                model,
                messages: messages as any,
                temperature: 0.3,
                max_tokens: 16000,
                stream: true,
              });
              for await (const chunk of responseStream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                  accumulated += content;
                  send({ content });
                }
              }
              break;
            }

            case 'claude': {
              // Use OpenAI-compatible format via Anthropic's API
              // Anthropic uses a different API, but we can use the Messages API
              const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01',
                  'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                  model,
                  max_tokens: 16000,
                  system: systemMessage,
                  messages: messages
                    .filter((m) => m.role !== 'system')
                    .map((m) => ({ role: m.role, content: m.content })),
                  stream: true,
                }),
              });

              if (!claudeRes.ok) {
                const errBody = await claudeRes.text();
                throw new Error(`Claude API error: ${claudeRes.status} - ${errBody}`);
              }

              const reader = claudeRes.body?.getReader();
              if (!reader) throw new Error('No response body from Claude');

              const decoder = new TextDecoder();
              let buffer = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue;
                  const jsonStr = line.slice(6).trim();
                  if (jsonStr === '[DONE]') continue;

                  try {
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                      accumulated += parsed.delta.text;
                      send({ content: parsed.delta.text });
                    }
                  } catch {
                    // skip
                  }
                }
              }
              break;
            }

            case 'google': {
              const { GoogleGenerativeAI } = await import('@google/generative-ai');
              const genAI = new GoogleGenerativeAI(apiKey);
              const genModel = genAI.getGenerativeModel({ model });

              const geminiHistory = messages
                .filter((m) => m.role !== 'system')
                .map((m) => ({
                  role: m.role === 'assistant' ? 'model' as const : 'user' as const,
                  parts: [{ text: m.content }],
                }));

              const chat = genModel.startChat({
                history: geminiHistory,
                systemInstruction: systemMessage,
              });

              const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
              if (!lastUserMsg) throw new Error('No user message');

              const result = await chat.sendMessageStream(lastUserMsg.content);
              for await (const chunk of result.stream) {
                const text = chunk.text();
                if (text) {
                  accumulated += text;
                  send({ content: text });
                }
              }
              break;
            }

            default:
              throw new Error(`Unknown provider: ${provider}`);
          }

          send({ done: true });
        } catch (error: any) {
          send({ error: error.message ?? 'Generation failed' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(finalStream, {
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

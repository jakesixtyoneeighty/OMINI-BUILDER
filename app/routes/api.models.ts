import { type LoaderFunctionArgs, json } from '@remix-run/cloudflare';

interface ModelInfo {
  id: string;
  label: string;
}

const ANTHROPIC_FALLBACK: ModelInfo[] = [
  { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  { id: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
  { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
];

const FREEAPI_FALLBACK: ModelInfo[] = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  { id: 'deepseek-chat', label: 'DeepSeek Chat' },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  { id: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
];

async function fetchOpenRouter(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenRouter: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { data: Array<{ id: string; name?: string }> };
  return data.data
    .map((m) => ({ id: m.id, label: m.name || m.id }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function fetchGoogle(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
  );
  if (!res.ok) throw new Error(`Google: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    models: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
  };
  return data.models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => {
      const id = m.name.replace(/^models\//, '');
      return { id, label: m.displayName || id };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function fetchAnthropic(apiKey: string): Promise<ModelInfo[]> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!res.ok) return ANTHROPIC_FALLBACK;
    const data = (await res.json()) as { data: Array<{ id: string; display_name?: string }> };
    return data.data.map((m) => ({ id: m.id, label: m.display_name || m.id }));
  } catch {
    return ANTHROPIC_FALLBACK;
  }
}

async function fetchFreeApi(apiKey: string): Promise<ModelInfo[]> {
  try {
    const res = await fetch('https://apifreellm.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return FREEAPI_FALLBACK;
    const data = (await res.json()) as { data: Array<{ id: string; name?: string }> };
    if (!data.data || data.data.length === 0) return FREEAPI_FALLBACK;
    return data.data
      .map((m) => ({ id: m.id, label: m.name || m.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return FREEAPI_FALLBACK;
  }
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');
  const apiKey = request.headers.get('x-api-key') || url.searchParams.get('apiKey') || '';

  // For freeapi, also check the server-side LLM_FREE_API env var
  const env = (context as any)?.cloudflare?.env || {};
  const effectiveApiKey = provider === 'freeapi' && !apiKey ? (env.LLM_FREE_API || '') : apiKey;

  if (!provider) return json({ error: 'Missing provider' }, { status: 400 });
  if (!effectiveApiKey) return json({ error: 'Missing API key' }, { status: 400 });

  try {
    let models: ModelInfo[] = [];
    if (provider === 'openrouter') models = await fetchOpenRouter(effectiveApiKey);
    else if (provider === 'google') models = await fetchGoogle(effectiveApiKey);
    else if (provider === 'anthropic') models = await fetchAnthropic(effectiveApiKey);
    else if (provider === 'freeapi') models = await fetchFreeApi(effectiveApiKey);
    else return json({ error: `Unsupported provider: ${provider}` }, { status: 400 });

    return json({ models });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Failed to fetch models' }, { status: 500 });
  }
}

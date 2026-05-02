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

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');
  const apiKey = request.headers.get('x-api-key') || url.searchParams.get('apiKey') || '';

  if (!provider) return json({ error: 'Missing provider' }, { status: 400 });
  if (!apiKey) return json({ error: 'Missing API key' }, { status: 400 });

  try {
    let models: ModelInfo[] = [];
    if (provider === 'openrouter') models = await fetchOpenRouter(apiKey);
    else if (provider === 'google') models = await fetchGoogle(apiKey);
    else if (provider === 'anthropic') models = await fetchAnthropic(apiKey);
    else return json({ error: `Unsupported provider: ${provider}` }, { status: 400 });

    return json({ models });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Failed to fetch models' }, { status: 500 });
  }
}

// ============================================================
// Omni-Builder — Fetch available models from an AI provider
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { fetchProviderModels } from '@/services/ai-providers';
import type { ProviderConfig } from '@/services/ai-providers';

export async function POST(request: NextRequest) {
  try {
    const body: ProviderConfig = await request.json();
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    const models = await fetchProviderModels(body);
    return NextResponse.json({ models });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

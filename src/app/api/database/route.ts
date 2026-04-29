// ============================================================
// Omni-Builder — Database API Route
// ============================================================
import { NextRequest } from 'next/server';
import {
  testDatabaseConnection,
  executeDatabaseQuery,
  getDatabaseSchema,
} from '@/services/database-service';
import type { DatabaseConfig } from '@/types';

export const maxDuration = 30;

interface DatabaseRequest {
  action: 'test' | 'query' | 'schema';
  config: DatabaseConfig;
  operation?: string;
  params?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const body: DatabaseRequest = await request.json();
    const { action, config } = body;

    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Database configuration is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'test': {
        const result = await testDatabaseConnection(config);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'query': {
        if (!body.operation) {
          return new Response(
            JSON.stringify({ error: 'Operation is required for query action' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const result = await executeDatabaseQuery(config, body.operation, body.params || {});
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'schema': {
        const result = await getDatabaseSchema(config);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

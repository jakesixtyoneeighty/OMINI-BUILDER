import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Client-side Supabase config uses VITE_ prefixed env vars only.
// Server-side env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are NEVER exposed to the client.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Singleton: cache the client so we never create multiple GoTrueClient instances
let _supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  if (!_supabaseClient) {
    _supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'bolt.supabase.auth',
      },
    });
  }

  return _supabaseClient;
}

export const supabase = typeof window !== 'undefined' ? getSupabase() : null;
export const supabaseEnabled = !!supabase;

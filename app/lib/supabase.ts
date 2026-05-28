import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Extend Window to include server-injected Supabase config
declare global {
  interface Window {
    __SUPABASE_CONFIG__?: { url: string; anonKey: string };
  }
}

// Client-side Supabase config uses VITE_ prefixed env vars first,
// then falls back to server-injected config from Cloudflare Pages env vars
// (SUPABASE_URL, SUPABASE_ANON_KEY without VITE_ prefix).
const serverConfig = typeof window !== 'undefined' ? window.__SUPABASE_CONFIG__ : undefined;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || serverConfig?.url || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || serverConfig?.anonKey || '';

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

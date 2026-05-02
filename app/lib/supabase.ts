import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Usando as variáveis de ambiente definidas no seu projeto
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase URL ou Anon Key não configurados nas variáveis de ambiente.");
    return null;
  }
  
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'bolt.supabase.auth',
    },
  });
}

export const supabase = typeof window !== 'undefined' ? getSupabase() : null;
export const supabaseEnabled = !!supabase;
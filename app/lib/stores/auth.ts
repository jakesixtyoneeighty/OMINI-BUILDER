import { atom, map } from 'nanostores';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, supabaseEnabled } from '~/lib/supabase';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
}

export const authStore = map<AuthState>({
  user: null,
  session: null,
  loading: false,
  initialized: false,
});

export const githubProviderTokenStore = atom<string | null>(null);
export const googleProviderTokenStore = atom<string | null>(null);

const GH_TOKEN_KEY = 'bolt.gh.provider_token';
const GOOGLE_TOKEN_KEY = 'bolt.google.provider_token';

if (typeof window !== 'undefined') {
  try {
    const t = localStorage.getItem(GH_TOKEN_KEY);
    if (t) githubProviderTokenStore.set(t);
    const gt = localStorage.getItem(GOOGLE_TOKEN_KEY);
    if (gt) googleProviderTokenStore.set(gt);
  } catch {
  }
  githubProviderTokenStore.subscribe((t) => {
    try {
      if (t) localStorage.setItem(GH_TOKEN_KEY, t);
      else localStorage.removeItem(GH_TOKEN_KEY);
    } catch {
    }
  });
  googleProviderTokenStore.subscribe((t) => {
    try {
      if (t) localStorage.setItem(GOOGLE_TOKEN_KEY, t);
      else localStorage.removeItem(GOOGLE_TOKEN_KEY);
    } catch {
    }
  });
}

let _authListenerRegistered = false;

export async function initAuth() {
  const sb = getSupabase();
  authStore.setKey('initialized', true);
  if (!sb) return;

  // Prevent multiple onAuthStateChange registrations (causes infinite loop)
  if (_authListenerRegistered) {
    // Still refresh the session
    const { data } = await sb.auth.getSession();
    if (data.session) {
      authStore.set({
        user: data.session.user,
        session: data.session,
        loading: false,
        initialized: true,
      });
      if (data.session.provider_token) {
        if (data.session.user.app_metadata.provider === 'github') {
          githubProviderTokenStore.set(data.session.provider_token);
        } else if (data.session.user.app_metadata.provider === 'google') {
          googleProviderTokenStore.set(data.session.provider_token);
        }
      }
      const { loadKeysFromSupabase } = await import('./llm');
      await loadKeysFromSupabase();
    }
    return;
  }

  _authListenerRegistered = true;

  const { data } = await sb.auth.getSession();
  if (data.session) {
    authStore.set({
      user: data.session.user,
      session: data.session,
      loading: false,
      initialized: true,
    });
    if (data.session.provider_token) {
      if (data.session.user.app_metadata.provider === 'github') {
        githubProviderTokenStore.set(data.session.provider_token);
      } else if (data.session.user.app_metadata.provider === 'google') {
        googleProviderTokenStore.set(data.session.provider_token);
      }
    }
    const { loadKeysFromSupabase } = await import('./llm');
    await loadKeysFromSupabase();
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    authStore.set({
      user: session?.user ?? null,
      session: session ?? null,
      loading: false,
      initialized: true,
    });
    if (session?.provider_token) {
      if (session.user.app_metadata.provider === 'github') {
        githubProviderTokenStore.set(session.provider_token);
      } else if (session.user.app_metadata.provider === 'google') {
        googleProviderTokenStore.set(session.provider_token);
      }
    }
    if (event === 'SIGNED_OUT') {
      githubProviderTokenStore.set(null);
      googleProviderTokenStore.set(null);
    }
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      const { loadKeysFromSupabase } = await import('./llm');
      await loadKeysFromSupabase();
    }
  });
}

export async function signInWithEmail(email: string, password: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured. Please check your settings.');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured. Please check your settings.');
  const { error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured. Please check your settings.');
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}

export async function signInWithGitHub() {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured. Please check your settings.');
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'repo read:user user:email',
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  githubProviderTokenStore.set(null);
  googleProviderTokenStore.set(null);
}

export async function signInWithGoogleDrive() {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured.');
  // Salva estado pendente para apos o redirect
  localStorage.setItem('bolt.drive.save_pending', 'true');
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/drive.file',
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) {
    localStorage.removeItem('bolt.drive.save_pending');
    throw error;
  }
}

export { supabaseEnabled };
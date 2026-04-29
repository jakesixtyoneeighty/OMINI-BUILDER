// ============================================================
// Omni-Builder — Database Configuration Store (Zustand)
// ============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DatabaseProvider,
  SupabaseConfig,
  FirebaseConfig,
  DatabaseConfig,
  DatabaseQueryResult,
  DatabaseSchemaInfo,
} from '@/types';

interface DatabaseStore {
  // Config
  provider: DatabaseProvider;
  supabaseConfig: SupabaseConfig;
  firebaseConfig: FirebaseConfig;

  // State
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  schema: DatabaseSchemaInfo | null;
  queryHistory: DatabaseQueryResult[];
  isQuerying: boolean;

  // Actions
  setProvider: (provider: DatabaseProvider) => void;
  setSupabaseConfig: (config: Partial<SupabaseConfig>) => void;
  setFirebaseConfig: (config: Partial<FirebaseConfig>) => void;
  setConnected: (v: boolean) => void;
  setConnecting: (v: boolean) => void;
  setConnectionError: (e: string | null) => void;
  setSchema: (s: DatabaseSchemaInfo | null) => void;
  addQueryResult: (r: DatabaseQueryResult) => void;
  setQuerying: (v: boolean) => void;
  clearHistory: () => void;
  getActiveConfig: () => DatabaseConfig;
  isConfigured: () => boolean;
  resetConfig: () => void;
}

const DEFAULT_SUPABASE: SupabaseConfig = {
  provider: 'supabase',
  url: '',
  anonKey: '',
};

const DEFAULT_FIREBASE: FirebaseConfig = {
  provider: 'firebase',
  projectId: '',
  apiKey: '',
  authDomain: '',
  databaseURL: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export const useDatabaseStore = create<DatabaseStore>()(
  persist(
    (set, get) => ({
      provider: 'supabase' as DatabaseProvider,
      supabaseConfig: { ...DEFAULT_SUPABASE },
      firebaseConfig: { ...DEFAULT_FIREBASE },

      isConnected: false,
      isConnecting: false,
      connectionError: null,
      schema: null,
      queryHistory: [],
      isQuerying: false,

      setProvider: (provider) => set({ provider, connectionError: null }),

      setSupabaseConfig: (config) =>
        set((s) => ({
          supabaseConfig: { ...s.supabaseConfig, ...config },
          connectionError: null,
          isConnected: false,
        })),

      setFirebaseConfig: (config) =>
        set((s) => ({
          firebaseConfig: { ...s.firebaseConfig, ...config },
          connectionError: null,
          isConnected: false,
        })),

      setConnected: (isConnected) => set({ isConnected }),
      setConnecting: (isConnecting) => set({ isConnecting }),
      setConnectionError: (connectionError) => set({ connectionError }),
      setSchema: (schema) => set({ schema }),

      addQueryResult: (r) =>
        set((s) => ({
          queryHistory: [...s.queryHistory.slice(-49), r],
        })),

      setQuerying: (isQuerying) => set({ isQuerying }),
      clearHistory: () => set({ queryHistory: [] }),

      getActiveConfig: () => {
        const { provider, supabaseConfig, firebaseConfig } = get();
        if (provider === 'supabase') {
          return supabaseConfig.url && supabaseConfig.anonKey ? supabaseConfig : null;
        }
        return firebaseConfig.projectId && firebaseConfig.apiKey ? firebaseConfig : null;
      },

      isConfigured: () => {
        const { provider, supabaseConfig, firebaseConfig } = get();
        if (provider === 'supabase') {
          return !!(supabaseConfig.url && supabaseConfig.anonKey);
        }
        return !!(firebaseConfig.projectId && firebaseConfig.apiKey);
      },

      resetConfig: () =>
        set({
          supabaseConfig: { ...DEFAULT_SUPABASE },
          firebaseConfig: { ...DEFAULT_FIREBASE },
          isConnected: false,
          connectionError: null,
          schema: null,
          queryHistory: [],
        }),
    }),
    {
      name: 'omni-builder-database-config',
      partialize: (state) => ({
        provider: state.provider,
        supabaseConfig: state.supabaseConfig,
        firebaseConfig: state.firebaseConfig,
      }),
    }
  )
);

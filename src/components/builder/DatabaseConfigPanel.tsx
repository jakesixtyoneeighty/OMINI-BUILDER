// ============================================================
// Omni-Builder — Database Configuration & Query Panel
// ============================================================
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDatabaseStore } from '@/store/database';
import type {
  DatabaseProvider,
  DatabaseQueryResult,
} from '@/types';
import {
  Database,
  Plug,
  Unplug,
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Send,
  Trash2,
  Plus,
  RefreshCw,
  AlertCircle,
  Table2,
  FileText,
  Wifi,
  WifiOff,
  ArrowRight,
  Copy,
  CheckCheck,
} from 'lucide-react';

// ============================================================
// Supabase Config Form
// ============================================================
function SupabaseConfigForm() {
  const config = useDatabaseStore((s) => s.supabaseConfig);
  const setConfig = useDatabaseStore((s) => s.setSupabaseConfig);
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
        <span className="text-lg">⚡</span>
        <div>
          <p className="text-xs font-medium text-emerald-300">Supabase</p>
          <p className="text-[10px] text-zinc-500">PostgreSQL + REST API + Auth + Storage</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">Project URL</label>
        <input
          type="text"
          value={config.url}
          onChange={(e) => setConfig({ url: e.target.value })}
          placeholder="https://your-project.supabase.co"
          className="w-full bg-zinc-800 text-zinc-200 text-sm px-4 py-2.5 rounded-xl border border-zinc-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-zinc-600 font-mono"
        />
        <p className="text-[10px] text-zinc-600 mt-1">
          Found in Supabase Dashboard → Settings → API → Project URL
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">Anon / Public Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={config.anonKey}
            onChange={(e) => setConfig({ anonKey: e.target.value })}
            placeholder="eyJhbGciOiJIUzI1NiIs..."
            className="w-full bg-zinc-800 text-zinc-200 text-sm px-4 py-2.5 pr-10 rounded-xl border border-zinc-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-zinc-600 font-mono"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-[10px] text-zinc-600 mt-1">
          Found in Supabase Dashboard → Settings → API → anon public
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Firebase Config Form
// ============================================================
function FirebaseConfigForm() {
  const config = useDatabaseStore((s) => s.firebaseConfig);
  const setConfig = useDatabaseStore((s) => s.setFirebaseConfig);
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
        <span className="text-lg">🔥</span>
        <div>
          <p className="text-xs font-medium text-amber-300">Firebase Firestore</p>
          <p className="text-[10px] text-zinc-500">NoSQL Document Database + Auth + Hosting</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">Project ID</label>
        <input
          type="text"
          value={config.projectId}
          onChange={(e) => setConfig({ projectId: e.target.value })}
          placeholder="my-awesome-project-12345"
          className="w-full bg-zinc-800 text-zinc-200 text-sm px-4 py-2.5 rounded-xl border border-zinc-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-zinc-600 font-mono"
        />
        <p className="text-[10px] text-zinc-600 mt-1">
          Found in Firebase Console → Project Settings → General
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">Web API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={config.apiKey}
            onChange={(e) => setConfig({ apiKey: e.target.value })}
            placeholder="AIzaSy..."
            className="w-full bg-zinc-800 text-zinc-200 text-sm px-4 py-2.5 pr-10 rounded-xl border border-zinc-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-zinc-600 font-mono"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {/* Advanced settings toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
      >
        {showAdvanced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Advanced settings (optional)
      </button>

      {showAdvanced && (
        <div className="space-y-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-800">
          <div>
            <label className="block text-[10px] font-medium text-zinc-400 mb-1">Auth Domain</label>
            <input
              type="text"
              value={config.authDomain || ''}
              onChange={(e) => setConfig({ authDomain: e.target.value })}
              placeholder="my-project.firebaseapp.com"
              className="w-full bg-zinc-900 text-zinc-300 text-xs px-3 py-2 rounded-lg border border-zinc-700 outline-none placeholder:text-zinc-600 font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-zinc-400 mb-1">Database URL</label>
            <input
              type="text"
              value={config.databaseURL || ''}
              onChange={(e) => setConfig({ databaseURL: e.target.value })}
              placeholder="https://my-project-default-rtdb.firebaseio.com"
              className="w-full bg-zinc-900 text-zinc-300 text-xs px-3 py-2 rounded-lg border border-zinc-700 outline-none placeholder:text-zinc-600 font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-zinc-400 mb-1">Storage Bucket</label>
            <input
              type="text"
              value={config.storageBucket || ''}
              onChange={(e) => setConfig({ storageBucket: e.target.value })}
              placeholder="my-project.appspot.com"
              className="w-full bg-zinc-900 text-zinc-300 text-xs px-3 py-2 rounded-lg border border-zinc-700 outline-none placeholder:text-zinc-600 font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Query Builder
// ============================================================
function QueryPanel() {
  const {
    provider,
    supabaseConfig,
    firebaseConfig,
    isConnected,
    isQuerying,
    queryHistory,
    addQueryResult,
    setQuerying,
    clearHistory,
    getActiveConfig,
  } = useDatabaseStore();

  const [query, setQuery] = useState('');
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [queryHistory]);

  const handleExecute = useCallback(async () => {
    if (!query.trim() || isQuerying) return;

    const config = getActiveConfig();
    if (!config) return;

    setQuerying(true);

    try {
      const res = await fetch('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'query',
          config,
          operation: provider === 'supabase' ? 'raw' : 'query',
          params: provider === 'supabase'
            ? { query: query.trim() }
            : {
                collection: query.trim().split(/\s+/)[0] || '',
              },
        }),
      });

      const result = await res.json();
      addQueryResult(result);
    } catch (err: any) {
      addQueryResult({
        success: false,
        error: err.message || 'Query failed',
      });
    } finally {
      setQuerying(false);
    }
  }, [query, isQuerying, provider, getActiveConfig, addQueryResult, setQuerying]);

  const toggleResult = (idx: number) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const copyResult = useCallback(async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Quick action buttons */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 overflow-x-auto">
        <span className="text-[10px] text-zinc-500 shrink-0">Quick:</span>
        {provider === 'supabase' ? (
          <>
            {['SELECT * FROM users LIMIT 10', 'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\''].map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className="shrink-0 px-2 py-1 text-[10px] text-zinc-400 bg-zinc-800 rounded-md hover:text-zinc-200 hover:bg-zinc-700 transition whitespace-nowrap"
              >
                {q.length > 40 ? q.substring(0, 40) + '...' : q}
              </button>
            ))}
          </>
        ) : (
          <>
            {['users', 'products', 'orders'].map((c) => (
              <button
                key={c}
                onClick={() => setQuery(c)}
                className="shrink-0 px-2 py-1 text-[10px] text-zinc-400 bg-zinc-800 rounded-md hover:text-zinc-200 hover:bg-zinc-700 transition"
              >
                GET /{c}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Query input */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleExecute();
                }
              }}
              placeholder={
                provider === 'supabase'
                  ? 'Enter SQL query... (Ctrl+Enter to execute)'
                  : 'Enter collection name to list documents...'
              }
              rows={3}
              className="w-full bg-zinc-900 text-zinc-200 text-xs px-4 py-3 rounded-xl border border-zinc-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none placeholder:text-zinc-600 font-mono resize-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={handleExecute}
              disabled={!isConnected || isQuerying || !query.trim()}
              className="p-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="Execute query (Ctrl+Enter)"
            >
              {isQuerying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-zinc-600 mt-1.5">
          {provider === 'supabase'
            ? 'Supports PostgreSQL queries via Supabase REST API'
            : 'Enter collection name or use structured queries'}
        </p>
      </div>

      {/* Results */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar">
        {queryHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Table2 size={24} className="text-zinc-700 mb-2" />
            <p className="text-xs text-zinc-500">No queries executed yet</p>
            <p className="text-[10px] text-zinc-600 mt-1">
              Run a query to see results here
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 font-medium">
                {queryHistory.length} result{queryHistory.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={clearHistory}
                className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition"
              >
                <Trash2 size={10} />
                Clear
              </button>
            </div>

            {queryHistory.map((result, idx) => (
              <div
                key={idx}
                className={`rounded-xl border overflow-hidden ${
                  result.success
                    ? 'border-zinc-800 bg-zinc-900/50'
                    : 'border-red-500/20 bg-red-500/5'
                }`}
              >
                <button
                  onClick={() => toggleResult(idx)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition"
                >
                  {result.success ? (
                    <Check size={12} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle size={12} className="text-red-400 shrink-0" />
                  )}
                  <span className="text-[10px] font-mono text-zinc-300 truncate flex-1">
                    {result.operation?.toUpperCase() || 'QUERY'}
                    {result.rowCount ? ` — ${result.rowCount} row${result.rowCount !== 1 ? 's' : ''}` : ''}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyResult(JSON.stringify(result.data || result.error, null, 2), idx);
                    }}
                    className="p-1 text-zinc-600 hover:text-zinc-300 transition"
                  >
                    {copiedIdx === idx ? <CheckCheck size={10} className="text-green-400" /> : <Copy size={10} />}
                  </button>
                  <ChevronDown
                    size={12}
                    className={`text-zinc-500 transition ${expandedResults.has(idx) ? 'rotate-180' : ''}`}
                  />
                </button>

                {expandedResults.has(idx) && (
                  <div className="border-t border-zinc-800 p-3">
                    {result.error ? (
                      <p className="text-xs text-red-400 font-mono whitespace-pre-wrap">{result.error}</p>
                    ) : (
                      <pre className="text-[10px] text-zinc-400 font-mono whitespace-pre-wrap max-h-60 overflow-auto custom-scrollbar">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Database Config Panel
// ============================================================
export default function DatabaseConfigPanel() {
  const [activeTab, setActiveTab] = useState<'config' | 'query'>('config');
  const {
    provider,
    isConnected,
    isConnecting,
    connectionError,
    setProvider,
    setConnected,
    setConnecting,
    setConnectionError,
    getActiveConfig,
  } = useDatabaseStore();

  const handleTestConnection = useCallback(async () => {
    const config = getActiveConfig();
    if (!config) return;

    setConnecting(true);
    setConnectionError(null);

    try {
      const res = await fetch('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', config }),
      });

      const result = await res.json();

      if (result.success) {
        setConnected(true);
      } else {
        setConnected(false);
        setConnectionError(result.error || 'Connection failed');
      }
    } catch (err: any) {
      setConnected(false);
      setConnectionError(err.message || 'Connection test failed');
    } finally {
      setConnecting(false);
    }
  }, [getActiveConfig, setConnected, setConnecting, setConnectionError]);

  const isConfigured = useDatabaseStore((s) => s.isConfigured)();

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Database size={16} className={isConnected ? 'text-emerald-400' : 'text-zinc-500'} />
          <span className="text-sm font-medium text-zinc-200">Database</span>
          {isConnected && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
              <Wifi size={8} />
              Connected
            </span>
          )}
          {!isConnected && isConfigured && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800 text-[10px] text-zinc-500">
              <WifiOff size={8} />
              Disconnected
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b border-zinc-800 px-4">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-3 py-2.5 text-xs font-medium transition border-b-2 ${
            activeTab === 'config'
              ? 'text-zinc-100 border-violet-500'
              : 'text-zinc-500 border-transparent hover:text-zinc-300'
          }`}
        >
          Configuration
        </button>
        <button
          onClick={() => setActiveTab('query')}
          className={`px-3 py-2.5 text-xs font-medium transition border-b-2 ${
            activeTab === 'query'
              ? 'text-zinc-100 border-violet-500'
              : 'text-zinc-500 border-transparent hover:text-zinc-300'
          }`}
        >
          Query Runner
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'config' ? (
          <div className="p-4 space-y-5">
            {/* Provider selection */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-2">Database Provider</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setProvider('supabase')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition text-left ${
                    provider === 'supabase'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700'
                  }`}
                >
                  <span className="text-lg">⚡</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium ${provider === 'supabase' ? 'text-emerald-300' : 'text-zinc-300'}`}>
                      Supabase
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">PostgreSQL</p>
                  </div>
                  {provider === 'supabase' && <Check size={14} className="text-emerald-400 ml-auto shrink-0" />}
                </button>

                <button
                  onClick={() => setProvider('firebase')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition text-left ${
                    provider === 'firebase'
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700'
                  }`}
                >
                  <span className="text-lg">🔥</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium ${provider === 'firebase' ? 'text-amber-300' : 'text-zinc-300'}`}>
                      Firebase
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">Firestore</p>
                  </div>
                  {provider === 'firebase' && <Check size={14} className="text-amber-400 ml-auto shrink-0" />}
                </button>
              </div>
            </div>

            {/* Config form */}
            {provider === 'supabase' ? <SupabaseConfigForm /> : <FirebaseConfigForm />}

            {/* Connection status */}
            <div className="space-y-2">
              {connectionError && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-500/5 border border-red-500/10">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-red-400">{connectionError}</p>
                </div>
              )}

              {isConnected && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <Check size={14} className="text-emerald-400" />
                  <p className="text-[11px] text-emerald-400">
                    Successfully connected to {provider === 'supabase' ? 'Supabase' : 'Firebase'}!
                  </p>
                </div>
              )}

              {/* Test connection button */}
              <button
                onClick={handleTestConnection}
                disabled={!isConfigured || isConnecting}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition ${
                  isConnecting
                    ? 'bg-zinc-800 text-zinc-400'
                    : isConnected
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-violet-600 hover:bg-violet-700 text-white'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {isConnecting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Testing connection...
                  </>
                ) : isConnected ? (
                  <>
                    <RefreshCw size={14} />
                    Test Again
                  </>
                ) : (
                  <>
                    <Plug size={14} />
                    Test Connection
                  </>
                )}
              </button>
            </div>

            {/* Info box */}
            <div className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-800">
              <p className="text-[10px] font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <FileText size={10} />
                How the AI uses your database
              </p>
              <ul className="text-[10px] text-zinc-500 space-y-1 list-disc list-inside">
                <li>When connected, the AI will know your database type and credentials</li>
                <li>You can ask the AI to create tables, add data, or build CRUD interfaces</li>
                <li>The AI generates frontend code that connects to your database</li>
                <li>Use the Query Runner tab to test queries manually</li>
                <li>Your credentials are stored locally in your browser</li>
              </ul>
            </div>
          </div>
        ) : (
          <QueryPanel />
        )}
      </div>
    </div>
  );
}

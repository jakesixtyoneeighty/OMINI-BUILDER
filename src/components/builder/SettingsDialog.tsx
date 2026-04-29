// ============================================================
// Omni-Builder — Settings Dialog (AI Provider Configuration)
// ============================================================
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAIProviderStore } from '@/store/ai-provider';
import { AI_PROVIDERS } from '@/services/ai-providers';
import type { AIProviderId, AIModel } from '@/services/ai-providers';
import {
  X,
  Check,
  ChevronDown,
  RefreshCw,
  Eye,
  EyeOff,
  Zap,
  AlertCircle,
} from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const config = useAIProviderStore((s) => s.config);
  const models = useAIProviderStore((s) => s.models);
  const isLoadingModels = useAIProviderStore((s) => s.isLoadingModels);
  const modelError = useAIProviderStore((s) => s.modelError);
  const setProvider = useAIProviderStore((s) => s.setProvider);
  const setApiKey = useAIProviderStore((s) => s.setApiKey);
  const setModel = useAIProviderStore((s) => s.setModel);
  const setModels = useAIProviderStore((s) => s.setModels);
  const setIsLoadingModels = useAIProviderStore((s) => s.setIsLoadingModels);
  const setModelError = useAIProviderStore((s) => s.setModelError);

  const [showKey, setShowKey] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const prevProvider = useRef(config.provider);

  const currentProvider = AI_PROVIDERS.find((p) => p.id === config.provider);

  const handleFetchModels = useCallback(async () => {
    if (!config.apiKey) {
      setModelError('Please enter an API key first');
      return;
    }

    setIsLoadingModels(true);
    setModelError(null);

    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch models');
      }

      setModels(data.models);
      if (data.models.length > 0 && !data.models.find((m: AIModel) => m.id === config.model)) {
        setModel(data.models[0].id);
      }
    } catch (err: any) {
      setModelError(err.message ?? 'Failed to fetch models');
    } finally {
      setIsLoadingModels(false);
    }
  }, [config, setModels, setModel, setIsLoadingModels, setModelError]);

  // Auto-fetch models when provider changes (debounced)
  useEffect(() => {
    if (config.apiKey && open && config.provider !== prevProvider.current) {
      prevProvider.current = config.provider;
      const timer = setTimeout(handleFetchModels, 300);
      return () => clearTimeout(timer);
    }
  }, [config.provider, open]);

  if (!open) return null;

  const filteredModels = modelSearch
    ? models.filter(
        (m) =>
          m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
          m.id.toLowerCase().includes(modelSearch.toLowerCase())
      )
    : models;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
              <Zap size={16} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">AI Provider Settings</h2>
              <p className="text-[10px] text-zinc-500">Configure your AI model and API key</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-white transition rounded-lg hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Provider selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {AI_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition text-left ${
                    config.provider === p.id
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700'
                  }`}
                >
                  <span className="text-lg">{p.icon}</span>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-medium ${
                        config.provider === p.id ? 'text-violet-300' : 'text-zinc-300'
                      }`}
                    >
                      {p.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">{p.description}</p>
                  </div>
                  {config.provider === p.id && (
                    <Check size={14} className="text-violet-400 ml-auto shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={currentProvider?.placeholder ?? 'Enter your API key...'}
                className="w-full bg-zinc-800 text-zinc-200 text-sm px-4 py-2.5 pr-10 rounded-xl border border-zinc-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none placeholder:text-zinc-600 font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {config.apiKey && (
              <p className="text-[10px] text-green-400 mt-1.5 flex items-center gap-1">
                <Check size={10} /> Key configured
              </p>
            )}
          </div>

          {/* Model selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-zinc-300">Model</label>
              <button
                onClick={handleFetchModels}
                disabled={isLoadingModels || !config.apiKey}
                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-violet-400 transition disabled:opacity-30"
              >
                <RefreshCw size={10} className={isLoadingModels ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="w-full flex items-center justify-between bg-zinc-800 text-sm px-4 py-2.5 rounded-xl border border-zinc-700 hover:border-zinc-600 transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-zinc-400">{currentProvider?.icon}</span>
                  <span className="text-zinc-200 truncate text-xs font-mono">
                    {config.model || 'Select a model...'}
                  </span>
                </div>
                <ChevronDown size={14} className="text-zinc-500 shrink-0" />
              </button>

              {showModelDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowModelDropdown(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-20 max-h-60 overflow-hidden">
                    <div className="p-2 border-b border-zinc-700">
                      <input
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Search models..."
                        className="w-full bg-zinc-900 text-xs text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-600 outline-none placeholder:text-zinc-600"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-44 custom-scrollbar">
                      {isLoadingModels ? (
                        <div className="px-4 py-6 text-center text-xs text-zinc-500">
                          <RefreshCw size={14} className="animate-spin mx-auto mb-2" />
                          Loading models...
                        </div>
                      ) : filteredModels.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-zinc-500">
                          No models found
                        </div>
                      ) : (
                        filteredModels.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setModel(m.id);
                              setShowModelDropdown(false);
                              setModelSearch('');
                            }}
                            className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-zinc-700 transition text-left ${
                              config.model === m.id ? 'bg-violet-500/10' : ''
                            }`}
                          >
                            <span className="text-[10px] truncate flex-1 text-zinc-300 font-mono">
                              {m.name}
                            </span>
                            {config.model === m.id && (
                              <Check size={12} className="text-violet-400 shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {modelError && (
              <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
                <AlertCircle size={10} /> {modelError}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600">
            Keys are stored locally in your browser
          </p>
          <button
            onClick={onClose}
            disabled={!config.apiKey}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-xl transition disabled:opacity-30"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}

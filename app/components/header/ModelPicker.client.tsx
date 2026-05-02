import { useStore } from '@nanostores/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  llmStore,
  modelsStore,
  modelsLoadingStore,
  PROVIDER_LABELS,
  refreshAllConfiguredModels,
  selectProviderModel,
  type ProviderId,
} from '~/lib/stores/llm';

interface FlatOption {
  provider: ProviderId;
  id: string;
  label: string;
}

const PROVIDER_LOGOS: Record<ProviderId, string> = {
  google: '/gemini.svg',
  openrouter: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/openrouter.png',
  anthropic: '/claude.svg',
};

export function ModelPicker() {
  const { provider, model, keys } = useStore(llmStore);
  const allModels = useStore(modelsStore);
  const loading = useStore(modelsLoadingStore);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const configuredCount = (Object.keys(keys) as ProviderId[]).filter((p) => keys[p]).length;

  useEffect(() => {
    refreshAllConfiguredModels();
  }, [keys.anthropic, keys.openrouter, keys.google]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const flat: FlatOption[] = useMemo(() => {
    const out: FlatOption[] = [];
    (Object.keys(allModels) as ProviderId[]).forEach((p) => {
      if (!keys[p]) return;
      for (const m of allModels[p]) out.push({ provider: p, id: m.id, label: m.label });
    });
    return out;
  }, [allModels, keys]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return flat;
    return flat.filter(
      (o) => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) || PROVIDER_LABELS[o.provider].toLowerCase().includes(q),
    );
  }, [flat, filter]);

  const grouped = useMemo(() => {
    const g: Record<ProviderId, FlatOption[]> = { anthropic: [], openrouter: [], google: [] };
    for (const o of filtered) g[o.provider].push(o);
    return g;
  }, [filtered]);

  const isAnyLoading = Object.values(loading).some(Boolean);
  const currentLabel = flat.find((o) => o.provider === provider && o.id === model)?.label || model || 'Select model';

  return (
    <div ref={ref} className="relative z-[1000]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-md text-[11px] text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-theme border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
        title="Select model"
      >
        <img src={PROVIDER_LOGOS[provider]} alt={provider} className="w-4 h-4 object-contain" />
        <span className="font-medium truncate max-w-[120px]">{currentLabel}</span>
        <div className={`i-ph:caret-up text-[10px] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-[320px] z-[1001] rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-bolt-elements-borderColor">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search models..."
              className="w-full px-2 py-1.5 rounded text-xs bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:border-bolt-elements-item-contentAccent"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {configuredCount === 0 ? (
              <div className="p-4 text-xs text-bolt-elements-textTertiary text-center">
                No API keys configured. Open Settings to add one.
              </div>
            ) : flat.length === 0 ? (
              <div className="p-4 text-xs text-bolt-elements-textTertiary text-center">
                {isAnyLoading ? 'Loading models…' : 'No models loaded yet.'}
              </div>
            ) : (
              (Object.keys(grouped) as ProviderId[]).map((p) => {
                const items = grouped[p];
                if (items.length === 0) return null;
                return (
                  <div key={p}>
                    <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1 sticky top-0 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src={PROVIDER_LOGOS[p]} alt={p} className="w-3 h-3 object-contain" />
                        <span>{PROVIDER_LABELS[p]}</span>
                      </div>
                      <span>{items.length}</span>
                    </div>
                    {items.map((o) => {
                      const active = o.provider === provider && o.id === model;
                      return (
                        <button
                          key={`${o.provider}:${o.id}`}
                          onClick={() => {
                            selectProviderModel(o.provider, o.id);
                            setOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-[11px] flex flex-col gap-0.5 hover:bg-bolt-elements-item-backgroundActive transition-theme ${
                            active ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent' : 'text-bolt-elements-textPrimary'
                          }`}
                        >
                          <span className="font-medium truncate">{o.label}</span>
                          <span className="text-[9px] opacity-60 truncate">{o.id}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          <div className="px-3 py-2 border-t border-bolt-elements-borderColor flex items-center justify-between text-[10px] text-bolt-elements-textTertiary">
            <span>{flat.length} models</span>
            <button
              onClick={() => refreshAllConfiguredModels()}
              disabled={isAnyLoading || configuredCount === 0}
              className="hover:text-bolt-elements-textPrimary disabled:opacity-50"
            >
              {isAnyLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
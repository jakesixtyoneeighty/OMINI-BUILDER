import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  llmStore,
  modelsStore,
  modelsLoadingStore,
  PROVIDER_LABELS,
  refreshAllConfiguredModels,
  selectProviderModel,
  FREE_MODELS,
  AGENT_OMINI_MODEL_ID,
  AGENT_OMINI_LABEL,
  FREE_PROVIDER,
  isFreeModel,
  type ProviderId,
} from '~/lib/stores/llm';
import { useT } from '~/lib/i18n/useT';

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
  const t = useT();
  const { provider, model, keys } = useStore(llmStore);
  const allModels = useStore(modelsStore);
  const loading = useStore(modelsLoadingStore);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const configuredCount = (Object.keys(keys) as ProviderId[]).filter((p) => keys[p]).length;
  // Free models are always available via server's OPENROUTER_API_KEY
  const hasAnyModel = configuredCount > 0 || isFreeModel(model);

  useEffect(() => {
    refreshAllConfiguredModels();
  }, [keys.anthropic, keys.openrouter, keys.google]);

  // Calculate dropdown position based on button location
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 8, // 8px gap below button
      left: rect.left,
    });
  }, []);

  // Update position when opening and on scroll/resize
  useEffect(() => {
    if (!open) return;
    updatePosition();

    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);

    // Close on click outside (check both button and dropdown)
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);

    // Close on Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, updatePosition]);

  const flat: FlatOption[] = useMemo(() => {
    const out: FlatOption[] = [];
    // Always include all built-in Omini models at the top
    for (const fm of FREE_MODELS) {
      out.push({ provider: FREE_PROVIDER, id: fm.id, label: fm.label });
    }
    (Object.keys(allModels) as ProviderId[]).forEach((p) => {
      if (!keys[p]) return;
      const models = Array.isArray(allModels[p]) ? allModels[p] : [];
      for (const m of models) {
        // Skip free/virtual models if they appear in the API results (we already added them)
        if (isFreeModel(m.id)) return;
        out.push({ provider: p, id: m.id, label: m.label });
      }
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
    const g: Record<string, FlatOption[]> = { omini: [], anthropic: [], openrouter: [], google: [] };
    for (const o of filtered) {
      // Put all free models in the "omini" group
      if (isFreeModel(o.id)) {
        g['omini'].push(o);
      } else {
        g[o.provider].push(o);
      }
    }
    return g;
  }, [filtered]);

  const isAnyLoading = Object.values(loading).some(Boolean);
  const currentLabel = flat.find((o) => o.provider === provider && o.id === model)?.label
    || (model === AGENT_OMINI_MODEL_ID ? AGENT_OMINI_LABEL : isFreeModel(model) ? FREE_MODELS.find(m => m.id === model)?.label || 'Agent Omini' : model)
    || t('model.selectModel');

  // Show Omini logo when Agent Omini is selected, otherwise show provider logo
  const currentLogo = isFreeModel(model) ? '/omni-builder-logo.svg' : PROVIDER_LOGOS[provider];

  const dropdownContent = open ? (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] w-[320px] rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-xl overflow-hidden"
      style={{ top: dropdownPos.top, left: dropdownPos.left }}
    >
      <div className="p-2 border-b border-bolt-elements-borderColor">
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('model.searchModels')}
          className="w-full px-2 py-1.5 rounded text-xs bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:border-bolt-elements-item-contentAccent"
        />
      </div>

      <div className="max-h-[300px] overflow-y-auto">
        {flat.length === 0 ? (
          <div className="p-4 text-xs text-bolt-elements-textTertiary text-center">
            {isAnyLoading ? t('model.loadingModels') : t('model.noModelsLoaded')}
          </div>
        ) : (
          (Object.keys(grouped) as string[]).map((p) => {
            const items = grouped[p];
            if (items.length === 0) return null;
            const isOmini = p === 'omini';
            const groupLabel = isOmini ? 'Agent Omini' : PROVIDER_LABELS[p as ProviderId] || p;
            const groupLogo = isOmini ? '/omni-builder-logo.svg' : PROVIDER_LOGOS[p as ProviderId];
            return (
              <div key={p}>
                <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1 sticky top-0 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={groupLogo} alt={p} className="w-3 h-3 object-contain" />
                    <span>{groupLabel}</span>
                    {isOmini && <span className="text-[8px] px-1 py-0 rounded bg-green-500/20 text-green-400 font-bold">FREE</span>}
                  </div>
                  <span>{items.length}</span>
                </div>
                {items.map((o) => {
                  const active = o.provider === provider && o.id === model;
                  // For virtual models (Agent Omini), don't show the model ID subtitle
                  const isVirtualFreeModel = isFreeModel(o.id);
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
                      {!isVirtualFreeModel && <span className="text-[9px] opacity-60 truncate">{o.id}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <div className="px-3 py-2 border-t border-bolt-elements-borderColor flex items-center justify-between text-[10px] text-bolt-elements-textTertiary">
        <span>{flat.length} {t('model.models')}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent('open-api-settings'));
            }}
            className="hover:text-bolt-elements-item-contentAccent transition-colors"
          >
            <div className="i-ph:gear text-sm" />
          </button>
          <button
            onClick={() => refreshAllConfiguredModels()}
            disabled={isAnyLoading || configuredCount === 0}
            className="hover:text-bolt-elements-textPrimary disabled:opacity-50"
          >
            {isAnyLoading ? t('model.refreshing') : t('model.refresh')}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-md text-[11px] text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-theme border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
        title={t('model.selectModel')}
      >
        <img src={currentLogo} alt={provider} className="w-4 h-4 object-contain" />
        <span className="font-medium truncate max-w-[120px]">{currentLabel}</span>
        <div className={`i-ph:caret-up text-[10px] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {dropdownContent && createPortal(dropdownContent, document.body)}
    </>
  );
}

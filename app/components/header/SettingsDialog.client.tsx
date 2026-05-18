import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import {
  fetchModelsFor,
  llmStore,
  PROVIDER_LABELS,
  setApiKey,
  type ProviderId,
} from '~/lib/stores/llm';
import { useT } from '~/lib/i18n/useT';

const PROVIDERS: { id: ProviderId; placeholder: string; helpUrl: string; helpText: string; badge?: string; badgeColor?: string }[] = [
  {
    id: 'openrouter',
    placeholder: 'sk-or-...',
    helpUrl: 'https://openrouter.ai/keys',
    helpText: 'OpenRouter gives access to 200+ models from one key (including free models)',
    badge: 'RECOMENDADO',
    badgeColor: 'bg-blue-500/20 text-blue-400',
  },
  {
    id: 'anthropic',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    helpText: 'Get a key from console.anthropic.com',
  },
  {
    id: 'google',
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/app/apikey',
    helpText: 'Free Gemini API key from Google AI Studio',
  },
];

export function SettingsDialog() {
  const { keys } = useStore(llmStore);
  const t = useT();

  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<ProviderId, string>>(keys);
  const [revealed, setRevealed] = useState<Record<ProviderId, boolean>>({ anthropic: false, openrouter: false, google: false });
  // Listen for external open requests (e.g. from ModelPicker "Configure API Keys" button)
  useEffect(() => {
    const handler = () => {
      setOpen(true);
    };
    window.addEventListener('open-api-settings', handler);
    return () => window.removeEventListener('open-api-settings', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setDrafts(keys);
    }
  }, [open, keys]);

  async function saveAndTest(provider: ProviderId) {
    const value = drafts[provider].trim();
    setApiKey(provider, value);
    if (!value) {
      toast.info(`${PROVIDER_LABELS[provider]} ${t('settings.keyCleared')}`);
      return;
    }
    const list = await fetchModelsFor(provider);
    if (list.length > 0) {
      toast.success(`${PROVIDER_LABELS[provider]}: ${list.length} ${t('settings.modelsAvailable')}`);
    } else {
      toast.error(`${PROVIDER_LABELS[provider]}: ${t('settings.couldNotLoadModels')}`);
    }
  }



  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor transition-theme"
        title={t('settings.title')}
      >
        <div className="i-ph:gear text-base" />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[600px] max-w-[92vw] max-h-[90vh] overflow-y-auto rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-xl"
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">{t('settings.title')}</h2>
              <button onClick={() => setOpen(false)} className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary">
                <div className="i-ph:x text-lg" />
              </button>
            </div>

            <div className="px-5 mt-4 mb-2">
              <span className="text-sm text-bolt-elements-textTertiary">{t('settings.apiKeysSubtitle')}</span>
            </div>

            <div className="p-5 space-y-4">
              {PROVIDERS.map((p) => (
                <div key={p.id} className={`border rounded-md p-3 bg-bolt-elements-background-depth-1 ${p.id === 'openrouter' ? 'border-blue-500/30 bg-blue-500/5' : 'border-bolt-elements-borderColor'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{PROVIDER_LABELS[p.id]}</span>
                      {p.badge && (
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${p.badgeColor}`}>
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <a href={p.helpUrl} target="_blank" className="text-xs underline">{t('settings.getKey')}</a>
                  </div>
                  <div className="flex gap-2">
                    <input type="password" value={drafts[p.id] || ''} onChange={(e) => setDrafts({...drafts, [p.id]: e.target.value})} placeholder={p.placeholder} className="flex-1 px-2 py-1 rounded text-xs bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor" />
                    <button onClick={() => saveAndTest(p.id)} className="px-3 py-1 rounded text-xs bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent">{t('settings.save')}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  fetchModelsFor,
  llmStore,
  modelsStore,
  modelsLoadingStore,
  PROVIDER_LABELS,
  setApiKey,
  type ProviderId,
} from '~/lib/stores/llm';
import {
  activeProjectIdStore,
  getActiveProject,
  projectsStore,
  updateActiveProjectSettings,
  writeEnvFile,
  type EnvVar,
} from '~/lib/stores/project';
import { SecurityTestTab } from '~/components/chat/SecurityTestTab';
import { useT } from '~/lib/i18n/useT';

type Tab = 'keys' | 'project' | 'security';

const PROVIDERS: { id: ProviderId; placeholder: string; helpUrl: string; helpText: string; badge?: string; badgeColor?: string }[] = [
  {
    id: 'freeapi',
    placeholder: 'Sua chave ou deixe vazio (servidor já tem)',
    helpUrl: 'https://apifreellm.com',
    helpText: 'Modelos gratuitos via apifreellm.com — sem API key necessária!',
    badge: 'GRÁTIS',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
  },
  {
    id: 'anthropic',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    helpText: 'Get a key from console.anthropic.com',
  },
  {
    id: 'openrouter',
    placeholder: 'sk-or-...',
    helpUrl: 'https://openrouter.ai/keys',
    helpText: 'OpenRouter gives access to 200+ models from one key',
  },
  {
    id: 'google',
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/app/apikey',
    helpText: 'Free Gemini API key from Google AI Studio',
  },
];

interface SettingsDialogProps {
  onSecurityTest?: (prompt: string) => void;
  isStreaming?: boolean;
}

export function SettingsDialog({ onSecurityTest, isStreaming }: SettingsDialogProps) {
  const { keys } = useStore(llmStore);
  const t = useT();
  const models = useStore(modelsStore);
  const loading = useStore(modelsLoadingStore);
  const projectId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const active = projects[projectId] ?? getActiveProject();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('keys');
  const [drafts, setDrafts] = useState<Record<ProviderId, string>>(keys);
  const [revealed, setRevealed] = useState<Record<ProviderId, boolean>>({ anthropic: false, openrouter: false, google: false, freeapi: false });
  const [pName, setPName] = useState(active.name);
  const [pDesc, setPDesc] = useState(active.settings.description);
  const [pLogo, setPLogo] = useState(active.settings.logo);
  const [pEnv, setPEnv] = useState<EnvVar[]>(active.settings.envVars);

  const isProjectActive = projectId && projectId !== 'default';

  useEffect(() => {
    if (open) {
      setDrafts(keys);
      const current = projects[projectId] ?? getActiveProject();
      setPName(current.name);
      setPDesc(current.settings.description);
      setPLogo(current.settings.logo);
      setPEnv(current.settings.envVars.length ? current.settings.envVars : []);
    }
  }, [open, keys, projectId, projects]);

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

  async function saveProject() {
    const cleanedEnv = pEnv.filter((v) => v.key.trim());
    updateActiveProjectSettings({
      name: pName,
      description: pDesc,
      logo: pLogo,
      envVars: cleanedEnv,
    });
    if (cleanedEnv.length > 0) {
      try {
        await writeEnvFile(cleanedEnv);
        toast.success(t('settings.projectSaved'));
      } catch (err) {
        toast.error(`${t('settings.failedWriteEnv')} ${err instanceof Error ? err.message : err}`);
      }
    } else {
      toast.success(t('settings.projectSettingsSaved'));
    }
  }

  const handleSecurityTest = (prompt: string) => {
    if (onSecurityTest) {
      onSecurityTest(prompt);
      setOpen(false);
    } else {
      // Dispatch a custom event that Chat.client.tsx listens for
      window.dispatchEvent(new CustomEvent('security-test-requested', { detail: { prompt } }));
      setOpen(false);
      toast.info(t('settings.securityTestSent'));
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor transition-theme"
        title={t('settings.title')}
      >
        <div className="i-ph:gear text-base" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
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

            <div className="flex gap-1 px-5 mt-4 border-b border-bolt-elements-borderColor">
              <button onClick={() => setTab('keys')} className={`px-3 py-2 text-sm border-b-2 ${tab === 'keys' ? 'border-bolt-elements-item-contentAccent text-bolt-elements-textPrimary' : 'border-transparent text-bolt-elements-textTertiary'}`}>{t('settings.apiKeys')}</button>
              {isProjectActive && (
                <button onClick={() => setTab('project')} className={`px-3 py-2 text-sm border-b-2 ${tab === 'project' ? 'border-bolt-elements-item-contentAccent text-bolt-elements-textPrimary' : 'border-transparent text-bolt-elements-textTertiary'}`}>{t('settings.project')}</button>
              )}
              {isProjectActive && (
                <button onClick={() => setTab('security')} className={`px-3 py-2 text-sm border-b-2 flex items-center gap-1.5 ${tab === 'security' ? 'border-bolt-elements-item-contentAccent text-bolt-elements-textPrimary' : 'border-transparent text-bolt-elements-textTertiary'}`}>
                  <div className="i-ph:shield-check text-sm" />
                  {t('settings.security')}
                </button>
              )}
            </div>

            {tab === 'keys' ? (
              <div className="p-5 space-y-4">
                {PROVIDERS.map((p) => (
                  <div key={p.id} className={`border rounded-md p-3 bg-bolt-elements-background-depth-1 ${p.id === 'freeapi' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-bolt-elements-borderColor'}`}>
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
                    {p.id === 'freeapi' && (
                      <p className="text-[10px] text-emerald-400 mb-2">{t('settings.freeApiHint')}</p>
                    )}
                    <div className="flex gap-2">
                      <input type="password" value={drafts[p.id] || ''} onChange={(e) => setDrafts({...drafts, [p.id]: e.target.value})} placeholder={p.placeholder} className="flex-1 px-2 py-1 rounded text-xs bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor" />
                      <button onClick={() => saveAndTest(p.id)} className="px-3 py-1 rounded text-xs bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent">{t('settings.save')}</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : tab === 'security' ? (
              <SecurityTestTab onRunTest={handleSecurityTest} isStreaming={isStreaming} />
            ) : (
              <div className="p-5 space-y-4">
                <input type="text" value={pName} onChange={(e) => setPName(e.target.value)} placeholder={t('settings.projectName')} className="w-full px-3 py-2 rounded text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor" />
                <textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} placeholder={t('settings.description')} className="w-full px-3 py-2 rounded text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor" />
                <button onClick={saveProject} className="w-full px-3 py-2 rounded text-sm bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent">{t('settings.saveProject')}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

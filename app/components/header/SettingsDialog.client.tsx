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

type Tab = 'keys' | 'project';

const PROVIDERS: { id: ProviderId; placeholder: string; helpUrl: string; helpText: string }[] = [
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

export function SettingsDialog() {
  const { keys } = useStore(llmStore);
  const models = useStore(modelsStore);
  const loading = useStore(modelsLoadingStore);
  const projectId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const active = projects[projectId] ?? getActiveProject();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('keys');
  const [drafts, setDrafts] = useState<Record<ProviderId, string>>(keys);
  const [revealed, setRevealed] = useState<Record<ProviderId, boolean>>({ anthropic: false, openrouter: false, google: false });
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
      toast.info(`${PROVIDER_LABELS[provider]} key cleared.`);
      return;
    }
    const list = await fetchModelsFor(provider);
    if (list.length > 0) {
      toast.success(`${PROVIDER_LABELS[provider]}: ${list.length} models available.`);
    } else {
      toast.error(`${PROVIDER_LABELS[provider]}: could not load models. Check the key.`);
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
        toast.success(`Project saved. .env written.`);
      } catch (err) {
        toast.error(`Failed to write .env: ${err instanceof Error ? err.message : err}`);
      }
    } else {
      toast.success('Project settings saved.');
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor transition-theme"
        title="Settings"
      >
        <div className="i-ph:gear text-base" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[560px] max-w-[92vw] max-h-[90vh] overflow-y-auto rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-xl"
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Settings</h2>
              <button onClick={() => setOpen(false)} className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary">
                <div className="i-ph:x text-lg" />
              </button>
            </div>

            <div className="flex gap-1 px-5 mt-4 border-b border-bolt-elements-borderColor">
              <button onClick={() => setTab('keys')} className={`px-3 py-2 text-sm border-b-2 ${tab === 'keys' ? 'border-bolt-elements-item-contentAccent text-bolt-elements-textPrimary' : 'border-transparent text-bolt-elements-textTertiary'}`}>API Keys</button>
              {isProjectActive && (
                <button onClick={() => setTab('project')} className={`px-3 py-2 text-sm border-b-2 ${tab === 'project' ? 'border-bolt-elements-item-contentAccent text-bolt-elements-textPrimary' : 'border-transparent text-bolt-elements-textTertiary'}`}>Project</button>
              )}
            </div>

            {tab === 'keys' ? (
              <div className="p-5 space-y-4">
                {PROVIDERS.map((p) => (
                  <div key={p.id} className="border border-bolt-elements-borderColor rounded-md p-3 bg-bolt-elements-background-depth-1">
                    <div className="flex justify-between mb-2">
                      <span className="font-medium text-sm">{PROVIDER_LABELS[p.id]}</span>
                      <a href={p.helpUrl} target="_blank" className="text-xs underline">Get key</a>
                    </div>
                    <div className="flex gap-2">
                      <input type="password" value={drafts[p.id]} onChange={(e) => setDrafts({...drafts, [p.id]: e.target.value})} className="flex-1 px-2 py-1 rounded text-xs bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor" />
                      <button onClick={() => saveAndTest(p.id)} className="px-3 py-1 rounded text-xs bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent">Save</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <input type="text" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Project Name" className="w-full px-3 py-2 rounded text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor" />
                <textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} placeholder="Description" className="w-full px-3 py-2 rounded text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor" />
                <button onClick={saveProject} className="w-full px-3 py-2 rounded text-sm bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent">Save Project</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
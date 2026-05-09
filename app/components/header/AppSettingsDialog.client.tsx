import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import {
  activeProjectIdStore,
  projectsStore,
  updateActiveProjectSettings,
  type EnvVar,
  type PreviewMode,
  type FirebaseConfig,
  type SupabaseConfig,
} from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { useT } from '~/lib/i18n/useT';

const TABS = [
  { id: 'general' as const, label: 'General', icon: 'i-ph:gear-six' },
  { id: 'preview' as const, label: 'Preview', icon: 'i-ph:eye' },
  { id: 'deploy' as const, label: 'Deploy', icon: 'i-ph:rocket-launch-duotone' },
  { id: 'database' as const, label: 'Database', icon: 'i-ph:database-duotone' },
  { id: 'env' as const, label: 'Env Vars', icon: 'i-ph:key' },
  { id: 'versions' as const, label: 'Snapshots', icon: 'i-ph:clock-counter-clockwise' },
  { id: 'rules' as const, label: 'AI Rules', icon: 'i-ph:brain-duotone' },
];

const VERCEL_FRAMEWORKS = [
  { value: 'vite', label: 'Vite' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'create-react-app', label: 'React (CRA)' },
  { value: 'nuxtjs', label: 'Nuxt.js' },
  { value: 'vue', label: 'Vue.js' },
  { value: 'sveltekit', label: 'SvelteKit' },
  { value: 'astro', label: 'Astro' },
  { value: 'remix', label: 'Remix' },
  { value: 'gatsby', label: 'Gatsby' },
  { value: 'other', label: 'Other' },
];

const emptyFirebase: FirebaseConfig = { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', measurementId: '' };
const emptySupabase: SupabaseConfig = { url: '', anonKey: '', serviceRoleKey: '' };

// Inline editable env var row
function EnvVarRow({ env, index, onUpdate, onRemove }: { env: EnvVar; index: number; onUpdate: (i: number, key: string, value: string) => void; onRemove: (i: number) => void }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [editKey, setEditKey] = useState(env.key);
  const [editValue, setEditValue] = useState(env.value);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditKey(env.key);
    setEditValue(env.value);
    setHasChanges(false);
    setEditing(false);
  }, [env.key, env.value]);

  const save = () => { onUpdate(index, editKey, editValue); setEditing(false); setHasChanges(false); };
  const cancel = () => { setEditKey(env.key); setEditValue(env.value); setEditing(false); setHasChanges(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-bolt-elements-background-depth-1 rounded-lg border-2 border-purple-500/50 group">
        <div className="i-ph:pencil-simple text-purple-400 text-sm shrink-0" />
        <input value={editKey} onChange={(e) => { setEditKey(e.target.value); setHasChanges(true); }}
          onKeyDown={(e) => e.key === 'Escape' && cancel()}
          className="flex-1 px-2 py-1 rounded text-sm font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:border-purple-500/50" />
        <span className="text-bolt-elements-textTertiary text-sm">=</span>
        <input value={editValue} onChange={(e) => { setEditValue(e.target.value); setHasChanges(true); }}
          onKeyDown={(e) => e.key === 'Escape' && cancel()}
          className="flex-1 px-2 py-1 rounded text-sm font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textSecondary focus:outline-none focus:border-purple-500/50" />
        <button onClick={save} disabled={!hasChanges} className="text-green-400 hover:text-green-300 disabled:opacity-30 transition-all p-1">
          <div className="i-ph:check text-sm" />
        </button>
        <button onClick={cancel} className="text-bolt-elements-textTertiary hover:text-red-400 transition-all p-1">
          <div className="i-ph:x text-sm" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor group hover:border-purple-500/30 transition-colors">
      <div className="i-ph:key text-bolt-elements-textTertiary text-sm shrink-0" />
      <span className="font-mono text-sm text-bolt-elements-textPrimary font-medium">{env.key}</span>
      <span className="text-bolt-elements-textTertiary text-sm">=</span>
      <span className="font-mono text-sm text-bolt-elements-textSecondary truncate flex-1">{env.value}</span>
      <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-bolt-elements-textTertiary hover:text-purple-400 transition-all p-1" title={t('appSettings.edit')}>
        <div className="i-ph:pencil-simple text-sm" />
      </button>
      <button onClick={() => onRemove(index)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all p-1" title={t('appSettings.remove')}>
        <div className="i-ph:trash text-sm" />
      </button>
    </div>
  );
}

export function AppSettingsDialog({ open, onClose, defaultTab }: { open: boolean; onClose: () => void; defaultTab?: string }) {
  const t = useT();
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[activeId];
  const settings = project?.settings;
  const [tab, setTab] = useState<typeof TABS[number]['id']>((defaultTab as any) || 'general');
  const [snapshots, setSnapshots] = useState<{ id: number; name: string; timestamp: string }[]>([]);
  const [envVars, setEnvVars] = useState<EnvVar[]>(Array.isArray(settings?.envVars) ? settings.envVars : []);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [projectName, setProjectName] = useState(project?.name || '');
  const [projectDesc, setProjectDesc] = useState(settings?.description || '');
  const currentPreviewMode: PreviewMode = settings?.previewMode || 'webcontainer';

  // Netlify
  const [netlifyToken, setNetlifyToken] = useState(settings?.netlify?.token || '');
  const [netlifySiteId, setNetlifySiteId] = useState(settings?.netlify?.siteId || '');

  // Vercel
  const [vercelToken, setVercelToken] = useState(settings?.vercel?.token || '');
  const [vercelProjectName, setVercelProjectName] = useState(settings?.vercel?.projectName || '');
  const [vercelFramework, setVercelFramework] = useState(settings?.vercel?.framework || 'vite');

  // Cloud Run
  const [crProjectId, setCrProjectId] = useState(settings?.cloudRun?.projectId || '');
  const [crRegion, setCrRegion] = useState(settings?.cloudRun?.region || 'us-central1');
  const [crServiceAccountKey, setCrServiceAccountKey] = useState(settings?.cloudRun?.serviceAccountKey || '');
  const [crServiceName, setCrServiceName] = useState(settings?.cloudRun?.serviceName || '');
  const [crAllowUnauth, setCrAllowUnauth] = useState(settings?.cloudRun?.allowUnauthenticated ?? true);

  // Google Drive
  const [gdriveClientId, setGdriveClientId] = useState(settings?.googleDrive?.clientId || '');

  // Database
  const [dbType, setDbType] = useState<'none' | 'firebase' | 'supabase'>(settings?.database?.type || 'none');
  const [firebase, setFirebase] = useState<FirebaseConfig>(settings?.database?.firebase || { ...emptyFirebase });
  const [supabase, setSupabase] = useState<SupabaseConfig>(settings?.database?.supabase || { ...emptySupabase });

  // Deploy state
  const [deploying, setDeploying] = useState<'none' | 'netlify' | 'vercel' | 'cloudrun'>('none');
  const [deployResult, setDeployResult] = useState<{ url: string; siteId?: string; projectId?: string; provider: string; message?: string; buildLogsUrl?: string } | null>(null);

  // AI Rules
  const [customRules, setCustomRules] = useState(settings?.customRules || '');

  // Flag to only apply defaultTab on first open, not on every settings change
  const [hasAppliedDefault, setHasAppliedDefault] = useState(false);

  useEffect(() => {
    if (!open) {
      setHasAppliedDefault(false);
      return;
    }
    // Reset state when dialog opens
    const saved = localStorage.getItem(`bolt.snapshots.${activeId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSnapshots(Array.isArray(parsed) ? parsed : []);
      } catch {
        setSnapshots([]);
      }
    }
    setProjectName(project?.name || '');
    setProjectDesc(settings?.description || '');
    setEnvVars(Array.isArray(settings?.envVars) ? settings.envVars : []);
    setNetlifyToken(settings?.netlify?.token || '');
    setNetlifySiteId(settings?.netlify?.siteId || '');
    setVercelToken(settings?.vercel?.token || '');
    setVercelProjectName(settings?.vercel?.projectName || '');
    setVercelFramework(settings?.vercel?.framework || 'vite');
    setCrProjectId(settings?.cloudRun?.projectId || '');
    setCrRegion(settings?.cloudRun?.region || 'us-central1');
    setCrServiceAccountKey(settings?.cloudRun?.serviceAccountKey || '');
    setCrServiceName(settings?.cloudRun?.serviceName || '');
      setCrAllowUnauth(settings?.cloudRun?.allowUnauthenticated ?? true);
    setGdriveClientId(settings?.googleDrive?.clientId || '');
    setDbType(settings?.database?.type || 'none');
    setFirebase(settings?.database?.firebase || { ...emptyFirebase });
    setSupabase(settings?.database?.supabase || { ...emptySupabase });
    setDeployResult(null);
    setCustomRules(settings?.customRules || '');
    // Only apply defaultTab once when dialog first opens
    if (!hasAppliedDefault && defaultTab) {
      setTab(defaultTab as any);
      setHasAppliedDefault(true);
    }
  }, [open, activeId, project, settings, defaultTab, hasAppliedDefault]);

  const saveSnapshot = () => {
    const files = workbenchStore.files.get();
    const snapshot = {
      id: Date.now(),
      name: `Snapshot ${new Date().toLocaleString()}`,
      timestamp: new Date().toISOString(),
      files: { ...files }
    };
    const newSnapshots = [...snapshots, { id: snapshot.id, name: snapshot.name, timestamp: snapshot.timestamp }];
    localStorage.setItem(`bolt.snapshots.${activeId}`, JSON.stringify(newSnapshots));
    localStorage.setItem(`bolt.snapshot.data.${snapshot.id}`, JSON.stringify(snapshot.files));
    setSnapshots(newSnapshots);
    toast.success(t('appSettings.snapshotSaved'));
  };

  const restoreSnapshot = (id: number) => {
    const data = localStorage.getItem(`bolt.snapshot.data.${id}`);
    if (data) {
      const files = JSON.parse(data);
      workbenchStore.files.set(files);
      toast.success(t('appSettings.snapshotRestored'));
    }
  };

  const deleteSnapshot = (id: number) => {
    const newSnapshots = snapshots.filter(s => s.id !== id);
    localStorage.setItem(`bolt.snapshots.${activeId}`, JSON.stringify(newSnapshots));
    localStorage.removeItem(`bolt.snapshot.data.${id}`);
    setSnapshots(newSnapshots);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const logoUrl = e.target?.result as string;
        updateActiveProjectSettings({ logo: logoUrl });
        toast.success(t('appSettings.logoUpdated'));
      };
      reader.readAsDataURL(file);
    }
  };

  const addEnvVar = () => {
    if (newEnvKey.trim() && newEnvValue.trim()) {
      const updated = [...envVars, { key: newEnvKey.trim(), value: newEnvValue.trim() }];
      setEnvVars(updated);
      updateActiveProjectSettings({ envVars: updated });
      setNewEnvKey('');
      setNewEnvValue('');
      toast.success(t('appSettings.envVarAdded'));
    }
  };

  const removeEnvVar = (index: number) => {
    const updated = envVars.filter((_, i) => i !== index);
    setEnvVars(updated);
    updateActiveProjectSettings({ envVars: updated });
  };

  const updateEnvVar = (index: number, newKey: string, newValue: string) => {
    const updated = [...envVars];
    updated[index] = { key: newKey, value: newValue };
    setEnvVars(updated);
    updateActiveProjectSettings({ envVars: updated });
    toast.success(t('appSettings.envVarUpdated'));
  };

  const saveProjectInfo = () => {
    updateActiveProjectSettings({ name: projectName, description: projectDesc });
    toast.success(t('appSettings.projectInfoSaved'));
  };

  const saveNetlifySettings = () => {
    updateActiveProjectSettings({ netlify: { token: netlifyToken.trim(), siteId: netlifySiteId.trim() } });
    toast.success(t('appSettings.netlifySettingsSaved'));
  };

  const saveVercelSettings = () => {
    updateActiveProjectSettings({ vercel: { token: vercelToken.trim(), projectName: vercelProjectName.trim(), framework: vercelFramework } });
    toast.success(t('appSettings.vercelSettingsSaved'));
  };

  const saveCloudRunSettings = () => {
    updateActiveProjectSettings({
      cloudRun: {
        projectId: crProjectId.trim(),
        region: crRegion,
        serviceAccountKey: crServiceAccountKey.trim(),
        serviceName: crServiceName.trim(),
        allowUnauthenticated: crAllowUnauth,
      },
    });
    toast.success(t('appSettings.cloudRunSettingsSaved'));
  };

  const saveGdriveSettings = () => {
    updateActiveProjectSettings({ googleDrive: { clientId: gdriveClientId.trim() } });
    toast.success(t('appSettings.gdriveSettingsSaved'));
  };

  const saveDatabaseSettings = (overrideType?: 'none' | 'firebase' | 'supabase') => {
    const type = overrideType ?? dbType;
    updateActiveProjectSettings({
      database: {
        type,
        firebase,
        supabase,
      },
    });
    toast.success(t('appSettings.databaseSettingsSaved'));

    // Dispatch event so Chat can auto-prompt the AI to configure the database
    // Only dispatch if the user has actually filled in credentials
    if (type === 'supabase' && supabase.url) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('database-config-changed', {
          detail: { type: 'supabase', config: supabase },
        }));
      }, 100);
    } else if (type === 'firebase' && firebase.apiKey) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('database-config-changed', {
          detail: { type: 'firebase', config: firebase },
        }));
      }, 100);
    } else if (type !== 'none') {
      toast.info(t('appSettings.fillDbCredentials'));
    }
  };

  const saveCustomRules = () => {
    updateActiveProjectSettings({ customRules: customRules.trim() });
    toast.success(t('appSettings.aiRulesSaved'));
  };

  const getProjectFiles = async () => {
    await workbenchStore.saveAllFiles();
    const files = workbenchStore.files.get();
    return Object.entries(files)
      .filter(([_, f]) => f?.type === 'file' && !f.isBinary)
      .map(([path, f]) => ({ path: path.replace(/^\/+/, ''), content: (f as any).content }));
  };

  const deployToNetlify = async () => {
    if (!netlifyToken.trim()) { toast.error(t('appSettings.netlifyTokenRequired')); return; }
    setDeploying('netlify');
    setDeployResult(null);
    try {
      const fileList = await getProjectFiles();
      const res = await fetch('/api/netlify-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: netlifyToken.trim(), siteId: netlifySiteId.trim() || undefined, files: fileList }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as any).error || t('appSettings.deployFailed')); }
      const data = await res.json();
      setDeployResult({ url: data.url, siteId: data.siteId, provider: 'netlify' });
      if (data.siteId) { updateActiveProjectSettings({ netlify: { token: netlifyToken.trim(), siteId: data.siteId } }); setNetlifySiteId(data.siteId); }
      toast.success(t('appSettings.deployedToNetlify'));
    } catch (err) { toast.error(err instanceof Error ? err.message : t('appSettings.deployFailed')); } finally { setDeploying('none'); }
  };

  const deployToVercel = async () => {
    if (!vercelToken.trim()) { toast.error(t('appSettings.vercelTokenRequired')); return; }
    setDeploying('vercel');
    setDeployResult(null);
    try {
      const fileList = await getProjectFiles();
      const res = await fetch('/api/vercel-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: vercelToken.trim(),
          projectName: vercelProjectName.trim() || undefined,
          framework: vercelFramework,
          files: fileList,
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as any).error || t('appSettings.deployFailed')); }
      const data = await res.json();
      setDeployResult({ url: data.url, projectId: data.projectId, provider: 'vercel' });
      if (data.projectId) { updateActiveProjectSettings({ vercel: { token: vercelToken.trim(), projectName: vercelProjectName.trim(), framework: vercelFramework } }); }
      toast.success(t('appSettings.deployedToVercel'));
    } catch (err) { toast.error(err instanceof Error ? err.message : t('appSettings.deployFailed')); } finally { setDeploying('none'); }
  };

  const deployToCloudRun = async () => {
    if (!crProjectId.trim()) { toast.error(t('appSettings.gcpProjectIdRequired')); return; }
    if (!crServiceAccountKey.trim()) { toast.error(t('appSettings.serviceAccountKeyRequired')); return; }
    setDeploying('cloudrun');
    setDeployResult(null);
    try {
      const fileList = await getProjectFiles();
      const res = await fetch('/api/cloudrun-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: crProjectId.trim(),
          region: crRegion,
          serviceAccountKey: crServiceAccountKey.trim(),
          serviceName: crServiceName.trim() || undefined,
          allowUnauthenticated: crAllowUnauth,
          files: fileList,
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as any).error || t('appSettings.deployFailed')); }
      const data = await res.json();
      setDeployResult({ url: data.url, projectId: crProjectId, provider: 'cloudrun', message: data.message, buildLogsUrl: data.buildLogsUrl });
      if (data.serviceName) { updateActiveProjectSettings({ cloudRun: { projectId: crProjectId.trim(), region: crRegion, serviceAccountKey: crServiceAccountKey.trim(), serviceName: data.serviceName, allowUnauthenticated: crAllowUnauth } }); setCrServiceName(data.serviceName); }
      toast.success(t('appSettings.cloudRunDeployStarted'));
    } catch (err) { toast.error(err instanceof Error ? err.message : t('appSettings.deployFailed')); } finally { setDeploying('none'); }
  };

  const inputClass = "w-full px-4 py-2.5 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all placeholder:text-bolt-elements-textTertiary";
  const monoInputClass = inputClass + " font-mono";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-[750px] max-w-[95vw] max-h-[90vh] bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl shadow-2xl flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[200px] bg-bolt-elements-background-depth-1 border-r border-bolt-elements-borderColor flex flex-col">
          <div className="p-4 border-b border-bolt-elements-borderColor">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                <div className="i-ph:folder-open text-purple-400 text-lg" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-bolt-elements-textPrimary truncate">{projectName || t('appSettings.untitled')}</div>
                <div className="text-[11px] text-bolt-elements-textTertiary truncate">{activeId !== 'default' ? activeId.slice(0, 12) + '...' : t('appSettings.default')}</div>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {TABS.map(tabItem => (
              <button
                key={tabItem.id}
                onClick={() => setTab(tabItem.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2.5 ${
                  tab === tabItem.id
                    ? 'bg-purple-500/12 text-purple-400'
                    : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary'
                }`}
              >
                <div className={`${tabItem.icon} text-base`} />
                {t('appSettings.' + tabItem.id)}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-bolt-elements-borderColor">
            <div className="text-[10px] text-bolt-elements-textTertiary text-center">{t('appSettings.version')}</div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-bolt-elements-borderColor shrink-0">
            <div>
              <h2 className="text-base font-bold text-bolt-elements-textPrimary">
                {t('appSettings.' + tab)}
              </h2>
              <p className="text-xs text-bolt-elements-textTertiary mt-0.5">
                {tab === 'general' && t('appSettings.generalDesc')}
                {tab === 'preview' && t('appSettings.previewDesc')}
                {tab === 'deploy' && t('appSettings.deployDesc')}
                {tab === 'database' && t('appSettings.databaseDesc')}
                {tab === 'env' && t('appSettings.envVarsDesc')}
                {tab === 'versions' && t('appSettings.snapshotsDesc')}
                {tab === 'rules' && t('appSettings.aiRulesDesc')}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all">
              <div className="i-ph:x text-lg" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* ====== GENERAL TAB ====== */}
            {tab === 'general' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">{t('appSettings.projectName')}</label>
                  <input value={projectName} onChange={(e) => setProjectName(e.target.value)} onBlur={saveProjectInfo} placeholder={t('appSettings.projectNamePlaceholder')} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">{t('appSettings.description')}</label>
                  <textarea value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} onBlur={saveProjectInfo} placeholder={t('appSettings.descriptionPlaceholder')} rows={3} className={inputClass + ' resize-none'} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">{t('appSettings.appLogo')}</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-bolt-elements-background-depth-1 rounded-xl border-2 border-dashed border-bolt-elements-borderColor flex items-center justify-center overflow-hidden shrink-0">
                      {settings?.logo ? (
                        <img src={settings.logo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <div className="i-ph:image text-2xl text-bolt-elements-textTertiary" />
                          <span className="text-[9px] text-bolt-elements-textTertiary">{t('appSettings.noLogo')}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-bolt-elements-borderColor cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group">
                        <div className="i-ph:upload-simple text-lg text-bolt-elements-textTertiary group-hover:text-purple-400 transition-colors" />
                        <span className="text-sm text-bolt-elements-textSecondary group-hover:text-purple-400 transition-colors">{t('appSettings.uploadImage')}</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1.5 text-center">{t('appSettings.imageHint')}</p>
                    </div>
                  </div>
                </div>
                {/* Google Drive Client ID */}
                <div className="border-t border-bolt-elements-borderColor pt-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                      <div className="i-ph:google-drive-logo text-blue-400 text-base" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-bolt-elements-textPrimary">{t('appSettings.googleDrive')}</h3>
                      <p className="text-[11px] text-bolt-elements-textTertiary">{t('appSettings.gdriveSubtitle')}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">{t('appSettings.oauthClientId')}</label>
                      <input value={gdriveClientId} onChange={(e) => setGdriveClientId(e.target.value)} onBlur={saveGdriveSettings} placeholder="xxxxxxxxxxxx.apps.googleusercontent.com" type="text" className={monoInputClass + " focus:ring-blue-500/30 focus:border-blue-500/50"} />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">Create at <span className="text-blue-400">console.cloud.google.com/apis/credentials</span> → OAuth 2.0 Client ID (Web). Add your domain to Authorized JavaScript Origins.</p>
                    </div>
                    {gdriveClientId && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/8 border border-green-500/20">
                        <div className="i-ph:check-circle-fill text-green-400 text-sm" />
                        <span className="text-xs text-green-400">{t('appSettings.gdriveClientIdConfigured')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ====== PREVIEW TAB ====== */}
            {tab === 'preview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {([
                    { mode: 'webcontainer' as const, icon: 'i-ph:cube-duotone', title: 'WebContainer', color: 'blue', desc: t('appSettings.webcontainerDesc') },
                    { mode: 'sandpack' as const, icon: 'i-ph:browser-duotone', title: 'Sandpack', color: 'amber', desc: t('appSettings.sandpackDesc') },
                    { mode: 'iframe' as const, icon: 'i-ph:code-duotone', title: 'Iframe SrcDoc', color: 'green', desc: t('appSettings.iframeDesc') },
                    { mode: 'reactlive' as const, icon: 'i-ph:atom-duotone', title: 'React Live', color: 'cyan', desc: t('appSettings.reactliveDesc') },
                    { mode: 'playcode' as const, icon: 'i-ph:code-block-duotone', title: 'PlayCode', color: 'orange', desc: t('appSettings.playcodeDesc') },
                    { mode: 'piston' as const, icon: 'i-ph:rocket-duotone', title: 'Piston', color: 'purple', desc: t('appSettings.pistonDesc') },
                    { mode: 'newtab' as const, icon: 'i-ph:arrow-square-out-duotone', title: 'New Tab', color: 'pink', desc: t('appSettings.newtabDesc') },
                  ]).map(option => {
                    const isActive = currentPreviewMode === option.mode;
                    const activeColorMap: Record<string, string> = { blue: 'border-blue-500 bg-blue-500/8 ring-1 ring-blue-500/40', amber: 'border-amber-500 bg-amber-500/8 ring-1 ring-amber-500/40', green: 'border-green-500 bg-green-500/8 ring-1 ring-green-500/40', cyan: 'border-cyan-500 bg-cyan-500/8 ring-1 ring-cyan-500/40', orange: 'border-orange-500 bg-orange-500/8 ring-1 ring-orange-500/40', pink: 'border-pink-500 bg-pink-500/8 ring-1 ring-pink-500/40', purple: 'border-purple-500 bg-purple-500/8 ring-1 ring-purple-500/40' };
                    const iconBgActive: Record<string, string> = { blue: 'bg-blue-500/20', amber: 'bg-amber-500/20', green: 'bg-green-500/20', cyan: 'bg-cyan-500/20', orange: 'bg-orange-500/20', pink: 'bg-pink-500/20', purple: 'bg-purple-500/20' };
                    const iconColorActive: Record<string, string> = { blue: 'text-blue-400', amber: 'text-amber-400', green: 'text-green-400', cyan: 'text-cyan-400', orange: 'text-orange-400', pink: 'text-pink-400', purple: 'text-purple-400' };
                    const badgeColor: Record<string, string> = { blue: 'bg-blue-500/20 text-blue-400', amber: 'bg-amber-500/20 text-amber-400', green: 'bg-green-500/20 text-green-400', cyan: 'bg-cyan-500/20 text-cyan-400', orange: 'bg-orange-500/20 text-orange-400', pink: 'bg-pink-500/20 text-pink-400', purple: 'bg-purple-500/20 text-purple-400' };
                    const checkColor: Record<string, string> = { blue: 'text-blue-400', amber: 'text-amber-400', green: 'text-green-400', cyan: 'text-cyan-400', orange: 'text-orange-400', pink: 'text-pink-400', purple: 'text-purple-400' };
                    return (
                      <button key={option.mode} onClick={() => { updateActiveProjectSettings({ previewMode: option.mode }); toast.success(t('appSettings.modeActivated', { mode: option.title })); }}
                        className={`relative w-full p-4 rounded-xl border text-left transition-all group ${isActive ? activeColorMap[option.color] : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:border-bolt-elements-borderColor hover:bg-bolt-elements-item-backgroundActive'}`}>
                        <div className="flex items-center gap-3.5">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isActive ? iconBgActive[option.color] : 'bg-bolt-elements-background-depth-2'}`}>
                            <div className={`${option.icon} text-xl ${isActive ? iconColorActive[option.color] : 'text-bolt-elements-textTertiary'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold text-sm ${isActive ? iconColorActive[option.color] : 'text-bolt-elements-textPrimary'}`}>{option.title}</span>
                              {isActive && <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${badgeColor[option.color]} uppercase tracking-wider`}>{t('appSettings.active')}</span>}
                            </div>
                            <p className="text-xs text-bolt-elements-textTertiary mt-0.5 leading-relaxed">{option.desc}</p>
                          </div>
                          {isActive && <div className={`i-ph:check-circle-fill ${checkColor[option.color]} text-xl shrink-0`} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ====== DEPLOY TAB ====== */}
            {tab === 'deploy' && (
              <div className="space-y-6">
                {/* Netlify Section */}
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center shrink-0 overflow-hidden">
                      <img src="/logos/netlify.svg" alt="Netlify" className="w-5 h-5 object-contain" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-bolt-elements-textPrimary">{t('appSettings.netlify')}</h3>
                      <p className="text-[11px] text-bolt-elements-textTertiary">{t('appSettings.netlifySubtitle')}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">{t('appSettings.personalAccessToken')}</label>
                      <input value={netlifyToken} onChange={(e) => setNetlifyToken(e.target.value)} onBlur={saveNetlifySettings} placeholder="ntfy_..." type="password" className={monoInputClass + " focus:ring-teal-500/30 focus:border-teal-500/50"} />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">Create a token at <span className="text-teal-400">app.netlify.com/user/applications#personal-access-tokens</span></p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">{t('appSettings.siteIdOptional')}</label>
                      <input value={netlifySiteId} onChange={(e) => setNetlifySiteId(e.target.value)} onBlur={saveNetlifySettings} placeholder="Leave empty to create a new site" className={monoInputClass + " focus:ring-teal-500/30 focus:border-teal-500/50"} />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">{t('appSettings.siteIdHint')}</p>
                    </div>
                    <button onClick={deployToNetlify} disabled={deploying !== 'none' || !netlifyToken.trim()}
                      className="w-full py-3 px-4 bg-teal-500/12 text-teal-400 rounded-xl text-sm font-semibold border border-teal-500/20 hover:bg-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                      {deploying === 'netlify' ? (<><div className="i-svg-spinners:90-ring-with-bg text-base" /> {t('appSettings.deploying')}</>) : (<><div className="i-ph:rocket-launch text-base" /> {t('appSettings.deployToNetlify')}</>)}
                    </button>
                  </div>
                </div>

                {/* Vercel Section */}
                <div className="border-t border-bolt-elements-borderColor pt-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                      <img src="/logos/vercel.svg" alt="Vercel" className="w-5 h-5 object-contain" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-bolt-elements-textPrimary">{t('appSettings.vercel')}</h3>
                      <p className="text-[11px] text-bolt-elements-textTertiary">{t('appSettings.vercelSubtitle')}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">{t('appSettings.accessToken')}</label>
                      <input value={vercelToken} onChange={(e) => setVercelToken(e.target.value)} onBlur={saveVercelSettings} placeholder="vercel_token_..." type="password" className={monoInputClass} />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">Create a token at <span className="text-purple-400">vercel.com/account/tokens</span></p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">{t('appSettings.projectNameOptional')}</label>
                      <input value={vercelProjectName} onChange={(e) => setVercelProjectName(e.target.value)} onBlur={saveVercelSettings} placeholder="my-project" className={monoInputClass} />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">{t('appSettings.vercelProjectNameHint')}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">{t('appSettings.frameworkPreset')}</label>
                      <select value={vercelFramework} onChange={(e) => setVercelFramework(e.target.value)} onBlur={saveVercelSettings}
                        className={monoInputClass + " cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_12px_center]"}>
                        {VERCEL_FRAMEWORKS.map(fw => <option key={fw.value} value={fw.value}>{fw.label}</option>)}
                      </select>
                    </div>
                    <button onClick={deployToVercel} disabled={deploying !== 'none' || !vercelToken.trim()}
                      className="w-full py-3 px-4 bg-purple-500/12 text-purple-400 rounded-xl text-sm font-semibold border border-purple-500/20 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                      {deploying === 'vercel' ? (<><div className="i-svg-spinners:90-ring-with-bg text-base" /> {t('appSettings.deploying')}</>) : (<><div className="i-ph:rocket-launch text-base" /> {t('appSettings.deployToVercel')}</>)}
                    </button>
                  </div>
                </div>

                {/* Cloud Run Section */}
                <div className="border-t border-bolt-elements-borderColor pt-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0 overflow-hidden">
                      <img src="/logos/google-cloud.svg" alt="Google Cloud" className="w-5 h-5 object-contain" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-bolt-elements-textPrimary">{t('appSettings.googleCloudRun')}</h3>
                      <p className="text-[11px] text-bolt-elements-textTertiary">{t('appSettings.cloudRunSubtitle')}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">{t('appSettings.googleCloudProjectId')}</label>
                      <input value={crProjectId} onChange={(e) => setCrProjectId(e.target.value)} onBlur={saveCloudRunSettings} placeholder="my-gcp-project-123" className={monoInputClass + " focus:ring-blue-500/30 focus:border-blue-500/50"} />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">Your project ID from <span className="text-blue-400">console.cloud.google.com</span></p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">{t('appSettings.region')}</label>
                      <select value={crRegion} onChange={(e) => setCrRegion(e.target.value)} onBlur={saveCloudRunSettings}
                        className={monoInputClass + " cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_12px_center] focus:ring-blue-500/30 focus:border-blue-500/50"}>
                        <option value="us-central1">us-central1 (Iowa)</option>
                        <option value="us-east1">us-east1 (South Carolina)</option>
                        <option value="us-east4">us-east4 (Northern Virginia)</option>
                        <option value="us-west1">us-west1 (Oregon)</option>
                        <option value="us-west2">us-west2 (Los Angeles)</option>
                        <option value="europe-west1">europe-west1 (Belgium)</option>
                        <option value="europe-west2">europe-west2 (London)</option>
                        <option value="europe-west3">europe-west3 (Frankfurt)</option>
                        <option value="asia-east1">asia-east1 (Taiwan)</option>
                        <option value="asia-northeast1">asia-northeast1 (Tokyo)</option>
                        <option value="asia-southeast1">asia-southeast1 (Singapore)</option>
                        <option value="southamerica-east1">southamerica-east1 (Sao Paulo)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">{t('appSettings.serviceAccountKeyJson')}</label>
                      <textarea value={crServiceAccountKey} onChange={(e) => setCrServiceAccountKey(e.target.value)} onBlur={saveCloudRunSettings}
                        placeholder='{"type": "service_account", "project_id": "...", ...}'
                        rows={3}
                        className={monoInputClass + " resize-none text-[11px] focus:ring-blue-500/30 focus:border-blue-500/50"} />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">Create a service account with <span className="text-blue-400">Cloud Run Admin</span> and <span className="text-blue-400">Storage Admin</span> roles. Download the JSON key.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">{t('appSettings.serviceNameOptional')}</label>
                      <input value={crServiceName} onChange={(e) => setCrServiceName(e.target.value)} onBlur={saveCloudRunSettings} placeholder="my-service" className={monoInputClass + " focus:ring-blue-500/30 focus:border-blue-500/50"} />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">{t('appSettings.serviceNameHint')}</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={crAllowUnauth} onChange={(e) => { setCrAllowUnauth(e.target.checked); saveCloudRunSettings(); }}
                        className="w-4 h-4 rounded border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 accent-blue-500" />
                      <span className="text-sm text-bolt-elements-textSecondary">{t('appSettings.allowUnauthenticated')}</span>
                    </label>
                    <button onClick={deployToCloudRun} disabled={deploying !== 'none' || !crProjectId.trim() || !crServiceAccountKey.trim()}
                      className="w-full py-3 px-4 bg-blue-500/12 text-blue-400 rounded-xl text-sm font-semibold border border-blue-500/20 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                      {deploying === 'cloudrun' ? (<><div className="i-svg-spinners:90-ring-with-bg text-base" /> {t('appSettings.deploying')}</>) : (<><div className="i-ph:rocket-launch text-base" /> {t('appSettings.deployToCloudRun')}</>)}
                    </button>
                  </div>
                </div>

                {/* Deploy Result */}
                {deployResult && (
                  <div className="flex flex-col gap-2 p-3 rounded-lg bg-green-500/8 border border-green-500/20">
                    <div className="flex items-center gap-3">
                      <div className={`i-ph:${deployResult.provider === 'cloudrun' ? 'clock' : 'check-circle-fill'} ${deployResult.provider === 'cloudrun' ? 'text-amber-400' : 'text-green-400'} text-lg shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-green-400">
                          {deployResult.provider === 'cloudrun'
                            ? t('appSettings.cloudRunDeployStarted')
                            : t('appSettings.deployedSuccessfully', { provider: deployResult.provider === 'vercel' ? t('appSettings.vercel') : t('appSettings.netlify') })
                          }
                        </p>
                        {deployResult.url && (
                          <a href={deployResult.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 hover:underline truncate block">{deployResult.url}</a>
                        )}
                      </div>
                    </div>
                    {deployResult.message && (
                      <p className="text-[11px] text-bolt-elements-textTertiary pl-8">{deployResult.message}</p>
                    )}
                    {deployResult.buildLogsUrl && (
                      <a href={deployResult.buildLogsUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:underline pl-8 flex items-center gap-1">
                        <div className="i-ph:arrow-square-out text-xs" /> {t('appSettings.viewBuildLogs')}
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ====== DATABASE TAB ====== */}
            {tab === 'database' && (
              <div className="space-y-5">
                {/* Database Provider Selector */}
                <div>
                  <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-3">{t('appSettings.databaseProvider')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { setDbType('none'); saveDatabaseSettings('none'); }}
                      className={`p-3 rounded-xl border text-center transition-all ${dbType === 'none' ? 'border-bolt-elements-borderColor bg-bolt-elements-item-backgroundActive ring-1 ring-purple-500/30' : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-item-backgroundActive'}`}>
                      <div className="i-ph:prohibit text-xl mx-auto mb-1 text-bolt-elements-textTertiary" />
                      <span className="text-xs font-medium text-bolt-elements-textPrimary block">{t('appSettings.none')}</span>
                    </button>
                    <button onClick={() => { setDbType('firebase'); saveDatabaseSettings('firebase'); }}
                      className={`p-3 rounded-xl border text-center transition-all ${dbType === 'firebase' ? 'border-amber-500 bg-amber-500/8 ring-1 ring-amber-500/30' : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-item-backgroundActive'}`}>
                      <img src="/logos/firebase.svg" alt="Firebase" className={`w-6 h-6 mx-auto mb-1 object-contain ${dbType === 'firebase' ? '' : 'opacity-40 grayscale'}`} />
                      <span className="text-xs font-medium text-bolt-elements-textPrimary block">Firebase</span>
                    </button>
                    <button onClick={() => { setDbType('supabase'); saveDatabaseSettings('supabase'); }}
                      className={`p-3 rounded-xl border text-center transition-all ${dbType === 'supabase' ? 'border-emerald-500 bg-emerald-500/8 ring-1 ring-emerald-500/30' : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-item-backgroundActive'}`}>
                      <img src="/logos/supabase.svg" alt="Supabase" className={`w-6 h-6 mx-auto mb-1 object-contain ${dbType === 'supabase' ? '' : 'opacity-40 grayscale'}`} />
                      <span className="text-xs font-medium text-bolt-elements-textPrimary block">Supabase</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-bolt-elements-textTertiary mt-2">
                    {t('appSettings.databaseAiDesc')}
                  </p>
                </div>

                {dbType === 'none' && (
                  <div className="text-center py-8">
                    <div className="i-ph:database text-4xl text-bolt-elements-textTertiary mx-auto mb-3" />
                    <p className="text-sm text-bolt-elements-textSecondary">{t('appSettings.noDatabase')}</p>
                    <p className="text-xs text-bolt-elements-textTertiary mt-1 max-w-xs mx-auto">{t('appSettings.selectDbDesc')}</p>
                  </div>
                )}

                {dbType === 'firebase' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                      <div className="i-ph:info text-amber-400 text-base shrink-0" />
                      <p className="text-xs text-amber-300/80">{t('appSettings.firebaseInfo')}</p>
                    </div>
                    {[
                      { key: 'apiKey' as const, label: 'API Key', placeholder: 'AIzaSy...' },
                      { key: 'authDomain' as const, label: 'Auth Domain', placeholder: 'my-project.firebaseapp.com' },
                      { key: 'projectId' as const, label: 'Project ID', placeholder: 'my-project-id' },
                      { key: 'storageBucket' as const, label: 'Storage Bucket', placeholder: 'my-project.appspot.com' },
                      { key: 'messagingSenderId' as const, label: 'Messaging Sender ID', placeholder: '123456789' },
                      { key: 'appId' as const, label: 'App ID', placeholder: '1:123:web:abc123' },
                      { key: 'measurementId' as const, label: 'Measurement ID', placeholder: 'G-XXXXXXXXXX (optional)' },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">{field.label}</label>
                        <input value={firebase[field.key]} onChange={(e) => setFirebase({ ...firebase, [field.key]: e.target.value })} onBlur={saveDatabaseSettings}
                          placeholder={field.placeholder} className={monoInputClass + " focus:ring-amber-500/30 focus:border-amber-500/50"} />
                      </div>
                    ))}
                    <button onClick={saveDatabaseSettings} className="w-full py-3 px-4 bg-amber-500/12 text-amber-400 rounded-xl text-sm font-semibold border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2">
                      <div className="i-ph:floppy-disk text-base" /> {t('appSettings.saveFirebaseConfig')}
                    </button>
                  </div>
                )}

                {dbType === 'supabase' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                      <div className="i-ph:info text-emerald-400 text-base shrink-0" />
                      <p className="text-xs text-emerald-300/80">{t('appSettings.supabaseInfo')}</p>
                    </div>
                    {[
                      { key: 'url' as const, label: 'Project URL', placeholder: 'https://xxxxx.supabase.co' },
                      { key: 'anonKey' as const, label: 'Anon (Public) Key', placeholder: 'eyJhbGciOi...' },
                      { key: 'serviceRoleKey' as const, label: 'Service Role Key', placeholder: 'eyJhbGciOi... (secret)' },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                          {field.label}
                          {field.key === 'serviceRoleKey' && <span className="text-red-400 ml-1.5 normal-case">{t('appSettings.secret')}</span>}
                        </label>
                        <input value={supabase[field.key]} onChange={(e) => setSupabase({ ...supabase, [field.key]: e.target.value })} onBlur={saveDatabaseSettings}
                          placeholder={field.placeholder} type={field.key === 'serviceRoleKey' ? 'password' : 'text'}
                          className={monoInputClass + " focus:ring-emerald-500/30 focus:border-emerald-500/50"} />
                      </div>
                    ))}
                    <button onClick={saveDatabaseSettings} className="w-full py-3 px-4 bg-emerald-500/12 text-emerald-400 rounded-xl text-sm font-semibold border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2">
                      <div className="i-ph:floppy-disk text-base" /> {t('appSettings.saveSupabaseConfig')}
                    </button>
                  </div>
                )}

                {/* AI Database Capabilities Info */}
                {dbType !== 'none' && (
                  <div className="border-t border-bolt-elements-borderColor pt-4">
                    <h4 className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">{t('appSettings.aiDbCapabilities')}</h4>
                    <div className="space-y-1.5">
                      {[
                        { icon: 'i-ph:table', text: t('appSettings.aiDbCrud') },
                        { icon: 'i-ph:code', text: t('appSettings.aiDbSdk') },
                        { icon: 'i-ph:download-simple', text: t('appSettings.aiDbPackages') },
                        { icon: 'i-ph:shield-check', text: t('appSettings.aiDbSecure') },
                      ].map(item => (
                        <div key={item.text} className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
                          <div className={`${item.icon} text-sm text-purple-400`} />
                          {item.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ====== ENV VARS TAB ====== */}
            {tab === 'env' && (
              <div className="space-y-4">
                {envVars.length > 0 && (
                  <div className="space-y-2">
                    {envVars.map((env, index) => (
                      <EnvVarRow key={env.key + '-' + index} env={env} index={index} onUpdate={updateEnvVar} onRemove={removeEnvVar} />
                    ))}
                  </div>
                )}
                {envVars.length === 0 && (
                  <div className="text-center py-8">
                    <div className="i-ph:key text-3xl text-bolt-elements-textTertiary mx-auto mb-2" />
                    <p className="text-sm text-bolt-elements-textTertiary">{t('appSettings.noEnvVars')}</p>
                  </div>
                )}
                <div className="flex gap-2 p-3 bg-bolt-elements-background-depth-1 rounded-lg border border-dashed border-bolt-elements-borderColor">
                  <input value={newEnvKey} onChange={(e) => setNewEnvKey(e.target.value)} placeholder="KEY" onKeyDown={(e) => e.key === 'Enter' && addEnvVar()}
                    className="flex-1 px-3 py-2 rounded-md text-sm font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:border-purple-500/50" />
                  <input value={newEnvValue} onChange={(e) => setNewEnvValue(e.target.value)} placeholder={t('appSettings.value')} onKeyDown={(e) => e.key === 'Enter' && addEnvVar()}
                    className="flex-1 px-3 py-2 rounded-md text-sm font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textSecondary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:border-purple-500/50" />
                  <button onClick={addEnvVar} disabled={!newEnvKey.trim() || !newEnvValue.trim()}
                    className="px-3 py-2 bg-purple-500/15 text-purple-400 rounded-md hover:bg-purple-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <div className="i-ph:plus text-lg" />
                  </button>
                </div>
 </div>
            )}

            {/* ====== AI RULES TAB ====== */}
            {tab === 'rules' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                    <div className="i-ph:brain-duotone text-amber-400 text-base" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-bolt-elements-textPrimary">{t('appSettings.customAiInstructions')}</h3>
                    <p className="text-[11px] text-bolt-elements-textTertiary">{t('appSettings.customAiRulesDesc')}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-bolt-elements-textSecondary leading-relaxed">
                    {t('appSettings.aiRulesLongDesc')}
                  </p>
                  <div className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="i-ph:lightbulb text-amber-400 text-sm" />
                      <span className="text-[11px] font-semibold text-amber-400">{t('appSettings.examples')}</span>
                    </div>
                    <ul className="text-[11px] text-amber-400/80 space-y-0.5 ml-5 list-disc">
                      <li>{t('appSettings.exampleTypescript')}</li>
                      <li>{t('appSettings.exampleTailwind')}</li>
                      <li>{t('appSettings.exampleRepo')}</li>
                      <li>{t('appSettings.examplePascalCase')}</li>
                      <li>{t('appSettings.exampleErrorHandling')}</li>
                    </ul>
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    value={customRules}
                    onChange={(e) => setCustomRules(e.target.value)}
                    onBlur={saveCustomRules}
                    placeholder={t('appSettings.aiRulesPlaceholder')}
                    rows={12}
                    className="w-full px-4 py-3 rounded-lg text-sm font-mono bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all placeholder:text-bolt-elements-textTertiary resize-y leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] text-bolt-elements-textTertiary">{customRules.length} {t('appSettings.characters')}</span>
                    {customRules.length > 0 && (
                      <button
                        onClick={() => { setCustomRules(''); updateActiveProjectSettings({ customRules: '' }); toast.info(t('appSettings.aiRulesCleared')); }}
                        className="text-[11px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                      >
                        <div className="i-ph:trash text-xs" /> {t('appSettings.clear')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ====== SNAPSHOTS TAB ====== */}
            {tab === 'versions' && (
              <div className="space-y-4">
                <button onClick={saveSnapshot}
                  className="w-full py-3 px-4 bg-purple-500/12 text-purple-400 rounded-xl text-sm font-semibold border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center justify-center gap-2">
                  <div className="i-ph:camera text-base" /> {t('appSettings.createSnapshot')}
                </button>
                {snapshots.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="i-ph:clock-counter-clockwise text-3xl text-bolt-elements-textTertiary mx-auto mb-2" />
                    <p className="text-sm text-bolt-elements-textTertiary">{t('appSettings.noSnapshots')}</p>
                    <p className="text-xs text-bolt-elements-textTertiary mt-1">{t('appSettings.noSnapshotsDesc')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {snapshots.map(s => (
                      <div key={s.id} className="flex items-center gap-3 p-3 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor group">
                        <div className="i-ph:clock text-bolt-elements-textTertiary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">{s.name}</div>
                          <div className="text-[11px] text-bolt-elements-textTertiary">{new Date(s.timestamp).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => restoreSnapshot(s.id)} className="px-2.5 py-1.5 text-[11px] font-medium text-purple-400 bg-purple-500/10 rounded-md hover:bg-purple-500/20 transition-all">{t('appSettings.restore')}</button>
                          <button onClick={() => deleteSnapshot(s.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-300 transition-all"><div className="i-ph:trash text-sm" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

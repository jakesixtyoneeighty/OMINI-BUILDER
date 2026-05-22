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
import { SecurityTestTab } from '~/components/chat/SecurityTestTab';
import { useT } from '~/lib/i18n/useT';
import {
  saveSnapshotData,
  saveSnapshotToList,
  loadSnapshots,
  loadSnapshotData,
  deleteSnapshotData,
  type SnapshotMeta,
} from '~/lib/stores/snapshots';
import {
  settingsPanelStore,
  closeSettingsPanel,
  setSettingsTab,
  type SettingsTab,
} from '~/lib/stores/layout';

const TABS = [
  { id: 'deploy' as const, label: 'Deploy', icon: 'i-ph:rocket-launch-duotone' },
  { id: 'versions' as const, label: 'Snapshots', icon: 'i-ph:clock-counter-clockwise' },
  { id: 'database' as const, label: 'Database', icon: 'i-ph:database-duotone' },
  { id: 'integrations' as const, label: 'Integrations', icon: 'i-ph:plug-duotone' },
  { id: 'env' as const, label: 'Env Vars', icon: 'i-ph:key' },
  { id: 'general' as const, label: 'General', icon: 'i-ph:gear-six' },
  { id: 'rules' as const, label: 'AI Rules', icon: 'i-ph:brain-duotone' },
  { id: 'security' as const, label: 'Security', icon: 'i-ph:shield-check' },
  { id: 'preview' as const, label: 'Preview', icon: 'i-ph:eye' },
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

const emptyFirebase: FirebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  measurementId: '',
};
const emptySupabase: SupabaseConfig = { url: '', anonKey: '', serviceRoleKey: '' };

// Inline editable env var row
function EnvVarRow({
  env,
  index,
  onUpdate,
  onRemove,
}: {
  env: EnvVar;
  index: number;
  onUpdate: (i: number, key: string, value: string) => void;
  onRemove: (i: number) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [editKey, setEditKey] = useState(env.key);
  const [editValue, setEditValue] = useState(env.value);
  const [hasChanges, setHasChanges] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setEditKey(env.key);
    setEditValue(env.value);
    setHasChanges(false);
    setEditing(false);
    setExpanded(false);
  }, [env.key, env.value]);

  const isLongValue = env.value.length > 60;

  const save = () => {
    onUpdate(index, editKey, editValue);
    setEditing(false);
    setHasChanges(false);
  };
  const cancel = () => {
    setEditKey(env.key);
    setEditValue(env.value);
    setEditing(false);
    setHasChanges(false);
  };

  if (editing) {
    return (
      <div className="px-3 py-2 bg-bolt-elements-background-depth-1 rounded-lg border-2 border-purple-500/50 group">
        <div className="flex items-center gap-2 mb-2">
          <div className="i-ph:pencil-simple text-purple-400 text-sm shrink-0" />
          <span className="text-xs text-bolt-elements-textTertiary font-medium">{t('appSettings.editing')}</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-bolt-elements-textTertiary uppercase w-8 shrink-0">
              Key
            </label>
            <input
              value={editKey}
              onChange={(e) => {
                setEditKey(e.target.value);
                setHasChanges(true);
              }}
              onKeyDown={(e) => e.key === 'Escape' && cancel()}
              className="flex-[1] min-w-0 px-2 py-1.5 rounded text-sm font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-bolt-elements-textTertiary uppercase w-8 shrink-0">
              Val
            </label>
            <input
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
                setHasChanges(true);
              }}
              onKeyDown={(e) => e.key === 'Escape' && cancel()}
              className="flex-[3] min-w-0 px-2 py-1.5 rounded text-sm font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textSecondary focus:outline-none focus:border-purple-500/50 break-all"
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              onClick={cancel}
              className="text-bolt-elements-textTertiary hover:text-red-400 transition-all p-1.5 rounded-md hover:bg-red-500/10"
            >
              <div className="i-ph:x text-sm" />
            </button>
            <button
              onClick={save}
              disabled={!hasChanges}
              className="text-green-400 hover:text-green-300 disabled:opacity-30 transition-all p-1.5 rounded-md hover:bg-green-500/10"
            >
              <div className="i-ph:check text-sm" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor group hover:border-purple-500/30 transition-colors">
      <div className="flex items-center gap-2">
        <div className="i-ph:key text-bolt-elements-textTertiary text-sm shrink-0" />
        <span className="font-mono text-sm text-bolt-elements-textPrimary font-medium shrink-0">{env.key}</span>
        <span className="text-bolt-elements-textTertiary text-sm shrink-0">=</span>
        <span
          className={`font-mono text-sm text-bolt-elements-textSecondary flex-1 min-w-0 ${!expanded && isLongValue ? 'truncate' : 'break-all'}`}
        >
          {env.value}
        </span>
        {isLongValue && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-bolt-elements-textTertiary hover:text-purple-400 transition-all p-1 shrink-0"
            title={expanded ? t('appSettings.collapse') : t('appSettings.expand')}
          >
            <div className={`i-ph:text-nowrap text-sm transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 text-bolt-elements-textTertiary hover:text-purple-400 transition-all p-1 shrink-0"
          title={t('appSettings.edit')}
        >
          <div className="i-ph:pencil-simple text-sm" />
        </button>
        <button
          onClick={() => onRemove(index)}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all p-1 shrink-0"
          title={t('appSettings.remove')}
        >
          <div className="i-ph:trash text-sm" />
        </button>
      </div>
    </div>
  );
}

export function AppSettingsDialog() {
  const t = useT();
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[activeId];
  const settings = project?.settings;
  const panelState = useStore(settingsPanelStore);
  const open = panelState.open;
  const tab = panelState.tab;
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
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

  // Gmail
  const [gmailClientId, setGmailClientId] = useState(settings?.gmail?.clientId || '');
  const [gmailClientSecret, setGmailClientSecret] = useState(settings?.gmail?.clientSecret || '');
  const [gmailRedirectUri, setGmailRedirectUri] = useState(settings?.gmail?.redirectUri || '');

  // GitHub Integration
  const [githubToken, setGithubToken] = useState(settings?.github?.token || '');
  const [githubRepo, setGithubRepo] = useState(settings?.github?.repo || '');
  const [githubBranch, setGithubBranch] = useState(settings?.github?.branch || 'main');

  // Database
  const [dbType, setDbType] = useState<string>(settings?.database?.type || 'none');
  const [firebase, setFirebase] = useState<FirebaseConfig>(settings?.database?.firebase || { ...emptyFirebase });
  const [supabase, setSupabase] = useState<SupabaseConfig>(settings?.database?.supabase || { ...emptySupabase });

  // Deploy state
  const [deploying, setDeploying] = useState<'none' | 'netlify' | 'vercel' | 'cloudrun'>('none');
  const [deployResult, setDeployResult] = useState<{
    url: string;
    siteId?: string;
    projectId?: string;
    provider: string;
    message?: string;
    buildLogsUrl?: string;
  } | null>(null);

  // Last deploy from saved settings (persists across dialog open/close)
  const lastDeploy = settings?.lastDeploy;
  const hasLastDeploy = lastDeploy && lastDeploy.url;

  // AI Rules
  const [customRules, setCustomRules] = useState(settings?.customRules || '');

  // Close modal on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettingsPanel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Reset state when panel opens
    setSnapshots(loadSnapshots(activeId));
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
    setGmailClientId(settings?.gmail?.clientId || '');
    setGmailClientSecret(settings?.gmail?.clientSecret || '');
    setGmailRedirectUri(settings?.gmail?.redirectUri || '');
    setGithubToken(settings?.github?.token || '');
    setGithubRepo(settings?.github?.repo || '');
    setGithubBranch(settings?.github?.branch || 'main');
    setDbType(settings?.database?.type || 'none');
    setFirebase(settings?.database?.firebase || { ...emptyFirebase });
    setSupabase(settings?.database?.supabase || { ...emptySupabase });
    setDeployResult(null);
    setCustomRules(settings?.customRules || '');
  }, [open, activeId, project, settings]);

  const saveSnapshot = () => {
    const files = workbenchStore.files.get();
    const snapshot = {
      id: Date.now(),
      name: `Snapshot ${new Date().toLocaleString()}`,
      timestamp: new Date().toISOString(),
      files: { ...files },
      messageIndex: 0,
    };
    const dataSize = saveSnapshotData(snapshot);
    const meta: SnapshotMeta = {
      id: snapshot.id,
      name: snapshot.name,
      timestamp: snapshot.timestamp,
      messageIndex: 0,
      fileCount: Object.keys(files).length,
      dataSize,
    };
    const currentSnapshots = loadSnapshots(activeId);
    currentSnapshots.push(meta);
    saveSnapshotToList(activeId, currentSnapshots);
    setSnapshots(currentSnapshots);
    if (dataSize > 0) {
      toast.success(t('appSettings.snapshotSaved'));
    } else {
      toast.warn('Snapshot too large or localStorage full — only metadata saved');
    }
  };

  const restoreSnapshot = (id: number) => {
    const files = loadSnapshotData(id);
    if (files) {
      workbenchStore.files.set(files);
      toast.success(t('appSettings.snapshotRestored'));
    } else {
      toast.error('Snapshot data not found — may have been cleaned up to save space');
    }
  };

  const deleteSnapshot = (id: number) => {
    const currentSnapshots = loadSnapshots(activeId);
    const newSnapshots = currentSnapshots.filter((s) => s.id !== id);
    saveSnapshotToList(activeId, newSnapshots);
    deleteSnapshotData(id);
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
    updateActiveProjectSettings({
      vercel: { token: vercelToken.trim(), projectName: vercelProjectName.trim(), framework: vercelFramework },
    });
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

  const saveGmailSettings = () => {
    updateActiveProjectSettings({
      gmail: {
        clientId: gmailClientId.trim(),
        clientSecret: gmailClientSecret.trim(),
        redirectUri: gmailRedirectUri.trim(),
      },
    });
    toast.success(t('appSettings.gmailSettingsSaved'));
  };

  const saveGithubIntegrationSettings = () => {
    updateActiveProjectSettings({
      github: {
        token: githubToken.trim(),
        repo: githubRepo.trim(),
        branch: githubBranch.trim() || 'main',
      },
    });
    toast.success(t('appSettings.githubSettingsSaved'));
  };

  const saveDatabaseSettings = (overrideType?: string) => {
    const type = overrideType ?? dbType;
    updateActiveProjectSettings({
      database: {
        type: type as any,
        firebase,
        supabase,
        omni: settings?.database?.omni || { uri: '', db: '' },
      },
    });
    toast.success(t('appSettings.databaseSettingsSaved'));

    // Dispatch event so Chat can auto-prompt the AI to configure the database
    // Only dispatch if the user has actually filled in credentials
    if (type === 'supabase' && supabase.url) {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('database-config-changed', {
            detail: { type: 'supabase', config: supabase },
          }),
        );
      }, 100);
    } else if (type === 'firebase' && firebase.apiKey) {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('database-config-changed', {
            detail: { type: 'firebase', config: firebase },
          }),
        );
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
    if (!netlifyToken.trim()) {
      toast.error(t('appSettings.netlifyTokenRequired'));
      return;
    }
    setDeploying('netlify');
    setDeployResult(null);
    try {
      const fileList = await getProjectFiles();
      const res = await fetch('/api/netlify-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: netlifyToken.trim(),
          siteId: netlifySiteId.trim() || undefined,
          files: fileList,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || t('appSettings.deployFailed'));
      }
      const data = await res.json();
      const deployUrl = data.url;
      const deploySiteId = data.siteId;
      setDeployResult({ url: deployUrl, siteId: deploySiteId, provider: 'netlify' });
      // Persist deploy info so it survives dialog close/reopen
      updateActiveProjectSettings({
        netlify: { token: netlifyToken.trim(), siteId: deploySiteId || netlifySiteId.trim() },
        lastDeploy: {
          url: deployUrl,
          provider: 'netlify',
          siteId: deploySiteId || netlifySiteId.trim(),
          deployedAt: new Date().toISOString(),
        },
      });
      if (deploySiteId) {
        setNetlifySiteId(deploySiteId);
      }
      toast.success(t('appSettings.deployedToNetlify'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('appSettings.deployFailed'));
    } finally {
      setDeploying('none');
    }
  };

  const deployToVercel = async () => {
    if (!vercelToken.trim()) {
      toast.error(t('appSettings.vercelTokenRequired'));
      return;
    }
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || t('appSettings.deployFailed'));
      }
      const data = await res.json();
      const deployUrl = data.url;
      setDeployResult({ url: deployUrl, projectId: data.projectId, provider: 'vercel' });
      updateActiveProjectSettings({
        vercel: { token: vercelToken.trim(), projectName: vercelProjectName.trim(), framework: vercelFramework },
        lastDeploy: {
          url: deployUrl,
          provider: 'vercel',
          siteId: data.projectId || '',
          deployedAt: new Date().toISOString(),
        },
      });
      toast.success(t('appSettings.deployedToVercel'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('appSettings.deployFailed'));
    } finally {
      setDeploying('none');
    }
  };

  const deployToCloudRun = async () => {
    if (!crProjectId.trim()) {
      toast.error(t('appSettings.gcpProjectIdRequired'));
      return;
    }
    if (!crServiceAccountKey.trim()) {
      toast.error(t('appSettings.serviceAccountKeyRequired'));
      return;
    }
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || t('appSettings.deployFailed'));
      }
      const data = await res.json();
      const deployUrl = data.url || '';
      setDeployResult({
        url: deployUrl,
        projectId: crProjectId,
        provider: 'cloudrun',
        message: data.message,
        buildLogsUrl: data.buildLogsUrl,
      });
      const crSettings: any = {
        projectId: crProjectId.trim(),
        region: crRegion,
        serviceAccountKey: crServiceAccountKey.trim(),
        serviceName: data.serviceName || crServiceName.trim(),
        allowUnauthenticated: crAllowUnauth,
      };
      updateActiveProjectSettings({
        cloudRun: crSettings,
        lastDeploy: {
          url: deployUrl,
          provider: 'cloudrun',
          siteId: data.serviceName || '',
          deployedAt: new Date().toISOString(),
        },
      });
      if (data.serviceName) {
        setCrServiceName(data.serviceName);
      }
      toast.success(t('appSettings.cloudRunDeployStarted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('appSettings.deployFailed'));
    } finally {
      setDeploying('none');
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all placeholder:text-bolt-elements-textTertiary';
  const monoInputClass = inputClass + ' font-mono';

  if (!open) return null;

  // Check if an integration is connected
  const isGmailConnected = !!gmailClientId;
  const isGdriveConnected = !!gdriveClientId;
  const isGithubConnected = !!githubToken;
  const connectedCount = [isGmailConnected, isGdriveConnected, isGithubConnected].filter(Boolean).length;

  // Tab icons mapping
  const tabIconMap: Record<string, string> = {
    deploy: 'i-ph:rocket-launch-duotone',
    versions: 'i-ph:clock-counter-clockwise',
    database: 'i-ph:database-duotone',
    integrations: 'i-ph:plug-duotone',
    env: 'i-ph:key',
    general: 'i-ph:gear-six',
    rules: 'i-ph:brain-duotone',
    security: 'i-ph:shield-check',
    preview: 'i-ph:eye',
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <style>{`
        .settings-modal { font-family: 'Geist', system-ui, sans-serif; }
        .settings-tab-active {
          background: rgba(99,102,241,.15) !important;
          color: #a5b4fc !important;
          border-color: rgba(99,102,241,.3) !important;
        }
        .settings-tab-active .tab-icon { color: #a5b4fc !important; }
        .settings-tab:hover:not(.settings-tab-active) {
          background: rgba(255,255,255,.04) !important;
          color: rgba(255,255,255,.7) !important;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)' }}
        onClick={closeSettingsPanel}
      />

      {/* Modal */}
      <div
        className="settings-modal relative w-[92vw] max-w-[900px] h-[88vh] max-h-[820px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: 'rgba(12,12,20,.97)',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: '20px',
          boxShadow: '0 40px 100px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.04)',
        }}
      >

      {/* ====== HEADER BAR ====== */}
      <div
        className="shrink-0 px-5 pt-4 pb-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.2)' }}
            >
              {settings?.logo ? (
                <img src={settings.logo} alt="" className="w-5 h-5 rounded object-cover" />
              ) : (
                <div className="i-ph:folder-open text-sm" style={{ color: '#818cf8' }} />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,.9)' }}>
                {projectName || t('appSettings.untitled')}
              </h2>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,.3)' }}>
                Project Settings
              </p>
            </div>
          </div>
          <button
            onClick={closeSettingsPanel}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ color: 'rgba(255,255,255,.3)', background: 'rgba(255,255,255,.05)' }}
            onMouseEnter={e => { (e.target as HTMLElement).closest('button')!.style.background = 'rgba(255,255,255,.1)'; (e.target as HTMLElement).closest('button')!.style.color = 'rgba(255,255,255,.8)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).closest('button')!.style.background = 'rgba(255,255,255,.05)'; (e.target as HTMLElement).closest('button')!.style.color = 'rgba(255,255,255,.3)'; }}
          >
            <div className="i-ph:x text-sm" />
          </button>
        </div>

        {/* ====== HORIZONTAL TAB PILLS ====== */}
        <div className="flex items-center gap-1 overflow-x-auto pb-3 scrollbar-none">
          {TABS.map((tabItem) => {
            const isActive = tab === tabItem.id;
            const isIntegrationTab = tabItem.id === 'integrations';
            return (
              <button
                key={tabItem.id}
                onClick={() => setSettingsTab(tabItem.id)}
                className={`settings-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${isActive ? 'settings-tab-active' : ''}`}
                style={{
                  border: '1px solid transparent',
                  color: isActive ? '#a5b4fc' : 'rgba(255,255,255,.35)',
                }}
              >
                <div className={`tab-icon ${tabIconMap[tabItem.id]} text-sm`} style={{ color: isActive ? '#a5b4fc' : 'rgba(255,255,255,.3)' }} />
                <span>{t('appSettings.' + tabItem.id)}</span>
                {isIntegrationTab && connectedCount > 0 && (
                  <span
                    className="px-1.5 py-0.5 text-[9px] font-bold rounded-full"
                    style={{ background: 'rgba(16,185,129,.15)', color: '#6ee7b7' }}
                  >
                    {connectedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ====== CONTENT AREA ====== */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ====== GENERAL TAB ====== */}
          {tab === 'general' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">
                  {t('appSettings.projectName')}
                </label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onBlur={saveProjectInfo}
                  placeholder={t('appSettings.projectNamePlaceholder')}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">
                  {t('appSettings.description')}
                </label>
                <textarea
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  onBlur={saveProjectInfo}
                  placeholder={t('appSettings.descriptionPlaceholder')}
                  rows={3}
                  className={inputClass + ' resize-none'}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">
                  {t('appSettings.appLogo')}
                </label>
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
                      <span className="text-sm text-bolt-elements-textSecondary group-hover:text-purple-400 transition-colors">
                        {t('appSettings.uploadImage')}
                      </span>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                    <p className="text-[11px] text-bolt-elements-textTertiary mt-1.5 text-center">
                      {t('appSettings.imageHint')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ====== INTEGRATIONS TAB ====== */}
          {tab === 'integrations' && (
            <div className="space-y-6">
              {/* Connection status overview */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                <div className="i-ph:plug-duotone text-lg text-purple-400" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-bolt-elements-textPrimary">
                    {connectedCount}/3 {t('appSettings.integrationsConnected')}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${isGmailConnected ? 'bg-green-400' : 'bg-bolt-elements-borderColor'}`} title="Gmail" />
                  <div className={`w-2.5 h-2.5 rounded-full ${isGdriveConnected ? 'bg-green-400' : 'bg-bolt-elements-borderColor'}`} title="Google Drive" />
                  <div className={`w-2.5 h-2.5 rounded-full ${isGithubConnected ? 'bg-green-400' : 'bg-bolt-elements-borderColor'}`} title="GitHub" />
                </div>
              </div>

              {/* Gmail Integration */}
              <div className={`rounded-xl border transition-all ${isGmailConnected ? 'border-green-500/30 bg-green-500/3' : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1'}`}>
                <div className="flex items-center gap-4 p-5">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/15">
                    <svg width="30" height="30" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M64 128L256 274.667L448 128V96H64V128Z" fill="#4285F4"/>
                      <path d="M16 128V384C16 402.4 30.4 416 48 416H80L256 274.667L64 128H16Z" fill="#F44336"/>
                      <path d="M432 416H464C482.4 416 496 402.4 496 384V128H448L256 274.667L432 416Z" fill="#0F9D58"/>
                      <path d="M80 416H432L256 274.667L80 416Z" fill="#FFC107"/>
                      <path d="M16 128L256 274.667L64 128H16Z" fill="#F44336"/>
                      <path d="M496 128H448L256 274.667L496 384V128Z" fill="#0F9D58"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-bolt-elements-textPrimary">{t('appSettings.gmail')}</h3>
                      {isGmailConnected && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-500/15 text-green-400 uppercase tracking-wider">
                          {t('appSettings.connected')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-bolt-elements-textTertiary mt-0.5">{t('appSettings.gmailSubtitle')}</p>
                  </div>
                  <button
                    onClick={() => {
                      const el = document.getElementById('gmail-fields');
                      if (el) el.classList.toggle('hidden');
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      isGmailConnected
                        ? 'bg-green-500/12 text-green-400 hover:bg-green-500/20'
                        : 'bg-red-500/12 text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    {isGmailConnected ? t('appSettings.configured') : t('appSettings.connect')}
                  </button>
                </div>
                <div id="gmail-fields" className={isGmailConnected ? '' : 'hidden'}>
                  <div className="px-5 pb-5 space-y-3 border-t border-bolt-elements-borderColor pt-4">
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                        {t('appSettings.oauthClientId')}
                      </label>
                      <input
                        value={gmailClientId}
                        onChange={(e) => setGmailClientId(e.target.value)}
                        onBlur={saveGmailSettings}
                        placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                        type="text"
                        className={monoInputClass + ' focus:ring-red-500/30 focus:border-red-500/50'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                        {t('appSettings.oauthClientSecret')}
                      </label>
                      <input
                        value={gmailClientSecret}
                        onChange={(e) => setGmailClientSecret(e.target.value)}
                        onBlur={saveGmailSettings}
                        placeholder="GOCSPX-xxxxxxxxxxxxxxxxx"
                        type="password"
                        className={monoInputClass + ' focus:ring-red-500/30 focus:border-red-500/50'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                        {t('appSettings.redirectUri')}
                      </label>
                      <input
                        value={gmailRedirectUri}
                        onChange={(e) => setGmailRedirectUri(e.target.value)}
                        onBlur={saveGmailSettings}
                        placeholder="https://yourdomain.com/api/gmail/callback"
                        type="text"
                        className={monoInputClass + ' focus:ring-red-500/30 focus:border-red-500/50'}
                      />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">
                        {t('appSettings.gmailRedirectHint')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Google Drive Integration */}
              <div className={`rounded-xl border transition-all ${isGdriveConnected ? 'border-green-500/30 bg-green-500/3' : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1'}`}>
                <div className="flex items-center gap-4 p-5">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/15">
                    <svg width="30" height="30" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 14.95z" fill="#ea4335"/>
                      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                      <path d="m73.4 26.5-10.2-17.7c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.8h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-bolt-elements-textPrimary">{t('appSettings.googleDrive')}</h3>
                      {isGdriveConnected && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-500/15 text-green-400 uppercase tracking-wider">
                          {t('appSettings.connected')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-bolt-elements-textTertiary mt-0.5">{t('appSettings.gdriveSubtitle')}</p>
                  </div>
                  <button
                    onClick={() => {
                      const el = document.getElementById('gdrive-fields');
                      if (el) el.classList.toggle('hidden');
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      isGdriveConnected
                        ? 'bg-green-500/12 text-green-400 hover:bg-green-500/20'
                        : 'bg-blue-500/12 text-blue-400 hover:bg-blue-500/20'
                    }`}
                  >
                    {isGdriveConnected ? t('appSettings.configured') : t('appSettings.connect')}
                  </button>
                </div>
                <div id="gdrive-fields" className={isGdriveConnected ? '' : 'hidden'}>
                  <div className="px-5 pb-5 space-y-3 border-t border-bolt-elements-borderColor pt-4">
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                        {t('appSettings.oauthClientId')}
                      </label>
                      <input
                        value={gdriveClientId}
                        onChange={(e) => setGdriveClientId(e.target.value)}
                        onBlur={saveGdriveSettings}
                        placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                        type="text"
                        className={monoInputClass + ' focus:ring-blue-500/30 focus:border-blue-500/50'}
                      />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">
                        Create at <span className="text-blue-400">console.cloud.google.com/apis/credentials</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* GitHub Integration */}
              <div className={`rounded-xl border transition-all ${isGithubConnected ? 'border-green-500/30 bg-green-500/3' : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1'}`}>
                <div className="flex items-center gap-4 p-5">
                  <div className="w-14 h-14 rounded-2xl bg-bolt-elements-item-backgroundAccent/10 flex items-center justify-center shrink-0 border border-bolt-elements-borderColor">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" fill="#8B949E"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-bolt-elements-textPrimary">{t('appSettings.githubIntegration')}</h3>
                      {isGithubConnected && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-500/15 text-green-400 uppercase tracking-wider">
                          {t('appSettings.connected')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-bolt-elements-textTertiary mt-0.5">{t('appSettings.githubSubtitle')}</p>
                  </div>
                  <button
                    onClick={() => {
                      const el = document.getElementById('github-fields');
                      if (el) el.classList.toggle('hidden');
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      isGithubConnected
                        ? 'bg-green-500/12 text-green-400 hover:bg-green-500/20'
                        : 'bg-bolt-elements-item-backgroundAccent/12 text-bolt-elements-item-contentAccent hover:bg-bolt-elements-item-backgroundAccent/20'
                    }`}
                  >
                    {isGithubConnected ? t('appSettings.configured') : t('appSettings.connect')}
                  </button>
                </div>
                <div id="github-fields" className={isGithubConnected ? '' : 'hidden'}>
                  <div className="px-5 pb-5 space-y-3 border-t border-bolt-elements-borderColor pt-4">
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                        {t('appSettings.githubToken')}
                      </label>
                      <input
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        onBlur={saveGithubIntegrationSettings}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        type="password"
                        className={monoInputClass + ' focus:ring-bolt-elements-item-contentAccent/30 focus:border-bolt-elements-item-contentAccent/50'}
                      />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">
                        {t('appSettings.githubTokenHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                        {t('appSettings.githubRepo')}
                      </label>
                      <input
                        value={githubRepo}
                        onChange={(e) => setGithubRepo(e.target.value)}
                        onBlur={saveGithubIntegrationSettings}
                        placeholder="usuario/repositorio"
                        type="text"
                        className={monoInputClass + ' focus:ring-bolt-elements-item-contentAccent/30 focus:border-bolt-elements-item-contentAccent/50'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                        {t('appSettings.githubBranch')}
                      </label>
                      <input
                        value={githubBranch}
                        onChange={(e) => setGithubBranch(e.target.value)}
                        onBlur={saveGithubIntegrationSettings}
                        placeholder="main"
                        type="text"
                        className={monoInputClass + ' focus:ring-bolt-elements-item-contentAccent/30 focus:border-bolt-elements-item-contentAccent/50'}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ====== PREVIEW TAB ====== */}
          {tab === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    mode: 'webcontainer' as const,
                    icon: 'i-ph:cube-duotone',
                    title: 'WebContainer',
                    color: 'blue',
                    desc: t('appSettings.webcontainerDesc'),
                  },
                  {
                    mode: 'sandpack' as const,
                    icon: 'i-ph:browser-duotone',
                    title: 'Sandpack',
                    color: 'amber',
                    desc: t('appSettings.sandpackDesc'),
                  },
                  {
                    mode: 'iframe' as const,
                    icon: 'i-ph:code-duotone',
                    title: 'Iframe SrcDoc',
                    color: 'green',
                    desc: t('appSettings.iframeDesc'),
                  },
                  {
                    mode: 'reactlive' as const,
                    icon: 'i-ph:atom-duotone',
                    title: 'React Live',
                    color: 'cyan',
                    desc: t('appSettings.reactliveDesc'),
                  },
                  {
                    mode: 'playcode' as const,
                    icon: 'i-ph:code-block-duotone',
                    title: 'PlayCode',
                    color: 'orange',
                    desc: t('appSettings.playcodeDesc'),
                  },
                  {
                    mode: 'piston' as const,
                    icon: 'i-ph:rocket-duotone',
                    title: 'Piston',
                    color: 'purple',
                    desc: t('appSettings.pistonDesc'),
                  },
                  {
                    mode: 'newtab' as const,
                    icon: 'i-ph:arrow-square-out-duotone',
                    title: 'New Tab',
                    color: 'pink',
                    desc: t('appSettings.newtabDesc'),
                  },
                ].map((option) => {
                  const isActive = currentPreviewMode === option.mode;
                  const activeColorMap: Record<string, string> = {
                    blue: 'border-blue-500 bg-blue-500/8 ring-1 ring-blue-500/40',
                    amber: 'border-amber-500 bg-amber-500/8 ring-1 ring-amber-500/40',
                    green: 'border-green-500 bg-green-500/8 ring-1 ring-green-500/40',
                    cyan: 'border-cyan-500 bg-cyan-500/8 ring-1 ring-cyan-500/40',
                    orange: 'border-orange-500 bg-orange-500/8 ring-1 ring-orange-500/40',
                    pink: 'border-pink-500 bg-pink-500/8 ring-1 ring-pink-500/40',
                    purple: 'border-purple-500 bg-purple-500/8 ring-1 ring-purple-500/40',
                  };
                  const iconBgActive: Record<string, string> = {
                    blue: 'bg-blue-500/20',
                    amber: 'bg-amber-500/20',
                    green: 'bg-green-500/20',
                    cyan: 'bg-cyan-500/20',
                    orange: 'bg-orange-500/20',
                    pink: 'bg-pink-500/20',
                    purple: 'bg-purple-500/20',
                  };
                  const iconColorActive: Record<string, string> = {
                    blue: 'text-blue-400',
                    amber: 'text-amber-400',
                    green: 'text-green-400',
                    cyan: 'text-cyan-400',
                    orange: 'text-orange-400',
                    pink: 'text-pink-400',
                    purple: 'text-purple-400',
                  };
                  const badgeColor: Record<string, string> = {
                    blue: 'bg-blue-500/20 text-blue-400',
                    amber: 'bg-amber-500/20 text-amber-400',
                    green: 'bg-green-500/20 text-green-400',
                    cyan: 'bg-cyan-500/20 text-cyan-400',
                    orange: 'bg-orange-500/20 text-orange-400',
                    pink: 'bg-pink-500/20 text-pink-400',
                    purple: 'bg-purple-500/20 text-purple-400',
                  };
                  const checkColor: Record<string, string> = {
                    blue: 'text-blue-400',
                    amber: 'text-amber-400',
                    green: 'text-green-400',
                    cyan: 'text-cyan-400',
                    orange: 'text-orange-400',
                    pink: 'text-pink-400',
                    purple: 'text-purple-400',
                  };
                  return (
                    <button
                      key={option.mode}
                      onClick={() => {
                        updateActiveProjectSettings({ previewMode: option.mode });
                        toast.success(t('appSettings.modeActivated', { mode: option.title }));
                      }}
                      className={`relative w-full p-4 rounded-xl border text-left transition-all group ${isActive ? activeColorMap[option.color] : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:border-bolt-elements-borderColor hover:bg-bolt-elements-item-backgroundActive'}`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isActive ? iconBgActive[option.color] : 'bg-bolt-elements-background-depth-2'}`}
                        >
                          <div
                            className={`${option.icon} text-xl ${isActive ? iconColorActive[option.color] : 'text-bolt-elements-textTertiary'}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold text-sm ${isActive ? iconColorActive[option.color] : 'text-bolt-elements-textPrimary'}`}
                            >
                              {option.title}
                            </span>
                            {isActive && (
                              <span
                                className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${badgeColor[option.color]} uppercase tracking-wider`}
                              >
                                {t('appSettings.active')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-bolt-elements-textTertiary mt-0.5 leading-relaxed">
                            {option.desc}
                          </p>
                        </div>
                        {isActive && (
                          <div className={`i-ph:check-circle-fill ${checkColor[option.color]} text-xl shrink-0`} />
                        )}
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
                    <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                      {t('appSettings.personalAccessToken')}
                    </label>
                    <input
                      value={netlifyToken}
                      onChange={(e) => setNetlifyToken(e.target.value)}
                      onBlur={saveNetlifySettings}
                      placeholder="ntfy_..."
                      type="password"
                      className={monoInputClass + ' focus:ring-teal-500/30 focus:border-teal-500/50'}
                    />
                    <p className="text-[11px] text-bolt-elements-textTertiary mt-1">
                      Create a token at{' '}
                      <span className="text-teal-400">app.netlify.com/user/applications#personal-access-tokens</span>
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                      {t('appSettings.siteIdOptional')}
                    </label>
                    <input
                      value={netlifySiteId}
                      onChange={(e) => setNetlifySiteId(e.target.value)}
                      onBlur={saveNetlifySettings}
                      placeholder="Leave empty to create a new site"
                      className={monoInputClass + ' focus:ring-teal-500/30 focus:border-teal-500/50'}
                    />
                    <p className="text-[11px] text-bolt-elements-textTertiary mt-1">{t('appSettings.siteIdHint')}</p>
                  </div>
                  <button
                    onClick={deployToNetlify}
                    disabled={deploying !== 'none' || !netlifyToken.trim()}
                    className="w-full py-3 px-4 bg-teal-500/12 text-teal-400 rounded-xl text-sm font-semibold border border-teal-500/20 hover:bg-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {deploying === 'netlify' ? (
                      <>
                        <div className="i-svg-spinners:90-ring-with-bg text-base" /> {t('appSettings.deploying')}
                      </>
                    ) : (
                      <>
                        <div className="i-ph:rocket-launch text-base" /> {t('appSettings.deployToNetlify')}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Vercel Section */}
              <div className="border-t border-bolt-elements-borderColor pt-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-bolt-elements-bg-depth-3 flex items-center justify-center shrink-0 overflow-hidden">
                    <img src="/logos/vercel.svg" alt="Vercel" className="w-5 h-5 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-bolt-elements-textPrimary">{t('appSettings.vercel')}</h3>
                    <p className="text-[11px] text-bolt-elements-textTertiary">{t('appSettings.vercelSubtitle')}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                      {t('appSettings.accessToken')}
                    </label>
                    <input
                      value={vercelToken}
                      onChange={(e) => setVercelToken(e.target.value)}
                      onBlur={saveVercelSettings}
                      placeholder="vercel_token_..."
                      type="password"
                      className={monoInputClass}
                    />
                    <p className="text-[11px] text-bolt-elements-textTertiary mt-1">
                      Create a token at <span className="text-purple-400">vercel.com/account/tokens</span>
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                      {t('appSettings.projectNameOptional')}
                    </label>
                    <input
                      value={vercelProjectName}
                      onChange={(e) => setVercelProjectName(e.target.value)}
                      onBlur={saveVercelSettings}
                      placeholder="my-project"
                      className={monoInputClass}
                    />
                    <p className="text-[11px] text-bolt-elements-textTertiary mt-1">
                      {t('appSettings.vercelProjectNameHint')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                      {t('appSettings.frameworkPreset')}
                    </label>
                    <select
                      value={vercelFramework}
                      onChange={(e) => setVercelFramework(e.target.value)}
                      onBlur={saveVercelSettings}
                      className={
                        monoInputClass +
                        " cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_12px_center]"
                      }
                    >
                      {VERCEL_FRAMEWORKS.map((fw) => (
                        <option key={fw.value} value={fw.value}>
                          {fw.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={deployToVercel}
                    disabled={deploying !== 'none' || !vercelToken.trim()}
                    className="w-full py-3 px-4 bg-purple-500/12 text-purple-400 rounded-xl text-sm font-semibold border border-purple-500/20 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {deploying === 'vercel' ? (
                      <>
                        <div className="i-svg-spinners:90-ring-with-bg text-base" /> {t('appSettings.deploying')}
                      </>
                    ) : (
                      <>
                        <div className="i-ph:rocket-launch text-base" /> {t('appSettings.deployToVercel')}
                      </>
                    )}
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
                    <h3 className="text-sm font-bold text-bolt-elements-textPrimary">
                      {t('appSettings.googleCloudRun')}
                    </h3>
                    <p className="text-[11px] text-bolt-elements-textTertiary">{t('appSettings.cloudRunSubtitle')}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                      {t('appSettings.googleCloudProjectId')}
                    </label>
                    <input
                      value={crProjectId}
                      onChange={(e) => setCrProjectId(e.target.value)}
                      onBlur={saveCloudRunSettings}
                      placeholder="my-gcp-project-123"
                      className={monoInputClass + ' focus:ring-blue-500/30 focus:border-blue-500/50'}
                    />
                    <p className="text-[11px] text-bolt-elements-textTertiary mt-1">
                      Your project ID from <span className="text-blue-400">console.cloud.google.com</span>
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                      {t('appSettings.region')}
                    </label>
                    <select
                      value={crRegion}
                      onChange={(e) => setCrRegion(e.target.value)}
                      onBlur={saveCloudRunSettings}
                      className={
                        monoInputClass +
                        " cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_12px_center] focus:ring-blue-500/30 focus:border-blue-500/50"
                      }
                    >
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
                    <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                      {t('appSettings.serviceAccountKeyJson')}
                    </label>
                    <textarea
                      value={crServiceAccountKey}
                      onChange={(e) => setCrServiceAccountKey(e.target.value)}
                      onBlur={saveCloudRunSettings}
                      placeholder='{"type": "service_account", "project_id": "...", ...}'
                      rows={3}
                      className={
                        monoInputClass + ' resize-none text-[11px] focus:ring-blue-500/30 focus:border-blue-500/50'
                      }
                    />
                    <p className="text-[11px] text-bolt-elements-textTertiary mt-1">
                      Create a service account with <span className="text-blue-400">Cloud Run Admin</span> and{' '}
                      <span className="text-blue-400">Storage Admin</span> roles. Download the JSON key.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                      {t('appSettings.serviceNameOptional')}
                    </label>
                    <input
                      value={crServiceName}
                      onChange={(e) => setCrServiceName(e.target.value)}
                      onBlur={saveCloudRunSettings}
                      placeholder="my-service"
                      className={monoInputClass + ' focus:ring-blue-500/30 focus:border-blue-500/50'}
                    />
                    <p className="text-[11px] text-bolt-elements-textTertiary mt-1">
                      {t('appSettings.serviceNameHint')}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={crAllowUnauth}
                      onChange={(e) => {
                        setCrAllowUnauth(e.target.checked);
                        saveCloudRunSettings();
                      }}
                      className="w-4 h-4 rounded border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 accent-blue-500"
                    />
                    <span className="text-sm text-bolt-elements-textSecondary">
                      {t('appSettings.allowUnauthenticated')}
                    </span>
                  </label>
                  <button
                    onClick={deployToCloudRun}
                    disabled={deploying !== 'none' || !crProjectId.trim() || !crServiceAccountKey.trim()}
                    className="w-full py-3 px-4 bg-blue-500/12 text-blue-400 rounded-xl text-sm font-semibold border border-blue-500/20 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {deploying === 'cloudrun' ? (
                      <>
                        <div className="i-svg-spinners:90-ring-with-bg text-base" /> {t('appSettings.deploying')}
                      </>
                    ) : (
                      <>
                        <div className="i-ph:rocket-launch text-base" /> {t('appSettings.deployToCloudRun')}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Deploy Result (current session) */}
              {deployResult && (
                <div className="flex flex-col gap-2 p-4 rounded-xl bg-green-500/8 border border-green-500/20">
                  <div className="flex items-center gap-3">
                    <div
                      className={`i-ph:${deployResult.provider === 'cloudrun' ? 'clock' : 'check-circle-fill'} ${deployResult.provider === 'cloudrun' ? 'text-amber-400' : 'text-green-400'} text-xl shrink-0`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-green-400">
                        {deployResult.provider === 'cloudrun'
                          ? t('appSettings.cloudRunDeployStarted')
                          : t('appSettings.deployedSuccessfully', {
                              provider:
                                deployResult.provider === 'vercel' ? t('appSettings.vercel') : t('appSettings.netlify'),
                            })}
                      </p>
                    </div>
                  </div>
                  {deployResult.url && (
                    <a
                      href={deployResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 mx-1 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 transition-all group"
                    >
                      <div className="i-ph:globe text-green-400 shrink-0" />
                      <span className="text-sm text-green-300 font-mono truncate flex-1">{deployResult.url}</span>
                      <div className="i-ph:arrow-square-out text-green-400 shrink-0 group-hover:text-green-300 transition-colors" />
                    </a>
                  )}
                  {deployResult.message && (
                    <p className="text-[11px] text-bolt-elements-textTertiary pl-8">{deployResult.message}</p>
                  )}
                  {deployResult.buildLogsUrl && (
                    <a
                      href={deployResult.buildLogsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:underline pl-8 flex items-center gap-1"
                    >
                      <div className="i-ph:arrow-square-out text-xs" /> {t('appSettings.viewBuildLogs')}
                    </a>
                  )}
                </div>
              )}

              {/* Last Deploy (persisted) */}
              {!deployResult && hasLastDeploy && (
                <div className="p-4 rounded-xl bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="i-ph:rocket-launch text-purple-400 text-base shrink-0" />
                    <span className="text-xs font-semibold text-bolt-elements-textPrimary">
                      {t('appSettings.lastDeploy')}
                    </span>
                    {lastDeploy.deployedAt && (
                      <span className="text-[10px] text-bolt-elements-textTertiary ml-auto">
                        {new Date(lastDeploy.deployedAt).toLocaleDateString()}{' '}
                        {new Date(lastDeploy.deployedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <a
                    href={lastDeploy.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-purple-500/8 border border-purple-500/20 hover:bg-purple-500/15 transition-all group"
                  >
                    <div className="i-ph:globe text-purple-400 shrink-0" />
                    <span className="text-sm text-purple-300 font-mono truncate flex-1">{lastDeploy.url}</span>
                    <div className="i-ph:arrow-square-out text-purple-400 shrink-0 group-hover:text-purple-300 transition-colors" />
                  </a>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-bolt-elements-textTertiary uppercase font-semibold">
                      {lastDeploy.provider}
                    </span>
                    {lastDeploy.siteId && (
                      <span className="text-[10px] text-bolt-elements-textTertiary font-mono">
                        ID: {lastDeploy.siteId.slice(0, 12)}...
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Pre-deploy AI Configure Button */}
              <button
                onClick={() => {
                  const providerDetails: string[] = [];
                  if (netlifyToken.trim())
                    providerDetails.push(
                      `Netlify (token configurado, ${netlifySiteId ? 'site: ' + netlifySiteId : 'novo site'})`,
                    );
                  if (vercelToken.trim())
                    providerDetails.push(
                      `Vercel (token configurado, ${vercelProjectName ? 'projeto: ' + vercelProjectName : 'novo projeto'})`,
                    );
                  if (crProjectId.trim())
                    providerDetails.push(`Google Cloud Run (projeto: ${crProjectId}, regiao: ${crRegion})`);
                  if (providerDetails.length === 0) providerDetails.push('Netlify (chave padrao do servidor)');

                  window.dispatchEvent(
                    new CustomEvent('deploy-requested', {
                      detail: {
                        configuredProviders: providerDetails,
                        hasNetlify: !!netlifyToken.trim(),
                        hasVercel: !!vercelToken.trim(),
                        hasCloudRun: !!crProjectId.trim(),
                        netlifySiteId: netlifySiteId.trim(),
                        vercelProjectName: vercelProjectName.trim(),
                        cloudRunServiceName: crServiceName.trim(),
                        cloudRunRegion: crRegion,
                      },
                    }),
                  );
                  closeSettingsPanel();
                }}
                className="w-full py-3 px-4 bg-purple-500/10 text-purple-400 rounded-xl text-sm font-semibold border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center justify-center gap-2"
              >
                <div className="i-ph:brain-duotone text-base" />
                {t('appSettings.configureDeployWithAI')}
              </button>
            </div>
          )}

          {/* ====== DATABASE TAB ====== */}
          {tab === 'database' && (
            <div className="space-y-5">
              {/* Database Provider Selector */}
              <div>
                <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-3">
                  {t('appSettings.databaseProvider')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setDbType('none');
                      saveDatabaseSettings('none');
                    }}
                    className={`p-3 rounded-xl border text-center transition-all ${dbType === 'none' ? 'border-bolt-elements-borderColor bg-bolt-elements-item-backgroundActive ring-1 ring-purple-500/30' : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-item-backgroundActive'}`}
                  >
                    <div className="i-ph:prohibit text-xl mx-auto mb-1 text-bolt-elements-textTertiary" />
                    <span className="text-xs font-medium text-bolt-elements-textPrimary block">
                      {t('appSettings.none')}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setDbType('firebase');
                      saveDatabaseSettings('firebase');
                    }}
                    className={`p-3 rounded-xl border text-center transition-all ${dbType === 'firebase' ? 'border-amber-500 bg-amber-500/8 ring-1 ring-amber-500/30' : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-item-backgroundActive'}`}
                  >
                    <img
                      src="/logos/firebase.svg"
                      alt="Firebase"
                      className={`w-6 h-6 mx-auto mb-1 object-contain ${dbType === 'firebase' ? '' : 'opacity-40 grayscale'}`}
                    />
                    <span className="text-xs font-medium text-bolt-elements-textPrimary block">Firebase</span>
                  </button>
                  <button
                    onClick={() => {
                      setDbType('supabase');
                      saveDatabaseSettings('supabase');
                    }}
                    className={`p-3 rounded-xl border text-center transition-all ${dbType === 'supabase' ? 'border-emerald-500 bg-emerald-500/8 ring-1 ring-emerald-500/30' : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-item-backgroundActive'}`}
                  >
                    <img
                      src="/logos/supabase.svg"
                      alt="Supabase"
                      className={`w-6 h-6 mx-auto mb-1 object-contain ${dbType === 'supabase' ? '' : 'opacity-40 grayscale'}`}
                    />
                    <span className="text-xs font-medium text-bolt-elements-textPrimary block">Supabase</span>
                  </button>
                </div>
                <p className="text-[11px] text-bolt-elements-textTertiary mt-2">{t('appSettings.databaseAiDesc')}</p>
              </div>

              {dbType === 'none' && (
                <div className="text-center py-8">
                  <div className="i-ph:database text-4xl text-bolt-elements-textTertiary mx-auto mb-3" />
                  <p className="text-sm text-bolt-elements-textSecondary">{t('appSettings.noDatabase')}</p>
                  <p className="text-xs text-bolt-elements-textTertiary mt-1 max-w-xs mx-auto">
                    {t('appSettings.selectDbDesc')}
                  </p>
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
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                        {field.label}
                      </label>
                      <input
                        value={firebase[field.key]}
                        onChange={(e) => setFirebase({ ...firebase, [field.key]: e.target.value })}
                        onBlur={() => saveDatabaseSettings()}
                        placeholder={field.placeholder}
                        className={monoInputClass + ' focus:ring-amber-500/30 focus:border-amber-500/50'}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => saveDatabaseSettings()}
                    className="w-full py-3 px-4 bg-amber-500/12 text-amber-400 rounded-xl text-sm font-semibold border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2"
                  >
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
                    {
                      key: 'serviceRoleKey' as const,
                      label: 'Service Role Key',
                      placeholder: 'eyJhbGciOi... (secret)',
                    },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">
                        {field.label}
                        {field.key === 'serviceRoleKey' && (
                          <span className="text-red-400 ml-1.5 normal-case">{t('appSettings.secret')}</span>
                        )}
                      </label>
                      <input
                        value={supabase[field.key]}
                        onChange={(e) => setSupabase({ ...supabase, [field.key]: e.target.value })}
                        onBlur={() => saveDatabaseSettings()}
                        placeholder={field.placeholder}
                        type={field.key === 'serviceRoleKey' ? 'password' : 'text'}
                        className={monoInputClass + ' focus:ring-emerald-500/30 focus:border-emerald-500/50'}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => saveDatabaseSettings()}
                    className="w-full py-3 px-4 bg-emerald-500/12 text-emerald-400 rounded-xl text-sm font-semibold border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <div className="i-ph:floppy-disk text-base" /> {t('appSettings.saveSupabaseConfig')}
                  </button>
                </div>
              )}

              {/* AI Database Capabilities Info */}
              {dbType !== 'none' && (
                <div className="border-t border-bolt-elements-borderColor pt-4">
                  <h4 className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">
                    {t('appSettings.aiDbCapabilities')}
                  </h4>
                  <div className="space-y-1.5">
                    {[
                      { icon: 'i-ph:table', text: t('appSettings.aiDbCrud') },
                      { icon: 'i-ph:code', text: t('appSettings.aiDbSdk') },
                      { icon: 'i-ph:download-simple', text: t('appSettings.aiDbPackages') },
                      { icon: 'i-ph:shield-check', text: t('appSettings.aiDbSecure') },
                    ].map((item) => (
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
                    <EnvVarRow
                      key={env.key + '-' + index}
                      env={env}
                      index={index}
                      onUpdate={updateEnvVar}
                      onRemove={removeEnvVar}
                    />
                  ))}
                </div>
              )}
              {envVars.length === 0 && (
                <div className="text-center py-8">
                  <div className="i-ph:key text-3xl text-bolt-elements-textTertiary mx-auto mb-2" />
                  <p className="text-sm text-bolt-elements-textTertiary">{t('appSettings.noEnvVars')}</p>
                </div>
              )}
              <div className="p-3 bg-bolt-elements-background-depth-1 rounded-lg border border-dashed border-bolt-elements-borderColor space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value)}
                    placeholder="KEY"
                    onKeyDown={(e) => e.key === 'Enter' && addEnvVar()}
                    className="flex-[1] min-w-0 px-3 py-2 rounded-md text-sm font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:border-purple-500/50"
                  />
                  <span className="text-bolt-elements-textTertiary text-sm shrink-0">=</span>
                  <input
                    value={newEnvValue}
                    onChange={(e) => setNewEnvValue(e.target.value)}
                    placeholder={t('appSettings.value')}
                    onKeyDown={(e) => e.key === 'Enter' && addEnvVar()}
                    className="flex-[3] min-w-0 px-3 py-2 rounded-md text-sm font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textSecondary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    onClick={addEnvVar}
                    disabled={!newEnvKey.trim() || !newEnvValue.trim()}
                    className="px-3 py-2 bg-purple-500/15 text-purple-400 rounded-md hover:bg-purple-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
                  >
                    <div className="i-ph:plus text-lg" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ====== SECURITY TAB ====== */}
          {tab === 'security' && (
            <SecurityTestTab
              onRunTest={(prompt) => {
                window.dispatchEvent(new CustomEvent('security-test-requested', { detail: { prompt } }));
                closeSettingsPanel();
                toast.info(t('settings.securityTestSent'));
              }}
            />
          )}

          {/* ====== AI RULES TAB ====== */}
          {tab === 'rules' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <div className="i-ph:brain-duotone text-amber-400 text-base" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-bolt-elements-textPrimary">
                    {t('appSettings.customAiInstructions')}
                  </h3>
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
                  <span className="text-[11px] text-bolt-elements-textTertiary">
                    {customRules.length} {t('appSettings.characters')}
                  </span>
                  {customRules.length > 0 && (
                    <button
                      onClick={() => {
                        setCustomRules('');
                        updateActiveProjectSettings({ customRules: '' });
                        toast.info(t('appSettings.aiRulesCleared'));
                      }}
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
              <button
                onClick={saveSnapshot}
                className="w-full py-3 px-4 bg-purple-500/12 text-purple-400 rounded-xl text-sm font-semibold border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center justify-center gap-2"
              >
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
                  {snapshots.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 p-3 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor group"
                    >
                      <div className="i-ph:clock text-bolt-elements-textTertiary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">{s.name}</div>
                        <div className="text-[11px] text-bolt-elements-textTertiary">
                          {new Date(s.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => restoreSnapshot(s.id)}
                          className="px-2.5 py-1.5 text-[11px] font-medium text-purple-400 bg-purple-500/10 rounded-md hover:bg-purple-500/20 transition-all"
                        >
                          {t('appSettings.restore')}
                        </button>
                        <button
                          onClick={() => deleteSnapshot(s.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-300 transition-all"
                        >
                          <div className="i-ph:trash text-sm" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* End modal */}
    </div>
  );
}

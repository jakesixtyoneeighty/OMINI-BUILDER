import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { activeProjectIdStore, projectsStore, updateActiveProjectSettings, type EnvVar, type PreviewMode } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';

const TABS = [
  { id: 'general' as const, label: 'General', icon: 'i-ph:gear-six' },
  { id: 'preview' as const, label: 'Preview', icon: 'i-ph:eye' },
  { id: 'deploy' as const, label: 'Deploy', icon: 'i-ph:rocket-launch-duotone' },
  { id: 'env' as const, label: 'Env Vars', icon: 'i-ph:key' },
  { id: 'versions' as const, label: 'Snapshots', icon: 'i-ph:clock-counter-clockwise' },
];

export function AppSettingsDialog({ open, onClose, defaultTab }: { open: boolean; onClose: () => void; defaultTab?: string }) {
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[activeId];
  const settings = project?.settings;
  const [tab, setTab] = useState<typeof TABS[number]['id']>((defaultTab as any) || 'general');
  const [snapshots, setSnapshots] = useState<{ id: number; name: string; timestamp: string }[]>([]);
  const [envVars, setEnvVars] = useState<EnvVar[]>(settings?.envVars || []);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [projectName, setProjectName] = useState(project?.name || '');
  const [projectDesc, setProjectDesc] = useState(settings?.description || '');
  const currentPreviewMode: PreviewMode = settings?.previewMode || 'webcontainer';
  const [netlifyToken, setNetlifyToken] = useState(settings?.netlify?.token || '');
  const [netlifySiteId, setNetlifySiteId] = useState(settings?.netlify?.siteId || '');
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ url: string; siteId: string } | null>(null);

  useEffect(() => {
    if (open) {
      if (defaultTab) setTab(defaultTab as any);
      const saved = localStorage.getItem(`bolt.snapshots.${activeId}`);
      if (saved) setSnapshots(JSON.parse(saved));
      setProjectName(project?.name || '');
      setProjectDesc(settings?.description || '');
      setEnvVars(settings?.envVars || []);
      setNetlifyToken(settings?.netlify?.token || '');
      setNetlifySiteId(settings?.netlify?.siteId || '');
      setDeployResult(null);
    }
  }, [open, activeId, project, settings]);

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
    toast.success('Snapshot saved!');
  };

  const restoreSnapshot = (id: number) => {
    const data = localStorage.getItem(`bolt.snapshot.data.${id}`);
    if (data) {
      const files = JSON.parse(data);
      workbenchStore.files.set(files);
      toast.success('Snapshot restored!');
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
        toast.success('Logo updated!');
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
      toast.success('Environment variable added!');
    }
  };

  const removeEnvVar = (index: number) => {
    const updated = envVars.filter((_, i) => i !== index);
    setEnvVars(updated);
    updateActiveProjectSettings({ envVars: updated });
  };

  const saveProjectInfo = () => {
    updateActiveProjectSettings({ name: projectName, description: projectDesc });
    toast.success('Project info saved!');
  };

  const saveNetlifySettings = () => {
    updateActiveProjectSettings({ netlify: { token: netlifyToken.trim(), siteId: netlifySiteId.trim() } });
    toast.success('Netlify settings saved!');
  };

  const deployToNetlify = async () => {
    if (!netlifyToken.trim()) {
      toast.error('Netlify token is required');
      return;
    }
    setDeploying(true);
    try {
      await workbenchStore.saveAllFiles();
      const files = workbenchStore.files.get();
      const fileList = Object.entries(files)
        .filter(([_, f]) => f?.type === 'file' && !f.isBinary)
        .map(([path, f]) => ({ path: path.replace(/^\/+/, ''), content: (f as any).content }));

      const res = await fetch('/api/netlify-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: netlifyToken.trim(), siteId: netlifySiteId.trim() || undefined, files: fileList }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Deploy failed');
      }
      const data = await res.json();
      setDeployResult({ url: data.url, siteId: data.siteId });
      if (data.siteId) {
        updateActiveProjectSettings({ netlify: { token: netlifyToken.trim(), siteId: data.siteId } });
        setNetlifySiteId(data.siteId);
      }
      toast.success('Deployed to Netlify!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-[750px] max-w-[95vw] bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl shadow-2xl flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[200px] bg-bolt-elements-background-depth-1 border-r border-bolt-elements-borderColor flex flex-col">
          {/* Project badge */}
          <div className="p-4 border-b border-bolt-elements-borderColor">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                <div className="i-ph:folder-open text-purple-400 text-lg" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-bolt-elements-textPrimary truncate">{projectName || 'Untitled'}</div>
                <div className="text-[11px] text-bolt-elements-textTertiary truncate">{activeId !== 'default' ? activeId.slice(0, 12) + '...' : 'Default'}</div>
              </div>
            </div>
          </div>
          {/* Tabs */}
          <nav className="flex-1 p-2 space-y-0.5">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2.5 ${
                  tab === t.id
                    ? 'bg-purple-500/12 text-purple-400'
                    : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary'
                }`}
              >
                <div className={`${t.icon} text-base`} />
                {t.label}
              </button>
            ))}
          </nav>
          {/* Footer */}
          <div className="p-3 border-t border-bolt-elements-borderColor">
            <div className="text-[10px] text-bolt-elements-textTertiary text-center">
              Omni-Builder v1.0
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-bolt-elements-borderColor shrink-0">
            <div>
              <h2 className="text-base font-bold text-bolt-elements-textPrimary">
                {TABS.find(t => t.id === tab)?.label}
              </h2>
              <p className="text-xs text-bolt-elements-textTertiary mt-0.5">
                {tab === 'general' && 'Project name, description and branding'}
                {tab === 'preview' && 'Choose how your project preview works'}
                {tab === 'deploy' && 'Configure deployment providers and tokens'}
                {tab === 'env' && 'Manage environment variables for your project'}
                {tab === 'versions' && 'Save and restore project snapshots'}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all">
              <div className="i-ph:x text-lg" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6">
            {tab === 'general' && (
              <div className="space-y-5">
                {/* Project Name */}
                <div>
                  <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">Project Name</label>
                  <input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onBlur={saveProjectInfo}
                    placeholder="My Awesome Project"
                    className="w-full px-4 py-2.5 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all placeholder:text-bolt-elements-textTertiary"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    onBlur={saveProjectInfo}
                    placeholder="A brief description of your project..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all resize-none placeholder:text-bolt-elements-textTertiary"
                  />
                </div>

                {/* Logo Upload */}
                <div>
                  <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">App Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-bolt-elements-background-depth-1 rounded-xl border-2 border-dashed border-bolt-elements-borderColor flex items-center justify-center overflow-hidden shrink-0">
                      {settings?.logo ? (
                        <img src={settings.logo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <div className="i-ph:image text-2xl text-bolt-elements-textTertiary" />
                          <span className="text-[9px] text-bolt-elements-textTertiary">No logo</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-bolt-elements-borderColor cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group">
                        <div className="i-ph:upload-simple text-lg text-bolt-elements-textTertiary group-hover:text-purple-400 transition-colors" />
                        <span className="text-sm text-bolt-elements-textSecondary group-hover:text-purple-400 transition-colors">Upload Image</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1.5 text-center">PNG, JPG, SVG up to 2MB</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'preview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {([
                    { mode: 'webcontainer' as const, icon: 'i-ph:cube-duotone', title: 'WebContainer', color: 'blue', desc: 'Full preview with terminal and real server. Requires COOP/COEP headers on your hosting.' },
                    { mode: 'sandpack' as const, icon: 'i-ph:browser-duotone', title: 'Sandpack', color: 'amber', desc: 'Fast in-browser HTML/CSS/JS preview. No special headers needed. Works anywhere.' },
                    { mode: 'iframe' as const, icon: 'i-ph:code-duotone', title: 'Iframe SrcDoc', color: 'green', desc: 'Lightweight srcdoc iframe that renders your HTML directly. Minimal overhead.' },
                    { mode: 'newtab' as const, icon: 'i-ph:arrow-square-out-duotone', title: 'New Tab', color: 'pink', desc: 'Opens your project in a new browser tab as a standalone page.' },
                  ]).map(option => {
                    const isActive = currentPreviewMode === option.mode;
                    const activeColorMap: Record<string, string> = {
                      blue: 'border-blue-500 bg-blue-500/8 ring-1 ring-blue-500/40',
                      amber: 'border-amber-500 bg-amber-500/8 ring-1 ring-amber-500/40',
                      green: 'border-green-500 bg-green-500/8 ring-1 ring-green-500/40',
                      pink: 'border-pink-500 bg-pink-500/8 ring-1 ring-pink-500/40',
                    };
                    const iconBgActive: Record<string, string> = {
                      blue: 'bg-blue-500/20', amber: 'bg-amber-500/20', green: 'bg-green-500/20', pink: 'bg-pink-500/20',
                    };
                    const iconColorActive: Record<string, string> = {
                      blue: 'text-blue-400', amber: 'text-amber-400', green: 'text-green-400', pink: 'text-pink-400',
                    };
                    const badgeColor: Record<string, string> = {
                      blue: 'bg-blue-500/20 text-blue-400', amber: 'bg-amber-500/20 text-amber-400',
                      green: 'bg-green-500/20 text-green-400', pink: 'bg-pink-500/20 text-pink-400',
                    };
                    const checkColor: Record<string, string> = {
                      blue: 'text-blue-400', amber: 'text-amber-400', green: 'text-green-400', pink: 'text-pink-400',
                    };

                    return (
                      <button
                        key={option.mode}
                        onClick={() => {
                          updateActiveProjectSettings({ previewMode: option.mode });
                          toast.success(`${option.title} mode activated!`);
                        }}
                        className={`relative w-full p-4 rounded-xl border text-left transition-all group ${
                          isActive
                            ? activeColorMap[option.color]
                            : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:border-bolt-elements-borderColor hover:bg-bolt-elements-item-backgroundActive'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive ? iconBgActive[option.color] : 'bg-bolt-elements-background-depth-2'
                          }`}>
                            <div className={`${option.icon} text-xl ${isActive ? iconColorActive[option.color] : 'text-bolt-elements-textTertiary'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold text-sm ${isActive ? iconColorActive[option.color] : 'text-bolt-elements-textPrimary'}`}>
                                {option.title}
                              </span>
                              {isActive && (
                                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${badgeColor[option.color]} uppercase tracking-wider`}>
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-bolt-elements-textTertiary mt-0.5 leading-relaxed">{option.desc}</p>
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

            {tab === 'deploy' && (
              <div className="space-y-5">
                {/* Netlify Section */}
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center shrink-0">
                      <div className="i-ph:cloud-arrow-up text-teal-400 text-base" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-bolt-elements-textPrimary">Netlify</h3>
                      <p className="text-[11px] text-bolt-elements-textTertiary">Deploy your site to Netlify</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">Personal Access Token</label>
                      <input
                        value={netlifyToken}
                        onChange={(e) => setNetlifyToken(e.target.value)}
                        onBlur={saveNetlifySettings}
                        placeholder="ntfy_..."
                        type="password"
                        className="w-full px-4 py-2.5 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all placeholder:text-bolt-elements-textTertiary font-mono"
                      />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">
                        Create a token at <span className="text-teal-400">app.netlify.com/user/applications#personal-access-tokens</span>
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-1.5">Site ID (optional)</label>
                      <input
                        value={netlifySiteId}
                        onChange={(e) => setNetlifySiteId(e.target.value)}
                        onBlur={saveNetlifySettings}
                        placeholder="Leave empty to create a new site"
                        className="w-full px-4 py-2.5 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all placeholder:text-bolt-elements-textTertiary font-mono"
                      />
                      <p className="text-[11px] text-bolt-elements-textTertiary mt-1">
                        If empty, a new site will be created. If set, the existing site will be updated.
                      </p>
                    </div>
                    <button
                      onClick={deployToNetlify}
                      disabled={deploying || !netlifyToken.trim()}
                      className="w-full py-3 px-4 bg-teal-500/12 text-teal-400 rounded-xl text-sm font-semibold border border-teal-500/20 hover:bg-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      {deploying ? (
                        <><div className="i-svg-spinners:90-ring-with-bg text-base" /> Deploying...</>
                      ) : (
                        <><div className="i-ph:rocket-launch text-base" /> Deploy to Netlify</>
                      )}
                    </button>
                    {deployResult && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/8 border border-green-500/20">
                        <div className="i-ph:check-circle-fill text-green-400 text-lg shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-green-400">Deployed successfully!</p>
                          <a href={deployResult.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 hover:underline truncate block">
                            {deployResult.url}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Vercel Section */}
                <div className="border-t border-bolt-elements-borderColor pt-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <div className="i-ph:triangle text-bolt-elements-textPrimary text-base" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-bolt-elements-textPrimary">Vercel</h3>
                      <p className="text-[11px] text-bolt-elements-textTertiary">Coming soon</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-dashed border-bolt-elements-borderColor text-center">
                    <p className="text-xs text-bolt-elements-textTertiary">Vercel integration is under development. Use the GitHub push button to deploy via Vercel for now.</p>
                  </div>
                </div>
              </div>
            )}

            {tab === 'env' && (
              <div className="space-y-4">
                {envVars.length > 0 && (
                  <div className="space-y-2">
                    {envVars.map((env, index) => (
                      <div key={index} className="flex items-center gap-2 px-3 py-2.5 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor group">
                        <div className="i-ph:key text-bolt-elements-textTertiary text-sm shrink-0" />
                        <span className="font-mono text-sm text-bolt-elements-textPrimary font-medium">{env.key}</span>
                        <span className="text-bolt-elements-textTertiary text-sm">=</span>
                        <span className="font-mono text-sm text-bolt-elements-textSecondary truncate flex-1">{env.value}</span>
                        <button onClick={() => removeEnvVar(index)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all p-1">
                          <div className="i-ph:trash text-sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {envVars.length === 0 && (
                  <div className="text-center py-8">
                    <div className="i-ph:key text-3xl text-bolt-elements-textTertiary mx-auto mb-2" />
                    <p className="text-sm text-bolt-elements-textTertiary">No environment variables yet</p>
                  </div>
                )}
                <div className="flex gap-2 p-3 bg-bolt-elements-background-depth-1 rounded-lg border border-dashed border-bolt-elements-borderColor">
                  <input
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value)}
                    placeholder="KEY"
                    onKeyDown={(e) => e.key === 'Enter' && addEnvVar()}
                    className="flex-1 px-3 py-2 rounded-md text-sm font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:border-purple-500/50"
                  />
                  <input
                    value={newEnvValue}
                    onChange={(e) => setNewEnvValue(e.target.value)}
                    placeholder="value"
                    onKeyDown={(e) => e.key === 'Enter' && addEnvVar()}
                    className="flex-1 px-3 py-2 rounded-md text-sm font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textSecondary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    onClick={addEnvVar}
                    disabled={!newEnvKey.trim() || !newEnvValue.trim()}
                    className="px-3 py-2 bg-purple-500/15 text-purple-400 rounded-md hover:bg-purple-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <div className="i-ph:plus text-lg" />
                  </button>
                </div>
              </div>
            )}

            {tab === 'versions' && (
              <div className="space-y-4">
                <button
                  onClick={saveSnapshot}
                  className="w-full py-3 px-4 bg-purple-500/12 text-purple-400 rounded-xl text-sm font-semibold border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <div className="i-ph:camera text-base" />
                  Create Snapshot
                </button>
                {snapshots.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="i-ph:clock-counter-clockwise text-3xl text-bolt-elements-textTertiary mx-auto mb-2" />
                    <p className="text-sm text-bolt-elements-textTertiary">No snapshots yet</p>
                    <p className="text-xs text-bolt-elements-textTertiary mt-1">Create a snapshot to save the current state of your project</p>
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
                          <button
                            onClick={() => restoreSnapshot(s.id)}
                            className="px-2.5 py-1.5 text-[11px] font-medium text-purple-400 bg-purple-500/10 rounded-md hover:bg-purple-500/20 transition-all"
                          >
                            Restore
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
        </main>
      </div>
    </div>
  );
}

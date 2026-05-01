import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { activeProjectIdStore, projectsStore, updateActiveProjectSettings, type EnvVar, type PreviewMode } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';

const TABS = [
  { id: 'general' as const, label: 'General', icon: 'i-ph:gear-six' },
  { id: 'preview' as const, label: 'Preview', icon: 'i-ph:eye' },
  { id: 'env' as const, label: 'Env Vars', icon: 'i-ph:key' },
  { id: 'versions' as const, label: 'Snapshots', icon: 'i-ph:clock-counter-clockwise' },
];

export function AppSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[activeId];
  const settings = project?.settings;
  const [tab, setTab] = useState<typeof TABS[number]['id']>('general');
  const [snapshots, setSnapshots] = useState<{ id: number; name: string; timestamp: string }[]>([]);
  const [envVars, setEnvVars] = useState<EnvVar[]>(settings?.envVars || []);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [projectName, setProjectName] = useState(project?.name || '');
  const [projectDesc, setProjectDesc] = useState(settings?.description || '');
  const currentPreviewMode: PreviewMode = settings?.previewMode || 'webcontainer';

  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem(`bolt.snapshots.${activeId}`);
      if (saved) setSnapshots(JSON.parse(saved));
      setProjectName(project?.name || '');
      setProjectDesc(settings?.description || '');
      setEnvVars(settings?.envVars || []);
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
                    { mode: 'webcontainer' as const, icon: 'i-ph:cube-duotone', title: 'WebContainer', desc: 'Full preview with terminal and real server. Requires COOP/COEP headers on your hosting.' },
                    { mode: 'sandpack' as const, icon: 'i-ph:browser-duotone', title: 'Sandpack', desc: 'Fast in-browser preview powered by CodeSandbox. No special headers needed. Works anywhere.' },
                  ]).map(option => (
                    <button
                      key={option.mode}
                      onClick={() => {
                        updateActiveProjectSettings({ previewMode: option.mode });
                        toast.success(`${option.title} mode activated!`);
                      }}
                      className={`relative w-full p-4 rounded-xl border text-left transition-all group ${
                        currentPreviewMode === option.mode
                          ? 'border-purple-500 bg-purple-500/8 ring-1 ring-purple-500/40'
                          : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:border-purple-500/30 hover:bg-purple-500/5'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          currentPreviewMode === option.mode ? 'bg-purple-500/20' : 'bg-bolt-elements-background-depth-2'
                        }`}>
                          <div className={`${option.icon} text-xl ${currentPreviewMode === option.mode ? 'text-purple-400' : 'text-bolt-elements-textTertiary'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold text-sm ${currentPreviewMode === option.mode ? 'text-purple-300' : 'text-bolt-elements-textPrimary'}`}>
                              {option.title}
                            </span>
                            {currentPreviewMode === option.mode && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/20 text-purple-400 uppercase tracking-wider">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-bolt-elements-textTertiary mt-0.5 leading-relaxed">{option.desc}</p>
                        </div>
                        {currentPreviewMode === option.mode && (
                          <div className="i-ph:check-circle-fill text-purple-400 text-xl shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
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

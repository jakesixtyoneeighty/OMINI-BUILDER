import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { activeProjectIdStore, projectsStore, updateActiveProjectSettings, type EnvVar } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';

export function AppSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[activeId];
  const [tab, setTab] = useState<'general' | 'env' | 'versions'>('general');
  const [snapshots, setSnapshots] = useState<{ id: number; name: string; timestamp: string }[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [envVars, setEnvVars] = useState<EnvVar[]>(project.settings.envVars || []);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(`bolt.snapshots.${activeId}`);
    if (saved) setSnapshots(JSON.parse(saved));
  }, [activeId]);

  const saveSnapshot = () => {
    const files = workbenchStore.files.get();
    const snapshot = {
      id: Date.now(),
      name: `Versão ${new Date().toLocaleString()}`,
      timestamp: new Date().toISOString(),
      files: { ...files }
    };
    const newSnapshots = [...snapshots, { id: snapshot.id, name: snapshot.name, timestamp: snapshot.timestamp }];
    localStorage.setItem(`bolt.snapshots.${activeId}`, JSON.stringify(newSnapshots));
    localStorage.setItem(`bolt.snapshot.data.${snapshot.id}`, JSON.stringify(snapshot.files));
    setSnapshots(newSnapshots);
    toast.success('Snapshot salvo!');
  };

  const restoreSnapshot = (id: number) => {
    const data = localStorage.getItem(`bolt.snapshot.data.${id}`);
    if (data) {
      const files = JSON.parse(data);
      workbenchStore.files.set(files);
      toast.success('Versão restaurada!');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const logoUrl = e.target?.result as string;
        updateActiveProjectSettings({ logo: logoUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  const addEnvVar = () => {
    if (newEnvKey.trim() && newEnvValue.trim()) {
      setEnvVars([...envVars, { key: newEnvKey.trim(), value: newEnvValue.trim() }]);
      setNewEnvKey('');
      setNewEnvValue('');
    }
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const saveEnvVars = () => {
    updateActiveProjectSettings({ envVars });
    toast.success('Variáveis de ambiente salvas!');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-[700px] h-[500px] bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl flex overflow-hidden">
        <aside className="w-48 bg-bolt-elements-background-depth-1 border-r border-bolt-elements-borderColor p-4 space-y-2">
          {['general', 'env', 'versions'].map(t => (
            <button 
              key={t} 
              onClick={() => setTab(t as any)} 
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t 
                  ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent' 
                  : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </aside>
        <main className="flex-1 p-6 overflow-y-auto">
          {tab === 'general' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-bolt-elements-textPrimary">Geral</h2>
              <input 
                value={project?.name || ''} 
                onChange={(e) => updateActiveProjectSettings({ name: e.target.value })}
                placeholder="Nome do Projeto" 
                className="w-full p-3 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg" 
              />
              <textarea 
                value={project?.settings.description || ''} 
                onChange={(e) => updateActiveProjectSettings({ description: e.target.value })}
                placeholder="Descrição" 
                className="w-full p-3 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg h-32" 
              />
              <div>
                <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-2">Logo do App</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-bolt-elements-background-depth-1 rounded-lg flex items-center justify-center">
                    {project.settings.logo ? (
                      <img src={project.settings.logo} alt="Logo" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <div className="i-ph:image text-2xl text-bolt-elements-textTertiary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoUpload} 
                      className="w-full text-sm p-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg"
                    />
                    <p className="text-xs text-bolt-elements-textTertiary mt-1">PNG, JPG, SVG até 2MB</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tab === 'env' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-bolt-elements-textPrimary">Variáveis de Ambiente</h2>
              <div className="space-y-2">
                {envVars.map((env, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-bolt-elements-background-depth-1 rounded">
                    <span className="font-mono text-sm">{env.key}</span>
                    <span className="text-bolt-elements-textTertiary">=</span>
                    <span className="font-mono text-sm">{env.value}</span>
                    <button onClick={() => removeEnvVar(index)} className="ml-auto text-red-500">
                      <div className="i-ph:x" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input 
                    value={newEnvKey} 
                    onChange={(e) => setNewEnvKey(e.target.value)}
                    placeholder="CHAVE" 
                    className="flex-1 p-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded text-sm font-mono" 
                  />
                  <input 
                    value={newEnvValue} 
                    onChange={(e) => setNewEnvValue(e.target.value)}
                    placeholder="valor" 
                    className="flex-1 p-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded text-sm font-mono" 
                  />
                  <button onClick={addEnvVar} className="px-3 py-2 bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent rounded">
                    <div className="i-ph:plus" />
                  </button>
                </div>
              </div>
              <button onClick={saveEnvVars} className="w-full py-2 bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent rounded-lg text-sm font-bold">
                Salvar Variáveis
              </button>
            </div>
          )}
          {tab === 'versions' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-bolt-elements-textPrimary">Snapshots</h2>
              <button onClick={saveSnapshot} className="w-full py-2 bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent rounded-lg text-sm font-bold">
                Criar Snapshot Atual
              </button>
              <div className="space-y-2">
                {snapshots.map(s => (
                  <div key={s.id} className="flex justify-between items-center p-2 bg-bolt-elements-background-depth-1 rounded">
                    <div>
                      <span className="text-sm font-medium">{s.name}</span>
                      <div className="text-xs text-bolt-elements-textTertiary">{new Date(s.timestamp).toLocaleString()}</div>
                    </div>
                    <button onClick={() => restoreSnapshot(s.id)} className="text-xs text-bolt-elements-item-contentAccent">Restaurar</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
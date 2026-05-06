import { useStore } from '@nanostores/react';
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { projectsStore, activeProjectIdStore, updateActiveProjectSettings } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { authStore, supabaseEnabled } from '~/lib/stores/auth';
import { autosaveDbEnabled, toggleAutosaveDb } from '~/lib/stores/auto-save';
import { AuthDialog } from './AuthDialog.client';

export const SaveProjectButton = memo(function SaveProjectButton() {
  const projects = useStore(projectsStore);
  const activeId = useStore(activeProjectIdStore);
  const { user } = useStore(authStore);
  const autoSaveOn = useStore(autosaveDbEnabled);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const currentProject = projects[activeId];

  // Don't show if no project active
  if (!activeId || activeId === 'default') {
    return null;
  }

  // The actual save function used by both manual and auto save
  const doSave = useCallback(async () => {
    const pid = activeProjectIdStore.get();
    if (pid === 'default') return;
    const proj = projectsStore.get()[pid];
    if (!proj) return;

    const settings = {
      ...proj.settings,
      name: proj.name || 'Untitled Project',
      description: proj.settings?.description || '',
      envVars: proj.settings?.envVars || [],
      github: {
        token: proj.settings?.github?.token || '',
        repo: proj.settings?.github?.repo || '',
        branch: proj.settings?.github?.branch || 'main',
      },
    };
    await updateActiveProjectSettings(settings);
    await workbenchStore.saveEntireProject();
    setLastSaved(new Date());
  }, []);

  // Auto-save timer: runs only when logged in + toggle on
  useEffect(() => {
    if (!user || !autoSaveOn || !activeId || activeId === 'default') {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    autoSaveTimerRef.current = setInterval(async () => {
      try {
        setAutoSaving(true);
        await doSave();
      } catch {
        // silent
      } finally {
        setAutoSaving(false);
      }
    }, 30000); // every 30 seconds

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [user, autoSaveOn, activeId, doSave]);

  const handleSave = useCallback(async () => {
    if (!user && supabaseEnabled) {
      setShowAuthDialog(true);
      return;
    }

    if (!user) {
      toast.error('Faca login para salvar seu projeto na nuvem.');
      return;
    }

    setSaving(true);
    try {
      await doSave();
      toast.success('Projeto salvo na nuvem!');
    } catch (error) {
      toast.error(`Erro ao salvar: ${error instanceof Error ? error.message : error}`);
    } finally {
      setSaving(false);
    }
  }, [user, doSave]);

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Auto-save toggle */}
        <button
          onClick={() => {
            if (!user && supabaseEnabled) {
              setShowAuthDialog(true);
              return;
            }
            toggleAutosaveDb();
            toast.info(autosaveDbEnabled.get() ? 'Auto-save desligado' : 'Auto-save ligado (30s)');
          }}
          className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all ${
            autoSaveOn && user
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/20'
              : 'text-bolt-elements-textTertiary bg-bolt-elements-item-backgroundActive border-bolt-elements-borderColor hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundAccent'
          }`}
          title={autoSaveOn && user ? 'Auto-save ligado (30s)' : 'Auto-save desligado'}
        >
          <div className={autoSaveOn && user ? 'i-ph:cloud-arrow-up-fill text-base' : 'i-ph:cloud-arrow-up text-base'} />
        </button>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || autoSaving}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all text-xs font-medium shadow-sm"
          title={lastSaved ? `Salvo ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : user ? 'Salvar na nuvem' : 'Login para salvar'}
        >
          {saving || autoSaving ? (
            <div className="i-svg-spinners:90-ring-with-bg text-sm" />
          ) : lastSaved ? (
            <div className="i-ph:cloud-check text-sm" />
          ) : (
            <div className="i-ph:cloud-arrow-up-duotone text-sm" />
          )}
          <span className="hidden sm:inline">{saving ? 'Salvando...' : autoSaving ? 'Auto-saving...' : 'Salvar'}</span>
        </button>
      </div>

      <AuthDialog open={showAuthDialog} onClose={() => setShowAuthDialog(false)} />
    </>
  );
});

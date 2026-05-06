import { useStore } from '@nanostores/react';
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { projectsStore, activeProjectIdStore, updateActiveProjectSettings } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { authStore, supabaseEnabled } from '~/lib/stores/auth';
import { AuthDialog } from './AuthDialog.client';

export const SaveProjectButton = memo(function SaveProjectButton() {
  const projects = useStore(projectsStore);
  const activeId = useStore(activeProjectIdStore);
  const { user } = useStore(authStore);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const currentProject = projects[activeId];

  // Don't show if no project active
  if (!activeId || activeId === 'default') {
    return null;
  }

  // Auto-save every 60s when logged in
  useEffect(() => {
    if (!user || !activeId || activeId === 'default') {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    autoSaveTimerRef.current = setInterval(async () => {
      try {
        await workbenchStore.saveAllFiles();
        setLastSaved(new Date());
      } catch {
        // silent auto-save fail
      }
    }, 60000);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [user, activeId]);

  const handleSave = useCallback(async () => {
    // Prompt login if not authenticated
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
      const newSettings = {
        ...currentProject.settings,
        name: currentProject.name || 'Untitled Project',
        description: currentProject.settings?.description || '',
        envVars: currentProject.settings?.envVars || [],
        github: {
          token: currentProject.settings?.github?.token || '',
          repo: currentProject.settings?.github?.repo || '',
          branch: currentProject.settings?.github?.branch || 'main',
        },
      };

      await updateActiveProjectSettings(newSettings);
      await workbenchStore.saveEntireProject();

      setLastSaved(new Date());
      toast.success('Projeto salvo na nuvem!');
    } catch (error) {
      toast.error(`Erro ao salvar: ${error instanceof Error ? error.message : error}`);
    } finally {
      setSaving(false);
    }
  }, [currentProject, user]);

  return (
    <>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all text-xs font-medium shadow-sm"
        title={lastSaved ? `Salvo ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : user ? 'Salvar na nuvem' : 'Login para salvar'}
      >
        {saving ? (
          <div className="i-svg-spinners:90-ring-with-bg text-sm" />
        ) : lastSaved ? (
          <div className="i-ph:cloud-check text-sm" />
        ) : (
          <div className="i-ph:cloud-arrow-up-duotone text-sm" />
        )}
        <span className="hidden sm:inline">{saving ? 'Salvando...' : 'Salvar'}</span>
      </button>

      <AuthDialog open={showAuthDialog} onClose={() => setShowAuthDialog(false)} />
    </>
  );
});

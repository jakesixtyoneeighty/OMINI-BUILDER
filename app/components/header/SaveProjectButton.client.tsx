import { useStore } from '@nanostores/react';
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { projectsStore, activeProjectIdStore, updateActiveProjectSettings } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { authStore, supabaseEnabled } from '~/lib/stores/auth';
import { autosaveDbEnabled, toggleAutosaveDb } from '~/lib/stores/auto-save';
import { AuthDialog } from './AuthDialog.client';
import { useT } from '~/lib/i18n/useT';

export const SaveProjectButton = memo(function SaveProjectButton() {
  const t = useT();
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

  // Don't render if user is not logged in (no point showing save button)

  // The actual save function used by both manual and auto save
  const doSave = useCallback(async () => {
    const pid = activeProjectIdStore.get();

    // If project is still "default", create it in Supabase first
    if (pid === 'default') {
      const proj = projectsStore.get()[pid];
      const projectName = proj?.name || t('projectName.untitledProject');
      await updateActiveProjectSettings({ name: projectName });
      // After this, activeProjectIdStore should now have a UUID
    }

    const newPid = activeProjectIdStore.get();
    if (newPid === 'default') return;
    const proj = projectsStore.get()[newPid];
    if (!proj) return;

    const settings = {
      ...proj.settings,
      name: proj.name || t('projectName.untitledProject'),
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
    if (!user || !autoSaveOn) {
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
  }, [user, autoSaveOn, doSave]);

  const handleSave = useCallback(async () => {
    if (!user && supabaseEnabled) {
      setShowAuthDialog(true);
      return;
    }

    if (!user) {
      toast.error(t('saveProject.loginToSave'));
      return;
    }

    setSaving(true);
    try {
      await doSave();
      toast.success(t('saveProject.savedToCloud'));
    } catch (error) {
      toast.error(`${t('saveProject.errorSaving')} ${error instanceof Error ? error.message : error}`);
    } finally {
      setSaving(false);
    }
  }, [user, doSave]);

  // Don't render if no user — AFTER all hooks
  if (!user) {
    return null;
  }

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
            toast.info(autosaveDbEnabled.get() ? t('saveProject.autoSaveOff') : t('saveProject.autoSaveOn'));
          }}
          className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all ${
            autoSaveOn && user
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/20'
              : 'text-bolt-elements-textTertiary bg-bolt-elements-item-backgroundActive border-bolt-elements-borderColor hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundAccent'
          }`}
          title={autoSaveOn && user ? t('saveProject.autoSaveOn') : t('saveProject.autoSaveOff')}
        >
          <div className={autoSaveOn && user ? 'i-ph:cloud-arrow-up-fill text-base' : 'i-ph:cloud-arrow-up text-base'} />
        </button>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || autoSaving}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all text-xs font-medium shadow-sm"
          title={lastSaved ? `Salvo ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : user ? t('saveProject.saveToCloud') : t('saveProject.loginToSaveShort')}
        >
          {saving || autoSaving ? (
            <div className="i-svg-spinners:90-ring-with-bg text-sm" />
          ) : lastSaved ? (
            <div className="i-ph:cloud-check text-sm" />
          ) : (
            <div className="i-ph:cloud-arrow-up-duotone text-sm" />
          )}
          <span className="hidden sm:inline">{saving ? t('saveProject.saving') : autoSaving ? t('saveProject.autoSaving') : t('saveProject.save')}</span>
        </button>
      </div>

      <AuthDialog open={showAuthDialog} onClose={() => setShowAuthDialog(false)} />
    </>
  );
});

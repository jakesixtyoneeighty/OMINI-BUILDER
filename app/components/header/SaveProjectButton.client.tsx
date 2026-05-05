import { useStore } from '@nanostores/react';
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { projectsStore, activeProjectIdStore, updateActiveProjectSettings } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { authStore, supabaseEnabled } from '~/lib/stores/auth';
import { AuthDialog } from './AuthDialog.client';

interface SaveProjectButtonProps {}

export const SaveProjectButton = memo(({}: SaveProjectButtonProps) => {
  const projects = useStore(projectsStore);
  const activeId = useStore(activeProjectIdStore);
  const { user } = useStore(authStore);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [expanded, setExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentProject = projects[activeId];

  // Show button only when a project is active
  if (!activeId || activeId === 'default') {
    return null;
  }

  // Auto-save every 60 seconds when logged in and project is active
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
        setAutoSaveStatus('saving');
        await workbenchStore.saveAllFiles();
        setAutoSaveStatus('saved');
        setLastSaved(new Date());
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch {
        setAutoSaveStatus('error');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      }
    }, 60000); // 60 seconds

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [user, activeId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  const handleSave = useCallback(async () => {
    // If not logged in and Supabase is enabled, prompt to sign in
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
      // 1. Save project settings
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

      // 2. Save all files in the workspace to Supabase
      await workbenchStore.saveEntireProject();

      setLastSaved(new Date());
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
      toast.success('Projeto salvo na nuvem!');
      setExpanded(false);
    } catch (error) {
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
      toast.error(`Erro ao salvar: ${error instanceof Error ? error.message : error}`);
    } finally {
      setSaving(false);
    }
  }, [currentProject, user]);

  // Format last saved time
  const formatLastSaved = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 5) return 'agora mesmo';
    if (diffSec < 60) return `${diffSec}s atras`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}min atras`;
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const statusIcon = () => {
    if (saving) return <div className="i-svg-spinners:90-ring-with-bg text-sm" />;
    if (autoSaveStatus === 'saving') return <div className="i-svg-spinners:90-ring-with-bg text-xs text-bolt-elements-textTertiary" />;
    if (autoSaveStatus === 'saved') return <div className="i-ph:check-circle-fill text-xs text-emerald-400" />;
    if (autoSaveStatus === 'error') return <div className="i-ph:warning-circle-fill text-xs text-red-400" />;
    return null;
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all text-xs font-medium shadow-sm"
          title="Salvar na nuvem"
        >
          <div className="i-ph:cloud-arrow-up-duotone text-sm" />
          <span className="hidden sm:inline">Salvar</span>
          {statusIcon()}
          <div className="i-ph:caret-down text-[10px] opacity-70" />
        </button>

        {expanded && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="px-4 py-3 border-b border-bolt-elements-borderColor">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <div className="i-ph:cloud-arrow-up-duotone text-emerald-400 text-base" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-bolt-elements-textPrimary">Salvar Projeto</p>
                  <p className="text-[10px] text-bolt-elements-textTertiary">
                    {user
                      ? `Salvo como ${user.email}`
                      : 'Faca login para salvar na nuvem'}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-3 space-y-3">
              {/* Status */}
              {lastSaved && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                  <div className="i-ph:clock text-xs text-bolt-elements-textTertiary" />
                  <span className="text-[11px] text-bolt-elements-textTertiary">
                    Ultimo salvo: {formatLastSaved(lastSaved)}
                  </span>
                </div>
              )}

              {/* Auto-save info */}
              {user && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                  <div className="i-ph:arrows-clockwise text-xs text-bolt-elements-textTertiary" />
                  <span className="text-[11px] text-bolt-elements-textTertiary">
                    Auto-save a cada 60 segundos
                  </span>
                  {autoSaveStatus === 'saving' && (
                    <div className="i-svg-spinners:90-ring-with-bg text-xs text-bolt-elements-textTertiary ml-auto" />
                  )}
                  {autoSaveStatus === 'saved' && (
                    <div className="i-ph:check text-xs text-emerald-400 ml-auto" />
                  )}
                </div>
              )}

              {/* Login prompt */}
              {!user && supabaseEnabled && (
                <div className="px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-2">
                    <div className="i-ph:warning-circle text-amber-400 text-sm mt-0.5" />
                    <div>
                      <p className="text-[11px] font-medium text-amber-300">
                        Login necessario
                      </p>
                      <p className="text-[10px] text-amber-400/70 mt-0.5">
                        Faca login para salvar seu projeto na nuvem e nao perder seu trabalho.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="i-svg-spinners:90-ring-with-bg text-sm" />
                    Salvando...
                  </>
                ) : !user ? (
                  <>
                    <div className="i-ph:sign-in-duotone text-sm" />
                    Login para Salvar
                  </>
                ) : (
                  <>
                    <div className="i-ph:floppy-disk-duotone text-sm" />
                    Salvar Agora
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Auth dialog */}
      <AuthDialog open={showAuthDialog} onClose={() => setShowAuthDialog(false)} />
    </>
  );
});

import { useStore } from '@nanostores/react';
import { memo, useState } from 'react';
import { toast } from 'react-toastify';
import { projectsStore, activeProjectIdStore, updateActiveProjectSettings } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';

interface SaveProjectButtonProps {}

export const SaveProjectButton = memo(({}: SaveProjectButtonProps) => {
  const projects = useStore(projectsStore);
  const activeId = useStore(activeProjectIdStore);
  const [saving, setSaving] = useState(false);
  
  const currentProject = projects[activeId];

  // Show a placeholder or nothing if no project is active
  if (!activeId || activeId === 'default') {
    return null;
  }

  const handleSave = async () => {
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
      
      toast.success('Project and all files saved successfully');
    } catch (error) {
      toast.error(`Failed to save: ${error instanceof Error ? error.message : error}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all text-xs font-medium shadow-sm"
      title="Save entire project to cloud"
    >
      {saving ? (
        <div className="i-svg-spinners:90-ring-with-bg text-sm" />
      ) : (
        <div className="i-ph:floppy-disk-duotone text-sm" />
      )}
      <span>{saving ? 'Saving...' : 'Save Project'}</span>
    </button>
  );
});
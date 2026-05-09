import { useStore } from '@nanostores/react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { projectsStore, activeProjectIdStore, renameProject } from '~/lib/stores/project';
import { description } from '~/lib/persistence/useChatHistory';
import { classNames } from '~/utils/classNames';

/**
 * Editable project name displayed in the header center.
 *
 * - Shows the project name (from projectsStore) or falls back to the chat description
 * - Click to enter edit mode (inline input)
 * - Enter to save, Escape to cancel
 * - Auto-syncs to Supabase via renameProject()
 * - Also updates the description atom so the header reflects the change immediately
 */
export function EditableProjectName() {
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const chatDescription = useStore(description);
  const project = projects[activeId];

  const displayName = project?.name || project?.settings?.name || chatDescription || 'Untitled Project';

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setEditValue(displayName);
    setIsEditing(true);
  }, [displayName]);

  const saveName = useCallback(async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === displayName) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);

    try {
      // Update the description atom immediately for visual feedback
      description.set(trimmed);

      if (activeId && activeId !== 'default') {
        await renameProject(activeId, trimmed);
      } else {
        // For default/new projects, update the local store directly
        const current = projects[activeId];
        if (current) {
          projectsStore.setKey(activeId, {
            ...current,
            name: trimmed,
            settings: { ...current.settings, name: trimmed },
          });
        }
      }
    } catch (err) {
      console.warn('Failed to rename project:', err);
      // Revert on error
      description.set(displayName);
    }

    setIsSaving(false);
    setIsEditing(false);
  }, [editValue, displayName, activeId, projects]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveName();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditing();
      }
    },
    [saveName, cancelEditing],
  );

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={saveName}
          disabled={isSaving}
          maxLength={60}
          className={classNames(
            'px-2 py-0.5 rounded-md text-sm font-medium max-w-[280px] w-[280px]',
            'bg-bolt-elements-background-depth-1 border border-orange-500/40',
            'text-bolt-elements-textPrimary outline-none',
            'focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/60',
            'transition-all',
            isSaving && 'opacity-60',
          )}
          placeholder="Nome do projeto..."
        />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={saveName}
            disabled={isSaving}
            className="flex items-center justify-center w-6 h-6 rounded text-green-400 hover:bg-green-500/15 transition-all"
            title="Salvar (Enter)"
          >
            <div className={isSaving ? 'i-ph:spinner animate-spin' : 'i-ph:check'} />
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            disabled={isSaving}
            className="flex items-center justify-center w-6 h-6 rounded text-red-400 hover:bg-red-500/15 transition-all"
            title="Cancelar (Esc)"
          >
            <div className="i-ph:x" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className={classNames(
        'group flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all',
        'text-sm text-bolt-elements-textSecondary max-w-md truncate',
        'hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive',
      )}
      title="Clique para renomear o projeto"
    >
      <span className="truncate">{displayName}</span>
      <div className="i-ph:pencil-simple text-xs opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
    </button>
  );
}

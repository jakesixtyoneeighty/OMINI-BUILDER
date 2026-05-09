import { useStore } from '@nanostores/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getDb, getAll, type ChatHistoryItem } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { activeProjectIdStore } from '~/lib/stores/project';
import { useT } from '~/lib/i18n/useT';

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState<ChatHistoryItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const chatStarted = useStore(chatStore).started;
  const t = useT();

  // Load projects when dialog opens
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }
    // Focus input when opening
    setTimeout(() => inputRef.current?.focus(), 50);

    getDb().then((database) => {
      if (database) {
        getAll(database)
          .then((list) => list.filter((item) => item.urlId && item.description))
          .then(setProjects);
      }
    });
  }, [open]);

  // Filter projects based on query
  const filtered = query
    ? projects.filter((p) => p.description?.toLowerCase().includes(query.toLowerCase()))
    : projects;

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          navigateToProject(selected);
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const navigateToProject = useCallback((project: ChatHistoryItem) => {
    onClose();
    if (project.urlId) {
      window.location.href = `/chat/${project.urlId}`;
    }
  }, [onClose]);

  const handleNewProject = useCallback(() => {
    onClose();
    chatStore.set({ started: false, aborted: false, showChat: true, planMode: false });
    workbenchStore.showWorkbench.set(false);
    workbenchStore.currentView.set('code');
    workbenchStore.clearWorkspace();
    workbenchStore.artifacts.set({});
    workbenchStore.artifactIdList = [];
    localStorage.removeItem('omni-builder.files.cache');
    localStorage.removeItem('bolt.files.cache');
    const pid = activeProjectIdStore.get();
    if (pid) {
      localStorage.removeItem(`bolt.snapshots.${pid}`);
    }
    activeProjectIdStore.set('default');
    window.location.href = '/';
  }, [onClose]);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t('projects.today');
    if (diffDays === 1) return t('projects.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('projects.daysAgo')}`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${t('projects.weeksAgo')}`;
    return date.toLocaleDateString();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-bolt-elements-borderColor">
          <div className="i-ph:magnifying-glass text-base text-bolt-elements-textTertiary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {/* New project option */}
          <button
            onClick={handleNewProject}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText shrink-0">
              <div className="i-ph:plus text-sm" />
            </div>
            <div>
              <span className="font-medium">{t('projects.newProject')}</span>
              <p className="text-[11px] text-bolt-elements-textTertiary">{t('searchDialog.startNewChat')}</p>
            </div>
          </button>

          {/* Divider */}
          {filtered.length > 0 && (
            <div className="my-1.5 mx-3 border-t border-bolt-elements-borderColor" />
          )}

          {/* Project results */}
          {filtered.map((project, index) => (
            <button
              key={project.id}
              data-selected={index === selectedIndex}
              onClick={() => navigateToProject(project)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                index === selectedIndex
                  ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary'
                  : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive'
              }`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor shrink-0">
                <div className="i-ph:code text-sm text-bolt-elements-textTertiary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium block truncate">{project.description || t('projects.untitled')}</span>
                <span className="text-[11px] text-bolt-elements-textTertiary">{formatDate(project.timestamp)}</span>
              </div>
              <div className="i-ph:arrow-right text-xs text-bolt-elements-textTertiary shrink-0" />
            </button>
          ))}

          {/* No results */}
          {query && filtered.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="i-ph:magnifying-glass text-2xl text-bolt-elements-textTertiary mb-2" />
              <p className="text-sm text-bolt-elements-textTertiary">{t('searchDialog.noProjectsFound')} "{query}"</p>
            </div>
          )}

          {/* Empty state (no query, no projects) */}
          {!query && filtered.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="i-ph:folder-open text-2xl text-bolt-elements-textTertiary mb-2" />
              <p className="text-sm text-bolt-elements-textTertiary">{t('searchDialog.noProjectsYet')}</p>
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-bolt-elements-borderColor text-[10px] text-bolt-elements-textTertiary">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">↑↓</kbd>
            {t('searchDialog.navigate')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">↵</kbd>
            {t('common.open')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">esc</kbd>
            {t('common.close')}
          </span>
        </div>
      </div>
    </div>
  );
}

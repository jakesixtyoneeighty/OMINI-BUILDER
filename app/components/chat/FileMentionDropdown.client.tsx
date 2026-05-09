import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap, File as WFile } from '~/lib/stores/files';
import { classNames } from '~/utils/classNames';
import { useT } from '~/lib/i18n/useT';

interface FileMentionDropdownProps {
  search: string;          // the text after @ (e.g. "App" if user typed "@App")
  position: { top: number; left: number };  // dropdown position
  onSelect: (filePath: string) => void;      // called when a file is selected
  onClose: () => void;                        // called when dropdown is dismissed
}

function getFileIcon(path: string): string {
  if (path.endsWith('.tsx') || path.endsWith('.jsx')) return 'i-ph:file-js';
  if (path.endsWith('.ts') || path.endsWith('.js')) return 'i-ph:file-js';
  if (path.endsWith('.css') || path.endsWith('.scss')) return 'i-ph:paint-brush';
  if (path.endsWith('.html')) return 'i-ph:code';
  if (path.endsWith('.json')) return 'i-ph:brackets-curly';
  if (path.endsWith('.md')) return 'i-ph:file-text';
  if (path.endsWith('.py')) return 'i-ph:file-py';
  if (path.endsWith('.svg')) return 'i-ph:image';
  if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.ico')) return 'i-ph:image';
  return 'i-ph:file';
}

function getFileColor(path: string): string {
  if (path.endsWith('.tsx') || path.endsWith('.jsx')) return 'text-blue-400';
  if (path.endsWith('.ts') || path.endsWith('.js')) return 'text-yellow-400';
  if (path.endsWith('.css') || path.endsWith('.scss')) return 'text-pink-400';
  if (path.endsWith('.html')) return 'text-orange-400';
  if (path.endsWith('.json')) return 'text-green-400';
  if (path.endsWith('.md')) return 'text-gray-400';
  return 'text-gray-400';
}

export function FileMentionDropdown({ search, position, onSelect, onClose }: FileMentionDropdownProps) {
  const files = useStore(workbenchStore.files);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const t = useT();

  // Build file list filtered by search
  const fileList = useMemo(() => {
    const entries = Object.entries(files)
      .filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);

    const items = entries.map(([path]) => {
      // Clean path: remove /home/project/ prefix for display
      const displayPath = path.replace(/^\/home\/project\//, '/').replace(/^\//, '');
      return {
        fullPath: path,
        displayPath,
        name: displayPath.split('/').pop() || displayPath,
        folder: displayPath.split('/').slice(0, -1).join('/') || '/',
      };
    });

    // Filter by search
    const lowerSearch = search.toLowerCase();
    const filtered = lowerSearch
      ? items.filter(f =>
          f.name.toLowerCase().includes(lowerSearch) ||
          f.displayPath.toLowerCase().includes(lowerSearch)
        )
      : items;

    // Sort: exact name match first, then path match
    filtered.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().startsWith(lowerSearch) ? 0 : 1;
      const bNameMatch = b.name.toLowerCase().startsWith(lowerSearch) ? 0 : 1;
      if (aNameMatch !== bNameMatch) return aNameMatch - bNameMatch;
      return a.displayPath.localeCompare(b.displayPath);
    });

    return filtered.slice(0, 15); // limit to 15 results
  }, [files, search]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, fileList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (fileList[selectedIndex]) {
        onSelect(fileList[selectedIndex].fullPath);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [fileList, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (fileList.length === 0) {
    return (
      <div
        className="fixed z-[9999] bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl overflow-hidden"
        style={{ bottom: `calc(100vh - ${position.top}px)`, left: position.left }}
      >
        <div className="px-3 py-2.5 text-xs text-bolt-elements-textTertiary">
          {t('fileMention.noFilesFound')} "{search}"
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-[9999] bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl overflow-hidden w-72 max-h-64"
      style={{ bottom: `calc(100vh - ${position.top}px)`, left: position.left }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
        <span className="text-[10px] font-medium text-bolt-elements-textTertiary uppercase tracking-wider">
          {t('fileMention.files')} — {fileList.length} {t('fileMention.results')}
        </span>
      </div>

      {/* File list */}
      <div ref={listRef} className="overflow-y-auto max-h-56 py-1">
        {fileList.map((file, index) => (
          <button
            key={file.fullPath}
            data-selected={index === selectedIndex}
            onClick={() => onSelect(file.fullPath)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={classNames(
              'w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-all',
              index === selectedIndex
                ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary'
                : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive',
            )}
          >
            <div className={`${getFileIcon(file.displayPath)} text-sm ${getFileColor(file.displayPath)} shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{file.name}</p>
              <p className="text-[10px] text-bolt-elements-textTertiary truncate">{file.folder}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
        <div className="flex items-center gap-3 text-[9px] text-bolt-elements-textTertiary">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-[8px]">↑↓</kbd>
            {t('fileMention.navigate')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-[8px]">↵</kbd>
            {t('fileMention.select')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-[8px]">Esc</kbd>
            {t('common.close')}
          </span>
        </div>
      </div>
    </div>
  );
}

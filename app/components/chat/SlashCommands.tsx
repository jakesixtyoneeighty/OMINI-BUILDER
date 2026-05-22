import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tag?: string;
  action: () => void;
}

interface SlashCommandsProps {
  search: string;
  position: { top: number; left: number };
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

const TAG_COLORS: Record<string, string> = {
  'AI':      'rgba(99,102,241,.15)',
  'Skill':   'rgba(16,185,129,.15)',
  'Media':   'rgba(236,72,153,.15)',
  'Mode':    'rgba(245,158,11,.15)',
  'Debug':   'rgba(239,68,68,.15)',
  'Docs':    'rgba(6,182,212,.15)',
};
const TAG_TEXT: Record<string, string> = {
  'AI':      '#a5b4fc',
  'Skill':   '#6ee7b7',
  'Media':   '#f9a8d4',
  'Mode':    '#fcd34d',
  'Debug':   '#fca5a5',
  'Docs':    '#67e8f9',
};

export function useSlashCommands(): SlashCommand[] {
  const thinkMode = useStore(chatStore).thinkMode;

  return [
    {
      id: 'think',
      name: 'think',
      description: 'Deep visible reasoning mode',
      icon: 'i-ph:brain-duotone',
      color: '#6366f1',
      tag: 'AI',
      action: () => { chatStore.setKey('thinkMode', !thinkMode); },
    },
    {
      id: 'plan',
      name: 'plan',
      description: 'Create execution plan before building',
      icon: 'i-ph:list-checks-duotone',
      color: '#f59e0b',
      tag: 'Mode',
      action: () => {},
    },
    {
      id: 'skill-web',
      name: 'skill-web',
      description: 'Generate complete web page with HTML/CSS/JS',
      icon: 'i-ph:globe-duotone',
      color: '#10b981',
      tag: 'Skill',
      action: () => {},
    },
    {
      id: 'skill-ui',
      name: 'skill-ui',
      description: 'Create UI component with design system',
      icon: 'i-ph:palette-duotone',
      color: '#8b5cf6',
      tag: 'Skill',
      action: () => {},
    },
    {
      id: 'skill-api',
      name: 'skill-api',
      description: 'Create REST API endpoint',
      icon: 'i-ph:plug-duotone',
      color: '#f59e0b',
      tag: 'Skill',
      action: () => {},
    },
    {
      id: 'skill-db',
      name: 'skill-db',
      description: 'Create database schema',
      icon: 'i-ph:database-duotone',
      color: '#06b6d4',
      tag: 'Skill',
      action: () => {},
    },
    {
      id: 'skill-auth',
      name: 'skill-auth',
      description: 'Add authentication to your app',
      icon: 'i-ph:lock-key-duotone',
      color: '#ec4899',
      tag: 'Skill',
      action: () => {},
    },
    {
      id: 'skill-ppt',
      name: 'skill-ppt',
      description: 'Generate PowerPoint presentation',
      icon: 'i-ph:presentation-chart-duotone',
      color: '#ef4444',
      tag: 'Skill',
      action: () => {},
    },
    {
      id: 'image',
      name: 'image',
      description: 'Generate image with AI from description',
      icon: 'i-ph:image-duotone',
      color: '#ec4899',
      tag: 'Media',
      action: () => {},
    },
    {
      id: 'voice',
      name: 'voice',
      description: 'Dictate message by voice',
      icon: 'i-ph:microphone-duotone',
      color: '#f43f5e',
      tag: 'Media',
      action: () => {},
    },
    {
      id: 'debug',
      name: 'debug',
      description: 'Analyze and fix errors in code',
      icon: 'i-ph:bug-beetle-duotone',
      color: '#ef4444',
      tag: 'Debug',
      action: () => {},
    },
    {
      id: 'docs',
      name: 'docs',
      description: 'Generate documentation for code',
      icon: 'i-ph:book-bookmark-duotone',
      color: '#06b6d4',
      tag: 'Docs',
      action: () => {},
    },
  ];
}

export function SlashCommandsDropdown({ search, position, onSelect, onClose }: SlashCommandsProps) {
  const commands = useSlashCommands();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filtered = commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description.toLowerCase().includes(search.toLowerCase()) ||
      (cmd.tag || '').toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => { setSelectedIndex(0); }, [search]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((p) => (p + 1) % filtered.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((p) => (p - 1 + filtered.length) % filtered.length); }
      else if (e.key === 'Enter') { e.preventDefault(); if (filtered[selectedIndex]) onSelect(filtered[selectedIndex]); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    },
    [filtered, selectedIndex, onSelect, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (filtered.length === 0) return null;

  const dropdownHeight = Math.min(filtered.length * 52 + 80, 380);
  const top = Math.min(position.top, window.innerHeight - dropdownHeight - 20);

  // Group by tag
  const groups: { tag: string; items: typeof filtered }[] = [];
  const seen = new Set<string>();
  for (const cmd of filtered) {
    const tag = cmd.tag || 'Other';
    if (!seen.has(tag)) { seen.add(tag); groups.push({ tag, items: [] }); }
    groups.find((g) => g.tag === tag)!.items.push(cmd);
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className="fixed z-[9999] w-[340px] rounded-2xl overflow-hidden"
      style={{
        bottom: window.innerHeight - top + 10,
        left: Math.min(position.left, window.innerWidth - 360),
        background: 'rgba(14,14,22,.95)',
        border: '1px solid rgba(255,255,255,.08)',
        boxShadow: '0 24px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04)',
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,.06)' }}>
        <div className="flex items-center gap-2">
          <div className="i-ph:terminal-window-duotone text-sm" style={{ color: '#6366f1' }} />
          <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,.3)' }}>
            Commands
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,.2)' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Commands */}
      <div className="max-h-[320px] overflow-y-auto py-1.5 scrollbar-thin">
        {groups.map(({ tag, items }) => {
          const globalStart = filtered.indexOf(items[0]);
          return (
            <div key={tag}>
              <div className="px-4 pt-2 pb-1">
                <span
                  className="text-[9px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: TAG_COLORS[tag] || 'rgba(255,255,255,.06)',
                    color: TAG_TEXT[tag] || 'rgba(255,255,255,.4)',
                  }}
                >
                  {tag}
                </span>
              </div>
              {items.map((cmd) => {
                const globalIdx = filtered.indexOf(cmd);
                const isSelected = globalIdx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    ref={(el) => { itemRefs.current[globalIdx] = el; }}
                    onClick={() => onSelect(cmd)}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    className="w-full text-left px-3 py-2 mx-1 flex items-center gap-3 rounded-xl transition-all duration-100"
                    style={{
                      width: 'calc(100% - 8px)',
                      background: isSelected ? 'rgba(99,102,241,.12)' : 'transparent',
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                      style={{ background: `${cmd.color}18`, color: cmd.color }}
                    >
                      <div className={cmd.icon} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: isSelected ? '#a5b4fc' : 'rgba(255,255,255,.85)' }}
                        >
                          /{cmd.name}
                        </span>
                      </div>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,.3)' }}>
                        {cmd.description}
                      </p>
                    </div>

                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, scale: .8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                        style={{ background: 'rgba(99,102,241,.2)', color: '#a5b4fc' }}
                      >
                        ↵
                      </motion.div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}
      >
        <div className="flex items-center gap-3 text-[10px]" style={{ color: 'rgba(255,255,255,.25)' }}>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)' }}>↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)' }}>↵</kbd>
            select
          </span>
        </div>
        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,.2)' }}>
          <kbd className="px-1 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)' }}>esc</kbd>
          close
        </span>
      </div>
    </motion.div>
  );
}

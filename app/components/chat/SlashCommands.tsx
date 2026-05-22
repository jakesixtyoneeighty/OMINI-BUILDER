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
  iconBg: string;
  shortcut?: string;
  action: () => void;
}

interface SlashCommandsProps {
  search: string;
  position: { top: number; left: number };
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

export function useSlashCommands(): SlashCommand[] {
  const thinkMode = useStore(chatStore).thinkMode;

  return [
    {
      id: 'think',
      name: 'think',
      description: 'Raciocinio profundo e visivel da IA',
      icon: 'i-ph:brain-duotone',
      iconBg: 'bg-blue-500/15 text-blue-400',
      shortcut: 'Modo pensamento',
      action: () => {
        chatStore.setKey('thinkMode', !thinkMode);
      },
    },
    {
      id: 'skill-web',
      name: 'skill-web',
      description: 'Gerar pagina web completa com HTML/CSS/JS',
      icon: 'i-ph:globe-duotone',
      iconBg: 'bg-emerald-500/15 text-emerald-400',
      shortcut: 'Skill',
      action: () => {},
    },
    {
      id: 'skill-ui',
      name: 'skill-ui',
      description: 'Criar componente UI com design system',
      icon: 'i-ph:palette-duotone',
      iconBg: 'bg-purple-500/15 text-purple-400',
      shortcut: 'Skill',
      action: () => {},
    },
    {
      id: 'skill-api',
      name: 'skill-api',
      description: 'Criar endpoint de API REST',
      icon: 'i-ph:plug-duotone',
      iconBg: 'bg-amber-500/15 text-amber-400',
      shortcut: 'Skill',
      action: () => {},
    },
    {
      id: 'skill-db',
      name: 'skill-db',
      description: 'Criar schema de banco de dados',
      icon: 'i-ph:database-duotone',
      iconBg: 'bg-cyan-500/15 text-cyan-400',
      shortcut: 'Skill',
      action: () => {},
    },
    {
      id: 'image',
      name: 'image',
      description: 'Gerar imagem com IA a partir de descricao',
      icon: 'i-ph:image-duotone',
      iconBg: 'bg-pink-500/15 text-pink-400',
      shortcut: 'Gerar',
      action: () => {},
    },
    {
      id: 'voice',
      name: 'voice',
      description: 'Dictar mensagem por voz',
      icon: 'i-ph:microphone-duotone',
      iconBg: 'bg-rose-500/15 text-rose-400',
      shortcut: 'Audio',
      action: () => {},
    },
    {
      id: 'plan',
      name: 'plan',
      description: 'Criar plano de execucao antes de construir',
      icon: 'i-ph:list-checks-duotone',
      iconBg: 'bg-indigo-500/15 text-indigo-400',
      shortcut: 'Modo plano',
      action: () => {},
    },
    {
      id: 'debug',
      name: 'debug',
      description: 'Analisar e corrigir erros no codigo',
      icon: 'i-ph:bug-beetle-duotone',
      iconBg: 'bg-red-500/15 text-red-400',
      shortcut: 'Debug',
      action: () => {},
    },
    {
      id: 'docs',
      name: 'docs',
      description: 'Gerar documentacao para o codigo',
      icon: 'i-ph:book-bookmark-duotone',
      iconBg: 'bg-teal-500/15 text-teal-400',
      shortcut: 'Docs',
      action: () => {},
    },
  ];
}

export function SlashCommandsDropdown({ search, position, onSelect, onClose }: SlashCommandsProps) {
  const commands = useSlashCommands();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filter commands by search
  const filtered = commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description.toLowerCase().includes(search.toLowerCase()),
  );

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIndex, onSelect, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (filtered.length === 0) return null;

  // Calculate position to avoid going off screen
  const dropdownHeight = Math.min(filtered.length * 56 + 40, 400);
  const top = Math.min(position.top, window.innerHeight - dropdownHeight - 20);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="fixed z-[9999] w-[320px] rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-2xl overflow-hidden"
      style={{
        bottom: window.innerHeight - top + 8,
        left: Math.min(position.left, window.innerWidth - 340),
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-bolt-elements-borderColor/50 bg-bolt-elements-background-depth-1">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-bolt-elements-textTertiary">
          Comandos & Skills
        </span>
        <span className="text-[10px] text-bolt-elements-textTertiary">
          {filtered.length} disponivel{filtered.length !== 1 ? 'is' : ''}
        </span>
      </div>

      {/* Commands list */}
      <div className="max-h-[360px] overflow-y-auto py-1">
        {filtered.map((cmd, index) => (
          <button
            key={cmd.id}
            ref={(el) => { itemRefs.current[index] = el; }}
            onClick={() => onSelect(cmd)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={classNames(
              'w-full text-left px-3 py-2.5 flex items-center gap-3 transition-all duration-100',
              selectedIndex === index
                ? 'bg-bolt-elements-item-backgroundActive'
                : 'hover:bg-bolt-elements-item-backgroundActive/50',
            )}
          >
            {/* Icon */}
            <div
              className={classNames(
                'w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 transition-transform duration-150',
                cmd.iconBg,
                selectedIndex === index ? 'scale-110' : '',
              )}
            >
              <div className={cmd.icon} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={classNames(
                    'text-sm font-semibold',
                    selectedIndex === index ? 'text-bolt-elements-item-contentAccent' : 'text-bolt-elements-textPrimary',
                  )}
                >
                  /{cmd.name}
                </span>
                {cmd.shortcut && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary font-medium">
                    {cmd.shortcut}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-bolt-elements-textTertiary truncate mt-0.5">{cmd.description}</p>
            </div>

            {/* Arrow indicator when selected */}
            {selectedIndex === index && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-bolt-elements-item-contentAccent"
              >
                <div className="i-ph:caret-left text-xs" />
              </motion.div>
            )}
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-bolt-elements-borderColor/50 bg-bolt-elements-background-depth-1 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-bolt-elements-textTertiary">
          <span className="flex items-center gap-1">
            <kbd className="px-1 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-[9px]">↑↓</kbd>
            Navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-[9px]">Enter</kbd>
            Selecionar
          </span>
        </div>
        <span className="text-[10px] text-bolt-elements-textTertiary">
          <kbd className="px-1 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-[9px]">Esc</kbd>
          Fechar
        </span>
      </div>
    </motion.div>
  );
}

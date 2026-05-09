import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * Parse thinking content to extract reasoning and commands.
 * Commands are lines that look like shell commands (npm, npx, cd, etc.)
 * or code snippets wrapped in backticks.
 */
function parseThinkingContent(content: string): { reasoning: string; commands: string[] } {
  const lines = content.split('\n');
  const reasoningLines: string[] = [];
  const commands: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';

  for (const line of lines) {
    // Track code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block - check if it's a command
        const trimmed = codeBlockContent.trim();
        if (trimmed && looksLikeCommand(trimmed)) {
          commands.push(trimmed);
        } else if (trimmed) {
          reasoningLines.push('```' + codeBlockContent + '```');
        }
        codeBlockContent = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockContent = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // Check if line looks like a command
    if (looksLikeCommand(line.trim())) {
      commands.push(line.trim());
    } else {
      reasoningLines.push(line);
    }
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockContent.trim()) {
    reasoningLines.push('```' + codeBlockContent + '```');
  }

  return {
    reasoning: reasoningLines.join('\n').trim(),
    commands,
  };
}

function looksLikeCommand(text: string): boolean {
  if (!text) return false;
  const commandPatterns = [
    /^(npm|npx|yarn|pnpm|bun)\s/,
    /^(cd|mkdir|rm|cp|mv|ls|cat|echo|chmod|curl|wget|git)\s/,
    /^(pip|python|node|deno)\s/,
    /^(sudo|docker|kubectl)\s/,
    /^>\s/,
    /^\$\s/,
  ];
  return commandPatterns.some((p) => p.test(text));
}

export const ThinkingBlock = memo(({ content, isStreaming = false }: ThinkingBlockProps) => {
  const [isOpen, setIsOpen] = useState(isStreaming);
  const [activeTab, setActiveTab] = useState<'reasoning' | 'commands'>('reasoning');

  const { reasoning, commands } = useMemo(() => parseThinkingContent(content), [content]);

  if (!content) {
    return null;
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const hasCommands = commands.length > 0;

  return (
    <div
      className={classNames(
        'my-2 rounded-xl overflow-hidden transition-all duration-300',
        isStreaming
          ? 'border border-indigo-500/30'
          : 'border border-bolt-elements-borderColor',
      )}
      style={isStreaming ? {
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.05))',
      } : {
        background: 'var(--bolt-elements-background-depth-1, rgba(255,255,255,0.02))',
      }}
    >
      <button
        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left transition-colors hover:bg-bolt-elements-item-backgroundActive/30"
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Thinking icon */}
        <div className="shrink-0 w-5 h-5 flex items-center justify-center">
          {isStreaming ? (
            <div className="i-svg-spinners:90-ring-with-bg text-sm text-indigo-400" />
          ) : (
            <div className="i-ph:brain-duotone text-sm text-bolt-elements-textTertiary" />
          )}
        </div>

        <span className="text-xs font-medium text-bolt-elements-textSecondary">
          Raciocinio da IA
        </span>

        {/* Word count badge */}
        {!isStreaming && wordCount > 0 && (
          <span className="text-[10px] text-bolt-elements-textTertiary bg-bolt-elements-background-depth-2 px-1.5 py-0.5 rounded-full">
            {wordCount} palavras
          </span>
        )}

        {/* Commands count badge */}
        {hasCommands && !isStreaming && (
          <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <div className="i-ph:terminal text-[8px]" />
            {commands.length} comando{commands.length > 1 ? 's' : ''}
          </span>
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full animate-pulse">
            Pensando...
          </span>
        )}

        {/* Expand/collapse */}
        <div
          className={classNames(
            'i-ph:caret-down text-xs ml-auto text-bolt-elements-textTertiary transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-bolt-elements-borderColor/50">
              {/* Tabs - only show if there are commands */}
              {hasCommands && (
                <div className="flex border-b border-bolt-elements-borderColor/30">
                  <button
                    className={classNames(
                      'flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-medium transition-colors border-b-2',
                      activeTab === 'reasoning'
                        ? 'text-bolt-elements-textPrimary border-indigo-400'
                        : 'text-bolt-elements-textTertiary border-transparent hover:text-bolt-elements-textSecondary',
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('reasoning');
                    }}
                  >
                    <div className="i-ph:brain text-[10px]" />
                    Raciocinio
                  </button>
                  <button
                    className={classNames(
                      'flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-medium transition-colors border-b-2',
                      activeTab === 'commands'
                        ? 'text-bolt-elements-textPrimary border-blue-400'
                        : 'text-bolt-elements-textTertiary border-transparent hover:text-bolt-elements-textSecondary',
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('commands');
                    }}
                  >
                    <div className="i-ph:terminal text-[10px]" />
                    Comandos ({commands.length})
                  </button>
                </div>
              )}

              {/* Content area */}
              <div className="px-4 py-2.5">
                {activeTab === 'reasoning' || !hasCommands ? (
                  <pre className="text-[11px] text-bolt-elements-textTertiary whitespace-pre-wrap break-words font-mono leading-relaxed max-h-64 overflow-y-auto">
                    {reasoning || content}
                  </pre>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {commands.map((cmd, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-bolt-elements-code-background border border-bolt-elements-borderColor/20"
                      >
                        <span className="text-[10px] text-indigo-400 font-mono shrink-0 mt-0.5">$</span>
                        <code className="text-[11px] text-emerald-300 font-mono break-all leading-relaxed">
                          {cmd}
                        </code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

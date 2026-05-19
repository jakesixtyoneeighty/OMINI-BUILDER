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
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'reasoning' | 'commands'>('reasoning');

  const { reasoning, commands } = useMemo(() => parseThinkingContent(content), [content]);

  if (!content && !isStreaming) {
    return null;
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const hasCommands = commands.length > 0;

  // === STREAMING STATE: Shimmer "Pensando..." ===
  if (isStreaming) {
    return (
      <div className="my-2">
        <div
          className="inline-flex items-center"
          style={{
            fontSize: '18px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            background: 'linear-gradient(90deg, #5a5a5a 0%, #ffffff 35%, #5a5a5a 55%, #ffffff 75%, #5a5a5a 100%)',
            backgroundSize: '300% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'thinking-shine 12s linear infinite',
          }}
        >
          Pensando...
        </div>
      </div>
    );
  }

  // === COMPLETED STATE: "Exibir raciocínio" button ===
  return (
    <div className="my-2">
      {/* "Exibir raciocínio" pill button — OpenAI style */}
      <button
        className="flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-200 cursor-pointer"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.88)',
          fontSize: '14px',
          fontWeight: 500,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Lightbulb icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.9, flexShrink: 0 }}
        >
          <path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.2 4 2.4 5.3.8.9 1.6 1.8 1.6 2.7h4c0-.9.8-1.8 1.6-2.7C16.8 13 18 11.5 18 9a6 6 0 0 0-6-6z" />
          <path d="M9 21h6" />
          <path d="M10 18h4" />
        </svg>

        <span>{isOpen ? 'Ocultar raciocínio' : 'Exibir raciocínio'}</span>

        {wordCount > 0 && (
          <span style={{ fontSize: '11px', opacity: 0.5, marginLeft: '4px' }}>
            {wordCount} palavras
          </span>
        )}

        {/* Expand/collapse chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            marginLeft: 'auto',
            opacity: 0.5,
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Reasoning content — expandable */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 rounded-xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {/* Tabs — only show if there are commands */}
              {hasCommands && (
                <div className="flex border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <button
                    className={classNames(
                      'flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2',
                      activeTab === 'reasoning'
                        ? 'text-blue-400 border-blue-400'
                        : 'text-bolt-elements-textTertiary border-transparent hover:text-bolt-elements-textSecondary',
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('reasoning');
                    }}
                  >
                    <div className="i-ph:brain text-[10px]" />
                    Raciocínio
                  </button>
                  <button
                    className={classNames(
                      'flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2',
                      activeTab === 'commands'
                        ? 'text-blue-400 border-blue-400'
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
              <div className="px-4 py-3">
                {activeTab === 'reasoning' || !hasCommands ? (
                  <pre className="text-xs text-bolt-elements-textTertiary whitespace-pre-wrap break-words font-mono leading-relaxed max-h-72 overflow-y-auto">
                    {reasoning || content}
                  </pre>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {commands.map((cmd, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 px-2.5 py-1.5 rounded-md"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <span className="text-[10px] text-blue-400 font-mono shrink-0 mt-0.5">$</span>
                        <code className="text-xs text-emerald-300 font-mono break-all leading-relaxed">{cmd}</code>
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

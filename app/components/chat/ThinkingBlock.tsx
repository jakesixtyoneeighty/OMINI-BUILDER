import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './ThinkingBlock.module.scss';

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
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
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

    if (looksLikeCommand(line.trim())) {
      commands.push(line.trim());
    } else {
      reasoningLines.push(line);
    }
  }

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

  // === STREAMING STATE: Gradient "Pensando..." + blue streaming content ===
  if (isStreaming) {
    return (
      <div className={styles.streamingContainer}>
        {/* Gradient shine "Pensando..." — OpenAI style */}
        <div className={styles.thinkingLabel}>
          <svg
            className={styles.thinkingIcon}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.2 4 2.4 5.3.8.9 1.6 1.8 1.6 2.7h4c0-.9.8-1.8 1.6-2.7C16.8 13 18 11.5 18 9a6 6 0 0 0-6-6z" />
            <path d="M9 21h6" />
            <path d="M10 18h4" />
          </svg>
          <span className={styles.shimmerText}>Pensando...</span>
        </div>

        {/* Blue streaming thinking content — appears as the AI thinks */}
        {content && (
          <div className={styles.streamingContent}>
            <pre className={styles.streamingPre}>{content}</pre>
            <span className={styles.cursorBlink}>|</span>
          </div>
        )}
      </div>
    );
  }

  // === COMPLETED STATE: "Exibir raciocínio" button ===
  return (
    <div className={styles.completedContainer}>
      <button
        className={styles.revealButton}
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
          className={styles.revealIcon}
        >
          <path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.2 4 2.4 5.3.8.9 1.6 1.8 1.6 2.7h4c0-.9.8-1.8 1.6-2.7C16.8 13 18 11.5 18 9a6 6 0 0 0-6-6z" />
          <path d="M9 21h6" />
          <path d="M10 18h4" />
        </svg>

        <span>{isOpen ? 'Ocultar raciocínio' : 'Exibir raciocínio'}</span>

        {wordCount > 0 && (
          <span className={styles.wordCount}>
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
          className={`${styles.chevronIcon} ${isOpen ? styles.chevronOpen : styles.chevronClosed}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Reasoning content — expandable, stays open when clicked */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className={styles.contentPanel}>
              {/* Tabs — only show if there are commands */}
              {hasCommands && (
                <div className={styles.tabBar}>
                  <button
                    className={`${styles.tab} ${activeTab === 'reasoning' ? styles.tabActive : styles.tabInactive}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('reasoning');
                    }}
                  >
                    <div className="i-ph:brain text-[10px]" />
                    Raciocínio
                  </button>
                  <button
                    className={`${styles.tab} ${activeTab === 'commands' ? styles.tabActive : styles.tabInactive}`}
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
              <div className={styles.contentInner}>
                {activeTab === 'reasoning' || !hasCommands ? (
                  <pre className={styles.reasoningPre}>
                    {reasoning || content}
                  </pre>
                ) : (
                  <div className={styles.commandList}>
                    {commands.map((cmd, i) => (
                      <div key={i} className={styles.commandItem}>
                        <span className={styles.commandPrompt}>$</span>
                        <code className={styles.commandCode}>{cmd}</code>
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

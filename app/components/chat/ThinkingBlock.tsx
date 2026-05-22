import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Inline shimmer animation — avoids CSS module keyframe mangling issues
const shimmerKeyframes = `
@keyframes thinking-shimmer {
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
}
@keyframes thinking-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
`;

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

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
  const charCount = content.length;
  const hasCommands = commands.length > 0;

  // === STREAMING STATE: Gradient "Pensando..." shimmer + blue streaming content ===
  if (isStreaming) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '6px 0', padding: '2px 0' }}>
        <style>{shimmerKeyframes}</style>

        {/* "Pensando..." with gradient shimmer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Lightbulb SVG */}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-bolt-elements-textTertiary"
            style={{ flexShrink: 0, opacity: 0.65 }}
          >
            <path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.2 4 2.4 5.3.8.9 1.6 1.8 1.6 2.7h4c0-.9.8-1.8 1.6-2.7C16.8 13 18 11.5 18 9a6 6 0 0 0-6-6z" />
            <path d="M9 21h6" />
            <path d="M10 18h4" />
          </svg>

          {/* Shimmer text — gradient animado via CSS class */}
          <span className="thinking-shimmer-text">
            Pensando...
          </span>
        </div>

        {/* Blue streaming content */}
        {content && (
          <div className="thinking-streaming-content">
            <pre className="thinking-streaming-pre">
              {content}
            </pre>
            <span className="thinking-cursor-blink">
              |
            </span>
          </div>
        )}
      </div>
    );
  }

  // === COMPLETED STATE: "Exibir raciocínio" button ===
  return (
    <div style={{ margin: '8px 0' }}>
      <style>{shimmerKeyframes}</style>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="thinking-reveal-button"
        onMouseEnter={(e) => {
          e.currentTarget.classList.add('thinking-reveal-button-hover');
        }}
        onMouseLeave={(e) => {
          e.currentTarget.classList.remove('thinking-reveal-button-hover');
        }}
      >
        {/* Lightbulb icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.65 }}
        >
          <path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.2 4 2.4 5.3.8.9 1.6 1.8 1.6 2.7h4c0-.9.8-1.8 1.6-2.7C16.8 13 18 11.5 18 9a6 6 0 0 0-6-6z" />
          <path d="M9 21h6" />
          <path d="M10 18h4" />
        </svg>

        {/* Label text */}
        <span>{isOpen ? 'Ocultar raciocínio' : 'Exibir raciocínio'}</span>

        {/* Word/char count badge */}
        {(wordCount > 0 || charCount > 0) && (
          <span className="thinking-count-badge">
            {charCount >= 1000
              ? `${(charCount / 1000).toFixed(1)}k caracteres`
              : wordCount > 50
                ? `${wordCount} palavras`
                : `${charCount} caracteres`}
          </span>
        )}

        {/* Chevron */}
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
            opacity: 0.45,
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
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
            <div className="thinking-content-panel">
              {/* Tabs — only show if there are commands */}
              {hasCommands && (
                <div className="thinking-tab-bar">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('reasoning');
                    }}
                    className={`thinking-tab ${activeTab === 'reasoning' ? 'thinking-tab-active' : 'thinking-tab-inactive'}`}
                  >
                    <span style={{ fontSize: 14, filter: 'grayscale(1)' }}>🧠</span> Raciocínio
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('commands');
                    }}
                    className={`thinking-tab ${activeTab === 'commands' ? 'thinking-tab-active' : 'thinking-tab-inactive'}`}
                  >
                    <span style={{ fontSize: 14, filter: 'grayscale(1)' }}>⚡</span> Comandos ({commands.length})
                  </button>
                </div>
              )}

              {/* Content area */}
              <div style={{ padding: '14px 18px' }}>
                {activeTab === 'reasoning' || !hasCommands ? (
                  <pre className="thinking-reasoning-pre">
                    {reasoning || content}
                  </pre>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      maxHeight: 288,
                      overflowY: 'auto',
                    }}
                  >
                    {commands.map((cmd, i) => (
                      <div
                        key={i}
                        className="thinking-command-item"
                      >
                        <span className="thinking-command-prompt">
                          $
                        </span>
                        <code className="thinking-command-code">
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

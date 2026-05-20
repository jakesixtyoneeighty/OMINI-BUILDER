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
            style={{ flexShrink: 0, opacity: 0.65, color: 'rgba(255,255,255,0.42)' }}
          >
            <path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.2 4 2.4 5.3.8.9 1.6 1.8 1.6 2.7h4c0-.9.8-1.8 1.6-2.7C16.8 13 18 11.5 18 9a6 6 0 0 0-6-6z" />
            <path d="M9 21h6" />
            <path d="M10 18h4" />
          </svg>

          {/* Shimmer text — gradient animado via inline style */}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.2px',
              background: 'linear-gradient(90deg, #5a5a5a 0%, #ffffff 35%, #5a5a5a 55%, #ffffff 75%, #5a5a5a 100%)',
              backgroundSize: '300% auto',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'thinking-shimmer 12s linear infinite',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            }}
          >
            Pensando...
          </span>
        </div>

        {/* Blue streaming content */}
        {content && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(59, 130, 246, 0.04)',
              border: '1px solid rgba(59, 130, 246, 0.1)',
              maxHeight: 200,
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            <pre
              style={{
                fontSize: 13,
                color: '#93c5fd',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              {content}
            </pre>
            <span
              style={{
                color: '#60a5fa',
                fontSize: 14,
                fontWeight: 300,
                animation: 'thinking-blink 1s step-end infinite',
                marginLeft: 2,
              }}
            >
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
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          borderRadius: 9999,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          color: 'rgba(255, 255, 255, 0.55)',
          fontSize: 13,
          fontWeight: 400,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          letterSpacing: '0.2px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.55)';
        }}
      >
        {/* Lightbulb icon — subtle gray */}
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
          <span
            style={{
              fontSize: 10,
              fontWeight: 400,
              color: 'rgba(255, 255, 255, 0.3)',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '2px 7px',
              borderRadius: 999,
              letterSpacing: '0.3px',
            }}
          >
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
            <div
              style={{
                marginTop: 8,
                borderRadius: 12,
                overflow: 'hidden',
                background: 'rgba(59, 130, 246, 0.04)',
                border: '1px solid rgba(59, 130, 246, 0.1)',
              }}
            >
              {/* Tabs — only show if there are commands */}
              {hasCommands && (
                <div
                  style={{
                    display: 'flex',
                    borderBottom: '1px solid rgba(59, 130, 246, 0.1)',
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('reasoning');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 500,
                      border: 'none',
                      borderBottom: `2px solid ${activeTab === 'reasoning' ? '#60a5fa' : 'transparent'}`,
                      color: activeTab === 'reasoning' ? '#60a5fa' : 'rgba(255,255,255,0.35)',
                      background: 'none',
                      cursor: 'pointer',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                    }}
                  >
                    <span>🧠</span> Raciocínio
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('commands');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 500,
                      border: 'none',
                      borderBottom: `2px solid ${activeTab === 'commands' ? '#60a5fa' : 'transparent'}`,
                      color: activeTab === 'commands' ? '#60a5fa' : 'rgba(255,255,255,0.35)',
                      background: 'none',
                      cursor: 'pointer',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                    }}
                  >
                    <span>⚡</span> Comandos ({commands.length})
                  </button>
                </div>
              )}

              {/* Content area */}
              <div style={{ padding: '12px 16px' }}>
                {activeTab === 'reasoning' || !hasCommands ? (
                  <pre
                    style={{
                      fontSize: 13,
                      color: '#93c5fd',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                      lineHeight: 1.7,
                      maxHeight: 288,
                      overflowY: 'auto',
                      margin: 0,
                    }}
                  >
                    {reasoning || content}
                  </pre>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      maxHeight: 288,
                      overflowY: 'auto',
                    }}
                  >
                    {commands.map((cmd, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: '#60a5fa',
                            fontFamily: 'monospace',
                            flexShrink: 0,
                            marginTop: 2,
                          }}
                        >
                          $
                        </span>
                        <code
                          style={{
                            fontSize: 12,
                            color: '#6ee7b7',
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                            lineHeight: 1.6,
                          }}
                        >
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

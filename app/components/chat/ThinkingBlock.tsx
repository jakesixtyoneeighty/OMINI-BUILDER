import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

export const ThinkingBlock = memo(({ content, isStreaming = false }: ThinkingBlockProps) => {
  const [isOpen, setIsOpen] = useState(isStreaming);

  if (!content) {
    return null;
  }

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
          Raciocínio da IA
        </span>

        {/* Duration hint when complete */}
        {!isStreaming && content && (
          <span className="text-[10px] text-bolt-elements-textTertiary">
            {content.split(/\s+/).length > 20 ? 'Thought' : 'Thought'}
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
            <div className="px-4 py-2.5 border-t border-bolt-elements-borderColor/50">
              <pre className="text-[11px] text-bolt-elements-textTertiary whitespace-pre-wrap break-words font-mono leading-relaxed max-h-64 overflow-y-auto">
                {content}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

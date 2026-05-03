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
    <div className="mb-3 rounded-lg border border-bolt-elements-borderColor overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-medium text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isStreaming ? (
          <div className="i-svg-spinners:90-ring-with-bg text-sm text-bolt-elements-loader-progress" />
        ) : (
          <div className="i-ph:brain-duotone text-sm text-bolt-elements-textTertiary" />
        )}
        <span>Raciocínio da IA</span>
        {!isStreaming && (
          <div
            className={classNames(
              'i-ph:caret-down-bold text-xs ml-auto transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        )}
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
            <div className="px-3 py-2.5 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1/30">
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

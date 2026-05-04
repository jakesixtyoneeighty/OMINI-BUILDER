import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createHighlighter, type BundledLanguage, type BundledTheme, type HighlighterGeneric } from 'shiki';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';

const highlighterOptions = {
  langs: ['shell'],
  themes: ['light-plus', 'dark-plus'],
};

const shellHighlighter: HighlighterGeneric<BundledLanguage, BundledTheme> =
  import.meta.hot?.data.shellHighlighter ?? (await createHighlighter(highlighterOptions));

if (import.meta.hot) {
  import.meta.hot.data.shellHighlighter = shellHighlighter;
}

interface ArtifactProps {
  messageId: string;
}

export const Artifact = memo(({ messageId }: ArtifactProps) => {
  const artifacts = useStore(workbenchStore.artifacts);
  const artifact = artifacts[messageId];

  const actions = useStore(
    computed(artifact.runner.actions, (actions) => {
      return Object.values(actions);
    }),
  );

  // Check if any action is still running or pending (for animated border)
  const isProcessing = useMemo(() => {
    return actions.some((a) => a.status === 'running' || a.status === 'pending');
  }, [actions]);

  const [showActions, setShowActions] = useState(true);

  useEffect(() => {
    if (actions.length && !showActions) {
      setShowActions(true);
    }
  }, [actions]);

  // Extract a short command description for shell actions
  const getCommandLabel = (content: string): string => {
    const trimmed = content.trim();
    const firstLine = trimmed.split('\n')[0].trim();

    // Detect common patterns
    const npmInstall = trimmed.match(/npm\s+install\s+(.+)/);
    const npxCmd = trimmed.match(/npx\s+(\S+)/);
    const pipInstall = trimmed.match(/pip\s+install\s+(.+)/);

    if (npmInstall) {
      const packages = npmInstall[1].trim();
      return `Installed ${packages.split(/\s+/).length} package${packages.split(/\s+/).length > 1 ? 's' : ''}`;
    }
    if (npxCmd) {
      return `Ran ${npxCmd[1]}`;
    }
    if (pipInstall) {
      const packages = pipInstall[1].trim();
      return `Installed ${packages.split(/\s+/).length} package${packages.split(/\s+/).length > 1 ? 's' : ''}`;
    }

    // Return first line truncated
    return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
  };

  return (
    <div
      className={classNames(
        'my-3 rounded-xl overflow-hidden transition-all duration-300',
        isProcessing
          ? 'artifact-processing border border-transparent'
          : 'border border-bolt-elements-borderColor',
      )}
      style={isProcessing ? {
        background: 'linear-gradient(var(--gradient-angle, 0deg), rgba(99,102,241,0.15), rgba(168,85,247,0.15), rgba(59,130,246,0.15), rgba(99,102,241,0.15))',
        backgroundSize: '300% 300%',
        animation: 'gradientShift 3s ease infinite',
        border: '1px solid rgba(99,102,241,0.3)',
      } : {
        background: 'var(--bolt-elements-artifacts-background, rgba(255,255,255,0.03))',
      }}
    >
      {/* Header - artifact title */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-bolt-elements-item-backgroundActive transition-colors"
        onClick={() => {
          const showWorkbench = workbenchStore.showWorkbench.get();
          workbenchStore.showWorkbench.set(!showWorkbench);
        }}
      >
        <div className="i-ph:cube-duotone text-base text-bolt-elements-textTertiary shrink-0" />
        <span className="text-sm font-semibold text-bolt-elements-textPrimary flex-1 truncate">
          {artifact?.title || 'Project'}
        </span>
        <span className="text-[10px] text-bolt-elements-textTertiary hidden sm:inline">
          Abrir Workbench
        </span>
        <div className="i-ph:arrow-square-out text-xs text-bolt-elements-textTertiary" />
      </div>

      {/* Action Timeline */}
      <AnimatePresence>
        {showActions && actions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: cubicEasingFn }}
            className="overflow-hidden"
          >
            <div className="border-t border-bolt-elements-borderColor">
              <ul className="list-none">
                {actions.map((action, index) => {
                  const isLast = index === actions.length - 1;

                  return (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: index * 0.03,
                        ease: cubicEasingFn,
                      }}
                    >
                      {action.type === 'file' ? (
                        <FileActionItem action={action} isLast={isLast} />
                      ) : action.type === 'shell' ? (
                        <ShellActionItem action={action} isLast={isLast} getCommandLabel={getCommandLabel} />
                      ) : null}
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline keyframes for animated gradient */}
      <style>{`
        @keyframes gradientShift {
          0% { --gradient-angle: 0deg; }
          50% { --gradient-angle: 180deg; }
          100% { --gradient-angle: 360deg; }
        }

        @property --gradient-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }

        .artifact-processing {
          position: relative;
        }

        .artifact-processing::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(
            var(--gradient-angle, 0deg),
            rgba(99,102,241,0.6),
            rgba(168,85,247,0.6),
            rgba(59,130,246,0.6),
            rgba(99,102,241,0.6)
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: borderRotate 3s linear infinite;
          pointer-events: none;
          z-index: 1;
        }

        @keyframes borderRotate {
          0% { --gradient-angle: 0deg; }
          100% { --gradient-angle: 360deg; }
        }
      `}</style>
    </div>
  );
});

/* ===== File Action Item ===== */

function FileActionItem({ action, isLast }: { action: ActionState; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const fileName = action.filePath?.split('/').pop() || '';
  const dirPath = action.filePath?.substring(0, action.filePath.lastIndexOf('/')) || '';

  const isCreated = action.isNewFile !== false;
  const isComplete = action.status === 'complete';
  const isRunning = action.status === 'running';
  const isFailed = action.status === 'failed';

  return (
    <div
      className={classNames(
        'flex items-center gap-2.5 px-4 py-2.5 transition-colors cursor-pointer group',
        !isLast && 'border-b border-bolt-elements-borderColor/50',
        'hover:bg-bolt-elements-item-backgroundActive/50',
      )}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Status icon */}
      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
        {isRunning ? (
          <div className="i-svg-spinners:90-ring-with-bg text-sm text-bolt-elements-loader-progress" />
        ) : isComplete ? (
          <div className="i-ph:check-circle-fill text-sm text-emerald-400" />
        ) : isFailed ? (
          <div className="i-ph:x-circle-fill text-sm text-red-400" />
        ) : action.status === 'pending' ? (
          <div className="i-ph:circle-dashed text-sm text-bolt-elements-textTertiary" />
        ) : (
          <div className="i-ph:circle-dashed text-sm text-bolt-elements-textTertiary" />
        )}
      </div>

      {/* Action type icon */}
      <div className={classNames(
        'shrink-0 w-5 h-5 flex items-center justify-center rounded',
        isCreated ? 'bg-emerald-500/10' : 'bg-amber-500/10',
      )}>
        {isCreated ? (
          <div className="i-ph:file-plus text-xs text-emerald-400" />
        ) : (
          <div className="i-ph:pencil-simple text-xs text-amber-400" />
        )}
      </div>

      {/* Text content */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={classNames(
          'text-xs font-medium shrink-0',
          isCreated ? 'text-emerald-400' : 'text-amber-400',
        )}>
          {isCreated ? 'Created' : 'Edited'}
        </span>
        <code className="text-xs text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2/80 px-1.5 py-0.5 rounded truncate">
          {action.filePath || fileName}
        </code>

        {/* Diff stats for edits */}
        {!isCreated && isComplete && (action.additions !== undefined || action.deletions !== undefined) && (
          <span className="text-[11px] font-mono shrink-0 flex items-center gap-1">
            {action.additions !== undefined && action.additions > 0 && (
              <span className="text-emerald-400">+{action.additions}</span>
            )}
            {action.deletions !== undefined && action.deletions > 0 && (
              <span className="text-red-400">-{action.deletions}</span>
            )}
          </span>
        )}

        {/* Line count for new files */}
        {isCreated && isComplete && action.additions !== undefined && action.additions > 0 && (
          <span className="text-[11px] font-mono text-emerald-400 shrink-0">
            +{action.additions}
          </span>
        )}
      </div>

      {/* Expand chevron */}
      <div className={classNames(
        'shrink-0 text-bolt-elements-textTertiary transition-transform duration-200',
        expanded && 'rotate-180',
      )}>
        <div className="i-ph:caret-down text-xs" />
      </div>

      {/* Expanded code view */}
      <AnimatePresence>
        {expanded && action.content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-3 mt-2 mx-2 rounded-lg shadow-lg max-h-[300px] overflow-auto">
              <pre className="text-[11px] font-mono text-bolt-elements-textSecondary whitespace-pre-wrap break-all leading-relaxed">
                {action.content}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ===== Shell Action Item ===== */

function ShellActionItem({
  action,
  isLast,
  getCommandLabel,
}: {
  action: ActionState;
  isLast: boolean;
  getCommandLabel: (content: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  const isComplete = action.status === 'complete';
  const isRunning = action.status === 'running';
  const isFailed = action.status === 'failed';

  return (
    <div className={!isLast ? 'border-b border-bolt-elements-borderColor/50' : ''}>
      {/* Command summary line */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 transition-colors cursor-pointer group hover:bg-bolt-elements-item-backgroundActive/50"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status icon */}
        <div className="shrink-0 w-5 h-5 flex items-center justify-center">
          {isRunning ? (
            <div className="i-svg-spinners:90-ring-with-bg text-sm text-bolt-elements-loader-progress" />
          ) : isComplete ? (
            <div className="i-ph:check-circle-fill text-sm text-emerald-400" />
          ) : isFailed ? (
            <div className="i-ph:x-circle-fill text-sm text-red-400" />
          ) : action.status === 'pending' ? (
            <div className="i-ph:circle-dashed text-sm text-bolt-elements-textTertiary" />
          ) : (
            <div className="i-ph:circle-dashed text-sm text-bolt-elements-textTertiary" />
          )}
        </div>

        {/* Command type icon */}
        <div className="shrink-0 w-5 h-5 flex items-center justify-center rounded bg-blue-500/10">
          <div className="i-ph:terminal text-xs text-blue-400" />
        </div>

        {/* Command label */}
        <span className="text-xs text-bolt-elements-textPrimary flex-1 truncate font-medium">
          {getCommandLabel(action.content)}
        </span>

        {/* Expand chevron */}
        <div className={classNames(
          'shrink-0 text-bolt-elements-textTertiary transition-transform duration-200',
          expanded && 'rotate-180',
        )}>
          <div className="i-ph:caret-down text-xs" />
        </div>
      </div>

      {/* Expanded command view */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pb-3">
              <ShellCodeBlock code={action.content} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ===== Shell Code Block ===== */

function ShellCodeBlock({ code }: { code: string }) {
  return (
    <div
      className="text-xs rounded-lg overflow-hidden bg-[#1e1e1e] border border-bolt-elements-borderColor/30"
      dangerouslySetInnerHTML={{
        __html: shellHighlighter.codeToHtml(code, {
          lang: 'shell',
          theme: 'dark-plus',
        }),
      }}
    />
  );
}

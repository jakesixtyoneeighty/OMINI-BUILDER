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

  // Group file actions by type
  const { createdFiles, editedFiles, shellActions, hasBuild } = useMemo(() => {
    const created: ActionState[] = [];
    const edited: ActionState[] = [];
    const shell: ActionState[] = [];
    let buildDetected = false;

    for (const action of actions) {
      if (action.type === 'file') {
        const isCreated = action.isNewFile !== false;
        if (isCreated) {
          created.push(action);
        } else {
          edited.push(action);
        }
      } else if (action.type === 'shell') {
        shell.push(action);
        // Detect build commands
        const content = action.content?.toLowerCase() || '';
        if (
          content.includes('npm run build') ||
          content.includes('npm run dev') ||
          content.includes('pnpm build') ||
          content.includes('pnpm dev') ||
          content.includes('yarn build') ||
          content.includes('yarn dev') ||
          content.includes('vite build') ||
          content.includes('next build') ||
          content.includes('npx vite build') ||
          content.includes('remix vite:build')
        ) {
          buildDetected = true;
        }
      }
    }

    return { createdFiles: created, editedFiles: edited, shellActions: shell, hasBuild: buildDetected };
  }, [actions]);

  // Extract a short command description for shell actions
  const getCommandLabel = (content: string): string => {
    const trimmed = content.trim();
    const firstLine = trimmed.split('\n')[0].trim();

    const npmInstall = trimmed.match(/npm\s+install\s+(.+)/);
    const npxCmd = trimmed.match(/npx\s+(\S+)/);
    const pipInstall = trimmed.match(/pip\s+install\s+(.+)/);
    const pnpmInstall = trimmed.match(/pnpm\s+(?:add|install)\s+(.+)/);

    if (npmInstall) {
      const packages = npmInstall[1].trim();
      return `Installed ${packages.split(/\s+/).length} package${packages.split(/\s+/).length > 1 ? 's' : ''}`;
    }
    if (pnpmInstall) {
      const packages = pnpmInstall[1].trim();
      return `Installed ${packages.split(/\s+/).length} package${packages.split(/\s+/).length > 1 ? 's' : ''}`;
    }
    if (npxCmd) {
      return `Ran ${npxCmd[1]}`;
    }
    if (pipInstall) {
      const packages = pipInstall[1].trim();
      return `Installed ${packages.split(/\s+/).length} package${packages.split(/\s+/).length > 1 ? 's' : ''}`;
    }

    return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
  };

  const hasContent = createdFiles.length > 0 || editedFiles.length > 0 || shellActions.length > 0;

  return (
    <div
      className={classNames(
        'my-3 rounded-xl overflow-hidden transition-all duration-300',
        isProcessing
          ? 'artifact-processing border border-transparent'
          : 'border border-[#e0e0e0] dark:border-bolt-elements-borderColor',
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
      {/* Header - clickable to open workbench */}
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

      {/* Action Timeline - grouped by type */}
      <AnimatePresence>
        {showActions && hasContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: cubicEasingFn }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#e0e0e0] dark:border-bolt-elements-borderColor">
              {/* Created Files Section */}
              {createdFiles.length > 0 && (
                <div className="border-b border-[#e0e0e0]/50 dark:border-bolt-elements-borderColor/50">
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#f8f9fa] dark:bg-bolt-elements-background-depth-1">
                    <div className="i-ph:file-plus text-xs text-emerald-500" />
                    <span className="text-xs font-medium text-bolt-elements-textSecondary">
                      Created {createdFiles.length} file{createdFiles.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* File list */}
                  <ul className="list-none">
                    {createdFiles.map((action, index) => (
                      <motion.li
                        key={`created-${index}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                      >
                        <FileActionItem action={action} isLast={index === createdFiles.length - 1} label="Created file" />
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Edited Files Section */}
              {editedFiles.length > 0 && (
                <div className="border-b border-[#e0e0e0]/50 dark:border-bolt-elements-borderColor/50">
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#f8f9fa] dark:bg-bolt-elements-background-depth-1">
                    <div className="i-ph:pencil-simple text-xs text-amber-500" />
                    <span className="text-xs font-medium text-bolt-elements-textSecondary">
                      Edited {editedFiles.length} file{editedFiles.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* File list */}
                  <ul className="list-none">
                    {editedFiles.map((action, index) => (
                      <motion.li
                        key={`edited-${index}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                      >
                        <FileActionItem action={action} isLast={index === editedFiles.length - 1} label="Edited file" />
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Shell Commands Section */}
              {shellActions.length > 0 && !hasBuild && (
                <div>
                  <ul className="list-none">
                    {shellActions.map((action, index) => (
                      <motion.li
                        key={`shell-${index}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                      >
                        <ShellActionItem action={action} isLast={index === shellActions.length - 1} getCommandLabel={getCommandLabel} />
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Built Section - shows when a build command was detected */}
              {hasBuild && (
                <div>
                  {/* Built header */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#f8f9fa] dark:bg-bolt-elements-background-depth-1">
                    <div className="i-ph:wrench text-xs text-blue-500" />
                    <span className="text-xs font-medium text-bolt-elements-textSecondary">
                      Built
                    </span>
                  </div>
                  {/* Build commands */}
                  <ul className="list-none">
                    {shellActions.map((action, index) => (
                      <motion.li
                        key={`build-${index}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                      >
                        <ShellActionItem
                          action={action}
                          isLast={index === shellActions.length - 1}
                          getCommandLabel={getCommandLabel}
                          isBuildSection
                        />
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}
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

function FileActionItem({ action, isLast, label }: { action: ActionState; isLast: boolean; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const fileName = action.filePath?.split('/').pop() || '';
  const dirPath = action.filePath?.substring(0, action.filePath.lastIndexOf('/')) || '';

  const isCreated = action.isNewFile !== false;
  const isComplete = action.status === 'complete';
  const isRunning = action.status === 'running';
  const isFailed = action.status === 'failed';

  return (
    <div className={!isLast ? 'border-b border-[#e0e0e0]/30 dark:border-bolt-elements-borderColor/30' : ''}>
      {/* Action summary line - click to expand/collapse */}
      <div
        className="flex items-center gap-3 px-4 py-2 transition-colors cursor-pointer group hover:bg-bolt-elements-item-backgroundActive/30"
        onClick={() => setExpanded(!expanded)}
      >
        {/* File path */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-xs text-bolt-elements-textPrimary truncate font-mono">
            {action.filePath || fileName}
          </span>

          {/* Diff stats for edits */}
          {!isCreated && isComplete && (action.additions !== undefined || action.deletions !== undefined) && (
            <span className="text-[10px] font-mono shrink-0 flex items-center gap-1">
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
            <span className="text-[10px] font-mono text-emerald-400 shrink-0">
              +{action.additions}
            </span>
          )}
        </div>

        {/* Status icon - right aligned */}
        <div className="shrink-0 w-4 h-4 flex items-center justify-center">
          {isRunning ? (
            <div className="i-svg-spinners:90-ring-with-bg text-xs text-indigo-400" />
          ) : isComplete ? (
            <div className="i-ph:check text-sm text-emerald-500" />
          ) : isFailed ? (
            <div className="i-ph:x text-sm text-red-400" />
          ) : (
            <div className="i-ph:circle-dashed text-xs text-bolt-elements-textTertiary" />
          )}
        </div>

        {/* Expand chevron */}
        <div className={classNames(
          'shrink-0 text-bolt-elements-textTertiary transition-transform duration-200',
          expanded && 'rotate-180',
        )}>
          <div className="i-ph:caret-down text-[10px]" />
        </div>
      </div>

      {/* Expanded code view */}
      <AnimatePresence>
        {expanded && action.content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              <div className="border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-3 rounded-lg max-h-[300px] overflow-auto">
                <pre className="text-[11px] font-mono text-bolt-elements-textSecondary whitespace-pre-wrap break-all leading-relaxed">
                  {action.content}
                </pre>
              </div>
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
  isBuildSection = false,
}: {
  action: ActionState;
  isLast: boolean;
  getCommandLabel: (content: string) => string;
  isBuildSection?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const isComplete = action.status === 'complete';
  const isRunning = action.status === 'running';
  const isFailed = action.status === 'failed';

  return (
    <div className={!isLast ? 'border-b border-[#e0e0e0]/30 dark:border-bolt-elements-borderColor/30' : ''}>
      {/* Command summary line */}
      <div
        className="flex items-center gap-3 px-4 py-2 transition-colors cursor-pointer group hover:bg-bolt-elements-item-backgroundActive/30"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Command label */}
        <span className="text-xs text-bolt-elements-textPrimary flex-1 truncate font-medium">
          {isBuildSection ? action.content?.trim().split('\n')[0] || 'Build command' : getCommandLabel(action.content)}
        </span>

        {/* Status icon */}
        <div className="shrink-0 w-4 h-4 flex items-center justify-center">
          {isRunning ? (
            <div className="i-svg-spinners:90-ring-with-bg text-xs text-indigo-400" />
          ) : isComplete ? (
            <div className="i-ph:check text-sm text-emerald-500" />
          ) : isFailed ? (
            <div className="i-ph:x text-sm text-red-400" />
          ) : (
            <div className="i-ph:circle-dashed text-xs text-bolt-elements-textTertiary" />
          )}
        </div>

        {/* Expand chevron */}
        <div className={classNames(
          'shrink-0 text-bolt-elements-textTertiary transition-transform duration-200',
          expanded && 'rotate-180',
        )}>
          <div className="i-ph:caret-down text-[10px]" />
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

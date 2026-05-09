import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useEffect, useMemo, useState } from 'react';
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

/**
 * Determines if a shell action is a build command.
 */
function isBuildCommand(content: string): boolean {
  const lower = content?.toLowerCase() || '';
  return (
    lower.includes('npm run build') ||
    lower.includes('pnpm build') ||
    lower.includes('yarn build') ||
    lower.includes('vite build') ||
    lower.includes('next build') ||
    lower.includes('npx vite build') ||
    lower.includes('remix vite:build') ||
    lower.includes('npm run dev') ||
    lower.includes('pnpm dev') ||
    lower.includes('yarn dev')
  );
}

/**
 * Determines if a shell action is an install command.
 */
function isInstallCommand(content: string): boolean {
  const lower = content?.toLowerCase() || '';
  return (
    lower.includes('npm install') ||
    lower.includes('npm i ') ||
    lower.includes('pnpm add') ||
    lower.includes('pnpm install') ||
    lower.includes('yarn add') ||
    lower.includes('pip install')
  );
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

  // Group actions: files by created/edited, shells by type (install, build, other)
  const { createdFiles, editedFiles, installActions, buildActions, otherShellActions } = useMemo(() => {
    const created: ActionState[] = [];
    const edited: ActionState[] = [];
    const installs: ActionState[] = [];
    const builds: ActionState[] = [];
    const otherShell: ActionState[] = [];

    for (const action of actions) {
      if (action.type === 'file') {
        const isCreated = action.isNewFile !== false;
        if (isCreated) {
          created.push(action);
        } else {
          edited.push(action);
        }
      } else if (action.type === 'shell') {
        if (isBuildCommand(action.content)) {
          builds.push(action);
        } else if (isInstallCommand(action.content)) {
          installs.push(action);
        } else {
          otherShell.push(action);
        }
      }
    }

    return { createdFiles: created, editedFiles: edited, installActions: installs, buildActions: builds, otherShellActions: otherShell };
  }, [actions]);

  const hasContent = actions.length > 0;

  // Section definitions in display order
  const sections = useMemo(() => {
    const result: { key: string; label: string; icon: string; iconColor: string; actions: ActionState[] }[] = [];

    if (createdFiles.length > 0) {
      result.push({
        key: 'created',
        label: `Created ${createdFiles.length} file${createdFiles.length > 1 ? 's' : ''}`,
        icon: 'i-ph:file-plus',
        iconColor: 'text-emerald-500',
        actions: createdFiles,
      });
    }

    if (editedFiles.length > 0) {
      result.push({
        key: 'edited',
        label: `Edited ${editedFiles.length} file${editedFiles.length > 1 ? 's' : ''}`,
        icon: 'i-ph:pencil-simple',
        iconColor: 'text-amber-500',
        actions: editedFiles,
      });
    }

    if (installActions.length > 0) {
      result.push({
        key: 'install',
        label: `Installed packages`,
        icon: 'i-ph:package',
        iconColor: 'text-violet-500',
        actions: installActions,
      });
    }

    if (otherShellActions.length > 0) {
      result.push({
        key: 'shell',
        label: `Ran ${otherShellActions.length} command${otherShellActions.length > 1 ? 's' : ''}`,
        icon: 'i-ph:terminal',
        iconColor: 'text-blue-500',
        actions: otherShellActions,
      });
    }

    if (buildActions.length > 0) {
      result.push({
        key: 'built',
        label: 'Built',
        icon: 'i-ph:wrench',
        iconColor: 'text-blue-500',
        actions: buildActions,
      });
    }

    return result;
  }, [createdFiles, editedFiles, installActions, buildActions, otherShellActions]);

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

      {/* Action Timeline - all actions grouped together */}
      <AnimatePresence>
        {showActions && hasContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: cubicEasingFn }}
            className="overflow-hidden"
          >
            <div className="border-t border-bolt-elements-borderColor">
              {sections.map((section, sIdx) => (
                <div
                  key={section.key}
                  className={sIdx < sections.length - 1 ? 'border-b border-bolt-elements-borderColor/50' : ''}
                >
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-bolt-elements-bg-depth-2">
                    <div className={`${section.icon} text-xs ${section.iconColor}`} />
                    <span className="text-xs font-medium text-bolt-elements-textSecondary">
                      {section.label}
                    </span>
                  </div>
                  {/* Action items */}
                  <ul className="list-none">
                    {section.actions.map((action, index) => (
                      <motion.li
                        key={`${section.key}-${index}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                      >
                        {action.type === 'file' ? (
                          <FileActionItem
                            action={action}
                            isLast={index === section.actions.length - 1}
                            sectionKey={section.key}
                          />
                        ) : (
                          <ShellActionItem
                            action={action}
                            isLast={index === section.actions.length - 1}
                            isBuildSection={section.key === 'built'}
                            isInstallSection={section.key === 'install'}
                          />
                        )}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              ))}
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

function FileActionItem({ action, isLast, sectionKey }: { action: ActionState; isLast: boolean; sectionKey: string }) {
  const [expanded, setExpanded] = useState(false);
  const fileName = action.filePath?.split('/').pop() || '';

  const isCreated = sectionKey === 'created';
  const isComplete = action.status === 'complete';
  const isRunning = action.status === 'running';
  const isFailed = action.status === 'failed';

  return (
    <div className={!isLast ? 'border-b border-bolt-elements-borderColor/30' : ''}>
      {/* Action summary line */}
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
  isBuildSection = false,
  isInstallSection = false,
}: {
  action: ActionState;
  isLast: boolean;
  isBuildSection?: boolean;
  isInstallSection?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const isComplete = action.status === 'complete';
  const isRunning = action.status === 'running';
  const isFailed = action.status === 'failed';

  // Get a friendly label for the command
  const getLabel = () => {
    const content = action.content?.trim() || '';
    const firstLine = content.split('\n')[0].trim();

    if (isBuildSection) return firstLine;
    if (isInstallSection) {
      const npmMatch = content.match(/npm\s+(?:install|i)\s+(.+)/);
      const pnpmMatch = content.match(/pnpm\s+(?:add|install)\s+(.+)/);
      const yarnMatch = content.match(/yarn\s+add\s+(.+)/);
      const pipMatch = content.match(/pip\s+install\s+(.+)/);

      const match = npmMatch || pnpmMatch || yarnMatch || pipMatch;
      if (match) {
        const packages = match[1].trim();
        return `Installed ${packages.split(/\s+/).length} package${packages.split(/\s+/).length > 1 ? 's' : ''}: ${firstLine}`;
      }
      return firstLine;
    }

    // Detect common patterns
    const npxMatch = content.match(/npx\s+(\S+)/);
    if (npxMatch) return `Ran ${npxMatch[1]}`;

    return firstLine.length > 60 ? firstLine.substring(0, 57) + '...' : firstLine;
  };

  return (
    <div className={!isLast ? 'border-b border-bolt-elements-borderColor/30' : ''}>
      {/* Command summary line */}
      <div
        className="flex items-center gap-3 px-4 py-2 transition-colors cursor-pointer group hover:bg-bolt-elements-item-backgroundActive/30"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Command text */}
        <span className="text-xs text-bolt-elements-textPrimary flex-1 truncate font-mono">
          {getLabel()}
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
      className="text-xs rounded-lg overflow-hidden bg-bolt-elements-code-background border border-bolt-elements-borderColor/30"
      dangerouslySetInnerHTML={{
        __html: shellHighlighter.codeToHtml(code, {
          lang: 'shell',
          theme: 'dark-plus',
        }),
      }}
    />
  );
}

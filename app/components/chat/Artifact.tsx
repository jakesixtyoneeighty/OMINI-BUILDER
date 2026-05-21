import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useEffect, useMemo, useState } from 'react';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { useT } from '~/lib/i18n/useT';

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
  const t = useT();
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

    return {
      createdFiles: created,
      editedFiles: edited,
      installActions: installs,
      buildActions: builds,
      otherShellActions: otherShell,
    };
  }, [actions]);

  const hasContent = actions.length > 0;

  // Section definitions in display order
  const sections = useMemo(() => {
    const result: { key: string; label: string; icon: string; iconColor: string; actions: ActionState[] }[] = [];

    if (installActions.length > 0) {
      result.push({
        key: 'install',
        label: t('artifact.installedPackages'),
        icon: 'i-ph:download-simple',
        iconColor: 'text-blue-500',
        actions: installActions,
      });
    }

    if (createdFiles.length > 0) {
      result.push({
        key: 'created',
        label:
          createdFiles.length > 1
            ? t('artifact.createdPlural', { count: createdFiles.length })
            : t('artifact.created', { count: createdFiles.length }),
        icon: 'i-ph:file-plus',
        iconColor: 'text-emerald-500',
        actions: createdFiles,
      });
    }

    if (editedFiles.length > 0) {
      result.push({
        key: 'edited',
        label:
          editedFiles.length > 1
            ? t('artifact.editedPlural', { count: editedFiles.length })
            : t('artifact.edited', { count: editedFiles.length }),
        icon: 'i-ph:pencil-simple',
        iconColor: 'text-amber-500',
        actions: editedFiles,
      });
    }

    if (otherShellActions.length > 0) {
      result.push({
        key: 'shell',
        label:
          otherShellActions.length > 1
            ? t('artifact.ranPlural', { count: otherShellActions.length })
            : t('artifact.ran', { count: otherShellActions.length }),
        icon: 'i-ph:terminal',
        iconColor: 'text-slate-500',
        actions: otherShellActions,
      });
    }

    if (buildActions.length > 0) {
      result.push({
        key: 'built',
        label: t('artifact.built'),
        icon: 'i-ph:wrench',
        iconColor: 'text-slate-500',
        actions: buildActions,
      });
    }

    return result;
  }, [createdFiles, editedFiles, installActions, buildActions, otherShellActions, t]);

  // Calculate totals for header
  const totalFiles = createdFiles.length + editedFiles.length;
  const totalInstalls = installActions.length;
  const totalBuilds = buildActions.length;

  return (
    <div
      className={classNames(
        'my-3 rounded-xl overflow-hidden transition-all duration-300 border border-bolt-elements-borderColor/60 bg-bolt-elements-bg-depth-2',
        isProcessing && 'artifact-processing-ring',
      )}
    >
      {/* Header - Action History */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-bolt-elements-item-backgroundActive/50 transition-colors border-b border-bolt-elements-borderColor/60"
        onClick={() => {
          const showWorkbench = workbenchStore.showWorkbench.get();
          workbenchStore.showWorkbench.set(!showWorkbench);
        }}
      >
        <div className="i-ph:clipboard-text text-base text-bolt-elements-textSecondary shrink-0" />
        <span className="text-sm font-semibold text-bolt-elements-textPrimary flex-1">
          {t('artifact.actionHistory')}
        </span>
        <span className="text-[10px] text-bolt-elements-textTertiary hidden sm:inline">
          {t('artifact.openWorkbench')}
        </span>
        <div className="i-ph:arrow-square-out text-xs text-bolt-elements-textTertiary" />
      </div>

      {/* Subtitle */}
      <div className="px-4 py-2 border-b border-bolt-elements-borderColor/40">
        <p className="text-xs text-bolt-elements-textSecondary">
          {t('artifact.actionsSubtitle')}
        </p>
      </div>

      {/* Action Timeline */}
      <AnimatePresence>
        {showActions && hasContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: cubicEasingFn }}
            className="overflow-hidden"
          >
            <div>
              {sections.map((section, sIdx) => (
                <div
                  key={section.key}
                  className={sIdx < sections.length - 1 ? 'border-b border-bolt-elements-borderColor/30' : ''}
                >
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <div className={`${section.icon} text-sm ${section.iconColor} shrink-0`} />
                    <span className="text-sm font-medium text-bolt-elements-textPrimary">
                      {section.label}
                    </span>
                  </div>

                  {/* Action items - clean list with checkmarks */}
                  {section.actions.length > 0 && section.key !== 'install' && section.key !== 'built' && (
                    <ul className="list-none pb-1">
                      {section.actions.map((action, index) => (
                        <motion.li
                          key={`${section.key}-${index}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: index * 0.03 }}
                        >
                          <FileActionItem action={action} />
                        </motion.li>
                      ))}
                    </ul>
                  )}

                  {/* Install section - show packages as tags */}
                  {section.key === 'install' && section.actions.length > 0 && (
                    <InstallActionItems actions={section.actions} />
                  )}

                  {/* Build section - show build info */}
                  {section.key === 'built' && section.actions.length > 0 && (
                    <BuildActionItems actions={section.actions} />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!hasContent && (
        <div className="px-4 py-6 text-center">
          <div className="i-ph:cube text-2xl text-bolt-elements-textTertiary mx-auto mb-2" />
          <p className="text-xs text-bolt-elements-textTertiary">{t('artifact.noActions')}</p>
        </div>
      )}

      {/* Inline keyframes for animated border when processing */}
      {isProcessing && (
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

          .artifact-processing-ring {
            position: relative;
            border: 1px solid transparent;
            background: linear-gradient(var(--bolt-elements-bg-depth-2), var(--bolt-elements-bg-depth-2)) padding-box,
              linear-gradient(var(--gradient-angle, 0deg), rgba(99,102,241,0.5), rgba(168,85,247,0.5), rgba(59,130,246,0.5)) border-box;
            animation: gradientShift 3s ease infinite;
          }
        `}</style>
      )}
    </div>
  );
});

/* ===== File Action Item - Clean with checkmark ===== */

function FileActionItem({ action }: { action: ActionState }) {
  const fileName = action.filePath?.split('/').pop() || '';

  const isComplete = action.status === 'complete';
  const isRunning = action.status === 'running';
  const isFailed = action.status === 'failed';

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 group">
      {/* File path */}
      <span className="text-xs text-bolt-elements-textSecondary truncate font-mono flex-1 pl-6">
        {action.filePath || fileName}
      </span>

      {/* Status icon - clean checkmark circle */}
      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
        {isRunning ? (
          <div className="i-svg-spinners:90-ring-with-bg text-xs text-indigo-400" />
        ) : isComplete ? (
          <div className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <div className="i-ph:check text-[10px] text-emerald-500" />
          </div>
        ) : isFailed ? (
          <div className="w-4 h-4 rounded-full bg-red-500/15 flex items-center justify-center">
            <div className="i-ph:x text-[10px] text-red-400" />
          </div>
        ) : (
          <div className="w-4 h-4 rounded-full bg-bolt-elements-textTertiary/10 flex items-center justify-center">
            <div className="i-ph:circle text-[8px] text-bolt-elements-textTertiary" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Install Action Items - Package tags ===== */

function InstallActionItems({ actions }: { actions: ActionState[] }) {
  const t = useT();

  // Extract all packages from install commands
  const allPackages = useMemo(() => {
    const packages: string[] = [];
    for (const action of actions) {
      const content = action.content?.trim() || '';
      const npmMatch = content.match(/npm\s+(?:install|i)\s+(.+)/);
      const pnpmMatch = content.match(/pnpm\s+(?:add|install)\s+(.+)/);
      const yarnMatch = content.match(/yarn\s+add\s+(.+)/);
      const pipMatch = content.match(/pip\s+install\s+(.+)/);

      const match = npmMatch || pnpmMatch || yarnMatch || pipMatch;
      if (match) {
        const pkgs = match[1].trim().split(/\s+/);
        packages.push(...pkgs);
      }
    }
    return packages;
  }, [actions]);

  if (allPackages.length === 0) {
    return (
      <div className="px-4 pb-3">
        <span className="text-xs text-bolt-elements-textSecondary font-mono">
          {actions.map(a => a.content?.trim() || '').join(', ')}
        </span>
      </div>
    );
  }

  return (
    <div className="px-4 pb-3">
      <div className="flex flex-wrap gap-1.5">
        {allPackages.map((pkg, i) => (
          <span
            key={`${pkg}-${i}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-medium"
          >
            <div className="i-ph:package text-[10px]" />
            {pkg}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ===== Build Action Items ===== */

function BuildActionItems({ actions }: { actions: ActionState[] }) {
  const t = useT();

  return (
    <div className="px-4 pb-3">
      {actions.map((action, index) => (
        <div key={index} className="flex items-center gap-2 py-0.5">
          <span className="text-xs text-bolt-elements-textSecondary font-mono truncate">
            {action.content?.trim().split('\n')[0] || 'build'}
          </span>
          {action.status === 'running' && (
            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400">
              <div className="i-svg-spinners:90-ring-with-bg text-[10px]" />
              {t('artifact.building')}
            </span>
          )}
          {action.status === 'complete' && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500">
              <div className="i-ph:check-circle text-[10px]" />
              {t('artifact.buildSuccess')}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

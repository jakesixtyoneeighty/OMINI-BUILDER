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

function getActionLabels(action: ActionState): { active: string; done: string; icon: string } {
  if (action.type === 'file') {
    const isNew = action.isNewFile !== false;
    return {
      active: isNew ? 'Creating' : 'Editing',
      done: isNew ? 'Created' : 'Edited',
      icon: isNew ? 'i-ph:file-plus' : 'i-ph:pencil-simple',
    };
  }
  return {
    active: 'Running',
    done: 'Runned',
    icon: 'i-ph:terminal',
  };
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

  const isProcessing = useMemo(() => {
    return actions.some((a) => a.status === 'running' || a.status === 'pending');
  }, [actions]);

  const [showActions, setShowActions] = useState(true);

  useEffect(() => {
    if (actions.length && !showActions) {
      setShowActions(true);
    }
  }, [actions]);

  const hasContent = actions.length > 0;

  return (
    <div
      className={classNames(
        'my-3 rounded-xl overflow-hidden transition-all duration-300 border border-bolt-elements-borderColor/60 bg-bolt-elements-bg-depth-2',
        isProcessing ? 'artifact-processing-ring' : '',
      )}
    >
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

      <div className="px-4 py-2 border-b border-bolt-elements-borderColor/40">
        <p className="text-xs text-bolt-elements-textSecondary">
          {t('artifact.actionsSubtitle')}
        </p>
      </div>

      <AnimatePresence>
        {showActions && hasContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: cubicEasingFn }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2">
              <div className="flex flex-wrap gap-2">
                {actions.map((action, index) => (
                  <motion.div
                    key={`action-${index}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15, delay: index * 0.02 }}
                  >
                    <ActionChip action={action} />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!hasContent && (
        <div className="px-4 py-6 text-center">
          <div className="i-ph:cube text-2xl text-bolt-elements-textTertiary mx-auto mb-2" />
          <p className="text-xs text-bolt-elements-textTertiary">{t('artifact.noActions')}</p>
        </div>
      )}

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

function ActionChip({ action }: { action: ActionState }) {
  const labels = getActionLabels(action);
  const isComplete = action.status === 'complete';
  const isRunning = action.status === 'running';
  const isFailed = action.status === 'failed';
  const [expanded, setExpanded] = useState(false);

  const displayName = action.type === 'file'
    ? (action.filePath?.split('/').pop() || action.filePath || '')
    : (action.content?.trim().split('\n')[0] || 'cmd');

  const fullPath = action.type === 'file' ? action.filePath : '';

  useEffect(() => {
    if (isComplete || isFailed) {
      const timer = setTimeout(() => setExpanded(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, isFailed]);

  const chipClass = classNames(
    'action-chip',
    isRunning ? 'action-chip-active' : isFailed ? 'action-chip-failed' : 'action-chip-done',
  );

  const iconClass = classNames(
    'action-chip-icon',
    labels.icon,
    isRunning ? 'text-indigo-400' : isFailed ? 'text-red-400' : 'text-bolt-elements-textTertiary',
  );

  return (
    <div className="action-chips-container" style={{ gap: 0 }}>
      <button
        type="button"
        className={chipClass}
        onClick={() => setExpanded(!expanded)}
        title={isRunning ? `${labels.active} ${displayName}` : `${labels.done} ${displayName}`}
      >
        <div className={iconClass} style={{ fontSize: 10 }} />
        <span className="action-chip-label">
          {isRunning ? labels.active : labels.done}
        </span>
        <span className="action-chip-name">{displayName}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: cubicEasingFn }}
            className="overflow-hidden"
          >
            <div className="action-chip-content-panel">
              {fullPath && (
                <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>
                  {fullPath}
                </div>
              )}
              {action.content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

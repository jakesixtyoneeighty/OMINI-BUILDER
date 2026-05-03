import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useEffect, useRef, useState } from 'react';
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
  const userToggledActions = useRef(false);
  const [showActions, setShowActions] = useState(false);

  const artifacts = useStore(workbenchStore.artifacts);
  const artifact = artifacts[messageId];

  const actions = useStore(
    computed(artifact.runner.actions, (actions) => {
      return Object.values(actions);
    }),
  );

  const toggleActions = () => {
    userToggledActions.current = true;
    setShowActions(!showActions);
  };

  useEffect(() => {
    if (actions.length && !showActions && !userToggledActions.current) {
      setShowActions(true);
    }
  }, [actions]);

  return (
    <div className="artifact border border-bolt-elements-borderColor flex flex-col overflow-hidden rounded-lg w-full transition-border duration-150">
      <div className="flex">
        <button
          className="flex items-stretch bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover w-full overflow-hidden"
          onClick={() => {
            const showWorkbench = workbenchStore.showWorkbench.get();
            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="px-5 p-3.5 w-full text-left">
            <div className="w-full text-bolt-elements-textPrimary font-medium leading-5 text-sm">{artifact?.title}</div>
            <div className="w-full w-full text-bolt-elements-textSecondary text-xs mt-0.5">Click to open Workbench</div>
          </div>
        </button>
        <div className="bg-bolt-elements-artifacts-borderColor w-[1px]" />
        <AnimatePresence>
          {actions.length && (
            <motion.button
              initial={{ width: 0 }}
              animate={{ width: 'auto' }}
              exit={{ width: 0 }}
              transition={{ duration: 0.15, ease: cubicEasingFn }}
              className="bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover"
              onClick={toggleActions}
            >
              <div className="p-4">
                <div className={showActions ? 'i-ph:caret-up-bold' : 'i-ph:caret-down-bold'}></div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showActions && actions.length > 0 && (
          <motion.div
            className="actions"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: '0px' }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-bolt-elements-artifacts-borderColor h-[1px]" />
            <div className="p-5 text-left bg-bolt-elements-actions-background">
              <ActionList actions={actions} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

interface ShellCodeBlockProps {
  classsName?: string;
  code: string;
}

function ShellCodeBlock({ classsName, code }: ShellCodeBlockProps) {
  return (
    <div
      className={classNames('text-xs', classsName)}
      dangerouslySetInnerHTML={{
        __html: shellHighlighter.codeToHtml(code, {
          lang: 'shell',
          theme: 'dark-plus',
        }),
      }}
    ></div>
  );
}

interface ActionListProps {
  actions: ActionState[];
}

const actionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const ActionList = memo(({ actions }: ActionListProps) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <ul className="list-none space-y-1">
        {actions.map((action, index) => {
          const { status, type, content } = action;
          const isLast = index === actions.length - 1;

          return (
            <motion.li
              key={index}
              variants={actionVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.2,
                ease: cubicEasingFn,
              }}
            >
              {type === 'file' ? (
                <FileAction action={action} />
              ) : type === 'shell' ? (
                <ShellAction action={action} isLast={isLast} />
              ) : null}
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
});

function FileAction({ action }: { action: ActionState }) {
  const fileName = action.filePath?.split('/').pop() || '';
  const dirPath = action.filePath?.substring(0, action.filePath.lastIndexOf('/')) || '';

  return (
    <div className="flex items-center gap-2 py-1 px-2 -mx-2 rounded-md hover:bg-bolt-elements-background-depth-2/50 transition-colors group">
      <div className={classNames('flex-shrink-0', getStatusIndicator(action.status))}>
        {status === 'running' ? (
          <div className="i-svg-spinners:90-ring-with-bg text-sm" />
        ) : status === 'pending' ? (
          <div className="i-ph:circle-dashed text-sm" />
        ) : status === 'complete' ? (
          <div className="i-ph:check-circle-fill text-sm" />
        ) : status === 'failed' || status === 'aborted' ? (
          <div className="i-ph:x-circle-fill text-sm" />
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className={classNames(
          'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0',
          action.isNewFile ? 'bg-emerald-500/12 text-emerald-400' : 'bg-amber-500/12 text-amber-400'
        )}>
          {action.isNewFile ? 'Criado' : 'Editado'}
        </span>
        <code className="bg-bolt-elements-artifacts-inlineCode-background text-bolt-elements-artifacts-inlineCode-text px-1.5 py-0.5 rounded-md text-xs truncate">
          {fileName}
        </code>
        {dirPath && (
          <span className="text-[10px] text-bolt-elements-textTertiary truncate hidden group-hover:inline">
            {dirPath}
          </span>
        )}
      </div>
    </div>
  );
}

function ShellAction({ action, isLast }: { action: ActionState; isLast: boolean }) {
  return (
    <div className="py-0.5">
      <div className="flex items-center gap-2 py-1 px-2 -mx-2 rounded-md">
        <div className={classNames('flex-shrink-0', getStatusIndicator(action.status))}>
          {action.status === 'running' ? (
            <div className="i-svg-spinners:90-ring-with-bg text-sm" />
          ) : action.status === 'pending' ? (
            <div className="i-ph:circle-dashed text-sm" />
          ) : action.status === 'complete' ? (
            <div className="i-ph:check-circle-fill text-sm" />
          ) : action.status === 'failed' || action.status === 'aborted' ? (
            <div className="i-ph:x-circle-fill text-sm" />
          ) : null}
        </div>

        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0 bg-blue-500/12 text-blue-400">
          Comando
        </span>
      </div>
      <ShellCodeBlock
        classsName={classNames('mt-0.5 mb-0.5', {
          'mb-3': !isLast,
        })}
        code={action.content}
      />
    </div>
  );
}

function getStatusIndicator(status: ActionState['status']): string {
  switch (status) {
    case 'pending': {
      return 'text-bolt-elements-textTertiary';
    }
    case 'running': {
      return 'text-bolt-elements-loader-progress';
    }
    case 'complete': {
      return 'text-emerald-400';
    }
    case 'aborted': {
      return 'text-bolt-elements-textSecondary';
    }
    case 'failed': {
      return 'text-bolt-elements-icon-error';
    }
    default: {
      return '';
    }
  }
}

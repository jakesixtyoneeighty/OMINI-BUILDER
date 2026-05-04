import { useStore } from '@nanostores/react';
import { memo, useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { errorStore, type DetectedError } from '~/lib/stores/errors';
import { classNames } from '~/utils/classNames';

interface ErrorBannerProps {
  onFixError?: (error: DetectedError) => void;
}

function getErrorIcon(type: DetectedError['type']) {
  switch (type) {
    case 'action':
      return 'i-ph:file-x text-red-400';
    case 'preview':
      return 'i-ph:browser text-orange-400';
    case 'runtime':
      return 'i-ph:warning-octagon text-red-400';
    case 'compile':
      return 'i-ph:code text-amber-400';
    default:
      return 'i-ph:warning text-red-400';
  }
}

function getErrorColor(type: DetectedError['type']) {
  switch (type) {
    case 'action':
      return 'border-red-500/30 bg-red-500/5';
    case 'preview':
      return 'border-orange-500/30 bg-orange-500/5';
    case 'runtime':
      return 'border-red-500/40 bg-red-500/8';
    case 'compile':
      return 'border-amber-500/30 bg-amber-500/5';
    default:
      return 'border-red-500/30 bg-red-500/5';
  }
}

function getErrorBadge(type: DetectedError['type']) {
  switch (type) {
    case 'action':
      return { label: 'File Error', color: 'bg-red-500/15 text-red-400' };
    case 'preview':
      return { label: 'Preview Error', color: 'bg-orange-500/15 text-orange-400' };
    case 'runtime':
      return { label: 'Runtime Error', color: 'bg-red-500/15 text-red-400' };
    case 'compile':
      return { label: 'Compile Error', color: 'bg-amber-500/15 text-amber-400' };
    default:
      return { label: 'Error', color: 'bg-red-500/15 text-red-400' };
  }
}

function ErrorItem({
  error,
  onFix,
  onDismiss,
}: {
  error: DetectedError;
  onFix: (error: DetectedError) => void;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fixing, setFixing] = useState(false);
  const badge = getErrorBadge(error.type);

  const handleFix = () => {
    setFixing(true);
    onFix(error);
    setTimeout(() => setFixing(false), 2000);
  };

  const timeAgo = (() => {
    const diff = Math.floor((Date.now() - error.timestamp) / 1000);
    if (diff < 10) return 'agora';
    if (diff < 60) return `${diff}s atr\u00e1s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m atr\u00e1s`;
    return `${Math.floor(diff / 3600)}h atr\u00e1s`;
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={classNames(
        'rounded-lg border overflow-hidden',
        getErrorColor(error.type),
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="shrink-0 w-5 h-5 flex items-center justify-center">
          <div className={getErrorIcon(error.type)} />
        </div>

        <span className={classNames('text-[10px] font-semibold px-1.5 py-0.5 rounded', badge.color)}>
          {badge.label}
        </span>

        <span className="text-xs text-bolt-elements-textPrimary font-medium flex-1 truncate">
          {error.message}
        </span>

        {error.filePath && (
          <code className="text-[10px] text-bolt-elements-textTertiary bg-bolt-elements-background-depth-2 px-1.5 py-0.5 rounded max-w-[150px] truncate">
            {error.filePath}
          </code>
        )}

        <span className="text-[10px] text-bolt-elements-textTertiary shrink-0">{timeAgo}</span>

        <div className={classNames(
          'shrink-0 text-bolt-elements-textTertiary transition-transform duration-200',
          expanded && 'rotate-180',
        )}>
          <div className="i-ph:caret-down text-xs" />
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {/* Error source */}
              {error.source && (
                <div className="text-[11px] text-bolt-elements-textTertiary">
                  <span className="font-medium">Fonte:</span> {error.source}
                </div>
              )}

              {/* Error details */}
              {error.details && (
                <div className="border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-2.5 rounded-lg max-h-[200px] overflow-auto">
                  <pre className="text-[11px] font-mono text-bolt-elements-textSecondary whitespace-pre-wrap break-all leading-relaxed">
                    {error.details}
                  </pre>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFix();
                  }}
                  disabled={fixing}
                  className={classNames(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                    fixing
                      ? 'bg-emerald-500/15 text-emerald-400 cursor-wait'
                      : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 active:scale-[0.97]',
                  )}
                >
                  {fixing ? (
                    <>
                      <div className="i-svg-spinners:90-ring-with-bg text-sm" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <div className="i-ph:wrench text-sm" />
                      Corrigir com IA
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(error.id);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-bolt-elements-textTertiary hover:bg-bolt-elements-item-backgroundActive transition-all"
                >
                  <div className="i-ph:x text-sm" />
                  Descartar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const ErrorBanner = memo(function ErrorBanner({ onFixError }: ErrorBannerProps) {
  const errorsMap = useStore(errorStore.errors);
  const showErrorPanel = useStore(errorStore.showErrors);

  const activeErrors = useMemo(
    () =>
      Object.values(errorsMap)
        .filter((e) => !e.dismissed)
        .sort((a, b) => b.timestamp - a.timestamp),
    [errorsMap],
  );

  const handleFix = useCallback(
    (error: DetectedError) => {
      onFixError?.(error);
      errorStore.dismissError(error.id);
    },
    [onFixError],
  );

  const handleDismiss = useCallback((id: string) => {
    errorStore.dismissError(id);
  }, []);

  if (activeErrors.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-chat mx-auto px-4 pb-2">
      {/* Error summary bar */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => errorStore.toggleErrors()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/15 transition-all"
        >
          <div className="i-ph:warning-fill text-sm" />
          <span>{activeErrors.length} erro{activeErrors.length > 1 ? 's' : ''} detectado{activeErrors.length > 1 ? 's' : ''}</span>
          <div className={classNames(
            'text-bolt-elements-textTertiary transition-transform duration-200',
            showErrorPanel && 'rotate-180',
          )}>
            <div className="i-ph:caret-down text-xs" />
          </div>
        </button>
        <button
          onClick={() => {
            const firstError = activeErrors[0];
            if (firstError) {
              handleFix(firstError);
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/15 transition-all"
        >
          <div className="i-ph:wrench text-sm" />
          Corrigir tudo
        </button>
        <button
          onClick={() => errorStore.clearAll()}
          className="ml-auto text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
        >
          Descartar todos
        </button>
      </div>

      {/* Error list */}
      <AnimatePresence>
        {showErrorPanel &&
          activeErrors.map((error) => (
            <motion.div key={error.id} layout className="mb-2 last:mb-0">
              <ErrorItem error={error} onFix={handleFix} onDismiss={handleDismiss} />
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
});

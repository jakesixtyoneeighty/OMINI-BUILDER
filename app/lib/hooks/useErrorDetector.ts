import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { errorStore } from '~/lib/stores/errors';
import { workbenchStore } from '~/lib/stores/workbench';
import type { ActionState } from '~/lib/runtime/action-runner';

/**
 * Hook that monitors action states for failures and automatically
 * registers detected errors in the error store.
 */
export function useErrorDetector() {
  const artifacts = useStore(workbenchStore.artifacts);
  const processedErrors = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const [messageId, artifact] of Object.entries(artifacts)) {
      const actions = Object.entries(artifact.runner.actions.get());

      for (const [actionId, action] of actions) {
        const errorKey = `${messageId}-${actionId}`;

        if (processedErrors.current.has(errorKey)) {
          continue;
        }

        if (action.status === 'failed') {
          processedErrors.current.add(errorKey);

          const errorMsg = 'error' in action ? action.error : 'Action failed';
          const filePath = action.type === 'file' ? action.filePath : undefined;
          const actionType = action.type === 'file' ? 'Arquivo' : 'Comando';

          errorStore.addError({
            type: 'action',
            source: `${actionType}: ${action.type === 'file' ? (action.filePath || 'unknown') : action.content?.substring(0, 80)}`,
            message: `Falha ao ${action.type === 'file' ? 'escrever' : 'executar'} ${action.type === 'file' ? (filePath || 'arquivo') : 'comando'}`,
            details: errorMsg,
            filePath,
          });
        }
      }
    }

    // Clean up processed errors for actions that no longer exist (to avoid memory leak)
    const currentKeys = new Set<string>();
    for (const [messageId, artifact] of Object.entries(artifacts)) {
      for (const actionId of Object.keys(artifact.runner.actions.get())) {
        currentKeys.add(`${messageId}-${actionId}`);
      }
    }

    for (const key of processedErrors.current) {
      if (!currentKeys.has(key)) {
        processedErrors.current.delete(key);
      }
    }
  }, [artifacts]);
}

/**
 * Hook that intercepts runtime errors from preview iframes
 * using the window.onerror and unhandledrejection events.
 */
export function usePreviewErrorDetector() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const message = event.message || 'Unknown error';
      const source = event.filename || 'Preview';
      const line = event.lineno;
      const col = event.colno;

      // Filter out common non-useful errors
      if (
        message.includes('Script error') ||
        message.includes('ResizeObserver loop') ||
        message.includes('Non-Error promise rejection') ||
        message.includes('playwright') ||
        message.includes('codesandbox')
      ) {
        return;
      }

      errorStore.addError({
        type: 'runtime',
        source: source,
        message: extractCleanErrorMessage(message),
        details: line ? `Linha ${line}${col ? `, coluna ${col}` : ''}\nArquivo: ${source}` : undefined,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;

      // Filter out non-useful errors
      if (!reason || typeof reason === 'string' && (reason.includes('ResizeObserver') || reason.includes('Script error'))) {
        return;
      }

      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Unhandled promise rejection';

      errorStore.addError({
        type: 'runtime',
        source: 'Promise Rejection',
        message: extractCleanErrorMessage(message),
        details: reason instanceof Error ? reason.stack : undefined,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
}

/**
 * Extract a clean, human-readable error message from raw error text.
 * Removes noise like URLs, stack traces prefixes, etc.
 */
function extractCleanErrorMessage(raw: string): string {
  let msg = raw.trim();

  // Remove common prefixes
  msg = msg.replace(/^(Uncaught |Unhandled )/i, '');

  // Truncate very long messages
  if (msg.length > 200) {
    msg = msg.substring(0, 197) + '...';
  }

  return msg || 'Erro desconhecido';
}

/**
 * Returns a function to manually report errors (e.g. from preview components).
 */
export function useReportError() {
  return useCallback(
    (options: { type?: 'preview' | 'runtime' | 'compile'; source: string; message: string; details?: string; filePath?: string }) => {
      errorStore.addError({
        type: options.type || 'runtime',
        source: options.source,
        message: options.message,
        details: options.details,
        filePath: options.filePath,
      });
    },
    [],
  );
}

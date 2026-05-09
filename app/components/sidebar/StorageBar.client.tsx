import { useStore } from '@nanostores/react';
import { useEffect, useState, useCallback } from 'react';
import {
  storageUsageStore,
  refreshStorageUsage,
  formatStorageSize,
  getStorageBarColor,
  STORAGE_LIMIT_MB,
} from '~/lib/stores/storage';
import { authStore } from '~/lib/stores/auth';

export function StorageBar() {
  const usage = useStore(storageUsageStore);
  const auth = useStore(authStore);
  const [showWarning, setShowWarning] = useState(false);
  const [error, setError] = useState(false);

  const loadUsage = useCallback(() => {
    if (auth.user) {
      refreshStorageUsage().catch(() => {
        setError(true);
      });
    }
  }, [auth.user]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  // Refresh every 60 seconds
  useEffect(() => {
    if (!auth.user) return;
    const interval = setInterval(() => {
      refreshStorageUsage().catch(() => {
        // ignore
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [auth.user]);

  if (!auth.user) return null;

  const safePercentage = typeof usage.percentage === 'number' && !isNaN(usage.percentage) ? usage.percentage : 0;
  const safeUsedBytes = typeof usage.usedBytes === 'number' && !isNaN(usage.usedBytes) ? usage.usedBytes : 0;
  const barColor = getStorageBarColor(safePercentage);
  const isFull = safePercentage >= 100;

  return (
    <div className="px-3 py-2">
      {/* Storage bar */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="i-ph:cloud text-sm text-bolt-elements-textTertiary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-bolt-elements-textTertiary">
              Armazenamento na nuvem
            </span>
            <span className="text-[11px] text-bolt-elements-textTertiary">
              {error ? '--' : usage.loaded ? formatStorageSize(safeUsedBytes) : '...'} / {STORAGE_LIMIT_MB} MB
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-bolt-elements-background-depth-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, safePercentage)}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
        </div>
        {/* Info button when full */}
        {isFull && (
          <button
            type="button"
            onClick={() => setShowWarning(!showWarning)}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all shrink-0"
            title="Armazenamento cheio"
          >
            <div className="i-ph:info text-[10px]" />
          </button>
        )}
      </div>

      {/* Warning message when storage is full */}
      {isFull && showWarning && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="i-ph:warning-circle text-sm text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-red-400 font-medium">Armazenamento cheio!</p>
            <p className="text-[10px] text-red-400/70 mt-0.5">
              Seus projetos nao serao mais sincronizados com a nuvem. Exclua projetos antigos para liberar espaco.
            </p>
          </div>
        </div>
      )}

      {/* Almost full warning (>90%) */}
      {!isFull && safePercentage >= 90 && (
        <div className="flex items-start gap-2 mt-1 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="i-ph:warning text-[10px] text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-400/80">
            Armazenamento quase cheio. Seus projetos podem parar de sincronizar com a nuvem.
          </p>
        </div>
      )}
    </div>
  );
}

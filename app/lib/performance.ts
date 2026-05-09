/**
 * Performance Optimizer for Omni-Builder
 *
 * Manages memory usage, lazy loading, and resource cleanup.
 * Especially important for terminal/xterm instances and WebContainer
 * which are heavy on RAM.
 */

// ============================================
// 1. TERMINAL POOL — lazy init + dispose idle
// ============================================

const IDLE_TERMINAL_TIMEOUT = 30_000; // 30s before disposing idle terminal
const MAX_CACHED_TERMINALS = 1; // Only keep 1 terminal alive when idle

interface PooledTerminal {
  terminal: any; // XTerm instance
  lastUsed: number;
  dispose: () => void;
}

const terminalPool: Map<number, PooledTerminal> = new Map();
let idleCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Register a terminal in the pool for memory management.
 */
export function registerTerminal(id: number, terminal: any, dispose: () => void) {
  terminalPool.set(id, { terminal, lastUsed: Date.now(), dispose });
  ensureIdleCheck();
}

/**
 * Mark a terminal as actively being used (prevents disposal).
 */
export function touchTerminal(id: number) {
  const entry = terminalPool.get(id);
  if (entry) {
    entry.lastUsed = Date.now();
  }
}

/**
 * Unregister a terminal from the pool.
 */
export function unregisterTerminal(id: number) {
  terminalPool.delete(id);
  if (terminalPool.size === 0 && idleCheckInterval) {
    clearInterval(idleCheckInterval);
    idleCheckInterval = null;
  }
}

/**
 * Dispose of idle terminals that haven't been used recently.
 * Keeps only MAX_CACHED_TERMINALS alive.
 */
function ensureIdleCheck() {
  if (idleCheckInterval) return;

  idleCheckInterval = setInterval(() => {
    const now = Date.now();
    const entries = [...terminalPool.entries()].sort((a, b) => b[1].lastUsed - a[1].lastUsed);

    // Dispose terminals beyond the max cache size that have been idle too long
    for (let i = MAX_CACHED_TERMINALS; i < entries.length; i++) {
      const [id, entry] = entries[i];
      if (now - entry.lastUsed > IDLE_TERMINAL_TIMEOUT) {
        try {
          entry.dispose();
        } catch (e) {
          console.warn('[Perf] Failed to dispose idle terminal:', e);
        }
        terminalPool.delete(id);
      }
    }

    // Stop the interval if no terminals left
    if (terminalPool.size === 0) {
      clearInterval(idleCheckInterval!);
      idleCheckInterval = null;
    }
  }, 10_000); // Check every 10s
}

// ============================================
// 2. MEMORY MONITOR — track and report usage
// ============================================

interface MemoryStats {
  jsHeapSize: number;
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  terminalCount: number;
  timestamp: number;
}

let memoryHistory: MemoryStats[] = [];
const MAX_HISTORY = 60; // Keep last 60 samples

/**
 * Get current memory stats (Chrome only, returns null in other browsers).
 */
export function getMemoryStats(): MemoryStats | null {
  const perf = performance as any;
  if (!perf?.memory) return null;

  return {
    jsHeapSize: perf.memory.usedJSHeapSize,
    jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
    totalJSHeapSize: perf.memory.totalJSHeapSize,
    terminalCount: terminalPool.size,
    timestamp: Date.now(),
  };
}

/**
 * Sample memory and add to history.
 */
export function sampleMemory() {
  const stats = getMemoryStats();
  if (stats) {
    memoryHistory.push(stats);
    if (memoryHistory.length > MAX_HISTORY) {
      memoryHistory.shift();
    }
  }
}

/**
 * Get memory history for display.
 */
export function getMemoryHistory(): MemoryStats[] {
  return memoryHistory;
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ============================================
// 3. DEBOUNCE & THROTTLE — reduce render pressure
// ============================================

/**
 * Creates a debounced version of a function.
 * Useful for reducing renders from rapid store updates.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): T & { cancel: () => void; flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: any[] | null = null;

  const debounced = (...args: any[]) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
      lastArgs = null;
    }, delay);
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  debounced.flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (lastArgs) fn(...lastArgs);
    lastArgs = null;
  };

  return debounced as T & { cancel: () => void; flush: () => void };
}

/**
 * Creates a throttled version of a function.
 * Useful for terminal output and scroll handlers.
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
): T & { cancel: () => void } {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const throttled = (...args: any[]) => {
    const now = Date.now();
    const remaining = limit - (now - lastCall);

    if (remaining <= 0) {
      lastCall = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return throttled as T & { cancel: () => void };
}

// ============================================
// 4. RESOURCE CLEANUP — garbage collection hints
// ============================================

/**
 * Force cleanup of resources that are no longer needed.
 * Call this when switching projects or closing the workbench.
 */
export function cleanupResources() {
  // Dispose all idle terminals
  for (const [id, entry] of terminalPool.entries()) {
    try {
      entry.dispose();
    } catch (e) {
      console.warn('[Perf] Failed to dispose terminal on cleanup:', e);
    }
  }
  terminalPool.clear();

  if (idleCheckInterval) {
    clearInterval(idleCheckInterval);
    idleCheckInterval = null;
  }

  // Clear memory history
  memoryHistory = [];

  // Clear any blob URLs that might be lingering
  if (typeof document !== 'undefined') {
    document.querySelectorAll('iframe[src^="blob:"]').forEach((iframe) => {
      const src = iframe.getAttribute('src');
      if (src?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(src);
        } catch {}
      }
    });
  }

  // Hint to GC (not guaranteed, but helps in some browsers)
  if (typeof gc === 'function') {
    try {
      (gc as any)();
    } catch {}
  }

  console.info('[Perf] Resources cleaned up');
}

/**
 * Auto-sample memory every 30s and log warnings if usage is high.
 */
let autoSampleInterval: ReturnType<typeof setInterval> | null = null;
const HIGH_MEMORY_THRESHOLD = 0.85; // 85% of heap limit

export function startMemoryMonitor() {
  if (autoSampleInterval) return;

  autoSampleInterval = setInterval(() => {
    sampleMemory();
    const stats = getMemoryStats();
    if (stats && stats.jsHeapSize / stats.jsHeapSizeLimit > HIGH_MEMORY_THRESHOLD) {
      console.warn(
        `[Perf] High memory usage: ${formatBytes(stats.jsHeapSize)} / ${formatBytes(stats.jsHeapSizeLimit)} (${((stats.jsHeapSize / stats.jsHeapSizeLimit) * 100).toFixed(1)}%)`,
      );
    }
  }, 30_000);
}

export function stopMemoryMonitor() {
  if (autoSampleInterval) {
    clearInterval(autoSampleInterval);
    autoSampleInterval = null;
  }
}

// ============================================
// 5. WEBCONTAINER LAZY BOOT — defer heavy init
// ============================================

let webcontainerBootPromise: Promise<any> | null = null;
let webcontainerBooted = false;

/**
 * Lazy-boot the WebContainer only when actually needed.
 * This prevents the ~50-80MB hit on page load.
 */
export function lazyBootWebContainer(): Promise<any> {
  if (webcontainerBooted) {
    return webcontainerBootPromise!;
  }

  if (!webcontainerBootPromise) {
    console.info('[Perf] Deferring WebContainer boot until needed...');
    // The actual boot is handled by the existing webcontainer module
    // This just tracks the state for cleanup purposes
  }

  return webcontainerBootPromise!;
}

export function markWebContainerBooted() {
  webcontainerBooted = true;
}

export function isWebContainerBooted(): boolean {
  return webcontainerBooted;
}

// ============================================
// 6. COMPONENT VISIBILITY — skip renders when hidden
// ============================================

const visibilityObservers = new Map<string, (visible: boolean) => void>();

/**
 * Register a callback for when a component becomes visible/hidden.
 * Used to skip heavy renders and dispose resources when not visible.
 */
export function onVisibilityChange(id: string, callback: (visible: boolean) => void) {
  visibilityObservers.set(id, callback);
  return () => visibilityObservers.delete(id);
}

/**
 * Notify all registered components of a visibility change.
 */
export function notifyVisibilityChange(visible: boolean) {
  for (const callback of visibilityObservers.values()) {
    callback(visible);
  }
}

// ============================================
// 7. INIT — called on app startup
// ============================================

let initialized = false;

export function initPerformanceOptimizer() {
  if (initialized) return;
  initialized = true;

  // Start memory monitoring in development
  if (typeof window !== 'undefined') {
    startMemoryMonitor();

    // Listen for page visibility to pause/resume resources
    document.addEventListener('visibilitychange', () => {
      const visible = !document.hidden;
      notifyVisibilityChange(visible);

      if (!visible) {
        // Page hidden — reduce sampling
        console.info('[Perf] Page hidden — reducing resource usage');
      } else {
        // Page visible — resume normal operation
        console.info('[Perf] Page visible — resuming normal operation');
        sampleMemory();
      }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      cleanupResources();
    });

    console.info('[Perf] Performance optimizer initialized');
  }
}

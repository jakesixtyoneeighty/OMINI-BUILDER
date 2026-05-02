// ============================================================
// Omni-Builder — FatalErrorBoundary Component
// Captura erros fatais do React e exibe detalhes completos
// ============================================================
'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Copy, ChevronDown, ChevronUp, Terminal } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
  errorStack: string;
  componentStack: string;
  timestamp: string;
  showDetails: boolean;
  copied: boolean;
}

export class FatalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: '',
      errorStack: '',
      componentStack: '',
      timestamp: '',
      showDetails: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorStack: error?.stack || 'No stack trace available',
      timestamp: new Date().toISOString(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const details = {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Error',
      stack: error?.stack || 'No stack trace available',
      componentStack: errorInfo?.componentStack || 'No component stack available',
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };

    console.error('🔥 [FatalErrorBoundary] Erro fatal capturado:', details);

    this.setState({
      errorInfo: errorInfo?.componentStack || '',
      componentStack: errorInfo?.componentStack || '',
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  handleCopy = async () => {
    const { error, errorStack, errorInfo, timestamp } = this.state;
    const fullReport = [
      '=== Omni-Builder — Relatório de Erro Fatal ===',
      '',
      `Timestamp: ${timestamp}`,
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'unknown'}`,
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`,
      '',
      `Error: ${error?.name || 'Error'}`,
      `Message: ${error?.message || 'Unknown error'}`,
      '',
      '--- Stack Trace ---',
      errorStack || 'No stack trace available',
      '',
      '--- Component Stack ---',
      errorInfo || 'No component stack available',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(fullReport);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = fullReport;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorStack, errorInfo, timestamp, showDetails, copied } = this.state;

      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-6 overflow-y-auto">
          {/* Error icon */}
          <div className="w-20 h-20 rounded-2xl bg-red-500/15 flex items-center justify-center mb-6 shadow-lg shadow-red-500/10">
            <AlertTriangle size={40} className="text-red-400" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-red-400 mb-2">Erro Fatal</h1>
          <p className="text-sm text-zinc-400 mb-6 text-center max-w-md">
            Um erro inesperado ocorreu. Os detalhes técnicos estão abaixo para debugging.
          </p>

          {/* Error message card */}
          <div className="w-full max-w-2xl bg-zinc-900 border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl mb-6">
            {/* Error header */}
            <div className="px-5 py-4 bg-red-500/10 border-b border-red-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-sm font-semibold text-red-300">
                    {error?.name || 'Error'}: {error?.message || 'Unknown error'}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {timestamp ? new Date(timestamp).toLocaleString() : ''}
                </span>
              </div>
            </div>

            {/* Quick details */}
            <div className="px-5 py-3 border-b border-zinc-800 space-y-2">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-zinc-500 w-16 shrink-0">URL:</span>
                <span className="text-zinc-300 font-mono truncate">
                  {typeof window !== 'undefined' ? window.location.href : 'unknown'}
                </span>
              </div>
              {typeof navigator !== 'undefined' && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-500 w-16 shrink-0">Browser:</span>
                  <span className="text-zinc-400 font-mono truncate">{navigator.userAgent}</span>
                </div>
              )}
            </div>

            {/* Stack trace toggle */}
            <button
              onClick={this.toggleDetails}
              className="w-full px-5 py-3 flex items-center justify-between bg-zinc-800/50 hover:bg-zinc-800 transition border-b border-zinc-800"
            >
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-zinc-400" />
                <span className="text-xs font-medium text-zinc-300">Stack Trace & Detalhes Técnicos</span>
              </div>
              {showDetails ? (
                <ChevronUp size={14} className="text-zinc-500" />
              ) : (
                <ChevronDown size={14} className="text-zinc-500" />
              )}
            </button>

            {/* Detailed error info (expandable) */}
            {showDetails && (
              <div className="px-5 py-4 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                {/* Error stack */}
                {errorStack && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      Error Stack
                    </h3>
                    <pre className="text-[11px] text-red-300/80 bg-zinc-950 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap break-all leading-relaxed border border-zinc-800">
                      {errorStack}
                    </pre>
                  </div>
                )}

                {/* Component stack */}
                {errorInfo && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      Component Stack
                    </h3>
                    <pre className="text-[11px] text-amber-300/80 bg-zinc-950 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap break-all leading-relaxed border border-zinc-800">
                      {errorInfo}
                    </pre>
                  </div>
                )}

                {/* Additional error properties */}
                {error && Object.keys(error).length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      Error Properties
                    </h3>
                    <pre className="text-[11px] text-zinc-400 bg-zinc-950 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap break-all leading-relaxed border border-zinc-800">
                      {JSON.stringify(
                        Object.fromEntries(
                          Object.entries(error).filter(
                            ([key]) => !['message', 'name', 'stack'].includes(key)
                          )
                        ),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition shadow-lg shadow-violet-500/20"
            >
              <RotateCcw size={14} />
              Recarregar
            </button>
            <button
              onClick={this.handleClearCache}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition border border-zinc-700"
            >
              <TrashIcon size={14} />
              Limpar Cache & Recarregar
            </button>
            <button
              onClick={this.handleCopy}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium transition border border-zinc-700"
            >
              <Copy size={14} />
              {copied ? 'Copiado!' : 'Copiar Erro'}
            </button>
          </div>

          {/* Footer */}
          <p className="text-[10px] text-zinc-600 mt-6 text-center">
            Omni-Builder v1.0 — Se o erro persistir, copie os detalhes e abra uma issue no GitHub.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Icon re-used inside the class component
function TrashIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

// Hook version for functional components
export function useFatalErrorHandler() {
  return {
    ErrorBoundary: FatalErrorBoundary,
  };
}

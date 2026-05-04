import { memo, useState, useRef, useEffect } from 'react';
import { classNames } from '~/utils/classNames';

interface BuildPlanDropdownProps {
  planMode: boolean;
  onBuild: () => void;
  onPlan: () => void;
  isStreaming?: boolean;
}

export const BuildPlanDropdown = memo(function BuildPlanDropdown({ planMode, onBuild, onPlan, isStreaming }: BuildPlanDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (mode: 'build' | 'plan') => {
    setOpen(false);
    if (mode === 'build') {
      onBuild();
    } else {
      onPlan();
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isStreaming}
        className={classNames(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed',
          planMode
            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25'
            : 'bg-bolt-elements-item-contentAccent text-white hover:brightness-110 shadow-sm',
        )}
      >
        {planMode ? (
          <>
            <div className="i-ph:list-checks text-sm" />
            <span>Plan</span>
          </>
        ) : (
          <>
            <div className="i-ph:hammer text-sm" />
            <span>Build</span>
          </>
        )}
        <div className={`i-ph:caret-up text-[10px] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-44 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="p-1.5">
            {/* Build option */}
            <button
              onClick={() => handleSelect('build')}
              className={classNames(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all',
                !planMode
                  ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                  : 'hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary',
              )}
            >
              <div className="w-7 h-7 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
                <div className="i-ph:hammer text-emerald-400 text-sm" />
              </div>
              <div>
                <p className="text-xs font-semibold">Build</p>
                <p className="text-[10px] text-bolt-elements-textTertiary">Gera codigo e executa</p>
              </div>
              {!planMode && <div className="ml-auto i-ph:check-bold text-xs" />}
            </button>

            {/* Plan option */}
            <button
              onClick={() => handleSelect('plan')}
              className={classNames(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all',
                planMode
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary',
              )}
            >
              <div className="w-7 h-7 rounded-md bg-blue-500/15 flex items-center justify-center shrink-0">
                <div className="i-ph:list-checks text-blue-400 text-sm" />
              </div>
              <div>
                <p className="text-xs font-semibold">Plan</p>
                <p className="text-[10px] text-bolt-elements-textTertiary">Plano antes de executar</p>
              </div>
              {planMode && <div className="ml-auto i-ph:check-bold text-xs" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

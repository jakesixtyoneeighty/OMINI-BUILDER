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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isStreaming}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all active:scale-[0.97] disabled:opacity-50"
      >
        {planMode ? 'Plan' : 'Build'}
        <div className={`i-ph:caret-down text-[10px] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1.5 w-40 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg shadow-xl z-[100] overflow-hidden">
          <div className="p-1">
            <button
              onClick={() => { setOpen(false); onBuild(); }}
              className={classNames(
                'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left transition-all',
                !planMode
                  ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                  : 'text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive',
              )}
            >
              <div className="i-ph:hammer text-sm" />
              <span className="font-medium">Build</span>
              {!planMode && <div className="ml-auto i-ph:check text-[10px]" />}
            </button>
            <button
              onClick={() => { setOpen(false); onPlan(); }}
              className={classNames(
                'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left transition-all',
                planMode
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive',
              )}
            >
              <div className="i-ph:list-checks text-sm" />
              <span className="font-medium">Plan</span>
              {planMode && <div className="ml-auto i-ph:check text-[10px]" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

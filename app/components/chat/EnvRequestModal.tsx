import { useState } from 'react';
import { toast } from 'react-toastify';

export interface EnvVarRequest {
  name: string;
  description: string;
}

interface EnvRequestModalProps {
  variables: EnvVarRequest[];
  onClose: () => void;
  onSave: (vars: { key: string; value: string }[]) => void;
}

export function EnvRequestModal({ variables, onClose, onSave }: EnvRequestModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const v of variables) {
      initial[v.name] = '';
    }
    return initial;
  });

  const allFilled = variables.every((v) => values[v.name]?.trim());

  const handleSave = () => {
    const filled = variables
      .filter((v) => values[v.name]?.trim())
      .map((v) => ({ key: v.name, value: values[v.name].trim() }));

    if (filled.length === 0) {
      toast.error('Please fill in at least one variable');
      return;
    }

    onSave(filled);
    toast.success(`${filled.length} environment variable${filled.length > 1 ? 's' : ''} saved!`);
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] max-w-[95vw] bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <div className="i-ph:key text-amber-400 text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-bolt-elements-textPrimary">Environment Variables Required</h2>
              <p className="text-xs text-bolt-elements-textTertiary mt-0.5">
                The AI needs these variables to complete the project
              </p>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-bolt-elements-borderColor mx-6" />

        {/* Variables List */}
        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
          <p className="text-xs text-bolt-elements-textSecondary mb-4">
            Fill in the values for each variable. You can leave any blank and add them later in Settings.
          </p>
          <div className="space-y-3">
            {variables.map((v) => (
              <div key={v.name} className="p-3 rounded-xl bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold text-amber-400">{v.name}</span>
                  <span className="text-[10px] text-bolt-elements-textTertiary uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-amber-500/10">
                    Required
                  </span>
                </div>
                <p className="text-xs text-bolt-elements-textSecondary mb-2">{v.description}</p>
                <input
                  type="password"
                  value={values[v.name] || ''}
                  onChange={(e) => setValues({ ...values, [v.name]: e.target.value })}
                  placeholder={`Enter ${v.name}...`}
                  className="w-full px-3 py-2 rounded-lg text-sm font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Move to next input
                      const currentIndex = variables.findIndex((vv) => vv.name === v.name);
                      const nextInput = document.querySelectorAll<HTMLInputElement>('.env-var-input')[currentIndex + 1];
                      if (nextInput) nextInput.focus();
                      else handleSave();
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-bolt-elements-borderColor flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="px-4 py-2.5 text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
          >
            Skip for now
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!allFilled}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/12 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <div className="i-ph:check text-base" />
              Save Variables
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

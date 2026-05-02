import { useState } from 'react';
import { toast } from 'react-toastify';

export interface DbFieldRequest {
  name: string;
  description: string;
}

interface DbRequestModalProps {
  fields: DbFieldRequest[];
  dbType: 'supabase' | 'firebase';
  onClose: () => void;
  onSave: (type: string, values: Record<string, string>) => void;
}

const dbTypeConfig = {
  supabase: {
    label: 'Supabase',
    placeholder: {
      url: 'https://yourproject.supabase.co',
      anonKey: 'Your anon key',
    },
    passwordFields: ['anonKey'],
  },
  firebase: {
    label: 'Firebase',
    placeholder: {
      apiKey: 'Your API key',
      authDomain: 'yourapp.firebaseapp.com',
      projectId: 'your-project-id',
      storageBucket: 'your-project.appspot.com',
      messagingSenderId: 'Your sender ID',
      appId: 'Your app ID',
    },
    passwordFields: ['apiKey', 'appId'],
  },
} as const;

export function DbRequestModal({ fields, dbType, onClose, onSave }: DbRequestModalProps) {
  const config = dbTypeConfig[dbType];

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.name] = '';
    }
    return initial;
  });

  const allFilled = fields.every((f) => values[f.name]?.trim());

  const handleSave = () => {
    const filled: Record<string, string> = {};

    for (const f of fields) {
      if (values[f.name]?.trim()) {
        filled[f.name] = values[f.name].trim();
      }
    }

    if (Object.keys(filled).length === 0) {
      toast.error('Please fill in at least one field');
      return;
    }

    onSave(dbType, filled);
    toast.success(`${config.label} configuration saved!`);
  };

  const handleSkip = () => {
    onClose();
  };

  const isPasswordField = (fieldName: string) => config.passwordFields.includes(fieldName);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] max-w-[95vw] bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
              <div className="i-ph:database-duotone text-blue-400 text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-bolt-elements-textPrimary">
                {config.label} Credentials Required
              </h2>
              <p className="text-xs text-bolt-elements-textTertiary mt-0.5">
                The AI needs your {config.label} configuration to complete the project
              </p>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-bolt-elements-borderColor mx-6" />

        {/* Fields List */}
        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
          <p className="text-xs text-bolt-elements-textSecondary mb-4">
            Fill in your {config.label} credentials below. You can leave any blank and add them later in Settings.
          </p>
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.name} className="p-3 rounded-xl bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold text-blue-400">{f.name}</span>
                  <span className="text-[10px] text-bolt-elements-textTertiary uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-blue-500/10">
                    Required
                  </span>
                </div>
                <p className="text-xs text-bolt-elements-textSecondary mb-2">{f.description}</p>
                <input
                  type={isPasswordField(f.name) ? 'password' : 'text'}
                  value={values[f.name] || ''}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  placeholder={
                    (config.placeholder as Record<string, string>)[f.name] || `Enter ${f.name}...`
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all db-field-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const currentIndex = fields.findIndex((ff) => ff.name === f.name);
                      const inputs = document.querySelectorAll<HTMLInputElement>('.db-field-input');
                      const nextInput = inputs[currentIndex + 1];
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
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-500/12 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <div className="i-ph:check text-base" />
              Save Database Config
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

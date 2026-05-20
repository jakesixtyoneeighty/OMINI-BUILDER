import { memo } from 'react';
import { classNames } from '~/utils/classNames';

export interface TabOption {
  value: string;
  icon: string;
  label: string;
}

interface WorkbenchTabsProps {
  selected: string;
  options: TabOption[];
  setSelected: (selected: string) => void;
}

export const WorkbenchTabs = memo(({ selected, options, setSelected }: WorkbenchTabsProps) => {
  return (
    <div className="lovable-tabs flex items-center h-8 border border-bolt-elements-borderColor rounded-md p-0 overflow-hidden">
      {options.map((option) => {
        const isSelected = selected === option.value;

        return (
          <button
            key={option.value}
            onClick={() => setSelected(option.value)}
            className={classNames(
              'lovable-tab flex items-center gap-1 sm:gap-1.5 text-sm px-2 sm:px-3 h-full rounded-md transition-colors',
              isSelected
                ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                : 'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive hover:bg-bolt-elements-item-backgroundActive',
            )}
            title={option.label}
          >
            <div className={classNames(option.icon, 'text-base')} />
            <span className="text-xs font-medium hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
});

WorkbenchTabs.displayName = 'WorkbenchTabs';

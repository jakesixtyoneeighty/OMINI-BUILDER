import { motion } from 'framer-motion';
import { memo } from 'react';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';

export interface TabOption<T extends string> {
  value: T;
  icon: string;
  label: string;
}

interface WorkbenchTabsProps<T extends string> {
  selected: T;
  options: TabOption<T>[];
  setSelected: (selected: T) => void;
}

export const WorkbenchTabs = memo(<T extends string>({ selected, options, setSelected }: WorkbenchTabsProps<T>) => {
  return (
    <div className="flex items-center gap-0.5 bg-bolt-elements-background-depth-1 overflow-hidden rounded-full p-0.5 sm:p-1">
      {options.map((option) => {
        const isSelected = selected === option.value;

        return (
          <button
            key={option.value}
            onClick={() => setSelected(option.value)}
            className={classNames(
              'relative flex items-center gap-1 sm:gap-1.5 text-sm px-2 sm:px-3 py-1 rounded-full transition-colors',
              isSelected
                ? 'text-bolt-elements-item-contentAccent'
                : 'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive',
            )}
            title={option.label}
          >
            <span className="relative z-10 flex items-center gap-1 sm:gap-1.5">
              <div className={classNames(option.icon, 'text-base')} />
              <span className="text-xs font-medium hidden sm:inline">{option.label}</span>
            </span>
            {isSelected && (
              <motion.span
                layoutId="pill-tab"
                transition={{ duration: 0.2, ease: cubicEasingFn }}
                className="absolute inset-0 z-0 bg-bolt-elements-item-backgroundAccent rounded-full"
              />
            )}
          </button>
        );
      })}
    </div>
  );
});

WorkbenchTabs.displayName = 'WorkbenchTabs';

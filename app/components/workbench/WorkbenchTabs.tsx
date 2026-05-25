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
    <div className="flex items-center gap-1 bg-bolt-elements-bg-depth-2 rounded-lg p-1 sm:p-1.5 border border-bolt-elements-borderColor/10">
      {options.map((option) => {
        const isSelected = selected === option.value;

        return (
          <motion.button
            key={option.value}
            onClick={() => setSelected(option.value)}
            className={classNames(
              'relative flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-200',
              isSelected
                ? 'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent/15 border border-bolt-elements-item-contentAccent/30'
                : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/50',
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title={option.label}
          >
            <div className={classNames(option.icon, 'text-base')} />
            <span className="font-medium hidden sm:inline whitespace-nowrap">{option.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
});

WorkbenchTabs.displayName = 'WorkbenchTabs';

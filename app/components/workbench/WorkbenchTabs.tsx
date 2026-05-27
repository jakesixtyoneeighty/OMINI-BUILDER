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
    <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 bg-bolt-elements-bg-depth-2 rounded-lg border border-bolt-elements-borderColor/30">
      {options.map((option) => {
        const isSelected = selected === option.value;

        return (
          <motion.button
            key={option.value}
            onClick={() => setSelected(option.value)}
            className={classNames(
              'relative flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md transition-all duration-200 min-h-[36px]',
              isSelected
                ? 'text-bolt-elements-item-contentAccent bg-bolt-elements-bg-depth-1 shadow-sm'
                : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/30',
            )}
            whileTap={{ scale: 0.97 }}
            title={option.label}
          >
            <div className={classNames(option.icon, 'text-sm', isSelected ? 'text-bolt-elements-item-contentAccent' : 'text-bolt-elements-textTertiary')} />
            <span className={classNames(
              "text-xs font-medium whitespace-nowrap transition-colors duration-200",
              isSelected ? "text-bolt-elements-textPrimary" : "hidden sm:inline"
            )}>
              {option.label}
            </span>
            {isSelected && (
              <motion.div
                layoutId="active-workbench-tab"
                className="absolute inset-0 bg-bolt-elements-item-backgroundAccent/5 rounded-md -z-10"
                initial={false}
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
});

WorkbenchTabs.displayName = 'WorkbenchTabs';

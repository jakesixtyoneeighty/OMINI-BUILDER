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
    <div className="flex items-center gap-1 p-0.5 bg-bolt-elements-bg-depth-2 rounded-xl border border-bolt-elements-borderColor/30 shadow-sm">
      {options.map((option) => {
        const isSelected = selected === option.value;

        return (
          <motion.button
            key={option.value}
            onClick={() => setSelected(option.value)}
            className={classNames(
              'relative flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg transition-all duration-300',
              isSelected
                ? 'text-bolt-elements-item-contentAccent bg-bolt-elements-bg-depth-1 shadow-sm ring-1 ring-bolt-elements-borderColor/50'
                : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/30',
            )}
            whileTap={{ scale: 0.97 }}
            title={option.label}
          >
            <div className={classNames(option.icon, 'text-lg', isSelected ? 'text-bolt-elements-item-contentAccent' : 'text-bolt-elements-textTertiary')} />
            <span className={classNames(
              "text-xs font-semibold whitespace-nowrap transition-colors duration-300",
              isSelected ? "text-bolt-elements-textPrimary" : "hidden sm:inline"
            )}>
              {option.label}
            </span>
            {isSelected && (
              <motion.div
                layoutId="active-workbench-tab"
                className="absolute inset-0 bg-bolt-elements-item-backgroundAccent/5 rounded-lg -z-10"
                initial={false}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
});

WorkbenchTabs.displayName = 'WorkbenchTabs';

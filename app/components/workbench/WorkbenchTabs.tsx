import { motion } from 'framer-motion';
import { memo } from 'react';
import { classNames } from '~/utils/classNames';

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
    <div className="flex items-center gap-1 p-1 bg-bolt-elements-bg-depth-2/80 rounded-xl border border-bolt-elements-borderColor/40 shadow-sm">
      {options.map((option) => {
        const isSelected = selected === option.value;

        return (
          <motion.button
            key={option.value}
            onClick={() => setSelected(option.value)}
            className={classNames(
              'relative flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 min-h-[34px]',
              isSelected
                ? 'text-bolt-elements-item-contentAccent bg-bolt-elements-bg-depth-1 shadow-md'
                : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/40',
            )}
            whileHover={!isSelected ? { scale: 1.02 } : undefined}
            whileTap={{ scale: 0.96 }}
            title={option.label}
          >
            <div className={classNames(
              option.icon, 
              'text-base transition-colors duration-200',
              isSelected ? 'text-bolt-elements-item-contentAccent' : 'text-bolt-elements-textTertiary'
            )} />
            <span className={classNames(
              "text-xs font-semibold whitespace-nowrap transition-colors duration-200 tracking-tight",
              isSelected ? "text-bolt-elements-textPrimary" : "hidden sm:inline"
            )}>
              {option.label}
            </span>
            {isSelected && (
              <motion.div
                layoutId="active-workbench-tab"
                className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg -z-10 border border-bolt-elements-item-contentAccent/20"
                initial={false}
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
});

WorkbenchTabs.displayName = 'WorkbenchTabs';

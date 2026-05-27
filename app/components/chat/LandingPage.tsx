import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { languageStore } from '~/lib/stores/language';
import { useT } from '~/lib/i18n/useT';
import { themeStore } from '~/lib/stores/theme';
import { useIsMobile } from '~/utils/mobile';

const EXAMPLES = [
  'Build a real-time dashboard with charts and filters',
  'Create a landing page for my SaaS product',
  'Make an interactive quiz game with leaderboard',
  'Design a portfolio site with animations',
  'Build a task manager with drag-and-drop',
  'Create an e-commerce store with cart',
];

interface LandingPageProps {
  children: React.ReactNode;
}

export function LandingPage({ children }: LandingPageProps) {
  const t = useT();
  const theme = useStore(themeStore);
  const isDark = theme === 'dark';
  const _mobile = useIsMobile();

  const [exampleIdx, setExampleIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setExampleIdx((i) => (i + 1) % EXAMPLES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-y-auto overflow-x-hidden bg-white dark:bg-[#0a0a0b] transition-colors duration-300">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&display=swap');

        .font-geist { font-family: 'Geist', system-ui, sans-serif; }
        .accent-text {
          background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      <div className="flex flex-col items-center w-full px-4 sm:px-6 pt-4 sm:pt-24 pb-6 sm:pb-16 max-w-3xl mx-auto font-geist safe-bottom">

        {/* Headline - clean and bold */}
        <motion.div
          className="text-center mb-3 sm:mb-8"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.05 }}
        >
          <h1 className="text-xl sm:text-5xl md:text-[3.5rem] font-semibold leading-[1.15] tracking-tight text-gray-900 dark:text-white mb-1 sm:mb-2">
            What do you want to <span className="accent-text">build</span>?
          </h1>
          <p className="text-xs sm:text-lg text-gray-500 dark:text-gray-400 mt-1 sm:mt-3 max-w-lg mx-auto leading-relaxed">
            Describe your idea and watch it come to life. Full-stack apps, dashboards, websites — no code required.
          </p>
        </motion.div>

        {/* Input (injected child) */}
        <motion.div
          className="w-full max-w-2xl mb-3 sm:mb-6"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
        >
          {children}
        </motion.div>

        {/* Cycling examples - minimal */}
        <motion.div
          className="flex items-center gap-2 mb-4 sm:mb-12 text-[11px] sm:text-sm text-gray-400 dark:text-gray-500 min-h-[20px]"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.15 }}
        >
          <div className="i-ph:sparkle-duotone text-indigo-500 shrink-0" />
          <span style={{ transition: 'opacity .4s' }} className="truncate">{EXAMPLES[exampleIdx]}</span>
        </motion.div>

        {/* Quick start options - horizontal row */}
        <motion.div
          className="w-full max-w-xl mb-4 sm:mb-12"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
        >
          <div className="flex gap-2 sm:gap-3 justify-center">
            <button className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors">
              <div className="i-ph:github-logo text-base sm:text-lg" />
              <span className="sm:inline">Import from GitHub</span>
            </button>
            <button className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors">
              <div className="i-ph:globe-duotone text-base sm:text-lg" />
              <span className="sm:inline">Clone any website</span>
            </button>
          </div>
        </motion.div>

        {/* Categories - icon grid */}
        <motion.div
          className="w-full max-w-2xl"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.25 }}
        >
          <p className="text-center text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-2 sm:mb-5 font-semibold text-gray-400 dark:text-gray-500">
            Popular categories
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
            {[
              { icon: 'i-ph:globe-hemisphere-west-duotone', label: 'Web Apps' },
              { icon: 'i-ph:game-controller-duotone', label: 'Games' },
              { icon: 'i-ph:chart-bar-duotone', label: 'Dashboards' },
              { icon: 'i-ph:robot-duotone', label: 'AI Tools' },
              { icon: 'i-ph:shopping-cart-duotone', label: 'E-Commerce' },
              { icon: 'i-ph:graduation-cap-duotone', label: 'Education' },
            ].map((cat, i) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.05 }}
                className="flex flex-col items-center gap-1 sm:gap-2 py-2 sm:py-3 px-1 sm:px-2 rounded-lg sm:rounded-xl bg-gray-50 dark:bg-white/3 hover:bg-gray-100 dark:hover:bg-white/8 transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-white/10 active:scale-[0.97]"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <div className={cat.icon} />
                </div>
                <span className="text-[10px] sm:text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-tight">
                  {cat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

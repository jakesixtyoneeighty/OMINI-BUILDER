import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { languageStore } from '~/lib/stores/language';
import { useT } from '~/lib/i18n/useT';
import { themeStore } from '~/lib/stores/theme';

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

      <div className="flex flex-col items-center w-full px-4 sm:px-6 pt-20 sm:pt-24 pb-16 max-w-3xl mx-auto font-geist">

        {/* Headline - clean and bold */}
        <motion.div
          className="text-center mb-8"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.05 }}
        >
          <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] font-semibold leading-[1.1] tracking-tight text-gray-900 dark:text-white mb-2">
            What do you want to build?
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mt-3 max-w-lg mx-auto">
            Describe your idea and watch it come to life. Full-stack apps, dashboards, websites — no code required.
          </p>
        </motion.div>

        {/* Input (injected child) */}
        <motion.div
          className="w-full max-w-2xl mb-6"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
        >
          {children}
        </motion.div>

        {/* Cycling examples - minimal */}
        <motion.div
          className="flex items-center gap-2 mb-12 text-sm text-gray-500 dark:text-gray-400"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.15 }}
        >
          <div className="i-ph:sparkle-duotone text-indigo-500" />
          <span style={{ transition: 'opacity .4s' }}>{EXAMPLES[exampleIdx]}</span>
        </motion.div>

        {/* Quick start options - horizontal row like Bolt/Lovable */}
        <motion.div
          className="w-full max-w-xl mb-12"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
        >
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors">
              <div className="i-ph:github-logo text-lg" />
              Import from GitHub
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors">
              <div className="i-ph:globe-duotone text-lg" />
              Clone any website
            </button>
          </div>
        </motion.div>

        {/* Categories - icon grid */}
        <motion.div
          className="w-full max-w-2xl"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.25 }}
        >
          <p className="text-center text-[10px] uppercase tracking-[0.2em] mb-5 font-semibold text-gray-500 dark:text-gray-500">
            Popular categories
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
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
                className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl bg-gray-100/50 dark:bg-white/3 hover:bg-gray-200/70 dark:hover:bg-white/8 transition-all cursor-pointer border border-transparent hover:border-gray-300/50 dark:hover:border-white/10"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <div className={cat.icon} />
                </div>
                <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 leading-tight">
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
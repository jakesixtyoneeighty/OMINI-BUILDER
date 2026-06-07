import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
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
    <div className="relative w-full h-full flex flex-col overflow-y-auto overflow-x-hidden bg-bolt-elements-bg-depth-1 landing-background transition-colors duration-300">
      {/* Ambient glow orbs */}
      <div
        className="mojo-ambient-glow w-[400px] h-[400px] -top-32 -left-32"
        style={{ background: isDark ? 'rgba(211, 76, 38, 0.15)' : 'rgba(241, 101, 41, 0.08)' }}
      />
      <div
        className="mojo-ambient-glow w-[500px] h-[500px] -top-20 right-0"
        style={{
          background: isDark ? 'rgba(29, 78, 137, 0.2)' : 'rgba(74, 144, 226, 0.1)',
          animationDelay: '2s',
        }}
      />
      <div
        className="mojo-ambient-glow w-[300px] h-[300px] bottom-20 left-1/4"
        style={{
          background: isDark ? 'rgba(74, 144, 226, 0.1)' : 'rgba(29, 78, 137, 0.06)',
          animationDelay: '4s',
        }}
      />

      <div className="relative flex flex-col items-center w-full px-4 sm:px-6 pt-4 sm:pt-24 pb-6 sm:pb-16 max-w-3xl mx-auto safe-bottom">
        {/* Headline */}
        <motion.div
          className="text-center mb-3 sm:mb-8"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.05 }}
        >
          <h1 className="text-xl sm:text-5xl md:text-[3.5rem] font-semibold leading-[1.15] tracking-tight text-bolt-elements-textPrimary mb-1 sm:mb-2">
            Build. Cool. <span className="mojo-shimmer">Shit.</span>
          </h1>
          <p className="text-xs sm:text-lg text-bolt-elements-textSecondary mt-1 sm:mt-3 max-w-lg mx-auto leading-relaxed">
          Drop the idea. Mojo handles the build. Full-stack apps, dashboards, and websites from plain English, no code required.
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

        {/* Cycling examples */}
        <motion.div
          className="flex items-center gap-2 mb-4 sm:mb-12 text-[11px] sm:text-sm text-bolt-elements-textTertiary min-h-[20px]"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.15 }}
        >
          <div className="i-ph:sparkle-duotone text-mojo-orange shrink-0" />
          <motion.span
            key={exampleIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="truncate"
          >
            {EXAMPLES[exampleIdx]}
          </motion.span>
        </motion.div>

        {/* Categories */}
        <motion.div
          className="w-full max-w-2xl"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.25 }}
        >
          <p className="text-center text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-2 sm:mb-5 font-semibold text-bolt-elements-textTertiary">
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
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="mojo-card mojo-interactive flex flex-col items-center gap-1 sm:gap-2 py-2 sm:py-3 px-1 sm:px-2 cursor-pointer active:scale-[0.97]"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-mojo-sky/15 flex items-center justify-center text-mojo-sky">
                  <div className={cat.icon} />
                </div>
                <span className="text-[10px] sm:text-[11px] font-medium text-bolt-elements-textSecondary leading-tight">
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

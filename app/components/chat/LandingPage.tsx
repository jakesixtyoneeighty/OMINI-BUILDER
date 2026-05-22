import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { languageStore } from '~/lib/stores/language';
import { useT } from '~/lib/i18n/useT';
import { classNames } from '~/utils/classNames';

const CATEGORIES = [
  { icon: 'i-ph:globe-hemisphere-west-duotone', label: 'Web Apps', color: '#6366f1' },
  { icon: 'i-ph:game-controller-duotone', label: 'Games', color: '#8b5cf6' },
  { icon: 'i-ph:chart-bar-duotone', label: 'Dashboards', color: '#10b981' },
  { icon: 'i-ph:robot-duotone', label: 'AI Tools', color: '#f59e0b' },
  { icon: 'i-ph:shopping-cart-duotone', label: 'E-Commerce', color: '#ef4444' },
  { icon: 'i-ph:graduation-cap-duotone', label: 'Education', color: '#06b6d4' },
];

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
  const currentLang = useStore(languageStore);
  const [exampleIdx, setExampleIdx] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setExampleIdx((i) => (i + 1) % EXAMPLES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', fn);
    return () => window.removeEventListener('mousemove', fn);
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col overflow-y-auto overflow-x-hidden bg-[#0a0a0f]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');

        .landing-root * { font-family: 'Geist', system-ui, sans-serif; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer-slide {
          from { background-position: 200% center; }
          to   { background-position: -200% center; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse-ring {
          0%,100% { transform: scale(1); opacity:.5; }
          50%      { transform: scale(1.15); opacity:.2; }
        }

        .fade-up { animation: fade-up .6s cubic-bezier(.16,1,.3,1) both; }
        .delay-1 { animation-delay:.1s; }
        .delay-2 { animation-delay:.2s; }
        .delay-3 { animation-delay:.35s; }
        .delay-4 { animation-delay:.5s; }
        .delay-5 { animation-delay:.65s; }

        .gradient-text {
          background: linear-gradient(135deg, #fff 30%, rgba(255,255,255,.5));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .accent-text {
          background: linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer-slide 4s linear infinite;
        }
        .glass {
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.07);
          backdrop-filter: blur(16px);
        }
        .cat-card {
          transition: all .2s cubic-bezier(.16,1,.3,1);
          cursor: default;
        }
        .cat-card:hover {
          background: rgba(255,255,255,.06) !important;
          border-color: rgba(255,255,255,.12) !important;
          transform: translateY(-2px);
        }

        .noise-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          opacity: .4;
        }
      `}</style>

      {/* Ambient glow following mouse */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-none"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99,102,241,.07), transparent 60%)`,
        }}
      />

      {/* Static ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="absolute top-[-15%] left-[-8%] w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,.12) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,.1) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      {/* Grid */}
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }} />

      {/* Content */}
      <div className="landing-root relative z-10 flex flex-col items-center w-full px-4 sm:px-6 pt-[12vh] pb-20 noise-bg">

        {/* Status badge */}
        <div className="fade-up delay-1 mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass text-xs font-medium text-white/60 tracking-wide">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400" />
            </span>
            AI-Powered Full-Stack Builder — Open Source
          </div>
        </div>

        {/* Headline */}
        <div className="fade-up delay-2 text-center mb-6 max-w-3xl">
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.1] tracking-tight gradient-text">
            Build anything with
          </h1>
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.1] tracking-tight accent-text">
            natural language
          </h1>
        </div>

        {/* Subtitle */}
        <p className="fade-up delay-3 text-center text-white/40 text-base sm:text-lg leading-relaxed max-w-xl mb-12 font-light">
          Describe your idea, and watch it come to life. Full-stack apps, dashboards, games — no code required.
        </p>

        {/* Input area */}
        <div className="fade-up delay-4 w-full max-w-2xl mb-10">
          {children}
        </div>

        {/* Example prompts */}
        <div className="fade-up delay-5 flex items-center gap-2 mb-16 text-xs text-white/30 font-medium">
          <div className="i-ph:sparkle-duotone text-indigo-400 text-sm shrink-0" />
          <span className="transition-all duration-500">{EXAMPLES[exampleIdx]}</span>
        </div>

        {/* Category pills */}
        <div className="fade-up delay-5 w-full max-w-3xl">
          <p className="text-center text-[10px] uppercase tracking-[0.2em] text-white/20 mb-5 font-medium">
            What can you build
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.07, duration: 0.4 }}
                className="cat-card flex flex-col items-center gap-2.5 py-4 px-3 rounded-xl glass"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xl"
                  style={{ background: `${cat.color}18`, color: cat.color }}
                >
                  <div className={cat.icon} />
                </div>
                <span className="text-[11px] font-medium text-white/50 tracking-wide">{cat.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom hint */}
        <div className="mt-16 flex items-center gap-6 text-[11px] text-white/20">
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10">@</kbd>
            <span>mention files</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10">/</kbd>
            <span>commands</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10">⌘↵</kbd>
            <span>send</span>
          </div>
        </div>
      </div>
    </div>
  );
}

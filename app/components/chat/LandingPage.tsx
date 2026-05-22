import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { languageStore } from '~/lib/stores/language';
import { useT } from '~/lib/i18n/useT';
import { themeStore } from '~/lib/stores/theme';

const CATEGORIES = [
  { icon: 'i-ph:globe-hemisphere-west-duotone', label: 'Web Apps',    color: '#6366f1' },
  { icon: 'i-ph:game-controller-duotone',       label: 'Games',       color: '#8b5cf6' },
  { icon: 'i-ph:chart-bar-duotone',             label: 'Dashboards',  color: '#10b981' },
  { icon: 'i-ph:robot-duotone',                 label: 'AI Tools',    color: '#f59e0b' },
  { icon: 'i-ph:shopping-cart-duotone',          label: 'E-Commerce',  color: '#ef4444' },
  { icon: 'i-ph:graduation-cap-duotone',         label: 'Education',   color: '#06b6d4' },
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
  const theme = useStore(themeStore);
  const isDark = theme === 'dark';

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

  // Theme-adaptive colors
  const bg          = isDark ? '#08080a'              : '#ffffff';
  const gridColor   = isDark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.04)';
  const orb1        = isDark ? 'rgba(99,102,241,.12)'   : 'rgba(99,102,241,.07)';
  const orb2        = isDark ? 'rgba(139,92,246,.10)'   : 'rgba(139,92,246,.06)';
  const glowMouse   = isDark ? 'rgba(99,102,241,.07)'   : 'rgba(99,102,241,.04)';
  const badgeBg     = isDark ? 'rgba(255,255,255,.04)'  : 'rgba(0,0,0,.04)';
  const badgeBorder = isDark ? 'rgba(255,255,255,.08)'  : 'rgba(0,0,0,.08)';
  const badgeText   = isDark ? 'rgba(255,255,255,.45)'  : 'rgba(0,0,0,.45)';
  const h1Color     = isDark ? 'rgba(255,255,255,.92)'  : 'rgba(0,0,0,.88)';
  const subColor    = isDark ? 'rgba(255,255,255,.38)'  : 'rgba(0,0,0,.4)';
  const exColor     = isDark ? 'rgba(255,255,255,.22)'  : 'rgba(0,0,0,.3)';
  const labelColor  = isDark ? 'rgba(255,255,255,.2)'   : 'rgba(0,0,0,.25)';
  const cardBg      = isDark ? 'rgba(255,255,255,.03)'  : 'rgba(0,0,0,.03)';
  const cardBorder  = isDark ? 'rgba(255,255,255,.07)'  : 'rgba(0,0,0,.07)';
  const cardHoverBg = isDark ? 'rgba(255,255,255,.06)'  : 'rgba(0,0,0,.05)';
  const hintBg      = isDark ? 'rgba(255,255,255,.05)'  : 'rgba(0,0,0,.05)';
  const hintBorder  = isDark ? 'rgba(255,255,255,.08)'  : 'rgba(0,0,0,.08)';
  const divider     = isDark ? 'rgba(255,255,255,.08)'  : 'rgba(0,0,0,.08)';
  const hintText    = isDark ? 'rgba(255,255,255,.2)'   : 'rgba(0,0,0,.28)';

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-y-auto overflow-x-hidden"
      style={{ background: bg, transition: 'background .3s' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');
        .omini-landing { font-family: 'Geist', system-ui, sans-serif; }

        @keyframes omini-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes omini-shimmer {
          from { background-position: 200% center; }
          to   { background-position: -200% center; }
        }
        @keyframes omini-ping {
          75%,100% { transform: scale(2); opacity: 0; }
        }

        .omini-fade-up { animation: omini-fade-up .55s cubic-bezier(.16,1,.3,1) both; }
        .omini-d1 { animation-delay: .08s; }
        .omini-d2 { animation-delay: .18s; }
        .omini-d3 { animation-delay: .3s; }
        .omini-d4 { animation-delay: .44s; }
        .omini-d5 { animation-delay: .58s; }

        .omini-accent-text {
          background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: omini-shimmer 5s linear infinite;
        }
        .omini-cat-card {
          transition: background .18s, border-color .18s, transform .18s cubic-bezier(.16,1,.3,1);
        }
        .omini-cat-card:hover { transform: translateY(-3px); }
        .omini-ping { animation: omini-ping 1.4s cubic-bezier(0,0,.2,1) infinite; }
      `}</style>

      {/* Mouse glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(500px circle at ${mousePos.x}px ${mousePos.y}px, ${glowMouse}, transparent 60%)`,
          transition: 'background .05s',
        }}
      />

      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="absolute top-[-12%] left-[-6%] w-[480px] h-[480px] rounded-full"
          style={{ background: `radial-gradient(circle, ${orb1} 0%, transparent 70%)`, filter: 'blur(60px)' }} />
        <div className="absolute bottom-[10%] right-[-5%] w-[380px] h-[380px] rounded-full"
          style={{ background: `radial-gradient(circle, ${orb2} 0%, transparent 70%)`, filter: 'blur(60px)' }} />
      </div>

      {/* Grid */}
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
          backgroundSize: '72px 72px',
          transition: 'background-image .3s',
        }} />

      {/* ── Content ── */}
      <div className="omini-landing relative z-10 flex flex-col items-center w-full px-4 sm:px-6 pt-[11vh] pb-20">

        {/* Badge */}
        <div className="omini-fade-up omini-d1 mb-10">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide"
            style={{ background: badgeBg, border: `1px solid ${badgeBorder}`, color: badgeText }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="omini-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400" />
            </span>
            AI-Powered Full-Stack Builder — Open Source
          </div>
        </div>

        {/* Headline */}
        <div className="omini-fade-up omini-d2 text-center mb-5 max-w-3xl">
          <h1
            className="text-[clamp(2.4rem,5.5vw,4.2rem)] font-semibold leading-[1.1] tracking-tight"
            style={{ color: h1Color }}
          >
            Build anything with
          </h1>
          <h1 className="omini-accent-text text-[clamp(2.4rem,5.5vw,4.2rem)] font-semibold leading-[1.1] tracking-tight">
            natural language
          </h1>
        </div>

        {/* Subtitle */}
        <p
          className="omini-fade-up omini-d3 text-center text-base sm:text-lg leading-relaxed max-w-lg mb-12 font-light"
          style={{ color: subColor }}
        >
          Describe your idea, and watch it come to life. Full-stack apps, dashboards, games — no code required.
        </p>

        {/* Input (injected child) */}
        <div className="omini-fade-up omini-d4 w-full max-w-2xl mb-8">
          {children}
        </div>

        {/* Cycling examples */}
        <div
          className="omini-fade-up omini-d5 flex items-center gap-2 mb-16 text-xs font-medium"
          style={{ color: exColor }}
        >
          <div className="i-ph:sparkle-duotone text-sm" style={{ color: '#6366f1' }} />
          <span style={{ transition: 'opacity .4s' }}>{EXAMPLES[exampleIdx]}</span>
        </div>

        {/* Category grid */}
        <div className="omini-fade-up omini-d5 w-full max-w-3xl">
          <p
            className="text-center text-[10px] uppercase tracking-[0.2em] mb-5 font-semibold"
            style={{ color: labelColor }}
          >
            What can you build
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 + i * 0.06, duration: 0.35 }}
                className="omini-cat-card flex flex-col items-center gap-2.5 py-4 px-3 rounded-xl cursor-default"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = cardHoverBg;
                  el.style.borderColor = cat.color + '30';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = cardBg;
                  el.style.borderColor = cardBorder;
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xl"
                  style={{ background: cat.color + '18', color: cat.color }}
                >
                  <div className={cat.icon} />
                </div>
                <span
                  className="text-[11px] font-medium tracking-wide text-center leading-tight"
                  style={{ color: labelColor }}
                >
                  {cat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Keyboard hints */}
        <div
          className="omini-fade-up omini-d5 mt-16 flex items-center gap-5 text-[11px]"
          style={{ color: hintText }}
        >
          {[
            { key: '@', label: 'mention files' },
            { key: '/', label: 'commands' },
            { key: '⌘↵', label: 'send' },
          ].map(({ key, label }, i) => (
            <div key={key} className="flex items-center gap-5">
              {i > 0 && <div className="w-px h-3" style={{ background: divider }} />}
              <div className="flex items-center gap-1.5">
                <kbd
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                  style={{ background: hintBg, border: `1px solid ${hintBorder}` }}
                >
                  {key}
                </kbd>
                <span>{label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

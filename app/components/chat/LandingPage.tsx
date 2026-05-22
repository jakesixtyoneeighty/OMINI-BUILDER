import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { languageStore } from '~/lib/stores/language';
import { useT } from '~/lib/i18n/useT';
import { classNames } from '~/utils/classNames';

const SKILL_CARDS = [
  {
    icon: 'i-ph:globe-hemisphere-west-duotone',
    title: 'Web Apps',
    desc: 'Sites & Apps completos',
    color: 'from-blue-500/20 to-indigo-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: 'i-ph:game-controller-duotone',
    title: 'Games',
    desc: 'Jogos interativos',
    color: 'from-purple-500/20 to-pink-500/20',
    iconColor: 'text-purple-400',
  },
  {
    icon: 'i-ph:chart-bar-duotone',
    title: 'Dashboards',
    desc: 'Painéis analíticos',
    color: 'from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-400',
  },
  {
    icon: 'i-ph:robot-duotone',
    title: 'AI Tools',
    desc: 'Ferramentas com IA',
    color: 'from-amber-500/20 to-orange-500/20',
    iconColor: 'text-amber-400',
  },
  {
    icon: 'i-ph:shopping-cart-duotone',
    title: 'E-Commerce',
    desc: 'Lojas online',
    color: 'from-rose-500/20 to-red-500/20',
    iconColor: 'text-rose-400',
  },
  {
    icon: 'i-ph:graduation-cap-duotone',
    title: 'Educação',
    desc: 'Apps educacionais',
    color: 'from-cyan-500/20 to-sky-500/20',
    iconColor: 'text-cyan-400',
  },
];

const FLOATING_ICONS = [
  { icon: 'i-ph:react-logo', x: 10, y: 20, delay: 0, color: 'text-blue-400/20' },
  { icon: 'i-ph:angular-logo', x: 85, y: 15, delay: 1, color: 'text-red-400/15' },
  { icon: 'i-ph:vue-logo', x: 75, y: 70, delay: 2, color: 'text-emerald-400/15' },
  { icon: 'i-ph:code-bold', x: 15, y: 75, delay: 3, color: 'text-purple-400/15' },
  { icon: 'i-ph:terminal', x: 90, y: 50, delay: 1.5, color: 'text-amber-400/15' },
  { icon: 'i-ph:database', x: 5, y: 45, delay: 2.5, color: 'text-cyan-400/15' },
  { icon: 'i-ph:lightning', x: 50, y: 10, delay: 0.5, color: 'text-yellow-400/15' },
  { icon: 'i-ph:cloud', x: 30, y: 80, delay: 3.5, color: 'text-sky-400/15' },
  { icon: 'i-ph:brackets-angle', x: 70, y: 30, delay: 4, color: 'text-pink-400/15' },
  { icon: 'i-ph:star', x: 45, y: 65, delay: 1.2, color: 'text-orange-400/15' },
];

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {FLOATING_ICONS.map((item, i) => (
        <motion.div
          key={i}
          className={`absolute text-4xl ${item.color}`}
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
          animate={{
            y: [0, -20, 0, 20, 0],
            x: [0, 10, 0, -10, 0],
            rotate: [0, 5, 0, -5, 0],
            scale: [1, 1.1, 1, 0.9, 1],
          }}
          transition={{
            duration: 8,
            delay: item.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <div className={item.icon} />
        </motion.div>
      ))}
    </div>
  );
}

function GradientOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4), transparent 70%)' }}
      />
      <div
        className="absolute top-[40%] right-[-15%] w-[500px] h-[500px] rounded-full blur-[120px] opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.4), transparent 70%)' }}
      />
      <div
        className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] rounded-full blur-[120px] opacity-25"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.4), transparent 70%)' }}
      />
    </div>
  );
}

interface LandingPageProps {
  children: React.ReactNode;
}

export function LandingPage({ children }: LandingPageProps) {
  const t = useT();
  const currentLang = useStore(languageStore);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  return (
    <div className="w-full flex flex-col h-full relative overflow-y-auto overflow-x-hidden">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .shimmer-text {
          background: linear-gradient(90deg, var(--bolt-elements-textPrimary) 0%, rgba(139,92,246,0.8) 25%, rgba(59,130,246,0.8) 50%, rgba(139,92,246,0.8) 75%, var(--bolt-elements-textPrimary) 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 6s linear infinite;
        }
        .hero-glow {
          box-shadow: 0 0 60px -10px rgba(99,102,241,0.15), 0 0 120px -20px rgba(168,85,247,0.1);
        }
      `}</style>

      {/* Background layers */}
      <GradientOrbs />
      <FloatingParticles />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* ===== HERO SECTION ===== */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center pt-[10vh] pb-6 px-4"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            AI-Powered Full-Stack Builder
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-center mb-4"
        >
          <span className="block text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-bolt-elements-textPrimary leading-[1.1]">
            {t('landing.headline')}
          </span>
          <span className="block text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mt-1 shimmer-text">
            {t('landing.headlineAccent')}
          </span>
          <span className="block text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-bolt-elements-textPrimary leading-[1.1] mt-1">
            {t('landing.headlineEnd')}
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-base sm:text-lg text-bolt-elements-textTertiary text-center max-w-lg mb-8 leading-relaxed"
        >
          {t('landing.subtitle')}
        </motion.p>

        {/* Quick stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex items-center gap-6 mb-8 text-xs text-bolt-elements-textTertiary"
        >
          <div className="flex items-center gap-1.5">
            <div className="i-ph:lightning-fill text-amber-400" />
            <span>6 Preview Modes</span>
          </div>
          <div className="w-px h-3 bg-bolt-elements-borderColor" />
          <div className="flex items-center gap-1.5">
            <div className="i-ph:cloud-arrow-up-fill text-emerald-400" />
            <span>Multi-Deploy</span>
          </div>
          <div className="w-px h-3 bg-bolt-elements-borderColor" />
          <div className="flex items-center gap-1.5">
            <div className="i-ph:brain-fill text-purple-400" />
            <span>Multi-Model AI</span>
          </div>
        </motion.div>
      </motion.div>

      {/* ===== INPUT AREA ===== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="relative z-10 px-4"
      >
        {children}
      </motion.div>

      {/* ===== SKILL CARDS ===== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.6 }}
        className="relative z-10 mt-8 mb-4 px-4"
      >
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-xs text-bolt-elements-textTertiary mb-4 uppercase tracking-widest font-medium">
            Construa qualquer coisa
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {SKILL_CARDS.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 + i * 0.08, duration: 0.4 }}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
                className={classNames(
                  'relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-300 cursor-default',
                  hoveredCard === i
                    ? 'border-bolt-elements-borderColorActive bg-bolt-elements-item-backgroundActive scale-[1.03] shadow-lg'
                    : 'border-bolt-elements-borderColor/50 bg-bolt-elements-bg-depth-2/50 hover:border-bolt-elements-borderColor',
                )}
              >
                <div
                  className={classNames(
                    'w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-xl transition-transform duration-300',
                    card.color,
                    hoveredCard === i ? 'scale-110' : '',
                  )}
                >
                  <div className={classNames(card.icon, card.iconColor)} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-bolt-elements-textPrimary">{card.title}</p>
                  <p className="text-[10px] text-bolt-elements-textTertiary mt-0.5">{card.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ===== FOOTER HINT ===== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        className="relative z-10 mt-auto pb-6 pt-4 text-center"
      >
        <p className="text-[11px] text-bolt-elements-textTertiary">
          Use <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">@</kbd> para mencionar arquivos ·{' '}
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">/</kbd> para comandos
        </p>
      </motion.div>
    </div>
  );
}

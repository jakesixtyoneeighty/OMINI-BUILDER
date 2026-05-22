import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { languageStore } from '~/lib/stores/language';
import { useT } from '~/lib/i18n/useT';
import { classNames } from '~/utils/classNames';

const SKILL_CARDS = [
  {
    icon: 'i-ph:globe-hemisphere-west-duotone',
    title: 'Web Apps',
    desc: 'Sites & Apps completos',
    gradient: 'from-blue-500/15 via-indigo-500/10 to-purple-500/15',
    border: 'hover:border-blue-400/40',
    iconGradient: 'from-blue-400 to-indigo-400',
    shadow: 'shadow-blue-500/10',
  },
  {
    icon: 'i-ph:game-controller-duotone',
    title: 'Games',
    desc: 'Jogos interativos',
    gradient: 'from-purple-500/15 via-pink-500/10 to-rose-500/15',
    border: 'hover:border-purple-400/40',
    iconGradient: 'from-purple-400 to-pink-400',
    shadow: 'shadow-purple-500/10',
  },
  {
    icon: 'i-ph:chart-bar-duotone',
    title: 'Dashboards',
    desc: 'Painéis analíticos',
    gradient: 'from-emerald-500/15 via-teal-500/10 to-cyan-500/15',
    border: 'hover:border-emerald-400/40',
    iconGradient: 'from-emerald-400 to-teal-400',
    shadow: 'shadow-emerald-500/10',
  },
  {
    icon: 'i-ph:robot-duotone',
    title: 'AI Tools',
    desc: 'Ferramentas com IA',
    gradient: 'from-amber-500/15 via-orange-500/10 to-red-500/15',
    border: 'hover:border-amber-400/40',
    iconGradient: 'from-amber-400 to-orange-400',
    shadow: 'shadow-amber-500/10',
  },
  {
    icon: 'i-ph:shopping-cart-duotone',
    title: 'E-Commerce',
    desc: 'Lojas online',
    gradient: 'from-rose-500/15 via-red-500/10 to-pink-500/15',
    border: 'hover:border-rose-400/40',
    iconGradient: 'from-rose-400 to-red-400',
    shadow: 'shadow-rose-500/10',
  },
  {
    icon: 'i-ph:graduation-cap-duotone',
    title: 'Educação',
    desc: 'Apps educacionais',
    gradient: 'from-cyan-500/15 via-sky-500/10 to-blue-500/15',
    border: 'hover:border-cyan-400/40',
    iconGradient: 'from-cyan-400 to-sky-400',
    shadow: 'shadow-cyan-500/10',
  },
];

const FLOATING_ICONS = [
  { icon: 'i-ph:react-logo', x: 10, y: 20, delay: 0, scale: 0.6, opacity: 0.15 },
  { icon: 'i-ph:angular-logo', x: 85, y: 15, delay: 1, scale: 0.5, opacity: 0.12 },
  { icon: 'i-ph:vue-logo', x: 75, y: 70, delay: 2, scale: 0.55, opacity: 0.13 },
  { icon: 'i-ph:code-bold', x: 15, y: 75, delay: 3, scale: 0.45, opacity: 0.1 },
  { icon: 'i-ph:terminal', x: 90, y: 50, delay: 1.5, scale: 0.5, opacity: 0.12 },
  { icon: 'i-ph:database', x: 5, y: 45, delay: 2.5, scale: 0.6, opacity: 0.14 },
  { icon: 'i-ph:lightning', x: 50, y: 10, delay: 0.5, scale: 0.4, opacity: 0.1 },
  { icon: 'i-ph:cloud', x: 30, y: 80, delay: 3.5, scale: 0.65, opacity: 0.13 },
  { icon: 'i-ph:brackets-angle', x: 70, y: 30, delay: 4, scale: 0.5, opacity: 0.11 },
  { icon: 'i-ph:star', x: 45, y: 65, delay: 1.2, scale: 0.45, opacity: 0.12 },
];

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {FLOATING_ICONS.map((item, i) => (
        <motion.div
          key={i}
          className={`absolute text-3xl ${item.icon}`}
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
          animate={{
            y: [0, -15, 0, 15, 0],
            x: [0, 8, 0, -8, 0],
            rotate: [0, 3, 0, -3, 0],
          }}
          transition={{
            duration: 12,
            delay: item.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

function GradientOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute top-[-10%] left-[-5%] w-[700px] h-[700px] rounded-full blur-[120px] opacity-20"
        style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.35), transparent 70%)' }}
      />
      <div
        className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] opacity-15"
        style={{ background: 'radial-gradient(ellipse, rgba(168,85,247,0.3), transparent 70%)' }}
      />
      <div
        className="absolute bottom-[-5%] left-[15%] w-[500px] h-[500px] rounded-full blur-[100px] opacity-18"
        style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.3), transparent 70%)' }}
      />
      <div
        className="absolute top-[60%] left-[40%] w-[400px] h-[400px] rounded-full blur-[100px] opacity-12"
        style={{ background: 'radial-gradient(ellipse, rgba(236,72,153,0.25), transparent 70%)' }}
      />
    </div>
  );
}

function GridPattern() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.03]"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }}
    />
  );
}

interface LandingPageProps {
  children: React.ReactNode;
}

export function LandingPage({ children }: LandingPageProps) {
  const t = useT();
  const currentLang = useStore(languageStore);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="w-full flex flex-col h-full relative overflow-y-auto overflow-x-hidden bg-bolt-elements-bg-depth-1">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .shimmer-text {
          background: linear-gradient(
            90deg,
            #60a5fa 0%,
            #a78bfa 25%,
            #f472b6 50%,
            #a78bfa 75%,
            #60a5fa 100%
          );
          background-size: 300% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 8s ease-in-out infinite;
        }
        .gradient-animated {
          background: linear-gradient(-45deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6);
          background-size: 400% 400%;
          animation: gradient-shift 15s ease infinite;
        }
        .glass-card {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .hero-glow {
          filter: drop-shadow(0 0 80px rgba(99,102,241,0.15));
        }
      `}</style>

      {/* Background layers */}
      <GradientOrbs />
      <FloatingParticles />
      <GridPattern />

      {/* Mouse follow glow - intensified */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(800px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99,102,241,0.15), rgba(168,85,247,0.1) 30%, transparent 50%)`,
        }}
      />

      {/* ===== HERO SECTION ===== */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center pt-[8vh] pb-8 px-4 sm:px-6"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: 'easeOut' }}
          className="mb-8"
        >
          <div className="group relative inline-flex">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-lg opacity-50 group-hover:opacity-70 transition-opacity" />
            <span className="relative inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-white/10 text-xs font-medium text-blue-300 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-r from-blue-400 to-purple-400" />
              </span>
              <span className="bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent font-semibold">
                AI-Powered Full-Stack Builder
              </span>
            </span>
          </div>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-6 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl -z-10 hero-glow" />
          <span className="block text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight text-bolt-elements-textPrimary leading-[1.05]">
            {t('landing.headline')}
          </span>
          <span className="block text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[1.05] mt-2 shimmer-text">
            {t('landing.headlineAccent')}
          </span>
          <span className="block text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight text-bolt-elements-textPrimary leading-[1.05] mt-2">
            {t('landing.headlineEnd')}
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }}
          className="text-base sm:text-lg lg:text-xl text-bolt-elements-textTertiary text-center max-w-2xl mb-10 leading-relaxed px-4"
        >
          {t('landing.subtitle')}
        </motion.p>

        {/* Quick stats */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6, ease: 'easeOut' }}
          className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 mb-12 text-xs sm:text-sm text-bolt-elements-textSecondary"
        >
          <div className="flex items-center gap-2">
            <div className="i-ph:lightning-bold text-amber-400 text-lg" />
            <span className="font-medium">6 Preview Modes</span>
          </div>
          <div className="w-px h-4 bg-bolt-elements-borderColor/50" />
          <div className="flex items-center gap-2">
            <div className="i-ph:cloud-arrow-up-bold text-emerald-400 text-lg" />
            <span className="font-medium">Multi-Deploy</span>
          </div>
          <div className="w-px h-4 bg-bolt-elements-borderColor/50" />
          <div className="flex items-center gap-2">
            <div className="i-ph:brain-bold text-purple-400 text-lg" />
            <span className="font-medium">Multi-Model AI</span>
          </div>
          <div className="w-px h-4 bg-bolt-elements-borderColor/50" />
          <div className="flex items-center gap-2">
            <div className="i-ph:rocket-launch-bold text-blue-400 text-lg" />
            <span className="font-medium">Instant Build</span>
          </div>
        </motion.div>
      </motion.div>

      {/* ===== INPUT AREA ===== */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-20 px-4 sm:px-6 mb-12"
      >
        <div className="max-w-4xl mx-auto">{children}</div>
      </motion.div>

      {/* ===== SKILL CARDS ===== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="relative z-10 mt-4 mb-8 px-4 sm:px-6"
      >
        <div className="max-w-6xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.5 }}
            className="text-center text-xs sm:text-sm text-bolt-elements-textTertiary mb-6 uppercase tracking-[0.2em] font-medium"
          >
            Construa qualquer coisa
          </motion.p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {SKILL_CARDS.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 1.2 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
                className={classNames(
                  'group relative flex flex-col items-center gap-3 p-4 sm:p-5 rounded-2xl border backdrop-blur-xl transition-all duration-500 cursor-default overflow-hidden',
                  'bg-gradient-to-br',
                  card.gradient,
                  hoveredCard === i
                    ? `${card.border} ${card.shadow} shadow-lg scale-[1.05] border-opacity-60`
                    : 'border-white/5 hover:border-white/10',
                )}
              >
                {/* Hover glow effect */}
                <div
                  className={classNames(
                    'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                    card.gradient,
                  )}
                />
                
                {/* Icon container */}
                <div
                  className={classNames(
                    'relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br flex items-center justify-center text-2xl sm:text-3xl transition-all duration-500 shadow-md',
                    card.iconGradient,
                    hoveredCard === i ? 'scale-110 rotate-3 shadow-lg' : 'scale-100 rotate-0',
                  )}
                >
                  <div className={classNames(card.icon, 'text-white')} />
                </div>
                
                {/* Text content */}
                <div className="relative text-center z-10">
                  <p className="text-xs sm:text-sm font-bold text-bolt-elements-textPrimary tracking-tight">
                    {card.title}
                  </p>
                  <p className="text-[10px] sm:text-xs text-bolt-elements-textTertiary mt-1 font-medium leading-tight">
                    {card.desc}
                  </p>
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
        transition={{ delay: 1.8, duration: 0.6 }}
        className="relative z-10 mt-auto pb-8 pt-6 text-center px-4"
      >
        <div className="inline-flex items-center gap-4 text-[11px] sm:text-xs text-bolt-elements-textTertiary">
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 rounded-lg text-[10px] font-mono font-semibold bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor/50 text-bolt-elements-textSecondary shadow-sm">
              @
            </kbd>
            <span>mencionar arquivos</span>
          </div>
          <div className="w-px h-3 bg-bolt-elements-borderColor/50" />
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 rounded-lg text-[10px] font-mono font-semibold bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor/50 text-bolt-elements-textSecondary shadow-sm">
              /
            </kbd>
            <span>comandos rápidos</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

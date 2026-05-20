import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Flame, ArrowRight } from 'lucide-react';
import { useStreak } from '../../contexts/StreakContext';

const AUTO_DISMISS_MS = 7000;

const TIER_THEMES = {
  1: {
    label: 'DAY STREAK',
    sub: "You're on fire \u2014 keep going.",
    colorA: '#F97316',
    colorB: '#F59E0B',
    confettiColors: ['#F97316','#F59E0B','#FB923C','#FFB74D'],
    confettiVolume: 100,
  },
  2: {
    label: 'DAY STREAK \u2014 GOLD FLAME',
    sub: 'A week of focus. This is how compounding starts.',
    colorA: '#F59E0B',
    colorB: '#FBBF24',
    confettiColors: ['#F59E0B','#FBBF24','#FFD700','#FFC857'],
    confettiVolume: 180,
  },
  3: {
    label: 'DAY STREAK \u2014 LEGENDARY',
    sub: 'A full month. Compound consistency.',
    colorA: '#A855F7',
    colorB: '#246BFD',
    confettiColors: ['#A855F7','#6A5CFF','#246BFD','#FF6AC1','#10B981'],
    confettiVolume: 280,
  },
};

function reducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function StreakMilestoneOverlay() {
  const { pendingMilestone, clearMilestone } = useStreak();
  const fired = useRef(false);

  useEffect(() => {
    if (!pendingMilestone) { fired.current = false; return undefined; }
    if (fired.current) return undefined;
    fired.current = true;

    const theme = TIER_THEMES[pendingMilestone.tier] || TIER_THEMES[1];
    if (!reducedMotion()) {
      try {
        const defaults = { startVelocity: 38, spread: 100, ticks: 110, zIndex: 100 };
        confetti({ ...defaults, particleCount: theme.confettiVolume / 2, origin: { x: 0.15, y: 0.7 }, angle: 60, colors: theme.confettiColors });
        confetti({ ...defaults, particleCount: theme.confettiVolume / 2, origin: { x: 0.85, y: 0.7 }, angle: 120, colors: theme.confettiColors });
        if (pendingMilestone.tier === 3) {
          setTimeout(() => {
            confetti({ ...defaults, particleCount: 120, origin: { x: 0.5, y: 0.3 }, spread: 180, colors: theme.confettiColors });
          }, 280);
        }
      } catch (err) {
        console.warn('[streak-milestone] confetti failed:', err?.message || err);
      }
    }

    const t = setTimeout(() => clearMilestone(), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [pendingMilestone, clearMilestone]);

  if (!pendingMilestone) return null;
  const theme = TIER_THEMES[pendingMilestone.tier] || TIER_THEMES[1];
  const reduce = reducedMotion();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      data-testid="streak-milestone-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Streak milestone"
    >
      <button
        type="button"
        onClick={clearMilestone}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        aria-label="Dismiss"
      />
      <div
        className="relative w-full max-w-md glass-card rounded-3xl p-7 sm:p-10 text-center border-2"
        style={{
          borderColor: `${theme.colorA}55`,
          boxShadow: `0 0 60px ${theme.colorA}66, 0 0 160px ${theme.colorB}33`,
          animation: reduce ? 'vvStreakFadeIn 0.4s ease-out' : 'vvStreakPop 0.6s cubic-bezier(.2,.8,.3,1.2)',
        }}
      >
        <div
          className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center mb-5 text-white shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
          style={{ background: `linear-gradient(135deg, ${theme.colorA}, ${theme.colorB})` }}
        >
          <Flame size={52} />
        </div>
        <div
          className="font-clash text-4xl sm:text-5xl font-bold mb-1"
          style={{ color: theme.colorA, textShadow: `0 0 40px ${theme.colorA}44` }}
        >
          {pendingMilestone.streak}
        </div>
        <div className="font-clash text-base sm:text-lg font-bold tracking-[0.1em] mb-3 text-[var(--color-text)]" data-testid="streak-milestone-label">
          {theme.label}
        </div>
        <div className="text-sm font-bricolage text-[var(--color-text-muted)] mb-6">
          {theme.sub}
        </div>
        <button
          type="button"
          onClick={clearMilestone}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all"
          style={{ backgroundImage: `linear-gradient(135deg, ${theme.colorA}, ${theme.colorB})` }}
          data-testid="streak-milestone-continue"
        >
          Continue <ArrowRight size={16} />
        </button>
      </div>
      <style>{`
        @keyframes vvStreakPop {
          0%   { transform: scale(0.85) translateY(20px); opacity: 0; }
          70%  { transform: scale(1.04) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes vvStreakFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

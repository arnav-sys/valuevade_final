import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, ArrowRight, Sparkles } from 'lucide-react';
import { useXP } from '../../contexts/XPContext';
import { useSound } from '../../contexts/SoundContext';

const AUTO_DISMISS_MS = 6000;

function reducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Full-screen "LEVEL UP" celebration. Mounted globally via XPRoot.
 *
 * Triggered automatically by XPContext when a successful awardXP returns
 * `did_level_up: true`. Auto-dismisses after 6s OR on Continue click.
 *
 * Respects prefers-reduced-motion: no confetti, no scale, only fade.
 */
export default function LevelUpOverlay() {
  const { pendingLevelUp, clearLevelUp } = useXP();
  const { playSound } = useSound();
  const fired = useRef(false);

  useEffect(() => {
    if (!pendingLevelUp) {
      fired.current = false;
      return undefined;
    }
    if (fired.current) return undefined;
    fired.current = true;

    playSound('level_up');

    if (!reducedMotion()) {
      // Confetti burst, from both lower corners
      try {
        const defaults = { startVelocity: 35, spread: 90, ticks: 90, zIndex: 100, scalar: 1.0 };
        confetti({ ...defaults, particleCount: 80, origin: { x: 0.15, y: 0.7 }, angle: 60, colors: ['#246BFD', '#6A5CFF', '#FF6AC1', '#F59E0B', '#10B981'] });
        confetti({ ...defaults, particleCount: 80, origin: { x: 0.85, y: 0.7 }, angle: 120, colors: ['#246BFD', '#6A5CFF', '#FF6AC1', '#F59E0B', '#10B981'] });
        // Secondary cascade
        setTimeout(() => {
          confetti({ ...defaults, particleCount: 50, origin: { x: 0.5, y: 0.3 }, spread: 140 });
        }, 250);
      } catch (err) {
        console.warn('[level-up] confetti failed:', err?.message || err);
      }
    }

    const t = setTimeout(() => clearLevelUp(), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [pendingLevelUp, playSound, clearLevelUp]);

  if (!pendingLevelUp) return null;

  const { to, levelName, levelColor, totalXp } = pendingLevelUp;
  const reduce = reducedMotion();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      data-testid="level-up-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Level up"
    >
      <button
        type="button"
        onClick={clearLevelUp}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        aria-label="Dismiss"
        data-testid="level-up-scrim"
      />
      <div
        className="relative w-full max-w-md glass-card rounded-3xl p-7 sm:p-10 text-center border-2"
        style={{
          borderColor: `${levelColor}55`,
          boxShadow: `0 0 20px ${levelColor}33`,
          animation: reduce ? 'vvLvlFadeIn 0.4s ease-out' : 'vvLvlPop 0.6s cubic-bezier(.2,.8,.3,1.2)',
        }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent-pink)]/10 border border-[var(--color-accent-pink)]/25 text-[var(--color-accent-pink)] text-[10px] font-mono uppercase tracking-[0.25em] mb-5">
          <Sparkles size={12} /> Achievement Unlocked
        </div>
        <h1
          className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3"
          style={{ textShadow: `0 0 12px ${levelColor}30` }}
        >
          LEVEL UP!
        </h1>
        <div className="mx-auto mb-5 mt-2">
          <div
            className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-white shadow-[0_10px_40px_rgba(36,107,253,0.4)]"
            style={{ background: `linear-gradient(135deg, ${levelColor}, var(--color-accent-purple))` }}
            data-testid="level-up-icon"
          >
            <Trophy size={48} />
          </div>
        </div>
        <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-1">
          You are now level {to}
        </div>
        <div
          className="font-clash text-2xl sm:text-3xl font-bold mb-1"
          style={{ color: levelColor }}
          data-testid="level-up-name"
        >
          {levelName}
        </div>
        {typeof totalXp === 'number' && (
          <div className="text-sm font-bricolage text-[var(--color-text-muted)] mb-6">
            {totalXp.toLocaleString()} XP earned so far
          </div>
        )}
        <button
          type="button"
          onClick={clearLevelUp}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
          data-testid="level-up-continue"
        >
          Continue <ArrowRight size={16} />
        </button>
      </div>
      <style>{`
        @keyframes vvLvlPop {
          0%   { transform: scale(0.85) translateY(20px); opacity: 0; }
          70%  { transform: scale(1.04) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes vvLvlFadeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

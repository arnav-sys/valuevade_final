import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useMilestones } from '../../contexts/MilestonesContext';
import { useSound } from '../../contexts/SoundContext';

// Phase C — Milestone Achievement celebration overlay.
//
// Mounted once at the app shell. Reads `pending[0]` from MilestonesContext
// and renders the full-screen card. After Continue → POST /dismiss → next
// pending milestone surfaces automatically (queue-driven, multi-grant safe).
//
// Aesthetic = LevelUpOverlay (same confetti pattern, same vvLvlPop entrance,
// same shadcn-glass border + body) so the visual vocabulary stays consistent
// across all celebration moments.

const RARITY_THEMES = {
  common:    { color: '#94A3B8', glow: 'rgba(148,163,184,0.5)', tag: 'Achievement Unlocked' },
  rare:      { color: '#246BFD', glow: 'rgba(36,107,253,0.55)', tag: 'Rare Milestone' },
  epic:      { color: '#A855F7', glow: 'rgba(168,85,247,0.6)',  tag: 'Epic Milestone' },
  legendary: { color: '#F59E0B', glow: 'rgba(245,158,11,0.65)', tag: 'Legendary Milestone' },
};

function reducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Stagger between milestones in a multi-grant queue: keep enough delay so
// the user perceives them as distinct celebrations, not a flicker.
const NEXT_MILESTONE_DELAY_MS = 600;

export default function MilestoneCelebrationOverlay() {
  const { pending, dismiss } = useMilestones();
  const { playSound } = useSound();
  const firedFor = useRef(null);     // last code we ran the confetti+sound for
  const [showNext, setShowNext] = useState(true);

  // Pick the head of the queue.
  const current = pending[0] || null;

  useEffect(() => {
    if (!current) {
      firedFor.current = null;
      setShowNext(true);
      return undefined;
    }
    if (firedFor.current === current.code) return undefined;
    firedFor.current = current.code;

    // Reuse the level_up sound — it's the most "big moment" cue we have.
    try { playSound('level_up'); } catch { /* sound not critical */ }

    if (!reducedMotion()) {
      const theme = RARITY_THEMES[current.rarity] || RARITY_THEMES.epic;
      try {
        const defaults = { startVelocity: 38, spread: 100, ticks: 100, zIndex: 100, scalar: 1.05 };
        confetti({ ...defaults, particleCount: 90, origin: { x: 0.15, y: 0.7 }, angle: 60,
                   colors: ['#FFFFFF', theme.color, '#FF6AC1', '#10B981'] });
        confetti({ ...defaults, particleCount: 90, origin: { x: 0.85, y: 0.7 }, angle: 120,
                   colors: ['#FFFFFF', theme.color, '#FF6AC1', '#F59E0B'] });
        setTimeout(() => {
          confetti({ ...defaults, particleCount: 60, origin: { x: 0.5, y: 0.25 }, spread: 150 });
        }, 280);
      } catch (err) {
        console.warn('[milestone] confetti failed:', err?.message || err);
      }
    }
    return undefined;
  }, [current, playSound]);

  const handleContinue = async () => {
    if (!current) return;
    const code = current.code;
    setShowNext(false);
    await dismiss(code);
    // Brief stagger then allow the next pending milestone (if any) to render.
    setTimeout(() => setShowNext(true), NEXT_MILESTONE_DELAY_MS);
  };

  if (!current || !showNext) return null;

  const theme = RARITY_THEMES[current.rarity] || RARITY_THEMES.epic;
  const reduce = reducedMotion();

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Milestone achieved — ${current.title}`}
      data-testid="milestone-overlay"
    >
      <button
        type="button"
        onClick={handleContinue}
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
        aria-label="Dismiss"
        data-testid="milestone-scrim"
      />
      <div
        className="relative w-full max-w-md glass-card rounded-3xl p-7 sm:p-10 text-center border-2"
        style={{
          borderColor: `${theme.color}55`,
          boxShadow: `0 0 60px ${theme.glow}, 0 0 160px ${theme.color}33`,
          animation: reduce ? 'vvLvlFadeIn 0.4s ease-out' : 'vvLvlPop 0.6s cubic-bezier(.2,.8,.3,1.2)',
        }}
      >
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-[0.25em] mb-5"
          style={{
            color: theme.color,
            background: `${theme.color}15`,
            border: `1px solid ${theme.color}35`,
          }}
          data-testid="milestone-rarity-tag"
        >
          <Sparkles size={12} /> {theme.tag}
        </div>

        <div
          className="mx-auto mb-5 mt-1 w-24 h-24 rounded-3xl flex items-center justify-center text-5xl shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
          style={{ background: `linear-gradient(135deg, ${theme.color}28, var(--color-accent-purple)22)`, border: `1px solid ${theme.color}55` }}
          data-testid="milestone-icon"
        >
          <span aria-hidden="true">{current.icon}</span>
        </div>

        <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-1">
          {current.kind === 'module' ? 'Module Mastered' : 'Session Milestone'}
        </div>

        <h2
          className="font-clash text-2xl sm:text-3xl font-bold mb-3 text-[var(--color-text)]"
          style={{ textShadow: `0 0 40px ${theme.color}33` }}
          data-testid="milestone-title"
        >
          {current.title}
        </h2>

        <p className="text-sm sm:text-base font-bricolage text-[var(--color-text-muted)] mb-7 leading-relaxed" data-testid="milestone-body">
          {current.body}
        </p>

        <button
          type="button"
          onClick={handleContinue}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all"
          style={{
            background: `linear-gradient(90deg, ${theme.color}, var(--color-accent-purple))`,
            boxShadow: `0 0 24px ${theme.color}50`,
          }}
          data-testid="milestone-continue"
        >
          Continue <ArrowRight size={16} />
        </button>

        {pending.length > 1 && (
          <div className="mt-3 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-faint)]" data-testid="milestone-queue-count">
            +{pending.length - 1} more milestone{pending.length > 2 ? 's' : ''} after this
          </div>
        )}
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

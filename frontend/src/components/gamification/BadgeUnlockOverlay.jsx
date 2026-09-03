import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ArrowRight } from 'lucide-react';
import { useBadges } from '../../contexts/BadgeContext';
import { iconForSlug, rarityColor } from '../../utils/badgeIcons';

function reducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const RARITY_DURATION = {
  common:    4000,
  rare:      4000,
  epic:      5000,
  legendary: 6000,
};

export default function BadgeUnlockOverlay() {
  const { activeUnlock, dismissActiveUnlock } = useBadges();
  const fired = useRef(false);

  useEffect(() => {
    if (!activeUnlock) { fired.current = false; return undefined; }
    if (fired.current) return undefined;
    fired.current = true;

    const rarity = activeUnlock.rarity || 'common';
    const dur = RARITY_DURATION[rarity] || 4000;
    const reduce = reducedMotion();

    if (!reduce) {
      try {
        const colors = rarity === 'legendary' ? ['#F59E0B','#FBBF24','#FFD700','#246BFD']
                     : rarity === 'epic'      ? ['#A855F7','#6A5CFF','#FF6AC1']
                     : rarity === 'rare'      ? ['#246BFD','#6A5CFF']
                     : ['#9CA3AF','#BDBDBD'];
        const intensity = rarity === 'legendary' ? 220 : rarity === 'epic' ? 140 : rarity === 'rare' ? 80 : 40;
        confetti({ particleCount: intensity / 2, spread: 100, origin: { x: 0.15, y: 0.7 }, angle: 60, colors, zIndex: 100 });
        confetti({ particleCount: intensity / 2, spread: 100, origin: { x: 0.85, y: 0.7 }, angle: 120, colors, zIndex: 100 });
        if (rarity === 'legendary') {
          setTimeout(() => {
            confetti({ particleCount: 120, spread: 180, origin: { x: 0.5, y: 0.3 }, colors, zIndex: 100 });
          }, 280);
        }
      } catch (err) {
        console.warn('[badge-unlock] confetti failed:', err?.message || err);
      }
    }

    const t = setTimeout(() => dismissActiveUnlock(), dur);
    return () => clearTimeout(t);
  }, [activeUnlock, dismissActiveUnlock]);

  if (!activeUnlock) return null;
  const Icon = iconForSlug(activeUnlock.icon_slug);
  const rc = rarityColor(activeUnlock.rarity);
  const reduce = reducedMotion();

  return (
    <div
      className="fixed inset-0 z-[78] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Badge unlocked"
      data-testid="badge-unlock-overlay"
    >
      <button
        type="button"
        onClick={dismissActiveUnlock}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        aria-label="Dismiss"
      />
      <div
        className="relative w-full max-w-md glass-card rounded-3xl p-7 sm:p-9 text-center border-2"
        style={{
          borderColor: rc.ring + '55',
          boxShadow: `0 0 20px ${rc.glow}40`,
          animation: reduce ? 'vvBadgeFade 0.4s ease-out' : 'vvBadgePop 0.55s cubic-bezier(.2,.8,.3,1.2)',
        }}
      >
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] mb-4" style={{ color: rc.text }}>
          Badge unlocked &middot; {activeUnlock.rarity}
        </div>
        <div
          className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center mb-5 text-white shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
          style={{
            background: `linear-gradient(135deg, ${rc.ring}, var(--color-accent-purple))`,
            boxShadow: `0 0 14px ${rc.glow}60`,
          }}
          data-testid="badge-unlock-icon"
        >
          <Icon size={48} />
        </div>
        <h2
          className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-2"
          data-testid="badge-unlock-name"
        >
          {activeUnlock.name}
        </h2>
        <p className="text-sm font-bricolage text-[var(--color-text-muted)] mb-5">
          {activeUnlock.description}
        </p>
        {activeUnlock.bonus_xp > 0 && (
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/25 mb-5">
            +{activeUnlock.bonus_xp} XP bonus
          </div>
        )}
        <button
          type="button"
          onClick={dismissActiveUnlock}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all"
          style={{ background: `linear-gradient(135deg, ${rc.ring}, var(--color-accent-purple))` }}
          data-testid="badge-unlock-continue"
        >
          Continue <ArrowRight size={16} />
        </button>
      </div>
      <style>{`
        @keyframes vvBadgePop {
          0%   { transform: scale(0.85) translateY(20px); opacity: 0; }
          70%  { transform: scale(1.04) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes vvBadgeFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

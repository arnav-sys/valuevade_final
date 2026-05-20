import { useState } from 'react';
import { Flame, Snowflake, Sparkles, X } from 'lucide-react';
import { useStreak } from '../../contexts/StreakContext';

/**
 * Compact streak counter with tier-themed flame, freeze-token badge, and a
 * click-to-expand info popover.
 *
 * Tier 0: dim (no streak)
 * Tier 1: orange fire icon, gentle glow (3-6 days)
 * Tier 2: gold flame, stronger glow + slow pulse (7-29 days)
 * Tier 3: purple legendary aura, radial particle effect (30+ days)
 */
export default function StreakCounter({ className = '' }) {
  const {
    currentStreak,
    longestStreak,
    freezeTokens,
    autoSpendFreeze,
    milestoneTier,
    bootstrapping,
  } = useStreak();
  const [open, setOpen] = useState(false);

  if (bootstrapping) {
    return (
      <div
        className={`glass-card rounded-xl px-3 py-2 animate-pulse ${className}`}
        data-testid="streak-counter-loading"
      >
        <div className="h-4 w-12 bg-[var(--color-surface)] rounded" />
      </div>
    );
  }

  const tierColor = milestoneTier === 3
    ? '#A855F7'
    : milestoneTier === 2
      ? '#F59E0B'
      : milestoneTier === 1
        ? '#F97316'
        : 'var(--color-text-faint)';

  const tierGlow = milestoneTier > 0
    ? `0 0 18px ${tierColor}55, 0 0 4px ${tierColor}88`
    : 'none';

  return (
    <div className={`relative inline-flex ${className}`} data-testid="streak-counter">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl glass-card hover:border-[var(--color-primary)]/30 transition-all"
        title={`Streak: ${currentStreak} days`}
        aria-label={`Current streak ${currentStreak} days`}
      >
        <span className="relative inline-flex items-center justify-center">
          <Flame
            size={18}
            style={{
              color: tierColor,
              filter: tierGlow !== 'none' ? `drop-shadow(${tierGlow})` : undefined,
              animation: milestoneTier >= 2 ? 'vvStreakPulse 2.4s ease-in-out infinite' : undefined,
            }}
          />
          {milestoneTier === 3 && (
            <span className="absolute inset-0 rounded-full pointer-events-none" aria-hidden="true">
              <span
                className="absolute inset-[-8px] rounded-full"
                style={{
                  background: `radial-gradient(circle, ${tierColor}66, transparent 70%)`,
                  animation: 'vvStreakAura 3.2s ease-in-out infinite',
                }}
              />
            </span>
          )}
        </span>
        <span
          className="font-clash text-lg font-bold leading-none"
          style={{ color: milestoneTier > 0 ? tierColor : 'var(--color-text)' }}
          data-testid="streak-count"
        >
          {currentStreak}
        </span>
        {freezeTokens > 0 && (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20"
            title={`${freezeTokens} streak freeze${freezeTokens === 1 ? '' : 's'} available`}
            data-testid="streak-freeze-badge"
          >
            <Snowflake size={10} />
            \u00d7{freezeTokens}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 glass-card rounded-2xl p-4 z-30 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          data-testid="streak-popover"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-faint)] mb-0.5">
                Streak
              </div>
              <div className="font-clash text-xl font-bold text-[var(--color-text)]">
                {currentStreak} day{currentStreak === 1 ? '' : 's'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2 text-xs font-bricolage text-[var(--color-text-muted)]">
            <div className="flex justify-between">
              <span>Longest streak</span>
              <span className="font-mono text-[var(--color-text)]">{longestStreak} days</span>
            </div>
            <div className="flex justify-between">
              <span>Freeze tokens</span>
              <span className="font-mono text-[var(--color-text)] flex items-center gap-1">
                <Snowflake size={10} /> {freezeTokens} / 5
              </span>
            </div>
            <div className="flex justify-between">
              <span>Auto-spend on miss</span>
              <span className="font-mono text-[var(--color-text)]">{autoSpendFreeze ? 'ON' : 'OFF'}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-[var(--color-border)] text-[10px] flex items-center gap-1.5 text-[var(--color-text-faint)]">
              <Sparkles size={10} /> You earn 1 freeze every 10 days, max 5.
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes vvStreakPulse {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.12); }
        }
        @keyframes vvStreakAura {
          0%,100% { opacity: 0.4; transform: scale(1); }
          50%     { opacity: 0.9; transform: scale(1.18); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="streak-counter"] svg { animation: none !important; }
          [data-testid="streak-counter"] span span { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

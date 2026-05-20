import { useEffect, useState } from 'react';
import { useXP } from '../../contexts/XPContext';
import { useDailyChallenges } from '../../contexts/DailyChallengesContext';
import { Trophy, Crown } from 'lucide-react';

/**
 * Animated XP progress bar.
 *
 * - Fills proportionally between current level threshold and next.
 * - Shows level name + total_xp / next_threshold + percent.
 * - Below the bar: persistent nudge "N XP away from Level X — <name>".
 * - At max level: shows a trophy + total XP.
 * - prefers-reduced-motion: skips the fill animation, jumps straight to value.
 *
 * Variants:
 *   - 'default' (full width, headline use)
 *   - 'compact' (single-line, sidebar/profile micro use)
 */
export default function XPBar({ variant = 'default', className = '' }) {
  const {
    xp,
    level,
    levelName,
    levelColor,
    nextLevelName,
    nextThreshold,
    xpToNext,
    progressPct,
    isMaxLevel,
    bootstrapping,
  } = useXP();
  const { glowActive } = useDailyChallenges();
  const championGlowClass = glowActive ? 'vv-champion-glow' : '';

  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setAnimPct(isMaxLevel ? 100 : progressPct);
      return;
    }
    // Tiny delay so the fill is observable on mount
    const id = setTimeout(() => setAnimPct(isMaxLevel ? 100 : progressPct), 80);
    return () => clearTimeout(id);
  }, [progressPct, isMaxLevel]);

  if (bootstrapping) {
    return (
      <div
        className={`glass-card rounded-2xl p-4 sm:p-5 animate-pulse ${className}`}
        data-testid="xp-bar-loading"
      >
        <div className="h-3 w-1/3 bg-[var(--color-surface)] rounded mb-3" />
        <div className="h-2 w-full bg-[var(--color-surface)] rounded-full" />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 ${className}`} data-testid="xp-bar-compact">
        <span
          className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-mono font-bold text-white"
          style={{ background: levelColor }}
          title={`Level ${level} — ${levelName}`}
        >
          {level}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] truncate">
              {levelName}
            </span>
            <span className="text-[11px] font-mono text-[var(--color-text-faint)] shrink-0">
              {xp}{!isMaxLevel && ` / ${nextThreshold}`}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-out"
              style={{
                width: `${animPct}%`,
                background: `linear-gradient(90deg, ${levelColor}, var(--color-accent-purple))`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`glass-card rounded-2xl p-5 sm:p-6 ${className}`}
      data-testid="xp-bar"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-clash text-xl font-bold text-white shadow-[0_4px_16px_rgba(36,107,253,0.2)] ${championGlowClass}`}
            style={{
              background: `linear-gradient(135deg, ${levelColor}, var(--color-accent-purple))`,
            }}
            data-testid="xp-bar-level-icon"
          >
            {isMaxLevel ? <Trophy size={20} /> : level}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)] mb-0.5 flex items-center gap-1.5">
              Level {level}
              {glowActive && (
                <span
                  className="inline-flex items-center gap-0.5 text-amber-300"
                  title="Daily Champion (24-hr glow)"
                  data-testid="xp-bar-champion-crown"
                >
                  <Crown size={11} strokeWidth={2.4} />
                </span>
              )}
            </div>
            <div
              className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] truncate"
              data-testid="xp-bar-level-name"
            >
              {levelName}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-clash text-2xl font-bold text-[var(--color-text)]" data-testid="xp-bar-total">
            {xp.toLocaleString()}
            <span className="text-xs font-bricolage text-[var(--color-text-muted)] ml-1 font-normal">XP</span>
          </div>
          {!isMaxLevel && (
            <div className="text-[11px] font-mono text-[var(--color-text-muted)] mt-0.5">
              of {nextThreshold.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className="h-2.5 rounded-full bg-[var(--color-surface)] overflow-hidden" data-testid="xp-bar-progress">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-out ${!isMaxLevel && xpToNext < 25 ? 'vv-xp-bar-near-pulse' : ''}`}
          style={{
            width: `${animPct}%`,
            background: `linear-gradient(90deg, ${levelColor}, var(--color-accent-purple), var(--color-accent-pink))`,
            boxShadow: `0 0 16px ${levelColor}55`,
          }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {isMaxLevel ? (
          <div className="text-[12px] font-bricolage text-[var(--color-accent-pink)] flex items-center gap-1" data-testid="xp-bar-max-level">
            <Trophy size={11} /> You've reached CIO — the summit of finance. Keep grinding!
          </div>
        ) : (
          <div className="text-[12px] font-bricolage text-[var(--color-text-muted)] flex items-center gap-2 flex-wrap" data-testid="xp-bar-nudge">
            <span>
              <span className="font-semibold text-[var(--color-text)]">{xpToNext.toLocaleString()} XP</span>
              {' '}away from Level {level + 1}
              {nextLevelName && <> — <span style={{ color: 'var(--color-accent-purple)' }}>{nextLevelName}</span></>}
            </span>
            {xpToNext < 100 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-pink)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-accent-pink)]"
                data-testid="xp-bar-near-pill"
              >
                ⚡ So close!
              </span>
            )}
          </div>
        )}
        <div className="text-[11px] font-mono text-[var(--color-text-faint)] shrink-0">
          {progressPct}%
        </div>
      </div>
    </div>
  );
}

import { Check, Trophy } from 'lucide-react';
import { useDailyChallenges } from '../../contexts/DailyChallengesContext';

// Renders today's 3 daily challenges with live progress bars and an
// all-complete state. Progress updates flow in via Supabase Realtime so the
// caller doesn't need to imperatively refresh.

function nextMidnightIstLabel() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const hrs = 23 - ist.getUTCHours();
  const mins = 59 - ist.getUTCMinutes();
  if (hrs <= 0 && mins <= 1) return 'Resets in <1m IST';
  if (hrs <= 0) return `Resets in ${mins}m IST`;
  return `Resets in ${hrs}h ${mins}m IST`;
}

function ChallengeRow({ c }) {
  const pct = Math.min(100, Math.round((c.progress_current / c.target_value) * 100));
  const done = !!c.is_completed;
  return (
    <div
      className={`relative flex flex-col gap-2 rounded-xl border p-4 transition-colors ${
        done
          ? 'border-amber-400/40 bg-amber-400/10'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
      }`}
      data-testid={`daily-challenge-${c.code}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-clash text-base font-bold text-[var(--color-text)] leading-tight">
            {c.title}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {c.description}
          </div>
        </div>
        <div className="flex-shrink-0">
          {done ? (
            <div className="flex items-center gap-1 rounded-full bg-amber-400/30 px-2 py-0.5 text-xs font-bold text-amber-200">
              <Check size={12} strokeWidth={3} /> +{c.xp_reward} XP
            </div>
          ) : (
            <div className="rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-xs font-bold text-[var(--color-accent)]">
              +{c.xp_reward} XP
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className={`h-full transition-all duration-500 ${
              done ? 'bg-amber-400' : 'bg-[var(--color-accent)]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs tabular-nums text-[var(--color-text-muted)] flex-shrink-0">
          {c.progress_current}/{c.target_value}
        </div>
      </div>
    </div>
  );
}

export default function DailyChallengesCard() {
  const { challenges, allComplete, glowActive, bootstrapping } = useDailyChallenges();
  if (bootstrapping) return null;
  if (!challenges || challenges.length === 0) return null;

  const completedCount = challenges.filter((c) => c.is_completed).length;

  return (
    <section
      className={`relative rounded-2xl border p-5 sm:p-6 transition-all ${
        allComplete
          ? 'border-amber-400/60 bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-orange-500/20'
          : 'border-[var(--color-border)] bg-[var(--color-bg-card)]'
      }`}
      data-testid="daily-challenges-card"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy
              size={18}
              className={allComplete ? 'text-amber-300' : 'text-[var(--color-accent)]'}
            />
            <h3 className="font-clash text-lg font-bold text-[var(--color-text)]">
              Today's Challenges
            </h3>
            {allComplete && (
              <span
                className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-400/30 px-2 py-0.5 text-xs font-bold text-amber-200"
                data-testid="daily-champion-pill"
              >
                Daily Champion <Trophy size={11} />
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            {nextMidnightIstLabel()} · {completedCount}/3 complete
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {challenges.map((c) => <ChallengeRow key={c.id || c.code} c={c} />)}
      </div>

      <div className="mt-4 text-xs text-[var(--color-text-muted)]">
        {allComplete ? (
          <span className="text-amber-200 font-semibold">
            All 3 crushed, +75 XP bonus claimed, 24-hr glow active{glowActive ? ' ✨' : ''}.
          </span>
        ) : (
          <>Complete all 3 to earn <span className="font-bold text-[var(--color-accent)]">+75 XP</span> + Daily Champion badge.</>
        )}
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { Sparkles, Flame, Target, ArrowRight, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useXP } from '../../contexts/XPContext';
import { useStreak } from '../../contexts/StreakContext';

const LEVEL_NAMES = {
  1: 'Junior Analyst', 2: 'Research Associate', 3: 'Equity Analyst',
  4: 'Senior Analyst', 5: 'Portfolio Manager', 6: 'CIO',
};
const LEVEL_THRESHOLDS = [0, 500, 1500, 3500, 7000, 12000];

/**
 * Phase-4 end-of-session aggregator.
 * Renders inside SessionCompletePage or any session-complete flow.
 *
 * Self-fetches: session XP breakdown (last 5 events for this source_id),
 * badge near-miss progress (top 1 nearest), challenges-today status. Streak
 * + level info come from XPContext / StreakContext.
 */
export default function SessionSummaryCard({ sessionId, onContinue }) {
  const { user } = useAuth();
  const { stats: xpStats, levelInfo } = useXP();
  const { stats: streakStats } = useStreak();
  const [breakdown, setBreakdown] = useState([]);
  const [badgeNearest, setBadgeNearest] = useState(null);
  const [challengesDone, setChallengesDone] = useState({ done: 0, total: 3 });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) return;
      // 1) XP breakdown — last events tied to this session OR last 8 events
      const { data: events } = await supabase
        .from('user_xp_events')
        .select('amount, reason, created_at, source_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8);
      if (alive) {
        const slice = sessionId
          ? (events || []).filter((e) => e.source_id === sessionId || ['quiz_correct','session_complete','daily_login','badge_unlock_bonus'].includes(e.reason))
          : (events || []);
        setBreakdown(slice.slice(0, 6));
      }

      // 2) Nearest badge — fetch one near-miss row
      const { data: bn } = await supabase
        .from('user_badges')
        .select('progress_current, progress_target, master_badges!inner(code, name, rarity)')
        .eq('user_id', user.id)
        .eq('is_unlocked', false)
        .order('progress_current', { ascending: false })
        .limit(1);
      if (alive && bn?.length) setBadgeNearest(bn[0]);

      // 3) Daily challenges done today
      const todayIst = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
      const { data: dc } = await supabase
        .from('user_daily_challenges')
        .select('is_completed')
        .eq('user_id', user.id)
        .eq('challenge_date', todayIst);
      if (alive) {
        setChallengesDone({
          done: (dc || []).filter((c) => c.is_completed).length,
          total: (dc || []).length || 3,
        });
      }
    })();
    return () => { alive = false; };
  }, [user?.id, sessionId]);

  const totalXp = xpStats?.total_xp || 0;
  const curLevel = xpStats?.current_level || 1;
  const nextThresh = LEVEL_THRESHOLDS[curLevel] || null;
  const xpToNext = nextThresh != null ? Math.max(0, nextThresh - totalXp) : 0;
  const sessionsToNext = xpToNext > 0 ? Math.max(1, Math.ceil(xpToNext / 50)) : 0;
  const streakDays = streakStats?.current_streak_days || 0;
  const sumXp = breakdown.reduce((a, e) => a + (e.amount || 0), 0);

  const reasonLabel = {
    session_complete: 'session',
    quiz_correct: 'quiz',
    daily_login: 'daily login',
    badge_unlock_bonus: 'badge',
    capstone_complete: 'capstone',
    simulation_complete: 'sim',
  };

  return (
    <div className="rounded-3xl p-6 sm:p-8 mb-6 relative overflow-hidden border border-[var(--color-accent-purple)]/40 bg-gradient-to-br from-[var(--color-primary)]/12 via-[var(--color-accent-purple)]/8 to-transparent shadow-[0_0_40px_rgba(106,92,255,0.2)]" data-testid="session-summary-card">
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'radial-gradient(circle at 30% 0%, #6A5CFF40, transparent 60%)' }} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-[var(--color-accent-purple)]" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent-purple)]">Session Complete</span>
        </div>
        <h2 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-5" data-testid="summary-title">
          Nice work — let's bank that progress.
        </h2>

        {/* XP breakdown */}
        {breakdown.length > 0 && (
          <div className="mb-5" data-testid="summary-xp-breakdown">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-2">XP Earned</div>
            <div className="flex flex-wrap items-center gap-2">
              {breakdown.slice(0, 4).map((e, i) => (
                <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono bg-[var(--color-surface)] border border-[var(--color-border)]">
                  +{e.amount} <span className="ml-1.5 text-[var(--color-text-muted)]">{reasonLabel[e.reason] || e.reason}</span>
                </span>
              ))}
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/40">
                = +{sumXp} XP
              </span>
            </div>
          </div>
        )}

        {/* Streak + Next level + Badge progress + Challenges in a 4-up grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center gap-3">
            <Flame size={20} className="text-orange-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--color-text-faint)]">Streak</div>
              <div className="font-clash font-semibold text-sm">{streakDays}-day fire</div>
            </div>
          </div>
          <div className="rounded-xl p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center gap-3">
            <TrendingUp size={20} className="text-[var(--color-primary)] shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--color-text-faint)]">Next Level</div>
              <div className="font-clash font-semibold text-sm truncate">
                {nextThresh ? `${xpToNext} XP to ${LEVEL_NAMES[curLevel + 1] || ''}` : 'Maxed out — CIO'}
              </div>
              {sessionsToNext > 0 && (
                <div className="text-[10px] text-[var(--color-text-muted)] font-mono">≈ {sessionsToNext} sessions</div>
              )}
            </div>
          </div>
          {badgeNearest && (
            <div className="rounded-xl p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center gap-3" data-testid="summary-badge-progress">
              <Target size={20} className="text-[var(--color-accent-purple)] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--color-text-faint)]">Closest Badge</div>
                <div className="font-clash font-semibold text-sm truncate">{badgeNearest.master_badges.name}</div>
                <div className="text-[10px] text-[var(--color-text-muted)] font-mono">{badgeNearest.progress_current}/{badgeNearest.progress_target}</div>
              </div>
            </div>
          )}
          <div className="rounded-xl p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center gap-3">
            <Sparkles size={20} className="text-[var(--color-accent-pink)] shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--color-text-faint)]">Challenges</div>
              <div className="font-clash font-semibold text-sm">{challengesDone.done}/{challengesDone.total} done today</div>
            </div>
          </div>
        </div>

        {onContinue && (
          <button
            onClick={onContinue}
            data-testid="summary-continue"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white text-sm font-semibold font-bricolage transition-all"
          >
            Continue <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

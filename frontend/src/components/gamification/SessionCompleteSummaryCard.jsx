import { useEffect, useMemo, useState } from 'react';
import { Flame, Sparkles, Target, Trophy, Zap, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

// Aggregates the gamification side-effects of the just-completed session into
// a single celebratory card. Mounted on SessionCompletePage below the existing
// per-phase summary, above the module-complete callout / CTAs.
//
// Data window: events with created_at >= sessionStartTs (passed by parent), or
// a 30-minute fallback when sessionStartTs is unknown. Querying narrow by
// time bound keeps the noise out of older sessions during retakes.

const REASON_LABELS = {
  signup_bonus: 'Signup bonus',
  daily_login: 'Daily login',
  quiz_correct: 'Quiz',
  simulation_complete: 'Simulation',
  session_complete: 'Session complete',
  module_complete: 'Module complete',
  capstone_complete: 'Capstone',
  badge_unlock_bonus: 'Badge',
  streak_milestone: 'Streak milestone',
  daily_challenge_complete: 'Daily challenge',
  daily_champion_bonus: 'Daily Champion',
  manual_adjust: 'Adjustment',
};

const LEVEL_NAMES = ['Trainee','Equity Apprentice','Equity Analyst','Senior Analyst','Associate','VP','Director','MD','Partner','CIO'];
const LEVEL_THRESHOLDS = [0, 250, 600, 1200, 2000, 3200, 5000, 7500, 11000, 16000];

function fmtDelta(amount) { return `+${amount}`; }

function computeNextMilestone({ stats, badges, sessionXp }) {
  const candidates = [];
  // XP-to-next-level
  const level = stats?.current_level || 1;
  const idx = Math.max(0, Math.min(LEVEL_THRESHOLDS.length - 1, level - 1));
  if (idx < LEVEL_THRESHOLDS.length - 1) {
    const nextThresh = LEVEL_THRESHOLDS[idx + 1];
    const xpTo = Math.max(0, nextThresh - (stats?.total_xp || 0));
    if (xpTo > 0) candidates.push({ type:'level', label:`${xpTo} XP to ${LEVEL_NAMES[idx + 1]}`, delta:xpTo });
  }
  // Streak milestone
  const streak = stats?.current_streak_days || 0;
  const streakMilestones = [3, 7, 14, 30, 60, 100];
  const nextStreak = streakMilestones.find((m) => m > streak);
  if (nextStreak) {
    candidates.push({ type:'streak', label:`${nextStreak - streak} day${nextStreak - streak === 1 ? '' : 's'} to ${nextStreak}-day streak`, delta:(nextStreak - streak) * 100 });
  }
  // Near-miss badge, pick the one closest to completion.
  const nearest = (badges || []).filter((b) => !b.is_unlocked && b.progress_target > 0).map((b) => ({
    type:'badge',
    label:`${b.progress_target - b.progress_current} more ${b.title || b.name || b.code} unit${(b.progress_target - b.progress_current) === 1 ? '' : 's'} → ${b.name}`,
    delta:b.progress_target - b.progress_current,
    pct:(b.progress_current / b.progress_target),
  })).filter((c) => c.delta > 0).sort((a, b) => a.delta - b.delta)[0];
  if (nearest && nearest.pct >= 0.5) candidates.push(nearest);
  if (candidates.length === 0) return null;
  // Prefer the lowest absolute delta (fastest to reach).
  candidates.sort((a, b) => a.delta - b.delta);
  return candidates[0];
}

export default function SessionCompleteSummaryCard({ sessionStartTs }) {
  const { user } = useAuth();
  const [xpEvents, setXpEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [dailyGoalMins, setDailyGoalMins] = useState(15);
  const [todayActivity, setTodayActivity] = useState(null);
  const [todayChallenges, setTodayChallenges] = useState([]);
  const [newBadges, setNewBadges] = useState([]);
  const [nearMiss, setNearMiss] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!user?.id) { setLoading(false); return undefined; }
    const since = sessionStartTs ? new Date(sessionStartTs).toISOString() : new Date(Date.now() - 30 * 60 * 1000).toISOString();
    (async () => {
      const [{ data: xp }, { data: st }, { data: act }, { data: dc }, { data: bd }] = await Promise.all([
        supabase.from('user_xp_events').select('amount,reason,created_at').eq('user_id', user.id).gte('created_at', since).order('created_at'),
        supabase.from('user_stats').select('total_xp,current_level,current_streak_days,longest_streak_days,daily_goal_minutes,streak_freeze_tokens').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_daily_activity').select('xp_earned,sessions_completed,minutes_spent,activity_date').eq('user_id', user.id).order('activity_date', { ascending:false }).limit(1),
        supabase.rpc('pick_daily_challenges', { p_user_id: user.id }),
        supabase.from('user_badges').select('badge_id,is_unlocked,earned_at,progress_current,progress_target,master_badges(code,name,rarity,icon_slug)').eq('user_id', user.id),
      ]);
      if (!alive) return;
      setXpEvents(xp || []);
      setStats(st || null);
      setDailyGoalMins(st?.daily_goal_minutes || 15);
      setTodayActivity((act && act[0]) || null);
      setTodayChallenges(dc?.challenges || []);
      // Badges unlocked AFTER session start.
      const unlockedAfter = (bd || []).filter((r) => r.is_unlocked && r.earned_at && new Date(r.earned_at) >= new Date(since));
      setNewBadges(unlockedAfter.map((r) => ({
        code: r.master_badges?.code,
        name: r.master_badges?.name,
        rarity: r.master_badges?.rarity,
      })));
      const nm = (bd || [])
        .filter((r) => !r.is_unlocked && r.progress_target > 0)
        .map((r) => ({
          code: r.master_badges?.code,
          name: r.master_badges?.name,
          progress_current: r.progress_current,
          progress_target: r.progress_target,
        }));
      setNearMiss(nm);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id, sessionStartTs]);

  const xpBreakdown = useMemo(() => {
    const groups = {};
    let total = 0;
    xpEvents.forEach((e) => {
      const k = e.reason;
      groups[k] = (groups[k] || 0) + Number(e.amount || 0);
      total += Number(e.amount || 0);
    });
    return { total, rows: Object.entries(groups).sort((a, b) => b[1] - a[1]) };
  }, [xpEvents]);

  const milestone = useMemo(() => computeNextMilestone({
    stats,
    badges: nearMiss,
    sessionXp: xpBreakdown.total,
  }), [stats, nearMiss, xpBreakdown.total]);

  if (loading) return null;
  if (xpBreakdown.total === 0 && (todayChallenges.length === 0) && newBadges.length === 0) {
    // Nothing happened this session, render nothing.
    return null;
  }

  const minsSpent = Number(todayActivity?.minutes_spent || 0);
  const goalPct = Math.min(100, Math.round((minsSpent / Math.max(1, dailyGoalMins)) * 100));
  const dcDone = todayChallenges.filter((c) => c.is_completed).length;

  return (
    <section
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 sm:p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-5"
      data-testid="session-complete-summary"
    >
      {/* XP gained */}
      <div className="md:col-span-2">
        <div className="flex items-end gap-3 mb-2">
          <div className="font-clash text-4xl font-extrabold bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent-purple)] bg-clip-text text-transparent">
            {fmtDelta(xpBreakdown.total)} XP
          </div>
          <div className="text-xs text-[var(--color-text-muted)] pb-1.5">earned this session</div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {xpBreakdown.rows.map(([reason, amt]) => (
            <span
              key={reason}
              data-testid={`session-summary-xp-${reason}`}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] px-2.5 py-1"
            >
              <Zap size={11} className="text-[var(--color-accent)]" />
              <span className="font-mono">{fmtDelta(amt)}</span>
              <span className="text-[var(--color-text-muted)]">{REASON_LABELS[reason] || reason}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Streak */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)] flex items-center gap-1">
          <Flame size={11} className="text-orange-400" /> Streak
        </div>
        <div className="font-clash text-2xl font-bold text-[var(--color-text)] mt-1">
          {stats?.current_streak_days || 0}-day
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">
          Longest: {stats?.longest_streak_days || 0} days
        </div>
      </div>

      {/* Daily Goal */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)] flex items-center gap-1">
          <Target size={11} className="text-emerald-400" /> Daily Goal
        </div>
        <div className="font-clash text-2xl font-bold text-[var(--color-text)] mt-1">
          {minsSpent} / {dailyGoalMins} min {goalPct >= 100 && <span className="text-emerald-400 text-lg">✓</span>}
        </div>
        <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden mt-1.5">
          <div className="h-full bg-emerald-400" style={{ width: `${goalPct}%` }} />
        </div>
      </div>

      {/* Daily Challenges */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)] flex items-center gap-1">
          <Sparkles size={11} className="text-[var(--color-accent)]" /> Daily Challenges
        </div>
        <div className="font-clash text-2xl font-bold text-[var(--color-text)] mt-1">
          {dcDone}/3 done
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">
          {dcDone === 3 ? 'Daily Champion claimed!' : `Finish ${3 - dcDone} more for Daily Champion`}
        </div>
      </div>

      {/* Next milestone */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)] flex items-center gap-1">
          <ArrowRight size={11} className="text-pink-400" /> Next milestone
        </div>
        <div className="font-clash text-base font-bold text-[var(--color-text)] mt-1 leading-snug">
          {milestone ? milestone.label : 'Keep crushing it.'}
        </div>
      </div>

      {/* Badges unlocked this session */}
      {newBadges.length > 0 && (
        <div className="md:col-span-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-amber-300 flex items-center gap-1 mb-2">
            <Trophy size={11} /> Unlocked this session
          </div>
          <div className="flex flex-wrap gap-2">
            {newBadges.map((b) => (
              <span
                key={b.code}
                data-testid={`session-summary-badge-${b.code}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/40 px-2.5 py-1 text-xs font-semibold text-amber-200"
              >
                <Trophy size={11} /> {b.name}
                <span className="text-[10px] font-mono uppercase text-amber-300/70">{b.rarity}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

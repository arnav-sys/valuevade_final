import { useEffect, useRef, useState } from 'react';
import { Target } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useXP } from '../../contexts/XPContext';
import { supabase } from '../../lib/supabase';
import { todayISTKey } from '../../utils/xp';

/**
 * Small horizontal progress bar showing today's minutes vs daily_goal_minutes.
 *
 * Data source: sum minutes_spent from user_daily_activity for today's IST date.
 * The award_xp RPC updates this row when callers pass meta.minutes, so this
 * component reflects whatever's been logged in the current IST day.
 *
 * Fires a one-shot "Daily goal hit!" toast when the user crosses 100% for the
 * first time today. We dedupe via localStorage so reloads on the same day
 * don't re-fire the toast.
 */
export default function DailyGoalTracker() {
  const { user } = useAuth();
  const { stats } = useXP();
  const [minutesToday, setMinutesToday] = useState(0);
  const goalToastedRef = useRef(false);

  const goal = stats?.daily_goal_minutes || 0;

  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    const today = todayISTKey();

    const fetchMinutes = async () => {
      const { data, error } = await supabase
        .from('user_daily_activity')
        .select('minutes_spent')
        .eq('user_id', user.id)
        .eq('activity_date', today)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        console.warn('[daily-goal-tracker] fetch failed:', error.message);
        return;
      }
      setMinutesToday(data?.minutes_spent || 0);
    };
    fetchMinutes();
    // Re-fetch every 30s while the tab is open so the bar climbs after activity.
    const id = setInterval(fetchMinutes, 30_000);
    return () => { alive = false; clearInterval(id); };
    // Also refetch when stats refresh (XPContext.refresh is called after every award).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, stats?.updated_at]);

  // One-shot toast on goal-hit per IST day
  useEffect(() => {
    if (!goal || minutesToday < goal) return;
    const key = `vv_goal_hit_${todayISTKey()}_${user?.id || 'anon'}`;
    if (goalToastedRef.current) return;
    if (typeof window !== 'undefined' && localStorage.getItem(key)) {
      goalToastedRef.current = true;
      return;
    }
    goalToastedRef.current = true;
    try {
      localStorage.setItem(key, '1');
      toast.success('Daily goal hit! \ud83c\udfaf', {
        description: `${minutesToday} of ${goal} min logged today.`,
        duration: 2600,
      });
    } catch { /* private mode */ }
  }, [minutesToday, goal, user?.id]);

  if (!goal) return null;

  const pct = Math.min(100, Math.round((minutesToday / goal) * 100));
  const hit = minutesToday >= goal;

  return (
    <div className="glass-card rounded-2xl p-4 mt-3" data-testid="daily-goal-tracker">
      <div className="flex items-center justify-between mb-2">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
          <Target size={12} /> Today\u2019s goal
        </div>
        <div className="text-xs font-mono" style={{ color: hit ? '#F59E0B' : 'var(--color-text)' }}>
          {minutesToday} / {goal} min
        </div>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: hit
              ? 'linear-gradient(90deg, #F59E0B, #FBBF24, #FFD700)'
              : 'linear-gradient(90deg, var(--color-primary), var(--color-accent-purple))',
            boxShadow: hit ? '0 0 16px rgba(245,158,11,0.4)' : 'none',
          }}
        />
      </div>
      {hit && (
        <div className="mt-2 text-[11px] font-mono tracking-wider text-[#F59E0B]" data-testid="daily-goal-hit-pill">
          GOAL REACHED \u00b7 Consistency compounds.
        </div>
      )}
    </div>
  );
}

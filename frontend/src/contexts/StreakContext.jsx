import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useSound } from './SoundContext';
import { supabase } from '../lib/supabase';
import { setStreakUpdater, clearStreakUpdater } from '../utils/streakBus';

// Tiers map the streak counter to a visual treatment.
export function tierFor(streak) {
  if (streak >= 30) return 3;
  if (streak >= 7)  return 2;
  if (streak >= 3)  return 1;
  return 0;
}

const MILESTONE_TIER_MAP = {
  fire_3: 1,
  flame_7: 2,
  legendary_30: 3,
};

const StreakContext = createContext(null);

export function StreakProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { playSound } = useSound();

  const [bootstrapping, setBootstrapping] = useState(true);
  const [stats, setStats] = useState(null);
  const [pendingMilestone, setPendingMilestone] = useState(null); // { tier:1|2|3, streak, freezeTokens }
  const [pendingShame, setPendingShame] = useState(null);         // { lost_days, lost_xp_value, freezeTokens, breakAt }

  const backfillFiredRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setStats(null);
      return null;
    }
    // user_stats can occasionally end up with >1 row per user from race
    // conditions in the bootstrap path. Order by total_xp DESC + limit(1) so
    // we always read the canonical row (highest XP wins) instead of erroring
    // out of `.maybeSingle()` when duplicates exist. Targeted hardening for
    // the Gap-3 shame-card persistence — the underlying dedup of user_stats
    // is a pre-existing concern outside this iteration's scope.
    const { data, error } = await supabase
      .from('user_stats')
      .select('current_streak_days, longest_streak_days, streak_freeze_tokens, last_streak_freeze_earned_at, auto_spend_freeze, last_streak_break_at, last_streak_break_lost_days, shame_card_seen_at')
      .eq('user_id', user.id)
      .order('total_xp', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('[streak] refresh failed:', error.message);
      return null;
    }
    setStats(data || null);
    return data;
  }, [user?.id]);

  // Initial load + idempotent backfill on first mount per user.
  useEffect(() => {
    if (authLoading || !user?.id) {
      setBootstrapping(false);
      return;
    }
    let alive = true;
    (async () => {
      const initial = await refresh();
      if (!alive) return;
      // Backfill: only when current_streak_days is 0 and we haven't already done it.
      if (!backfillFiredRef.current && initial && (initial.current_streak_days || 0) === 0) {
        backfillFiredRef.current = true;
        try {
          await supabase.rpc('backfill_streak_from_history', { p_user_id: user.id });
          if (!alive) return;
          await refresh();
        } catch (err) {
          console.warn('[streak] backfill_streak_from_history failed:', err?.message || err);
        }
      }
      // Persistent shame-card gate. If the most recent streak break has not
      // yet been acknowledged (shame_card_seen_at IS NULL OR
      // last_streak_break_at > shame_card_seen_at), surface the shame card
      // automatically — even on a fresh page load. This guarantees the
      // modal is reload-resistant: if the user reloads mid-modal without
      // dismissing, it shows again. It only goes away after they actually
      // click Rebuild / Use Freeze / X (which writes shame_card_seen_at).
      const fresh = alive ? await refresh() : null;
      if (alive && fresh && fresh.last_streak_break_at) {
        const breakTs = new Date(fresh.last_streak_break_at).getTime();
        const seenTs = fresh.shame_card_seen_at ? new Date(fresh.shame_card_seen_at).getTime() : 0;
        if (breakTs > seenTs) {
          setPendingShame({
            lost_days: fresh.last_streak_break_lost_days || 0,
            // 25 XP per day of streak (daily_login bonus) is the canonical
            // approximation. Server tracks exact value if needed later.
            lost_xp_value: (fresh.last_streak_break_lost_days || 0) * 25,
            freezeTokens: fresh.streak_freeze_tokens || 0,
            breakAt: breakTs,
          });
        }
      }
      setBootstrapping(false);
    })();
    return () => { alive = false; };
  }, [user?.id, authLoading, refresh]);

  // The big one: call update_streak_on_activity exactly once per activity
  // event (a session completion, a quiz submission, a daily login, etc.).
  const updateOnActivity = useCallback(async () => {
    if (!user?.id) return { ok: false, reason: 'no_user' };
    try {
      const { data, error } = await supabase.rpc('update_streak_on_activity', { p_user_id: user.id });
      if (error) {
        console.warn('[streak] update_streak_on_activity error:', error.message);
        return { ok: false, reason: error.message };
      }
      // refresh local state
      await refresh();

      // Milestones
      const mt = MILESTONE_TIER_MAP[data?.milestone_hit];
      if (mt) {
        setPendingMilestone({
          tier: mt,
          streak: data.current_streak_days,
          freezeTokens: data.streak_freeze_tokens,
        });
        playSound('streak_milestone');
      }

      // Shame card
      if (data?.was_broken) {
        setPendingShame({
          lost_days: data.lost_days || 0,
          lost_xp_value: data.lost_xp_value || 0,
          freezeTokens: data.streak_freeze_tokens || 0,
          breakAt: Date.now(),
        });
      } else if (data?.tokens_consumed > 0) {
        // Quiet positive nudge when auto-spend kept the streak alive.
        toast.success(`Streak saved \u2014 ${data.tokens_consumed} freeze used`, {
          description: `${data.streak_freeze_tokens} freeze${data.streak_freeze_tokens === 1 ? '' : 's'} left`,
          duration: 2600,
        });
      } else if (data?.freeze_earned) {
        toast.success('Streak Freeze earned \u2744\ufe0f', {
          description: 'Saved for when you need it.',
          duration: 2200,
        });
      }

      return data;
    } catch (err) {
      console.warn('[streak] updateOnActivity threw:', err?.message || err);
      return { ok: false, reason: err?.message || String(err) };
    }
  }, [user?.id, refresh, playSound]);

  // Wire bus so XPContext + utils can fire streak without importing this file.
  useEffect(() => {
    setStreakUpdater(updateOnActivity);
    return () => clearStreakUpdater(updateOnActivity);
  }, [updateOnActivity]);

  // Mark the shame card as acknowledged. Persists to user_stats so reloading
  // the page after dismissal does NOT re-show the modal (until the next
  // streak break advances last_streak_break_at past shame_card_seen_at).
  // Declared BEFORE consumeFreeze + dismissShame so their deps arrays have
  // a defined binding (no TDZ).
  const markShameSeen = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('user_stats')
        .update({ shame_card_seen_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) console.warn('[streak] markShameSeen failed:', error.message);
      else await refresh();
    } catch (err) {
      console.warn('[streak] markShameSeen threw:', err?.message || err);
    }
  }, [user?.id, refresh]);

  const consumeFreeze = useCallback(async () => {
    if (!user?.id) return { ok: false };
    try {
      const { data, error } = await supabase.rpc('consume_streak_freeze', { p_user_id: user.id });
      if (error) {
        toast.error('Could not use freeze', { description: error.message, duration: 2600 });
        return { ok: false, reason: error.message };
      }
      await refresh();
      if (data?.ok) {
        toast.success(`Streak restored to ${data.current_streak_days} days`, {
          description: 'One freeze token used.',
          duration: 2600,
        });
        setPendingShame(null);
        await markShameSeen();
      } else {
        toast.error('Could not use freeze', { description: data?.reason || 'Try again.', duration: 2600 });
      }
      return data;
    } catch (err) {
      console.warn('[streak] consumeFreeze threw:', err?.message || err);
      return { ok: false };
    }
  }, [user?.id, refresh, markShameSeen]);

  const dismissShame = useCallback(async () => {
    setPendingShame(null);
    await markShameSeen();
  }, [markShameSeen]);

  const value = useMemo(() => {
    const currentStreak = stats?.current_streak_days || 0;
    return {
      bootstrapping,
      stats,
      currentStreak,
      longestStreak: stats?.longest_streak_days || 0,
      freezeTokens: stats?.streak_freeze_tokens || 0,
      lastFreezeEarnedAt: stats?.last_streak_freeze_earned_at || null,
      autoSpendFreeze: stats?.auto_spend_freeze ?? true,
      lastBreakAt: stats?.last_streak_break_at || null,
      milestoneTier: tierFor(currentStreak),
      refresh,
      updateOnActivity,
      consumeFreeze,
      pendingMilestone,
      clearMilestone: () => setPendingMilestone(null),
      pendingShame,
      clearShame: dismissShame,
    };
  }, [bootstrapping, stats, refresh, updateOnActivity, consumeFreeze, pendingMilestone, pendingShame, dismissShame]);

  return <StreakContext.Provider value={value}>{children}</StreakContext.Provider>;
}

export function useStreak() {
  const ctx = useContext(StreakContext);
  if (!ctx) {
    return {
      bootstrapping: false,
      stats: null,
      currentStreak: 0,
      longestStreak: 0,
      freezeTokens: 0,
      lastFreezeEarnedAt: null,
      autoSpendFreeze: true,
      lastBreakAt: null,
      milestoneTier: 0,
      refresh: async () => null,
      updateOnActivity: async () => ({ ok: false }),
      consumeFreeze: async () => ({ ok: false }),
      pendingMilestone: null,
      clearMilestone: () => {},
      pendingShame: null,
      clearShame: () => {},
    };
  }
  return ctx;
}

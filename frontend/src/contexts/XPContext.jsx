import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useSound } from './SoundContext';
import { supabase } from '../lib/supabase';
import { triggerStreakUpdate } from '../utils/streakBus';
import { triggerBadgeEvaluation } from '../utils/badgeBus';
import {
  awardXP as awardXPRaw,
  getLevelInfo,
  loadLevels,
  todayISTKey,
  XP_REASONS,
} from '../utils/xp';

// Title + subtitle copy per reason. The brief asked for friendly subtitles
// so the dopamine signal feels handcrafted, not telemetric.
const REASON_LABELS = {
  session_complete: 'Session complete!',
  quiz_correct: 'Quiz answers locked in',
  quiz_attempt: 'Quiz attempted',
  simulation_complete: 'Simulation submitted!',
  daily_login: 'Welcome back!',
  capstone_complete: 'Capstone complete!',
  module_complete: 'Module complete!',
  daily_challenge_complete: 'Daily challenge done!',
  daily_champion_bonus: "Today's champion",
  signup_bonus: 'Welcome to Valuevade!',
  badge_unlock_bonus: 'Badge unlocked',
  streak_milestone: 'Streak milestone!',
  manual_adjust: 'XP updated',
};

// Reasons that fire the badge evaluator from XPContext (non-phase XP events).
// Phase-related reasons (quiz_correct, simulation_complete, session_complete,
// module_complete, capstone_complete, badge_unlock_bonus) are already covered
// by the page-level triggerBadgeEvaluation calls inside markPhaseComplete
// flows, so we skip them here to avoid double-firing the RPC.
const BADGE_EVAL_REASONS_FROM_XP = new Set([
  'signup_bonus',
  'daily_login',
  'daily_challenge_complete',
  'daily_champion_bonus',
  'streak_milestone',
  'manual_adjust',
]);

const XPContext = createContext(null);

export function XPProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { playSound } = useSound();

  const [bootstrapping, setBootstrapping] = useState(true);
  const [stats, setStats] = useState(null);            // current user_stats row
  const [levelInfo, setLevelInfo] = useState(null);    // derived from stats + master_levels
  const [pendingLevelUp, setPendingLevelUp] = useState(null); // { from, to, levelName, levelColor, levelIcon }
  // Slot-machine particle queue. Capped at 3 (newest replaces oldest) so a
  // burst of 5 quiz corrects in 200ms doesn't leave 5 floating "+12 XP" tags
  // racing each other. Each entry: { amount, x, y, key }.
  const [xpParticles, setXpParticles] = useState([]);

  // Per-user idempotency guards within a single tab/session
  const dailyLoginFiredRef = useRef(false);
  const signupBonusFiredRef = useRef(false);

  const refreshStats = useCallback(async () => {
    if (!user?.id) {
      setStats(null);
      setLevelInfo(null);
      return null;
    }
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.warn('[xp] user_stats fetch failed:', error.message);
      return null;
    }
    setStats(data || null);
    if (data) {
      const info = await getLevelInfo(data.current_level || 1, data.total_xp || 0);
      setLevelInfo(info);
    } else {
      const info = await getLevelInfo(1, 0);
      setLevelInfo(info);
    }
    return data;
  }, [user?.id]);

  // Pre-warm master_levels cache + load initial stats
  useEffect(() => {
    let alive = true;
    if (authLoading) return;
    (async () => {
      try {
        await loadLevels();
        if (!alive) return;
        await refreshStats();
      } finally {
        if (alive) setBootstrapping(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  // Core award funnel — pipes through the RPC, fires toast/sound/level-up.
  const awardXP = useCallback(async ({ amount, reason, source_id = null, meta = {}, silent = false, origin = null } = {}) => {
    if (!user?.id) return { ok: false, error: 'no user' };
    const result = await awardXPRaw({ amount, reason, source_id, meta });
    if (!result.ok) {
      // Don't spam toast on error — log and bail.
      return result;
    }
    // Refresh local mirror of user_stats so all subscribers see new XP.
    await refreshStats();

    if (!silent) {
      const label = REASON_LABELS[reason] || 'XP earned';
      const amt = result.awarded_amount;
      if (amt > 0) {
        // Toast is fired by XPContext as a side effect of EVERY successful
        // awardXP, so call sites (QuizComplete / SimulationPage /
        // CapstoneTasksPage / daily-login / signup-backfill) all surface UX
        // for free.  Position + duration + theme come from the Toaster mount
        // in App.js so toasts stay consistent across the app.
        toast.success(`+${amt} XP`, {
          description: label,
          duration: 2200,
        });
        playSound('xp_gain');
      }
    }

    if (result.did_level_up) {
      const fromLevel = result.current_level - 1;
      // Build the level-up payload from master_levels via getLevelInfo (already cached)
      try {
        const newInfo = await getLevelInfo(result.current_level, result.total_xp);
        setPendingLevelUp({
          from: fromLevel,
          to: result.current_level,
          levelName: newInfo.level_name,
          levelColor: newInfo.level_color,
          levelIcon: newInfo.level_icon,
          totalXp: result.total_xp,
        });
      } catch (err) {
        console.error('[xp] level-up payload build failed:', err);
      }
    }

    // Always spawn the floating +N particle when we have a known origin
    if (origin && result.awarded_amount > 0) {
      setXpParticle({
        amount: result.awarded_amount,
        x: origin.x,
        y: origin.y,
        key: Date.now() + Math.random(),
      });
    }

    // Fire badge evaluator for non-phase XP events only. Phase events
    // (quiz/sim/session/module/capstone) trigger the evaluator from their
    // own pages, so firing again here would just duplicate the RPC call.
    if (BADGE_EVAL_REASONS_FROM_XP.has(reason)) {
      try {
        await triggerBadgeEvaluation({ source_event: reason });
      } catch { /* fire-and-forget */ }
    }

    return result;
  }, [user?.id, playSound, refreshStats]);

  // Daily login + signup_bonus backfill on first authenticated load
  useEffect(() => {
    if (!user?.id || !stats) return;
    let cancelled = false;

    // 1) Signup bonus / existing-user one-time backfill
    (async () => {
      if (signupBonusFiredRef.current) return;
      if ((stats.total_xp || 0) !== 0) return;
      const { data: prior, error } = await supabase
        .from('user_xp_events')
        .select('id')
        .eq('user_id', user.id)
        .eq('reason', XP_REASONS.signup_bonus)
        .limit(1);
      if (cancelled) return;
      if (error) {
        console.warn('[xp] signup_bonus pre-check failed:', error.message);
        return;
      }
      if ((prior || []).length > 0) {
        signupBonusFiredRef.current = true;
        return;
      }
      signupBonusFiredRef.current = true;
      await awardXP({ amount: 10, reason: XP_REASONS.signup_bonus, meta: { kind: 'first_load_backfill' } });
    })();

    // 2) Daily login — once per IST day
    (async () => {
      if (dailyLoginFiredRef.current) return;
      const last = stats.last_login_at_ist;
      const today = todayISTKey();
      const lastDay = last ? todayISTKey(new Date(last)) : null;
      if (lastDay === today) {
        dailyLoginFiredRef.current = true;
        return;
      }
      dailyLoginFiredRef.current = true;
      // Award first so the ledger is the source of truth, then stamp last_login_at_ist.
      await awardXP({ amount: 25, reason: XP_REASONS.daily_login, meta: { ist_day: today, minutes: 0 } });
      try {
        await supabase
          .from('user_stats')
          .update({ last_login_at_ist: new Date().toISOString() })
          .eq('user_id', user.id);
        await refreshStats();
      } catch (err) {
        console.warn('[xp] last_login stamp failed:', err?.message || err);
      }
      // Daily login also counts as activity for the streak engine.
      // triggerStreakUpdate is fire-and-forget — StreakContext owns the
      // refresh + milestone/shame overlay surfacing.
      try { await triggerStreakUpdate(); } catch { /* StreakProvider may not be mounted yet */ }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, stats?.id]);

  // Public helper to spawn a particle from a click target. Maintains a max-3
  // queue (newest displaces oldest) so rapid-fire bursts (5+ quiz corrects)
  // don't crowd the screen.
  const triggerXPParticle = useCallback(({ amount, x, y }) => {
    setXpParticles((prev) => {
      const next = [...prev, { amount, x, y, key: Date.now() + Math.random() }];
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });
  }, []);
  const dismissXpParticle = useCallback((key) => {
    setXpParticles((prev) => prev.filter((p) => p.key !== key));
  }, []);

  const value = useMemo(() => ({
    bootstrapping,
    stats,
    xp: stats?.total_xp || 0,
    level: stats?.current_level || 1,
    levelName: levelInfo?.level_name || 'Junior Analyst',
    levelIcon: levelInfo?.level_icon || null,
    levelColor: levelInfo?.level_color || '#246BFD',
    nextLevelName: levelInfo?.next_level_name || null,
    nextThreshold: levelInfo?.next_threshold || 0,
    xpToNext: levelInfo?.xp_to_next ?? 0,
    progressPct: levelInfo?.progress_pct ?? 0,
    isMaxLevel: !!levelInfo?.is_max_level,
    awardXP,
    refresh: refreshStats,
    triggerXPParticle,
    pendingLevelUp,
    clearLevelUp: () => setPendingLevelUp(null),
    xpParticles,
    dismissXpParticle,
    // Back-compat shim: legacy callers reading `xpParticle` / `clearParticle`
    // see the head of the queue. New callers should use `xpParticles`.
    xpParticle: xpParticles[0] || null,
    clearParticle: () => setXpParticles((p) => p.slice(1)),
  }), [bootstrapping, stats, levelInfo, awardXP, refreshStats, triggerXPParticle, pendingLevelUp, xpParticles, dismissXpParticle]);

  return <XPContext.Provider value={value}>{children}</XPContext.Provider>;
}

export function useXP() {
  const ctx = useContext(XPContext);
  if (!ctx) {
    // Outside a provider — degrade gracefully so unauthenticated pages don't crash.
    return {
      bootstrapping: false,
      stats: null,
      xp: 0,
      level: 1,
      levelName: 'Junior Analyst',
      levelColor: '#246BFD',
      nextLevelName: null,
      nextThreshold: 0,
      xpToNext: 0,
      progressPct: 0,
      isMaxLevel: false,
      awardXP: async () => ({ ok: false, error: 'no provider' }),
      refresh: async () => null,
      triggerXPParticle: () => {},
      pendingLevelUp: null,
      clearLevelUp: () => {},
      xpParticles: [],
      dismissXpParticle: () => {},
      xpParticle: null,
      clearParticle: () => {},
    };
  }
  return ctx;
}

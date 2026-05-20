import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useSound } from './SoundContext';
import { supabase } from '../lib/supabase';
import { setBadgeEvaluator, clearBadgeEvaluator } from '../utils/badgeBus';

// Returns hh:mm in IST for context payloads.
function istNowMeta() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return {
    hour_ist: ist.getUTCHours(),
    session_completed_at_ist: ist.toISOString(),
  };
}

// Small gap between consecutive badge-unlock overlays so they don't feel
// like a slideshow when several unlock in the same tick (catch-up flow).
const QUEUE_GAP_MS = 350;
// De-dupe window for the same badge code across realtime + evaluator return.
// A real unlock fires both paths within ~50-300ms; this stops it from
// celebrating twice while still allowing future re-unlocks (e.g. dev resets).
const DEDUPE_WINDOW_MS = 5000;

const BadgeContext = createContext(null);

export function BadgeProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { playSound } = useSound();

  const [bootstrapping, setBootstrapping] = useState(true);
  const [badges, setBadges] = useState([]);          // master rows enriched with user state
  const [unlockQueue, setUnlockQueue] = useState([]); // FIFO queue of newly_unlocked badges
  const [activeUnlock, setActiveUnlock] = useState(null);
  const [nearMiss, setNearMiss] = useState([]);

  // Re-entrancy guard so the same mount doesn't fire the catch-up twice if
  // refresh() resolves before the DB flag write lands. (Persistence lives in
  // user_stats.p3_catchup_done — this is just an in-tab fuse.)
  const catchupFiredRef = useRef(false);
  // Cooldown between consecutive overlays in the unlock queue.
  const gapTimerRef = useRef(null);
  // Dedupe map: badge_code -> last-celebrated timestamp (ms epoch).
  // Collapses the realtime path + evaluator-return path for the same unlock
  // into a single celebration. Also prevents a dev_force_unlock_badge that
  // reverts and re-unlocks within 5s from blowing up the queue.
  const recentlyCelebratedRef = useRef(new Map());

  const refresh = useCallback(async () => {
    if (!user?.id) { setBadges([]); return []; }
    const { data: masters, error: mErr } = await supabase
      .from('master_badges')
      .select('id, code, name, description, category, rarity, icon_slug, is_secret, bonus_xp, progress_target, display_order, criteria_json')
      .order('display_order');
    if (mErr) {
      console.warn('[badges] master fetch failed:', mErr.message);
      return [];
    }
    const { data: ubRows, error: uErr } = await supabase
      .from('user_badges')
      .select('badge_id, progress_current, progress_target, is_unlocked, earned_at, last_progress_seen')
      .eq('user_id', user.id);
    if (uErr) {
      console.warn('[badges] user fetch failed:', uErr.message);
    }
    const byId = {};
    (ubRows || []).forEach((r) => { byId[r.badge_id] = r; });
    const merged = (masters || []).map((m) => {
      const ub = byId[m.id] || {};
      const progress_target = ub.progress_target || m.progress_target || 1;
      const progress_current = ub.progress_current || 0;
      return {
        ...m,
        is_unlocked: !!ub.is_unlocked,
        earned_at: ub.earned_at || null,
        progress_current,
        progress_target,
        progress_pct: progress_target > 0 ? Math.min(100, Math.round((progress_current / progress_target) * 100)) : 0,
      };
    });
    setBadges(merged);
    return merged;
  }, [user?.id]);

  // Single celebration enqueue point. Dedupes on badge `code` within a 5s
  // window so realtime + evaluator-return can both call us safely. Source is
  // either {code,name,…} (evaluator return shape) or a master_badges row id.
  const enqueueCelebration = useCallback(async (source) => {
    let payload = null;
    if (source && typeof source === 'object' && source.code) {
      // Came from evaluate_badges return — already has all fields.
      payload = source;
    } else if (typeof source === 'string') {
      // Came from realtime — string is a master_badges.id (uuid). Fetch row.
      const { data, error } = await supabase
        .from('master_badges')
        .select('code, name, description, category, rarity, icon_slug, is_secret, bonus_xp')
        .eq('id', source)
        .maybeSingle();
      if (error || !data) {
        console.warn('[badges] enqueue: master fetch failed for', source, error?.message);
        return;
      }
      payload = data;
    } else {
      return;
    }
    if (!payload?.code) return;
    const now = Date.now();
    const last = recentlyCelebratedRef.current.get(payload.code) || 0;
    if (now - last < DEDUPE_WINDOW_MS) return;
    recentlyCelebratedRef.current.set(payload.code, now);
    // Garbage-collect stale entries so the map doesn't grow unbounded.
    for (const [c, ts] of recentlyCelebratedRef.current.entries()) {
      if (now - ts > 60_000) recentlyCelebratedRef.current.delete(c);
    }
    setUnlockQueue((q) => [...q, payload]);
  }, []);

  // Single mutation funnel: call RPC, enqueue any newly_unlocked, store near_miss.
  const evaluate = useCallback(async (context = {}) => {
    if (!user?.id) return { ok: false, reason: 'no_user' };
    try {
      const payload = { ...istNowMeta(), ...context };
      const { data, error } = await supabase.rpc('evaluate_badges', {
        p_user_id: user.id,
        p_context: payload,
      });
      if (error) {
        console.warn('[badges] evaluate error:', error.message);
        return { ok: false, reason: error.message };
      }
      const newly = data?.newly_unlocked || [];
      const miss = data?.near_miss || [];
      // Fast path: enqueue celebrations directly from RPC return.
      // The realtime subscription below ALSO listens for the user_badges UPDATE
      // event that this RPC just triggered. enqueueCelebration() dedupes on
      // `code` within DEDUPE_WINDOW_MS so we never double-celebrate.
      for (const n of newly) {
        // eslint-disable-next-line no-await-in-loop
        await enqueueCelebration(n);
      }
      if (miss.length > 0) {
        setNearMiss((prev) => {
          const map = new Map(prev.map((m) => [m.code, m]));
          miss.forEach((m) => map.set(m.code, m));
          return Array.from(map.values());
        });
      }
      await refresh();
      return { ok: true, newly_unlocked: newly, near_miss: miss, ...data };
    } catch (err) {
      console.warn('[badges] evaluate threw:', err?.message || err);
      return { ok: false, reason: err?.message || String(err) };
    }
  }, [user?.id, refresh, enqueueCelebration]);

  // Initial load + persistent one-time catch-up evaluation per user.
  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setBootstrapping(false);
      return undefined;
    }
    let alive = true;
    (async () => {
      await refresh();
      if (!alive) return;
      if (!catchupFiredRef.current) {
        catchupFiredRef.current = true;
        let catchupNeeded = true;
        try {
          const { data: row } = await supabase
            .from('user_stats')
            .select('p3_catchup_done')
            .eq('user_id', user.id)
            .maybeSingle();
          if (row && row.p3_catchup_done === true) catchupNeeded = false;
        } catch (err) {
          console.warn('[badges] p3_catchup_done probe failed:', err?.message || err);
        }
        if (catchupNeeded) {
          const result = await evaluate({ source_event: 'p3_catchup' });
          if (!alive) return;
          const count = (result && result.newly_unlocked && result.newly_unlocked.length) || 0;
          console.info(`[badges] p3_catchup unlocked ${count} badge(s)`);
          try {
            await supabase
              .from('user_stats')
              .update({ p3_catchup_done: true })
              .eq('user_id', user.id);
          } catch (err) {
            console.warn('[badges] p3_catchup_done write failed:', err?.message || err);
          }
        }
      }
      if (alive) setBootstrapping(false);
    })();
    return () => { alive = false; };
  }, [user?.id, authLoading, refresh, evaluate]);

  // Realtime subscription on user_badges so ANY path that flips is_unlocked
  // (dev_force_unlock_badge, multi-tab, background job, evaluator RPC) fires
  // the celebration. This is the canonical "did I just earn something?" signal.
  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase
      .channel(`user_badges:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newRow = payload.new || {};
          const oldRow = payload.old || {};
          if (newRow.is_unlocked && !oldRow.is_unlocked) {
            await enqueueCelebration(newRow.badge_id);
            await refresh();
          } else if (newRow.progress_current !== oldRow.progress_current) {
            // progress moved — just refresh, no celebration
            await refresh();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newRow = payload.new || {};
          if (newRow.is_unlocked) {
            await enqueueCelebration(newRow.badge_id);
          }
          await refresh();
        }
      )
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch { /* noop */ }
    };
  }, [user?.id, enqueueCelebration, refresh]);

  // Bus wiring so XPContext / progress.js / pages can call evaluate.
  useEffect(() => {
    setBadgeEvaluator(evaluate);
    return () => clearBadgeEvaluator(evaluate);
  }, [evaluate]);

  // Drain the unlock queue one at a time, with a small inter-overlay gap.
  useEffect(() => {
    if (activeUnlock) return undefined;
    if (unlockQueue.length === 0) return undefined;
    if (gapTimerRef.current) return undefined;
    gapTimerRef.current = setTimeout(() => {
      gapTimerRef.current = null;
      setUnlockQueue((q) => {
        if (q.length === 0) return q;
        const [head, ...rest] = q;
        setActiveUnlock(head);
        playSound('badge_unlock');
        return rest;
      });
    }, QUEUE_GAP_MS);
    return () => {
      if (gapTimerRef.current) { clearTimeout(gapTimerRef.current); gapTimerRef.current = null; }
    };
  }, [activeUnlock, unlockQueue, playSound]);

  const dismissActiveUnlock = useCallback(() => {
    setActiveUnlock(null);
  }, []);

  const dismissNearMiss = useCallback((code) => {
    setNearMiss((prev) => prev.filter((m) => m.code !== code));
  }, []);

  const value = useMemo(() => {
    const unlockedCount = badges.filter((b) => b.is_unlocked).length;
    const total = badges.length;
    return {
      bootstrapping,
      badges,
      unlockedCount,
      total,
      evaluate,
      refresh,
      activeUnlock,
      dismissActiveUnlock,
      nearMiss,
      dismissNearMiss,
    };
  }, [bootstrapping, badges, evaluate, refresh, activeUnlock, dismissActiveUnlock, nearMiss, dismissNearMiss]);

  return <BadgeContext.Provider value={value}>{children}</BadgeContext.Provider>;
}

export function useBadges() {
  const ctx = useContext(BadgeContext);
  if (!ctx) {
    return {
      bootstrapping: false,
      badges: [],
      unlockedCount: 0,
      total: 0,
      evaluate: async () => ({ ok: false }),
      refresh: async () => [],
      activeUnlock: null,
      dismissActiveUnlock: () => {},
      nearMiss: [],
      dismissNearMiss: () => {},
    };
  }
  return ctx;
}

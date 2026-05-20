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
      if (newly.length > 0) {
        setUnlockQueue((q) => [...q, ...newly]);
      }
      if (miss.length > 0) {
        setNearMiss((prev) => {
          // Dedupe by code; replace existing entries with newer values.
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
  }, [user?.id, refresh]);

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
        // Persistence: skip when user_stats.p3_catchup_done is already true.
        let catchupNeeded = true;
        try {
          const { data: row } = await supabase
            .from('user_stats')
            .select('p3_catchup_done')
            .eq('user_id', user.id)
            .maybeSingle();
          if (row && row.p3_catchup_done === true) catchupNeeded = false;
        } catch (err) {
          // Column may not exist on an older deployment — fall through and try.
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
            // If the flag write fails the catch-up will re-run next mount.
            // That's still idempotent at the RPC layer (already-unlocked
            // badges short-circuit on `if v_was_unlocked then continue`).
            console.warn('[badges] p3_catchup_done write failed:', err?.message || err);
          }
        }
      }
      if (alive) setBootstrapping(false);
    })();
    return () => { alive = false; };
  }, [user?.id, authLoading, refresh, evaluate]);

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

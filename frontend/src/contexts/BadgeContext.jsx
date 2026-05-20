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

const BadgeContext = createContext(null);

export function BadgeProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { playSound } = useSound();

  const [bootstrapping, setBootstrapping] = useState(true);
  const [badges, setBadges] = useState([]);          // master rows enriched with user state
  const [unlockQueue, setUnlockQueue] = useState([]); // FIFO queue of newly_unlocked badges
  const [activeUnlock, setActiveUnlock] = useState(null);
  const [nearMiss, setNearMiss] = useState([]);

  const catchupFiredRef = useRef(false);

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
      return data;
    } catch (err) {
      console.warn('[badges] evaluate threw:', err?.message || err);
      return { ok: false, reason: err?.message || String(err) };
    }
  }, [user?.id, refresh]);

  // Initial load + one-time catch-up evaluation per user-session.
  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setBootstrapping(false);
      return;
    }
    let alive = true;
    (async () => {
      await refresh();
      if (!alive) return;
      if (!catchupFiredRef.current) {
        catchupFiredRef.current = true;
        await evaluate({ source_event: 'mount_catchup' });
      }
      if (alive) setBootstrapping(false);
    })();
    return () => { alive = false; };
  }, [user?.id, authLoading, refresh, evaluate]);

  // Bus wiring so XPContext / StreakContext / pages can call evaluate.
  useEffect(() => {
    setBadgeEvaluator(evaluate);
    return () => clearBadgeEvaluator(evaluate);
  }, [evaluate]);

  // Drain the unlock queue one at a time.
  useEffect(() => {
    if (activeUnlock) return;
    if (unlockQueue.length === 0) return;
    const [head, ...rest] = unlockQueue;
    setActiveUnlock(head);
    setUnlockQueue(rest);
    playSound('badge_unlock');
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

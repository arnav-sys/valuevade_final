import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useSound } from './SoundContext';
import { supabase } from '../lib/supabase';

const DailyChallengesContext = createContext(null);

function todayIstIso() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function DailyChallengesProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { playSound } = useSound();

  const [challenges, setChallenges] = useState([]);
  const [todayIst, setTodayIst] = useState(todayIstIso());
  const [championGlowUntil, setChampionGlowUntil] = useState(null);
  const [activeChampion, setActiveChampion] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const pickedRef = useRef(false);
  // Guard so we celebrate at most once per IST day even if the realtime
  // event for daily_champion_glow_until fires more than once.
  const lastChampionDateRef = useRef(null);

  const refreshChallenges = useCallback(async (uid) => {
    if (!uid) { setChallenges([]); return []; }
    const { data, error } = await supabase.rpc('pick_daily_challenges', { p_user_id: uid });
    if (error) {
      console.warn('[daily] pick failed:', error.message);
      return [];
    }
    const todayIsoStr = data?.today_ist || todayIstIso();
    setTodayIst(todayIsoStr);
    setChallenges(data?.challenges || []);
    return data?.challenges || [];
  }, []);

  const refreshGlow = useCallback(async (uid) => {
    if (!uid) return;
    const { data } = await supabase
      .from('user_stats')
      .select('daily_champion_glow_until')
      .eq('user_id', uid)
      .maybeSingle();
    setChampionGlowUntil(data?.daily_champion_glow_until || null);
  }, []);

  // Bootstrap: pick + glow probe once per mount.
  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) { setBootstrapping(false); return undefined; }
    let alive = true;
    (async () => {
      if (!pickedRef.current) {
        pickedRef.current = true;
        await refreshChallenges(user.id);
      }
      await refreshGlow(user.id);
      if (alive) setBootstrapping(false);
    })();
    return () => { alive = false; };
  }, [user?.id, authLoading, refreshChallenges, refreshGlow]);

  // Realtime: user_daily_challenges updates → re-pick (idempotent) to refresh
  // local state with the new progress values.
  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase
      .channel(`user_daily_challenges:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_daily_challenges',
        filter: `user_id=eq.${user.id}`,
      }, async () => {
        await refreshChallenges(user.id);
      })
      // user_stats changes also tell us when glow flips on (champion trigger).
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_stats',
        filter: `user_id=eq.${user.id}`,
      }, async (payload) => {
        const newGlow = payload.new?.daily_champion_glow_until;
        const oldGlow = payload.old?.daily_champion_glow_until;
        setChampionGlowUntil(newGlow || null);
        // Glow newly set (or extended past a stale value) → fire the overlay.
        const newGlowTs = newGlow ? new Date(newGlow).getTime() : 0;
        const oldGlowTs = oldGlow ? new Date(oldGlow).getTime() : 0;
        const futureGlow = newGlowTs > Date.now();
        if (futureGlow && newGlowTs > oldGlowTs) {
          const dateKey = todayIstIso();
          if (lastChampionDateRef.current !== dateKey) {
            lastChampionDateRef.current = dateKey;
            setActiveChampion({ date: dateKey, glow_until: newGlow });
            playSound('daily_champion');
          }
        }
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch { /* noop */ } };
  }, [user?.id, refreshChallenges, playSound]);

  const dismissChampion = useCallback(() => setActiveChampion(null), []);

  const allComplete = useMemo(
    () => challenges.length >= 3 && challenges.every((c) => c.is_completed),
    [challenges]
  );
  const completedCount = useMemo(
    () => challenges.filter((c) => c.is_completed).length,
    [challenges]
  );
  const glowActive = useMemo(() => {
    if (!championGlowUntil) return false;
    return new Date(championGlowUntil).getTime() > Date.now();
  }, [championGlowUntil]);

  const value = useMemo(() => ({
    bootstrapping,
    challenges,
    todayIst,
    completedCount,
    allComplete,
    championGlowUntil,
    glowActive,
    activeChampion,
    dismissChampion,
    refresh: () => user?.id && refreshChallenges(user.id),
  }), [bootstrapping, challenges, todayIst, completedCount, allComplete,
       championGlowUntil, glowActive, activeChampion, dismissChampion,
       user?.id, refreshChallenges]);

  return <DailyChallengesContext.Provider value={value}>{children}</DailyChallengesContext.Provider>;
}

export function useDailyChallenges() {
  const ctx = useContext(DailyChallengesContext);
  if (!ctx) {
    return {
      bootstrapping: false,
      challenges: [],
      todayIst: todayIstIso(),
      completedCount: 0,
      allComplete: false,
      championGlowUntil: null,
      glowActive: false,
      activeChampion: null,
      dismissChampion: () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}

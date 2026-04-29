import { useEffect, useRef, useState } from 'react';
import { updateStats } from './progress';
import { supabase } from '../lib/supabase';

/**
 * Tracks active learning time on a page and persists it to user_stats.
 *
 * Pass the authenticated userId — the hook resolves the user's active
 * enrollment internally (cached for the page's lifetime), so individual
 * pages don't need to plumb enrollment_id through their data fetches.
 *
 * Features:
 *  - Counts seconds while the tab is visible (pauses when hidden)
 *  - Flushes accumulated minutes every 60s, on visibilitychange, on
 *    pagehide, on beforeunload, and on unmount
 *  - Caps each tick at 90s so long idle periods aren't counted
 *  - Uses an in-memory accumulator that's snapshot+reset before the
 *    network call so concurrent flushes can't double-count
 *
 * @param {string|null|undefined} userId
 * @param {object} [options]
 * @param {boolean} [options.enabled=true]
 */
export default function useTimeTracking(userId, { enabled = true } = {}) {
  const accumSecondsRef = useRef(0);
  const lastTickRef = useRef(null);
  const [enrollmentId, setEnrollmentId] = useState(null);
  const enrIdRef = useRef(null);
  enrIdRef.current = enrollmentId;

  // Resolve active enrollment once per userId
  useEffect(() => {
    let mounted = true;
    if (!enabled || !userId) return undefined;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_enrollments')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();
        if (mounted && data?.id) setEnrollmentId(data.id);
      } catch { /* ignore */ }
    })();
    return () => { mounted = false; };
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !enrollmentId) return undefined;

    const isVisible = () => document.visibilityState === 'visible';

    const tick = () => {
      const now = Date.now();
      if (lastTickRef.current && isVisible()) {
        const delta = (now - lastTickRef.current) / 1000;
        accumSecondsRef.current += Math.min(delta, 90);
      }
      lastTickRef.current = now;
    };

    const flush = async (immediate = false) => {
      tick();
      const seconds = accumSecondsRef.current;
      if (seconds < 30 && !immediate) return;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 1) return;
      accumSecondsRef.current = seconds - minutes * 60;
      const enrId = enrIdRef.current;
      if (!enrId) return;
      try { await updateStats(enrId, minutes); } catch { /* ignore */ }
    };

    lastTickRef.current = Date.now();
    const interval = setInterval(() => { void flush(false); }, 60_000);

    const onVis = () => {
      if (isVisible()) {
        lastTickRef.current = Date.now();
      } else {
        void flush(true);
      }
    };
    const onHide = () => { void flush(true); };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      void flush(true);
    };
  }, [enabled, enrollmentId]);
}

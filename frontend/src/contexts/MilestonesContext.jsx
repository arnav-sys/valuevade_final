import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { listPendingMilestones, dismissMilestone, checkSessionMilestone } from '../utils/milestones';

// Phase C — Milestone queue + dispatcher.
//
// Single source of truth for the celebration overlay. Holds an array of
// pending milestone payloads (oldest first), exposes:
//   • `pending`        — current queue (overlay reads queue[0])
//   • `refresh()`      — re-poll /api/milestones/pending (called after
//                        check + after dismiss to surface the next one)
//   • `dismiss(code)`  — fires the dismiss API and removes from local queue
//   • `notifySessionCompleted(sessionId)` — POSTs /milestones/check then
//                        refreshes the queue. Called from SessionCompletePage.

const MilestonesContext = createContext({
  pending: [],
  refresh: () => Promise.resolve(),
  dismiss: () => Promise.resolve(),
  notifySessionCompleted: () => Promise.resolve(),
});

export function MilestonesProvider({ children }) {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!user?.id) { setPending([]); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const { ok, data } = await listPendingMilestones();
      if (ok && Array.isArray(data)) setPending(data);
    } catch {
      // best-effort; keep last known queue
    } finally {
      inFlight.current = false;
    }
  }, [user?.id]);

  // Poll on auth change (login, page reload). One-shot, not interval-based.
  useEffect(() => { refresh(); }, [refresh]);

  const dismiss = useCallback(async (code) => {
    // Optimistic: drop locally first so the overlay closes immediately, then
    // hit the API. If the API fails the next refresh will re-surface it,
    // which is fine — no data loss.
    setPending((q) => q.filter((m) => m.code !== code));
    try {
      await dismissMilestone(code);
    } catch {
      // ignore — next refresh will reconcile
    }
  }, []);

  const notifySessionCompleted = useCallback(async (sessionId) => {
    if (!user?.id || !sessionId) return;
    try {
      const { ok, data } = await checkSessionMilestone(sessionId);
      if (ok && data?.newly_granted?.length > 0) {
        // Something was granted — refresh the pending queue so the overlay
        // picks it up. The granted milestone will be the most recent
        // earned_at, so it shows last (we sort asc to honor "oldest first").
        await refresh();
      }
    } catch {
      // ignore — milestone grant is non-blocking
    }
  }, [user?.id, refresh]);

  const value = useMemo(
    () => ({ pending, refresh, dismiss, notifySessionCompleted }),
    [pending, refresh, dismiss, notifySessionCompleted]
  );

  return <MilestonesContext.Provider value={value}>{children}</MilestonesContext.Provider>;
}

export function useMilestones() {
  return useContext(MilestonesContext);
}

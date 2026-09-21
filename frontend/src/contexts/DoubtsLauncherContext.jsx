import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import DoubtsSession from '../components/tutor/DoubtsSession';
import { supabase } from '../lib/supabase';
import { isPariBlockedPathname, useIsPariBlocked } from '../hooks/useIsPariBlocked';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const DoubtsLauncherContext = createContext(null);

/**
 * App-level provider that owns the DoubtsSession modal. Any page can call
 * `openDoubts({phase, moduleCode, courseSessionId, attemptContext})` to start a
 * personalised Pari Q&A session without having to drop the modal locally.
 *
 * Feb 2026 additions:
 *  - Blocks openDoubts on quiz / interview / simulation active pages.
 *  - Fetches /api/pari/status once and caches per-session budget state so
 *    the UI can hide the Pari trigger when the user has burned through
 *    the ₹500 lifetime cap.
 */
export function DoubtsLauncherProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null); // { doubt_session_id, phase, ... }
  const [attemptContext, setAttemptContext] = useState(null);
  const [currentFocus, setCurrentFocus] = useState(null);

  // Feb 2026, cached status so pages don't each round-trip the pari status.
  const [status, setStatus] = useState({
    total_cost_inr: 0,
    limit_inr: 500,
    over_budget: false,
    remaining_inr: 500,
  });
  const [statusLoaded, setStatusLoaded] = useState(false);
  const pariBlockedByRoute = useIsPariBlocked();

  const refreshStatus = useCallback(async () => {
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token;
      if (!token) { setStatusLoaded(true); return; }
      const res = await fetch(`${BACKEND}/api/pari/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.pari) setStatus(data.pari);
      }
    } catch {
      // Non-fatal, treat user as under-budget so we don't lock them out
      // over a transient network issue.
    } finally {
      setStatusLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const close = useCallback(() => {
    setOpen(false);
    setSession(null);
    setAttemptContext(null);
    setCurrentFocus(null);
    setError(null);
    // Refresh spend on close (each Pari session may bump the counter).
    refreshStatus();
  }, [refreshStatus]);

  // Open the doubts drawer INSTANTLY. No upfront network call, the drawer
  // renders in "ready to ask" state and only allocates a doubt session
  // (via /api/doubts/start) when the user actually sends their first
  // message.
  const openDoubts = useCallback(({
    phase = 'dashboard',
    moduleCode = null,
    courseSessionId = null,
    attemptContext: ctx = null,
    currentFocus: focus = null,
  } = {}) => {
    // Feb 2026, hard block during quiz/interview/simulation active pages.
    if (isPariBlockedPathname(typeof window !== 'undefined' ? window.location.pathname : '')) {
      toast('Pari is paused during quizzes, interviews and simulations. Finish the task and try again.', {
        description: 'Focus mode is on.',
      });
      return;
    }
    // Feb 2026, hard block once the ₹500 spend cap is hit.
    if (status?.over_budget) {
      toast.error(`Pari is disabled, you've reached the ₹${status.limit_inr} usage limit.`);
      return;
    }
    setError(null);
    setSession({
      doubt_session_id: null,
      phase,
      module_code: moduleCode,
      course_session_id: courseSessionId,
      turns_left: 3,
      tokens_left: 1500,
      sessions_left_today: null,
    });
    setAttemptContext(ctx);
    setCurrentFocus(focus);
    setOpen(true);
  }, [status]);

  const value = useMemo(() => ({
    openDoubts,
    close,
    isOpen: open,
    busy,
    error,
    // Feb 2026, surface state for FE gating.
    pariBlocked: pariBlockedByRoute || !!status?.over_budget,
    pariBlockedByRoute,
    pariOverBudget: !!status?.over_budget,
    pariStatus: status,
    pariStatusLoaded: statusLoaded,
    refreshPariStatus: refreshStatus,
  }),
    [openDoubts, close, open, busy, error, pariBlockedByRoute, status, statusLoaded, refreshStatus]);

  return (
    <DoubtsLauncherContext.Provider value={value}>
      {children}
      {open && session && (
        <DoubtsSession
          phase={session.phase}
          moduleCode={session.module_code}
          courseSessionId={session.course_session_id}
          doubtSession={session}
          attemptContext={attemptContext}
          currentFocus={currentFocus}
          onClose={close}
        />
      )}
      {error && !open && (
        <div
          className="fixed bottom-6 right-6 z-50 max-w-[320px] rounded-xl border border-red-400/40 bg-red-400/15 text-red-100 px-4 py-3 text-sm font-bricolage shadow-xl"
          role="alert"
          data-testid="doubts-launcher-error"
        >
          <div className="flex items-start gap-2">
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-200 hover:text-white"
              aria-label="Dismiss"
            >×</button>
          </div>
        </div>
      )}
    </DoubtsLauncherContext.Provider>
  );
}

export function useDoubtsLauncher() {
  const ctx = useContext(DoubtsLauncherContext);
  return ctx || {
    openDoubts: async () => {},
    close: () => {},
    isOpen: false,
    busy: false,
    error: null,
    pariBlocked: false,
    pariBlockedByRoute: false,
    pariOverBudget: false,
    pariStatus: null,
    pariStatusLoaded: false,
    refreshPariStatus: async () => {},
  };
}

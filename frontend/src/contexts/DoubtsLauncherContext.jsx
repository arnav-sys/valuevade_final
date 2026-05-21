import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import DoubtsSession from '../components/tutor/DoubtsSession';
import { supabase } from '../lib/supabase';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const DoubtsLauncherContext = createContext(null);

/**
 * App-level provider that owns the DoubtsSession modal. Any page can call
 * `openDoubts({phase, moduleCode, courseSessionId, attemptContext})` to start a
 * personalised Pari Q&A session without having to drop the modal locally.
 *
 * Phase 54 — replaces the per-page <AskPariButton /> chrome with a single
 * shared launcher, so the avatar itself becomes the doubts entry point.
 */
export function DoubtsLauncherProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null); // { doubt_session_id, phase, ... }
  const [attemptContext, setAttemptContext] = useState(null);

  const close = useCallback(() => {
    setOpen(false);
    setSession(null);
    setAttemptContext(null);
    setError(null);
  }, []);

  const openDoubts = useCallback(async ({
    phase = 'dashboard',
    moduleCode = null,
    courseSessionId = null,
    attemptContext: ctx = null,
  } = {}) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data: { session: supaSession } } = await supabase.auth.getSession();
      const token = supaSession?.access_token;
      if (!token) {
        setError('Please sign in to ask Pari.');
        return;
      }
      const res = await fetch(`${BACKEND}/api/doubts/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phase,
          module_code: moduleCode,
          course_session_id: courseSessionId,
          attempt_context: ctx,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setError("You've used all 5 doubt sessions for today — see you tomorrow!");
        return;
      }
      if (!res.ok || !json?.ok) {
        setError(json?.detail?.message || json?.detail || 'Could not start doubt session.');
        return;
      }
      setSession({
        doubt_session_id: json.doubt_session_id,
        phase,
        module_code: moduleCode,
        course_session_id: courseSessionId,
        turns_left: json.turns_left,
        tokens_left: json.tokens_left,
        sessions_left_today: json.sessions_left_today,
      });
      setAttemptContext(ctx);
      setOpen(true);
    } catch (e) {
      setError(e.message || 'Could not start doubt session.');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const value = useMemo(() => ({ openDoubts, close, isOpen: open, busy, error }),
    [openDoubts, close, open, busy, error]);

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
  };
}

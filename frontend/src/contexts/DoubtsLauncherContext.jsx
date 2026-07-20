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
  // Batch 3 (Item 2) — context binding: what the student was looking at the
  // moment they opened Pari (notes section / quiz question / sim cell). The
  // FE forwards this to /api/doubts/start so the LLM can resolve "this".
  const [currentFocus, setCurrentFocus] = useState(null);

  const close = useCallback(() => {
    setOpen(false);
    setSession(null);
    setAttemptContext(null);
    setCurrentFocus(null);
    setError(null);
  }, []);

  // Open the doubts drawer INSTANTLY. No upfront network call — the drawer
  // renders in "ready to ask" state and only allocates a doubt session
  // (via /api/doubts/start) when the user actually sends their first
  // message. This fixes two bugs:
  //   1. The ~2s stall between icon click and drawer appearing (was
  //      blocking on the /doubts/start round-trip).
  //   2. Every icon click silently consuming one of the 5 daily sessions
  //      even if the user closed the drawer without chatting.
  const openDoubts = useCallback(({
    phase = 'dashboard',
    moduleCode = null,
    courseSessionId = null,
    attemptContext: ctx = null,
    currentFocus: focus = null,
  } = {}) => {
    setError(null);
    setSession({
      // No doubt_session_id yet — DoubtsSession.send() will provision on
      // first ask, chaining /doubts/start → /doubts/ask.
      doubt_session_id: null,
      phase,
      module_code: moduleCode,
      course_session_id: courseSessionId,
      turns_left: 3,
      tokens_left: 1500,
      sessions_left_today: null, // "-/5" placeholder until first ask returns real quota
    });
    setAttemptContext(ctx);
    setCurrentFocus(focus);
    setOpen(true);
  }, []);

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
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Batch 2, Real-time hidden session timer.
 *
 * Accumulates wall-clock seconds for a (sessionId, phase) pair. Pauses on:
 *   - document.visibilityState === 'hidden' (tab switched / minimised)
 *   - window blur (focus moved to another app)
 *   - 2 min of no mouse / keyboard / touch / scroll activity
 *
 * Resumes on visibilitychange (visible), focus, OR any input event.
 *
 * Persists to sessionStorage every 5 sec under
 *   vv_timer_<sessionId>_<phase>  →  { totalSeconds, updatedAt }
 *
 * On mount we restore the previous accumulator so a hard reload doesn't
 * lose state. Returned `elapsedMinutes` re-renders every 5 sec (cheap
 * enough, no DOM thrashing).
 *
 * No new npm deps. Pure React.
 */
const IDLE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const TICK_MS = 1000;                    // accumulator tick
const RERENDER_MS = 5000;                // FE re-render cadence
const PERSIST_MS = 5000;                 // sessionStorage flush cadence

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel'];

function storageKey(sessionId, phase) {
  return `vv_timer_${sessionId}_${phase}`;
}

function readSnapshot(sessionId, phase) {
  try {
    const raw = sessionStorage.getItem(storageKey(sessionId, phase));
    if (!raw) return { totalSeconds: 0, updatedAt: 0 };
    const parsed = JSON.parse(raw);
    return {
      totalSeconds: Math.max(0, Number(parsed.totalSeconds) || 0),
      updatedAt:    Math.max(0, Number(parsed.updatedAt) || 0),
    };
  } catch {
    return { totalSeconds: 0, updatedAt: 0 };
  }
}

function writeSnapshot(sessionId, phase, totalSeconds) {
  try {
    sessionStorage.setItem(storageKey(sessionId, phase), JSON.stringify({
      totalSeconds,
      updatedAt: Date.now(),
    }));
  } catch { /* quota / disabled */ }
}

/**
 * Read the persisted minutes for a (sessionId, phase) WITHOUT mounting the
 * hook. Useful from complete pages (Quiz/Interview/Simulation complete) and
 * SessionCompletePage to read what the player accumulated.
 *
 * Returns floored integer minutes (Math.max(1, round(seconds/60))) so that
 * super-fast completions still count as 1 minute (per acceptance criteria).
 */
export function getMeasuredMinutes(sessionId, phase, { fallbackMinutes = 0 } = {}) {
  const snap = readSnapshot(sessionId, phase);
  if (snap.totalSeconds <= 0) {
    return Math.max(0, Math.round(fallbackMinutes));
  }
  return Math.max(1, Math.round(snap.totalSeconds / 60));
}

/**
 * Sum measured minutes across all four phases. Used by SessionCompletePage
 * when reporting to /api/study-plan/session-completed.
 *
 * If a phase wasn't played in this browser session (e.g. user did notes
 * yesterday and is finishing quiz today), its accumulator is 0 and we
 * fall back to a per-phase floor of 0 (the live phase will dominate).
 *
 * The optional `estimatedMinutes` arg caps the sum at 3× the planned time
 *, this is the silent guard against a user accidentally leaving a tab
 * open all night and inflating their day_row.actual_minutes.
 */
export function getMeasuredMinutesTotal(sessionId, { estimatedMinutes = 0 } = {}) {
  const phases = ['notes', 'quiz', 'simulation'];
  const sum = phases.reduce((acc, p) => acc + Math.max(0, Math.round(readSnapshot(sessionId, p).totalSeconds / 60)), 0);
  // Per the spec: prevent zero writes, at least 1 min.
  const floored = Math.max(1, sum);
  // Silent cap at 3× estimated when caller provides a sane estimate.
  if (estimatedMinutes > 0) {
    const cap = Math.max(1, Math.round(estimatedMinutes * 3));
    return Math.min(floored, cap);
  }
  return floored;
}

export default function useSessionTimer(sessionId, phase, { autoStart = true } = {}) {
  // Live accumulator in ref (no re-render on every tick).
  const accumRef = useRef(0);
  const activeRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const lastTickAtRef = useRef(Date.now());

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  // Disabled mode: missing sessionId/phase → no-op (returns a stub).
  const disabled = !sessionId || !phase;

  // Restore from sessionStorage on mount.
  useEffect(() => {
    if (disabled) return;
    const snap = readSnapshot(sessionId, phase);
    accumRef.current = snap.totalSeconds;
    setElapsedSeconds(snap.totalSeconds);
  }, [sessionId, phase, disabled]);

  // Pause / resume control surface.
  const pause = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setIsActive(false);
  }, []);
  const resume = useCallback(() => {
    if (activeRef.current || disabled) return;
    activeRef.current = true;
    lastActivityRef.current = Date.now();
    lastTickAtRef.current = Date.now();
    setIsActive(true);
  }, [disabled]);
  const reset = useCallback(() => {
    accumRef.current = 0;
    setElapsedSeconds(0);
    if (!disabled) writeSnapshot(sessionId, phase, 0);
  }, [sessionId, phase, disabled]);

  // Idle detection + visibility + focus listeners.
  useEffect(() => {
    if (disabled) return;
    const markActivity = () => {
      lastActivityRef.current = Date.now();
      if (!activeRef.current && document.visibilityState !== 'hidden' && document.hasFocus()) {
        resume();
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') pause();
      else if (document.hasFocus()) resume();
    };
    const onBlur = () => pause();
    const onFocus = () => {
      if (document.visibilityState !== 'hidden') resume();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, markActivity));
    };
  }, [disabled, pause, resume]);

  // Auto-start when conditions are right.
  useEffect(() => {
    if (disabled) return;
    if (autoStart && document.visibilityState !== 'hidden' && document.hasFocus()) {
      resume();
    }
  }, [autoStart, disabled, resume]);

  // Tick loop, 1 sec accumulator, 5 sec re-render + persist.
  useEffect(() => {
    if (disabled) return;
    let rerenderAcc = 0;
    let persistAcc = 0;
    const id = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickAtRef.current;
      lastTickAtRef.current = now;
      // Auto-pause on idle (>= 2 min since last activity).
      if (activeRef.current && (now - lastActivityRef.current) >= IDLE_THRESHOLD_MS) {
        activeRef.current = false;
        setIsActive(false);
      }
      if (activeRef.current) {
        accumRef.current += Math.min(delta / 1000, TICK_MS / 1000 + 0.5);
        rerenderAcc += delta;
        persistAcc += delta;
      }
      if (rerenderAcc >= RERENDER_MS) {
        rerenderAcc = 0;
        setElapsedSeconds(Math.floor(accumRef.current));
      }
      if (persistAcc >= PERSIST_MS) {
        persistAcc = 0;
        writeSnapshot(sessionId, phase, Math.floor(accumRef.current));
      }
    }, TICK_MS);
    return () => {
      clearInterval(id);
      // Final flush so the last <5s of work isn't lost on unmount.
      writeSnapshot(sessionId, phase, Math.floor(accumRef.current));
      setElapsedSeconds(Math.floor(accumRef.current));
    };
  }, [sessionId, phase, disabled]);

  // Exposed live counter (rounded to minutes, min 0; consumers should apply
  // the Math.max(1, ...) floor at write time).
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  return {
    elapsedSeconds,
    elapsedMinutes,
    isActive: isActive && !disabled,
    pause,
    resume,
    reset,
  };
}

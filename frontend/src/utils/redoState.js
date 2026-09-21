// Phase B, redo doubt session state.
//
// When a user clicks "Redo for half XP" on the /doubts page, we persist a
// small marker to sessionStorage so the subsequent quiz/simulation/notes
// completion pages can pass `redo_doubt_id` + `redo_count` into the XP
// award flow. The award_xp partial unique index
// (ux_user_xp_events_redo_dedup) blocks double-payment per
// (user, doubt, redo_count, reason).
//
// Once the session is fully completed in redo mode, SessionCompletePage
// auto-resolves the doubt and clears this state.
//
// Shape:
//   { redo_doubt_id: uuid, redo_count: int, session_id: uuid }

const KEY = 'vv-redo-state';

export function setRedoState({ redo_doubt_id, redo_count, session_id }) {
  if (!redo_doubt_id || !session_id || typeof redo_count !== 'number') return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ redo_doubt_id, redo_count, session_id }));
  } catch {
    // sessionStorage disabled, best-effort, ignore.
  }
}

export function getRedoState() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.redo_doubt_id || !parsed?.session_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Returns the redo state if it matches the given session id, else null. */
export function getRedoForSession(sessionId) {
  if (!sessionId) return null;
  const st = getRedoState();
  if (!st || st.session_id !== sessionId) return null;
  return st;
}

export function clearRedoState() {
  try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
}

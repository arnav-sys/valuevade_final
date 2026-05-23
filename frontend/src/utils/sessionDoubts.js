// Phase B — Session doubts API client.
//
// All endpoints require a Supabase Bearer token. The legacy quick-chat
// endpoints (/api/doubts/start|ask|end) are intentionally NOT exposed
// here — keep those in DoubtsLauncherContext / DoubtsSession.jsx so
// quick chat (3 turns / 1500 tokens / 5 sessions per day) stays
// untouched.

import { supabase } from '../lib/supabase';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('not_authenticated');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function call(method, path, body = null) {
  const headers = await authHeaders();
  const init = { method, headers };
  if (body !== null) init.body = JSON.stringify(body);
  const res = await fetch(`${BACKEND}${path}`, init);
  let data = null;
  try { data = await res.json(); } catch { /* may be empty */ }
  return { ok: res.ok, status: res.status, data };
}

/** Flag a session as confusing/difficult. Idempotent — re-flagging just
 *  updates the reason. */
export function markSessionDoubt({ session_id, reason }) {
  return call('POST', '/api/doubts/sessions/mark', { session_id, reason });
}

/** List the user's session-doubts (status: open | resolved | all). */
export function listSessionDoubts(status = 'open') {
  return call('GET', `/api/doubts/sessions?status=${encodeURIComponent(status)}`);
}

/** Mark a session-doubt resolved. */
export function resolveSessionDoubt(doubt_id) {
  return call('POST', `/api/doubts/sessions/${doubt_id}/resolve`);
}

/** Bump redo_count + return {session_id, redo_count, xp_multiplier}. */
export function redoSessionDoubt(doubt_id) {
  return call('POST', `/api/doubts/sessions/${doubt_id}/redo`);
}

/** Start a 15-turn extended Pari chat (3/day quota). */
export function startExtendedChat(doubt_id) {
  return call('POST', '/api/doubts/extended/start', { doubt_id });
}

/** Send a turn into an extended chat. */
export function askExtendedChat({ doubt_session_id, message }) {
  return call('POST', '/api/doubts/extended/ask', { doubt_session_id, message });
}

/** End an extended chat (manual close). */
export function endExtendedChat(doubt_session_id) {
  return call('POST', '/api/doubts/extended/end', { doubt_session_id });
}

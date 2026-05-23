// Phase C — Milestone Achievement Cards
//
// API client for the 3 milestone endpoints. All require a Supabase Bearer
// token. The MilestonesContext consumes these and the
// MilestoneCelebrationOverlay renders them.

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

/** Returns earned-but-not-dismissed milestones (oldest first). */
export function listPendingMilestones() {
  return call('GET', '/api/milestones/pending');
}

/** Marks a milestone dismissed so it won't reappear in the overlay queue. */
export function dismissMilestone(code) {
  return call('POST', `/api/milestones/${encodeURIComponent(code)}/dismiss`);
}

/** Called right after a session completes + XP write. Grants at most one
 *  new milestone (module > count priority). Returns `{newly_granted: [code]}`. */
export function checkSessionMilestone(session_id) {
  return call('POST', '/api/milestones/check', { session_id });
}

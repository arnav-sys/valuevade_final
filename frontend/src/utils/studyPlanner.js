// Phase D1, Study Planner API client.
//
// Backend endpoints all auth-gated via Supabase Bearer.

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

export function previewStudyPlan(payload) {
  return call('POST', '/api/study-plan/preview', payload);
}

export function commitStudyPlan(payload) {
  return call('POST', '/api/study-plan/commit', payload);
}

export function getActiveStudyPlan() {
  return call('GET', '/api/study-plan/active');
}

export function getStudyPlanDaysRange(start, end) {
  const q = new URLSearchParams({ start, end }).toString();
  return call('GET', `/api/study-plan/days-range?${q}`);
}

export function abandonActiveStudyPlan() {
  return call('DELETE', '/api/study-plan/active');
}

// Phase D2, tracking + summary + rebalance
export function reportSessionCompleted({ session_id, minutes_spent }) {
  return call('POST', '/api/study-plan/session-completed', { session_id, minutes_spent });
}

export function getStudyPlanDashboardSummary() {
  return call('GET', '/api/study-plan/dashboard-summary');
}

export function rebalanceStudyPlan(payload = {}) {
  return call('POST', '/api/study-plan/rebalance', payload);
}

import { supabase } from '../lib/supabase';

const API = process.env.REACT_APP_BACKEND_URL;

export async function interviewSimFetch(path, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${session?.access_token || ''}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  if (!r.ok) {
    const detail = j?.detail;
    const msg = typeof detail === 'string' ? detail : detail?.message || `Request failed (${r.status})`;
    const err = new Error(msg);
    err.status = r.status;
    err.reason = typeof detail === 'object' ? detail?.reason : null;
    throw err;
  }
  return j;
}

// ---------------------------------------------------------------------------
// Interview-module detection (cached per page load)
// ---------------------------------------------------------------------------
let _interviewModuleIdsPromise = null;

export function getInterviewMasterModuleIds() {
  if (!_interviewModuleIdsPromise) {
    _interviewModuleIdsPromise = supabase
      .from('master_modules')
      .select('id')
      .eq('is_interview_module', true)
      .then(({ data, error }) => {
        if (error) throw error;
        return new Set((data || []).map((m) => m.id));
      })
      .catch(() => {
        _interviewModuleIdsPromise = null;
        return new Set();
      });
  }
  return _interviewModuleIdsPromise;
}

export async function isInterviewMasterModule(masterModuleId) {
  if (!masterModuleId) return false;
  const ids = await getInterviewMasterModuleIds();
  return ids.has(masterModuleId);
}

/** Given a user_modules.id, resolve whether it belongs to an interview module. */
const _userModuleFlagCache = new Map();
export async function isInterviewUserModule(userModuleId) {
  if (!userModuleId) return false;
  if (_userModuleFlagCache.has(userModuleId)) return _userModuleFlagCache.get(userModuleId);
  try {
    const { data } = await supabase
      .from('user_modules')
      .select('master_module_id')
      .eq('id', userModuleId)
      .maybeSingle();
    const flag = await isInterviewMasterModule(data?.master_module_id);
    _userModuleFlagCache.set(userModuleId, flag);
    return flag;
  } catch {
    return false;
  }
}

/**
 * Interview-sim completion gate for a given user: {done, total, allDone}.
 * Reads master_interview_sims + the user's own completed attempts via RLS.
 */
export async function getInterviewSimGate(userId) {
  try {
    const [{ data: sims }, { data: attempts }] = await Promise.all([
      supabase.from('master_interview_sims').select('id').eq('is_active', true),
      supabase.from('user_interview_attempts')
        .select('sim_id, status')
        .eq('user_id', userId)
        .eq('status', 'completed'),
    ]);
    const total = (sims || []).length;
    const doneSet = new Set((attempts || []).map((a) => a.sim_id));
    const done = (sims || []).filter((s) => doneSet.has(s.id)).length;
    return { done, total, allDone: total > 0 && done === total };
  } catch {
    return { done: 0, total: 0, allDone: false };
  }
}

export const STAGE_LABELS = {
  application: 'Application',
  aptitude: 'Aptitude Test',
  behavioural: 'HR Interview',
  technical: 'Technical Interview',
  case_study: 'Case Study',
  decision: 'Decision',
};

export const STAGE_ORDER = ['application', 'aptitude', 'behavioural', 'technical', 'case_study', 'decision'];

/**
 * simApi
 * ------
 * Small abstraction so the stage components (Application/Aptitude/Interview/
 * Case/Decision) can be reused between:
 *   (a) the authenticated hub player (`InterviewSimPlayer`) — uses the
 *       existing `/api/interview-sim/attempt/{id}/*` routes with Bearer auth
 *   (b) the guest landing-page trial player (`GuestInterviewPlayer`) — uses
 *       the stateless `/api/guest-sim/{trial_id}/*` routes with NO auth
 *
 * Every stage component now accepts an optional `simApi` prop with:
 *   { fetch(url, opts), endpoints: {application, aptitudeStart, ...}, ttsUrl }
 * If not passed, `buildAuthSimApi(attemptId)` is used as the default so the
 * existing player keeps working unchanged.
 */
import { interviewSimFetch } from '../../utils/interviewSim';

const API = process.env.REACT_APP_BACKEND_URL;

export function buildAuthSimApi(attemptId) {
  return {
    fetch: interviewSimFetch,
    ttsUrl: '/api/interview-sim/tts',
    endpoints: {
      application: `/api/interview-sim/attempt/${attemptId}/application`,
      aptitudeStart: `/api/interview-sim/attempt/${attemptId}/aptitude/start`,
      aptitudeSubmit: `/api/interview-sim/attempt/${attemptId}/aptitude/submit`,
      interviewBegin: `/api/interview-sim/attempt/${attemptId}/interview/begin`,
      interviewAnswer: `/api/interview-sim/attempt/${attemptId}/interview/answer`,
      caseSubmit: `/api/interview-sim/attempt/${attemptId}/case/submit`,
    },
    // In auth mode, server persists via attempt row. We just refetch on onAdvance().
    onStageComplete: async () => {},
  };
}

/** Guest-mode fetch: no auth header, throws Error on non-2xx. */
async function guestFetch(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
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
    throw err;
  }
  return j;
}

export function buildGuestSimApi(trialId, onStageComplete) {
  const base = `/api/guest-sim/${encodeURIComponent(trialId)}`;
  return {
    fetch: guestFetch,
    ttsUrl: `${base}/tts`,
    endpoints: {
      application: `${base}/application`,
      aptitudeStart: `${base}/aptitude/start`,
      aptitudeSubmit: `${base}/aptitude/submit`,
      interviewBegin: `${base}/interview/begin`,
      interviewAnswer: `${base}/interview/answer`,
      caseSubmit: `${base}/case/submit`,
    },
    onStageComplete: onStageComplete || (async () => {}),
  };
}

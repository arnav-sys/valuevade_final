/**
 * GuestInterviewPlayer
 * --------------------
 * Fully guest / no-login mock interview player at `/free-trial/:trialId`.
 * Runs the same 6-stage J.P. Morgan flow that authenticated users get, but:
 *   - no Supabase signup, no dashboard, no sidebar
 *   - state persists in localStorage under `guest-sim:{trialId}`
 *   - backend calls the stateless `/api/guest-sim/{trial_id}/*` routes
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, AlertCircle, MapPin, Banknote, Sparkles, ArrowLeft } from 'lucide-react';
import ApplicationStage from './interview-sim/ApplicationStage';
import AptitudeStage from './interview-sim/AptitudeStage';
import InterviewStage from './interview-sim/InterviewStage';
import CaseStage from './interview-sim/CaseStage';
import DecisionStage from './interview-sim/DecisionStage';
import { FirmLogo, StageTracker } from './interview-sim/simShared';
import { buildGuestSimApi } from './interview-sim/simApi';

const API = process.env.REACT_APP_BACKEND_URL;
const LS_KEY = (tid) => `guest-sim:${tid}`;

function loadState(trialId) {
  try {
    const raw = localStorage.getItem(LS_KEY(trialId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveState(trialId, state) {
  try { localStorage.setItem(LS_KEY(trialId), JSON.stringify(state)); } catch { /* quota */ }
}

const INITIAL_STATE = {
  current_stage: 'application',
  stage_data: {},
  final_score: null,
  verdict: null,
  attempt_number: 1,
};

export default function GuestInterviewPlayer() {
  const { trialId } = useParams();
  const navigate = useNavigate();
  const [sim, setSim] = useState(null);
  const [error, setError] = useState(null);
  const [state, setState] = useState(() => loadState(trialId) || INITIAL_STATE);

  // Persist state on every change
  useEffect(() => { if (trialId) saveState(trialId, state); }, [trialId, state]);

  // Fetch the JPM sim once
  useEffect(() => {
    if (!trialId) { navigate('/', { replace: true }); return; }
    let alive = true;
    fetch(`${API}/api/guest-sim/${encodeURIComponent(trialId)}/sim`)
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))).detail) || 'Could not load simulation');
        return r.json();
      })
      .then((j) => { if (alive) setSim(j.sim); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [trialId, navigate]);

  const onStageComplete = useCallback(async (stageName, result, nextStage, extras = {}) => {
    setState((prev) => {
      const nextStageData = { ...(prev.stage_data || {}), [stageName]: result };
      // Case stage delivers the final decision inline (guest mode is stateless).
      if (stageName === 'case_study' && extras.decision) {
        nextStageData.decision = extras.decision;
      }
      return {
        ...prev,
        current_stage: nextStage || prev.current_stage,
        stage_data: nextStageData,
        final_score: extras.final_score ?? prev.final_score,
        verdict: extras.verdict ?? prev.verdict,
      };
    });
  }, []);

  const simApi = useMemo(
    () => trialId ? buildGuestSimApi(trialId, onStageComplete) : null,
    [trialId, onStageComplete],
  );

  const advanceToNext = useCallback(() => {
    // Called by stage components' "Continue" buttons, for guest mode we just
    // trigger a re-render; the state was already advanced in onStageComplete.
    setState((p) => ({ ...p }));
  }, []);

  // Pseudo-attempt object matching the shape the stage components expect
  const pseudoAttempt = useMemo(() => ({
    id: `guest-${trialId}`,
    sim_id: sim?.id,
    attempt_number: state.attempt_number,
    status: state.current_stage === 'decision' ? 'completed' : 'in_progress',
    current_stage: state.current_stage,
    stage_data: state.stage_data,
    final_score: state.final_score,
    verdict: state.verdict,
    started_at: null,
    completed_at: state.current_stage === 'decision' ? new Date().toISOString() : null,
  }), [trialId, sim, state]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-primary)]">
        <div className="glass-card rounded-2xl p-6 max-w-md text-center" data-testid="guest-sim-error">
          <AlertCircle size={22} className="text-[var(--color-error)] mx-auto mb-3" />
          <p className="text-sm font-bricolage text-[var(--color-text)] mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bricolage font-semibold hover:brightness-110">
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (!sim || !simApi) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex items-center gap-3 text-[var(--color-text-muted)]" data-testid="guest-sim-loading">
          <Loader2 size={18} className="animate-spin" /> Loading your J.P. Morgan simulation…
        </div>
      </div>
    );
  }

  const stage = state.current_stage;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative">
      <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[140px] pointer-events-none" />
      <main className="relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
          {/* Trial banner + home nav */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors group font-bricolage"
              data-testid="guest-back-home"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> Home
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-[10px] font-mono uppercase tracking-[0.2em]" data-testid="guest-trial-badge">
              <Sparkles size={11} /> Free trial · No signup
            </span>
          </div>

          {/* Firm header */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 mb-5" style={{ borderLeft: `3px solid ${sim.brand?.accent || 'var(--color-border)'}` }} data-testid="guest-firm-header">
            <div className="flex items-center gap-4 mb-4">
              <FirmLogo brand={sim.brand} size={48} />
              <div className="min-w-0 flex-1">
                <h1 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)]" data-testid="guest-firm-name">
                  {sim.firm_name}
                </h1>
                <p className="text-sm font-bricolage text-[var(--color-text-muted)]">{sim.role_title}</p>
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-[var(--color-text-faint)] mt-0.5">
                  <span className="inline-flex items-center gap-1"><MapPin size={10} /> {sim.location}</span>
                  <span className="inline-flex items-center gap-1"><Banknote size={10} /> {sim.salary_band}</span>
                  <span>Free trial · One attempt</span>
                </div>
              </div>
            </div>
            <StageTracker currentStage={stage} stageData={state.stage_data} verdict={state.verdict} />
          </div>

          {/* Active stage */}
          {stage === 'application' && (
            <ApplicationStage attempt={pseudoAttempt} sim={sim} onAdvance={advanceToNext} simApi={simApi} />
          )}
          {stage === 'aptitude' && (
            <AptitudeStage attempt={pseudoAttempt} sim={sim} onAdvance={advanceToNext} simApi={simApi} />
          )}
          {(stage === 'behavioural' || stage === 'technical') && (
            <InterviewStage key={stage} stage={stage} attempt={pseudoAttempt} sim={sim} onAdvance={advanceToNext} simApi={simApi} />
          )}
          {stage === 'case_study' && (
            <CaseStage attempt={pseudoAttempt} sim={sim} onAdvance={advanceToNext} simApi={simApi} />
          )}
          {stage === 'decision' && (
            <DecisionStage attempt={pseudoAttempt} sim={sim} guestMode />
          )}
        </div>
      </main>
    </div>
  );
}

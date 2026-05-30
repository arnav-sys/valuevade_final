import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useXP } from '../contexts/XPContext';
import { triggerStreakUpdate } from '../utils/streakBus';
import { triggerBadgeEvaluation } from '../utils/badgeBus';
import { updateDailyChallengesForPhase } from '../utils/progress';
import { supabase } from '../lib/supabase';
import AvatarPersona from './tutor/AvatarPersona';
import { useDoubtsLauncher } from '../contexts/DoubtsLauncherContext';
import { resolveTutorPhase } from '../contexts/TutorContext';
import {
  ArrowLeft, Loader2, AlertCircle, RefreshCw, Wrench,
  FileSpreadsheet, FileText, GitBranch, MousePointerClick,
} from 'lucide-react';
import ExcelSim from './simulations/ExcelSim';
import DocumentSim from './simulations/DocumentSim';
import DecisionMakingSim from './simulations/DecisionMakingSim';
import InteractiveSim from './simulations/InteractiveSim';
import GenericRenderer from './simulations/GenericRenderer';
import { markPhaseComplete } from '../utils/progress';
import { getMeasuredMinutes } from '../utils/useSessionTimer';
import useTimeTracking from '../utils/useTimeTracking';
// AskPariButton no longer mounted here (P55) — replaced by inline launcher button.
// import AskPariButton from './tutor/AskPariButton';

const TYPE_META = {
  excel: { label: 'Excel', Icon: FileSpreadsheet, color: '#10B981' },
  document: { label: 'Document', Icon: FileText, color: '#246BFD' },
  decision_making: { label: 'Decision Making', Icon: GitBranch, color: '#6A5CFF' },
  interactive: { label: 'Interactive', Icon: MousePointerClick, color: '#FF6AC1' },
};

export default function SimulationPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openDoubts } = useDoubtsLauncher();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [sim, setSim] = useState(null);
  const [progress, setProgress] = useState({ correct: 0, total: 0 });
  const [saving, setSaving] = useState(false);
  const [submittedScore, setSubmittedScore] = useState(null); // P56: drives Pari post-submit pose
  const { awardXP } = useXP();

  // Track active time on this page → user_stats.total_time_minutes
  useTimeTracking(user?.id);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id || !sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: sess, error: sErr } = await supabase
          .from('user_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        if (sErr) throw sErr;
        if (!mounted) return;
        setSession(sess);

        if (!sess.master_session_id) {
          setSim(null);
          return;
        }

        // Batch 5 — many master_sessions have multiple sim rows (e.g. an
        // excel sim + a decision_making sim). Fetch all and pick the most
        // useful one (prefer excel > interactive > decision_making) so the
        // student always lands on a real spreadsheet when one is available.
        const { data: sList, error: simErr } = await supabase
          .from('master_simulations')
          .select('*')
          .eq('session_id', sess.master_session_id);
        if (simErr && simErr.code !== 'PGRST116') throw simErr;
        const pickPriority = ['excel', 'interactive', 'decision_making', 'document'];
        const sorted = (sList || []).slice().sort(
          (a, b) => {
            const ai = pickPriority.indexOf(a.sim_type);
            const bi = pickPriority.indexOf(b.sim_type);
            // Unknown sim_types (indexOf = -1) sort LAST, not first.
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          }
        );
        if (mounted) setSim(sorted[0] || null);

        // Defense-in-depth: empty sim list (M14/M15 career/AI sessions) →
        // auto-complete the phase and forward to the session-complete screen.
        // This makes the wrench fallback below unreachable from any entry point.
        if (!sorted.length) {
          try {
            await markPhaseComplete(sessionId, 'simulation', {}, { actualMinutes: 0 });
          } catch { /* fire-and-forget */ }
          if (mounted) {
            navigate(`/session/${sessionId}/complete`, { replace: true });
            return;
          }
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load simulation');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [sessionId, user?.id]);

  const handleComplete = async ({ tasks_completed, tasks_total, accuracy }) => {
    // P56: snapshot the score immediately so Pari's pose flips even before
    // the DB write returns.
    setSubmittedScore(Math.round((accuracy || 0) * 100));
    if (saving) return;
    // In review mode (already completed once) — skip the DB write and just
    // navigate the user back to the session start page.
    if (session?.simulation_completed) {
      navigate(`/session/${sessionId}/start`);
      return;
    }
    setSaving(true);
    try {
      // Batch 2 (Item 1): real simulation minutes from the timer.
      const measuredSimMin = getMeasuredMinutes(sessionId, 'simulation', { fallbackMinutes: 10 });
      const scoreData = {
        simulation_score: Math.round((accuracy || 0) * 100),
      };
      const res = await markPhaseComplete(sessionId, 'simulation', scoreData, { actualMinutes: measuredSimMin });
      if (!res?.success) {
        console.error('[simulation] markPhaseComplete failed:', res?.error);
      } else {
        for (const intent of (res.xp_intents || [])) {
          // eslint-disable-next-line no-await-in-loop
          await awardXP(intent);
        }
        try { await triggerStreakUpdate(); } catch { /* fire-and-forget */ }
        try {
          await triggerBadgeEvaluation({
            source_event: 'simulation_complete',
            session_id: sessionId,
            simulation_score: scoreData.simulation_score,
          });
        } catch { /* fire-and-forget */ }
        try {
          await updateDailyChallengesForPhase(user.id, 'simulation', { minutes: Math.max(1, measuredSimMin) });
          if ((res.xp_intents || []).some((x) => x.reason === 'session_complete')) {
            await updateDailyChallengesForPhase(user.id, 'session_complete', {});
          }
        } catch { /* fire-and-forget */ }
      }
      navigate(`/session/${sessionId}/simulation/complete`, {
        state: { tasks_completed, tasks_total, accuracy, sim_type: sim?.sim_type, title: sim?.title },
      });
    } catch (err) {
      console.error('[simulation] save error:', err);
      setSaving(false);
    }
  };

  const isReview = !!session?.simulation_completed;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center" data-testid="simulation-loading">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6" data-testid="simulation-error">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
            <AlertCircle size={28} className="text-[var(--color-error)]" />
          </div>
          <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load simulation</p>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
          >
            <RefreshCw size={16} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!sim) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6" data-testid="simulation-empty-page">
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center mb-5">
            <Wrench size={28} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="text-[var(--color-text)] font-bricolage mb-2">No simulation configured</p>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">
            This session doesn't have a simulation available.
          </p>
          <Link
            to={`/session/${sessionId}/complete`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
          >
            Continue
          </Link>
        </div>
      </div>
    );
  }

  const meta = TYPE_META[sim.sim_type] || TYPE_META.interactive;
  const config = sim.config || {};

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative" data-testid="simulation-page">
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.05] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.05] blur-[140px] pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/85 backdrop-blur-xl border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-3">
          <div className="flex items-center justify-between gap-4">
            <Link
              to={`/session/${sessionId}/simulation/start`}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors group font-bricolage"
              data-testid="simulation-exit-link"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Exit
            </Link>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40`, color: meta.color }}
              >
                <meta.Icon size={16} />
              </div>
              <div className="text-left hidden sm:block">
                <div className="font-clash text-sm font-semibold text-[var(--color-text)] leading-tight" data-testid="simulation-header-title">
                  {sim.title || 'Real-World Simulation'}
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: meta.color }}>
                  {meta.label}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-2" data-testid="simulation-phase-badge">
              {isReview && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)]" data-testid="simulation-review-badge">
                  REVIEW
                </span>
              )}
              Phase 4 / 4
            </span>
          </div>
        </div>
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 pb-24">
        {/* P55 — Pari sets the brief; P56 — pose flips on post-submit */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] backdrop-blur p-3 sm:p-4 mb-5 flex items-start gap-3" data-testid="simulation-pari-brief">
          <AvatarPersona
            pose={submittedScore === null
              ? 'simulation_brief'
              : (submittedScore >= 90 ? 'celebrating'
                : (submittedScore >= 70 ? 'encouraging' : 'listening'))}
            size="md"
            position="inline"
            showSpeechBubble={false}
            ariaLabel="Pari"
          />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-primary)] mb-1">
              {submittedScore === null ? 'Pari sets the scene' : 'Pari · Result'}
            </div>
            <div className="text-sm sm:text-base text-[var(--color-text)] font-bricolage leading-relaxed">
              {submittedScore === null
                ? <>Here's what we're working on — read the brief carefully, then start.
                  {sim.title && <span className="block mt-1 font-semibold">{sim.title}</span>}</>
                : submittedScore >= 90
                  ? `Excellent decisions — your simulation matched the optimal path closely. ${submittedScore}/100.`
                  : submittedScore >= 70
                    ? `Solid work — ${submittedScore}/100. Let's review where you diverged from the optimal path.`
                    : `Some of your choices need a second look — ${submittedScore}/100. Let me walk through them with you.`}
            </div>
          </div>
        </div>

        {sim.sim_type === 'excel' && (
          <ExcelSim config={config} title={sim.title} sim={sim} onProgress={setProgress} onComplete={handleComplete} />
        )}
        {sim.sim_type === 'document' && (
          <DocumentSim config={config} title={sim.title} onProgress={setProgress} onComplete={handleComplete} />
        )}
        {sim.sim_type === 'decision_making' && (
          <DecisionMakingSim config={config} title={sim.title} onProgress={setProgress} onComplete={handleComplete} />
        )}
        {sim.sim_type === 'interactive' && (
          <InteractiveSim config={config} title={sim.title} onProgress={setProgress} onComplete={handleComplete} />
        )}
        {!['excel', 'document', 'decision_making', 'interactive'].includes(sim.sim_type) && (
          <GenericRenderer config={config} title={sim.title} typeLabel={sim.sim_type || 'Simulation'} onComplete={handleComplete} />
        )}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => openDoubts({
              phase: 'simulation',
              courseSessionId: sessionId,
              attemptContext: {
                sim_brief: sim.title || '',
                sim_type: sim.sim_type || '',
                user_submission: progress || null,
                score: submittedScore !== null
                  ? submittedScore
                  : (typeof progress?.correct === 'number' && progress?.total
                      ? Math.round((progress.correct / Math.max(progress.total, 1)) * 100)
                      : null),
              },
              currentFocus: {
                surface: 'simulation',
                session_id: sessionId,
                anchor: {
                  type: sim.sim_type === 'excel' ? 'cell' : 'question',
                  label: sim.title || 'Simulation',
                  snippet:
                    `Simulation: ${sim.title || ''} (${sim.sim_type || 'generic'})\n` +
                    (config?.instructions ? `Instructions: ${String(config.instructions).slice(0, 800)}\n` : '') +
                    (config?.prompt ? `Prompt: ${String(config.prompt).slice(0, 800)}` : ''),
                },
              },
            })}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/25 border border-[var(--color-primary)]/35 text-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold font-bricolage transition-colors"
            data-testid="simulation-ask-pari-btn"
          >
            Ask Pari about this simulation
          </button>
        </div>
      </main>
      {(() => {
        const t = resolveTutorPhase('simulation_intro');
        return <AvatarPersona pose={t?.pose || 'simulation_brief'} size="sm" position="bottom-right" message={t?.message} />;
      })()}
    </div>
  );
}

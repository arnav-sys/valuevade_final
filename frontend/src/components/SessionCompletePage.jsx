import { useEffect, useState, useMemo, useRef } from 'react';
import SessionSummaryCard from './gamification/SessionSummaryCard';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import SessionCompleteSummaryCard from './gamification/SessionCompleteSummaryCard';
import QuickRevisionSheetCard from './gamification/QuickRevisionSheetCard';
import AvatarPersona from './tutor/AvatarPersona';
import { resolveTutorPhase } from '../contexts/TutorContext';
import AskPariButton from './tutor/AskPariButton';
import { markSessionDoubt, resolveSessionDoubt } from '../utils/sessionDoubts';
import { getRedoForSession, clearRedoState } from '../utils/redoState';
import { useOpenDoubts } from '../contexts/OpenDoubtsContext';
import { useMilestones } from '../contexts/MilestonesContext';
import { reportSessionCompleted } from '../utils/studyPlanner';
import { getMeasuredMinutesTotal } from '../utils/useSessionTimer';
import {
  ArrowRight, Trophy, Sparkles, CheckCircle2, FileText, HelpCircle, MessageSquare,
  Wrench, Loader2, AlertCircle, RefreshCw, Award, Briefcase, AlertTriangle, Brain,
} from 'lucide-react';

// Feb 2026, session-level interview phase disabled; PHASE_DEFS no longer
// includes the interview column so the summary shows 3 phases instead of 4.
// The `interview_completed` DB field still exists, legacy rows are ignored
// gracefully. Flip SESSION_INTERVIEW_ENABLED in utils/sessionPhases.js to
// re-enable everywhere.
const PHASE_DEFS = [
  { key: 'notes', label: 'Notes', icon: FileText, color: '#246BFD', scoreField: null },
  { key: 'quiz', label: 'Quiz', icon: HelpCircle, color: '#6A5CFF', scoreField: 'quiz_score' },
  { key: 'simulation', label: 'Simulation', icon: Wrench, color: '#10B981', scoreField: 'simulation_score' },
];

function Confetti() {
  const pieces = Array.from({ length: 60 });
  const colors = ['#246BFD', '#6A5CFF', '#FF6AC1', '#10B981', '#F59E0B'];
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2.8 + Math.random() * 1.8;
        const color = colors[i % colors.length];
        const size = 7 + Math.random() * 7;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: '-10px',
              width: size,
              height: size * 1.4,
              background: color,
              borderRadius: 2,
              opacity: 0.9,
              animation: `vvSessionConfettiFall ${duration}s cubic-bezier(.2,.7,.3,1) ${delay}s forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes vvSessionConfettiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

export default function SessionCompletePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Anchor the gamification summary card to when the user first landed here.
  // markPhaseComplete writes XP events ~immediately before this page mounts,
  // so 60s back from mount covers the last awardXP loop + streak + badges
  // + daily-challenge updates.
  const sessionStartTsRef = useRef(Date.now() - 60_000);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [module, setModule] = useState(null);
  const [nextSession, setNextSession] = useState(null);
  const [moduleComplete, setModuleComplete] = useState(false);
  const [hasModuleProject, setHasModuleProject] = useState(false);  // Batch: gate M1→M2 unlock via project
  const [showConfetti, setShowConfetti] = useState(true);

  // Phase B, doubt flag state
  const [doubtRow, setDoubtRow] = useState(null);  // { id, reason, status } or null
  const [flagPending, setFlagPending] = useState(null);  // 'doubt' | 'difficult' | null
  const [redoInfo, setRedoInfo] = useState(() => getRedoForSession(sessionId));
  const { refresh: refreshOpenCount } = useOpenDoubts();
  const { notifySessionCompleted } = useMilestones();
  const milestoneCheckedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id || !sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: sess, error: sErr } = await supabase
          .from('user_sessions')
          .select('*, user_modules(id, title, order_index, module_number, enrollment_id, is_completed, master_module_id)')
          .eq('id', sessionId)
          .single();
        if (sErr) throw sErr;
        if (!mounted) return;
        setSession(sess);
        setModule(sess.user_modules || null);

        const modId = sess.user_module_id;
        if (modId) {
          const { data: siblings, error: sibErr } = await supabase
            .from('user_sessions')
            .select('id, title, order_index, is_completed, is_removed')
            .eq('user_module_id', modId)
            .eq('is_removed', false)
            .order('order_index');
          if (sibErr) throw sibErr;

          const active = siblings || [];
          const thisIdx = active.findIndex((s) => s.id === sessionId);
          const next = thisIdx >= 0 && thisIdx < active.length - 1 ? active[thisIdx + 1] : null;
          if (mounted) setNextSession(next);

          const allDone = active.every((s) => s.is_completed);
          if (mounted) setModuleComplete(allDone);

          // Batch: gate the M1→M2 unlock via the module project.
          // When the user finishes the last session of a module that has a
          // master_module_projects row, ensure their user_module_projects
          // row exists (lazy-seed for legacy/failed enrollments) and set
          // hasModuleProject so the CTAs route to the project page.
          if (allDone && !next) {
            const masterModId = sess.user_modules?.master_module_id;
            if (masterModId) {
              const { data: mpRows } = await supabase
                .from('master_module_projects')
                .select('id')
                .eq('module_id', masterModId)
                .limit(1);
              const mp = (mpRows && mpRows[0]) || null;
              if (mp) {
                const { data: existing } = await supabase
                  .from('user_module_projects')
                  .select('id, is_completed')
                  .eq('user_module_id', modId)
                  .limit(1);
                if (!existing || existing.length === 0) {
                  // Idempotent seed, best-effort, don't block UI on failure
                  try {
                    await supabase.from('user_module_projects').insert({
                      user_module_id: modId,
                      master_project_id: mp.id,
                      is_completed: false,
                      started_at: null,
                    });
                  } catch { /* row race → ignore */ }
                }
                // hasModuleProject stays true even if the project is already
                // is_completed (rare, a redo/replay path). In that case, we
                // still route to project/start which will show its complete-state.
                if (mounted) setHasModuleProject(true);
              }
            }
          }
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load session');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [sessionId, user?.id]);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, []);

  // Phase B, fetch the existing doubt (if any) for this session.
  useEffect(() => {
    let mounted = true;
    async function fetchDoubt() {
      if (!user?.id || !sessionId) return;
      try {
        const { data } = await supabase
          .from('user_session_doubts')
          .select('id, reason, status')
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
          .maybeSingle();
        if (mounted && data) setDoubtRow(data);
      } catch {
        // ignore, graceful if table missing
      }
    }
    fetchDoubt();
    return () => { mounted = false; };
  }, [user?.id, sessionId]);

  // Phase B, auto-resolve the doubt when the user finishes the session in
  // redo mode. Fires once when allPhasesComplete && redoInfo matches.
  useEffect(() => {
    if (!redoInfo || !session) return;
    const allPhasesDone =
      session.notes_completed &&
      session.quiz_completed &&
      session.simulation_completed;
    if (!allPhasesDone) return;
    let mounted = true;
    (async () => {
      try {
        await resolveSessionDoubt(redoInfo.redo_doubt_id);
        if (!mounted) return;
        toast.success('Doubt resolved, nice redo!');
        clearRedoState();
        setRedoInfo(null);
        setDoubtRow((d) => (d ? { ...d, status: 'resolved' } : d));
        refreshOpenCount();
      } catch {
        // best-effort; user can resolve manually from /doubts if it fails
      }
    })();
    return () => { mounted = false; };
  }, [redoInfo, session, refreshOpenCount]);

  // Phase D2, Plan-tracking side-channel.
  // Fires once when the session is fully complete. Fire-and-forget: the
  // backend is idempotent on (plan_id, day_date, session_id) so a refresh
  // or remount can't double-credit. Minutes_spent uses the master_session
  // estimated_minutes (planned, not wall-clock) so faster students aren't
  // penalised, per the Phase D2 spec.
  const planSyncRef = useRef(false);
  useEffect(() => {
    if (!session || planSyncRef.current) return;
    const allPhasesDone =
      session.notes_completed &&
      session.quiz_completed &&
      session.simulation_completed;
    if (!allPhasesDone) return;
    planSyncRef.current = true;
    let alive = true;
    (async () => {
      try {
        // Look up planned minutes from master_sessions.
        let estimated = 50;
        if (session.master_session_id) {
          const { data: ms } = await supabase
            .from('master_sessions')
            .select('estimated_minutes')
            .eq('id', session.master_session_id)
            .maybeSingle();
          if (ms?.estimated_minutes) estimated = ms.estimated_minutes;
        }
        if (!alive) return;
        // Batch 2 (Item 1): sum measured minutes across all 4 phase timers
        // instead of trusting estimated_minutes. The util applies:
        //   - Math.max(1, …) floor (no zero writes)
        //   - silent 3× estimated cap (guards against tab-left-open scenarios)
        const measured = getMeasuredMinutesTotal(sessionId, { estimatedMinutes: estimated });
        await reportSessionCompleted({ session_id: sessionId, minutes_spent: measured });
      } catch {
        // Fire-and-forget: never block the session-complete UI on plan tracking.
      }
    })();
    return () => { alive = false; };
  }, [session, sessionId]);

  // Phase C, Milestone check.
  // Fires once after the session loads and we've confirmed all four phases
  // are complete. POSTs /api/milestones/check; the backend grants at most
  // one milestone (module > count priority) and the MilestonesProvider then
  // re-polls /pending so the overlay surfaces. Idempotent: the unique key
  // user_milestones(user_id, milestone_code) blocks any second grant, so
  // a redo session that re-finishes a module does NOT re-trigger.
  useEffect(() => {
    if (!session || milestoneCheckedRef.current) return;
    const allPhasesDone =
      session.notes_completed &&
      session.quiz_completed &&
      session.simulation_completed;
    if (!allPhasesDone) return;
    milestoneCheckedRef.current = true;
    // Small delay so the celebration overlay doesn't fight the
    // SessionCompleteSummaryCard's XP-toast cascade for attention.
    const t = setTimeout(() => { notifySessionCompleted(sessionId); }, 1400);
    return () => clearTimeout(t);
  }, [session, sessionId, notifySessionCompleted]);

  // Flag handler, only available on a fresh completion (not in redo mode).
  const handleFlag = async (reason) => {
    if (flagPending) return;
    setFlagPending(reason);
    try {
      const { ok, data } = await markSessionDoubt({ session_id: sessionId, reason });
      if (!ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'Could not flag');
      setDoubtRow({ id: data.id, reason: data.reason, status: data.status || 'open' });
      toast.success(reason === 'doubt' ? 'Flagged as a doubt' : 'Flagged as difficult');
      refreshOpenCount();
    } catch (e) {
      toast.error(e?.message || 'Could not flag this session');
    } finally {
      setFlagPending(null);
    }
  };

  const phaseScores = useMemo(() => {
    if (!session) return [];
    return PHASE_DEFS.map((p) => {
      const score = p.scoreField ? session[p.scoreField] : null;
      const completed = session[`${p.key}_completed`];
      return { ...p, completed, score };
    });
  }, [session]);

  const allPhasesComplete = phaseScores.length > 0 && phaseScores.every((p) => p.completed);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center" data-testid="session-complete-loading">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6" data-testid="session-complete-error">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
            <AlertCircle size={28} className="text-[var(--color-error)]" />
          </div>
          <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load session</p>
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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden px-4 py-10 sm:py-14" data-testid="session-complete-page">
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.08] blur-[140px] pointer-events-none" />

      {showConfetti && <Confetti />}

      <div className="relative z-10 max-w-2xl mx-auto" data-testid="session-complete-content">
        {/* Phase-4 SessionSummaryCard, XP breakdown + badge progress + streak + next-level + challenges.
            Batch: unified "Continue" routing, if this is the last session and
            the module has a project, land on the project start page (not dashboard). */}
        <SessionSummaryCard
          sessionId={sessionId}
          onContinue={() => {
            if (nextSession) return navigate(`/session/${nextSession.id}/start`);
            if (moduleComplete && hasModuleProject && module?.id) {
              return navigate(`/module/${module.id}/project/start`);
            }
            return navigate('/dashboard');
          }}
        />
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)] text-xs font-mono uppercase tracking-[0.2em] mb-5">
            <Trophy size={12} /> Session complete
          </div>
          <h1 className="font-clash text-4xl sm:text-6xl font-bold text-[var(--color-text)] mb-3" data-testid="session-complete-title">
            Session Complete!
          </h1>
          {session && (
            <p className="text-[var(--color-text-muted)] font-bricolage text-base sm:text-lg mb-2" data-testid="session-complete-session-title">
              {session.title}
            </p>
          )}
          <p className="text-[var(--color-text-muted)] font-bricolage max-w-md mx-auto leading-relaxed">
            {allPhasesComplete
              ? 'You crushed all 3 phases. This is how real analysts learn, notes → quiz → simulation.'
              : 'Great work. Finish the remaining phases when you\'re ready to cement what you learned.'}
          </p>
        </div>

        {/* Phase grid */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 mb-8" data-testid="session-complete-phases">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--color-border)]">
            <Sparkles size={14} className="text-[var(--color-primary)]" />
            <h3 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
              Your 3-phase journey
            </h3>
          </div>
          <div className="space-y-2">
            {phaseScores.map((p) => {
              const Icon = p.icon;
              // Quiz specifically: attempted (yellow) when score < 70; passed (green) when >= 70
              const isAttempted = p.completed && p.key === 'quiz' && (p.score ?? 100) < 70;
              return (
                <div
                  key={p.key}
                  className="flex items-center gap-4 p-3 rounded-xl bg-[var(--color-surface)]/40 border border-[var(--color-border)]"
                  data-testid={`session-complete-phase-${p.key}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: isAttempted ? '#F59E0B15' : `${p.color}15`,
                      border: `1px solid ${isAttempted ? '#F59E0B35' : p.color + '35'}`,
                      color: isAttempted ? '#F59E0B' : p.color,
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-clash text-sm font-semibold text-[var(--color-text)]">{p.label}</div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                      {isAttempted ? 'Attempted' : p.completed ? 'Completed' : 'Skipped'}
                    </div>
                  </div>
                  {p.completed && (
                    <div className="flex items-center gap-2">
                      {p.score != null && p.scoreField && (
                        <span
                          className="text-xs font-mono font-bold px-2.5 py-1 rounded-full"
                          style={{
                            color: isAttempted ? '#F59E0B' : p.color,
                            background: `${isAttempted ? '#F59E0B' : p.color}12`,
                            border: `1px solid ${isAttempted ? '#F59E0B' : p.color}30`,
                          }}
                          data-testid={`session-complete-score-${p.key}`}
                        >
                          {p.scoreField === 'interview_score' ? `${p.score}/5` : `${p.score}%`}
                        </span>
                      )}
                      {isAttempted ? (
                        <span className="text-[10px] font-mono font-bold text-[#F59E0B] shrink-0">⚠</span>
                      ) : (
                        <CheckCircle2 size={16} className="text-[var(--color-success)] shrink-0" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase B, "Was this confusing?" doubt flag row + redo banner */}
        {redoInfo && (
          <div className="rounded-2xl p-4 mb-4 bg-gradient-to-br from-[var(--color-primary)]/12 via-[var(--color-accent-purple)]/8 to-transparent border border-[var(--color-primary)]/30 flex items-start gap-3" data-testid="session-complete-redo-banner">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/40 text-[var(--color-primary)] flex items-center justify-center shrink-0">
              <RefreshCw size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-clash text-sm font-semibold text-[var(--color-text)] mb-0.5">Half-XP redo in progress (redo #{redoInfo.redo_count})</div>
              <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                Finish all 3 phases and we'll auto-resolve the doubt. XP earned this round is halved.
              </p>
            </div>
          </div>
        )}

        {!redoInfo && (
          <div className="rounded-2xl p-4 sm:p-5 mb-4 border border-[var(--color-border)] bg-[var(--color-surface)]/50" data-testid="session-complete-doubt-row">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] flex items-center justify-center shrink-0">
                <Brain size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-clash text-sm font-semibold text-[var(--color-text)] mb-0.5">
                  Was this confusing?
                </div>
                <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                  Flag it now, you can redo the full session for half XP later or chat with Pari (15 turns) about what felt off.
                </p>
              </div>
            </div>
            {doubtRow && doubtRow.status === 'open' ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]" data-testid="session-complete-doubt-flagged">
                <div className="flex items-center gap-2 text-xs font-bricolage text-[var(--color-text-muted)]">
                  <CheckCircle2 size={14} className="text-[var(--color-success)]" />
                  Flagged as <span className="text-[var(--color-text)] font-semibold">{doubtRow.reason === 'doubt' ? 'a doubt' : 'difficult'}</span>. See it under <Link to="/doubts" className="underline text-[var(--color-primary)]">My Doubts</Link>.
                </div>
              </div>
            ) : doubtRow && doubtRow.status === 'resolved' ? (
              <div className="px-3 py-2 rounded-xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-xs font-bricolage text-[var(--color-success)] flex items-center gap-2" data-testid="session-complete-doubt-resolved">
                <CheckCircle2 size={14} /> Resolved.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => handleFlag('doubt')}
                  disabled={!!flagPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent-purple)]/10 hover:bg-[var(--color-accent-purple)]/20 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] text-xs font-semibold font-bricolage transition-all disabled:opacity-50"
                  data-testid="session-complete-flag-doubt"
                >
                  {flagPending === 'doubt' ? <Loader2 size={14} className="animate-spin" /> : <HelpCircle size={14} />}
                  I have a doubt
                </button>
                <button
                  onClick={() => handleFlag('difficult')}
                  disabled={!!flagPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent-pink)]/10 hover:bg-[var(--color-accent-pink)]/20 border border-[var(--color-accent-pink)]/30 text-[var(--color-accent-pink)] text-xs font-semibold font-bricolage transition-all disabled:opacity-50"
                  data-testid="session-complete-flag-difficult"
                >
                  {flagPending === 'difficult' ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                  Found it difficult
                </button>
              </div>
            )}
          </div>
        )}

        {/* Gamification summary (Phase 47) */}
        <SessionCompleteSummaryCard sessionStartTs={sessionStartTsRef.current} />

        {/* Phase A, Quick Revision Sheet */}
        <div className="mt-4">
          <QuickRevisionSheetCard
            sessionId={sessionId}
            moduleId={session?.user_module_id || ''}
          />
        </div>

        <div className="mt-2 mb-6">
          <AskPariButton phase="notes" courseSessionId={sessionId} variant="card" />
        </div>

        {/* Tutor, celebrating beside the summary */}
        {(() => {
          const t = resolveTutorPhase('session_complete');
          return (
            <div className="flex justify-center -mt-2 mb-8">
              <AvatarPersona
                pose={t?.pose || 'celebrating'}
                size="md"
                position="inline"
                message={t?.message}
              />
            </div>
          );
        })()}

        {/* Module-complete callout */}
        {moduleComplete && module && (
          <div className="rounded-2xl p-5 mb-8 bg-gradient-to-br from-[var(--color-accent-purple)]/12 via-[var(--color-primary)]/8 to-transparent border border-[var(--color-accent-purple)]/30 flex items-start gap-3" data-testid="session-complete-module-badge">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-purple)]/20 border border-[var(--color-accent-purple)]/40 text-[var(--color-accent-purple)] flex items-center justify-center shrink-0">
              <Award size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-clash text-sm font-semibold text-[var(--color-text)] mb-0.5">Module Complete!</div>
              <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                You've finished every session in <span className="text-[var(--color-text)]">{module.title}</span>. Time for the module project.
              </p>
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3" data-testid="session-complete-ctas">
          {nextSession ? (
            <button
              onClick={() => navigate(`/session/${nextSession.id}/start`)}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
              data-testid="session-complete-next-session"
            >
              Next Session: {nextSession.title}
              <ArrowRight size={16} />
            </button>
          ) : moduleComplete && hasModuleProject ? (
            <button
              onClick={() => navigate(`/module/${module.id}/project/start`)}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-accent-purple)] to-[var(--color-primary)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(106,92,255,0.4)] hover:brightness-110 transition-all"
              data-testid="session-complete-module-project"
            >
              <Briefcase size={16} />
              Module Complete! Start Module Project
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
              data-testid="session-complete-to-dashboard"
            >
              Continue <ArrowRight size={16} />
            </button>
          )}

          <Link
            to="/dashboard"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
            data-testid="session-complete-back-dashboard"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

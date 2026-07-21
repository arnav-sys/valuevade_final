import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useXP } from '../contexts/XPContext';
import { triggerStreakUpdate } from '../utils/streakBus';
import { triggerBadgeEvaluation } from '../utils/badgeBus';
import { updateDailyChallengesForPhase } from '../utils/progress';
import { XP_REASONS } from '../utils/xp';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import TaskCard from './projects/TaskCard';
import { normaliseCapstonePhases } from '../utils/capstonePhases';
import {
  ArrowLeft, ArrowRight, AlertCircle, RefreshCw, Trophy, CheckCircle2, Loader2,
  ChevronDown, ChevronRight, Layers,
} from 'lucide-react';
import AvatarPersona from './tutor/AvatarPersona';
import { resolveTutorPhase } from '../contexts/TutorContext';
import { Skeleton } from './ui/skeleton';

export default function CapstoneTasksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [capstone, setCapstone] = useState(null);
  const [masterCapstone, setMasterCapstone] = useState(null);
  const [phasesProgress, setPhasesProgress] = useState([]);
  const [collapsed, setCollapsed] = useState({});
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const { awardXP } = useXP();

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const { data: enr, error: enrErr } = await supabase
          .from('user_enrollments')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        if (enrErr) throw enrErr;
        if (!mounted) return;
        setEnrollment(enr);
        if (!enr) {
          setLoading(false);
          return;
        }

        const { data: cap, error: capErr } = await supabase
          .from('user_capstone_projects')
          .select('*, master_capstone_projects(*)')
          .eq('enrollment_id', enr.id)
          .maybeSingle();
        if (capErr) throw capErr;
        if (!mounted) return;
        setCapstone(cap || null);
        setMasterCapstone(cap?.master_capstone_projects || null);
        setPhasesProgress(Array.isArray(cap?.phases_progress) ? cap.phases_progress : []);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load capstone');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [user?.id]);

  const phases = useMemo(
    // Adapt the raw DB `phases` blob (may be JSON object with markdown
    // `tasks_raw` OR an array) into the phase array the renderer needs.
    // See utils/capstonePhases.js.
    () => normaliseCapstonePhases(masterCapstone?.phases),
    [masterCapstone]
  );

  const isTaskDone = useCallback(
    (phaseIdx, taskIdx) => {
      const entry = phasesProgress.find(
        (p) => p.phase_index === phaseIdx && p.task_index === taskIdx
      );
      return !!entry?.is_completed;
    },
    [phasesProgress]
  );

  const totals = useMemo(() => {
    let total = 0;
    let done = 0;
    phases.forEach((ph, pIdx) => {
      const ts = Array.isArray(ph?.tasks) ? ph.tasks : [];
      ts.forEach((_, tIdx) => {
        total += 1;
        if (isTaskDone(pIdx, tIdx)) done += 1;
      });
    });
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0, allDone: total > 0 && done === total };
  }, [phases, isTaskDone]);

  const toggleTask = async (phaseIdx, taskIdx) => {
    if (!capstone) return;
    const existing = phasesProgress.find(
      (p) => p.phase_index === phaseIdx && p.task_index === taskIdx
    );
    const nextVal = existing ? !existing.is_completed : true;

    const nextProgress = existing
      ? phasesProgress.map((p) =>
          p.phase_index === phaseIdx && p.task_index === taskIdx
            ? { ...p, is_completed: nextVal }
            : p
        )
      : [...phasesProgress, { phase_index: phaseIdx, task_index: taskIdx, is_completed: nextVal }];

    setPhasesProgress(nextProgress);
    setSaving(true);
    try {
      const { error: upErr } = await supabase
        .from('user_capstone_projects')
        .update({ phases_progress: nextProgress })
        .eq('id', capstone.id);
      if (upErr) throw upErr;
    } catch (err) {
      toast.error('Could not save progress');
      setPhasesProgress(phasesProgress);
    } finally {
      setSaving(false);
    }
  };

  const togglePhase = (idx) => {
    setCollapsed((c) => ({ ...c, [idx]: !c[idx] }));
  };

  const handleComplete = async () => {
    if (!capstone || !totals.allDone) return;
    setCompleting(true);
    try {
      const { error: upErr } = await supabase
        .from('user_capstone_projects')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          phases_progress: phasesProgress,
        })
        .eq('id', capstone.id);
      if (upErr) throw upErr;

      // Mark enrollment as completed
      if (enrollment?.id) {
        await supabase
          .from('user_enrollments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', enrollment.id);
      }

      // +300 XP for capstone (fires toast + sound + level-up via XPContext)
      try {
        await awardXP({
          amount: 300,
          reason: XP_REASONS.capstone_complete,
          source_id: capstone.id,
          meta: { master_capstone_id: masterCapstone?.id || null, minutes: 0 },
        });
        try { await triggerStreakUpdate(); } catch { /* fire-and-forget */ }
        try {
          await triggerBadgeEvaluation({
            source_event: 'capstone_complete',
            capstone_id: capstone.id,
          });
        } catch { /* fire-and-forget */ }
        try {
          await updateDailyChallengesForPhase(user.id, 'capstone_task_complete', {});
        } catch { /* fire-and-forget */ }
      } catch (xpErr) {
        console.warn('[capstone] XP award failed (non-fatal):', xpErr?.message || xpErr);
      }

      navigate('/capstone/complete');
    } catch (err) {
      toast.error(err.message || 'Could not complete capstone');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative">
      <div className="absolute top-[-10%] left-[15%] w-[600px] h-[600px] rounded-full bg-[var(--color-accent-pink)] opacity-[0.06] blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[15%] w-[600px] h-[600px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.06] blur-[160px] pointer-events-none" />

      <Sidebar />

      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <Link
            to="/capstone/start"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group font-bricolage"
            data-testid="capstone-tasks-back"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Overview
          </Link>

          {loading && (
            <div className="space-y-4" data-testid="capstone-tasks-loading">
              <Skeleton className="h-4 w-48 bg-[var(--color-surface)]" />
              <Skeleton className="h-10 w-2/3 bg-[var(--color-surface)]" />
              <Skeleton className="h-24 w-full bg-[var(--color-surface)]" />
              <Skeleton className="h-40 w-full bg-[var(--color-surface)]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center text-center py-16" data-testid="capstone-tasks-error">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
                <AlertCircle size={28} className="text-[var(--color-error)]" />
              </div>
              <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load capstone</p>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
              >
                <RefreshCw size={16} /> Try Again
              </button>
            </div>
          )}

          {!loading && !error && masterCapstone && (
            <>
              <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-5">
                {enrollment && <>
                  <span>{enrollment.title}</span>
                  <span className="text-[var(--color-text-faint)]">›</span>
                </>}
                <span>Capstone</span>
                <span className="text-[var(--color-text-faint)]">›</span>
                <span className="text-[var(--color-text)]">Tasks</span>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent-pink)]/10 border border-[var(--color-accent-pink)]/25 text-[var(--color-accent-pink)] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
                <Trophy size={12} /> Capstone · Tasks
              </div>

              <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-2" data-testid="capstone-tasks-title">
                {masterCapstone.title || 'Capstone Project'}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">
                Work through every phase. Each task builds toward your final deliverable.
              </p>

              {/* Overall progress */}
              <div className="glass-card rounded-2xl p-5 mb-6" data-testid="capstone-progress">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      size={14}
                      className={totals.allDone ? 'text-[var(--color-success)]' : 'text-[var(--color-accent-pink)]'}
                    />
                    <span className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                      Overall progress
                    </span>
                    {saving && <Loader2 size={12} className="animate-spin text-[var(--color-text-faint)]" />}
                  </div>
                  <span className="text-xs font-mono text-[var(--color-text-muted)]" data-testid="capstone-progress-count">
                    {totals.done} of {totals.total} tasks
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      totals.allDone
                        ? 'bg-[var(--color-success)]'
                        : 'bg-gradient-to-r from-[var(--color-accent-pink)] via-[var(--color-accent-purple)] to-[var(--color-primary)]'
                    }`}
                    style={{ width: `${totals.pct}%` }}
                  />
                </div>
              </div>

              {/* Phases */}
              <div className="space-y-4 mb-8" data-testid="capstone-phases">
                {phases.length === 0 && (
                  <div className="glass-card rounded-2xl p-6 text-center text-sm font-bricolage text-[var(--color-text-muted)]">
                    No phases configured for this capstone yet.
                  </div>
                )}
                {phases.map((phase, pIdx) => {
                  const tasks = Array.isArray(phase?.tasks) ? phase.tasks : [];
                  const phaseDone = tasks.filter((_, tIdx) => isTaskDone(pIdx, tIdx)).length;
                  const phaseTotal = tasks.length;
                  const phasePct = phaseTotal ? Math.round((phaseDone / phaseTotal) * 100) : 0;
                  const isPhaseDone = phaseTotal > 0 && phaseDone === phaseTotal;
                  const isCollapsed = !!collapsed[pIdx];

                  return (
                    <div
                      key={pIdx}
                      className="glass-card rounded-2xl overflow-hidden"
                      data-testid={`capstone-phase-${pIdx}`}
                    >
                      <button
                        onClick={() => togglePhase(pIdx)}
                        className="w-full p-5 flex items-start gap-4 text-left hover:bg-[var(--color-surface)]/40 transition-colors"
                        data-testid={`capstone-phase-${pIdx}-header`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isPhaseDone
                            ? 'bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)]'
                            : 'bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)]'
                        }`}>
                          {isPhaseDone ? <CheckCircle2 size={18} /> : <Layers size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <div>
                              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)] mb-0.5">
                                Phase {pIdx + 1}
                              </div>
                              <h3 className="font-clash text-lg font-semibold text-[var(--color-text)]">
                                {phase?.phase_title || `Phase ${pIdx + 1}`}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-mono text-[var(--color-text-muted)]">
                                {phaseDone}/{phaseTotal}
                              </span>
                              {isCollapsed ? (
                                <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
                              ) : (
                                <ChevronDown size={16} className="text-[var(--color-text-muted)]" />
                              )}
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden mt-2">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                isPhaseDone
                                  ? 'bg-[var(--color-success)]'
                                  : 'bg-gradient-to-r from-[var(--color-accent-pink)] to-[var(--color-accent-purple)]'
                              }`}
                              style={{ width: `${phasePct}%` }}
                            />
                          </div>
                        </div>
                      </button>

                      {!isCollapsed && (
                        <div className="px-5 pb-5 pt-1 space-y-3 border-t border-[var(--color-border)]/60" data-testid={`capstone-phase-${pIdx}-body`}>
                          {phase?.phase_description && (
                            <p className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed pt-4">
                              {phase.phase_description}
                            </p>
                          )}
                          {tasks.length === 0 ? (
                            <p className="text-xs font-mono text-[var(--color-text-faint)] py-2">
                              No tasks configured for this phase.
                            </p>
                          ) : (
                            tasks.map((task, tIdx) => (
                              <TaskCard
                                key={tIdx}
                                index={tIdx}
                                task={task}
                                isCompleted={isTaskDone(pIdx, tIdx)}
                                onToggle={() => toggleTask(pIdx, tIdx)}
                                testIdPrefix={`capstone-phase-${pIdx}-task`}
                              />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Complete CTA */}
              {totals.total > 0 && (
                <div className="flex items-center justify-between gap-4 flex-wrap" data-testid="capstone-complete-row">
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                    {totals.allDone ? '🏆 Every task done — ready to submit.' : `${totals.total - totals.done} task${totals.total - totals.done === 1 ? '' : 's'} left.`}
                  </span>
                  <button
                    onClick={handleComplete}
                    disabled={!totals.allDone || completing}
                    className={`inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold font-bricolage transition-all ${
                      totals.allDone && !completing
                        ? 'bg-gradient-to-r from-[var(--color-accent-pink)] via-[var(--color-accent-purple)] to-[var(--color-primary)] text-white hover:shadow-[0_0_28px_rgba(255,106,193,0.4)] hover:brightness-110'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] cursor-not-allowed'
                    }`}
                    data-testid="capstone-complete-btn"
                  >
                    {completing ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                    Complete Capstone
                    {!completing && <ArrowRight size={16} />}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      {(() => {
        const hasCapstone = !!masterCapstone && !loading && !error;
        const phase = hasCapstone ? 'project_intro' : 'apology';
        const t = resolveTutorPhase(phase);
        const emptyMsg = "No capstone here yet — check back once you've completed all modules in this path.";
        return (
          <AvatarPersona
            pose={t?.pose || (hasCapstone ? 'simulation_brief' : 'apology')}
            size="sm"
            position="bottom-right"
            message={hasCapstone ? t?.message : emptyMsg}
          />
        );
      })()}
    </div>
  );
}

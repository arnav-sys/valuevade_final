import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { checkCapstoneUnlock, updateDailyChallengesForPhase } from '../utils/progress';
import { triggerBadgeEvaluation } from '../utils/badgeBus';
import Sidebar from './Sidebar';
import TaskCard from './projects/TaskCard';
import {
  ArrowLeft, ArrowRight, AlertCircle, RefreshCw, Briefcase, Trophy,
  CheckCircle2, Loader2,
} from 'lucide-react';
import AvatarPersona from './tutor/AvatarPersona';
import { resolveTutorPhase } from '../contexts/TutorContext';
import { Skeleton } from './ui/skeleton';

export default function ModuleProjectTasksPage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userProject, setUserProject] = useState(null);
  const [masterProject, setMasterProject] = useState(null);
  const [module, setModule] = useState(null);
  const [tasksProgress, setTasksProgress] = useState([]);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id || !moduleId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: upRows, error: upErr } = await supabase
          .from('user_module_projects')
          .select('*, user_modules(id, title, order_index, enrollment_id, is_completed)')
          .eq('user_module_id', moduleId);
        if (upErr) throw upErr;
        if (!mounted) return;
        const up = Array.isArray(upRows) && upRows.length > 0 ? upRows[0] : null;
        if (!up) throw new Error('No project found for this module.');
        setUserProject(up);
        setModule(up.user_modules || null);
        setTasksProgress(Array.isArray(up.tasks_progress) ? up.tasks_progress : []);

        if (up.master_project_id) {
          const { data: mp, error: mpErr } = await supabase
            .from('master_module_projects')
            .select('*')
            .eq('id', up.master_project_id)
            .single();
          if (mpErr) throw mpErr;
          if (mounted) setMasterProject(mp);
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load project');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [moduleId, user?.id]);

  const tasks = useMemo(
    () => (Array.isArray(masterProject?.tasks) ? masterProject.tasks : []),
    [masterProject]
  );

  const isTaskDone = useCallback(
    (idx) => {
      const entry = tasksProgress.find((t) => t.task_index === idx);
      return !!entry?.is_completed;
    },
    [tasksProgress]
  );

  const completedCount = tasksProgress.filter((t) => t.is_completed).length;
  const totalCount = tasks.length;
  const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const toggleTask = async (idx) => {
    if (!userProject) return;
    const existing = tasksProgress.find((t) => t.task_index === idx);
    const nextVal = existing ? !existing.is_completed : true;

    const nextProgress = existing
      ? tasksProgress.map((t) => (t.task_index === idx ? { ...t, is_completed: nextVal } : t))
      : [...tasksProgress, { task_index: idx, is_completed: nextVal }];

    setTasksProgress(nextProgress);
    setSaving(true);
    try {
      const { error: upErr } = await supabase
        .from('user_module_projects')
        .update({ tasks_progress: nextProgress })
        .eq('id', userProject.id);
      if (upErr) throw upErr;
    } catch (err) {
      toast.error('Could not save progress');
      // revert
      setTasksProgress(tasksProgress);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!userProject || !allDone) return;
    setCompleting(true);
    try {
      const { error: upErr } = await supabase
        .from('user_module_projects')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          tasks_progress: tasksProgress,
        })
        .eq('id', userProject.id);
      if (upErr) throw upErr;

      // If module + project are now complete, try unlock capstone
      if (module?.enrollment_id) {
        await checkCapstoneUnlock(module.enrollment_id);
      }

      // Badge engine — module_complete + any_module_complete + capstone gate
      try {
        await triggerBadgeEvaluation({
          source_event: 'module_project_complete',
          module_id: moduleId,
        });
      } catch { /* fire-and-forget */ }
      try {
        await updateDailyChallengesForPhase(user.id, 'module_project_complete', {});
      } catch { /* fire-and-forget */ }

      navigate(`/module/${moduleId}/project/complete`);
    } catch (err) {
      toast.error(err.message || 'Could not complete project');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative">
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[120px] pointer-events-none" />

      <Sidebar />

      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <Link
            to={`/module/${moduleId}/project/start`}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group font-bricolage"
            data-testid="module-project-tasks-back"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Overview
          </Link>

          {loading && (
            <div className="space-y-4" data-testid="module-project-tasks-loading">
              <Skeleton className="h-4 w-48 bg-[var(--color-surface)]" />
              <Skeleton className="h-8 w-2/3 bg-[var(--color-surface)]" />
              <Skeleton className="h-20 w-full bg-[var(--color-surface)]" />
              <Skeleton className="h-32 w-full bg-[var(--color-surface)]" />
              <Skeleton className="h-32 w-full bg-[var(--color-surface)]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center text-center py-16" data-testid="module-project-tasks-error">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
                <AlertCircle size={28} className="text-[var(--color-error)]" />
              </div>
              <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load tasks</p>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
              >
                <RefreshCw size={16} /> Try Again
              </button>
            </div>
          )}

          {!loading && !error && masterProject && (
            <>
              <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-5">
                {module && (
                  <>
                    <span>
                      {/^\s*module\b/i.test(module.title || '')
                        ? module.title
                        : `Module ${module.order_index + 1}: ${module.title}`}
                    </span>
                    <span className="text-[var(--color-text-faint)]">›</span>
                  </>
                )}
                <span className="text-[var(--color-text)]">Project Tasks</span>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
                <Briefcase size={12} /> Module Project · Tasks
              </div>

              <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-2" data-testid="module-project-tasks-title">
                {masterProject.title || 'Module Project'}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">
                Check off each deliverable as you complete it. Tasks can be done in any order.
              </p>

              {/* Progress bar */}
              <div className="glass-card rounded-2xl p-5 mb-6" data-testid="module-project-progress">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className={allDone ? 'text-[var(--color-success)]' : 'text-[var(--color-primary)]'} />
                    <span className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                      Progress
                    </span>
                    {saving && <Loader2 size={12} className="animate-spin text-[var(--color-text-faint)]" />}
                  </div>
                  <span className="text-xs font-mono text-[var(--color-text-muted)]" data-testid="module-project-progress-count">
                    {completedCount} of {totalCount} tasks
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      allDone
                        ? 'bg-[var(--color-success)]'
                        : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Task list */}
              <div className="space-y-3 mb-8" data-testid="module-project-task-list">
                {tasks.length === 0 && (
                  <div className="glass-card rounded-2xl p-6 text-center text-sm font-bricolage text-[var(--color-text-muted)]">
                    No tasks configured for this project yet.
                  </div>
                )}
                {tasks.map((task, idx) => (
                  <TaskCard
                    key={idx}
                    index={idx}
                    task={task}
                    isCompleted={isTaskDone(idx)}
                    onToggle={() => toggleTask(idx)}
                    testIdPrefix="module-project-task"
                  />
                ))}
              </div>

              {/* Complete CTA */}
              {tasks.length > 0 && (
                <div className="flex items-center justify-between gap-4 flex-wrap" data-testid="module-project-complete-row">
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                    {allDone ? '🎉 All tasks done — ready to submit.' : `${totalCount - completedCount} task${totalCount - completedCount === 1 ? '' : 's'} left.`}
                  </span>
                  <button
                    onClick={handleComplete}
                    disabled={!allDone || completing}
                    className={`inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold font-bricolage transition-all ${
                      allDone && !completing
                        ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] cursor-not-allowed'
                    }`}
                    data-testid="module-project-complete-btn"
                  >
                    {completing ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                    Mark Project as Complete
                    {!completing && <ArrowRight size={16} />}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      {(() => {
        // When the module has no project to render (empty / loading / error
        // state), switch Tara to an apology pose with a clarifying message
        // so she never looks confused on an empty page.
        const hasProject = !!masterProject && !loading && !error;
        const phase = hasProject ? 'project_intro' : 'apology';
        const t = resolveTutorPhase(phase);
        const emptyMsg = "No project here yet — check back once you've completed all sessions in this module.";
        return (
          <AvatarPersona
            pose={t?.pose || (hasProject ? 'simulation_brief' : 'apology')}
            size="sm"
            position="bottom-right"
            message={hasProject ? t?.message : emptyMsg}
          />
        );
      })()}
    </div>
  );
}

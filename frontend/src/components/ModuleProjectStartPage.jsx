import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import {
  ArrowLeft, ArrowRight, Target, AlertCircle, RefreshCw, Lock,
  Clock, ListChecks, Sparkles, Briefcase, PlayCircle, FileText,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';

export default function ModuleProjectStartPage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userProject, setUserProject] = useState(null);
  const [masterProject, setMasterProject] = useState(null);
  const [module, setModule] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id || !moduleId) return;
      setLoading(true);
      setError(null);
      try {
        // 1. user_module_projects + joined user_modules
        // Use array fetch (not .single()) so duplicate rows don't crash the page.
        // We pick the most recently updated row defensively.
        const { data: upRows, error: upErr } = await supabase
          .from('user_module_projects')
          .select('*, user_modules(id, title, order_index, enrollment_id, is_completed)')
          .eq('user_module_id', moduleId);
        if (upErr) throw upErr;
        if (!mounted) return;
        const up = Array.isArray(upRows) && upRows.length > 0 ? upRows[0] : null;
        if (!up) {
          throw new Error('No project found for this module yet. Please complete all sessions first.');
        }
        setUserProject(up);
        setModule(up.user_modules || null);

        // 2. master_module_projects (parallel with sessions check)
        const [mpRes, sessRes] = await Promise.all([
          up.master_project_id
            ? supabase
                .from('master_module_projects')
                .select('*')
                .eq('id', up.master_project_id)
                .single()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from('user_sessions')
            .select('id, title, order_index, is_completed, is_removed')
            .eq('user_module_id', moduleId)
            .eq('is_removed', false)
            .order('order_index'),
        ]);

        if (mpRes.error && mpRes.error.code !== 'PGRST116') throw mpRes.error;
        if (sessRes.error) throw sessRes.error;

        if (!mounted) return;
        setMasterProject(mpRes.data || null);
        setSessions(sessRes.data || []);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load module project');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [moduleId, user?.id]);

  const incompleteSessions = sessions.filter((s) => !s.is_completed);
  const isUnlocked = sessions.length > 0 && incompleteSessions.length === 0;
  const taskCount = Array.isArray(masterProject?.tasks) ? masterProject.tasks.length : 0;

  const handleStart = async () => {
    try {
      if (userProject && !userProject.started_at) {
        await supabase
          .from('user_module_projects')
          .update({ started_at: new Date().toISOString() })
          .eq('id', userProject.id);
      }
      navigate(`/module/${moduleId}/project/tasks`);
    } catch {
      navigate(`/module/${moduleId}/project/tasks`);
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
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group font-bricolage"
            data-testid="module-project-start-back"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </Link>

          {loading && (
            <div className="space-y-4" data-testid="module-project-start-loading">
              <Skeleton className="h-4 w-48 bg-[var(--color-surface)]" />
              <Skeleton className="h-10 w-2/3 bg-[var(--color-surface)]" />
              <Skeleton className="h-24 w-full bg-[var(--color-surface)]" />
              <Skeleton className="h-40 w-full bg-[var(--color-surface)]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center text-center py-16" data-testid="module-project-start-error">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
                <AlertCircle size={28} className="text-[var(--color-error)]" />
              </div>
              <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load project</p>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
              >
                <RefreshCw size={16} /> Try Again
              </button>
            </div>
          )}

          {!loading && !error && !masterProject && (
            <div className="flex flex-col items-center text-center py-16" data-testid="module-project-empty">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center mb-5">
                <Briefcase size={28} className="text-[var(--color-text-muted)]" />
              </div>
              <p className="text-[var(--color-text)] font-bricolage mb-2">No project configured</p>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">
                This module doesn't have a project yet.
              </p>
            </div>
          )}

          {!loading && !error && masterProject && (
            <>
              <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-5" data-testid="module-project-breadcrumb">
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
                <span className="text-[var(--color-text)]">Project</span>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
                <Briefcase size={12} /> Module Project
              </div>

              <h1 className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="module-project-title">
                {masterProject.title || 'Module Project'}
              </h1>
              {masterProject.description && (
                <p className="text-[var(--color-text-muted)] font-bricolage text-base sm:text-lg leading-relaxed mb-8" data-testid="module-project-description">
                  {masterProject.description}
                </p>
              )}

              {/* Deliverable callout */}
              {masterProject.deliverable_description && (
                <div className="rounded-2xl p-5 sm:p-6 mb-6 bg-gradient-to-br from-[var(--color-accent-purple)]/10 via-[var(--color-primary)]/5 to-transparent border border-[var(--color-accent-purple)]/25" data-testid="module-project-deliverable">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={16} className="text-[var(--color-accent-purple)]" />
                    <h2 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                      Deliverable
                    </h2>
                  </div>
                  <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
                    {masterProject.deliverable_description}
                  </p>
                </div>
              )}

              {/* Meta: time + task count */}
              <div className="grid grid-cols-2 gap-3 mb-8" data-testid="module-project-meta">
                <div className="glass-card rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center shrink-0">
                    <Clock size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-0.5">
                      Estimated time
                    </div>
                    <div className="font-clash text-base font-semibold text-[var(--color-text)]">
                      {masterProject.estimated_time || masterProject.estimated_hours
                        ? `${masterProject.estimated_time || masterProject.estimated_hours}${typeof (masterProject.estimated_time || masterProject.estimated_hours) === 'number' ? ' hrs' : ''}`
                        : '—'}
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] flex items-center justify-center shrink-0">
                    <ListChecks size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-0.5">
                      Tasks
                    </div>
                    <div className="font-clash text-base font-semibold text-[var(--color-text)]">
                      {taskCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Locked state */}
              {!isUnlocked ? (
                <div className="glass-card rounded-2xl p-5 sm:p-6 border-[var(--color-warning)]/25" data-testid="module-project-locked">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock size={16} className="text-[var(--color-warning)]" />
                    <h2 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                      Complete these sessions to unlock
                    </h2>
                  </div>
                  <p className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed mb-4">
                    You still have {incompleteSessions.length} session{incompleteSessions.length === 1 ? '' : 's'} to finish in this module before the project unlocks.
                  </p>
                  <ul className="space-y-2">
                    {incompleteSessions.map((s, i) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface)]/60 border border-[var(--color-border)]"
                        data-testid={`module-project-locked-session-${i}`}
                      >
                        <span className="text-[10px] font-mono text-[var(--color-text-faint)] w-6 shrink-0">
                          {String((s.order_index ?? i) + 1).padStart(2, '0')}
                        </span>
                        <span className="flex-1 text-sm font-bricolage text-[var(--color-text)] truncate">
                          {s.title}
                        </span>
                        <Link
                          to={`/session/${s.id}/start`}
                          className="text-xs font-mono text-[var(--color-primary)] hover:underline shrink-0"
                          data-testid={`module-project-locked-session-link-${i}`}
                        >
                          Resume →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4" data-testid="module-project-start-cta-row">
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                    <Sparkles size={11} className="inline mr-1" /> Ready when you are
                  </span>
                  <button
                    onClick={handleStart}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
                    data-testid="module-project-start-cta"
                  >
                    <PlayCircle size={16} />
                    {userProject?.started_at ? 'Continue Project' : 'Start Project'}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

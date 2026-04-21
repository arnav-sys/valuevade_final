import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getNextPhase } from '../utils/progress';
import Sidebar from './Sidebar';
import {
  ArrowRight, Sparkles, BookOpen, Clock, Flame, Trophy, Target, Layers,
  CheckCircle2, PlayCircle, Lock, AlertCircle, RefreshCw, FileText,
  HelpCircle, MessageSquare, Wrench, Rocket, Loader2,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';

const PHASE_META = {
  notes: { label: 'Notes', icon: FileText, path: 'notes' },
  quiz: { label: 'Quiz', icon: HelpCircle, path: 'quiz' },
  interview: { label: 'Interview', icon: MessageSquare, path: 'interview' },
  simulation: { label: 'Simulation', icon: Wrench, path: 'simulation' },
};

function StatCard({ icon: Icon, label, value, suffix, accent = 'primary', testid }) {
  const accentMap = {
    primary: 'from-[var(--color-primary)]/15 to-[var(--color-primary)]/5 text-[var(--color-primary)] border-[var(--color-primary)]/20',
    purple: 'from-[var(--color-accent-purple)]/15 to-[var(--color-accent-purple)]/5 text-[var(--color-accent-purple)] border-[var(--color-accent-purple)]/20',
    pink: 'from-[var(--color-accent-pink)]/15 to-[var(--color-accent-pink)]/5 text-[var(--color-accent-pink)] border-[var(--color-accent-pink)]/20',
    success: 'from-[var(--color-success)]/15 to-[var(--color-success)]/5 text-[var(--color-success)] border-[var(--color-success)]/20',
  };
  return (
    <div className="glass-card rounded-2xl p-5" data-testid={testid}>
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accentMap[accent]} border flex items-center justify-center mb-3`}>
        <Icon size={18} />
      </div>
      <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">{label}</div>
      <div className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)]">
        {value}<span className="text-sm font-bricolage text-[var(--color-text-muted)] ml-1 font-normal">{suffix}</span>
      </div>
    </div>
  );
}

function ModuleCard({ module, sessions, projectStatus, isActive, isLocked }) {
  const activeSessions = sessions.filter((s) => !s.is_removed);
  const completedCount = activeSessions.filter((s) => s.is_completed).length;
  const total = activeSessions.length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const isComplete = module.is_completed || (total > 0 && completedCount === total);

  return (
    <div
      className={`glass-card rounded-2xl p-5 sm:p-6 transition-all ${
        isLocked ? 'opacity-50' : ''
      } ${isActive ? 'border-[var(--color-primary)]/40 shadow-[0_0_32px_rgba(36,107,253,0.12)]' : ''}`}
      data-testid={`dashboard-module-${module.order_index}`}
    >
      <div className="flex items-start gap-4">
        {/* Status icon */}
        <div className="shrink-0">
          {isComplete ? (
            <div className="w-10 h-10 rounded-xl bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 flex items-center justify-center">
              <CheckCircle2 size={18} className="text-[var(--color-success)]" />
            </div>
          ) : isLocked ? (
            <div className="w-10 h-10 rounded-xl bg-[var(--color-text-faint)]/10 border border-[var(--color-border)] flex items-center justify-center">
              <Lock size={16} className="text-[var(--color-text-faint)]" />
            </div>
          ) : isActive ? (
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 flex items-center justify-center animate-pulse">
              <PlayCircle size={18} className="text-[var(--color-primary)]" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
              <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                {String(module.order_index + 1).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)] mb-0.5">
                Module {module.order_index + 1}
              </div>
              <h3 className="font-clash text-lg font-semibold text-[var(--color-text)]" data-testid={`module-title-${module.order_index}`}>
                {module.title}
              </h3>
            </div>
            <span className="text-xs font-mono text-[var(--color-text-muted)] shrink-0 pt-1">
              {completedCount}/{total}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isComplete
                  ? 'bg-[var(--color-success)]'
                  : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)]'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Expanded sessions for active module */}
          {isActive && activeSessions.length > 0 && (
            <div className="mt-4 space-y-1.5" data-testid={`module-sessions-${module.order_index}`}>
              {activeSessions.map((s, sidx) => {
                const phases = ['notes', 'quiz', 'interview', 'simulation'];
                return (
                  <Link
                    key={s.id}
                    to={`/session/${s.id}/start`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all border ${
                      s.is_completed
                        ? 'bg-[var(--color-success)]/5 border-[var(--color-success)]/15'
                        : 'bg-[var(--color-surface)]/50 border-[var(--color-border)] hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-surface)]'
                    }`}
                    data-testid={`session-item-${sidx}`}
                  >
                    <span className="text-[10px] font-mono text-[var(--color-text-faint)] w-5 shrink-0">
                      {String(sidx + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 text-sm font-bricolage text-[var(--color-text)] truncate">
                      {s.title}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {phases.map((ph) => {
                        const done = s[`${ph}_completed`];
                        const Icon = PHASE_META[ph].icon;
                        // Hybrid: quiz is "attempted" (yellow) when completed but score < 70
                        const attempted = done && ph === 'quiz' && (s.quiz_score ?? 100) < 70;
                        return (
                          <span
                            key={ph}
                            className={`w-5 h-5 rounded-md flex items-center justify-center ${
                              attempted
                                ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                                : done
                                  ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                                  : 'bg-[var(--color-surface)] text-[var(--color-text-faint)]'
                            }`}
                            title={`${PHASE_META[ph].label}${attempted ? ` attempted (${s.quiz_score}%)` : done ? ' complete' : ''}`}
                            data-testid={`session-item-${sidx}-phase-${ph}`}
                          >
                            <Icon size={10} />
                          </span>
                        );
                      })}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Module project indicator */}
          {projectStatus && (
            <div className="mt-3 flex items-center gap-2 text-[11px] font-mono">
              <Target size={12} className={
                projectStatus.is_completed
                  ? 'text-[var(--color-success)]'
                  : projectStatus.is_unlocked
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-text-faint)]'
              } />
              <span className="text-[var(--color-text-muted)]">
                Module project: {projectStatus.is_completed ? 'Done' : projectStatus.is_unlocked ? 'Unlocked' : 'Locked'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-2xl bg-[var(--color-surface)]" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0,1,2,3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl bg-[var(--color-surface)]" />)}
      </div>
      <Skeleton className="h-40 w-full rounded-2xl bg-[var(--color-surface)]" />
      <Skeleton className="h-40 w-full rounded-2xl bg-[var(--color-surface)]" />
    </div>
  );
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [modules, setModules] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [moduleProjects, setModuleProjects] = useState([]);
  const [capstone, setCapstone] = useState(null);

  const fetchAll = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Active enrollment
      const { data: enr, error: enrErr } = await supabase
        .from('user_enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (enrErr) throw enrErr;

      if (!enr) {
        setEnrollment(null);
        setLoading(false);
        return;
      }
      setEnrollment(enr);

      // 2. Modules
      const { data: mods, error: modErr } = await supabase
        .from('user_modules')
        .select('*')
        .eq('enrollment_id', enr.id)
        .eq('is_removed', false)
        .order('order_index');
      if (modErr) throw modErr;
      const moduleList = mods || [];
      setModules(moduleList);

      const moduleIds = moduleList.map((m) => m.id);

      // 3-6. Run remaining queries in parallel with graceful failure
      const [sessionsRes, statsRes, projectsRes, capstoneRes] = await Promise.all([
        moduleIds.length
          ? supabase
              .from('user_sessions')
              .select('*')
              .eq('is_removed', false)
              .in('user_module_id', moduleIds)
              .order('order_index')
          : Promise.resolve({ data: [] }),
        supabase.from('user_stats').select('*').eq('enrollment_id', enr.id).maybeSingle().then(
          (r) => r,
          () => ({ data: null })
        ),
        moduleIds.length
          ? supabase
              .from('user_module_projects')
              .select('*')
              .in('user_module_id', moduleIds)
              .then((r) => r, () => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        supabase
          .from('user_capstone_projects')
          .select('*')
          .eq('enrollment_id', enr.id)
          .maybeSingle()
          .then((r) => r, () => ({ data: null })),
      ]);

      setSessions(sessionsRes.data || []);
      setStats(statsRes.data || null);
      setModuleProjects(projectsRes.data || []);
      setCapstone(capstoneRes.data || null);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Computed state
  const computed = useMemo(() => {
    if (!enrollment || !modules.length) {
      return {
        currentModule: null,
        currentSession: null,
        nextPhase: null,
        overallProgress: 0,
        totalSessions: 0,
        completedSessions: 0,
        completedModules: 0,
        allModulesComplete: false,
      };
    }

    // sessions by module
    const sessionsByModule = {};
    sessions.forEach((s) => {
      if (!sessionsByModule[s.user_module_id]) sessionsByModule[s.user_module_id] = [];
      sessionsByModule[s.user_module_id].push(s);
    });

    let currentModule = null;
    let currentSession = null;
    for (const m of modules) {
      const ms = (sessionsByModule[m.id] || []).filter((s) => !s.is_removed);
      const incomplete = ms.find((s) => !s.is_completed);
      if (incomplete) {
        currentModule = m;
        currentSession = incomplete;
        break;
      }
    }

    const nextPhase = currentSession ? getNextPhase(currentSession) : null;
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.is_completed).length;
    const completedModules = modules.filter((m) => m.is_completed).length;
    const overallProgress = totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0;
    const allModulesComplete = modules.length > 0 && completedModules === modules.length;

    return {
      currentModule,
      currentSession,
      nextPhase,
      overallProgress,
      totalSessions,
      completedSessions,
      completedModules,
      allModulesComplete,
      sessionsByModule,
    };
  }, [enrollment, modules, sessions]);

  const projectByModule = useMemo(() => {
    const map = {};
    moduleProjects.forEach((p) => { map[p.user_module_id] = p; });
    return map;
  }, [moduleProjects]);

  // ---------------- Render ----------------

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative">
      {/* Ambient orbs */}
      <div className="absolute top-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.05] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[120px] pointer-events-none" />

      <Sidebar />

      {/* Main content */}
      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">

          {/* Loading */}
          {loading && <DashboardSkeleton />}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center text-center py-16" data-testid="dashboard-error">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
                <AlertCircle size={28} className="text-[var(--color-error)]" />
              </div>
              <p className="text-[var(--color-text)] font-bricolage mb-2">Something went wrong</p>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
              <button
                onClick={fetchAll}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all"
                data-testid="dashboard-retry"
              >
                <RefreshCw size={16} /> Try Again
              </button>
            </div>
          )}

          {/* No enrollment */}
          {!loading && !error && !enrollment && (
            <div className="flex flex-col items-center text-center py-20" data-testid="dashboard-empty">
              <div className="w-20 h-20 rounded-2xl bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/20 flex items-center justify-center mb-6">
                <BookOpen size={32} className="text-[var(--color-accent-purple)]" />
              </div>
              <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-3">
                Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
              </h1>
              <p className="text-[var(--color-text-muted)] font-bricolage max-w-md mb-8">
                You don't have any active enrollments yet. Choose a career path to get started.
              </p>
              <button
                onClick={() => navigate('/courses')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
                data-testid="dashboard-browse-courses"
              >
                <Sparkles size={16} /> Browse Courses <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Main dashboard */}
          {!loading && !error && enrollment && (
            <div className="space-y-8" data-testid="dashboard-content">

              {/* Welcome + Continue learning */}
              <section>
                <div className="mb-6">
                  <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)]" data-testid="dashboard-welcome">
                    Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
                  </h1>
                  <p className="text-sm text-[var(--color-text-muted)] font-bricolage mt-1">
                    {enrollment.title}
                  </p>
                </div>

                <ContinueLearningCard
                  computed={computed}
                  enrollment={enrollment}
                  capstone={capstone}
                  projectByModule={projectByModule}
                  onNavigate={navigate}
                />
              </section>

              {/* Stats */}
              <section>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="dashboard-stats">
                  <StatCard
                    icon={BookOpen}
                    label="Sessions"
                    value={computed.completedSessions}
                    suffix={`/ ${computed.totalSessions}`}
                    accent="primary"
                    testid="stat-sessions"
                  />
                  <StatCard
                    icon={Layers}
                    label="Modules"
                    value={computed.completedModules}
                    suffix={`/ ${modules.length}`}
                    accent="purple"
                    testid="stat-modules"
                  />
                  <StatCard
                    icon={Flame}
                    label="Streak"
                    value={stats?.streak ?? 0}
                    suffix={stats?.streak === 1 ? 'day' : 'days'}
                    accent="pink"
                    testid="stat-streak"
                  />
                  <StatCard
                    icon={Clock}
                    label="Time spent"
                    value={stats?.total_time_minutes ?? 0}
                    suffix="min"
                    accent="success"
                    testid="stat-time"
                  />
                </div>
              </section>

              {/* Course progress map */}
              <section>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <h2 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)]">
                      Your learning path
                    </h2>
                    <p className="text-xs text-[var(--color-text-muted)] font-bricolage mt-0.5">
                      {computed.overallProgress}% complete · {modules.length} modules
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-mono border border-[var(--color-primary)]/15">
                    <Sparkles size={12} /> AI-customized
                  </div>
                </div>

                {/* Overall progress bar */}
                <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden mb-6" data-testid="dashboard-overall-progress">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] rounded-full transition-all duration-700"
                    style={{ width: `${computed.overallProgress}%` }}
                  />
                </div>

                {/* Module timeline */}
                <div className="space-y-3" data-testid="dashboard-module-timeline">
                  {modules.map((mod) => {
                    const modSessions = (computed.sessionsByModule?.[mod.id]) || [];
                    const isActive = computed.currentModule?.id === mod.id;
                    // Lock modules that come after the current in-progress one (and aren't started)
                    const currentIdx = computed.currentModule
                      ? modules.findIndex((m) => m.id === computed.currentModule.id)
                      : -1;
                    const thisIdx = modules.findIndex((m) => m.id === mod.id);
                    const isLocked = currentIdx >= 0 && thisIdx > currentIdx && !mod.is_completed;

                    return (
                      <ModuleCard
                        key={mod.id}
                        module={mod}
                        sessions={modSessions}
                        projectStatus={projectByModule[mod.id]}
                        isActive={isActive}
                        isLocked={isLocked}
                      />
                    );
                  })}

                  {/* Capstone indicator */}
                  <div
                    className={`glass-card rounded-2xl p-5 sm:p-6 flex items-center gap-4 ${
                      capstone?.is_unlocked ? '' : 'opacity-60'
                    }`}
                    data-testid="dashboard-capstone"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      capstone?.is_completed
                        ? 'bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)]'
                        : capstone?.is_unlocked
                        ? 'bg-gradient-to-br from-[var(--color-accent-pink)]/15 to-[var(--color-accent-purple)]/15 border border-[var(--color-accent-pink)]/30 text-[var(--color-accent-pink)]'
                        : 'bg-[var(--color-text-faint)]/10 border border-[var(--color-border)] text-[var(--color-text-faint)]'
                    }`}>
                      {capstone?.is_completed ? <Trophy size={20} /> : capstone?.is_unlocked ? <Rocket size={20} /> : <Lock size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)] mb-0.5">
                        Final
                      </div>
                      <h3 className="font-clash text-lg font-semibold text-[var(--color-text)]">
                        Capstone Project
                      </h3>
                      <p className="text-xs font-bricolage text-[var(--color-text-muted)] mt-0.5">
                        {capstone?.is_completed
                          ? 'Completed — congrats!'
                          : capstone?.is_unlocked
                          ? 'Unlocked. Ready when you are.'
                          : 'Complete all modules and projects to unlock.'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ContinueLearningCard({ computed, enrollment, capstone, projectByModule, onNavigate }) {
  const { currentModule, currentSession, nextPhase, allModulesComplete } = computed;

  // State 1: all modules done, capstone available
  if (allModulesComplete) {
    return (
      <div
        className="glass-card rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-[var(--color-accent-pink)]/8 via-transparent to-[var(--color-accent-purple)]/8 border-[var(--color-accent-pink)]/20"
        data-testid="continue-learning-capstone"
      >
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-accent-pink)] mb-3">
          <Rocket size={14} /> READY FOR CAPSTONE
        </div>
        <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-2">
          You finished every module.
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-5 max-w-md">
          Bring it all together. Your capstone project is the final mile — apply everything you've learned to a real-world scenario.
        </p>
        <button
          onClick={() => onNavigate('/capstone/start')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-accent-pink)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(255,106,193,0.4)] hover:brightness-110 transition-all"
          data-testid="begin-capstone-btn"
        >
          <Sparkles size={16} /> Begin Capstone <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  // State 2: current module done but its project pending
  if (currentModule && !currentSession) {
    const project = projectByModule[currentModule.id];
    if (project && !project.is_completed) {
      return (
        <div
          className="glass-card rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-[var(--color-primary)]/8 to-transparent"
          data-testid="continue-learning-project"
        >
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-primary)] mb-3">
            <Target size={14} /> MODULE PROJECT
          </div>
          <h2 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)] mb-1">
            Complete your {currentModule.title} project
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-5">
            You've finished every session in this module. Put it to work.
          </p>
          <button
            onClick={() => onNavigate(`/module/${currentModule.id}/project/start`)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all"
            data-testid="complete-project-btn"
          >
            <Target size={16} /> Complete Module Project <ArrowRight size={16} />
          </button>
        </div>
      );
    }
  }

  // State 3: normal continue learning
  if (currentSession && nextPhase) {
    const PhaseIcon = PHASE_META[nextPhase].icon;
    const phaseLabel = PHASE_META[nextPhase].label;

    return (
      <div
        className="glass-card rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-[var(--color-primary)]/8 via-transparent to-[var(--color-accent-purple)]/8 border-[var(--color-primary)]/20"
        data-testid="continue-learning-card"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-primary)] mb-3">
              <PlayCircle size={14} /> CONTINUE LEARNING
            </div>
            <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">
              {currentModule.title}
            </div>
            <h2 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)] mb-3" data-testid="continue-session-title">
              {currentSession.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-[var(--color-accent-purple)]/10 text-[var(--color-accent-purple)] border border-[var(--color-accent-purple)]/15">
                <PhaseIcon size={12} /> Next: {phaseLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                <Clock size={12} /> ~15 min
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate(`/session/${currentSession.id}/${PHASE_META[nextPhase].path}`)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
          data-testid="continue-learning-btn"
        >
          <Sparkles size={16} /> Resume {phaseLabel} <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  // Fallback: nothing to continue but not all done
  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8" data-testid="continue-learning-empty">
      <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-muted)] mb-3">
        <Loader2 size={14} className="animate-spin" /> SETTING UP
      </div>
      <h2 className="font-clash text-xl font-bold text-[var(--color-text)] mb-2">
        Your course is almost ready
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] font-bricolage">
        Sessions are being prepared. Check back in a moment.
      </p>
    </div>
  );
}

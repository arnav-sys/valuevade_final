import { useState, useEffect, lazy, Suspense } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { Skeleton } from '../components/ui/skeleton';
import CapstoneProjectsGrid from './CapstoneProjectsGrid';
import {
  LetterStaggerHeadline, AnimatedStat, BreathingGlow, ScrollProgressBar,
} from './cinematic/primitives';

// Lazy-loaded so the module list paints first (Three.js is ~120KB gzipped).
const CinematicBackground = lazy(() => import('./CinematicBackground'));
import { supabase as supabaseClient } from '../lib/supabase';
import { useEffect as useEffectSP, useState as useStateSP } from 'react';
import { Users as UsersIcon, Target as TargetIcon } from 'lucide-react';

/**
 * Phase-4 social-proof + near-miss strip rendered inside each module's
 * accordion expansion in CourseDetailsPage.
 *
 * Social proof: COUNT(DISTINCT user_id) over user_xp_events with reason in
 * ('session_complete') and source_id ∈ master_sessions(module) in last 7d.
 * Near-miss: when current user has done ≥60% of the module's sessions, show
 * "🎯 N/M sessions — so close!".
 */
function ModuleSocialProof({ module }) {
  const [stats, setStats] = useStateSP({ weekly: null, mine: null, total: null });
  useEffectSP(() => {
    let alive = true;
    (async () => {
      const masterSessIds = (module.master_sessions || []).map((s) => s.id).filter(Boolean);
      if (!masterSessIds.length) return;
      const total = masterSessIds.length;
      const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      const [{ data: weekEvents }, { data: { user } }] = await Promise.all([
        supabaseClient
          .from('user_xp_events')
          .select('user_id')
          .eq('reason', 'session_complete')
          .gte('created_at', since)
          .in('source_id', masterSessIds),
        supabaseClient.auth.getUser(),
      ]);
      const distinct = new Set((weekEvents || []).map((e) => e.user_id));
      let mineDone = 0;
      if (user?.id) {
        const { data: mine } = await supabaseClient
          .from('user_xp_events')
          .select('source_id')
          .eq('reason', 'session_complete')
          .eq('user_id', user.id)
          .in('source_id', masterSessIds);
        mineDone = new Set((mine || []).map((e) => e.source_id)).size;
      }
      if (alive) setStats({ weekly: distinct.size, mine: mineDone, total });
    })();
    return () => { alive = false; };
  }, [module.id, module.master_sessions]);

  if (stats.total == null) return null;
  const pct = stats.total > 0 ? stats.mine / stats.total : 0;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] font-bricolage" data-testid={`module-social-proof-${module.id}`}>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
        <UsersIcon size={11} />
        {stats.weekly === 0
          ? 'Be the first to complete this module'
          : `${stats.weekly} student${stats.weekly === 1 ? '' : 's'} completed this module this week`}
      </span>
      {pct >= 0.6 && pct < 1 && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-accent-pink)]/12 border border-[var(--color-accent-pink)]/40 text-[var(--color-accent-pink)] font-semibold">
          <TargetIcon size={11} /> {stats.mine}/{stats.total} sessions — so close!
        </span>
      )}
    </div>
  );
}

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import {
  LogOut,
  ArrowLeft,
  Layers,
  BookOpen,
  Clock,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  GraduationCap,
  Target,
  Sparkles,
  ChevronRight,
  Sun,
  Moon,
  PlayCircle,
} from 'lucide-react';

function DifficultyBadge({ level }) {
  const config = {
    beginner: { label: 'Beginner', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    intermediate: { label: 'Intermediate', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    advanced: { label: 'Advanced', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  };
  const c = config[level?.toLowerCase()] || config.beginner;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border ${c.cls}`} data-testid="detail-difficulty-badge">
      {c.label}
    </span>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse" data-testid="course-detail-skeleton">
      <Skeleton className="h-10 w-2/3 mb-4 bg-white/5" />
      <Skeleton className="h-5 w-full mb-2 bg-white/5" />
      <Skeleton className="h-5 w-full mb-2 bg-white/5" />
      <Skeleton className="h-5 w-3/4 mb-8 bg-white/5" />
      <div className="flex gap-6 mb-10">
        <Skeleton className="h-5 w-24 bg-white/5" />
        <Skeleton className="h-5 w-24 bg-white/5" />
        <Skeleton className="h-5 w-24 bg-white/5" />
      </div>
      <Skeleton className="h-14 w-48 rounded-xl bg-white/5 mb-12" />
      <Skeleton className="h-8 w-48 mb-4 bg-white/5" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

export default function CourseDetailsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Path details
      const { data: pathData, error: pathErr } = await supabase
        .from('master_paths')
        .select('*')
        .eq('id', courseId)
        .single();

      if (pathErr) throw pathErr;
      setCourse(pathData);

      // 2. Modules with sessions
      const { data: modulesData, error: modErr } = await supabase
        .from('master_modules')
        .select('*, master_sessions(id, title, description, order_index, estimated_minutes)')
        .eq('path_id', courseId)
        .order('order_index');

      if (modErr) throw modErr;

      // Sort sessions within each module
      const sorted = (modulesData || []).map((mod) => ({
        ...mod,
        master_sessions: (mod.master_sessions || []).sort(
          (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
        ),
      }));
      setModules(sorted);

      // 3. Check enrollment
      if (user?.id) {
        try {
          const { data: enrollData } = await supabase
            .from('user_enrollments')
            .select('id, master_path_id, status')
            .eq('user_id', user.id)
            .eq('master_path_id', courseId);
          setEnrollment(enrollData?.[0] || null);
        } catch {
          setEnrollment(null);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load course details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user?.id]);

  const totalSessions = modules.reduce((sum, m) => sum + (m.master_sessions?.length || 0), 0);
  const totalMinutes = modules.reduce(
    (sum, m) => sum + (m.master_sessions || []).reduce((s, sess) => s + (sess.estimated_minutes || 0), 0),
    0
  );
  const totalHours = course?.estimated_hours || Math.round(totalMinutes / 60) || 0;

  // Navigate to the proper enrollment page — a preview + confirm flow
  // (no AI customization / no instant enroll).
  const goCustomize = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/enroll/${courseId}`);
  };

  const isEnrolled = enrollment?.status === 'active';
  const isCompleted = enrollment?.status === 'completed';

  const whatYouLearn = course?.what_you_learn || [];
  const prerequisites = course?.prerequisites || [];
  const careerOutcomes = course?.career_outcomes || [];
  const skills = course?.skills || [];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Scroll progress — thin violet bar at top of viewport, premium signal */}
      <ScrollProgressBar />
      {/* Cinematic Three.js bg — denser than /courses since this is a deeper
          page. Dark mode only; light mode keeps its cream ambient orbs. */}
      {theme === 'dark' && (
        <Suspense fallback={null}>
          <div className="fixed inset-0 z-0 pointer-events-none" data-testid="detail-cinematic-bg-wrap">
            <CinematicBackground density="medium" />
          </div>
        </Suspense>
      )}
      {/* Ambient orbs */}
      <div className="absolute top-[-8%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-[var(--color-primary)] opacity-[0.05] blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--color-border)]" data-testid="detail-header">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="detail-logo">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8" />
            <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all" data-testid="detail-theme-toggle" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {profile && (
              <span className="text-sm text-[var(--color-text-muted)] font-bricolage hidden sm:block" data-testid="detail-user-name">
                {profile.full_name}
              </span>
            )}
            {user ? (
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all font-bricolage"
                data-testid="detail-signout-button"
              >
                <LogOut size={16} /> Sign Out
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all font-bricolage"
                  data-testid="detail-login-link"
                >
                  Log in
                </Link>
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold font-bricolage bg-[var(--color-primary)] text-white hover:shadow-[0_0_20px_rgba(36,107,253,0.35)] transition-all"
                  data-testid="detail-signup-link"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 sm:py-12 relative z-10">
        {/* Back link */}
        <Link
          to="/courses"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-8 group"
          data-testid="detail-back-link"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Courses
        </Link>

        {/* Loading */}
        {loading && <DetailSkeleton />}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center text-center py-16" data-testid="detail-error">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
              <AlertCircle size={28} className="text-[var(--color-error)]" />
            </div>
            <p className="text-[var(--color-text)] font-bricolage mb-2">Failed to load course</p>
            <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all"
              data-testid="detail-retry-button"
            >
              <RefreshCw size={16} /> Try Again
            </button>
          </div>
        )}

        {/* Course loaded */}
        {!loading && !error && course && (
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Left content */}
            <div className="flex-1 min-w-0">
              {/* Hero section */}
              <section className="mb-12 relative" data-testid="detail-hero">
                {/* Title-side halo dots (smaller variant of /courses hero halo) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-12 -top-8 w-[280px] h-[280px] opacity-40 hidden sm:block"
                  style={{ animation: 'detail-halo-rotate 48s linear infinite' }}
                >
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    {Array.from({ length: 14 }).map((_, i) => {
                      const a = (i / 14) * Math.PI * 2;
                      const r = 80;
                      const cx = 100 + Math.cos(a) * r;
                      const cy = 100 + Math.sin(a) * r;
                      return <circle key={i} cx={cx} cy={cy} r={1 + (i % 2) * 0.4} fill="#a78bfa" opacity={0.6} />;
                    })}
                  </svg>
                </div>
                <LetterStaggerHeadline
                  text={course.title}
                  className="font-clash text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text)] mb-4 tracking-tight relative"
                  testid="detail-title"
                />
                <motion.p
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage leading-relaxed mb-6 max-w-2xl"
                  data-testid="detail-description"
                >
                  {course.long_description || course.description}
                </motion.p>

                {/* Stats bar (preserved for tests/legacy a11y) */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-8 text-sm text-[var(--color-text-muted)] font-mono" data-testid="detail-stats">
                  <span className="flex items-center gap-1.5">
                    <Layers size={16} className="text-[var(--color-primary)]" />
                    {modules.length} module{modules.length !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BookOpen size={16} className="text-[var(--color-accent-purple)]" />
                    {totalSessions} session{totalSessions !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={16} className="text-[var(--color-accent-pink)]" />
                    {totalHours}h
                  </span>
                  <DifficultyBadge level={course.difficulty} />
                </div>

                {/* CTA — wrapped in breathing-glow for premium primary actions */}
                {isCompleted ? (
                  <span className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold font-bricolage bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20" data-testid="detail-completed-badge">
                    <CheckCircle2 size={18} /> Course Completed
                  </span>
                ) : isEnrolled ? (
                  <BreathingGlow testid="detail-cta-glow">
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all shadow-[0_8px_30px_rgba(139,92,246,0.45)]"
                      data-testid="detail-go-dashboard"
                    >
                      Go to Dashboard <ArrowRight size={16} />
                    </button>
                  </BreathingGlow>
                ) : (
                  <BreathingGlow testid="detail-cta-glow">
                    <button
                      onClick={goCustomize}
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all shadow-[0_8px_30px_rgba(139,92,246,0.45)]"
                      data-testid="detail-customize-enroll"
                    >
                      {user ? 'Enroll — Preview & Start' : 'Login to Enroll'} <ArrowRight size={16} />
                    </button>
                  </BreathingGlow>
                )}
              </section>

              {/* Animated stats reveal — counts up on scroll-into-view */}
              <section className="mb-14" data-testid="detail-stats-reveal">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <AnimatedStat testid="detail-stat-modules"   value={modules.length || 0}  label="Modules"   icon={<Layers size={18} />} />
                  <AnimatedStat testid="detail-stat-sessions"  value={totalSessions || 0}   label="Sessions"  icon={<BookOpen size={18} />} />
                  <AnimatedStat testid="detail-stat-hours"     value={totalHours || 0}      label="Hours"     icon={<Clock size={18} />} suffix="h" />
                  <AnimatedStat testid="detail-stat-capstones" value={3}                    label="Capstones" icon={<CheckCircle2 size={18} />} />
                </div>
              </section>

              {/* What You'll Learn */}
              {whatYouLearn.length > 0 && (
                <section className="mb-12" data-testid="detail-what-you-learn">
                  <h2 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)] mb-6">
                    What You'll Learn
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {whatYouLearn.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]"
                        data-testid={`learn-item-${idx}`}
                      >
                        <CheckCircle2 size={18} className="text-[var(--color-success)] shrink-0 mt-0.5" />
                        <span className="text-sm text-[var(--color-text)] font-bricolage">{item}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Intro reel — premium video preview of the programme.
                  Placed AFTER 'What You'll Learn' so users have context before pressing play. */}
              <section className="mb-12" data-testid="detail-intro-video-section">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center">
                    <PlayCircle size={12} className="text-[var(--color-primary)]" />
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Watch the intro</p>
                </div>
                <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] bg-black shadow-[0_20px_60px_rgba(0,0,0,0.35)] max-w-3xl">
                  <video
                    src="https://customer-assets.emergentagent.com/job_excel-rebuild/artifacts/d5e8lw4b_valuevade-reel-16x9.mp4"
                    controls
                    preload="metadata"
                    playsInline
                    className="w-full h-auto aspect-video bg-black"
                    data-testid="detail-intro-video"
                  >
                    <track kind="captions" />
                  </video>
                </div>
              </section>

              {/* Course Modules */}
              {modules.length > 0 && (
                <section className="mb-12" data-testid="detail-modules-section">
                  <h2 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)] mb-6">
                    Course Modules
                  </h2>
                  <Accordion type="single" collapsible defaultValue="module-0" className="space-y-3">
                    {modules.map((mod, idx) => {
                      const sessions = mod.master_sessions || [];
                      const modMinutes = sessions.reduce((s, sess) => s + (sess.estimated_minutes || 0), 0);
                      const modHours = (modMinutes / 60).toFixed(1);

                      return (
                        <AccordionItem
                          key={mod.id}
                          value={`module-${idx}`}
                          className="glass-card rounded-xl border-[var(--color-border)] overflow-hidden"
                          data-testid={`module-item-${idx}`}
                        >
                          <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-[var(--color-surface-hover)] transition-colors">
                            <div className="flex items-center gap-4 text-left flex-1 min-w-0">
                              <span className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center text-xs font-mono text-[var(--color-primary)] shrink-0">
                                {String(mod.module_number ?? mod.order_index ?? (idx + 1)).padStart(2, '0')}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[var(--color-text)] font-bricolage truncate" data-testid={`module-title-${idx}`}>
                                  {/^\s*module\b/i.test(mod.title || '')
                                    ? mod.title
                                    : `Module ${mod.module_number ?? mod.order_index ?? (idx + 1)}: ${mod.title}`}
                                </p>
                                <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
                                  {sessions.length} session{sessions.length !== 1 ? 's' : ''} &middot; {modHours}h
                                </p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-5 pb-4">
                            {/* Phase-4 social proof + near-miss */}
                            <ModuleSocialProof module={mod} />
                            {/* Module 23 (capstone module): surface the 3 capstone project cards
                                ABOVE the regular session list. Conditioned on canonical
                                module_number === 23 so other modules render normally. */}
                            {mod.module_number === 23 && (
                              <div
                                className="mt-4 mb-5 pt-4 border-t border-[var(--color-border)]"
                                data-testid="m23-capstone-section"
                              >
                                <div className="flex items-center gap-2 mb-4">
                                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent-purple)]">
                                    Your Capstone Projects
                                  </span>
                                  <span className="text-[10px] font-mono text-[var(--color-text-faint)]">
                                    · 3 portfolio-grade deliverables
                                  </span>
                                </div>
                                <CapstoneProjectsGrid pathId={courseId} />
                              </div>
                            )}
                            <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                              {sessions.map((sess, sIdx) => (
                                <div
                                  key={sess.id}
                                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
                                  data-testid={`session-item-${idx}-${sIdx}`}
                                >
                                  <ChevronRight size={14} className="text-[var(--color-text-muted)] shrink-0" />
                                  <span className="text-sm text-[var(--color-text)] font-bricolage flex-1 min-w-0">
                                    {sess.title}
                                  </span>
                                  {sess.estimated_minutes && (
                                    <span className="text-xs text-[var(--color-text-muted)] font-mono shrink-0">
                                      {sess.estimated_minutes}min
                                    </span>
                                  )}
                                </div>
                              ))}
                              {sessions.length === 0 && (
                                <p className="text-xs text-[var(--color-text-muted)] font-bricolage py-2">
                                  Sessions coming soon
                                </p>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </section>
              )}
            </div>

            {/* Sidebar (desktop) / bottom section (mobile) */}
            <aside className="w-full lg:w-80 shrink-0" data-testid="detail-sidebar">
              <div className="lg:sticky lg:top-24 space-y-6">
                {/* Prerequisites */}
                <div className="glass-card rounded-xl p-5" data-testid="detail-prerequisites">
                  <div className="flex items-center gap-2 mb-4">
                    <Target size={18} className="text-[var(--color-primary)]" />
                    <h3 className="text-sm font-semibold text-[var(--color-text)] font-bricolage">Prerequisites</h3>
                  </div>
                  {prerequisites.length > 0 ? (
                    <ul className="space-y-2">
                      {prerequisites.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)] font-bricolage">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mt-1.5 shrink-0" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[var(--color-text-muted)] font-bricolage">None — open to all skill levels</p>
                  )}
                </div>

                {/* Career Outcomes */}
                {careerOutcomes.length > 0 && (
                  <div className="glass-card rounded-xl p-5" data-testid="detail-career-outcomes">
                    <div className="flex items-center gap-2 mb-4">
                      <GraduationCap size={18} className="text-[var(--color-accent-purple)]" />
                      <h3 className="text-sm font-semibold text-[var(--color-text)] font-bricolage">Career Outcomes</h3>
                    </div>
                    <ul className="space-y-2">
                      {careerOutcomes.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)] font-bricolage">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-purple)] mt-1.5 shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Skills */}
                {skills.length > 0 && (
                  <div className="glass-card rounded-xl p-5" data-testid="detail-skills">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles size={18} className="text-[var(--color-accent-pink)]" />
                      <h3 className="text-sm font-semibold text-[var(--color-text)] font-bricolage">Skills You'll Gain</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent-pink)]/30 transition-colors"
                          data-testid={`skill-tag-${i}`}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* Your Capstone Projects — surfaced near the bottom (after the module
            list) per the updated brief. Same CapstoneProjectsGrid used inside
            the M23 accordion expansion and on /capstones → single source of
            truth. */}
        {!loading && !error && course && (
          <motion.section
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-20 mb-16"
            data-testid="detail-capstones-bottom"
          >
            <div className="mb-8 text-center">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-accent-purple)] mb-2">
                Final Track Output
              </div>
              <h2 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)]" data-testid="detail-capstones-heading">
                Your Capstone Projects
              </h2>
            </div>
            <CapstoneProjectsGrid pathId={courseId} />
          </motion.section>
        )}

        {/* Closing CTA band */}
        {!loading && !error && course && !isCompleted && (
          <motion.section
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 mb-8"
            data-testid="detail-closing-cta"
          >
            <div className="relative rounded-3xl border border-[var(--color-accent-purple)]/25 bg-gradient-to-br from-[var(--color-accent-purple)]/[0.08] via-transparent to-[var(--color-primary)]/[0.06] backdrop-blur-xl px-6 sm:px-10 py-12 sm:py-16 text-center overflow-hidden">
              <div aria-hidden="true" className="absolute -top-32 left-1/2 -translate-x-1/2 w-[460px] h-[460px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.12] blur-[110px] pointer-events-none" />
              <div className="relative">
                <h2 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-4">
                  {course.title}
                </h2>
                <p className="text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage max-w-xl mx-auto mb-8">
                  {course.description}
                </p>
                <BreathingGlow testid="detail-closing-glow">
                  {isEnrolled ? (
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all shadow-[0_8px_30px_rgba(139,92,246,0.45)]"
                      data-testid="detail-closing-cta-button"
                    >
                      Go to Dashboard <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={goCustomize}
                      className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all shadow-[0_8px_30px_rgba(139,92,246,0.45)]"
                      data-testid="detail-closing-cta-button"
                    >
                      {user ? 'Enroll — Preview & Start' : 'Login to Enroll'} <ArrowRight size={16} />
                    </button>
                  )}
                </BreathingGlow>
              </div>
            </div>
          </motion.section>
        )}
      </main>

      <style>{`
        @keyframes detail-halo-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          [style*="detail-halo-rotate"] { animation: none !important; }
        }
      `}</style>

      {/* Sticky mobile CTA */}
      {!loading && !error && course && !isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-[var(--bg-primary)]/90 backdrop-blur-xl border-t border-[var(--color-border)] p-4 z-50 mobile-sticky-bar" data-testid="detail-mobile-cta">
          {isEnrolled ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3.5 rounded-xl bg-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage flex items-center justify-center gap-2 hover:shadow-[0_0_24px_rgba(106,92,255,0.4)] transition-all"
              data-testid="detail-mobile-dashboard-btn"
            >
              Go to Dashboard <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={goCustomize}
              className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage flex items-center justify-center gap-2 hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all"
              data-testid="detail-mobile-enroll-btn"
            >
              {user ? 'Customize & Enroll' : 'Login to Enroll'} <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

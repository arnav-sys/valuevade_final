import { useState, useEffect, lazy, Suspense } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { Skeleton } from '../components/ui/skeleton';
import CapstoneProjectsGrid from './CapstoneProjectsGrid';
import WhoBuiltThisSection from './WhoBuiltThisSection';
import {
  buildCourseJsonLd,
  buildCourseBreadcrumbJsonLd,
  buildFaqPageJsonLd,
} from './landing/jsonLd';
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
  Award,
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

// Course-details FAQ set — Prompt 3 task 12 verbatim. Kept at module scope
// so it drives both the visible accordion AND the FAQPage JSON-LD schema
// (Prompt 4: same source, never duplicate the strings).
const COURSE_DETAILS_FAQS = [
  { q: 'What are the prerequisites for the Equity Research Analyst Program?',
    a: "None. The course starts from absolute foundations — what finance is, how the three statements work — before building toward modelling and valuation. Basic Excel familiarity helps but isn't assumed; the early sessions teach the spreadsheet skills the later simulations use. If you can commit about an hour a day, you have everything you need." },
  { q: 'How long does the course take to complete?',
    a: "Most students finish in about 2 months at 1 hour a day; the full program is roughly 60 hours of guided work, including 42 hours of video lectures. The Study Planner lets you set a target deadline or a daily-hours budget and auto-schedules all 239 sessions accordingly. Because access is lifetime, going slower costs nothing." },
  { q: 'How long does it take to learn DCF valuation?',
    a: "Inside the program, you build your first complete DCF — on Reliance — in the valuation modules, roughly five weeks in at an hour a day, after the accounting, analysis and modelling foundations that make the DCF's assumptions defensible. Getting comfortable defending WACC, growth and terminal-value choices in an interview usually takes a further few weeks of the valuation and mock-interview modules." },
  { q: 'What does the syllabus cover?',
    a: "Accounting and economics foundations, financial statement analysis, ratio and forensic analysis, three-statement financial modelling, valuation (DCF, comparable companies, SOTP), industry and competitive analysis, and AI skills for analysts — across 21 modules and 239 sessions — ending with three capstones: a full initiating-coverage report, a sector coverage note, and a working AI research copilot. The full module-by-module breakdown is on this page above." },
  { q: 'What kind of simulations does the course have?',
    a: "239 hands-on simulations — one per session — across three formats: interactive Excel (formulas, drag-fill, VLOOKUP, multi-sheet, auto-graded), branch-based decision scenarios, and applied reading with quizzes." },
  { q: 'Is the certificate recognised?',
    a: "You get Valuevade's Certificate of Completion (named, dated, unique ID, LinkedIn-ready) when you finish all three capstones. Recognition in Indian finance hiring comes less from any course certificate and more from two things this program is built around: external certification — the curriculum prepares you for the SEBI-established NISM Series XV exam — and the portfolio of three real deliverables recruiters can open and judge. We'd rather be straight about that than oversell a PDF." },
  { q: 'What happens if I pause for a few weeks?',
    a: "Nothing is lost. Progress, streaks, XP, badges, doubt history and your study plan are all persisted, and access is lifetime — you pick up exactly where you left off. The Study Planner can reschedule your remaining sessions around a new deadline." },
  { q: 'Will this course get me a finance job?',
    a: "No course can honestly promise a job, and we don't. What the program is built to give you is the exact evidence junior analyst hiring screens for: three portfolio deliverables (an initiating-coverage report, a sector note, and a working AI research copilot), scored mock-interview practice, and NISM Series XV preparation. Those are the artefacts that get resumes shortlisted and interviews passed — the offer still depends on you." },
  { q: 'Is Valuevade worth it?',
    a: "For ₹1,500 one-time you get 21 modules, 239 hands-on sessions on Indian companies, a 24/7 AI tutor, scored AI mock interviews, NISM Series XV certification prep, and three portfolio capstones — a scope comparable Indian programs price at ₹25,000–₹1,20,000. Whether it's worth it for you is exactly what the free first session is for: do one full session — notes, quiz, interview, simulation — before paying anything, and judge the quality yourself." },
  { q: 'How is Valuevade different from WallStreet School?',
    a: "WallStreet School runs instructor-led cohort programs in financial modelling and valuation, with live classes and scheduled batches. Valuevade is fully self-paced software: 239 auto-graded simulations, a 24/7 AI tutor, AI mock interviews and lifetime access at ₹1,500. Choose a live cohort if scheduled classes and human accountability are what keep you working; choose Valuevade if you want hands-on practice on Indian companies at your own pace and a fraction of the cost." },
  { q: 'How is Valuevade different from Imarticus or Upgrad?',
    a: "Imarticus and Upgrad offer longer university-style finance programs, often with placement-assistance structures and cohort schedules. Valuevade is a focused equity-research skill program: shorter (about 2 months at an hour a day), self-paced, simulation-first, and ₹1,500 lifetime. If you want a long credentialed program with placement services, they're built for that; if you want the specific analyst skill set and portfolio, fast and affordable, that's what Valuevade is for." },
  { q: 'How is Valuevade different from Valuation School?',
    a: "Valuation School runs popular cohort-based equity research training with a large student community. Both teach Indian-market equity research. The difference is format: Valuation School is cohort- and community-driven; Valuevade is self-paced software — auto-graded simulations on real Indian companies, a 24/7 AI tutor, scored mock interviews, ₹1,500 lifetime. Pick the format that matches how you actually study." },
  { q: 'How do I become an equity research analyst in India?',
    a: "The typical path: a finance-side degree (B.Com/BBA/MBA/CA — not mandatory but common), demonstrable skills in financial statement analysis, modelling and valuation, a credential or two (NISM Series XV is the SEBI-established research-analyst certification; CFA helps for buy-side), and — increasingly the differentiator — a portfolio of real work: an initiating-coverage report and a sector note you can hand a recruiter. Entry routes include sell-side research at brokerages, buy-side AM/PMS firms, and research KPOs. The Equity Research Analyst Program is built to cover the skills, the exam prep and the portfolio pieces of that path." },
];

import { effectiveMinutes, formatDuration } from '../utils/sessionTime';

// ── Video Preview Modal ──────────────────────────────────────────────────────
function VideoPreviewModal({ session, onClose }) {
  if (!session) return null;
  const url = session.lecture_url || '';
  const isYouTube = /youtu\.?be/.test(url);
  const ytId = isYouTube ? (url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1] || '') : '';

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="video-preview-modal"
    >
      <div
        className="bg-[var(--color-bg)] rounded-2xl overflow-hidden shadow-2xl w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-primary)] mb-0.5">Preview</p>
            <p className="text-sm font-semibold text-[var(--color-text)] font-bricolage">{session.title}</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors text-xl leading-none" data-testid="preview-modal-close">✕</button>
        </div>
        <div className="aspect-video bg-black relative">
          {isYouTube && ytId ? (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="w-full h-full border-0"
              title={session.title}
            />
          ) : url ? (
            <video src={url} controls autoPlay className="w-full h-full" />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">No video available</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
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
  const [previewSession, setPreviewSession] = useState(null); // video preview modal

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

      // 2. Modules with sessions — try full select (migration 0041), fall back
      //    to base columns if the DB hasn't been migrated yet.
      const _FULL_SEL = '*, master_sessions(id, title, description, order_index, estimated_minutes, video_duration_minutes, lecture_url, is_preview_session, is_free_session)';
      const _BASE_SEL = '*, master_sessions(id, title, description, order_index, estimated_minutes, lecture_url)';

      let { data: modulesData, error: modErr } = await supabase
        .from('master_modules')
        .select(_FULL_SEL)
        .eq('path_id', courseId)
        .order('order_index');

      if (modErr?.message?.includes('does not exist')) {
        // Migration 0041 not yet applied — retry with guaranteed base columns
        ({ data: modulesData, error: modErr } = await supabase
          .from('master_modules')
          .select(_BASE_SEL)
          .eq('path_id', courseId)
          .order('order_index'));
      }

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
    (sum, m) => sum + (m.master_sessions || []).reduce((s, sess) => s + effectiveMinutes(sess), 0),
    0
  );
  // Prefer dynamically calculated hours (from video_duration_minutes) over the
  // static estimated_hours field in the course row. Fall back to the static
  // value only while sessions are still loading (totalMinutes === 0).
  const totalHours = totalMinutes > 0
    ? Math.round(totalMinutes / 60)
    : (course?.estimated_hours || 0);

  // How many of those hours are pure video (to surface in the stats bar label)
  const allSessions = modules.flatMap((m) => m.master_sessions || []);
  const totalVideoMinutes = allSessions.reduce(
    (sum, s) => sum + (s.video_duration_minutes > 0 ? Math.round(Number(s.video_duration_minutes)) : 0),
    0
  );
  const videoHoursKnown = totalVideoMinutes > 0; // true once at least one session has duration set
  const freeSessions = allSessions.filter((s) => s.is_free_session);

  // Navigate to the proper enrollment page — a preview + confirm flow
  // (no AI customization / no instant enroll).
  const goCustomize = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/enroll/${courseId}`);
  };

  // Scroll guests down to the "Try Free" strip instead of forcing a login —
  // trying a free session never requires an account.
  const scrollToFreeTrials = () => {
    document.querySelector('[data-testid="free-sessions-strip"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isEnrolled = enrollment?.status === 'active';
  const isCompleted = enrollment?.status === 'completed';

  const whatYouLearn = course?.what_you_learn || [];
  const prerequisites = course?.prerequisites || [];
  const careerOutcomes = course?.career_outcomes || [];
  const skills = course?.skills || [];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
      <VideoPreviewModal session={previewSession} onClose={() => setPreviewSession(null)} />
      <Helmet>
        <title>Equity Research Analyst Course — Syllabus & Fees | Valuevade</title>
        <meta name="description" content="Equity Research Analyst Program syllabus: 21 modules, 239 sessions, DCF & comps on Indian companies, 3 capstone projects, certificate. ₹1,500 lifetime access." />
        <link rel="canonical" href={`https://valuevade.com/course/${courseId}`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://valuevade.com/course/${courseId}`} />
        <meta property="og:title" content="Equity Research Analyst Course — Syllabus & Fees | Valuevade" />
        <meta property="og:description" content="Equity Research Analyst Program syllabus: 21 modules, 239 sessions, DCF & comps on Indian companies, 3 capstone projects, certificate. ₹1,500 lifetime access." />
        <meta property="og:image" content="https://valuevade.com/valuevade-logo.png" />
        <meta property="og:site_name" content="Valuevade" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Equity Research Analyst Course — Syllabus & Fees | Valuevade" />
        <meta name="twitter:description" content="Equity Research Analyst Program syllabus: 21 modules, 239 sessions, DCF & comps on Indian companies, 3 capstone projects, certificate. ₹1,500 lifetime access." />
        <meta name="twitter:image" content="https://valuevade.com/valuevade-logo.png" />
        {/* JSON-LD (Prompt 4): Course + BreadcrumbList + FAQPage.
            NO aggregateRating, NO Review markup. FAQPage is generated from
            the SAME COURSE_DETAILS_FAQS array that renders the visible
            accordion below. */}
        <script type="application/ld+json">
          {JSON.stringify(buildCourseJsonLd(`https://valuevade.com/course/${courseId}`))}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(buildCourseBreadcrumbJsonLd(`https://valuevade.com/course/${courseId}`))}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(buildFaqPageJsonLd(COURSE_DETAILS_FAQS))}
        </script>
      </Helmet>
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
                  to="/signup"
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
        {/* Breadcrumb — Prompt 3 task 14 */}
        <nav
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] font-bricolage mb-6"
          aria-label="Breadcrumb"
          data-testid="detail-breadcrumb"
        >
          <Link to="/" className="hover:text-[var(--color-text)] transition-colors">Home</Link>
          <ChevronRight size={12} className="text-[var(--color-text-faint)]" />
          <Link to="/courses" className="hover:text-[var(--color-text)] transition-colors">Courses</Link>
          <ChevronRight size={12} className="text-[var(--color-text-faint)]" />
          <span className="text-[var(--color-text)]">Equity Research Analyst Program</span>
        </nav>

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
              {/* Hero section — Prompt 3 task 5: static verbatim copy
                  (no longer DB-driven). Preserves the halo dot animation
                  aesthetic. */}
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
                  text="Equity Research Analyst Program — Financial Modelling & Valuation Course"
                  className="font-clash text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text)] mb-4 tracking-tight relative"
                  testid="detail-title"
                />
                <motion.p
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage leading-relaxed mb-4 max-w-3xl"
                  data-testid="detail-description"
                >
                  The Equity Research Analyst Program is Valuevade&apos;s flagship online course for
                  Indian finance students and early-career switchers. Across 21 modules and 239
                  hands-on sessions (about 60 hours, including 42 hours of video lectures), you learn
                  accounting under Ind AS, financial statement and ratio analysis, three-statement
                  financial modelling, and valuation by DCF, comparable companies and SOTP — then
                  finish with three portfolio capstones: an initiating-coverage report, a sector
                  coverage note, and a working AI research copilot. Lifetime access costs ₹1,500
                  one-time, and your first session is free.
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="text-xs sm:text-sm text-[var(--color-text-faint)] font-bricolage italic mb-6 max-w-3xl"
                  data-testid="detail-audience-line"
                >
                  For B.Com/BBA/MBA students, CFA and FRM candidates, CA students moving toward markets
                  roles, and early-career professionals switching into equity research, IB, asset
                  management or Big 4 advisory.
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
                    {totalHours}h {videoHoursKnown && <span className="text-[10px] text-[var(--color-text-faint)] font-mono">video</span>}
                  </span>
                  <DifficultyBadge level={course.difficulty} />
                </div>

                {/* CTA — hero button is the payment/enroll CTA; a secondary
                    link scrolls guests to the free-trial strip below instead
                    of forcing a login (that used to be the "Start free
                    session" button's behaviour, which was misleading). */}
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
                  <>
                    <div className="flex flex-wrap items-center gap-4">
                      <BreathingGlow testid="detail-cta-glow">
                        <button
                          onClick={goCustomize}
                          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all shadow-[0_8px_30px_rgba(139,92,246,0.45)]"
                          data-testid="detail-customize-enroll"
                        >
                          Enrol Now — ₹1,500 <ArrowRight size={16} />
                        </button>
                      </BreathingGlow>
                      {freeSessions.length > 0 && (
                        <button
                          onClick={scrollToFreeTrials}
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-emerald-500/30 text-emerald-500 text-sm font-semibold font-bricolage hover:bg-emerald-500/10 transition-all"
                          data-testid="detail-start-free-session"
                        >
                          <PlayCircle size={16} /> Start a free session
                        </button>
                      )}
                    </div>
                    <p className="mt-3 text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--color-text-faint)]" data-testid="detail-hero-trust">
                      ₹1,500 lifetime · No subscription
                    </p>
                  </>
                )}
              </section>

              {/* Animated stats reveal — counts up on scroll-into-view */}
              <section className="mb-14" data-testid="detail-stats-reveal">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <AnimatedStat testid="detail-stat-modules"   value={modules.length || 0}  label="Modules"   icon={<Layers size={18} />} />
                  <AnimatedStat testid="detail-stat-sessions"  value={totalSessions || 0}   label="Sessions"  icon={<BookOpen size={18} />} />
                  <AnimatedStat testid="detail-stat-hours"     value={totalHours || 0}      label={videoHoursKnown ? 'Hours of Content' : 'Hours (est.)'}     icon={<Clock size={18} />} suffix="h" />
                  <AnimatedStat testid="detail-stat-capstones" value={3}                    label="Capstones" icon={<CheckCircle2 size={18} />} />
                </div>
              </section>

              {/* What you'll be able to do — Prompt 3 task 7 (verbatim). */}
              <section className="mb-12" data-testid="detail-what-you-learn">
                <h2 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)] mb-6">
                  What you&apos;ll be able to do
                </h2>
                <ul className="space-y-3">
                  {[
                    'Build a linked three-statement financial model with debt and depreciation schedules and sensitivity tables',
                    'Complete a DCF valuation of an NSE-listed company and defend your WACC and terminal-value assumptions',
                    'Run a comparable-companies analysis: pick a peer set, normalise the numbers, and triangulate a value range',
                    'Perform ratio and DuPont analysis on real Indian financials, including banks',
                    'Spot forensic red flags in annual reports and SEBI filings',
                    'Write a full initiating-coverage report and a sector coverage note to sell-side conventions',
                    'Clear a multi-round mock interview with scored feedback on technicals, communication and structure',
                    'Build and ship a working AI research copilot as a portfolio project',
                  ].map((line, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]"
                      data-testid={`learn-item-${idx}`}
                    >
                      <CheckCircle2 size={18} className="text-[var(--color-success)] shrink-0 mt-0.5" />
                      <span className="text-sm text-[var(--color-text)] font-bricolage leading-relaxed">{line}</span>
                    </li>
                  ))}
                </ul>
              </section>

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

              {/* Full syllabus — module by module (Prompt 3 task 6).
                  Data-driven from master_modules; capstones appended below
                  the accordion as named deliverables. */}
              {modules.length > 0 && (
                <section className="mb-12" data-testid="detail-modules-section">
                  {/* ─── Free Trial Strip ─────────────────────────────────────── */}
                  {freeSessions.length > 0 && !isEnrolled && !isCompleted && (
                    <div
                      className="mb-6 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] to-transparent p-5"
                      data-testid="free-sessions-strip"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-500">Try Free — No Account Needed</span>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] mb-4 font-bricolage">
                        Experience {freeSessions.length === 1 ? 'a full session' : `${freeSessions.length} full sessions`} — video, notes, quiz and simulation — before committing. No sign-up required.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {freeSessions.map((s) => (
                          <a
                            key={s.id}
                            href={`/try-free/${s.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold font-bricolage hover:bg-emerald-400 transition-colors shadow-[0_0_18px_rgba(16,185,129,0.3)]"
                            data-testid={`try-free-btn-${s.id}`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            Try: {s.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* The full syllabus — module by module */}
                  <h2 className="text-base font-semibold font-bricolage text-[var(--color-text)] mb-4">
                    The full syllabus — module by module
                  </h2>
                  <Accordion type="single" collapsible defaultValue="module-0" className="space-y-3">
                    {modules.map((mod, idx) => {
                      const sessions = mod.master_sessions || [];
                      const modMinutes = sessions.reduce((s, sess) => s + effectiveMinutes(sess), 0);
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
                                  {/* Preview play button */}
                                  {sess.is_preview_session && sess.lecture_url ? (
                                    <button
                                      onClick={() => setPreviewSession(sess)}
                                      className="w-6 h-6 rounded-full flex items-center justify-center bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/25 transition-all flex-shrink-0"
                                      title="Preview this lecture"
                                      data-testid={`preview-btn-${sess.id}`}
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                    </button>
                                  ) : (
                                    <ChevronRight size={14} className="text-[var(--color-text-muted)] shrink-0" />
                                  )}
                                  <span className="text-sm text-[var(--color-text)] font-bricolage flex-1 min-w-0">
                                    {sess.title}
                                  </span>
                                  {/* FREE badge */}
                                  {sess.is_free_session && (
                                    <a
                                      href={`/try-free/${sess.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/25 transition-all flex-shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                      data-testid={`free-badge-${sess.id}`}
                                    >
                                      Free
                                    </a>
                                  )}
                                  {/* Preview badge */}
                                  {sess.is_preview_session && (
                                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] flex-shrink-0">
                                      Preview
                                    </span>
                                  )}
                                  <span className="text-xs text-[var(--color-text-muted)] font-mono shrink-0">
                                    {formatDuration(effectiveMinutes(sess))}
                                  </span>
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

                  {/* Capstone deliverables at the end of the syllabus list — Prompt 3 task 6. */}
                  <div
                    className="mt-6 rounded-2xl border border-[var(--color-accent-purple)]/20 bg-[var(--color-accent-purple)]/[0.05] p-5 space-y-4"
                    data-testid="detail-capstones-inline"
                  >
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-accent-purple)] mb-1">
                      Capstone deliverables (after all modules)
                    </p>
                    {[
                      { n: 1, t: 'Capstone 1: Full initiating-coverage report on a listed Indian company' },
                      { n: 2, t: 'Capstone 2: Sector coverage note' },
                      { n: 3, t: 'Capstone 3: Build a working AI equity research copilot' },
                    ].map((c) => (
                      <div key={c.n} className="flex items-start gap-3" data-testid={`inline-capstone-${c.n}`}>
                        <span className="w-7 h-7 rounded-lg bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 flex items-center justify-center text-xs font-mono text-[var(--color-accent-purple)] shrink-0">
                          C{c.n}
                        </span>
                        <span className="text-sm text-[var(--color-text)] font-bricolage leading-relaxed">
                          {c.t}
                        </span>
                      </div>
                    ))}
                  </div>
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

        {/* All the below-fold sections — Prompt 3 tasks 8–13.
            Order: how it works → certificate & standards → who built this
            → capstone showcase → FAQ → deep comparison → closing CTA. */}

        {/* Task 8 — How the course works (verbatim) */}
        {!loading && !error && course && (
          <section className="mt-20 mb-16" data-testid="detail-how-it-works">
            <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-5">
              How the course works
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage leading-relaxed max-w-3xl">
              Every session follows the same loop: interactive notes → adaptive quiz → hands-on
              simulation, with Pari available in context at every step. Simulations come in three
              formats — interactive Excel (formulas, drag-fill, VLOOKUP, multi-sheet; auto-graded),
              branch-based decision scenarios, and applied reading with quizzes. The Study Planner
              takes your deadline or daily-hours budget and schedules all 239 sessions; progress,
              streaks, XP and doubt history persist if you pause. Excel simulations are
              desktop/laptop-only.
            </p>
          </section>
        )}

        {/* Task 9 — Certificate & external standards */}
        {!loading && !error && course && (
          <section className="mb-16" data-testid="detail-cert-standards">
            <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-6">
              Certificate & external standards
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  title: 'Valuevade Certificate of Completion',
                  body: "A PDF issued in your full name with the completion date and a unique certificate ID, the moment you finish all three capstones. Formatted for LinkedIn's Licenses & Certifications field.",
                  icon: Award, tone: 'primary',
                },
                {
                  title: 'NISM Series XV (Research Analyst)',
                  body: 'The curriculum maps to the exam syllabus so you can sit the SEBI-established NISM exam with confidence. Valuevade prepares you for it; the NISM certificate itself is earned by passing NISM\'s exam.',
                  icon: GraduationCap, tone: 'accent-purple',
                },
              ].map((c, i) => {
                const Icon = c.icon;
                return (
                  <div
                    key={i}
                    className="glass-card rounded-2xl p-5"
                    data-testid={`cert-block-${i}`}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-[var(--color-${c.tone})]/10 border border-[var(--color-${c.tone})]/25 flex items-center justify-center mb-4`}>
                      <Icon size={18} className={`text-[var(--color-${c.tone})]`} />
                    </div>
                    <h3 className="font-clash text-sm font-bold text-[var(--color-text)] mb-2">{c.title}</h3>
                    <p className="text-xs text-[var(--color-text-muted)] font-bricolage leading-relaxed">{c.body}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Task 10 — Who built this. Reuses the homepage component (same 3 paragraphs). */}
        {!loading && !error && course && <WhoBuiltThisSection />}

        {/* Task 11 — Capstone showcase. Replaces the previous data-driven
            "Your Capstone Projects" grid with the 3 fixed deliverable cards.
            Sample excerpts intentionally omitted per Prompt 3 (HTML TODO). */}
        {!loading && !error && course && (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mb-16"
            data-testid="detail-capstone-showcase"
          >
            <div className="mb-8">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-accent-purple)] mb-2">
                Final Track Output
              </div>
              <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)]" data-testid="detail-capstone-showcase-heading">
                What you&apos;ll walk away with
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { n: 1, title: 'Initiating-Coverage Report',
                  body: 'Company analysis, three-statement model, DCF and comps valuation, and a full recommendation write-up on a listed Indian company.',
                  img: '/capstones/c1-initiating-coverage.png',
                  alt: 'Sample page from a Valuevade student initiating-coverage report on an Indian large-cap' },
                { n: 2, title: 'Sector Coverage Note',
                  body: 'Industry structure, comparables set, and a house coverage view — written to sell-side conventions.',
                  img: '/capstones/c2-sector-note.png',
                  alt: 'Sample page from a Valuevade student sector coverage note showing a comparables table for Indian private-sector banks' },
                { n: 3, title: 'AI Research Copilot',
                  body: 'A working research tool you built end-to-end — the portfolio artefact that demonstrates you can deploy AI, not compete with it.',
                  img: '/capstones/c3-ai-copilot.png',
                  alt: 'Sample screenshot of a Valuevade student-built AI equity research copilot web app' },
              ].map((c) => (
                <div
                  key={c.n}
                  className="glass-card rounded-2xl p-5 overflow-hidden"
                  data-testid={`showcase-card-${c.n}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 flex items-center justify-center mb-4 text-xs font-mono text-[var(--color-accent-purple)]">
                    C{c.n}
                  </div>
                  <h3 className="font-clash text-sm font-bold text-[var(--color-text)] mb-2">{c.title}</h3>
                  <p className="text-xs text-[var(--color-text-muted)] font-bricolage leading-relaxed mb-4">{c.body}</p>
                  {/* Sample preview — generated mockup, labelled as such. */}
                  <div
                    className="rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-hover)]"
                    data-testid={`showcase-preview-${c.n}`}
                  >
                    <img
                      src={c.img}
                      alt={c.alt}
                      loading="lazy"
                      className="w-full h-auto block"
                      style={{ aspectRatio: '4 / 3', objectFit: 'cover', objectPosition: 'top' }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-text-faint)]">
                    Sample preview — student capstone
                  </p>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Task 12 — Course-page FAQ (13 Qs verbatim, in prescribed order). */}
        {!loading && !error && course && (
          <section id="course-faq" className="mb-16" data-testid="detail-course-faq">
            <div className="mb-6">
              <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-2">
                Frequently asked questions
              </h2>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-faint)]" data-testid="detail-faq-last-updated">
                Last updated: 25 August 2026
              </p>
            </div>
            <Accordion type="single" collapsible className="space-y-2">
              {COURSE_DETAILS_FAQS.map((f, i) => (
                <AccordionItem
                  key={i}
                  value={`course-faq-${i}`}
                  className="glass-card rounded-xl border-[var(--color-border)] overflow-hidden"
                  data-testid={`detail-faq-item-${i}`}
                >
                  <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-[var(--color-surface-hover)] transition-colors text-left text-sm font-semibold text-[var(--color-text)] font-bricolage">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-4 text-sm text-[var(--color-text-muted)] font-bricolage leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {/* Task 13 — Deep comparison table. Competitor pricing verified from
            each provider's public listing (see footnote for verification date). */}
        {!loading && !error && course && (
          <section className="mb-16 overflow-x-auto" data-testid="detail-deep-compare">
            <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-6">
              How Valuevade compares
            </h2>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <table className="w-full text-sm" data-testid="detail-compare-table">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
                    <th className="text-left px-4 py-3 font-clash text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Feature</th>
                    <th className="text-left px-4 py-3 font-clash text-xs uppercase tracking-wider text-[var(--color-primary)]">Valuevade</th>
                    <th className="text-left px-4 py-3 font-clash text-xs uppercase tracking-wider text-[var(--color-text-muted)]">WallStreet School</th>
                    <th className="text-left px-4 py-3 font-clash text-xs uppercase tracking-wider text-[var(--color-text-muted)]">IFMC</th>
                    <th className="text-left px-4 py-3 font-clash text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Coursera</th>
                    <th className="text-left px-4 py-3 font-clash text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Imarticus / Upgrad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {[
                    ['Format', 'Self-paced software', 'Instructor-led cohort', 'Instructor-led + online', 'Self-paced video (subscription)', 'Instructor-led cohort'],
                    ['Modules', '21', 'Not published', 'Varies by course', 'Varies by course', 'Varies by program'],
                    ['Sessions & simulations', '239 hands-on sessions, one simulation per session', 'Live classroom hours', 'Live + recorded lectures', 'Recorded video lectures', 'Live + recorded lectures'],
                    ['Capstone deliverables', '3 (initiating-coverage report, sector note, AI research copilot)', 'Live projects', 'Projects included', 'Peer-graded projects', 'Capstone included'],
                    ['Mock interviews', 'AI, multi-round, scored feedback', 'Interview-prep sessions', 'Placement-assist mocks', 'Not typically included', 'Interview prep + placement support'],
                    ['NISM Series XV prep', 'Included, mapped to syllabus', 'Not focused on NISM XV', 'Offered as a separate course', 'Not covered', 'Covered in select tracks'],
                    ['24/7 AI tutor', 'Included (Pari, context-aware)', 'Not offered', 'Not offered', 'Not offered', 'Not offered'],
                    ['Price', '₹1,500 one-time', '₹45,000+', '₹10,000 – ₹35,000+', '₹4,000 – ₹7,000 / month', '₹1,00,000+'],
                    ['Access', 'Lifetime', 'Cohort duration', 'Course duration', 'Subscription-based', 'Cohort / program duration'],
                  ].map(([feat, vv, wss, ifmc, coursera, imarticus], i) => (
                    <tr key={i} data-testid={`compare-row-${i}`}>
                      <td className="px-4 py-3 text-[var(--color-text)] font-bricolage">{feat}</td>
                      <td className="px-4 py-3 text-[var(--color-text)] font-bricolage">{vv}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] font-bricolage">{wss}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] font-bricolage">{ifmc}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] font-bricolage">{coursera}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] font-bricolage">{imarticus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-4 py-3 text-xs text-[var(--color-text-faint)] font-bricolage border-t border-[var(--color-border)]">
                Competitor figures are directional, sourced from each provider&apos;s publicly
                listed programs and reviewed periodically. Please check the provider&apos;s
                site for the latest published fees before making a decision.
              </p>
            </div>
          </section>
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

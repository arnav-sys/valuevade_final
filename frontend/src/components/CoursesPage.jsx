import { useState, useEffect, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LogOut, BookOpen, Layers, Clock, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Sun, Moon, Sparkles, Award, Trophy, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Skeleton } from '../components/ui/skeleton';
import {
  MagneticCard, LetterStaggerHeadline, AnimatedStat, BreathingGlow, ScrollProgressBar,
} from './cinematic/primitives';

// Lazy three.js bg so the cards paint first.
const CinematicBackground = lazy(() => import('./CinematicBackground'));

function CourseCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8 animate-pulse" data-testid="course-card-skeleton">
      <Skeleton className="h-5 w-24 mb-4 bg-[var(--color-surface)]" />
      <Skeleton className="h-8 w-3/4 mb-3 bg-[var(--color-surface)]" />
      <Skeleton className="h-4 w-full mb-2 bg-[var(--color-surface)]" />
      <Skeleton className="h-4 w-full mb-2 bg-[var(--color-surface)]" />
      <Skeleton className="h-4 w-2/3 mb-6 bg-[var(--color-surface)]" />
      <div className="flex gap-4 mb-6">
        <Skeleton className="h-4 w-20 bg-[var(--color-surface)]" />
        <Skeleton className="h-4 w-20 bg-[var(--color-surface)]" />
        <Skeleton className="h-4 w-20 bg-[var(--color-surface)]" />
        <Skeleton className="h-6 w-16 rounded-full bg-[var(--color-surface)]" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl bg-[var(--color-surface)]" />
    </div>
  );
}

function DifficultyBadge({ level }) {
  const config = {
    beginner: { label: 'Beginner', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    intermediate: { label: 'Intermediate', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    advanced: { label: 'Advanced', cls: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  };
  const c = config[level?.toLowerCase()] || config.beginner;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border ${c.cls}`} data-testid="difficulty-badge">
      {c.label}
    </span>
  );
}

function CourseCard({ course, enrollment, moduleCount, sessionCount }) {
  const navigate = useNavigate();
  const desc = course.description || '';
  const [expanded, setExpanded] = useState(false);
  const truncated = desc.length > 180;

  const isEnrolled = enrollment?.status === 'active';
  const isCompleted = enrollment?.status === 'completed';

  const handleCTA = () => {
    if (isCompleted) return;
    if (isEnrolled) { navigate('/dashboard'); } else { navigate(`/course/${course.id}`); }
  };

  return (
    <MagneticCard
      className="glass-card rounded-2xl overflow-hidden transition-all duration-300 hover:border-[var(--color-accent-purple)]/30 hover:shadow-[0_8px_40px_var(--glass-hover-shadow)] group relative"
      testid={`course-card-${course.id}`}
    >
      {/* Diagonal sheen (very slow loop) — premium signal on any active course. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        <div
          aria-hidden="true"
          className="course-card-sheen"
        />
      </div>
      {/* Gradient accent bar at top */}
      <div className="h-1 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)]" />

      <div className="p-6 sm:p-8">
        {/* Header with icon */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-primary)]/15 to-[var(--color-accent-purple)]/15 border border-[var(--color-primary)]/20 flex items-center justify-center shrink-0">
              <Sparkles size={22} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent-purple)] mb-1 block" data-testid="course-card-label">
                Career Path
              </span>
              <h3 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)]" data-testid="course-card-title">
                {course.title}
              </h3>
            </div>
          </div>
          {isCompleted && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20 shrink-0" data-testid="course-completed-badge">
              <CheckCircle2 size={14} /> Completed
            </span>
          )}
        </div>

        {/* Description */}
        <div className="mb-5">
          <p className={`text-sm text-[var(--color-text-muted)] font-bricolage leading-relaxed ${!expanded && truncated ? 'line-clamp-3' : ''}`} data-testid="course-card-description">
            {desc}
          </p>
          {truncated && (
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-[var(--color-primary)] hover:underline mt-1.5 font-bricolage font-medium" data-testid="course-read-more">
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>

        {/* Stats row with pill design */}
        <div className="flex flex-wrap items-center gap-2 mb-6" data-testid="course-stats-row">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--color-primary)]/8 text-[var(--color-primary)] border border-[var(--color-primary)]/10">
            <Layers size={13} /> {moduleCount} module{moduleCount !== 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--color-accent-purple)]/8 text-[var(--color-accent-purple)] border border-[var(--color-accent-purple)]/10">
            <BookOpen size={13} /> {sessionCount} session{sessionCount !== 1 ? 's' : ''}
          </span>
          {course.estimated_hours && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--color-accent-pink)]/8 text-[var(--color-accent-pink)] border border-[var(--color-accent-pink)]/10">
              <Clock size={13} /> {course.estimated_hours}h
            </span>
          )}
          <DifficultyBadge level={course.difficulty} />
        </div>

        {/* CTA */}
        <button
          onClick={handleCTA}
          disabled={isCompleted}
          className={`w-full py-3.5 rounded-xl font-semibold font-bricolage text-sm flex items-center justify-center gap-2 transition-all ${
            isCompleted
              ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] cursor-default border border-[var(--color-success)]/20'
              : isEnrolled
              ? 'bg-[var(--color-accent-purple)] text-white hover:shadow-[0_0_24px_rgba(106,92,255,0.4)]'
              : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110'
          }`}
          data-testid="course-cta-button"
        >
          {isCompleted ? (
            <><CheckCircle2 size={16} /> Completed</>
          ) : isEnrolled ? (
            <>Continue Learning <ArrowRight size={16} /></>
          ) : (
            <>View Details <ArrowRight size={16} /></>
          )}
        </button>
      </div>
    </MagneticCard>
  );
}

export default function CoursesPage() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [moduleCounts, setModuleCounts] = useState({});
  const [sessionCounts, setSessionCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    // Wrap each query with a hard timeout so a single hanging fetch can never
    // strand the page on a skeleton. Uses Promise.allSettled so a failure on
    // secondary counts (modules/sessions/enrollments) does NOT block the
    // primary catalog (master_paths) from rendering.
    const withTimeout = (p, ms, fallback) =>
      Promise.race([
        Promise.resolve(p),
        new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
      ]);

    try {
      const [pathsRes, enrollRes, modulesRes, sessionsRes] = await Promise.allSettled([
        withTimeout(supabase.from('master_paths').select('*').eq('is_active', true), 10000, { data: null, error: { message: 'timeout' } }),
        user?.id
          ? withTimeout(supabase.from('user_enrollments').select('id, master_path_id, status').eq('user_id', user.id), 10000, { data: [] })
          : Promise.resolve({ data: [] }),
        withTimeout(supabase.from('master_modules').select('id, path_id'), 10000, { data: [] }),
        withTimeout(supabase.from('master_sessions').select('id, module_id'), 10000, { data: [] }),
      ]);

      // Unwrap allSettled result → the inner Supabase response object
      const paths = pathsRes.status === 'fulfilled' ? pathsRes.value : { data: null, error: { message: 'catalog fetch failed' } };
      const enroll = enrollRes.status === 'fulfilled' ? enrollRes.value : { data: [] };
      const modules = modulesRes.status === 'fulfilled' ? modulesRes.value : { data: [] };
      const sessions = sessionsRes.status === 'fulfilled' ? sessionsRes.value : { data: [] };

      // Primary requirement: the catalog itself. Only THIS is fatal.
      if (paths.error || !paths.data) {
        throw new Error(paths.error?.message || 'Failed to load courses');
      }
      setCourses(paths.data);
      setEnrollments(enroll.data || []);

      const mods = modules.data || [];
      const mCounts = {};
      mods.forEach((m) => { mCounts[m.path_id] = (mCounts[m.path_id] || 0) + 1; });
      setModuleCounts(mCounts);

      const moduleToPath = {};
      mods.forEach((m) => { moduleToPath[m.id] = m.path_id; });
      const sCounts = {};
      (sessions.data || []).forEach((s) => {
        const pathId = moduleToPath[s.module_id];
        if (pathId) sCounts[pathId] = (sCounts[pathId] || 0) + 1;
      });
      setSessionCounts(sCounts);
    } catch (err) {
      setError(err.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const getEnrollment = (courseId) => enrollments.find((e) => e.master_path_id === courseId);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
      <Helmet>
        {/* Prompt-2/3 will replace the copy; here we only fix the per-route
            head so /courses no longer canonicalizes to the homepage. */}
        <title>Finance Courses — Equity Research Analyst Program | Valuevade</title>
        <meta name="description" content="Valuevade's finance courses for Indian students. Start with the Equity Research Analyst Program — 21 modules, 239 sessions, ₹999 lifetime." />
        <link rel="canonical" href="https://valuevade.com/courses" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://valuevade.com/courses" />
        <meta property="og:title" content="Finance Courses — Equity Research Analyst Program | Valuevade" />
        <meta property="og:description" content="Valuevade's finance courses for Indian students. Start with the Equity Research Analyst Program — 21 modules, 239 sessions, ₹999 lifetime." />
        <meta property="og:image" content="https://valuevade.com/valuevade-logo.png" />
        <meta property="og:site_name" content="Valuevade" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Finance Courses — Equity Research Analyst Program | Valuevade" />
        <meta name="twitter:description" content="Valuevade's finance courses for Indian students. Start with the Equity Research Analyst Program — 21 modules, 239 sessions, ₹999 lifetime." />
        <meta name="twitter:image" content="https://valuevade.com/valuevade-logo.png" />
      </Helmet>
      {/* Cinematic Three.js bg — only renders meaningfully in dark mode; in
          light mode the ambient orbs already carry the cream aesthetic. */}
      {theme === 'dark' && (
        <Suspense fallback={null}>
          <div className="fixed inset-0 z-0 pointer-events-none" data-testid="courses-cinematic-bg-wrap">
            <CinematicBackground density="sparse" />
          </div>
        </Suspense>
      )}
      {/* Ambient orbs */}
      <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[10%] w-[400px] h-[400px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--color-border)]" data-testid="courses-header">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="courses-logo">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8" />
            <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all" data-testid="courses-theme-toggle" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <>
                {profile && (
                  <span className="text-sm text-[var(--color-text-muted)] font-bricolage hidden sm:block" data-testid="courses-user-name">
                    {profile.full_name}
                  </span>
                )}
                <Link
                  to="/dashboard"
                  className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors font-bricolage hidden sm:inline-block"
                  data-testid="courses-dashboard-link"
                >
                  Dashboard
                </Link>
                <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all font-bricolage" data-testid="courses-signout-button">
                  <LogOut size={16} /> Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-5 py-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-full hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all font-bricolage"
                data-testid="courses-login-cta"
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-12 sm:py-16 relative z-10">
        {/* Cinematic hero — letter-stagger headline + halo dots ring */}
        <div className="text-center mb-14 sm:mb-16 relative" data-testid="courses-hero">
          {/* Slow-rotating ring of constellation dots behind the title */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] sm:w-[560px] sm:h-[560px] opacity-50"
            style={{ animation: 'courses-halo-rotate 38s linear infinite' }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {Array.from({ length: 22 }).map((_, i) => {
                const a = (i / 22) * Math.PI * 2;
                const r = 88;
                const cx = 100 + Math.cos(a) * r;
                const cy = 100 + Math.sin(a) * r;
                const sz = 0.9 + (i % 3) * 0.4;
                return <circle key={i} cx={cx} cy={cy} r={sz} fill="#a78bfa" opacity={0.55} />;
              })}
              {/* Thin ring */}
              <circle cx="100" cy="100" r="88" fill="none" stroke="#8b5cf6" strokeOpacity="0.18" strokeWidth="0.4" strokeDasharray="1 4" />
            </svg>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/15 text-[var(--color-accent-purple)] text-xs font-mono mb-5 relative"
          >
            <Sparkles size={14} /> AI-Powered Learning
          </motion.div>
          <div className="relative">
            <LetterStaggerHeadline
              text="Choose Your Career Path"
              className="font-clash text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--color-text)] mb-4 tracking-tight"
              testid="courses-heading"
            />
          </div>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage max-w-lg mx-auto relative"
            data-testid="courses-subtitle"
          >
            AI-personalized learning paths built for finance careers
          </motion.p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="courses-loading">
            <CourseCardSkeleton />
            <CourseCardSkeleton />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center text-center py-16" data-testid="courses-error">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
              <AlertCircle size={28} className="text-[var(--color-error)]" />
            </div>
            <p className="text-[var(--color-text)] font-bricolage mb-2">Something went wrong</p>
            <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
            <button onClick={fetchData} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all" data-testid="courses-retry-button">
              <RefreshCw size={16} /> Try Again
            </button>
          </div>
        )}

        {/* Course grid */}
        {!loading && !error && courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7" data-testid="courses-grid" style={{ perspective: '1200px' }}>
            {courses.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <CourseCard
                  course={course}
                  enrollment={getEnrollment(course.id)}
                  moduleCount={moduleCounts[course.id] || 0}
                  sessionCount={sessionCounts[course.id] || 0}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Stats strip — real DB-derived values. Fallbacks reflect the
            canonical curriculum (21 modules · 239 sessions · 3 capstones).
            The "Practice Questions" counter was a made-up 260 with no data
            source, so it's REMOVED per Prompt-1 rule ("no truthful value → remove"). */}
        {!loading && !error && courses.length > 0 && (
          <section className="mt-16 sm:mt-20" data-testid="courses-stats-strip">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <AnimatedStat
                testid="stat-modules"
                value={Object.values(moduleCounts).reduce((a, b) => a + b, 0) || 21}
                label="Modules"
                icon={<Layers size={18} />}
              />
              <AnimatedStat
                testid="stat-sessions"
                value={Object.values(sessionCounts).reduce((a, b) => a + b, 0) || 239}
                label="Sessions"
                icon={<BookOpen size={18} />}
              />
              <AnimatedStat
                testid="stat-capstones"
                value={3}
                label="Capstone Projects"
                icon={<Award size={18} />}
              />
            </div>
          </section>
        )}

        {/* Closing CTA band — Prompt-3 removed the duplicate "Choose Your
            Career Path" H2 that was echoing the hero title. The band now
            leads with the "Career Outcomes" eyebrow and a fresh sub-headline
            focused on the CTA action. */}
        {!loading && !error && courses.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-16 sm:mt-20 mb-4 relative"
            data-testid="courses-closing-cta"
          >
            <div className="relative rounded-3xl border border-[var(--color-accent-purple)]/25 bg-gradient-to-br from-[var(--color-accent-purple)]/[0.08] via-transparent to-[var(--color-primary)]/[0.06] backdrop-blur-xl px-6 sm:px-10 py-10 sm:py-14 text-center overflow-hidden">
              <div aria-hidden="true" className="absolute -top-32 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.10] blur-[100px] pointer-events-none" />
              <div className="relative">
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-accent-purple)] mb-3">
                  <Trophy size={12} className="inline -translate-y-0.5 mr-1" /> Career Outcomes
                </div>
                <p className="text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage max-w-md mx-auto mb-7">
                  AI-personalized learning paths built for finance careers
                </p>
                <BreathingGlow testid="courses-closing-glow">
                  <button
                    onClick={() => {
                      const grid = document.querySelector('[data-testid="courses-grid"]');
                      if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all shadow-[0_8px_30px_rgba(139,92,246,0.45)]"
                    data-testid="courses-closing-cta-button"
                  >
                    <Sparkles size={16} /> View Details <ArrowRight size={16} />
                  </button>
                </BreathingGlow>
              </div>
            </div>
          </motion.section>
        )}

        {/* Coming soon */}
        {!loading && !error && (
          <div className="mt-12 text-center" data-testid="courses-coming-soon">
            <div className="glass-card rounded-2xl px-8 py-6 inline-flex flex-col sm:flex-row items-center gap-4">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)] animate-pulse shrink-0" />
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage">
                More career paths coming soon. We're building <span className="text-[var(--color-text)] font-medium">Investment Banking</span>, <span className="text-[var(--color-text)] font-medium">Private Equity</span>, and more.
              </p>
            </div>
          </div>
        )}
      </main>
      <style>{`
        @keyframes courses-halo-rotate { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
        .course-card-sheen {
          position: absolute;
          top: 0; left: -60%;
          width: 50%; height: 100%;
          background: linear-gradient(110deg, transparent 0%, rgba(196,181,253,0.10) 45%, rgba(255,255,255,0.18) 50%, rgba(196,181,253,0.10) 55%, transparent 100%);
          transform: skewX(-18deg);
          animation: course-card-sheen-anim 6.5s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes course-card-sheen-anim {
          0%   { left: -60%; opacity: 0; }
          18%  { opacity: 0.85; }
          55%  { left: 110%; opacity: 0.85; }
          70%  { left: 110%; opacity: 0; }
          100% { left: -60%; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .course-card-sheen { animation: none; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

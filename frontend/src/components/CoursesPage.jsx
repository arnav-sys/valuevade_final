import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LogOut, BookOpen, Layers, Clock, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Sun, Moon, Award, Trophy, ChevronLeft, ChevronRight, Lock, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Skeleton } from '../components/ui/skeleton';
import { BrandArtwork } from './brand/BrandArtwork';
import { AnimatedStat, BreathingGlow } from './cinematic/primitives';

const API = process.env.REACT_APP_BACKEND_URL;

// Fallback cover photos, used until an admin uploads a real one from the
// Admin > Courses tab (course.image_url wins whenever it's set).
const FALLBACK_IMAGE_BY_CATEGORY = {
  'Equity Research': '/brand/er-certs-art.webp',
  'Investment Banking': '/brand/career-art.webp',
  'Private Equity': '/brand/certs-art.webp',
  'Financial Modelling': '/brand/claude-art.webp',
  'Portfolio Management': '/brand/roadmap-art.webp',
  'Wealth Management': '/brand/certs-art.webp',
};
const DEFAULT_FALLBACK_IMAGE = FALLBACK_IMAGE_BY_CATEGORY['Equity Research'];

function CourseCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" data-testid="course-card-skeleton">
      <Skeleton className="h-44 w-full bg-[var(--color-border)] rounded-none" />
      <div className="p-5">
        <Skeleton className="h-4 w-20 mb-3 bg-[var(--color-border)]" />
        <Skeleton className="h-6 w-full mb-3 bg-[var(--color-border)]" />
        <Skeleton className="h-4 w-2/3 mb-4 bg-[var(--color-border)]" />
        <Skeleton className="h-4 w-full bg-[var(--color-border)]" />
      </div>
    </div>
  );
}

const DIFFICULTY_STYLES = {
  beginner: 'bg-[var(--color-success)] text-white',
  intermediate: 'bg-[var(--color-primary)] text-white',
  advanced: 'bg-[var(--color-accent-pink)] text-white',
};

function DifficultyBadge({ level, courseId }) {
  const key = level?.toLowerCase() || 'beginner';
  const cls = DIFFICULTY_STYLES[key] || DIFFICULTY_STYLES.beginner;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bricolage font-semibold uppercase shadow-sm whitespace-nowrap tracking-normal ${cls}`} data-testid={`difficulty-badge-${courseId}`}>
      {key.charAt(0).toUpperCase() + key.slice(1)}
    </span>
  );
}

function CourseCard({ course, enrollment, moduleCount, sessionCount, isMock }) {
  const navigate = useNavigate();
  const isEnrolled = enrollment?.status === 'active';
  const isCompleted = enrollment?.status === 'completed';
  // Keep genuine admin uploads; retire stock placeholders in favor of the brand artwork.
  const customPhoto = course.image_url && !/images\.(unsplash|pexels)\.com/.test(course.image_url);
  const photo = customPhoto ? course.image_url : FALLBACK_IMAGE_BY_CATEGORY[course.category] || DEFAULT_FALLBACK_IMAGE;

  const handleCTA = () => {
    if (isMock || isCompleted) return;
    if (isEnrolled) { navigate('/dashboard'); } else { navigate(`/course/${course.id}`); }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(36,107,253,0.14)] group"
      data-testid={`course-card-${course.id}`}
    >
      {/* Cover photo (admin-editable from Admin > Courses tab) */}
      <div className={`relative h-44 overflow-hidden ${customPhoto ? '' : 'vv-course-art'}`} data-testid={`course-card-preview-${course.id}`}>
        <img
          src={photo}
          alt={course.title}
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isMock ? 'grayscale-[35%]' : ''}`}
          data-testid={`course-card-image-${course.id}`}
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_FALLBACK_IMAGE; }}
        />
        <div className="absolute top-3 left-3">
          <DifficultyBadge level={course.difficulty} courseId={course.id} />
        </div>
        <div className="absolute top-3 right-3">
          {isMock ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bricolage font-semibold uppercase tracking-wide bg-[var(--color-accent-purple)] text-white shadow-sm" data-testid={`course-card-status-${course.id}`}>
              <Lock size={10} /> Coming Soon
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bricolage font-semibold uppercase tracking-wide bg-white text-[var(--color-primary)] shadow-sm" data-testid={`course-card-status-${course.id}`}>
              <Sparkles size={10} /> Live Now
            </span>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {/* Price / status row */}
        <div className="flex items-center justify-between mb-3">
          <span className="font-clash text-lg font-semibold text-[var(--color-primary)]" data-testid={`course-card-price-${course.id}`}>
            {isMock ? 'Coming Soon' : '\u20b94,999'}
          </span>
          {!isMock && <span className="text-[11px] font-bricolage text-[var(--color-text-faint)]">Lifetime access</span>}
        </div>

        {/* Title */}
        <h3 className="font-clash text-lg sm:text-xl font-semibold text-[var(--color-text)] mb-3 leading-snug line-clamp-2" data-testid={`course-card-title-${course.id}`}>
          {course.title}
        </h3>

        {/* Meta row */}
        {isMock ? (
          <p className="text-xs font-bricolage italic text-[var(--color-text-faint)] mb-4" data-testid={`course-card-meta-${course.id}`}>
            Launching soon &mdash; join the waitlist from your dashboard.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-xs font-jetbrains text-[var(--color-text-muted)] mb-4" data-testid={`course-card-meta-${course.id}`}>
            {course.estimated_hours && (
              <span className="inline-flex items-center gap-1.5" data-testid={`course-card-hours-${course.id}`}><Clock size={13} /> 100+ hrs</span>
            )}
            <span className="inline-flex items-center gap-1.5"><Layers size={13} /> {moduleCount} modules</span>
            <span className="inline-flex items-center gap-1.5"><BookOpen size={13} /> {sessionCount} sessions</span>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
          <span className="text-[10px] font-jetbrains uppercase tracking-[0.16em] text-[var(--color-text-faint)]" data-testid={`course-card-category-${course.id}`}>
            {course.category || 'Equity Research'}
          </span>
          {isMock ? (
            <button disabled className="inline-flex items-center gap-1 text-xs font-bricolage font-semibold text-[var(--color-text-faint)] cursor-not-allowed" data-testid={`course-card-cta-${course.id}`}>
              Notify Me
            </button>
          ) : isCompleted ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bricolage font-semibold text-[var(--color-success)]" data-testid={`course-card-cta-${course.id}`}>
              <CheckCircle2 size={14} /> Completed
            </span>
          ) : (
            <button onClick={handleCTA} className="inline-flex items-center gap-1 text-xs font-bricolage font-semibold text-[var(--color-primary)] hover:gap-2 transition-all" data-testid={`course-card-cta-${course.id}`}>
              {isEnrolled ? 'Continue' : 'View Details'} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
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
    try {
      const catalogRes = await fetch(`${API}/api/courses/catalog`);
      if (!catalogRes.ok) throw new Error(`Catalog fetch failed (${catalogRes.status})`);
      const catalog = await catalogRes.json();

      setCourses(catalog.paths || []);
      setModuleCounts(catalog.module_counts || {});
      setSessionCounts(catalog.session_counts || {});

      if (user?.id) {
        const { data: enrollData } = await supabase
          .from('user_enrollments')
          .select('id, master_path_id, status')
          .eq('user_id', user.id);
        setEnrollments(enrollData || []);
      }
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
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Helmet>
        <title>Finance Courses, Equity Research Analyst Program | Valuevade</title>
        <meta name="description" content="Valuevade's finance courses for Indian students. Start with the Equity Research Analyst Program, 21 modules, 239 sessions, \u20b94999 lifetime." />
        <link rel="canonical" href="https://valuevade.com/courses" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://valuevade.com/courses" />
        <meta property="og:title" content="Finance Courses, Equity Research Analyst Program | Valuevade" />
        <meta property="og:description" content="Valuevade's finance courses for Indian students. Start with the Equity Research Analyst Program, 21 modules, 239 sessions, \u20b94999 lifetime." />
        <meta property="og:image" content="https://valuevade.com/valuevade-logo.png" />
        <meta property="og:site_name" content="Valuevade" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Finance Courses, Equity Research Analyst Program | Valuevade" />
        <meta name="twitter:description" content="Valuevade's finance courses for Indian students. Start with the Equity Research Analyst Program, 21 modules, 239 sessions, \u20b94999 lifetime." />
        <meta name="twitter:image" content="https://valuevade.com/valuevade-logo.png" />
      </Helmet>

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
                <Link to="/dashboard" className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors font-bricolage hidden sm:inline-block" data-testid="courses-dashboard-link">
                  Dashboard
                </Link>
                <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all font-bricolage" data-testid="courses-signout-button">
                  <LogOut size={16} /> Sign Out
                </button>
              </>
            ) : (
              <Link to="/login" className="px-5 py-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-full hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all font-bricolage" data-testid="courses-login-cta">
                Log In
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="vv-catalog-cover" data-testid="courses-hero">
        <div className="vv-catalog-cover-inner">
          <div>
            <p className="vv-eyebrow" data-testid="courses-eyebrow">VALUEVADE · THE LEARNING PATHS</p>
            <h1 data-testid="courses-heading">Your next chapter.<br /><span>Built in finance.</span></h1>
            <p data-testid="courses-hero-description">Go from knowing the terms to doing the work. Finance courses built around real skills, real companies, and your ambition.</p>
          </div>
          <BrandArtwork variant="research" testId="courses-brand-artwork" eager />
        </div>
      </section>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 pt-10 sm:pt-14 pb-16 relative z-10">
        <p className="text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage max-w-xl mx-auto text-center mb-10" data-testid="courses-subtitle">
          Structured finance programs built for Indian students entering equity research and investment analysis.
        </p>

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="courses-loading">
            <CourseCardSkeleton />
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

        {/* Course grid: real course(s) first, then coming-soon placeholders */}
        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="courses-grid">
              {courses.map((course, i) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                >
                  <CourseCard
                    course={{ ...course, category: course.category || 'Equity Research' }}
                    enrollment={getEnrollment(course.id)}
                    moduleCount={moduleCounts[course.id] || 0}
                    sessionCount={sessionCounts[course.id] || 0}
                    isMock={!!course.is_coming_soon}
                  />
                </motion.div>
              ))}
            </div>

            {/* Decorative pagination, matches the layout reference; only one
                real page of programs exists today so prev/next stay disabled */}
            <div className="flex items-center justify-center gap-2 mt-12" data-testid="courses-pagination">
              <button disabled className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-text-faint)] border border-[var(--color-border)] cursor-not-allowed" data-testid="courses-pagination-prev">
                <ChevronLeft size={16} />
              </button>
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bricolage font-semibold text-white bg-[var(--color-primary)]" data-testid="courses-pagination-active">
                1
              </span>
              <button disabled className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-text-faint)] border border-[var(--color-border)] cursor-not-allowed" data-testid="courses-pagination-next">
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* Stats strip, real DB-derived values */}
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

        {/* Closing CTA band */}
        {!loading && !error && courses.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-16 sm:mt-20 mb-4 relative"
            data-testid="courses-closing-cta"
          >
            <div className="relative rounded-3xl border border-[var(--color-primary)]/25 bg-gradient-to-br from-[var(--color-primary)]/[0.08] via-transparent to-[var(--color-accent-purple)]/[0.06] backdrop-blur-xl px-6 sm:px-10 py-10 sm:py-14 text-center overflow-hidden">
              <div aria-hidden="true" className="absolute -top-32 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-[var(--color-primary)] opacity-[0.10] blur-[100px] pointer-events-none" />
              <div className="relative">
                <div className="text-[10px] font-jetbrains uppercase tracking-[0.18em] text-[var(--color-primary)] mb-3">
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
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all shadow-[0_8px_30px_rgba(36,107,253,0.45)]"
                    data-testid="courses-closing-cta-button"
                  >
                    View Details <ArrowRight size={16} />
                  </button>
                </BreathingGlow>
              </div>
            </div>
          </motion.section>
        )}
      </main>
    </div>
  );
}

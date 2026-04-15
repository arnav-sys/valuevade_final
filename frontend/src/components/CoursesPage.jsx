import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, BookOpen, Layers, Clock, BarChart3, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';

function CourseCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8 animate-pulse" data-testid="course-card-skeleton">
      <Skeleton className="h-5 w-24 mb-4 bg-white/5" />
      <Skeleton className="h-8 w-3/4 mb-3 bg-white/5" />
      <Skeleton className="h-4 w-full mb-2 bg-white/5" />
      <Skeleton className="h-4 w-full mb-2 bg-white/5" />
      <Skeleton className="h-4 w-2/3 mb-6 bg-white/5" />
      <div className="flex gap-4 mb-6">
        <Skeleton className="h-4 w-20 bg-white/5" />
        <Skeleton className="h-4 w-20 bg-white/5" />
        <Skeleton className="h-4 w-20 bg-white/5" />
        <Skeleton className="h-6 w-16 rounded-full bg-white/5" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl bg-white/5" />
    </div>
  );
}

function DifficultyBadge({ level }) {
  const config = {
    beginner: { label: 'Beginner', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    intermediate: { label: 'Intermediate', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    advanced: { label: 'Advanced', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
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
    if (isEnrolled) {
      navigate('/dashboard');
    } else {
      navigate(`/course/${course.id}`);
    }
  };

  return (
    <div
      className="glass-card rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:border-[var(--color-accent-purple)]/30 hover:shadow-[0_8px_40px_rgba(106,92,255,0.1)] group"
      data-testid={`course-card-${course.id}`}
    >
      {/* Title */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-primary)] mb-2 block" data-testid="course-card-label">
            Career Path
          </span>
          <h3 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)]" data-testid="course-card-title">
            {course.title}
          </h3>
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
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[var(--color-primary)] hover:underline mt-1 font-bricolage"
            data-testid="course-read-more"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-6 text-xs text-[var(--color-text-muted)] font-mono" data-testid="course-stats-row">
        <span className="flex items-center gap-1.5">
          <Layers size={14} className="text-[var(--color-primary)]" />
          {moduleCount} module{moduleCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <BookOpen size={14} className="text-[var(--color-accent-purple)]" />
          {sessionCount} session{sessionCount !== 1 ? 's' : ''}
        </span>
        {course.estimated_hours && (
          <span className="flex items-center gap-1.5">
            <Clock size={14} className="text-[var(--color-accent-pink)]" />
            {course.estimated_hours}h
          </span>
        )}
        <DifficultyBadge level={course.difficulty} />
      </div>

      {/* CTA */}
      <button
        onClick={handleCTA}
        disabled={isCompleted}
        className={`w-full py-3 rounded-xl font-semibold font-bricolage text-sm flex items-center justify-center gap-2 transition-all ${
          isCompleted
            ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] cursor-default border border-[var(--color-success)]/20'
            : isEnrolled
            ? 'bg-[var(--color-accent-purple)] text-white hover:shadow-[0_0_24px_rgba(106,92,255,0.4)]'
            : 'bg-[var(--color-primary)] text-white hover:shadow-[0_0_24px_rgba(36,107,253,0.4)]'
        }`}
        data-testid="course-cta-button"
      >
        {isCompleted ? (
          <>
            <CheckCircle2 size={16} /> Completed
          </>
        ) : isEnrolled ? (
          <>
            Continue Learning <ArrowRight size={16} />
          </>
        ) : (
          <>
            View Details <ArrowRight size={16} />
          </>
        )}
      </button>
    </div>
  );
}

export default function CoursesPage() {
  const { user, profile, signOut } = useAuth();
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
      // Fetch active courses
      const { data: paths, error: pathsErr } = await supabase
        .from('master_paths')
        .select('*')
        .eq('is_active', true);

      if (pathsErr) throw pathsErr;
      setCourses(paths || []);

      // Fetch user enrollments
      if (user?.id) {
        try {
          const { data: enrollData } = await supabase
            .from('user_enrollments')
            .select('id, master_path_id, status')
            .eq('user_id', user.id);
          setEnrollments(enrollData || []);
        } catch {
          setEnrollments([]);
        }
      }

      // Fetch modules to compute counts per path
      const { data: modules } = await supabase
        .from('master_modules')
        .select('id, path_id');

      const mCounts = {};
      (modules || []).forEach((m) => {
        mCounts[m.path_id] = (mCounts[m.path_id] || 0) + 1;
      });
      setModuleCounts(mCounts);

      // Fetch sessions to compute counts per path (via module)
      const { data: sessions } = await supabase
        .from('master_sessions')
        .select('id, module_id');

      // Map module_id -> path_id
      const moduleToPath = {};
      (modules || []).forEach((m) => {
        moduleToPath[m.id] = m.path_id;
      });

      const sCounts = {};
      (sessions || []).forEach((s) => {
        const pathId = moduleToPath[s.module_id];
        if (pathId) {
          sCounts[pathId] = (sCounts[pathId] || 0) + 1;
        }
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
      {/* Ambient orbs */}
      <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-[var(--color-primary)] opacity-[0.03] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[10%] w-[400px] h-[400px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--color-border)]" data-testid="courses-header">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="courses-logo">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8" />
            <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
          </Link>
          <div className="flex items-center gap-4">
            {profile && (
              <span className="text-sm text-[var(--color-text-muted)] font-bricolage hidden sm:block" data-testid="courses-user-name">
                {profile.full_name}
              </span>
            )}
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all font-bricolage"
              data-testid="courses-signout-button"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-12 sm:py-16 relative z-10">
        {/* Page title */}
        <div className="text-center mb-12">
          <h1 className="font-clash text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="courses-heading">
            Choose Your Career Path
          </h1>
          <p className="text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage max-w-lg mx-auto" data-testid="courses-subtitle">
            AI-personalized learning paths built for finance careers
          </p>
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
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all"
              data-testid="courses-retry-button"
            >
              <RefreshCw size={16} /> Try Again
            </button>
          </div>
        )}

        {/* Course grid */}
        {!loading && !error && courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="courses-grid">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                enrollment={getEnrollment(course.id)}
                moduleCount={moduleCounts[course.id] || 0}
                sessionCount={sessionCounts[course.id] || 0}
              />
            ))}
          </div>
        )}

        {/* Empty state — always shown after loaded courses */}
        {!loading && !error && (
          <div className="mt-12 text-center" data-testid="courses-coming-soon">
            <div className="glass-card rounded-2xl px-8 py-6 inline-flex flex-col sm:flex-row items-center gap-4">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)] animate-pulse shrink-0" />
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage">
                More career paths coming soon. We're building <span className="text-[var(--color-text)]">Investment Banking</span>, <span className="text-[var(--color-text)]">Private Equity</span>, and more.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

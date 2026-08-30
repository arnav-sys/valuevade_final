import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { enrollDirect } from '../lib/enrollDirect';
import { usePaymentFlow } from './payments/usePaymentFlow';
import { ArrowRight, BookOpen, Layers, Clock, Award, ChevronDown, ChevronUp, CheckCircle2, Sparkles } from 'lucide-react';
import { BreathingGlow, ScrollProgressBar } from './cinematic/primitives';
import CapstoneProjectsGrid from './CapstoneProjectsGrid';

/**
 * Proper enrollment procedure — replaces the previous instant one-click
 * enroll. Shows a preview of the course (title, key numbers, capstones,
 * module outline) and a single "Start My Journey" CTA that triggers the
 * enrolldirect() DB writes and redirects to /dashboard.
 *
 * No AI customization / no personalization — every user gets the same
 * standard curriculum.
 */
export default function EnrollmentPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(null);
  // AI customisation mode fetched from public app-settings endpoint.
  //   'off'       -> only standard CTA
  //   'optional'  -> both CTAs
  //   'mandatory' -> only "Customise with AI"
  const [aiMode, setAiMode] = useState('off');

  useEffect(() => {
    // Non-blocking fetch — defaults to 'off' if unreachable/table missing
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/app-settings/ai-customization`)
      .then((r) => r.ok ? r.json() : Promise.resolve({ mode: 'off' }))
      .then((j) => setAiMode((j && j.mode) || 'off'))
      .catch(() => setAiMode('off'));
  }, []);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    let alive = true;
    (async () => {
      // Independent queries with hard 15s timeout — prevents the page
      // from getting stuck on "Loading course…" if Supabase hangs.
      const TIMEOUT_MS = 15000;
      const withTimeout = (p, label) => Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), TIMEOUT_MS)),
      ]);
      try {
        const [cRes, mRes] = await Promise.allSettled([
          withTimeout(
            supabase.from('master_paths').select('*').eq('id', courseId).single(),
            'course',
          ),
          withTimeout(
            supabase.from('master_modules')
              .select('id, title, order_index, module_number, description, master_sessions(id, title, order_index)')
              .eq('path_id', courseId).order('order_index'),
            'modules',
          ),
        ]);
        if (!alive) return;

        if (cRes.status === 'fulfilled' && !cRes.value.error) {
          setCourse(cRes.value.data);
        } else if (cRes.status === 'rejected') {
          throw new Error(cRes.reason?.message || 'Could not load the course.');
        }

        if (mRes.status === 'fulfilled' && !mRes.value.error) {
          setModules(mRes.value.data || []);
        } else {
          // Modules failure isn't fatal — page still renders CTAs.
          setModules([]);
        }

        // If already enrolled, skip straight to dashboard (non-blocking).
        try {
          const { data: existing } = await withTimeout(
            supabase.from('user_enrollments').select('id')
              .eq('user_id', user.id).eq('master_path_id', courseId)
              .eq('status', 'active').limit(1),
            'enrollment-check',
          );
          if (alive && existing?.length) navigate('/dashboard', { replace: true });
        } catch { /* soft-fail: user can still enrol from here */ }
      } catch (e) {
        if (alive) setError(e?.message || 'Failed to load course.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [courseId, user, navigate]);

  const handleStart = async () => {
    if (enrolling) return;
    setEnrolling(true);
    setError(null);
    try {
      await enrollDirect({ userId: user.id, courseId, courseTitle: course?.title });
      navigate('/dashboard', { replace: true });
    } catch (e) {
      setError(e?.message || 'Enrollment failed. Please try again.');
      setEnrolling(false);
    }
  };

  // Payment must succeed before enrollDirect() ever runs — enrolling for
  // free was a bug (the "Enrol Now — ₹1,500" CTA promised payment).
  const { startPayment, busy: paying, mockModal, successOverlay } = usePaymentFlow({ onSuccess: handleStart });
  const handlePayAndStart = () => {
    setError(null);
    startPayment('upfront');
  };

  if (enrolling) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--bg-primary)]" data-testid="enrollment-setup">
        <img src="/valuevade-logo.svg" alt="Valuevade" className="w-14 h-14 mb-5 animate-pulse" />
        <div className="w-48 h-1 rounded-full overflow-hidden bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] animate-[shimmer_1.5s_ease-in-out_infinite]"
            style={{ width: '65%' }}
          />
        </div>
        <p className="mt-5 text-sm text-[var(--color-text)] font-bricolage">Setting up your workspace…</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)] font-bricolage">Building your 22-module curriculum and 246 sessions.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]" data-testid="enrollment-loading">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] px-6 text-center">
        <p className="text-[var(--color-text)] font-bricolage mb-2">Course not found.</p>
        <Link to="/courses" className="text-[var(--color-primary)] text-sm hover:underline" data-testid="enroll-back-to-courses">← Back to courses</Link>
      </div>
    );
  }

  const totalSessions = modules.reduce((s, m) => s + (m.master_sessions?.length || 0), 0);
  const totalHours = course.estimated_hours || 200;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden" data-testid="enrollment-page">
      <ScrollProgressBar />
      {/* Ambient orbs */}
      <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.05] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[8%] w-[380px] h-[380px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.05] blur-[120px] pointer-events-none" />

      <main className="max-w-4xl mx-auto px-6 py-14 sm:py-20 relative z-10">
        {/* Header — course overview */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10"
        >
          <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent-purple)] mb-3" data-testid="enrollment-eyebrow">
            Enrollment · Career Path
          </span>
          <h1 className="font-clash text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--color-text)] mb-4 tracking-tight" data-testid="enrollment-title">
            {course.title}
          </h1>
          <p className="text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage max-w-2xl leading-relaxed" data-testid="enrollment-desc">
            {course.description}
          </p>
          {/* Key numbers */}
          <div className="mt-7 flex flex-wrap gap-2" data-testid="enrollment-stats">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--color-primary)]/8 text-[var(--color-primary)] border border-[var(--color-primary)]/15">
              <Layers size={13} /> {modules.length} modules
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--color-accent-purple)]/8 text-[var(--color-accent-purple)] border border-[var(--color-accent-purple)]/15">
              <BookOpen size={13} /> {totalSessions} sessions
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--color-accent-pink)]/8 text-[var(--color-accent-pink)] border border-[var(--color-accent-pink)]/15">
              <Award size={13} /> 3 capstones
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[var(--color-success)]/8 text-[var(--color-success)] border border-[var(--color-success)]/15">
              <Clock size={13} /> ~{totalHours}h
            </span>
          </div>
        </motion.div>

        {/* Capstones preview */}
        <section className="mb-12" data-testid="enrollment-capstones">
          <h2 className="font-clash text-2xl font-bold text-[var(--color-text)] mb-2">What you'll build</h2>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">Three portfolio-grade capstone projects — the artifacts you'll show recruiters.</p>
          <CapstoneProjectsGrid />
        </section>

        {/* Module outline (collapsed by default) */}
        <section className="mb-12" data-testid="enrollment-curriculum">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-clash text-2xl font-bold text-[var(--color-text)]">Curriculum outline</h2>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mt-1">{modules.length} modules · {totalSessions} sessions total</p>
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              data-testid="enrollment-outline-toggle"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all"
            >
              {expanded ? <>Collapse <ChevronUp size={14} /></> : <>Expand all <ChevronDown size={14} /></>}
            </button>
          </div>
          <ol className="space-y-2" data-testid="enrollment-modules-list">
            {modules.map((m, i) => {
              const sessions = m.master_sessions || [];
              return (
                <li
                  key={m.id}
                  className="glass-card rounded-xl p-4 sm:p-5 border border-[var(--color-border)]"
                  data-testid={`enrollment-module-${m.module_number || i + 1}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-8 h-8 flex-shrink-0 rounded-lg bg-[var(--color-accent-purple)]/10 text-[var(--color-accent-purple)] font-mono text-xs font-semibold flex items-center justify-center">
                        {String(m.module_number || i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="font-clash text-base font-semibold text-[var(--color-text)] leading-tight">{m.title}</p>
                        {expanded && m.description && (
                          <p className="text-xs text-[var(--color-text-muted)] font-bricolage mt-1 leading-relaxed">{m.description}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)] font-mono whitespace-nowrap flex-shrink-0">
                      {sessions.length} sess
                    </span>
                  </div>
                  {expanded && sessions.length > 0 && (
                    <ul className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-1.5 pl-11" data-testid={`enrollment-module-${m.module_number || i + 1}-sessions`}>
                      {sessions.slice().sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).map((s) => (
                        <li key={s.id} className="text-xs text-[var(--color-text-muted)] font-bricolage flex items-center gap-2">
                          <CheckCircle2 size={11} className="text-[var(--color-primary)]/60" />
                          {s.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* CTA */}
        <section className="text-center" data-testid="enrollment-cta-section">
          {error && (
            <div className="mb-5 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-500 font-bricolage" data-testid="enrollment-error">
              {error}
            </div>
          )}

          {aiMode !== 'mandatory' && (
            <>
              <BreathingGlow testid="enrollment-glow">
                <button
                  onClick={handlePayAndStart}
                  disabled={enrolling || paying}
                  data-testid="enrollment-start-button"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm sm:text-base font-semibold font-bricolage hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_8px_30px_rgba(139,92,246,0.45)]"
                >
                  {paying ? 'Opening payment…' : 'Pay ₹1,500 & Start My Journey'} <ArrowRight size={16} />
                </button>
              </BreathingGlow>
              <p className="mt-4 text-xs text-[var(--color-text-muted)] font-bricolage" data-testid="enrollment-fineprint">
                ₹1,500 lifetime access · one-time payment via Razorpay · full standard curriculum
              </p>
            </>
          )}

          {(aiMode === 'optional' || aiMode === 'mandatory') && (
            <div className={aiMode === 'optional' ? 'mt-8' : ''} data-testid="enrollment-ai-cta-block">
              {aiMode === 'optional' && (
                <div className="flex items-center gap-3 max-w-xs mx-auto mb-4">
                  <div className="flex-1 h-px bg-[var(--color-border)]" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">or</span>
                  <div className="flex-1 h-px bg-[var(--color-border)]" />
                </div>
              )}
              <Link
                to={`/course/${courseId}/customize`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[var(--color-accent-purple)]/50 bg-[var(--color-accent-purple)]/10 text-[var(--color-accent-purple)] text-sm font-semibold font-bricolage hover:bg-[var(--color-accent-purple)]/20 transition-all"
                data-testid="enrollment-customize-button"
              >
                <Sparkles size={15} /> Customise my path with AI
              </Link>
              <p className="mt-3 text-xs text-[var(--color-text-muted)] font-bricolage" data-testid="enrollment-ai-fineprint">
                Answer a few questions — Pari tailors the modules to your background and goals.
              </p>
            </div>
          )}

          <Link
            to={`/course/${courseId}`}
            className="mt-6 inline-block text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-bricolage transition-colors"
            data-testid="enrollment-back-link"
          >
            ← Back to course details
          </Link>
        </section>
      </main>
      {mockModal}
      {successOverlay}
    </div>
  );
}

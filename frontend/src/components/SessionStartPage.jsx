import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import {
  ArrowLeft, ArrowRight, FileText, HelpCircle, MessageSquare, Wrench,
  CheckCircle2, Circle, Lock, PlayCircle, Target, AlertCircle, RefreshCw, Sparkles,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';

const PHASES = [
  { key: 'notes', label: 'Notes', icon: FileText, path: 'notes', blurb: 'Learn the core concepts' },
  { key: 'quiz', label: 'Quiz', icon: HelpCircle, path: 'quiz/start', blurb: 'Test your understanding' },
  { key: 'interview', label: 'Interview', icon: MessageSquare, path: 'interview/start', blurb: 'Practice answering' },
  { key: 'simulation', label: 'Simulation', icon: Wrench, path: 'simulation/start', blurb: 'Apply in a real scenario' },
];

export default function SessionStartPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [module, setModule] = useState(null);
  const [master, setMaster] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id || !sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: sess, error: sErr } = await supabase
          .from('user_sessions')
          .select('*, user_modules(id, title, order_index, enrollment_id)')
          .eq('id', sessionId)
          .single();
        if (sErr) throw sErr;
        if (!mounted) return;
        setSession(sess);
        setModule(sess.user_modules || null);

        if (sess.master_session_id) {
          const { data: m } = await supabase
            .from('master_sessions')
            .select('*')
            .eq('id', sess.master_session_id)
            .maybeSingle();
          if (mounted) setMaster(m || null);
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load session');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [sessionId, user?.id]);

  const firstIncomplete = session
    ? PHASES.find((p) => !session[`${p.key}_completed`])
    : null;
  const allDone = session && !firstIncomplete;

  const description = master?.description || session?.description || '';
  const objectives = master?.learning_objectives || session?.learning_objectives || [];
  const estMin = master?.estimated_minutes || session?.estimated_minutes || 15;

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative">
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[120px] pointer-events-none" />

      <Sidebar />

      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          {/* Back */}
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group font-bricolage"
            data-testid="session-back-dashboard"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </Link>

          {loading && (
            <div className="space-y-4" data-testid="session-start-loading">
              <Skeleton className="h-4 w-48 bg-[var(--color-surface)]" />
              <Skeleton className="h-10 w-2/3 bg-[var(--color-surface)]" />
              <Skeleton className="h-24 w-full bg-[var(--color-surface)]" />
              <Skeleton className="h-40 w-full bg-[var(--color-surface)]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center text-center py-16" data-testid="session-start-error">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
                <AlertCircle size={28} className="text-[var(--color-error)]" />
              </div>
              <p className="text-[var(--color-text)] font-bricolage mb-2">Something went wrong</p>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all"
              >
                <RefreshCw size={16} /> Try Again
              </button>
            </div>
          )}

          {!loading && !error && session && (
            <>
              {/* Breadcrumb */}
              <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-5" data-testid="session-breadcrumb">
                {module && (
                  <>
                    <span>{/^\s*module\b/i.test(module.title || '') ? module.title : `Module ${module.order_index + 1}: ${module.title}`}</span>
                    <span className="text-[var(--color-text-faint)]">›</span>
                  </>
                )}
                <span className="text-[var(--color-text)]">
                  {session.order_index != null ? `Session ${session.order_index + 1}: ` : ''}{session.title}
                </span>
              </div>

              {/* Title + meta */}
              <div className="mb-8">
                {session.is_added_by_ai && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-[var(--color-accent-purple)]/10 text-[var(--color-accent-purple)] border border-[var(--color-accent-purple)]/20 mb-3">
                    <Sparkles size={11} /> AI-ADDED
                  </div>
                )}
                <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-3" data-testid="session-title">
                  {session.title}
                </h1>
                {description && (
                  <p className="text-[var(--color-text-muted)] font-bricolage leading-relaxed" data-testid="session-description">
                    {description}
                  </p>
                )}
              </div>

              {/* Learning objectives */}
              {objectives && objectives.length > 0 && (
                <div className="glass-card rounded-2xl p-5 sm:p-6 mb-8" data-testid="session-objectives">
                  <div className="flex items-center gap-2 mb-4">
                    <Target size={16} className="text-[var(--color-accent-purple)]" />
                    <h2 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                      What you'll learn
                    </h2>
                  </div>
                  <ul className="space-y-2.5">
                    {objectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm font-bricolage text-[var(--color-text)]" data-testid={`objective-${i}`}>
                        <CheckCircle2 size={16} className="text-[var(--color-primary)] shrink-0 mt-0.5" />
                        <span>{typeof obj === 'string' ? obj : obj.text || JSON.stringify(obj)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Phases */}
              <div className="mb-8">
                <h2 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)] mb-3">
                  Your 4-phase journey
                </h2>
                <div className="space-y-2" data-testid="session-phase-list">
                  {PHASES.map((p, idx) => {
                    const isDone = session[`${p.key}_completed`];
                    const isNext = firstIncomplete?.key === p.key;
                    const Icon = p.icon;
                    return (
                      <div
                        key={p.key}
                        className={`glass-card rounded-xl px-4 py-3.5 flex items-center gap-4 transition-all ${
                          isNext ? 'border-[var(--color-primary)]/40 shadow-[0_0_24px_rgba(36,107,253,0.12)]' : ''
                        }`}
                        data-testid={`phase-${p.key}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isDone
                            ? 'bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)]'
                            : isNext
                            ? 'bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)]'
                            : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-faint)]'
                        }`}>
                          {isDone ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-[var(--color-text-faint)]">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <h3 className="font-clash text-base font-semibold text-[var(--color-text)]">{p.label}</h3>
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] font-bricolage">{p.blurb}</p>
                        </div>
                        {isDone ? (
                          <span className="text-[10px] font-mono text-[var(--color-success)]">DONE</span>
                        ) : isNext ? (
                          <span className="text-[10px] font-mono text-[var(--color-primary)]">NEXT</span>
                        ) : (
                          <Circle size={14} className="text-[var(--color-text-faint)]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTA */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-mono text-[var(--color-text-muted)]">
                  ~{estMin} min total
                </span>
                {allDone ? (
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)] text-sm font-semibold font-bricolage"
                    data-testid="session-all-done"
                  >
                    <CheckCircle2 size={16} /> All phases complete
                  </Link>
                ) : (
                  <button
                    onClick={() => navigate(`/session/${sessionId}/${firstIncomplete.path}`)}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
                    data-testid="session-begin-btn"
                  >
                    <PlayCircle size={16} />
                    {PHASES.some((p) => session[`${p.key}_completed`]) ? 'Continue' : 'Begin'} with {firstIncomplete.label}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

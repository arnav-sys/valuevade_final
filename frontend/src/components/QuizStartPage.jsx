import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import {
  ArrowLeft, ArrowRight, HelpCircle, Clock, Target, Lightbulb,
  AlertCircle, RefreshCw, PlayCircle,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';

export default function QuizStartPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [module, setModule] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id || !sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: sess, error: sErr } = await supabase
          .from('user_sessions')
          .select('*, user_modules(id, title, order_index)')
          .eq('id', sessionId)
          .single();
        if (sErr) throw sErr;
        if (!mounted) return;
        setSession(sess);
        setModule(sess.user_modules || null);

        if (sess.master_session_id) {
          const { count, error: qErr } = await supabase
            .from('master_quiz_questions')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sess.master_session_id);
          if (qErr) throw qErr;
          if (mounted) setQuestionCount(count || 0);
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load quiz');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [sessionId, user?.id]);

  const estMinutes = Math.max(2, Math.ceil((questionCount || 0) * 1.2));

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative">
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[120px] pointer-events-none" />

      <Sidebar />

      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <Link
            to={`/session/${sessionId}/start`}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group font-bricolage"
            data-testid="quiz-start-back"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Session
          </Link>

          {loading && (
            <div className="space-y-4" data-testid="quiz-start-loading">
              <Skeleton className="h-4 w-48 bg-[var(--color-surface)]" />
              <Skeleton className="h-10 w-2/3 bg-[var(--color-surface)]" />
              <Skeleton className="h-24 w-full bg-[var(--color-surface)]" />
              <Skeleton className="h-32 w-full bg-[var(--color-surface)]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center text-center py-16" data-testid="quiz-start-error">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
                <AlertCircle size={28} className="text-[var(--color-error)]" />
              </div>
              <p className="text-[var(--color-text)] font-bricolage mb-2">Something went wrong</p>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
              >
                <RefreshCw size={16} /> Try Again
              </button>
            </div>
          )}

          {!loading && !error && session && (
            <>
              {/* Breadcrumb */}
              <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-5" data-testid="quiz-breadcrumb">
                {module && (
                  <>
                    <span>{/^\s*module\b/i.test(module.title || '') ? module.title : `Module ${module.order_index + 1}: ${module.title}`}</span>
                    <span className="text-[var(--color-text-faint)]">›</span>
                  </>
                )}
                <span>
                  {session.order_index != null ? `Session ${session.order_index + 1}: ` : ''}{session.title}
                </span>
                <span className="text-[var(--color-text-faint)]">›</span>
                <span className="text-[var(--color-text)]">Quiz</span>
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
                <HelpCircle size={12} /> Phase 2 of 4
              </div>

              {/* Title */}
              <h1 className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="quiz-start-title">
                Test Your Knowledge
              </h1>
              <p className="text-[var(--color-text-muted)] font-bricolage text-base sm:text-lg leading-relaxed mb-8">
                A quick check-in to make sure the concepts landed. No pressure —
                you can always come back to the notes.
              </p>

              {/* Info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8" data-testid="quiz-info-grid">
                <div className="glass-card rounded-2xl p-5">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center mb-3">
                    <HelpCircle size={18} />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Questions</div>
                  <div className="font-clash text-2xl font-bold text-[var(--color-text)]" data-testid="quiz-question-count">
                    {questionCount}
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] flex items-center justify-center mb-3">
                    <Clock size={18} />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Est. time</div>
                  <div className="font-clash text-2xl font-bold text-[var(--color-text)]" data-testid="quiz-est-time">
                    ~{estMinutes} min
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)] flex items-center justify-center mb-3">
                    <Target size={18} />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Passing score</div>
                  <div className="font-clash text-2xl font-bold text-[var(--color-text)]" data-testid="quiz-passing-score">70%</div>
                </div>
              </div>

              {/* Tip card */}
              <div className="glass-card rounded-2xl p-5 sm:p-6 mb-8 border-[var(--color-accent-purple)]/20" data-testid="quiz-tip-card">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] flex items-center justify-center shrink-0">
                    <Lightbulb size={16} />
                  </div>
                  <div>
                    <div className="font-clash text-sm font-semibold text-[var(--color-text)] mb-1">Pro tip</div>
                    <p className="text-sm text-[var(--color-text-muted)] font-bricolage leading-relaxed">
                      Read each question carefully. You'll see an explanation after every answer — wrong answers teach you just as much as right ones.
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="flex items-center justify-between gap-4">
                <Link
                  to={`/session/${sessionId}/notes`}
                  className="text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                  data-testid="quiz-review-notes-link"
                >
                  ← Review notes first
                </Link>
                <button
                  onClick={() => navigate(`/session/${sessionId}/quiz`)}
                  disabled={questionCount === 0}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="quiz-start-cta"
                >
                  <PlayCircle size={16} />
                  Start Quiz
                  <ArrowRight size={16} />
                </button>
              </div>

              {questionCount === 0 && (
                <p className="text-center text-xs text-[var(--color-text-faint)] font-mono mt-4" data-testid="quiz-no-questions-warning">
                  No quiz questions available for this session yet.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

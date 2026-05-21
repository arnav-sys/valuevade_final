import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import AvatarPersona from './tutor/AvatarPersona';
import { resolveTutorPhase } from '../contexts/TutorContext';
import {
  ArrowLeft, ArrowRight, MessageSquare, Clock, User, Sparkles,
  AlertCircle, RefreshCw, PlayCircle, ChevronDown, ChevronUp,
  Target, CheckCircle2,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';

const TIPS = [
  { title: 'Be specific', body: 'Swap vague language for concrete examples — companies, numbers, frameworks you actually know.' },
  { title: 'Structure your answer', body: 'State your conclusion first, back it with 2–3 reasons, then wrap with a one-line summary.' },
  { title: 'Start with the conclusion', body: 'Interviewers skim. Give them the punchline up front, then prove it.' },
];

export default function InterviewStartPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [module, setModule] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [tipsOpen, setTipsOpen] = useState(true);

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
            .from('master_interview_questions')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sess.master_session_id);
          if (qErr) throw qErr;
          if (mounted) setQuestionCount(Math.min(count || 0, 5));
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load interview');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [sessionId, user?.id]);

  const estMinutes = Math.max(5, Math.ceil((questionCount || 0) * 3));

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
            data-testid="interview-start-back"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Session
          </Link>

          {loading && (
            <div className="space-y-4" data-testid="interview-start-loading">
              <Skeleton className="h-4 w-48 bg-[var(--color-surface)]" />
              <Skeleton className="h-10 w-2/3 bg-[var(--color-surface)]" />
              <Skeleton className="h-24 w-full bg-[var(--color-surface)]" />
              <Skeleton className="h-32 w-full bg-[var(--color-surface)]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center text-center py-16" data-testid="interview-start-error">
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
              <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-5" data-testid="interview-breadcrumb">
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
                <span className="text-[var(--color-text)]">Interview</span>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
                <MessageSquare size={12} /> Phase 3 of 4
              </div>

              <h1 className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="interview-start-title">
                Interview Practice
              </h1>
              <p className="text-[var(--color-text-muted)] font-bricolage text-base sm:text-lg leading-relaxed mb-8">
                Simulate a real interview with a Senior Analyst. Type your response — get
                instant feedback on what landed and what to sharpen.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6" data-testid="interview-info-grid">
                <div className="glass-card rounded-2xl p-5">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center mb-3">
                    <MessageSquare size={18} />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Questions</div>
                  <div className="font-clash text-2xl font-bold text-[var(--color-text)]" data-testid="interview-question-count">
                    {questionCount}
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] flex items-center justify-center mb-3">
                    <Clock size={18} />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Est. time</div>
                  <div className="font-clash text-2xl font-bold text-[var(--color-text)]" data-testid="interview-est-time">
                    ~{estMinutes} min
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)] flex items-center justify-center mb-3">
                    <User size={18} />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Format</div>
                  <div className="font-clash text-sm font-bold text-[var(--color-text)] leading-snug" data-testid="interview-format">
                    Type your<br />response
                  </div>
                </div>
              </div>

              {/* Tips collapsible */}
              <div className="glass-card rounded-2xl mb-8 overflow-hidden" data-testid="interview-tips-card">
                <button
                  onClick={() => setTipsOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[var(--color-surface)]/40 transition-colors"
                  data-testid="interview-tips-toggle"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] flex items-center justify-center shrink-0">
                      <Sparkles size={16} />
                    </div>
                    <div className="text-left">
                      <div className="font-clash text-sm font-semibold text-[var(--color-text)]">How to nail this</div>
                      <div className="text-xs text-[var(--color-text-muted)] font-bricolage">3 tips from finance interviewers</div>
                    </div>
                  </div>
                  {tipsOpen ? (
                    <ChevronUp size={18} className="text-[var(--color-text-muted)]" />
                  ) : (
                    <ChevronDown size={18} className="text-[var(--color-text-muted)]" />
                  )}
                </button>
                {tipsOpen && (
                  <div className="px-5 pb-5 space-y-3 border-t border-[var(--color-border)] animate-vv-slide-in">
                    {TIPS.map((t, i) => (
                      <div key={i} className="flex items-start gap-3 pt-3" data-testid={`interview-tip-${i}`}>
                        <CheckCircle2 size={16} className="text-[var(--color-success)] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-clash text-sm font-semibold text-[var(--color-text)] mb-0.5">{t.title}</div>
                          <p className="text-xs text-[var(--color-text-muted)] font-bricolage leading-relaxed">{t.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-mono text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Target size={13} /> No right answer — just your best shot
                </span>
                <button
                  onClick={() => navigate(`/session/${sessionId}/interview`)}
                  disabled={questionCount === 0}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="interview-begin-cta"
                >
                  <PlayCircle size={16} />
                  Begin Interview
                  <ArrowRight size={16} />
                </button>
              </div>

              {questionCount === 0 && (
                <p className="text-center text-xs text-[var(--color-text-faint)] font-mono mt-4" data-testid="interview-no-questions-warning">
                  No interview questions available for this session yet.
                </p>
              )}
            </>
          )}
        </div>
      </main>

      {(() => {
        const t = resolveTutorPhase('interview_intro');
        return <AvatarPersona pose={t?.pose || 'interviewer'} size="sm" position="bottom-right" message={t?.message} />;
      })()}

      <style>{`
        @keyframes vvSlideIn { 0% { opacity: 0; transform: translateY(-6px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-vv-slide-in { animation: vvSlideIn .2s ease-out both; }
      `}</style>
    </div>
  );
}

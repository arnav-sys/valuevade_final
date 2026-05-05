import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import useTimeTracking from '../utils/useTimeTracking';
import {
  ArrowLeft, ArrowRight, CheckCircle2, XCircle, Lightbulb,
  Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';

function getOptions(q) {
  const o = q?.options;
  if (Array.isArray(o)) return o;
  if (o && typeof o === 'object') return Object.values(o);
  return [];
}

function getCorrectIndex(q) {
  if (q == null) return -1;
  const v =
    q.correct_answer_index ??
    q.correct_index ??
    q.correct_option_index ??
    q.answer_index;
  const n = Number(v);
  return Number.isFinite(n) ? n : -1;
}

export default function QuizPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState([]); // [{ question_id, selected_index, is_correct }]

  // Track active time on this page → user_stats.total_time_minutes
  useTimeTracking(user?.id);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id || !sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: sess, error: sErr } = await supabase
          .from('user_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        if (sErr) throw sErr;
        if (!mounted) return;
        setSession(sess);

        if (!sess.master_session_id) {
          setQuestions([]);
          return;
        }

        const { data: qs, error: qErr } = await supabase
          .from('master_quiz_questions')
          .select('*')
          .eq('session_id', sess.master_session_id)
          .order('order_index')
          .limit(5);
        if (qErr) throw qErr;
        if (!mounted) return;
        setQuestions(qs || []);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load quiz');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [sessionId, user?.id]);

  const total = questions.length;
  const q = questions[idx];
  const options = useMemo(() => getOptions(q), [q]);
  const correctIndex = useMemo(() => getCorrectIndex(q), [q]);
  const isLast = idx === total - 1;
  const isReview = !!session?.quiz_completed;
  const progress = total ? ((idx + (submitted || isReview ? 1 : 0)) / total) * 100 : 0;
  // In review mode each question is shown with the correct answer revealed
  // and explanation visible — no scoring, no DB writes.
  const reviewSubmitted = isReview ? true : submitted;
  const reviewSelected = isReview ? correctIndex : selected;

  const handleSubmit = useCallback(() => {
    if (isReview || submitted || selected == null || !q) return;
    const isCorrect = selected === correctIndex;
    setSubmitted(true);
    setAnswers((prev) => [
      ...prev,
      { question_id: q.id, selected_index: selected, is_correct: isCorrect },
    ]);
  }, [isReview, submitted, selected, q, correctIndex]);

  const handleNext = useCallback(() => {
    if (!isReview && !submitted) return;
    if (isLast) {
      if (isReview) {
        navigate(`/session/${sessionId}/start`);
        return;
      }
      navigate(`/session/${sessionId}/quiz/complete`, {
        state: {
          answers: [...answers],
          questions: questions.map((qq) => ({
            id: qq.id,
            question: qq.question || qq.text || qq.prompt || '',
            options: getOptions(qq),
            correct_answer_index: getCorrectIndex(qq),
            explanation: qq.explanation || qq.rationale || '',
          })),
        },
      });
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setSubmitted(false);
  }, [isReview, submitted, isLast, navigate, sessionId, answers, questions]);

  // Keyboard shortcuts: 1-4 to pick, Enter to submit/next
  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= '1' && e.key <= '4') {
        const n = parseInt(e.key, 10) - 1;
        if (!reviewSubmitted && n < options.length) setSelected(n);
      } else if (e.key === 'Enter') {
        if (!reviewSubmitted && selected != null) handleSubmit();
        else if (reviewSubmitted) handleNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reviewSubmitted, selected, options.length, handleSubmit, handleNext]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center" data-testid="quiz-loading">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6" data-testid="quiz-error">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
            <AlertCircle size={28} className="text-[var(--color-error)]" />
          </div>
          <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load quiz</p>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
          >
            <RefreshCw size={16} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!total) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6" data-testid="quiz-empty">
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center mb-5">
            <AlertCircle size={28} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="text-[var(--color-text)] font-bricolage mb-2">No quiz questions yet</p>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">
            This session doesn't have any quiz questions available.
          </p>
          <Link
            to={`/session/${sessionId}/start`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
          >
            <ArrowLeft size={16} /> Back to Session
          </Link>
        </div>
      </div>
    );
  }

  const explanation = q.explanation || q.rationale || '';
  const questionText = q.question || q.text || q.prompt || '';
  const isCorrect = reviewSubmitted && reviewSelected === correctIndex;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative" style={{ overflowX: 'clip' }} data-testid="quiz-page">
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[140px] pointer-events-none" />

      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/85 backdrop-blur-xl border-b border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-4">
          <div className="flex items-center justify-between gap-4 mb-3">
            <Link
              to={`/session/${sessionId}/start`}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors group font-bricolage"
              data-testid="quiz-exit-link"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Exit Quiz
            </Link>
            <div className="flex items-center gap-2">
              {isReview && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)]" data-testid="quiz-review-badge">
                  <CheckCircle2 size={10} /> REVIEW {session?.quiz_score != null ? `· ${session.quiz_score}%` : ''}
                </span>
              )}
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]" data-testid="quiz-progress-text">
                Question {idx + 1} of {total}
              </span>
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
              data-testid="quiz-progress-bar"
            />
          </div>
        </div>
      </div>

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
        {/* Question text */}
        <div key={`q-${idx}`} className="animate-vv-fade-up">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-primary)] mb-3">
            Question {idx + 1}
          </div>
          <h1 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] leading-tight mb-8" data-testid="quiz-question-text">
            {questionText}
          </h1>

          {/* Options */}
          <div className="space-y-3 mb-6" data-testid="quiz-options">
            {options.map((opt, i) => {
              const isSelected = reviewSelected === i;
              const isCorrectOption = i === correctIndex;
              const showCorrect = reviewSubmitted && isCorrectOption;
              const showWrong = reviewSubmitted && isSelected && !isCorrectOption;

              let cls =
                'w-full text-left rounded-2xl border px-5 py-4 flex items-start gap-4 transition-all font-bricolage ';
              if (reviewSubmitted) {
                if (showCorrect) {
                  cls +=
                    'bg-[var(--color-success)]/12 border-[var(--color-success)]/40 text-[var(--color-text)] shadow-[0_0_24px_rgba(16,185,129,0.15)]';
                } else if (showWrong) {
                  cls +=
                    'bg-[var(--color-error)]/12 border-[var(--color-error)]/40 text-[var(--color-text)] shadow-[0_0_24px_rgba(239,68,68,0.15)]';
                } else {
                  cls +=
                    'bg-[var(--color-surface)]/40 border-[var(--color-border)] text-[var(--color-text-muted)] opacity-60';
                }
              } else if (isSelected) {
                cls +=
                  'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/50 text-[var(--color-text)] shadow-[0_0_24px_rgba(36,107,253,0.18)]';
              } else {
                cls +=
                  'bg-[var(--color-surface)]/40 border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface)]/70 hover:-translate-y-0.5 cursor-pointer';
              }

              return (
                <button
                  key={i}
                  onClick={() => !reviewSubmitted && setSelected(i)}
                  disabled={reviewSubmitted}
                  className={cls}
                  data-testid={`quiz-option-${i}`}
                  data-selected={isSelected}
                  data-correct={showCorrect || undefined}
                  data-wrong={showWrong || undefined}
                >
                  <div
                    className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-mono text-xs font-semibold border ${
                      showCorrect
                        ? 'bg-[var(--color-success)] border-[var(--color-success)] text-white'
                        : showWrong
                        ? 'bg-[var(--color-error)] border-[var(--color-error)] text-white'
                        : isSelected
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {showCorrect ? (
                      <CheckCircle2 size={16} />
                    ) : showWrong ? (
                      <XCircle size={16} />
                    ) : (
                      String.fromCharCode(65 + i)
                    )}
                  </div>
                  <span className="flex-1 pt-1 text-sm sm:text-base leading-relaxed">
                    {typeof opt === 'string' ? opt : opt?.text || JSON.stringify(opt)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {reviewSubmitted && explanation && (
            <div
              className={`rounded-2xl p-5 sm:p-6 border mb-6 animate-vv-slide-in ${
                isCorrect
                  ? 'bg-[var(--color-success)]/8 border-[var(--color-success)]/25'
                  : 'bg-[var(--color-accent-purple)]/8 border-[var(--color-accent-purple)]/25'
              }`}
              data-testid="quiz-explanation-card"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isCorrect
                      ? 'bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)]'
                      : 'bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)]'
                  }`}
                >
                  <Lightbulb size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`font-clash text-sm font-semibold mb-1.5 ${
                      isCorrect ? 'text-[var(--color-success)]' : 'text-[var(--color-accent-purple)]'
                    }`}
                  >
                    {isCorrect ? 'Nailed it!' : 'Here\'s the thinking'}
                  </div>
                  <p className="text-sm text-[var(--color-text)] font-bricolage leading-relaxed whitespace-pre-wrap">
                    {explanation}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {!reviewSubmitted ? (
              <button
                onClick={handleSubmit}
                disabled={selected == null}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
                data-testid="quiz-submit-btn"
              >
                Submit Answer
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all animate-vv-fade-up"
                data-testid="quiz-next-btn"
              >
                {isLast ? (isReview ? 'Back to Session' : 'See Results') : 'Next Question'}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes vvFadeUp { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes vvSlideIn { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-vv-fade-up { animation: vvFadeUp .28s ease-out both; }
        .animate-vv-slide-in { animation: vvSlideIn .35s cubic-bezier(.2,.7,.3,1) both; }
      `}</style>
    </div>
  );
}

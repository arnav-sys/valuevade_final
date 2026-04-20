import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { markPhaseComplete } from '../utils/progress';
import { getNextPhaseRoute } from '../utils/progress';
import {
  CheckCircle2, XCircle, ArrowRight, RotateCcw, BookOpen, Sparkles,
  ChevronDown, ChevronUp, Trophy,
} from 'lucide-react';

const PASS_THRESHOLD = 0.7;

function Confetti() {
  const pieces = Array.from({ length: 36 });
  const colors = ['#246BFD', '#6A5CFF', '#FF6AC1', '#10B981', '#F59E0B'];
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2.4 + Math.random() * 1.6;
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 6;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: '-10px',
              width: size,
              height: size * 1.4,
              background: color,
              borderRadius: 2,
              opacity: 0.9,
              animation: `vvQuizConfettiFall ${duration}s cubic-bezier(.2,.7,.3,1) ${delay}s forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes vvQuizConfettiFall {
          0%   { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

function CircularScore({ score, total, passed }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = passed ? 'var(--color-success)' : 'var(--color-error)';

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-clash text-4xl font-bold text-[var(--color-text)]" data-testid="quiz-score-pct">{pct}%</div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mt-1" data-testid="quiz-score-text">
          {score} / {total}
        </div>
      </div>
    </div>
  );
}

export default function QuizCompletePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const { answers = [], questions = [] } = location.state || {};

  const score = useMemo(
    () => answers.filter((a) => a.is_correct).length,
    [answers]
  );
  const total = questions.length || answers.length;
  const percentage = total ? score / total : 0;
  const passed = percentage >= PASS_THRESHOLD;

  const [showConfetti, setShowConfetti] = useState(passed);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [saved, setSaved] = useState(false);
  const [nextRoute, setNextRoute] = useState({ phase: 'interview', route: 'interview/start', label: 'Interview' });

  // Save results once
  useEffect(() => {
    let mounted = true;
    async function save() {
      if (saved || !user?.id || !sessionId || total === 0) return;
      try {
        // user_sessions schema only guarantees quiz_score (int) —
        // quiz_total/quiz_attempts/quiz_passed are derived client-side.
        const scoreData = { quiz_score: score };

        if (passed) {
          const res = await markPhaseComplete(sessionId, 'quiz', scoreData);
          if (!res?.success) {
            console.error('[quiz] markPhaseComplete failed:', res?.error);
          } else if (mounted && res.data) {
            setNextRoute(getNextPhaseRoute(res.data, 'quiz'));
          }
        } else {
          // Not passing: record latest score only, don't flip quiz_completed.
          const { error: upErr } = await supabase
            .from('user_sessions')
            .update(scoreData)
            .eq('id', sessionId);
          if (upErr) console.error('[quiz] score update failed:', upErr.message);

          // Still compute next route so "Continue Anyway" skips already-done phases.
          const { data: sess } = await supabase
            .from('user_sessions')
            .select('notes_completed, quiz_completed, interview_completed, simulation_completed')
            .eq('id', sessionId)
            .maybeSingle();
          if (mounted && sess) {
            // Don't flip quiz — user hasn't passed it
            setNextRoute(getNextPhaseRoute({ ...sess, quiz_completed: true }, 'quiz'));
          }
        }
      } catch (err) {
        console.error('[quiz] save error:', err);
      } finally {
        if (mounted) setSaved(true);
      }
    }
    save();
    return () => { mounted = false; };
  }, [saved, user?.id, sessionId, score, total, passed]);

  useEffect(() => {
    if (!passed) return;
    const t = setTimeout(() => setShowConfetti(false), 3800);
    return () => clearTimeout(t);
  }, [passed]);

  // Guard: if user lands here without state, send back
  useEffect(() => {
    if (!location.state || total === 0) {
      // brief delay so refreshes don't feel janky
    }
  }, [location.state, total]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden px-4 py-10 sm:py-14">
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.06] blur-[140px] pointer-events-none" />

      {showConfetti && <Confetti />}

      <div className="relative z-10 max-w-2xl mx-auto" data-testid="quiz-complete-content">
        {/* Hero */}
        <div className="text-center mb-10">
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-[0.2em] mb-5 ${
              passed
                ? 'bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)]'
                : 'bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)]'
            }`}
            data-testid="quiz-complete-badge"
          >
            {passed ? <Trophy size={12} /> : <Sparkles size={12} />}
            {passed ? 'Quiz passed' : 'Keep going'}
          </div>

          <h1 className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="quiz-complete-title">
            {passed ? 'Well done!' : 'Not quite — and that\'s okay.'}
          </h1>
          <p className="text-[var(--color-text-muted)] font-bricolage mb-8 max-w-md mx-auto leading-relaxed" data-testid="quiz-complete-subtitle">
            {passed
              ? 'You\'ve shown you\'ve got the fundamentals. Time to see how it feels in conversation.'
              : 'The hardest questions teach the most. Revisit the notes and take another shot whenever you\'re ready.'}
          </p>

          <CircularScore score={score} total={total} passed={passed} />

          <div className="mt-5 text-sm text-[var(--color-text-muted)] font-bricolage" data-testid="quiz-score-summary">
            <span className="font-semibold text-[var(--color-text)]">{score} / {total} Correct</span>
            <span className="mx-2 text-[var(--color-text-faint)]">·</span>
            <span>{passed ? 'Above' : 'Below'} 70% threshold</span>
          </div>
        </div>

        {/* Breakdown */}
        {questions.length > 0 && (
          <div className="glass-card rounded-2xl p-4 sm:p-5 mb-8" data-testid="quiz-breakdown">
            <div className="flex items-center justify-between px-1 pb-3 mb-2 border-b border-[var(--color-border)]">
              <h2 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                Review your answers
              </h2>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{total} questions</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {questions.map((qq, i) => {
                const a = answers[i];
                const isCorrect = !!a?.is_correct;
                const isOpen = expandedIdx === i;
                const userOpt = a != null && a.selected_index != null ? qq.options?.[a.selected_index] : null;
                const correctOpt = qq.options?.[qq.correct_answer_index];
                return (
                  <div key={qq.id || i} className="py-3" data-testid={`quiz-breakdown-item-${i}`}>
                    <button
                      onClick={() => setExpandedIdx(isOpen ? null : i)}
                      className="w-full flex items-center gap-3 text-left group"
                      data-testid={`quiz-breakdown-toggle-${i}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${
                          isCorrect
                            ? 'bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)]'
                            : 'bg-[var(--color-error)]/15 border border-[var(--color-error)]/30 text-[var(--color-error)]'
                        }`}
                      >
                        {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-mono text-[var(--color-text-faint)] mb-0.5">Q{i + 1}</div>
                        <div className="text-sm font-bricolage text-[var(--color-text)] truncate group-hover:text-[var(--color-primary)] transition-colors">
                          {qq.question}
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronUp size={16} className="text-[var(--color-text-muted)] shrink-0" />
                      ) : (
                        <ChevronDown size={16} className="text-[var(--color-text-muted)] shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="pl-10 pr-1 pt-3 space-y-2 animate-vv-slide-in" data-testid={`quiz-breakdown-detail-${i}`}>
                        <div className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed">
                          {qq.question}
                        </div>
                        <div className="rounded-lg px-3 py-2 bg-[var(--color-surface)]/40 border border-[var(--color-border)]">
                          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Your answer</div>
                          <div className={`text-sm font-bricolage ${isCorrect ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                            {userOpt ? (typeof userOpt === 'string' ? userOpt : JSON.stringify(userOpt)) : '— (no answer)'}
                          </div>
                        </div>
                        {!isCorrect && (
                          <div className="rounded-lg px-3 py-2 bg-[var(--color-success)]/8 border border-[var(--color-success)]/25">
                            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-success)] mb-1">Correct answer</div>
                            <div className="text-sm font-bricolage text-[var(--color-text)]">
                              {correctOpt ? (typeof correctOpt === 'string' ? correctOpt : JSON.stringify(correctOpt)) : '—'}
                            </div>
                          </div>
                        )}
                        {qq.explanation && (
                          <div className="rounded-lg px-3 py-2 bg-[var(--color-accent-purple)]/8 border border-[var(--color-accent-purple)]/25">
                            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-accent-purple)] mb-1">Explanation</div>
                            <div className="text-sm font-bricolage text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
                              {qq.explanation}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3" data-testid="quiz-complete-ctas">
          {passed ? (
            <button
              onClick={() => navigate(`/session/${sessionId}/${nextRoute.route}`)}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
              data-testid="quiz-continue-interview"
            >
              {nextRoute.phase ? `Continue to ${nextRoute.label}` : 'Complete Session'} <ArrowRight size={16} />
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to={`/session/${sessionId}/notes`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold font-bricolage hover:border-[var(--color-primary)]/40 transition-all"
                data-testid="quiz-review-notes"
              >
                <BookOpen size={15} /> Review Notes
              </Link>
              <button
                onClick={() => navigate(`/session/${sessionId}/quiz`)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
                data-testid="quiz-retry"
              >
                <RotateCcw size={15} /> Retry Quiz
              </button>
            </div>
          )}

          <button
            onClick={() => navigate(`/session/${sessionId}/${nextRoute.route}`)}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/60 border border-transparent hover:border-[var(--color-border)] transition-all"
            data-testid="quiz-continue-anyway"
          >
            Continue Anyway <ArrowRight size={14} />
          </button>

          <Link
            to="/dashboard"
            className="text-center text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] font-mono mt-1"
            data-testid="quiz-back-dashboard"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes vvSlideIn { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-vv-slide-in { animation: vvSlideIn .28s cubic-bezier(.2,.7,.3,1) both; }
      `}</style>
    </div>
  );
}

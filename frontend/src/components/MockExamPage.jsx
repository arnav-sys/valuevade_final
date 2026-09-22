/**
 * MockExamPage, the timed mock exam experience.
 * Route: /module/:moduleId/mock-exam
 * Receives attempt_id via location.state from MockExamStartPage.
 *
 * Features:
 *  - Countdown timer (120 min by default), red when < 10 min
 *  - Question navigator pill-grid (green = answered, gray = unanswered)
 *  - MCQ question card with A–D options
 *  - Auto-submit when timer hits zero
 *  - Flag individual questions for review
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import {
  Clock, AlertCircle, ChevronLeft, ChevronRight, Flag, Send, Loader2,
} from 'lucide-react';
import AILoader from './common/AILoader';

const API = process.env.REACT_APP_BACKEND_URL;

async function authedGet(path, tok) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function authedPost(path, tok, body) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

function pad(n) { return String(n).padStart(2, '0'); }
function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export default function MockExamPage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, session } = useAuth();

  const attemptId = location.state?.attempt_id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionIndex: selectedOptionIndex }
  const [flagged, setFlagged] = useState({}); // { questionIndex: bool }
  const [timeLeft, setTimeLeft] = useState(7200); // seconds, overridden after load
  const [submitting, setSubmitting] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);
  const submittingRef = useRef(false);

  // Load exam + questions
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!session?.access_token) { setLoading(false); return; }
      if (!attemptId) { setLoading(false); navigate(`/module/${moduleId}/mock-exam/start`, { replace: true }); return; }
      setLoading(true); setError(null);
      try {
        const data = await authedGet(`/api/mock-exams/${moduleId}`, session.access_token);
        if (!mounted) return;
        setExam(data.exam);
        setQuestions(data.questions || []);
        setTimeLeft((data.exam?.time_limit_minutes || 120) * 60);
      } catch (e) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [moduleId, session?.access_token, attemptId, navigate]);

  // Submit handler (used both manually and by auto-submit)
  const submitExam = useCallback(async (isAuto = false) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    clearInterval(timerRef.current);
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    try {
      const answersArr = questions.map((_, i) => answers[i] ?? -1);
      const result = await authedPost(`/api/mock-exams/${moduleId}/submit`, session?.access_token, {
        attempt_id: attemptId,
        answers: answersArr,
        time_taken_seconds: elapsed,
      });
      navigate(`/module/${moduleId}/mock-exam/result`, { state: { result, exam } });
    } catch (e) {
      alert(`Submission failed: ${e.message}. Please try again.`);
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [questions, answers, moduleId, attemptId, exam, navigate, session?.access_token]);

  // Countdown timer
  useEffect(() => {
    if (loading || !exam) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!autoSubmitted && !submittingRef.current) {
            setAutoSubmitted(true);
            submitExam(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [loading, exam, autoSubmitted, submitExam]);

  const selectAnswer = (qIdx, optIdx) => {
    setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };
  const toggleFlag = (qIdx) => {
    setFlagged((prev) => ({ ...prev, [qIdx]: !prev[qIdx] }));
  };

  const answeredCount = Object.keys(answers).length;
  const isLowTime = timeLeft < 600; // < 10 minutes
  const isCriticalTime = timeLeft < 120; // < 2 minutes

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center pt-16 lg:pt-0">
          <AILoader
            variant="inline"
            title="Preparing your mock exam"
            messages={['Loading questions…', 'Setting the timer…', 'Almost ready…']}
            testid="mock-exam-ai-loader"
          />
        </main>
      </div>
    );
  }

  if (error || !questions.length) {
    return (
      <div className="flex min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center pt-16 lg:pt-0">
          <div className="text-center">
            <AlertCircle size={28} className="text-red-500 mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-muted)]">{error || 'No questions found.'}</p>
          </div>
        </main>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]" data-testid="mock-exam-page">
      <Sidebar />

      <main className="flex-1 min-w-0 pt-16 lg:pt-0 flex flex-col overflow-hidden">

        {/* Top bar, timer + progress */}
        <div
          className={`flex-shrink-0 flex items-center justify-between px-4 sm:px-8 py-3 border-b ${
            isCriticalTime
              ? 'border-red-500/40 bg-red-500/5'
              : isLowTime
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-[var(--color-border)]'
          }`}
          data-testid="mock-exam-topbar"
        >
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-[var(--color-text-muted)] hidden sm:block">
              {exam?.title}
            </div>
            <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
              {answeredCount}/{questions.length} answered
            </span>
          </div>

          {/* Timer */}
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold tracking-wider border ${
              isCriticalTime
                ? 'text-red-400 border-red-500/40 bg-red-500/10 animate-pulse'
                : isLowTime
                ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                : 'text-[var(--color-text)] border-[var(--color-border)] bg-[var(--color-surface)]'
            }`}
            data-testid="mock-exam-timer"
          >
            <Clock size={16} />
            {formatTime(timeLeft)}
          </div>

          <button
            onClick={() => {
              if (!window.confirm(`Submit the exam now? You have answered ${answeredCount} of ${questions.length} questions.`)) return;
              submitExam(false);
            }}
            disabled={submitting}
            data-testid="mock-exam-submit-btn"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left, question navigator */}
          <div
            className="w-52 flex-shrink-0 border-r border-[var(--color-border)] overflow-y-auto p-3"
            data-testid="mock-exam-nav"
          >
            <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider mb-2 px-1">
              Questions
            </p>
            <div className="grid grid-cols-5 gap-1">
              {questions.map((_, i) => {
                const answered = answers[i] !== undefined;
                const isFlagged = flagged[i];
                const isCurrent = i === current;
                return (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    data-testid={`nav-q-${i + 1}`}
                    title={`Question ${i + 1}${answered ? ' (answered)' : ''}${isFlagged ? ' (flagged)' : ''}`}
                    className={`w-8 h-8 rounded-md text-[10px] font-mono font-bold transition-all ${
                      isCurrent
                        ? 'ring-2 ring-[var(--color-primary)] ring-offset-1 bg-[var(--color-primary)] text-white'
                        : answered
                        ? isFlagged
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-[var(--color-success)]/20 text-[var(--color-success)] border border-[var(--color-success)]/30'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-1 px-1">
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
                <span className="w-3 h-3 rounded-sm bg-[var(--color-success)]/20 border border-[var(--color-success)]/30 inline-block" />
                Answered
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
                <span className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/40 inline-block" />
                Flagged
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
                <span className="w-3 h-3 rounded-sm bg-[var(--color-surface)] border border-[var(--color-border)] inline-block" />
                Unanswered
              </div>
            </div>
          </div>

          {/* Right, question card */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="max-w-2xl mx-auto">
              {/* Question header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                    Question {current + 1} of {questions.length}
                  </span>
                  {q.topic_tag && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-accent-purple)]/15 text-[var(--color-accent-purple)]">
                      {q.topic_tag}
                    </span>
                  )}
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    {q.difficulty || 'medium'}
                  </span>
                </div>
                <button
                  onClick={() => toggleFlag(current)}
                  data-testid={`flag-q-${current + 1}`}
                  title={flagged[current] ? 'Remove flag' : 'Flag for review'}
                  className={`flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border transition-all ${
                    flagged[current]
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-amber-500/40 hover:text-amber-400'
                  }`}
                >
                  <Flag size={10} /> {flagged[current] ? 'Flagged' : 'Flag'}
                </button>
              </div>

              {/* Question text */}
              <div
                className="glass-card rounded-2xl p-6 mb-5"
                data-testid={`mock-exam-question-${current + 1}`}
              >
                <p className="text-[var(--color-text)] text-base leading-relaxed font-bricolage">
                  {q.question}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3" data-testid={`mock-exam-options-${current + 1}`}>
                {(q.options || []).map((opt, oi) => {
                  const selected = answers[current] === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() => selectAnswer(current, oi)}
                      data-testid={`mock-exam-option-${current + 1}-${oi}`}
                      className={`w-full text-left flex items-start gap-3 px-5 py-4 rounded-xl border transition-all ${
                        selected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]'
                          : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 text-[var(--color-text)]'
                      }`}
                    >
                      <span
                        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold font-mono border ${
                          selected
                            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                            : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                        }`}
                      >
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className="text-sm leading-relaxed">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8">
                <button
                  onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                  disabled={current === 0}
                  data-testid="mock-exam-prev-btn"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/40 disabled:opacity-30 transition-all"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                  {answeredCount} / {questions.length} answered
                </span>
                <button
                  onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
                  disabled={current === questions.length - 1}
                  data-testid="mock-exam-next-btn"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/40 disabled:opacity-30 transition-all"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

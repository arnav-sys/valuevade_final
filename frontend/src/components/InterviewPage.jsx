import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { evaluateAnswer } from '../utils/interviewEval';
import useTimeTracking from '../utils/useTimeTracking';
import VoiceInputButton from './VoiceInputButton';
import axios from 'axios';
import {
  ArrowLeft, ArrowRight, Send, Loader2, AlertCircle, RefreshCw,
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Sparkles,
  User as UserIcon, Briefcase,
} from 'lucide-react';

const MIN_CHARS = 50;
const MAX_CHARS = 2000; // ~300–350 words — plenty for a thorough finance answer
const TYPING_MS = 900;
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function evaluateWithLLM({ question_id, question, response, context, evaluation_criteria, model_answer, session_title }) {
  const { data } = await axios.post(
    `${API}/interview/evaluate`,
    { question_id, question, response, context, evaluation_criteria, model_answer, session_title },
    { timeout: 30000 }
  );
  return data;
}

function InterviewerAvatar({ size = 40 }) {
  return (
    <div
      className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent-purple)] flex items-center justify-center shrink-0 shadow-[0_4px_16px_rgba(36,107,253,0.25)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Briefcase size={size * 0.45} className="text-white" strokeWidth={2.5} />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1" data-testid="interview-typing-dots">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]"
          style={{ animation: `vvTypingBounce 1.1s ease-in-out ${i * 0.18}s infinite` }}
        />
      ))}
    </div>
  );
}

function PreviousExchange({ item, index, isExpanded, onToggle }) {
  const firstLine = (item.response || '').split('\n')[0] || '';
  return (
    <div className="glass-card rounded-2xl px-4 py-3 mb-3" data-testid={`interview-prev-${index}`}>
      <button
        onClick={onToggle}
        className="w-full text-left flex items-start gap-3 group"
        data-testid={`interview-prev-toggle-${index}`}
      >
        <span className="text-[10px] font-mono text-[var(--color-text-faint)] mt-1 shrink-0">Q{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bricolage text-[var(--color-text)] truncate group-hover:text-[var(--color-primary)] transition-colors">
            {item.questionText}
          </div>
          {!isExpanded && (
            <div className="text-xs text-[var(--color-text-muted)] font-bricolage truncate mt-0.5">
              {firstLine || '—'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
            {item.scores.overall}/5
          </span>
          {isExpanded ? (
            <ChevronUp size={14} className="text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="mt-3 pl-9 text-sm font-bricolage text-[var(--color-text-muted)] whitespace-pre-wrap leading-relaxed animate-vv-slide-in">
          {item.response}
        </div>
      )}
    </div>
  );
}

export default function InterviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);

  const [phase, setPhase] = useState('typing'); // typing -> asking -> answering -> evaluating -> feedback
  const [answer, setAnswer] = useState('');
  const [results, setResults] = useState([]); // [{question_id, questionText, response, scores, feedback}]
  const [expandedPrev, setExpandedPrev] = useState(null);
  const [showModelAnswer, setShowModelAnswer] = useState(false);

  const scrollRef = useRef(null);

  // Track active time on this page → user_stats.total_time_minutes
  useTimeTracking(user?.id);

  // Load
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
        setSessionTitle(sess.title || '');

        if (!sess.master_session_id) {
          setQuestions([]);
          return;
        }

        const { data: qs, error: qErr } = await supabase
          .from('master_interview_questions')
          .select('*')
          .eq('session_id', sess.master_session_id)
          .order('order_index')
          .limit(5);
        if (qErr) throw qErr;
        if (!mounted) return;
        setQuestions(qs || []);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load interview');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [sessionId, user?.id]);

  const total = questions.length;
  const q = questions[idx];
  const isLast = idx === total - 1;
  const isReview = !!session?.interview_completed;

  const questionText = useMemo(() => {
    if (!q) return '';
    return q.question || q.text || q.prompt || '';
  }, [q]);

  const contextText = useMemo(() => {
    if (!q) return '';
    return q.context || q.setup || q.scenario || '';
  }, [q]);

  const modelAnswer = useMemo(() => {
    if (!q) return '';
    return q.sample_strong_answer || q.sample_answer || q.model_answer || q.ideal_answer || '';
  }, [q]);

  // Animate typing → asking when a new question loads
  useEffect(() => {
    if (!q) return;
    setPhase('typing');
    setAnswer('');
    setShowModelAnswer(false);
    // In review mode, skip answering — show question + model answer immediately
    if (isReview) {
      const t = setTimeout(() => setPhase('review'), TYPING_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase('answering'), TYPING_MS);
    return () => clearTimeout(t);
  }, [q, isReview]);

  // Auto-scroll on phase change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [phase, idx]);

  const [sessionTitle, setSessionTitle] = useState('');
  const canSubmit = answer.trim().length >= MIN_CHARS && answer.length <= MAX_CHARS && phase === 'answering';

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !q) return;
    setPhase('evaluating');

    // Primary path: LLM-based evaluation via backend.
    // Fallback: template evaluator (keeps flow usable if LLM is down).
    let scores;
    let feedback;
    try {
      const llm = await evaluateWithLLM({
        question_id: q.id,
        question: questionText,
        response: answer.trim(),
        context: contextText,
        evaluation_criteria: q.evaluation_criteria || {},
        model_answer: modelAnswer,
        session_title: sessionTitle,
      });
      scores = llm.scores;
      feedback = llm.feedback;
    } catch (err) {
      console.error('[interview] LLM eval failed, falling back to template:', err?.response?.data || err?.message);
      const evalResult = evaluateAnswer(answer, q.evaluation_criteria);
      scores = evalResult.scores;
      feedback = evalResult.feedback;
    }

    setResults((prev) => [
      ...prev,
      {
        question_id: q.id,
        questionText,
        response: answer.trim(),
        scores,
        feedback,
        modelAnswer,
      },
    ]);
    setPhase('feedback');
  }, [canSubmit, q, answer, questionText, contextText, modelAnswer, sessionTitle]);

  const handleNext = useCallback(() => {
    if (isReview) {
      if (isLast) {
        navigate(`/session/${sessionId}/start`);
        return;
      }
      setIdx((i) => i + 1);
      return;
    }
    if (phase !== 'feedback') return;
    if (isLast) {
      navigate(`/session/${sessionId}/interview/complete`, {
        state: { results: [...results] },
      });
      return;
    }
    setIdx((i) => i + 1);
  }, [isReview, phase, isLast, navigate, sessionId, results]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center" data-testid="interview-loading">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6" data-testid="interview-error">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
            <AlertCircle size={28} className="text-[var(--color-error)]" />
          </div>
          <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load interview</p>
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
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6" data-testid="interview-empty">
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center mb-5">
            <AlertCircle size={28} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="text-[var(--color-text)] font-bricolage mb-2">No interview questions yet</p>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">
            This session doesn't have any interview questions available.
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

  const progress = (idx / total) * 100 + (phase === 'feedback' ? (1 / total) * 100 : 0);
  const currentResult = phase === 'feedback' ? results[results.length - 1] : null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative" data-testid="interview-page">
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.05] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.05] blur-[140px] pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/85 backdrop-blur-xl border-b border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-3">
          <div className="flex items-center justify-between gap-4 mb-2">
            <Link
              to={`/session/${sessionId}/start`}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors group font-bricolage"
              data-testid="interview-exit-link"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Exit
            </Link>
            <div className="flex items-center gap-2.5" data-testid="interview-header-interviewer">
              <InterviewerAvatar size={32} />
              <div className="text-left hidden sm:block">
                <div className="font-clash text-sm font-semibold text-[var(--color-text)] leading-tight">Mock Interview</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Senior Analyst</div>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-2" data-testid="interview-progress-text">
              {isReview && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)]" data-testid="interview-review-badge">
                  <CheckCircle2 size={10} /> REVIEW
                </span>
              )}
              Q {idx + 1} / {total}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
              data-testid="interview-progress-bar"
            />
          </div>
        </div>
      </div>

      <main ref={scrollRef} className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 pb-24">
        {/* Previous exchanges */}
        {results.length > 0 && idx > 0 && (
          <div className="mb-6" data-testid="interview-prev-list">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
              Previous exchanges
            </div>
            {results.slice(0, idx).map((item, i) => (
              <PreviousExchange
                key={i}
                item={item}
                index={i}
                isExpanded={expandedPrev === i}
                onToggle={() => setExpandedPrev(expandedPrev === i ? null : i)}
              />
            ))}
          </div>
        )}

        {/* Current question block */}
        <div key={`q-${idx}`} className="animate-vv-fade-up">
          {/* Context */}
          {contextText && phase !== 'typing' && (
            <div className="mb-4 rounded-2xl px-5 py-4 bg-[var(--color-surface)]/40 border border-[var(--color-border)] border-dashed" data-testid="interview-context">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1.5">Setup</div>
              <p className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                {contextText}
              </p>
            </div>
          )}

          {/* Interviewer bubble */}
          <div className="flex items-start gap-3 mb-6" data-testid="interview-question-bubble">
            <InterviewerAvatar size={40} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1.5">Interviewer</div>
              <div className="inline-block max-w-full rounded-2xl rounded-tl-sm px-5 py-4 bg-[var(--color-surface)]/80 border border-[var(--color-border)]">
                {phase === 'typing' ? (
                  <TypingDots />
                ) : (
                  <p className="text-base sm:text-lg font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap" data-testid="interview-question-text">
                    {questionText}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Answering */}
          {(phase === 'answering' || phase === 'evaluating') && (
            <div className="flex items-start gap-3 mb-4 flex-row-reverse animate-vv-fade-up" data-testid="interview-answer-block">
              <div className="w-10 h-10 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                <UserIcon size={18} className="text-[var(--color-text-muted)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1.5 text-right">You</div>
                <div className="rounded-2xl rounded-tr-sm p-1 bg-gradient-to-br from-[var(--color-primary)]/30 to-[var(--color-accent-purple)]/30">
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value.slice(0, MAX_CHARS))}
                    disabled={phase === 'evaluating'}
                    placeholder="Think through your answer. Structure it — conclusion first, then reasoning…"
                    rows={6}
                    maxLength={MAX_CHARS}
                    className="w-full rounded-[14px] px-4 py-3.5 bg-[var(--bg-primary)] text-[var(--color-text)] text-sm sm:text-base font-bricolage placeholder:text-[var(--color-text-faint)] resize-none focus:outline-none leading-relaxed disabled:opacity-60"
                    data-testid="interview-response-textarea"
                  />
                </div>
                <div className="flex items-center justify-between mt-2 gap-3 flex-wrap">
                  {(() => {
                    const len = answer.length;
                    const trimmedLen = answer.trim().length;
                    const remaining = MAX_CHARS - len;
                    const tooShort = trimmedLen < MIN_CHARS;
                    const nearMax = remaining <= 100;
                    const atMax = remaining <= 0;
                    const colorCls = atMax
                      ? 'text-[var(--color-error)]'
                      : nearMax
                      ? 'text-[#F59E0B]'
                      : tooShort
                      ? 'text-[var(--color-text-muted)]'
                      : 'text-[var(--color-success)]';
                    return (
                      <span
                        className={`text-[10px] font-mono ${colorCls}`}
                        data-testid="interview-char-count"
                      >
                        {tooShort
                          ? `${trimmedLen} / ${MIN_CHARS} chars min`
                          : `${len} / ${MAX_CHARS} chars`}
                      </span>
                    );
                  })()}
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <VoiceInputButton
                      disabled={phase === 'evaluating' || answer.length >= MAX_CHARS}
                      prompt={questions[idx]?.question}
                      onTranscribed={(text) => {
                        setAnswer((prev) => {
                          const trimmed = (prev || '').trimEnd();
                          const merged = !trimmed ? text : `${trimmed} ${text}`;
                          return merged.slice(0, MAX_CHARS);
                        });
                      }}
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
                      data-testid="interview-submit-response"
                    >
                      {phase === 'evaluating' ? (
                        <>
                          <Loader2 size={15} className="animate-spin" /> Evaluating…
                        </>
                      ) : (
                        <>
                          <Send size={15} /> Submit Response
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback */}
          {phase === 'feedback' && currentResult && (
            <div className="space-y-3 animate-vv-slide-in" data-testid="interview-feedback-card">
              {/* User's response bubble (collapsed-style) */}
              <div className="flex items-start gap-3 flex-row-reverse">
                <div className="w-10 h-10 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                  <UserIcon size={18} className="text-[var(--color-text-muted)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1.5 text-right">Your answer</div>
                  <div className="rounded-2xl rounded-tr-sm px-5 py-4 bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/20">
                    <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap" data-testid="interview-submitted-response">
                      {currentResult.response}
                    </p>
                  </div>
                </div>
              </div>

              {/* Score pills */}
              <div className="flex flex-wrap gap-2 justify-end" data-testid="interview-feedback-scores">
                <ScorePill label="Technical" value={currentResult.scores.technical} />
                <ScorePill label="Clarity" value={currentResult.scores.communication} />
                <ScorePill label="Structure" value={currentResult.scores.structure} />
                <ScorePill label="Overall" value={currentResult.scores.overall} emphasis />
              </div>

              {/* Strengths */}
              <div className="rounded-2xl p-5 bg-[var(--color-success)]/8 border border-[var(--color-success)]/25" data-testid="interview-feedback-strengths">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)] flex items-center justify-center">
                    <CheckCircle2 size={15} />
                  </div>
                  <h3 className="font-clash text-sm font-semibold text-[var(--color-success)] uppercase tracking-[0.12em]">Strengths</h3>
                </div>
                <ul className="space-y-2 pl-1">
                  {currentResult.feedback.strengths.map((s, i) => (
                    <li key={i} className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed flex gap-2" data-testid={`interview-strength-${i}`}>
                      <span className="text-[var(--color-success)] shrink-0">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Improvements */}
              <div className="rounded-2xl p-5 bg-[#F59E0B]/8 border border-[#F59E0B]/25" data-testid="interview-feedback-improvements">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] flex items-center justify-center">
                    <AlertTriangle size={15} />
                  </div>
                  <h3 className="font-clash text-sm font-semibold text-[#F59E0B] uppercase tracking-[0.12em]">Areas for improvement</h3>
                </div>
                <ul className="space-y-2 pl-1">
                  {currentResult.feedback.improvements.map((s, i) => (
                    <li key={i} className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed flex gap-2" data-testid={`interview-improvement-${i}`}>
                      <span className="text-[#F59E0B] shrink-0">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Model answer collapsible */}
              {currentResult.modelAnswer && (
                <div className="rounded-2xl bg-[var(--color-accent-purple)]/8 border border-[var(--color-accent-purple)]/25 overflow-hidden" data-testid="interview-model-answer">
                  <button
                    onClick={() => setShowModelAnswer((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[var(--color-accent-purple)]/5 transition-colors"
                    data-testid="interview-model-answer-toggle"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] flex items-center justify-center">
                        <Sparkles size={14} />
                      </div>
                      <h3 className="font-clash text-sm font-semibold text-[var(--color-accent-purple)] uppercase tracking-[0.12em]">Model answer</h3>
                    </div>
                    {showModelAnswer ? (
                      <ChevronUp size={16} className="text-[var(--color-accent-purple)]" />
                    ) : (
                      <ChevronDown size={16} className="text-[var(--color-accent-purple)]" />
                    )}
                  </button>
                  {showModelAnswer && (
                    <div className="px-5 pb-5 border-t border-[var(--color-accent-purple)]/20 animate-vv-slide-in">
                      <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap pt-3" data-testid="interview-model-answer-text">
                        {currentResult.modelAnswer}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Next */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
                  data-testid="interview-next-btn"
                >
                  {isLast ? 'See Results' : 'Next Question'}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
          {/* Review mode block — show question + model answer with a Next/Back CTA */}
          {phase === 'review' && (
            <div className="mt-2 space-y-5 animate-vv-fade-up" data-testid="interview-review-block">
              {modelAnswer && (
                <div className="rounded-2xl bg-[var(--color-accent-purple)]/8 border border-[var(--color-accent-purple)]/25 overflow-hidden">
                  <button
                    onClick={() => setShowModelAnswer((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[var(--color-accent-purple)]/5 transition-colors"
                    data-testid="interview-review-model-toggle"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] flex items-center justify-center">
                        <Sparkles size={14} />
                      </div>
                      <h3 className="font-clash text-sm font-semibold text-[var(--color-accent-purple)] uppercase tracking-[0.12em]">Model answer</h3>
                    </div>
                    {showModelAnswer ? (
                      <ChevronUp size={16} className="text-[var(--color-accent-purple)]" />
                    ) : (
                      <ChevronDown size={16} className="text-[var(--color-accent-purple)]" />
                    )}
                  </button>
                  {showModelAnswer && (
                    <div className="px-5 pb-5 border-t border-[var(--color-accent-purple)]/20 animate-vv-slide-in">
                      <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap pt-3">
                        {modelAnswer}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl px-5 py-4 bg-[var(--color-success)]/6 border border-[var(--color-success)]/25 text-sm font-bricolage text-[var(--color-text-muted)]">
                You already completed this interview{session?.interview_score != null ? ` with an overall score of ${session.interview_score}%` : ''}. You can step through the questions and review the model answers — your previous evaluations aren&apos;t kept after completion.
              </div>

              <div className="flex justify-end pt-2 gap-2">
                {idx > 0 && (
                  <button
                    onClick={() => setIdx((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold font-bricolage hover:bg-[var(--color-surface-hover)] transition-all"
                    data-testid="interview-review-prev"
                  >
                    <ArrowLeft size={16} /> Previous
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
                  data-testid="interview-review-next"
                >
                  {isLast ? 'Back to Session' : 'Next Question'}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes vvTypingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
        @keyframes vvFadeUp { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes vvSlideIn { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-vv-fade-up { animation: vvFadeUp .28s ease-out both; }
        .animate-vv-slide-in { animation: vvSlideIn .32s cubic-bezier(.2,.7,.3,1) both; }
      `}</style>
    </div>
  );
}

function ScorePill({ label, value, emphasis }) {
  const color = value >= 4 ? 'var(--color-success)' : value >= 3 ? 'var(--color-primary)' : '#F59E0B';
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-[0.12em] ${
        emphasis
          ? 'bg-[var(--color-surface)] border shadow-[0_0_16px_rgba(36,107,253,0.15)]'
          : 'bg-[var(--color-surface)]/60 border'
      }`}
      style={{ color, borderColor: `${color}55` }}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-bold">{value}/5</span>
    </div>
  );
}

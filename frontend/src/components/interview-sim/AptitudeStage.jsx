import { useEffect, useMemo, useRef, useState } from 'react';
import { Timer, Loader2, ArrowRight, CheckCircle2, XCircle, AlertTriangle, PlayCircle, ChevronDown } from 'lucide-react';
import { interviewSimFetch } from '../../utils/interviewSim';
import { SimpleMarkdown } from './simShared';
import { toast } from 'sonner';

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AptitudeStage({ attempt, sim, onAdvance }) {
  const meta = sim.process_meta?.aptitude || {};
  const [test, setTest] = useState(null);          // {questions, started_at, time_limit_minutes, pass_pct}
  const [answers, setAnswers] = useState({});
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);       // response of /submit
  const [now, setNow] = useState(Date.now());
  const submittedRef = useRef(false);

  const alreadyStarted = !!attempt.stage_data?.aptitude?.questions;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const deadline = useMemo(() => {
    if (!test?.started_at) return null;
    return new Date(test.started_at).getTime() + (test.time_limit_minutes || 15) * 60000;
  }, [test]);
  const secondsLeft = deadline ? Math.max(0, Math.floor((deadline - now) / 1000)) : null;

  const start = async () => {
    setStarting(true);
    try {
      // The backend generates the 12 aptitude questions via an LLM which
      // takes ~30-45s — too slow for a single HTTP request (ingress 520).
      // Poll until questions are ready (max ~90s).
      let r = await interviewSimFetch(`/api/interview-sim/attempt/${attempt.id}/aptitude/start`, { method: 'POST' });
      const pollMs = Math.max(1500, (r?.poll_seconds || 3) * 1000);
      let waited = 0;
      while (r?.pending && waited < 120000) {
        await new Promise((res) => setTimeout(res, pollMs));
        waited += pollMs;
        try {
          r = await interviewSimFetch(`/api/interview-sim/attempt/${attempt.id}/aptitude/start`, { method: 'POST' });
        } catch (e) {
          // Ignore transient failures during polling; keep trying.
          console.warn('[aptitude] poll failed, retrying:', e?.message);
        }
      }
      if (r?.pending) {
        throw new Error("Questions took too long to generate. Please try again.");
      }
      if (!r?.questions?.length) {
        throw new Error("Could not load questions. Please try again.");
      }
      setTest(r);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStarting(false);
    }
  };

  const submit = async (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const list = (test?.questions || []).map((_, i) => (Number.isInteger(answers[i]) ? answers[i] : null));
      const r = await interviewSimFetch(`/api/interview-sim/attempt/${attempt.id}/aptitude/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: list }),
      });
      setResult(r);
      if (auto) toast.warning('Time up — your test was auto-submitted.');
    } catch (e) {
      submittedRef.current = false;
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit on expiry
  useEffect(() => {
    if (test && secondsLeft === 0 && !result && !submittedRef.current) submit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, test, result]);

  // ---------------- Result view ----------------
  if (result) {
    const apt = result.aptitude;
    const passed = result.passed;
    return (
      <div className="glass-card rounded-2xl p-6 sm:p-8" data-testid="aptitude-result">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-[0.2em] mb-4 ${passed ? 'bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)]' : 'bg-red-500/10 border border-red-500/25 text-red-400'}`}>
          {passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {passed ? 'Cutoff cleared' : 'Below cutoff'}
        </div>
        <h2 className="font-clash text-2xl font-bold text-[var(--color-text)] mb-1" data-testid="aptitude-score">
          {apt.score_pct}% <span className="text-base font-bricolage text-[var(--color-text-muted)] font-normal">({apt.correct}/{apt.total} correct · cutoff {meta.pass_pct || 40}%)</span>
        </h2>
        <div className="flex flex-wrap gap-2 my-4">
          {Object.entries(apt.by_topic || {}).map(([t, v]) => (
            <span key={t} className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
              {t}: {v.correct}/{v.total}
            </span>
          ))}
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4 mb-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-accent-purple)] mb-2">AI coach feedback</p>
          <SimpleMarkdown text={apt.feedback_md} />
        </div>
        <ReviewAccordion review={apt.review} />
        <div className="mt-6">
          <button
            onClick={onAdvance}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all ${passed ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)]' : 'bg-[var(--color-surface)] border border-[var(--color-border)] !text-[var(--color-text)]'}`}
            data-testid="aptitude-continue-btn"
          >
            {passed ? 'Continue to HR Interview' : 'See the final decision'} <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ---------------- Test view ----------------
  if (test) {
    const answered = Object.keys(answers).length;
    return (
      <div className="space-y-4" data-testid="aptitude-test">
        <div className="sticky top-2 z-20 glass-card rounded-xl px-4 py-3 flex items-center justify-between backdrop-blur-xl">
          <span className="text-xs font-mono text-[var(--color-text-muted)]" data-testid="aptitude-progress">
            {answered}/{test.questions.length} answered
          </span>
          <span className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold ${secondsLeft != null && secondsLeft < 120 ? 'text-red-400 animate-pulse' : 'text-[var(--color-text)]'}`} data-testid="aptitude-timer">
            <Timer size={14} /> {secondsLeft != null ? fmt(secondsLeft) : '--:--'}
          </span>
        </div>

        {test.questions.map((q, i) => (
          <div key={i} className="glass-card rounded-2xl p-5" data-testid={`aptitude-q-${i}`}>
            <div className="flex items-start gap-3 mb-3">
              <span className="text-[10px] font-mono text-[var(--color-text-faint)] mt-1 shrink-0">Q{i + 1}</span>
              <div className="flex-1">
                <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed">{q.q}</p>
                <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-faint)]">{q.topic}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  type="button"
                  onClick={() => setAnswers((p) => ({ ...p, [i]: oi }))}
                  className={`text-left px-3 py-2.5 rounded-xl border text-sm font-bricolage transition-all ${
                    answers[i] === oi
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)]/50 text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40'
                  }`}
                  data-testid={`aptitude-q-${i}-opt-${oi}`}
                >
                  <span className="font-mono text-[10px] mr-2 text-[var(--color-text-faint)]">{String.fromCharCode(65 + oi)}</span>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between gap-3 pt-2">
          {answered < test.questions.length && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-500">
              <AlertTriangle size={12} /> {test.questions.length - answered} unanswered
            </span>
          )}
          <button
            onClick={() => submit(false)}
            disabled={submitting}
            className="ml-auto inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all disabled:opacity-50"
            data-testid="aptitude-submit-btn"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
            {submitting ? 'Grading…' : 'Submit test'}
          </button>
        </div>
      </div>
    );
  }

  // ---------------- Intro view ----------------
  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8" data-testid="aptitude-intro">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)] text-[10px] font-mono uppercase tracking-[0.2em] mb-4">
        <Timer size={12} /> Online assessment
      </div>
      <h2 className="font-clash text-2xl font-bold text-[var(--color-text)] mb-3">
        {sim.firm_name} Online Aptitude Test
      </h2>
      <ul className="space-y-2 text-sm font-bricolage text-[var(--color-text)] mb-6">
        <li>• <strong>{meta.num_questions || 12} questions</strong> — numerical, data interpretation, logical &amp; verbal reasoning</li>
        <li>• <strong>{meta.time_limit_minutes || 15} minutes</strong>, timed — the test auto-submits when time runs out</li>
        <li>• Cutoff: <strong>{meta.pass_pct || 40}%</strong>. Score below it and this process ends here — just like the real thing</li>
        <li>• No calculator needed. Rough paper is allowed (real tests permit it too)</li>
      </ul>
      <button
        onClick={start}
        disabled={starting}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all disabled:opacity-50"
        data-testid="aptitude-start-btn"
      >
        {starting ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}
        {starting ? 'Preparing your test…' : alreadyStarted ? 'Resume test' : 'Start the timed test'}
      </button>
    </div>
  );
}

function ReviewAccordion({ review }) {
  const [open, setOpen] = useState(false);
  if (!review?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-bricolage font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface)]/50 transition-colors"
        data-testid="aptitude-review-toggle"
      >
        Question-by-question review
        <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="divide-y divide-[var(--color-border)]" data-testid="aptitude-review-list">
          {review.map((r, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-start gap-2">
                {r.correct
                  ? <CheckCircle2 size={14} className="text-[var(--color-success)] mt-0.5 shrink-0" />
                  : <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bricolage text-[var(--color-text)]">{r.q}</p>
                  <p className="text-[11px] font-mono text-[var(--color-text-muted)] mt-1">
                    Your answer: {r.given_index != null ? r.options[r.given_index] : '—'}
                    {!r.correct && <> · Correct: <span className="text-[var(--color-success)]">{r.options[r.correct_index]}</span></>}
                  </p>
                  {r.explanation && <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5">{r.explanation}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

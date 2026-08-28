/**
 * GuestSessionPage — full session experience for anonymous visitors.
 * Route: /try-free/:sessionId
 *
 * No account needed. Progress stored in localStorage only.
 * After completing 2 free sessions → shows enrolment paywall CTA.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DecisionMakingSim from './simulations/DecisionMakingSim';
import BookSim from './simulations/BookSim';
import {
  Play, FileText, HelpCircle, BarChart2, CheckCircle2, Loader2,
  ArrowRight, Lock, AlertCircle, ChevronLeft, ChevronRight, X as XIcon,
  Star,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// ── localStorage helpers ─────────────────────────────────────────────────────
const LS_DONE_KEY = 'vv_guest_done';   // JSON array of completed sessionIds
const sesKey  = (id) => `vv_guest_sess_${id}`;

function getProgress(sessionId) {
  try { return JSON.parse(localStorage.getItem(sesKey(sessionId)) || 'null') || {}; }
  catch { return {}; }
}
function saveProgress(sessionId, data) {
  localStorage.setItem(sesKey(sessionId), JSON.stringify({ ...getProgress(sessionId), ...data }));
}
function getDoneList() {
  try { return JSON.parse(localStorage.getItem(LS_DONE_KEY) || '[]'); }
  catch { return []; }
}
function markSessionDone(sessionId) {
  const done = getDoneList();
  if (!done.includes(sessionId)) done.push(sessionId);
  localStorage.setItem(LS_DONE_KEY, JSON.stringify(done));
}

// ── tiny fetch (no auth) ─────────────────────────────────────────────────────
async function guestFetch(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.detail || `${r.status}`);
  }
  return r.json();
}

// ── PHASE TABS ───────────────────────────────────────────────────────────────
const PHASES = [
  { key: 'video',  label: 'Video',       Icon: Play       },
  { key: 'notes',  label: 'Notes',       Icon: FileText   },
  { key: 'quiz',   label: 'Quiz',        Icon: HelpCircle },
  { key: 'sim',    label: 'Simulation',  Icon: BarChart2  },
];

// ── VIDEO PHASE ──────────────────────────────────────────────────────────────
function VideoPhase({ session, onComplete, isDone }) {
  const url = session?.lecture_url || '';
  const isYT = /youtu\.?be/.test(url);
  const ytId = isYT ? (url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1] || '') : '';

  return (
    <div className="space-y-4" data-testid="guest-video-phase">
      {url ? (
        <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] bg-black aspect-video">
          {isYT && ytId ? (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?rel=0`}
              allow="fullscreen"
              allowFullScreen
              className="w-full h-full border-0"
              title={session.title}
            />
          ) : (
            <video src={url} controls className="w-full h-full" />
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] aspect-video flex flex-col items-center justify-center gap-3 text-[var(--color-text-muted)]">
          <Play size={36} className="opacity-30" />
          <p className="text-sm font-bricolage">Video not available for this session</p>
        </div>
      )}
      <div className="flex justify-end">
        {isDone ? (
          <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 text-[var(--color-success)] text-sm font-semibold">
            <CheckCircle2 size={15} /> Watched
          </span>
        ) : (
          <button
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bricolage font-semibold hover:brightness-110 transition-all"
            data-testid="video-complete-btn"
          >
            Mark as Watched <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── NOTES PHASE ──────────────────────────────────────────────────────────────
const CARD_BG = {
  hook:      'from-amber-500/10 to-transparent border-amber-500/20',
  concept:   'from-blue-500/10 to-transparent border-blue-500/20',
  formula:   'from-purple-500/10 to-transparent border-purple-500/20',
  visual:    'from-teal-500/10 to-transparent border-teal-500/20',
  'deep-dive': 'from-indigo-500/10 to-transparent border-indigo-500/20',
  example:   'from-green-500/10 to-transparent border-green-500/20',
  mistake:   'from-red-500/10 to-transparent border-red-500/20',
  summary:   'from-slate-500/10 to-transparent border-slate-500/20',
  'study-card': 'from-pink-500/10 to-transparent border-pink-500/20',
};
const CARD_LABEL_COLOR = {
  hook:      'text-amber-500',
  concept:   'text-blue-400',
  formula:   'text-purple-400',
  visual:    'text-teal-400',
  'deep-dive': 'text-indigo-400',
  example:   'text-green-400',
  mistake:   'text-red-400',
  summary:   'text-slate-400',
  'study-card': 'text-pink-400',
};

function parseCardContent(content) {
  if (!content) return '';
  if (typeof content === 'object') {
    return content.body_md || content.content || content.text || JSON.stringify(content);
  }
  return String(content);
}

function NotesCard({ card }) {
  const bg    = CARD_BG[card.card_type]    || 'from-[var(--color-primary)]/10 to-transparent border-[var(--color-border)]';
  const label = CARD_LABEL_COLOR[card.card_type] || 'text-[var(--color-primary)]';
  const body  = parseCardContent(card.content);

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${bg} p-6 space-y-3`} data-testid={`guest-card-${card.id}`}>
      <div className="flex items-center gap-2">
        <span className={`text-[9px] font-mono uppercase tracking-[0.18em] ${label}`}>{card.card_type}</span>
      </div>
      {card.title && (
        <h3 className="text-base font-semibold text-[var(--color-text)] font-bricolage leading-snug">{card.title}</h3>
      )}
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap font-bricolage">{body}</p>
    </div>
  );
}

function NotesPhase({ sessionId, onComplete, isDone }) {
  const [cards, setCards] = useState([]);
  const [idx, setIdx]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    guestFetch(`/api/free-session/${sessionId}/notes`)
      .then((d) => { setCards(d.cards || []); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, [sessionId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[var(--color-primary)]" /></div>;
  if (err)     return <div className="text-red-500 text-sm py-4 text-center"><AlertCircle size={16} className="inline mr-1" />{err}</div>;
  if (!cards.length) return <div className="text-[var(--color-text-muted)] text-sm py-8 text-center">No notes cards for this session yet.</div>;

  const card = cards[idx];

  return (
    <div className="space-y-4" data-testid="guest-notes-phase">
      {/* Card counter */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-mono text-[var(--color-text-muted)]">{idx + 1} / {cards.length}</span>
        <div className="flex gap-1.5">
          {cards.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-[var(--color-primary)] scale-125' : 'bg-[var(--color-border)]'}`} />
          ))}
        </div>
      </div>

      <NotesCard card={card} />

      {/* Prev / Next / Complete */}
      <div className="flex items-center justify-between pt-1">
        <button onClick={() => setIdx((p) => Math.max(0, p - 1))} disabled={idx === 0}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 transition-all">
          <ChevronLeft size={14} /> Prev
        </button>

        {idx < cards.length - 1 ? (
          <button onClick={() => setIdx((p) => p + 1)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all">
            Next <ChevronRight size={14} />
          </button>
        ) : isDone ? (
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 text-[var(--color-success)] text-sm font-semibold">
            <CheckCircle2 size={14} /> Notes Complete
          </span>
        ) : (
          <button onClick={onComplete}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-blue-500 text-white text-sm font-bricolage font-semibold hover:brightness-110 transition-all"
            data-testid="notes-complete-btn">
            Complete Notes <CheckCircle2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── QUIZ PHASE ───────────────────────────────────────────────────────────────
function QuizPhase({ sessionId, onComplete, isDone, savedScore }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]     = useState({});
  const [submitted, setSubmitted] = useState(isDone);
  const [score, setScore]         = useState(savedScore ?? null);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState(null);
  const [qIdx, setQIdx]           = useState(0);

  useEffect(() => {
    guestFetch(`/api/free-session/${sessionId}/quiz`)
      .then((d) => { setQuestions(d.questions || []); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, [sessionId]);

  const handleSubmit = () => {
    const correct = questions.filter((q, i) => answers[i] === q.correct_answer_index).length;
    const pct = Math.round((correct / questions.length) * 100);
    setScore(pct);
    setSubmitted(true);
    onComplete(pct);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[var(--color-primary)]" /></div>;
  if (err)     return <div className="text-red-500 text-sm py-4 text-center"><AlertCircle size={16} className="inline mr-1" />{err}</div>;
  if (!questions.length) return <div className="text-[var(--color-text-muted)] text-sm py-8 text-center">No quiz questions for this session yet.</div>;

  const q = questions[qIdx];
  const opts = Array.isArray(q.options) ? q.options : [];

  if (submitted) {
    return (
      <div className="space-y-5" data-testid="quiz-result">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <p className="text-4xl font-bold text-[var(--color-primary)] font-bricolage mb-1">{score}%</p>
          <p className="text-sm text-[var(--color-text-muted)]">Quiz Score</p>
        </div>
        <div className="space-y-3">
          {questions.map((qt, i) => {
            const userAns = answers[i];
            const correct = userAns === qt.correct_answer_index;
            return (
              <div key={i} className={`rounded-xl p-4 border text-sm ${correct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <p className="font-semibold text-[var(--color-text)] mb-2 font-bricolage">{qt.question_text}</p>
                {(qt.options || []).map((opt, oi) => (
                  <p key={oi} className={`text-xs py-0.5 ${oi === qt.correct_answer_index ? 'text-emerald-500 font-semibold' : oi === userAns && !correct ? 'text-red-400 line-through' : 'text-[var(--color-text-muted)]'}`}>
                    {oi === qt.correct_answer_index ? '✓' : oi === userAns ? '✗' : '○'} {opt}
                  </p>
                ))}
                {qt.explanation && <p className="text-xs text-[var(--color-text-muted)] mt-2 italic">{qt.explanation}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="guest-quiz-phase">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-mono text-[var(--color-text-muted)]">Question {qIdx + 1} / {questions.length}</span>
        <div className="flex gap-1.5">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setQIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                answers[i] !== undefined ? 'bg-[var(--color-primary)]' : i === qIdx ? 'bg-[var(--color-primary)] scale-125' : 'bg-[var(--color-border)]'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4">
        <p className="text-sm font-semibold text-[var(--color-text)] font-bricolage leading-snug">{q.question_text}</p>
        <div className="space-y-2">
          {opts.map((opt, oi) => (
            <button
              key={oi}
              onClick={() => setAnswers((prev) => ({ ...prev, [qIdx]: oi }))}
              data-testid={`quiz-opt-${qIdx}-${oi}`}
              className={`w-full text-left text-sm px-4 py-3 rounded-xl border transition-all font-bricolage ${
                answers[qIdx] === oi
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40 text-[var(--color-text-muted)]'
              }`}
            >{opt}</button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setQIdx((p) => Math.max(0, p - 1))} disabled={qIdx === 0}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30">
          <ChevronLeft size={14} /> Prev
        </button>
        {qIdx < questions.length - 1 ? (
          <button onClick={() => setQIdx((p) => p + 1)} disabled={answers[qIdx] === undefined}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--color-surface)] text-sm font-semibold hover:bg-[var(--color-surface-hover)] disabled:opacity-40">
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button onClick={handleSubmit}
            disabled={Object.keys(answers).length < questions.length}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-blue-500 text-white text-sm font-bricolage font-semibold hover:brightness-110 disabled:opacity-40 transition-all"
            data-testid="quiz-submit-btn">
            Submit Quiz <CheckCircle2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── SIMULATION PHASE ─────────────────────────────────────────────────────────
function SimPhase({ sessionId, onComplete, isDone }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState(null);

  useEffect(() => {
    guestFetch(`/api/free-session/${sessionId}/simulation`)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, [sessionId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[var(--color-primary)]" /></div>;
  if (err)     return <div className="text-red-500 text-sm py-4 text-center"><AlertCircle size={16} className="inline mr-1" />{err}</div>;
  if (!data?.has_simulation) return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center space-y-3">
      <BarChart2 size={28} className="mx-auto text-[var(--color-text-muted)] opacity-40" />
      <p className="text-sm text-[var(--color-text-muted)] font-bricolage">No simulation for this session.</p>
      {!isDone && (
        <button onClick={() => onComplete()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold">
          Continue <ArrowRight size={14} />
        </button>
      )}
    </div>
  );

  const { sim_type, config, title } = data;

  if (isDone) return (
    <div className="rounded-2xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-6 text-center">
      <CheckCircle2 size={28} className="mx-auto text-[var(--color-success)] mb-2" />
      <p className="text-sm font-semibold text-[var(--color-text)] font-bricolage">Simulation Complete</p>
    </div>
  );

  // Excel sims are complex — show teaser with enroll CTA
  if (sim_type === 'excel') return (
    <div className="rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-8 text-center space-y-4" data-testid="excel-sim-teaser">
      <Lock size={28} className="mx-auto text-[var(--color-primary)] opacity-60" />
      <p className="text-sm font-semibold text-[var(--color-text)] font-bricolage">{title || 'Excel Financial Modelling Simulation'}</p>
      <p className="text-xs text-[var(--color-text-muted)]">This session includes a hands-on Excel modelling simulation. Enrol for full access.</p>
      <button onClick={() => onComplete()}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold">
        Skip for now <ArrowRight size={14} />
      </button>
    </div>
  );

  // Decision making or Book — render the real component
  const handleSimComplete = () => onComplete();

  return (
    <div data-testid="guest-sim-phase">
      {(sim_type === 'decision_making' || sim_type === 'generic') && (
        <DecisionMakingSim config={config} title={title} onComplete={handleSimComplete} />
      )}
      {(sim_type === 'book' || sim_type === 'document') && (
        <BookSim config={config} title={title} onComplete={handleSimComplete} />
      )}
      {!['decision_making','generic','book','document','excel'].includes(sim_type) && (
        <div className="text-center py-8 space-y-3">
          <p className="text-sm text-[var(--color-text-muted)]">Simulation type: {sim_type}</p>
          <button onClick={() => onComplete()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold">
            Continue <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── PAYWALL CTA ──────────────────────────────────────────────────────────────
function PaywallCTA({ completedCount }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]" data-testid="guest-paywall">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-mono uppercase tracking-wider mb-2">
            <CheckCircle2 size={12} /> {completedCount} Free Session{completedCount !== 1 ? 's' : ''} Completed
          </div>
          <h1 className="text-4xl font-bold text-[var(--color-text)] font-bricolage leading-tight">
            Ready for the<br />full programme?
          </h1>
          <p className="text-[var(--color-text-muted)] font-bricolage text-base">
            You've experienced the depth. Now get access to all 21 modules, 239 sessions, AI mock interviews, and your personal study planner.
          </p>
        </div>

        {/* Social proof strip */}
        <div className="flex items-center justify-center gap-1">
          {[1,2,3,4,5].map((i) => <Star key={i} size={14} fill="currentColor" className="text-amber-400" />)}
          <span className="text-xs text-[var(--color-text-muted)] ml-2 font-mono">Trusted by 500+ finance students</span>
        </div>

        {/* Price card */}
        <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent p-6 space-y-4">
          <div>
            <p className="text-4xl font-bold text-[var(--color-text)] font-bricolage">₹1,500</p>
            <p className="text-xs text-[var(--color-text-muted)] font-mono mt-1">One-time · Lifetime access · No EMI required</p>
          </div>
          <ul className="text-sm text-left space-y-2 text-[var(--color-text-muted)] font-bricolage">
            {['21 modules · 239 sessions', 'AI tutor (Pari) available 24/7', 'AI mock interview simulator', 'Auto-graded Excel simulations', '3 capstone portfolio projects', 'NISM Series XV prep'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" /> {item}
              </li>
            ))}
          </ul>
          <a
            href="/enroll"
            className="block w-full py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-blue-500 text-white text-sm font-bricolage font-semibold text-center hover:brightness-110 transition-all shadow-[0_0_24px_rgba(99,102,241,0.4)]"
            data-testid="paywall-enroll-btn"
          >
            Enrol Now — ₹1,500 <ArrowRight size={14} className="inline ml-1" />
          </a>
          <p className="text-xs text-[var(--color-text-faint)] font-mono">30-day money-back guarantee</p>
        </div>

        <a href="/" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline font-mono">
          Back to home
        </a>
      </div>
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function GuestSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession]   = useState(null);
  const [freeSessions, setFreeSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [phase, setPhase]       = useState('video');
  const [progress, setProgress] = useState({});
  const [showPaywall, setShowPaywall] = useState(false);

  // Load session info + free sessions list
  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      guestFetch(`/api/free-session/${sessionId}`),
      guestFetch(`/api/free-sessions`),
    ])
      .then(([sess, freeList]) => {
        setSession(sess);
        setFreeSessions(freeList.sessions || []);
        const prog = getProgress(sessionId);
        setProgress(prog);
        // Start on first incomplete phase
        if (!prog.videoWatched) setPhase('video');
        else if (!prog.notesComplete) setPhase('notes');
        else if (!prog.quizComplete) setPhase('quiz');
        else if (!prog.simComplete) setPhase('sim');
        else setPhase('video'); // all done — revisit
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [sessionId]);

  // Check if user has hit the 2-session limit already
  useEffect(() => {
    if (!freeSessions.length) return;
    const done = getDoneList();
    const doneFreeSessions = freeSessions.filter((s) => done.includes(s.id));
    // Show paywall if current session is NOT in free list
    const isCurrentFree = freeSessions.some((s) => s.id === sessionId);
    if (!isCurrentFree && !loading) {
      setError('This session is not available as a free trial.');
    }
  }, [freeSessions, sessionId, loading]);

  const updateProgress = useCallback((updates) => {
    setProgress((prev) => {
      const next = { ...prev, ...updates };
      saveProgress(sessionId, next);
      return next;
    });
  }, [sessionId]);

  const handlePhaseComplete = (phaseKey, extra = {}) => {
    const updates = { [`${phaseKey}Complete`]: true, ...extra };
    if (phaseKey === 'video') updates.videoWatched = true;
    updateProgress(updates);

    // Auto-advance to next phase
    const order = ['video', 'notes', 'quiz', 'sim'];
    const nextIdx = order.indexOf(phaseKey) + 1;
    if (nextIdx < order.length) {
      setPhase(order[nextIdx]);
    } else {
      // All phases done — mark session complete
      markSessionDone(sessionId);
      const done = getDoneList();
      const doneFreeSessions = freeSessions.filter((s) => done.includes(s.id));
      // Find next free session
      const freeIds = freeSessions.map((s) => s.id);
      const currentIndex = freeIds.indexOf(sessionId);
      const nextFreeSession = freeSessions.find((s) => !done.includes(s.id) && s.id !== sessionId);

      if (nextFreeSession) {
        // Navigate to next free session
        navigate(`/try-free/${nextFreeSession.id}`);
      } else {
        // All free sessions done → paywall
        setShowPaywall(true);
      }
    }
  };

  const isPhaseComplete = (key) => {
    if (key === 'video') return !!progress.videoWatched;
    if (key === 'notes') return !!progress.notesComplete;
    if (key === 'quiz')  return !!progress.quizComplete;
    if (key === 'sim')   return !!progress.simComplete;
    return false;
  };

  const done = getDoneList();
  const doneCount = freeSessions.filter((s) => done.includes(s.id)).length + (done.includes(sessionId) ? 0 : 0);

  if (showPaywall) return <PaywallCTA completedCount={freeSessions.filter((s) => getDoneList().includes(s.id)).length + 1} />;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[var(--color-bg)]">
      <AlertCircle size={28} className="text-red-500" />
      <p className="text-sm text-[var(--color-text)]">{error}</p>
      <a href="/" className="text-xs text-[var(--color-primary)] underline">Back to home</a>
    </div>
  );

  const freeSessionIdx = freeSessions.findIndex((s) => s.id === sessionId);
  const sessionLabel = freeSessionIdx >= 0 ? `Free Session ${freeSessionIdx + 1} of ${freeSessions.length}` : 'Free Session';

  return (
    <div className="min-h-screen bg-[var(--color-bg)]" data-testid="guest-session-page">
      {/* Top header */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">{sessionLabel}</span>
            </div>
            <p className="text-sm font-semibold text-[var(--color-text)] font-bricolage truncate">{session?.title}</p>
          </div>
          <a
            href={`/enroll`}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold hover:brightness-110 transition-all"
            data-testid="header-enroll-btn"
          >
            Enrol <ArrowRight size={11} />
          </a>
        </div>

        {/* Phase tabs */}
        <div className="max-w-3xl mx-auto px-4 flex gap-0 border-t border-[var(--color-border)]">
          {PHASES.map(({ key, label, Icon }) => {
            const done = isPhaseComplete(key);
            const active = phase === key;
            return (
              <button
                key={key}
                onClick={() => setPhase(key)}
                data-testid={`phase-tab-${key}`}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono transition-all border-b-2 ${
                  active
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {done ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Icon size={12} />}
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {phase === 'video' && (
          <VideoPhase
            session={session}
            onComplete={() => handlePhaseComplete('video')}
            isDone={isPhaseComplete('video')}
          />
        )}
        {phase === 'notes' && (
          <NotesPhase
            sessionId={sessionId}
            onComplete={() => handlePhaseComplete('notes')}
            isDone={isPhaseComplete('notes')}
          />
        )}
        {phase === 'quiz' && (
          <QuizPhase
            sessionId={sessionId}
            onComplete={(score) => handlePhaseComplete('quiz', { quizScore: score })}
            isDone={isPhaseComplete('quiz')}
            savedScore={progress.quizScore}
          />
        )}
        {phase === 'sim' && (
          <SimPhase
            sessionId={sessionId}
            onComplete={() => handlePhaseComplete('sim')}
            isDone={isPhaseComplete('sim')}
          />
        )}
      </div>

      {/* Bottom enrol nudge */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] mt-12 py-4">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between gap-4">
          <p className="text-xs text-[var(--color-text-muted)] font-bricolage">
            Enjoying it? Get full access to all 239 sessions for ₹1,500 lifetime.
          </p>
          <a
            href="/enroll"
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-blue-500 text-white text-xs font-semibold hover:brightness-110 transition-all"
            data-testid="bottom-enroll-btn"
          >
            Enrol Now <ArrowRight size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}

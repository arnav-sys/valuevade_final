import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, X, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AvatarPersona from './AvatarPersona';
import { useTutor, TUTOR_NAME } from '../../contexts/TutorContext';

// Phase 52 — DoubtsSession
//
// Modal-style chat panel: large Tara on the left, message thread on the right,
// input at the bottom. Pose updates with the conversation state:
//   listening      → idle / waiting for the user to type
//   thinking       → request in flight to /api/doubts/ask
//   explaining     → fresh answer rendered
//   apology        → off-topic redirect
//   goodbye        → session_ended
//
// Hard rails enforced server-side (3 turns, 1500 tokens, 2 strikes, 5/day):
// this component just renders the state the API returns.

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

async function authedFetch(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('not_authenticated');
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ChatBubble({ role, content, isCached, isOffTopic, animate }) {
  const isUser = role === 'user';
  const baseClasses = isUser
    ? 'self-end bg-[var(--color-primary)] text-white'
    : 'self-start bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]';

  const [shown, setShown] = useState(animate && !isUser ? '' : content);
  useEffect(() => {
    if (isUser || !animate) { setShown(content); return undefined; }
    if (prefersReducedMotion()) { setShown(content); return undefined; }
    let i = 0;
    setShown('');
    const t = setInterval(() => {
      i += 1;
      setShown(content.slice(0, i));
      if (i >= content.length) { clearInterval(t); }
    }, 18);
    return () => clearInterval(t);
  }, [content, animate, isUser]);

  return (
    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm font-bricolage leading-relaxed whitespace-pre-wrap ${baseClasses}`}
         data-testid={`doubts-msg-${role}`}>
      {!isUser && (isCached || isOffTopic) && (
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1 opacity-70 flex items-center gap-1">
          {isCached && <span>cached</span>}
          {isOffTopic && <span className="text-amber-400">off-topic</span>}
        </div>
      )}
      {shown}
    </div>
  );
}

export default function DoubtsSession({
  open,
  onClose,
  phase = 'notes',
  courseSessionId = null,
  moduleCode = null,
}) {
  const { enabled } = useTutor();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [messages, setMessages] = useState([]); // {role, content, isCached?, isOffTopic?, animate?}
  const [input, setInput] = useState('');
  const [turnsLeft, setTurnsLeft] = useState(3);
  const [tokensLeft, setTokensLeft] = useState(1500);
  const [sessionsLeftToday, setSessionsLeftToday] = useState(null);
  const [pending, setPending] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endReason, setEndReason] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const autoCloseRef = useRef(null);

  // Start a session on first open. Re-uses if already open with the same id.
  useEffect(() => {
    if (!open || !enabled) return undefined;
    if (sessionId) { setBootstrapping(false); return undefined; }
    let alive = true;
    (async () => {
      setBootstrapping(true);
      setError(null);
      setQuotaExhausted(false);
      setMessages([]);
      try {
        const { ok, status, data } = await authedFetch('/api/doubts/start', {
          phase,
          course_session_id: courseSessionId,
          module_code: moduleCode,
        });
        if (!alive) return;
        if (status === 429 || (data?.detail && data.detail.reason === 'quota_exhausted')) {
          setQuotaExhausted(true);
          setSessionsLeftToday(0);
        } else if (!ok || !data.ok) {
          setError(data?.detail || 'Failed to open a doubt session');
        } else {
          setSessionId(data.doubt_session_id);
          setTurnsLeft(data.turns_left ?? 3);
          setTokensLeft(data.tokens_left ?? 1500);
          setSessionsLeftToday(data.sessions_left_today);
        }
      } catch (e) {
        if (alive) setError(e.message || 'Network error');
      } finally {
        if (alive) setBootstrapping(false);
      }
    })();
    return () => { alive = false; };
  }, [open, enabled, phase, courseSessionId, moduleCode, sessionId]);

  // Auto-scroll on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pending]);

  // Focus the input when ready.
  useEffect(() => {
    if (open && !bootstrapping && !sessionEnded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, bootstrapping, sessionEnded]);

  // Auto-close 5s after session_ended so users don't get stuck looking at a
  // dead modal. Manual X-click still works any time.
  useEffect(() => {
    if (!sessionEnded) return undefined;
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    autoCloseRef.current = setTimeout(() => { onClose?.(); }, 5000);
    return () => { if (autoCloseRef.current) clearTimeout(autoCloseRef.current); };
  }, [sessionEnded, onClose]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || msg.length < 5 || pending || sessionEnded || !sessionId) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setPending(true);
    try {
      const { ok, status, data } = await authedFetch('/api/doubts/ask', {
        doubt_session_id: sessionId, message: msg,
      });
      if (!ok) {
        setMessages((m) => [...m, {
          role: 'assistant',
          content: status >= 500 ? "Tara hit a snag — please try again." : (data?.detail || 'Something went wrong.'),
          isError: true,
        }]);
      } else {
        setMessages((m) => [...m, {
          role: 'assistant',
          content: data.answer,
          isCached: data.is_cached,
          isOffTopic: data.is_off_topic,
          animate: true,
        }]);
        setTurnsLeft(data.turns_left ?? 0);
        setTokensLeft(data.tokens_left ?? 0);
        if (data.sessions_left_today !== undefined) setSessionsLeftToday(data.sessions_left_today);
        if (data.session_ended) {
          setSessionEnded(true);
          setEndReason(data.end_reason);
        }
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Network error — try again.', isError: true }]);
    } finally {
      setPending(false);
    }
  }, [input, pending, sessionEnded, sessionId]);

  const handleEnd = useCallback(async () => {
    if (sessionId && !sessionEnded) {
      try { await authedFetch('/api/doubts/end', { doubt_session_id: sessionId }); } catch { /* noop */ }
    }
    onClose?.();
  }, [sessionId, sessionEnded, onClose]);

  // Resolve pose for current state.
  const pose = useMemo(() => {
    if (sessionEnded) return 'goodbye';
    if (pending) return 'thinking';
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant?.isOffTopic) return 'apology';
    if (lastAssistant) return 'explaining';
    return 'listening';
  }, [pending, sessionEnded, messages]);

  if (!open || !enabled) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ask ${TUTOR_NAME} a doubt`}
      data-testid="doubts-session-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6"
      style={{ background: 'rgba(8,12,24,.6)', backdropFilter: 'blur(8px)' }}
      onClick={handleEnd}
    >
      <div
        className="relative w-full max-w-3xl h-[640px] max-h-[92vh] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--color-accent)]" />
            <div className="font-clash text-base font-bold text-[var(--color-text)]">Ask {TUTOR_NAME}</div>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-muted)] flex items-center gap-3" data-testid="doubts-header-chip">
            {sessionsLeftToday != null && <span>Sessions left: <span className="text-[var(--color-text)] font-bold">{sessionsLeftToday}/5</span></span>}
            <span>Turns: <span className="text-[var(--color-text)] font-bold">{turnsLeft}/3</span></span>
            <span className="hidden sm:inline">Tokens: <span className="text-[var(--color-text)] font-bold">{tokensLeft}/1500</span></span>
          </div>
          <button onClick={handleEnd} className="rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]" aria-label="Close" data-testid="doubts-close">
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0">
          {/* Tara */}
          <aside className="flex flex-col items-center justify-center sm:w-1/3 px-4 py-4 sm:py-6 border-b sm:border-b-0 sm:border-r border-[var(--color-border)] bg-[var(--color-surface)]">
            <AvatarPersona
              pose={pose}
              size="lg"
              position="inline"
              message={null}
              showSpeechBubble={false}
              ariaLabel={`${TUTOR_NAME}, ${pose}`}
            />
            <div className="mt-3 text-xs text-[var(--color-text-muted)] text-center font-bricolage hidden sm:block">
              {sessionEnded
                ? "Thanks for the doubts — let's get back to it."
                : pending
                  ? `${TUTOR_NAME} is thinking…`
                  : `Ask me anything about ${moduleCode ? `Module ${moduleCode.replace(/^M/, '')}` : 'this'}.`}
            </div>
          </aside>

          {/* Thread */}
          <section className="flex-1 flex flex-col min-w-0">
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-3"
              data-testid="doubts-thread"
            >
              {bootstrapping && (
                <div className="flex items-center justify-center text-sm text-[var(--color-text-muted)] py-12">
                  <Loader2 size={16} className="animate-spin mr-2" /> Opening doubt session…
                </div>
              )}
              {quotaExhausted && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-200">
                  <div className="font-bold mb-1">You've used today's 5 doubt sessions.</div>
                  <div className="text-amber-100/80">Come back tomorrow — your quota resets at IST midnight.</div>
                </div>
              )}
              {error && !quotaExhausted && (
                <div className="rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200 flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div>{String(error)}</div>
                </div>
              )}
              {messages.map((m, i) => (
                <ChatBubble key={i} {...m} />
              ))}
              {pending && (
                <div className="self-start text-xs text-[var(--color-text-muted)] flex items-center gap-2 px-1">
                  <Loader2 size={12} className="animate-spin" /> Thinking…
                </div>
              )}
              {sessionEnded && (
                <div className="text-xs text-[var(--color-text-muted)] text-center pt-2 font-bricolage">
                  Session ended ({endReason || 'manual_end'}). Closing in 5s — or click X.
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-[var(--color-border)] px-3 sm:px-4 py-3 bg-[var(--color-bg-card)]">
              {sessionEnded ? (
                <button
                  onClick={handleEnd}
                  className="w-full rounded-xl bg-[var(--color-primary)] text-white font-semibold py-2.5 text-sm hover:brightness-110"
                  data-testid="doubts-done"
                >
                  Done
                </button>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, 500))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={`Ask ${TUTOR_NAME} a doubt — 5 to 500 chars`}
                    rows={2}
                    className="flex-1 resize-none rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm font-bricolage text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]/60"
                    disabled={pending || bootstrapping || quotaExhausted}
                    data-testid="doubts-input"
                  />
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={send}
                      disabled={pending || bootstrapping || quotaExhausted || input.trim().length < 5}
                      className="rounded-xl bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold disabled:opacity-40 hover:brightness-110"
                      data-testid="doubts-send"
                    >
                      {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                    <div className="text-[10px] font-mono text-[var(--color-text-faint)]">
                      {input.length}/500
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
                <span>Enter to send · Shift+Enter for newline</span>
                {!sessionEnded && !bootstrapping && (
                  <button onClick={handleEnd} className="underline hover:text-[var(--color-text-muted)]" data-testid="doubts-end-link">
                    End session
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

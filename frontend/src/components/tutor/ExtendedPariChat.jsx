import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, X, Loader2, AlertCircle, Sparkles, MessageSquare } from 'lucide-react';
import AvatarPersona from './AvatarPersona';
import { TUTOR_NAME } from '../../contexts/TutorContext';
import { startExtendedChat, askExtendedChat, endExtendedChat } from '../../utils/sessionDoubts';

// Phase B — Extended Pari chat panel.
//
// Separate from DoubtsSession.jsx (quick chat). Limits:
//   • 15 turns per session (vs 3 in quick)
//   • 3 sessions per IST day (vs 5 in quick)
//   • No token budget gate
//
// Quick chat endpoints (/api/doubts/start|ask|end) are intentionally NOT
// shared — this component talks ONLY to /api/doubts/extended/*.
//
// Surfaces the EXACT backend error on quota / turn-cap (no swallowing).

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ChatBubble({ role, content, animate }) {
  const isUser = role === 'user';
  const baseClasses = isUser
    ? 'self-end bg-[var(--color-primary)] text-white'
    : 'self-start bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]';

  const [shown, setShown] = useState(animate && !isUser ? '' : content);
  useEffect(() => {
    if (isUser || !animate || prefersReducedMotion()) { setShown(content); return undefined; }
    let i = 0;
    setShown('');
    const t = setInterval(() => {
      i += 1;
      setShown(content.slice(0, i));
      if (i >= content.length) clearInterval(t);
    }, 14);
    return () => clearInterval(t);
  }, [content, animate, isUser]);

  return (
    <div
      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm font-bricolage leading-relaxed whitespace-pre-wrap ${baseClasses}`}
      data-testid={`extended-msg-${role}`}
    >
      {shown}
    </div>
  );
}

export default function ExtendedPariChat({
  open,
  doubtId,
  sessionTitle = 'your flagged session',
  onClose,
}) {
  const [bootstrapping, setBootstrapping] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [retryAfterIso, setRetryAfterIso] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [turnsRemaining, setTurnsRemaining] = useState(15);
  const [dailyRemaining, setDailyRemaining] = useState(null);
  const [pending, setPending] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endReason, setEndReason] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const startedForDoubtRef = useRef(null);

  // Start a fresh extended session each time the panel opens for a new doubt.
  useEffect(() => {
    if (!open || !doubtId) return undefined;
    if (startedForDoubtRef.current === doubtId) return undefined;
    startedForDoubtRef.current = doubtId;
    let alive = true;
    (async () => {
      setBootstrapping(true);
      setError(null);
      setQuotaExhausted(false);
      setRetryAfterIso(null);
      setMessages([]);
      setSessionEnded(false);
      setEndReason(null);
      try {
        const { ok, status, data } = await startExtendedChat(doubtId);
        if (!alive) return;
        if (status === 429) {
          setQuotaExhausted(true);
          setRetryAfterIso(data?.detail?.retry_after_iso || null);
          setDailyRemaining(0);
        } else if (!ok || !data?.ok) {
          setError(data?.detail?.message || (typeof data?.detail === 'string' ? data.detail : null) || 'Could not start extended chat.');
        } else {
          setSessionId(data.doubt_session_id);
          setTurnsRemaining(data.turns_remaining ?? 15);
          setDailyRemaining(data.daily_remaining ?? null);
        }
      } catch (e) {
        if (alive) setError(e?.message || 'Network error');
      } finally {
        if (alive) setBootstrapping(false);
      }
    })();
    return () => { alive = false; };
  }, [open, doubtId]);

  // Reset the "started" guard when the panel closes so the next open re-starts.
  useEffect(() => {
    if (!open) startedForDoubtRef.current = null;
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    if (open && !bootstrapping && !sessionEnded && inputRef.current) inputRef.current.focus();
  }, [open, bootstrapping, sessionEnded]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || msg.length < 2 || pending || sessionEnded || !sessionId) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setPending(true);
    try {
      const { ok, data } = await askExtendedChat({ doubt_session_id: sessionId, message: msg });
      if (!ok) {
        const errMsg = (typeof data?.detail === 'string' ? data.detail : data?.detail?.message) || 'Pari hit a snag — please try again.';
        setMessages((m) => [...m, { role: 'assistant', content: errMsg, isError: true }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: data.answer, animate: true }]);
        setTurnsRemaining(data.turns_remaining ?? 0);
        if (typeof data.daily_remaining === 'number') setDailyRemaining(data.daily_remaining);
        if (data.session_ended) {
          setSessionEnded(true);
          setEndReason(data.end_reason);
        }
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: e?.message || 'Network error — try again.', isError: true }]);
    } finally {
      setPending(false);
    }
  }, [input, pending, sessionEnded, sessionId]);

  const handleClose = useCallback(async () => {
    if (sessionId && !sessionEnded) {
      try { await endExtendedChat(sessionId); } catch { /* fire-and-forget */ }
    }
    onClose?.();
  }, [sessionId, sessionEnded, onClose]);

  const pose = useMemo(() => {
    if (sessionEnded) return 'goodbye';
    if (pending) return 'thinking';
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant) return 'explaining';
    return 'listening';
  }, [pending, sessionEnded, messages]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Extended chat with ${TUTOR_NAME}`}
      data-testid="extended-pari-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6"
      style={{ background: 'rgba(8,12,24,.6)', backdropFilter: 'blur(8px)' }}
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-3xl h-[680px] max-h-[94vh] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] flex items-center justify-center shrink-0">
              <MessageSquare size={14} />
            </div>
            <div className="min-w-0">
              <div className="font-clash text-sm font-bold text-[var(--color-text)] truncate">
                Extended chat with {TUTOR_NAME}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-muted)] truncate">
                {sessionTitle}
              </div>
            </div>
          </div>
          <div
            className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-muted)] flex items-center gap-3 shrink-0"
            data-testid="extended-header-chip"
          >
            <span>Turns: <span className="text-[var(--color-text)] font-bold">{turnsRemaining}/15</span></span>
            {dailyRemaining != null && (
              <span className="hidden sm:inline">Today: <span className="text-[var(--color-text)] font-bold">{dailyRemaining}/3</span></span>
            )}
            <button onClick={handleClose} className="rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]" aria-label="Close" data-testid="extended-close">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col sm:flex-row min-h-0">
          {/* Pari avatar column */}
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
                ? "Hope that helped — go redo with confidence!"
                : pending
                  ? `${TUTOR_NAME} is thinking…`
                  : `Take your time — up to 15 turns to untangle this.`}
            </div>
          </aside>

          {/* Thread + composer */}
          <section className="flex-1 flex flex-col min-w-0">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-3" data-testid="extended-thread">
              {bootstrapping && (
                <div className="flex items-center justify-center text-sm text-[var(--color-text-muted)] py-12">
                  <Loader2 size={16} className="animate-spin mr-2" /> Opening extended chat…
                </div>
              )}
              {quotaExhausted && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-200" data-testid="extended-quota-exhausted">
                  <div className="font-bold mb-1">Today's extended chats exhausted</div>
                  <div className="text-amber-100/80">You've used all 3 extended doubt sessions for today. Try again tomorrow (resets at IST midnight).</div>
                  {retryAfterIso && (
                    <div className="mt-2 text-[10px] font-mono text-amber-200/70">Next reset: {new Date(retryAfterIso).toLocaleString()}</div>
                  )}
                </div>
              )}
              {error && !quotaExhausted && (
                <div className="rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200 flex items-start gap-2" data-testid="extended-error">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div>{String(error)}</div>
                </div>
              )}
              {!bootstrapping && !error && !quotaExhausted && messages.length === 0 && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-4 py-3 text-xs font-bricolage text-[var(--color-text-muted)]">
                  <div className="flex items-center gap-1.5 mb-1 text-[var(--color-text)] font-semibold">
                    <Sparkles size={12} /> Start with whatever felt confusing
                  </div>
                  Ask narrowly (e.g. "Why did we use FCFE instead of FCFF here?") — {TUTOR_NAME} works through it across up to 15 turns.
                </div>
              )}
              {messages.map((m, i) => <ChatBubble key={i} {...m} />)}
              {pending && (
                <div className="self-start text-xs text-[var(--color-text-muted)] flex items-center gap-2 px-1">
                  <Loader2 size={12} className="animate-spin" /> Thinking…
                </div>
              )}
              {sessionEnded && (
                <div className="text-xs text-[var(--color-text-muted)] text-center pt-2 font-bricolage" data-testid="extended-ended">
                  Session ended ({endReason || 'manual_end'}).
                  {endReason === 'turn_cap_reached' && ' You reached the 15-turn cap.'}
                </div>
              )}
            </div>

            <div className="border-t border-[var(--color-border)] px-3 sm:px-4 py-3 bg-[var(--color-bg-card)]">
              {sessionEnded || quotaExhausted ? (
                <button
                  onClick={handleClose}
                  className="w-full rounded-xl bg-[var(--color-primary)] text-white font-semibold py-2.5 text-sm hover:brightness-110"
                  data-testid="extended-done"
                >
                  Done
                </button>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, 1000))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={`Ask ${TUTOR_NAME} — 2 to 1000 chars`}
                    rows={2}
                    className="flex-1 resize-none rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm font-bricolage text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]/60"
                    disabled={pending || bootstrapping || !sessionId}
                    data-testid="extended-input"
                  />
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={send}
                      disabled={pending || bootstrapping || !sessionId || input.trim().length < 2}
                      className="rounded-xl bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold disabled:opacity-40 hover:brightness-110"
                      data-testid="extended-send"
                    >
                      {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                    <div className="text-[10px] font-mono text-[var(--color-text-faint)]">
                      {input.length}/1000
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
                <span>Enter to send · Shift+Enter for newline</span>
                {!sessionEnded && !bootstrapping && (
                  <button onClick={handleClose} className="underline hover:text-[var(--color-text-muted)]" data-testid="extended-end-link">
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

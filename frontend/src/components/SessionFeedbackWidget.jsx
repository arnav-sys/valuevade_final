/**
 * SessionFeedbackWidget, small collapsible feedback panel students can
 * open on any session page to report issues (content, video/audio quality,
 * or other). Posts to /api/sessions/{session_id}/feedback and shows a
 * thank-you state on success.
 */
import { useState } from 'react';
import { MessageSquareWarning, Check, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const CATEGORIES = [
  { value: 'content_issue', label: 'Content issue',   sub: 'Something in the video is wrong or unclear' },
  { value: 'quality_issue', label: 'Video / audio',   sub: 'Blurry, muted, cut off, buffering' },
  { value: 'other',         label: 'Other feedback',  sub: 'Suggestion, praise, feature idea' },
];

export default function SessionFeedbackWidget({ sessionId }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('content_issue');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | done | error
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (message.trim().length < 5) { setErr('Please write at least 5 characters.'); return; }
    setErr(null); setStatus('submitting');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/sessions/${sessionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ category, message: message.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.detail || `HTTP ${r.status}`);
      setStatus('done');
      setMessage('');
      // Auto-collapse after 4s so it doesn't sit stuck in the "thanks" state.
      setTimeout(() => { setOpen(false); setStatus('idle'); }, 4000);
    } catch (e) {
      setErr(e.message);
      setStatus('error');
    }
  };

  if (!sessionId) return null;

  return (
    <div className="mt-4" data-testid="session-feedback-widget">
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setStatus('idle'); setErr(null); }}
          className="inline-flex items-center gap-1.5 text-xs font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          data-testid="session-feedback-open"
        >
          <MessageSquareWarning size={12} />
          Report an issue or leave feedback
        </button>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4" data-testid="session-feedback-panel">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-1.5">
                <MessageSquareWarning size={13} /> Session feedback
              </h4>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Help us make this session better. Admins see every report.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setOpen(false); setStatus('idle'); setErr(null); }}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label="Close feedback"
              data-testid="session-feedback-close"
            >
              <X size={16} />
            </button>
          </div>

          {status === 'done' ? (
            <div className="flex items-center gap-2 text-emerald-500 text-sm py-2 font-bricolage" data-testid="session-feedback-success">
              <Check size={14} /> Thanks, your feedback is in.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3" role="radiogroup" aria-label="Feedback category">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={category === c.value}
                    onClick={() => setCategory(c.value)}
                    className={`text-left rounded-lg border px-3 py-2 transition-all ${
                      category === c.value
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                    }`}
                    data-testid={`session-feedback-cat-${c.value}`}
                  >
                    <div className="text-xs font-semibold text-[var(--color-text)]">{c.label}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{c.sub}</div>
                  </button>
                ))}
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                placeholder="Describe the issue, where in the video, what you'd expect, any specific detail…"
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm font-bricolage resize-y focus:outline-none focus:border-[var(--color-primary)]/60"
                data-testid="session-feedback-message"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{message.length}/2000</span>
                <div className="flex items-center gap-2">
                  {err && <span className="text-xs text-red-500" data-testid="session-feedback-error">{err}</span>}
                  <button
                    type="button"
                    onClick={submit}
                    disabled={status === 'submitting' || message.trim().length < 5}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium hover:brightness-110 disabled:opacity-60"
                    data-testid="session-feedback-submit"
                  >
                    {status === 'submitting' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    {status === 'submitting' ? 'Sending…' : 'Send feedback'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

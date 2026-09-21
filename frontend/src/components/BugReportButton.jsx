import { useState } from 'react';
import { Bug, X, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { reportError } from '@/lib/errorReporter';

/**
 * Site-wide floating "Report a bug" button.
 *
 * Renders a small pill at the bottom-left corner for any authenticated user.
 * Clicking it opens a compact panel with a description textarea. On submit
 * we call the existing /api/errors/report pipeline with `type='user_report'`
 * so it lands in AdminPanel → Errors alongside crashes (but flagged as a
 * user-driven report, no stack trace, purely descriptive).
 *
 * Design intent:
 *  - Never obstructs primary CTAs, bottom-LEFT corner, low z-index.
 *  - Hidden on the landing / login routes (only mount when auth is ready).
 *  - Description is REQUIRED; submit is disabled otherwise.
 *  - Auto-closes 1.5s after a successful send.
 */
export default function BugReportButton() {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Only show for authenticated users, anonymous crash reporting is already
  // handled by the auto-installed window handlers in errorReporter.js.
  if (authLoading || !user) return null;

  const reset = () => {
    setOpen(false);
    // small delay so the panel closes visually before wiping content
    setTimeout(() => {
      setDescription('');
      setSubmitted(false);
      setSubmitting(false);
    }, 250);
  };

  const submit = async () => {
    const desc = description.trim();
    if (!desc || submitting) return;
    setSubmitting(true);
    try {
      await reportError({
        message: `[user report] ${desc.slice(0, 200)}`,
        stack: `route=${window.location?.href || ''}`,
        type: 'user_report',
        user_description: desc,
      });
      setSubmitted(true);
      setTimeout(reset, 1600);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 sm:bottom-24 left-4 sm:left-8 z-40 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full text-xs font-semibold font-bricolage shadow-lg transition-all hover:brightness-110 hover:-translate-y-0.5"
          style={{
            background: 'rgba(15,15,25,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(167,139,250,0.35)',
            color: '#e9d5ff',
            boxShadow: '0 8px 24px -8px rgba(139,92,246,0.4)',
          }}
          data-testid="bug-report-trigger"
          aria-label="Report a bug"
        >
          <Bug size={14} />
          <span className="hidden sm:inline">Report a bug</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-20 sm:bottom-24 left-4 sm:left-8 z-40 w-[calc(100vw-2rem)] sm:w-[360px] rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(15,15,25,0.94)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(167,139,250,0.30)',
            boxShadow: '0 12px 40px -12px rgba(0,0,0,0.7)',
          }}
          data-testid="bug-report-panel"
        >
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b"
            style={{ borderColor: 'rgba(167,139,250,0.20)' }}
          >
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>
              <Bug size={13} /> Report a bug
            </div>
            <button
              type="button"
              onClick={reset}
              className="p-1 rounded-md hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              data-testid="bug-report-close"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          {submitted ? (
            <div className="px-4 py-6 flex flex-col items-center gap-2" data-testid="bug-report-submitted">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(134,239,172,0.15)', border: '1px solid rgba(134,239,172,0.35)' }}
              >
                <CheckCircle2 size={20} style={{ color: '#86efac' }} />
              </div>
              <p className="text-sm font-bricolage" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Thanks, our team has been notified.
              </p>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-xs font-bricolage mb-3" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Describe what went wrong or feels off. We&apos;ll include your current page automatically.
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                placeholder="e.g. Quiz score wasn't saved after submit, or the sidebar overlapped the content on mobile…"
                rows={4}
                className="w-full rounded-lg px-3 py-2 text-sm font-bricolage resize-y focus:outline-none focus:ring-2 disabled:opacity-40"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(167,139,250,0.25)',
                  color: '#ffffff',
                }}
                data-testid="bug-report-desc"
                maxLength={2000}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {description.length}/2000
                </span>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!description.trim() || submitting}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold font-bricolage disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{
                    background: 'rgba(167,139,250,0.20)',
                    border: '1px solid rgba(167,139,250,0.40)',
                    color: '#e9d5ff',
                  }}
                  data-testid="bug-report-submit"
                >
                  {submitting ? (
                    <><Loader2 size={13} className="animate-spin" /> Sending…</>
                  ) : (
                    <><Send size={13} /> Send</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

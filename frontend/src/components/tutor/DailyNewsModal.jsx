import { useCallback, useEffect, useState } from 'react';
import { Newspaper, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AvatarPersona from './AvatarPersona';
import { TUTOR_NAME } from '../../contexts/TutorContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
const LS_KEY_PREFIX = 'vv_news_seen_';

/**
 * Batch 2 (Item 3) — Render the LLM markdown digest. Lightweight inline
 * markdown parser (H2 + bullets + bold + paragraphs) — no new npm deps.
 */
function NewsMarkdown({ md }) {
  if (!md) return null;
  const lines = md.split('\n');
  const blocks = [];
  let bullets = [];
  const flushBullets = (k) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul${k}`} className="list-disc pl-5 space-y-1.5 text-base text-[var(--color-text)] font-bricolage">
        {bullets.map((b, i) => (
          <li key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineBold(b) }} />
        ))}
      </ul>
    );
    bullets = [];
  };
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimEnd();
    if (/^##\s+/.test(line)) {
      flushBullets(idx);
      blocks.push(
        <h2
          key={`h${idx}`}
          className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mt-5 mb-2 flex items-center gap-2"
        >
          <span className="inline-block w-1 h-5 rounded-full bg-[var(--color-primary)]" />
          {line.replace(/^##\s+/, '')}
        </h2>
      );
    } else if (/^-\s+/.test(line) || /^\*\s+/.test(line)) {
      bullets.push(line.replace(/^[-*]\s+/, ''));
    } else if (line.trim() === '') {
      flushBullets(idx);
    } else {
      flushBullets(idx);
      blocks.push(
        <p
          key={`p${idx}`}
          className="text-base text-[var(--color-text)] font-bricolage leading-relaxed"
          dangerouslySetInnerHTML={{ __html: inlineBold(line) }}
        />
      );
    }
  });
  flushBullets('end');
  return <div className="space-y-1">{blocks}</div>;
}

function inlineBold(s) {
  // Escape <, then convert **bold** to <strong>.
  const esc = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Phase 54 — P7b
 * Daily Finance News modal. Auto-opens once per IST day on the first dashboard
 * mount and can be re-opened anytime via the dashboard "Today's Finance" tile.
 *
 * Props:
 *   open         — controlled visible state
 *   onClose      — close handler
 *   onMarkRead   — called after a successful /api/news/mark_read (returns the
 *                  RPC payload incl. xp_amount). Caller can refresh XP bar.
 */
export default function DailyNewsModal({ open = false, onClose = () => {}, onMarkRead = () => {} }) {
  const [summaryMd, setSummaryMd] = useState('');
  const [date, setDate] = useState(null);
  const [country, setCountry] = useState(null);
  const [rawItemCount, setRawItemCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [alreadyRead, setAlreadyRead] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError('Please sign in.'); return; }
      const res = await fetch(`${BACKEND}/api/news/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.detail || 'Could not load news.');
      } else {
        setSummaryMd(json.summary_md || '');
        setDate(json.date_ist);
        setCountry(json.country_code);
        setRawItemCount(json.raw_item_count || 0);
        setAlreadyRead(!!json.already_read_today);
      }
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchNews();
  }, [open, fetchNews]);

  const callMarkRead = useCallback(async () => {
    // Fix 2 (Batch 1): every dismiss path must hit the backend so
    // `user_news_reads` records (user, today). The RPC is idempotent —
    // a second call within the same IST day returns `already_read_today:
    // true` and awards no XP. Returns the parsed JSON payload on success.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return null;
      const res = await fetch(`${BACKEND}/api/news/mark_read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
      });
      const json = await res.json().catch(() => ({}));
      return res.ok ? json : null;
    } catch {
      return null;
    }
  }, []);

  const markRead = async () => {
    if (marking || alreadyRead) { onClose(); return; }
    setMarking(true);
    try {
      const json = await callMarkRead();
      if (json) {
        try { localStorage.setItem(`${LS_KEY_PREFIX}${date || 'today'}`, '1'); } catch {}
        setAlreadyRead(true);
        onMarkRead(json);
      }
    } finally {
      setMarking(false);
      onClose();
    }
  };

  const skip = async () => {
    // Fix 2: Skip is now also a dismissal — hit the backend so this day
    // doesn't re-pop on reload. We don't await XP UX (no toast), but we
    // do call onMarkRead so the parent can refresh state if it wants to.
    try { if (date) localStorage.setItem(`${LS_KEY_PREFIX}${date}`, '1'); } catch {}
    if (!alreadyRead) {
      const json = await callMarkRead();
      if (json) {
        setAlreadyRead(true);
        try { onMarkRead(json); } catch {}
      }
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-news-title"
      data-testid="daily-news-modal"
      className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4 py-6"
      onClick={(e) => { if (e.target === e.currentTarget) skip(); }}
    >
      <div className="relative max-w-3xl w-full max-h-[92vh] overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 sm:p-8 shadow-2xl">
        <button
          onClick={skip}
          className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          aria-label="Close news"
          data-testid="daily-news-close"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-5">
          <AvatarPersona
            pose="explaining"
            size="md"
            position="inline"
            showSpeechBubble={false}
            ariaLabel={`${TUTOR_NAME}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              <Newspaper size={11} />
              <span>today's finance news{country ? ` · ${country}` : ''}</span>
            </div>
            <h1
              id="daily-news-title"
              className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] leading-tight mt-1"
            >
              {date ? new Date(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : "Today's Finance News"}
            </h1>
            <p className="text-sm text-[var(--color-text)] font-bricolage mt-1">
              {TUTOR_NAME}'s short read for the day — earn +30 XP for keeping current.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3" data-testid="daily-news-loading">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-[var(--color-surface)] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200" data-testid="daily-news-error">
            {error}
          </div>
        ) : (
          <div className="space-y-3" data-testid="daily-news-items">
            <NewsMarkdown md={summaryMd} />
            {rawItemCount > 0 && (
              <div className="text-[11px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider opacity-70 mt-2">
                summary built from {rawItemCount} headlines · {country || 'global'}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={skip}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-3 py-2 font-bricolage"
            data-testid="daily-news-skip"
          >
            Skip for today
          </button>
          <button
            type="button"
            onClick={markRead}
            disabled={marking || loading || !!error}
            data-testid="daily-news-mark-read"
            className="rounded-full bg-[var(--color-primary)] hover:brightness-110 disabled:opacity-60 text-white px-5 py-2.5 text-sm font-semibold font-bricolage"
          >
            {marking ? 'Saving…' : (alreadyRead ? 'Done for today' : 'Mark as read (+30 XP)')}
          </button>
        </div>
      </div>
    </div>
  );
}

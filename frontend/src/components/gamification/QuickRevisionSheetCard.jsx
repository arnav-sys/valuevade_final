import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Copy, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Phase A — Quick Revision Sheet card.
 *
 * Renders below the XP/badge/streak summary on the session-complete screen.
 * On mount calls POST /api/revision/generate (cache-aware on the backend) and
 * renders the returned markdown. Failure is inline + non-blocking.
 */

// Tiny dependency-free markdown renderer. The LLM output is constrained to:
//   - H2 headings (## Key Concepts / ## Formulas / ## Common Pitfalls / ## Ask Yourself)
//   - bullets ("- ...")
//   - inline bold (**...**), italics (*...*), and inline code (`...`)
// This is enough for the revision-sheet shape; not a general-purpose md parser.
function renderInline(text) {
  // Tokenise on the inline patterns in priority order: code > bold > italic.
  const out = [];
  let remaining = text;
  let key = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const m = remaining.match(/(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/);
    if (!m) {
      if (remaining) out.push(remaining);
      break;
    }
    const before = remaining.slice(0, m.index);
    const tok = m[0];
    if (before) out.push(before);
    if (tok.startsWith('`')) {
      out.push(
        <code
          key={`c${key++}`}
          className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[0.85em] text-[var(--color-primary)]"
        >{tok.slice(1, -1)}</code>
      );
    } else if (tok.startsWith('**')) {
      out.push(<strong key={`b${key++}`} className="font-semibold text-[var(--color-text)]">{tok.slice(2, -2)}</strong>);
    } else {
      out.push(<em key={`i${key++}`} className="italic">{tok.slice(1, -1)}</em>);
    }
    remaining = remaining.slice((m.index || 0) + tok.length);
  }
  return out;
}

function renderMarkdown(md) {
  if (!md) return null;
  const lines = md.split('\n');
  const blocks = [];
  let bullets = [];
  const flushBullets = (k) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul${k}`} className="list-disc pl-5 space-y-1.5 text-sm text-[var(--color-text)] font-bricolage">
        {bullets.map((b, i) => <li key={i} className="leading-relaxed">{renderInline(b)}</li>)}
      </ul>
    );
    bullets = [];
  };
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimEnd();
    if (/^##\s+/.test(line)) {
      flushBullets(idx);
      const heading = line.replace(/^##\s+/, '');
      blocks.push(
        <h3
          key={`h${idx}`}
          className="font-clash text-base sm:text-lg font-bold text-[var(--color-text)] mt-5 mb-2 flex items-center gap-2"
        >
          <span className="inline-block w-1 h-4 rounded-full bg-[var(--color-primary)]" />
          {heading}
        </h3>
      );
    } else if (/^-\s+/.test(line)) {
      bullets.push(line.replace(/^-\s+/, ''));
    } else if (line.trim() === '') {
      flushBullets(idx);
    } else {
      flushBullets(idx);
      blocks.push(
        <p key={`p${idx}`} className="text-sm text-[var(--color-text)] font-bricolage leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  });
  flushBullets('end');
  return blocks;
}

export default function QuickRevisionSheetCard({ sessionId, moduleId }) {
  const [loading, setLoading] = useState(true);
  const [contentMd, setContentMd] = useState('');
  const [cached, setCached] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchSheet = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError('Please sign in to view your revision sheet.'); return; }
      const res = await fetch(`${BACKEND}/api/revision/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: sessionId, module_id: moduleId || '' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.detail || `Couldn't generate revision sheet (HTTP ${res.status})`);
        return;
      }
      setContentMd(json.content_md || '');
      setCached(!!json.cached);
    } catch (e) {
      setError(e.message || 'Network error while generating revision sheet');
    } finally {
      setLoading(false);
    }
  }, [sessionId, moduleId]);

  useEffect(() => { fetchSheet(); }, [fetchSheet]);

  const onCopy = useCallback(async () => {
    if (!contentMd || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(contentMd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* fail silently — the button is a nice-to-have */ }
  }, [contentMd]);

  const rendered = useMemo(() => renderMarkdown(contentMd), [contentMd]);

  return (
    <section
      className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] backdrop-blur p-5 sm:p-7"
      data-testid="quick-revision-sheet-card"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/35 p-2">
            <BookOpen size={18} className="text-[var(--color-primary)]" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Pari's Quick Revision Sheet
            </div>
            <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] leading-tight">
              Take this with you
            </h2>
          </div>
        </div>
        {contentMd && (
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card-hover)]/40 hover:bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-1.5 text-xs font-semibold font-bricolage transition-colors"
            data-testid="revision-copy-btn"
            aria-label="Copy revision sheet to clipboard"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      {loading && (
        <div className="space-y-3" data-testid="revision-loading">
          <div className="h-4 w-2/5 rounded bg-[var(--color-surface)] animate-pulse" />
          <div className="h-3 w-11/12 rounded bg-[var(--color-surface)] animate-pulse" />
          <div className="h-3 w-10/12 rounded bg-[var(--color-surface)] animate-pulse" />
          <div className="h-3 w-9/12 rounded bg-[var(--color-surface)] animate-pulse" />
          <div className="h-4 w-1/3 rounded bg-[var(--color-surface)] animate-pulse mt-4" />
          <div className="h-3 w-11/12 rounded bg-[var(--color-surface)] animate-pulse" />
          <div className="h-3 w-9/12 rounded bg-[var(--color-surface)] animate-pulse" />
          <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-muted)] flex items-center gap-1.5">
            <RefreshCw size={10} className="animate-spin" /> Pari is summarising your session…
          </div>
        </div>
      )}

      {!loading && error && (
        <div
          className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 flex items-start gap-2 font-bricolage"
          data-testid="revision-error"
          role="alert"
        >
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold">{error}</div>
            <button
              type="button"
              onClick={fetchSheet}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold underline hover:no-underline"
              data-testid="revision-retry-btn"
            >
              <RefreshCw size={11} /> Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && contentMd && (
        <div className="prose-revision" data-testid="revision-content">
          {rendered}
          {cached && (
            <div className="mt-5 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              cached · generated once for this session
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// MarkdownCard renderer extracted from NotesPage.jsx (Step 3, P2).
// Renders curriculum-v2 cards whose content is `{ body_md: "..." }`.
// Themed by card_type so each block is visually distinct on the page.
// Zero behavior change, pure refactor.

import { CARD_THEME } from './constants';

export function MarkdownCard({ card, content }) {
  const key = (card?.card_type || '').toString().toLowerCase().trim();
  const theme = CARD_THEME[key] || CARD_THEME[key.replace(/[_\s]+/g, '-')] || { label: key || 'Card', accent: '#246BFD', icon: '•' };
  const title = card?.title || theme.label;
  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl px-6 py-10 sm:px-12 sm:py-14 glass-card"
      style={{
        background: `linear-gradient(135deg, ${theme.accent}14 0%, rgba(106,92,255,0.05) 100%)`,
        border: `1px solid ${theme.accent}30`,
      }}
      data-testid={`card-${key}`}
    >
      <div
        className="absolute top-0 left-0 w-48 h-48 opacity-[0.18] blur-[100px] rounded-full"
        style={{ background: theme.accent }}
      />
      <div className="relative z-10">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-mono uppercase tracking-[0.2em] mb-5"
          style={{
            background: `${theme.accent}1f`,
            borderColor: `${theme.accent}4d`,
            color: theme.accent,
          }}
        >
          <span>{theme.icon}</span> {theme.label}
        </div>
        {title && (
          <h2
            className="font-clash text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--color-text)] leading-[1.15] mb-6"
            data-testid={`card-${key}-title`}
          >
            {title}
          </h2>
        )}
        <div
          className="prose prose-invert max-w-none font-bricolage text-[var(--color-text)]"
          data-testid={`card-${key}-body`}
          style={{ lineHeight: '1.75', fontSize: '1.0625rem' }}
        >
          {renderMarkdown(content.body_md)}
        </div>
      </div>
    </div>
  );
}

/** Minimal markdown → React renderer. Handles headings (h3/h4), paragraphs,
 *  bullet/numbered lists, blockquotes, bold/italic, inline code. No HTML
 *  injection. */
export function renderMarkdown(md) {
  if (!md) return null;
  const lines = md.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }
    // headings
    const mh = trimmed.match(/^(#{2,4})\s+(.+)$/);
    if (mh) {
      const level = mh[1].length;
      const Tag = level <= 3 ? 'h3' : 'h4';
      blocks.push(<Tag key={i} className={`font-clash font-bold mt-6 mb-3 ${level <= 3 ? 'text-xl' : 'text-lg'} text-[var(--color-text)]`}>{inlineMd(mh[2])}</Tag>);
      i++; continue;
    }
    // blockquote
    if (trimmed.startsWith('>')) {
      const qlines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        qlines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote key={`q-${i}`} className="border-l-4 border-[var(--color-accent-purple)]/40 pl-4 italic text-[var(--color-text-muted)] my-4">
          {inlineMd(qlines.join(' '))}
        </blockquote>,
      );
      continue;
    }
    // numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal pl-6 space-y-2 my-4">
          {items.map((t, j) => <li key={j}>{inlineMd(t)}</li>)}
        </ol>,
      );
      continue;
    }
    // bullet list
    if (/^[-*]\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc pl-6 space-y-2 my-4">
          {items.map((t, j) => <li key={j}>{inlineMd(t)}</li>)}
        </ul>,
      );
      continue;
    }
    // paragraph (collect until blank line / next block)
    const para = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t || /^(#{2,4}\s|\d+\.\s|[-*]\s|>)/.test(t)) break;
      para.push(lines[i]);
      i++;
    }
    if (para.length) {
      blocks.push(<p key={`p-${i}`} className="my-3 text-[var(--color-text-muted)]">{inlineMd(para.join(' '))}</p>);
    }
  }
  return blocks;
}

export function inlineMd(text) {
  // Order matters: code → bold → italic
  const parts = [];
  let rest = text;
  let key = 0;
  const push = (node) => parts.push(<span key={key++}>{node}</span>);
  // very simple split, keeps it deterministic and XSS-safe (no HTML strings inserted)
  while (rest.length > 0) {
    const m = rest.match(/^(.*?)(\*\*([^*]+?)\*\*|\*([^*]+?)\*|_([^_]+?)_|`([^`]+?)`)/);
    if (!m) { push(rest); break; }
    if (m[1]) push(m[1]);
    if (m[2].startsWith('**')) push(<strong className="text-[var(--color-text)]">{m[3]}</strong>);
    else if (m[2].startsWith('*') || m[2].startsWith('_')) push(<em>{m[4] || m[5]}</em>);
    else if (m[2].startsWith('`')) push(<code className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-accent)] text-[0.9em]">{m[6]}</code>);
    rest = rest.slice(m[0].length);
  }
  return parts;
}

export default MarkdownCard;

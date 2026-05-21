import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { markPhaseComplete, updateDailyChallengesForPhase } from '../utils/progress';
import { triggerBadgeEvaluation } from '../utils/badgeBus';
import useTimeTracking from '../utils/useTimeTracking';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Lightbulb, AlertTriangle, Sparkles,
  Zap, TrendingUp, Target, FileText, Loader2, AlertCircle, RefreshCw, X,
} from 'lucide-react';
import AvatarPersona from './tutor/AvatarPersona';
import { resolveTutorPhase } from '../contexts/TutorContext';
import PariTeachingHeader from './tutor/PariTeachingHeader';
import AskPariAboutCard from './tutor/AskPariAboutCard';
import AskPariButton from './tutor/AskPariButton';

// -----------------------------------------------------------
// HELPER: ExtraFields — renders any content keys not already handled,
// so unknown/new fields still show up instead of being silently dropped.
// -----------------------------------------------------------

// splitLede(text) → ["First sentence.", " The remaining text..."]
// Used to give long paragraphs a magazine-style "lede" treatment where the
// first sentence reads bigger / heavier and pulls the eye in.
function splitLede(text) {
  if (!text || typeof text !== 'string') return [text || '', ''];
  // Common abbreviations we should NOT treat as sentence boundaries.
  const ABBR = /(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|Inc|Ltd|Co|Corp|St|vs|etc|i\.e|e\.g|U\.S|U\.K)\.$/;
  // Walk forward, finding sentence-end candidates.
  let i = 0;
  const len = text.length;
  while (i < len) {
    const ch = text[i];
    if (ch === '.' || ch === '!' || ch === '?') {
      // Need following whitespace + uppercase to count as a real boundary.
      const nextSpace = text[i + 1];
      const nextChar = text[i + 2];
      if (nextSpace && /\s/.test(nextSpace) && nextChar && /[A-Z₹"'(]/.test(nextChar)) {
        const candidate = text.slice(0, i + 1);
        // Reject if the lede ends with a known abbreviation.
        if (!ABBR.test(candidate)) {
          // Reject very short ledes (< 30 chars) — likely a stray short opener.
          if (candidate.length >= 30 && candidate.length < text.length - 4) {
            return [candidate, text.slice(i + 1).trim()];
          }
        }
      }
    }
    i += 1;
  }
  return [text, ''];
}

// Section accent rotation — used by deep-dive and example cards so each
// section feels visually distinct rather than a uniform wall.
const SECTION_ACCENTS = ['#246BFD', '#6A5CFF', '#FF6AC1', '#22C55E', '#F59E0B', '#0EA5E9'];

function humanize(key) {
  return String(key).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format any value (string, number, object, array) into a human-readable string.
 * Prevents the "[object Object]" leak when nested JSON lands in a simple field.
 */
function formatValue(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    return v.map((item) => {
      if (item == null) return '';
      if (typeof item === 'object') {
        // Pick the most meaningful string from the object
        const preferred = ['text', 'label', 'value', 'name', 'title', 'description'];
        for (const k of preferred) { if (typeof item[k] === 'string') return item[k]; }
        return Object.values(item).filter((x) => typeof x === 'string' || typeof x === 'number').join(' — ');
      }
      return String(item);
    }).filter(Boolean).join(', ');
  }
  // Plain object — render as "k: v, k: v"
  return Object.entries(v).map(([k, val]) => {
    if (val == null) return null;
    if (typeof val === 'object') return `${humanize(k)}: …`;
    return `${humanize(k)}: ${String(val)}`;
  }).filter(Boolean).join(' • ');
}

/** Nicer labels for common financial-statement abbreviations. */
const KEY_LABEL_OVERRIDES = {
  bs: 'Balance Sheet',
  pl: 'P&L',
  pnl: 'P&L',
  cfs: 'Cash Flow Statement',
  cf: 'Cash Flow',
  cogs: 'COGS',
  ebitda: 'EBITDA',
  ebit: 'EBIT',
  pe: 'P/E',
  roe: 'ROE',
  roa: 'ROA',
  wacc: 'WACC',
  dcf: 'DCF',
  fcf: 'FCF',
  npv: 'NPV',
  irr: 'IRR',
  ytd: 'YTD',
  yoy: 'YoY',
  qoq: 'QoQ',
};

function prettyKey(key) {
  const k = String(key).toLowerCase();
  if (KEY_LABEL_OVERRIDES[k]) return KEY_LABEL_OVERRIDES[k];
  return humanize(key);
}

function ExtraFields({ content, handled = [], accent = '#246BFD' }) {
  if (!content || typeof content !== 'object') return null;
  const handledSet = new Set(handled);
  const entries = Object.entries(content).filter(
    ([k, v]) => !handledSet.has(k) && v != null && v !== ''
  );
  if (!entries.length) return null;
  return (
    <div className="mt-5 space-y-4" data-testid="card-extras">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-xl p-4 bg-[var(--color-surface)]/40 border border-[var(--color-border)]">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] mb-2" style={{ color: accent }}>
            {humanize(k)}
          </div>
          <ExtraFieldValue value={v} accent={accent} />
        </div>
      ))}
    </div>
  );
}

function ExtraFieldValue({ value }) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return (
      <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
        {String(value)}
      </p>
    );
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1.5">
        {value.map((item, i) => (
          <li key={i} className="text-sm font-bricolage text-[var(--color-text)]">
            <span>• {typeof item === 'object' && item !== null ? Object.values(item).filter((v) => typeof v === 'string' || typeof v === 'number').join(' — ') : String(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
// Inline nested renderer — avoids recursion to stay compatible with
// the @emergentbase/visual-edits babel plugin.
function NestedValue({ value }) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1 list-none">
        {value.map((item, i) => (
          <li key={i} className="pl-2 text-sm font-bricolage text-[var(--color-text)] break-words">
            <span className="text-[var(--color-text-muted)] mr-1">•</span>
            {typeof item === 'object' && item !== null
              ? Object.values(item).filter((v) => typeof v === 'string' || typeof v === 'number').join(' — ')
              : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  // Object: render as key/value pairs
  return (
    <div className="space-y-1">
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="text-sm font-bricolage text-[var(--color-text)] break-words">
          <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-muted)] mr-2">
            {humanize(k)}:
          </span>
          <span>{typeof v === 'object' && v !== null ? JSON.stringify(v).slice(0, 300) : String(v)}</span>
        </div>
      ))}
    </div>
  );
}

  // object (one level flat)
  return (
    <div className="space-y-1.5 min-w-0">
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="text-sm font-bricolage text-[var(--color-text)] min-w-0">
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-0.5">
            {humanize(k)}:
          </div>
          {typeof v === 'object' && v !== null ? (
            <div className="pl-2">
              <NestedValue value={v} />
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{String(v)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------
// CARD RENDERERS
// -----------------------------------------------------------

function HookCard({ content, title }) {
  const c = content || {};
  // Known aliases
  const scenario = c.scenario || c.setup || c.story || c.narrative;
  const insight = c.insight || c.aha || c.main_text || c.text;
  const why_it_matters = c.why_it_matters || c.matters || c.importance || c.call_to_action || c.intrigue_hook;
  // Fallbacks for alt schemas
  const sub_text = c.sub_text || c.subtitle || c.description || c.subheading;
  return (
    <div
      className="relative w-full h-full flex flex-col justify-center overflow-hidden rounded-3xl px-6 py-10 sm:px-12 sm:py-14"
      style={{
        background: 'linear-gradient(135deg, rgba(255,106,193,0.12) 0%, rgba(106,92,255,0.08) 100%)',
        border: '1px solid rgba(255,106,193,0.2)',
      }}
      data-testid="card-hook"
    >
      <div className="absolute top-0 left-0 w-48 h-48 bg-[#FF6AC1] opacity-20 blur-[100px] rounded-full" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#6A5CFF] opacity-20 blur-[120px] rounded-full" />

      <div className="relative z-10">
        <PariTeachingHeader cardType="hook" cardTitle={title} accent="#FF6AC1" />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6AC1]/15 border border-[#FF6AC1]/30 text-[#FF6AC1] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
          <Zap size={11} /> Hook
        </div>
        {title && (
          <h2 className="font-clash text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--color-text)] leading-[1.15] mb-5" data-testid="hook-title">
            {title}
          </h2>
        )}
        {scenario && (() => {
          const [lede, rest] = splitLede(scenario);
          return (
            <div className="mb-6 pl-5 border-l-[3px] border-[#FF6AC1]/50 relative">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FF6AC1] mb-2">The Scenario</div>
              <p className="font-clash text-xl sm:text-2xl text-[var(--color-text)] font-semibold leading-[1.3] mb-2" data-testid="hook-scenario-lede">
                {lede}
              </p>
              {rest && (
                <p className="text-base text-[var(--color-text-muted)] font-bricolage leading-relaxed">
                  {rest}
                </p>
              )}
            </div>
          );
        })()}
        {insight && (
          <div className="mb-5 glass-card rounded-xl p-4 border-[#6A5CFF]/25">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#6A5CFF] mb-1.5">
              <Sparkles size={11} /> The Insight
            </div>
            <p className="text-base text-[var(--color-text)] font-bricolage leading-relaxed">
              {insight}
            </p>
          </div>
        )}
        {why_it_matters && (
          <div className="pt-5 border-t border-[var(--color-border)]">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FF6AC1] mb-1.5">Why It Matters</div>
            <p className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed italic">
              {why_it_matters}
            </p>
          </div>
        )}
        {!scenario && !insight && !why_it_matters && sub_text && (
          <p className="text-base sm:text-lg text-[var(--color-text-muted)] font-bricolage leading-relaxed max-w-2xl">
            {sub_text}
          </p>
        )}
        <div className="mt-6 flex justify-end">
          <AskPariAboutCard cardType="hook" cardTitle={title} cardContent={content} />
        </div>
      </div>
    </div>
  );
}

function ConceptCard({ content, title }) {
  const c = content || {};
  const displayHeading = c.heading || c.title || title;
  const definition = c.definition || c.explanation || c.body || c.text || c.description;
  const analogy = c.analogy || c.metaphor;
  const forces = c.forces || c.factors || c.drivers || [];
  const core_operations = c.core_operations || c.operations || c.mechanics || [];
  const key_terms = c.key_terms || c.terms || c.definitions || [];
  const core_principle = c.core_principle || c.principle || c.key_insight || c.insight;
  const discount_rate = c.discount_rate; // special field

  const handled = [
    'heading', 'title', 'definition', 'explanation', 'body', 'text', 'description',
    'analogy', 'metaphor', 'forces', 'factors', 'drivers',
    'core_operations', 'operations', 'mechanics',
    'key_terms', 'terms', 'definitions',
    'core_principle', 'principle', 'key_insight', 'insight',
    'discount_rate',
  ];

  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[#246BFD]/20" data-testid="card-concept">
      <PariTeachingHeader cardType="concept" cardTitle={displayHeading} accent="#246BFD" />
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#246BFD]/10 border border-[#246BFD]/25 text-[#246BFD] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
        <Target size={11} /> Concept
      </div>
      {displayHeading && (
        <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-4" data-testid="concept-heading">
          {displayHeading}
        </h2>
      )}
      {definition && (() => {
        // Split on existing paragraph breaks first; fall back to a sentence-based lede.
        const paragraphs = definition.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
        const first = paragraphs[0] || definition;
        const restParas = paragraphs.slice(1);
        return (
          <div className="mb-7 max-w-3xl">
            <p className="font-bricolage text-lg sm:text-xl text-[var(--color-text)] font-semibold leading-[1.55]">
              <span className="float-left font-clash text-[64px] sm:text-[72px] font-bold leading-[0.85] mr-3 mt-1.5 bg-gradient-to-br from-[#246BFD] to-[#6A5CFF] bg-clip-text text-transparent select-none">
                {(first || ' ').trim().charAt(0)}
              </span>
              {(first || '').trim().slice(1)}
            </p>
            {restParas.map((p, i) => (
              <p
                key={i}
                className="text-base font-bricolage text-[var(--color-text-muted)] leading-relaxed mt-4 clear-left"
              >
                {p}
              </p>
            ))}
          </div>
        );
      })()}

      {analogy && (
        <div className="rounded-xl p-4 bg-[#FF6AC1]/6 border border-[#FF6AC1]/20 mb-5 flex gap-3">
          <Lightbulb size={18} className="text-[#FF6AC1] shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FF6AC1] mb-1">Analogy</div>
            <p className="text-sm font-bricolage text-[var(--color-text)] italic leading-relaxed">{analogy}</p>
          </div>
        </div>
      )}

      {forces.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-3">
            Forces at Play
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="concept-forces">
            {forces.map((f, i) => (
              <div key={i} className="glass-card rounded-xl p-4 border-[var(--color-border)]">
                <div className="text-sm font-clash font-semibold text-[#246BFD] mb-1.5">
                  {typeof f === 'string' ? f : (f.name || f.title)}
                </div>
                {typeof f !== 'string' && (f.explanation || f.description) && (
                  <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                    {f.explanation || f.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {core_operations.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-3">
            Core Operations
          </div>
          <div className="space-y-2" data-testid="concept-core-operations">
            {core_operations.map((op, i) => (
              <div key={i} className="flex items-start gap-3 glass-card rounded-xl p-4 border-[var(--color-border)]">
                <div className="w-7 h-7 rounded-lg bg-[#246BFD]/12 border border-[#246BFD]/25 text-[#246BFD] flex items-center justify-center text-xs font-mono font-semibold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-clash font-semibold text-[var(--color-text)] mb-1">
                    {typeof op === 'string' ? op : (op.name || op.title)}
                  </div>
                  {typeof op !== 'string' && (op.description || op.explanation) && (
                    <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                      {op.description || op.explanation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {key_terms.length > 0 && (
        <div className="mb-6" data-testid="concept-key-terms">
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-3">
            Vocabulary you'll keep using
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {key_terms.map((t, i) => {
              const term = typeof t === 'string' ? t : (t.term || t.name || t.key || '');
              const def = typeof t === 'string' ? '' : (t.definition || t.meaning || t.description || t.value || '');
              const accent = SECTION_ACCENTS[i % SECTION_ACCENTS.length];
              return (
                <div
                  key={i}
                  className="group rounded-2xl p-4 border border-[var(--color-border)] bg-[var(--color-surface)]/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(36,107,253,0.08)]"
                  style={{ borderLeftWidth: '3px', borderLeftColor: `${accent}66` }}
                >
                  {term && (
                    <div className="text-[11px] font-mono uppercase tracking-[0.12em] mb-1.5 transition-colors" style={{ color: accent }}>
                      {term}
                    </div>
                  )}
                  {def && (
                    <div className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed">{def}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {discount_rate && (
        <div className="rounded-xl p-4 bg-[#6A5CFF]/6 border border-[#6A5CFF]/20 mb-5">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6A5CFF] mb-1.5">Discount Rate</div>
          <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed">{discount_rate}</p>
        </div>
      )}

      {core_principle && (
        <div className="relative rounded-2xl p-6 sm:p-7 bg-gradient-to-br from-[#246BFD]/8 via-[#6A5CFF]/5 to-transparent border border-[#246BFD]/25 overflow-hidden" data-testid="concept-principle">
          <span className="absolute -top-4 left-4 font-clash text-7xl text-[#246BFD]/20 leading-none select-none pointer-events-none">"</span>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#246BFD] mb-2 relative">
            <Sparkles size={11} /> The takeaway
          </div>
          <p className="font-clash text-lg sm:text-xl text-[var(--color-text)] font-semibold leading-snug relative">
            {core_principle}
          </p>
        </div>
      )}

      <ExtraFields content={c} handled={handled} accent="#246BFD" />
      <div className="mt-6 flex justify-end">
        <AskPariAboutCard cardType="concept" cardTitle={displayHeading} cardContent={content} />
      </div>
    </div>
  );
}

function FormulaSubCard({ f, idx }) {
  const name = f.name || f.formula_name || f.title || `Formula ${idx + 1}`;
  const display = f.display || f.formula_display || f.formula || f.equation || f.expression;
  const variables = f.variables || f.vars || f.symbols || [];
  const plainEnglish = f.plain_english || f.intuition;
  const tells = f.tells; // legacy short "what it tells you"
  const computation = Array.isArray(f.computation)
    ? f.computation
    : (typeof f.computation === 'string' && f.computation.trim() ? [f.computation] : null);
  const notes = f.notes || f.note || f.description || f.explanation;
  const example = f.example || f.example_calculation || f.worked_example;
  const sensitivity = f.sensitivity || f.sensitivity_note;
  const analystNote = f.analyst_note;
  const excel = f.excel;

  return (
    <div className="glass-card rounded-2xl p-5 border-[#6A5CFF]/15">
      <div className="text-sm font-clash font-semibold text-[#6A5CFF] mb-3">{name}</div>

      {display && (
        <div className="rounded-xl px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-br from-[#6A5CFF]/10 to-[#246BFD]/5 border border-[#6A5CFF]/20 text-center mb-3 overflow-x-auto">
          <code className="font-mono text-base sm:text-lg lg:text-xl text-[var(--color-text)] font-semibold whitespace-pre-wrap">
            {display}
          </code>
        </div>
      )}

      {tells && !plainEnglish && (
        <p className="text-xs font-bricolage text-[var(--color-text)] mb-3">
          <span className="text-[#6A5CFF] font-semibold">Tells you: </span>{tells}
        </p>
      )}

      {variables.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1">Variables</div>
          {variables.map((v, i) => (
            <div key={i} className="flex items-start gap-3 text-xs font-bricolage">
              <code className="font-mono text-[#6A5CFF] font-semibold bg-[#6A5CFF]/10 px-2 py-0.5 rounded shrink-0">
                {typeof v === 'string' ? v : (v.symbol || v.name || v.key)}
              </code>
              {typeof v !== 'string' && (
                <span className="text-[var(--color-text-muted)]">
                  {v.meaning || v.description || v.definition || v.value || ''}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {plainEnglish && (
        <div className="mt-3 rounded-xl p-4 bg-gradient-to-br from-[#6A5CFF]/8 to-transparent border border-[#6A5CFF]/20">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#6A5CFF] mb-2">
            <Sparkles size={11} /> In plain English
          </div>
          <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed">{plainEnglish}</p>
        </div>
      )}

      {computation && computation.length > 0 && (
        <div className="mt-3 rounded-xl p-4 bg-[#22C55E]/6 border border-[#22C55E]/20">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#22C55E] mb-2">
            <Target size={11} /> Let's plug in real numbers
          </div>
          {computation.length === 1 ? (
            <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">{computation[0]}</p>
          ) : (
            <ol className="space-y-1.5 list-decimal list-inside">
              {computation.map((step, i) => (
                <li key={i} className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed">{step}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      {notes && (
        <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed mt-2 italic">
          {notes}
        </p>
      )}

      {example && typeof example === 'object' && (
        <div className="mt-3 rounded-lg p-3 bg-[var(--color-surface)]/50 border border-[var(--color-border)]">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6A5CFF] mb-1.5">Worked Example</div>
          <ExtraFieldValue value={example} accent="#6A5CFF" />
        </div>
      )}
      {example && typeof example === 'string' && (
        <p className="text-xs font-bricolage text-[var(--color-text)] mt-3 whitespace-pre-wrap">{example}</p>
      )}

      {sensitivity && (
        <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed mt-3">
          <span className="text-[#FF6AC1] font-semibold">Sensitivity: </span>
          {typeof sensitivity === 'string' ? sensitivity : (Array.isArray(sensitivity) ? sensitivity.join(' ') : '')}
        </p>
      )}

      {analystNote && (
        <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed mt-2">
          <span className="text-[#246BFD] font-semibold">Analyst Note: </span>{analystNote}
        </p>
      )}

      {excel && (
        <p className="text-xs font-mono text-[var(--color-text-muted)] mt-3 bg-[var(--color-bg-primary)]/60 px-2 py-1 rounded">
          Excel: {excel}
        </p>
      )}
    </div>
  );
}

function FormulaCard({ content, title }) {
  const c = content || {};
  const displayName = c.formula_name || c.name || c.title || title;
  // Support BOTH: a `formulas` array OR a single formula at the top level
  const formulasArray = Array.isArray(c.formulas) ? c.formulas : null;

  const formula_display = c.formula_display || c.formula || c.equation || c.expression;
  const variables = c.variables || c.vars || c.symbols || [];
  const example_calculation = c.example_calculation || c.example || c.worked_example || {};
  const quick_rule = c.quick_rule || c.rule || c.tip || c.rule_of_thumb;
  const ex = example_calculation || {};

  const handled = [
    'formula_name', 'name', 'title',
    'formulas',
    'formula_display', 'formula', 'equation', 'expression',
    'variables', 'vars', 'symbols',
    'example_calculation', 'example', 'worked_example',
    'quick_rule', 'rule', 'tip', 'rule_of_thumb',
  ];

  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[#6A5CFF]/20" data-testid="card-formula">
      <PariTeachingHeader cardType="formula" cardTitle={displayName || title} accent="#6A5CFF" />
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6A5CFF]/10 border border-[#6A5CFF]/25 text-[#6A5CFF] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
        <TrendingUp size={11} /> Formula
      </div>
      {(displayName || title) && (
        <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-6" data-testid="formula-name">
          {displayName || title}
        </h2>
      )}

      {/* Multiple formulas (array) */}
      {formulasArray && formulasArray.length > 0 && (
        <div className="space-y-4 mb-5" data-testid="formula-list">
          {formulasArray.map((f, i) => (
            <FormulaSubCard key={i} f={f} idx={i} />
          ))}
        </div>
      )}

      {/* Single formula (legacy / top-level fields) */}
      {!formulasArray && formula_display && (
        <div className="rounded-2xl px-5 sm:px-8 py-6 sm:py-8 bg-gradient-to-br from-[#6A5CFF]/10 to-[#246BFD]/5 border border-[#6A5CFF]/25 text-center mb-6 overflow-x-auto">
          <code className="font-mono text-xl sm:text-2xl lg:text-3xl text-[var(--color-text)] font-semibold whitespace-pre-wrap" data-testid="formula-display">
            {formula_display}
          </code>
        </div>
      )}

      {!formulasArray && variables.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-3">
            Variables
          </div>
          <div className="space-y-2" data-testid="formula-variables">
            {variables.map((v, i) => (
              <div key={i} className="flex items-start gap-3 text-sm font-bricolage">
                <code className="font-mono text-[#6A5CFF] font-semibold bg-[#6A5CFF]/10 px-2 py-0.5 rounded shrink-0">
                  {typeof v === 'string' ? v : (v.symbol || v.name || v.key)}
                </code>
                {typeof v !== 'string' && (
                  <span className="text-[var(--color-text-muted)]">{v.meaning || v.description || v.definition || ''}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!formulasArray && (ex.context || ex.values || ex.result) && (
        <div className="rounded-xl p-5 bg-[var(--color-surface)]/50 border border-[var(--color-border)] mb-5" data-testid="formula-example">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6A5CFF] mb-2">
            Worked Example
          </div>
          {ex.context && <p className="text-sm font-bricolage text-[var(--color-text)] mb-3">{ex.context}</p>}
          {ex.values && (
            <code className="block font-mono text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-primary)]/50 px-3 py-2 rounded-lg mb-3 whitespace-pre-wrap">
              {typeof ex.values === 'string' ? ex.values : JSON.stringify(ex.values, null, 2)}
            </code>
          )}
          {ex.result && (
            <div className="text-sm font-bricolage text-[var(--color-text)]">
              <span className="text-xs font-mono text-[var(--color-text-muted)]">Result: </span>
              <span className="font-semibold text-[#6A5CFF]">{ex.result}</span>
            </div>
          )}
          {ex.interpretation && (
            <p className="text-xs font-bricolage text-[var(--color-text-muted)] italic mt-2">
              {ex.interpretation}
            </p>
          )}
        </div>
      )}

      {quick_rule && (
        <div className="rounded-xl p-4 bg-[#FF6AC1]/8 border border-[#FF6AC1]/20 flex gap-3">
          <Lightbulb size={18} className="text-[#FF6AC1] shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FF6AC1] mb-1">Quick Rule</div>
            <p className="text-sm font-bricolage text-[var(--color-text)]">{quick_rule}</p>
          </div>
        </div>
      )}

      <ExtraFields content={c} handled={handled} accent="#6A5CFF" />
      <div className="mt-6 flex justify-end">
        <AskPariAboutCard cardType="formula" cardTitle={displayName || title} cardContent={content} />
      </div>
    </div>
  );
}

function VisualCard({ content, title: topTitle, cardId }) {
  const { title, description, svg_content, image_url: contentImageUrl, caption, alt_text } = content || {};
  const displayTitle = title || topTitle;
  const apiBase = process.env.REACT_APP_BACKEND_URL;

  // Build a richer description by harvesting any text in nested fields
  // (so cards like Session 11 WACC — which store descriptions inside
  // sub-objects like u_curve/wacc_waterfall — still get a meaningful prompt).
  const promptDescription = useMemo(() => {
    if (description && typeof description === 'string') return description;
    const parts = [];
    const walk = (v, depth = 0) => {
      if (depth > 3 || parts.length > 8) return;
      if (typeof v === 'string') {
        if (v.trim().length > 20) parts.push(v.trim());
      } else if (Array.isArray(v)) {
        v.forEach((item) => walk(item, depth + 1));
      } else if (v && typeof v === 'object') {
        Object.values(v).forEach((val) => walk(val, depth + 1));
      }
    };
    walk(content);
    return parts.slice(0, 4).join(' ').slice(0, 600);
  }, [description, content]);

  const [generatedUrl, setGeneratedUrl] = useState(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState(null);

  const finalImageUrl = contentImageUrl || generatedUrl;
  const shouldGenerate = !svg_content && !contentImageUrl && !!cardId && !!displayTitle;

  useEffect(() => {
    if (!shouldGenerate) return;
    // Check localStorage first
    const cacheKey = `vv-visual-${cardId}`;
    const cached = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
    if (cached) {
      setGeneratedUrl(cached);
      return;
    }

    let cancelled = false;
    async function generate() {
      setGenLoading(true);
      setGenError(null);
      try {
        const resp = await fetch(`${apiBase}/api/visual/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card_id: cardId,
            title: displayTitle || '',
            description: promptDescription || '',
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(errText || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (cancelled) return;
        const url = data.image_url;
        setGeneratedUrl(url);
        // Cache locally
        try { localStorage.setItem(cacheKey, url); } catch { /* quota */ }
        // Cache to Supabase (best-effort; silently fails if RLS blocks)
        try {
          const updatedContent = { ...(content || {}), image_url: url };
          await supabase
            .from('master_notes_cards')
            .update({ content: updatedContent })
            .eq('id', cardId);
        } catch { /* ignore */ }
      } catch (err) {
        if (!cancelled) setGenError(err.message || 'Failed to generate visual');
      } finally {
        if (!cancelled) setGenLoading(false);
      }
    }
    generate();
    return () => { cancelled = true; };
  }, [shouldGenerate, cardId, displayTitle, promptDescription, apiBase, content]);

  // Pick the single best 2-3 line summary from whatever the card provides.
  // Priority: explicit description -> caption -> harvested longest text.
  // Line-clamp at 3 lines (CSS) keeps it visually compact regardless of length.
  const summary = useMemo(() => {
    const candidates = [];
    if (typeof description === 'string' && description.trim()) candidates.push(description.trim());
    if (typeof caption === 'string' && caption.trim()) candidates.push(caption.trim());
    if (!candidates.length && promptDescription) candidates.push(promptDescription);
    return candidates[0] || '';
  }, [description, caption, promptDescription]);

  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[#246BFD]/20 text-center" data-testid="card-visual">
      <PariTeachingHeader cardType="visual" cardTitle={displayTitle} accent="#246BFD" className="text-left" />
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#246BFD]/10 border border-[#246BFD]/25 text-[#246BFD] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
        <FileText size={11} /> Visual
      </div>
      <div className="rounded-2xl bg-[var(--color-surface)]/50 border border-[var(--color-border)] p-4 sm:p-6 flex items-center justify-center min-h-[320px] overflow-hidden relative">
        {svg_content ? (
          <div
            className="max-w-full"
            data-testid="visual-svg"
            dangerouslySetInnerHTML={{ __html: svg_content }}
          />
        ) : finalImageUrl ? (
          <img
            src={finalImageUrl}
            alt={alt_text || displayTitle || 'Visual'}
            className="max-w-full h-auto rounded-xl shadow-[0_8px_32px_rgba(36,107,253,0.15)]"
            data-testid="visual-img"
          />
        ) : genLoading ? (
          <div className="flex flex-col items-center justify-center w-full" data-testid="visual-generating">
            {/* Shimmer */}
            <div className="w-full max-w-md aspect-square rounded-2xl overflow-hidden relative bg-gradient-to-br from-[#246BFD]/8 via-[#6A5CFF]/8 to-[#FF6AC1]/8">
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                  animation: 'vvShimmer 1.8s ease-in-out infinite',
                }}
              />
            </div>
            <div className="flex items-center gap-2 mt-5 text-sm font-bricolage text-[var(--color-text-muted)]">
              <Sparkles size={14} className="text-[#6A5CFF] animate-pulse" />
              <span>Generating visual<span className="vv-ellipsis" /></span>
              <Loader2 size={14} className="animate-spin text-[#246BFD]" />
            </div>
            <style>{`
              @keyframes vvShimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
              .vv-ellipsis::after {
                display: inline-block;
                animation: vvDots 1.4s steps(4, end) infinite;
                content: '';
                width: 1.2em;
                text-align: left;
              }
              @keyframes vvDots {
                0%   { content: ''; }
                25%  { content: '.'; }
                50%  { content: '..'; }
                75%  { content: '...'; }
                100% { content: ''; }
              }
            `}</style>
          </div>
        ) : genError ? (
          <div className="flex flex-col items-center justify-center py-8" data-testid="visual-error">
            <AlertCircle size={28} className="text-[var(--color-error)] mb-3" />
            <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-1">Couldn't generate visual</p>
            <p className="text-xs text-[var(--color-text-faint)] font-mono">{genError}</p>
          </div>
        ) : (
          <span className="text-xs text-[var(--color-text-faint)] font-mono">NO VISUAL</span>
        )}
      </div>
      {summary && (
        <p
          className="text-sm text-[var(--color-text-muted)] font-bricolage leading-relaxed mt-5 max-w-xl mx-auto overflow-hidden"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
          data-testid="visual-summary"
        >
          {summary}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <AskPariAboutCard cardType="visual" cardTitle={displayTitle} cardContent={content} />
      </div>
    </div>
  );
}

function DeepDiveCard({ content, title }) {
  const { heading, introduction, sections = [], bottom_line } = content || {};
  const displayHeading = heading || title;

  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[#6A5CFF]/20 max-h-[78vh] overflow-y-auto" data-testid="card-deepdive">
      <PariTeachingHeader cardType="deep_dive" cardTitle={displayHeading} accent="#6A5CFF" />
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6A5CFF]/10 border border-[#6A5CFF]/25 text-[#6A5CFF] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
        <TrendingUp size={11} /> Deep Dive
      </div>
      {displayHeading && (
        <h2 className="font-clash text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--color-text)] leading-[1.15] mb-4">
          {displayHeading}
        </h2>
      )}
      {introduction && (
        <p className="text-base sm:text-lg text-[var(--color-text-muted)] font-bricolage leading-relaxed mb-8 max-w-3xl">
          {introduction}
        </p>
      )}

      <div className="space-y-10" data-testid="deepdive-sections">
        {sections.map((sec, i) => {
          const subheading = sec.subheading || sec.heading || sec.title || `Section ${i + 1}`;
          const body = sec.content || sec.text || sec.body || '';
          const accent = SECTION_ACCENTS[i % SECTION_ACCENTS.length];
          const [lede, rest] = splitLede(body);
          return (
            <article key={i} className="grid grid-cols-[auto_1fr] gap-4 sm:gap-5 group">
              <div className="flex flex-col items-center pt-1">
                <span
                  className="font-clash text-3xl sm:text-4xl font-bold leading-none transition-transform duration-200 group-hover:scale-105"
                  style={{ color: accent }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                {i < sections.length - 1 && (
                  <span
                    className="w-px flex-1 mt-3 opacity-30"
                    style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }}
                  />
                )}
              </div>
              <div className="min-w-0 pb-2">
                <h3
                  className="font-clash text-lg sm:text-xl font-semibold mb-3 leading-snug"
                  style={{ color: 'var(--color-text)' }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle"
                    style={{ background: accent }}
                  />
                  {subheading}
                </h3>
                {lede && (
                  <p
                    className="font-bricolage text-base sm:text-lg text-[var(--color-text)] leading-relaxed mb-2 font-medium"
                    style={{ borderLeft: `2px solid ${accent}40`, paddingLeft: '14px' }}
                  >
                    {lede}
                  </p>
                )}
                {rest && (
                  <p className="font-bricolage text-sm sm:text-base text-[var(--color-text-muted)] leading-relaxed pl-[14px] whitespace-pre-wrap">
                    {rest}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {bottom_line && (
        <div className="mt-10 rounded-2xl p-6 bg-gradient-to-br from-[#6A5CFF]/12 via-[#246BFD]/6 to-transparent border border-[#6A5CFF]/30 relative overflow-hidden">
          <span className="absolute -top-2 left-4 font-clash text-6xl text-[#6A5CFF]/25 leading-none select-none pointer-events-none">"</span>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6A5CFF] mb-2 relative">
            Bottom line
          </div>
          <p className="font-clash text-base sm:text-lg font-semibold text-[var(--color-text)] leading-relaxed relative">
            {bottom_line}
          </p>
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <AskPariAboutCard cardType="deep_dive" cardTitle={displayHeading} cardContent={content} />
      </div>
    </div>
  );
}

function ExampleCard({ content, title }) {
  const c = content || {};
  const company_name = c.company_name || c.company || c.subject;
  const displayCompany = company_name || title;
  const situation = c.situation || c.context || c.description || c.scenario || c.body || c.introduction || c.story;
  const dataDict = c.data || c.inputs || c.givens;
  // New schema (Phase 35+): data may be { headers: [...], rows: [[...]] }
  const isTabular = dataDict && typeof dataDict === 'object' && Array.isArray(dataDict.headers) && Array.isArray(dataDict.rows);
  let analysis = c.analysis || c.walkthrough_steps || c.steps || c.walkthrough || [];
  // Defensive: some authored content stores analysis as a single string paragraph.
  // Normalize to array so the renderer below can safely .map().
  if (typeof analysis === 'string') {
    analysis = analysis.trim() ? [analysis] : [];
  } else if (!Array.isArray(analysis)) {
    analysis = [];
  }
  const verdict = c.verdict || c.conclusion;
  const deeper_insight = c.deeper_insight || c.insight || c.takeaway;
  const connection = c.connection_to_equities || c.connection || c.wider_application;
  const total_intrinsic_value = [c.total_intrinsic_value, c.total_value, c.final_value].find((v) => v != null);
  const key_insight = c.key_insight || c.lesson;

  const handled = [
    'company_name', 'company', 'subject',
    'situation', 'context', 'description', 'scenario', 'body', 'introduction', 'story',
    'data', 'inputs', 'givens',
    'analysis', 'walkthrough_steps', 'steps', 'walkthrough',
    'verdict', 'conclusion',
    'deeper_insight', 'insight', 'takeaway',
    'connection_to_equities', 'connection', 'wider_application',
    'total_intrinsic_value', 'total_value', 'final_value',
    'key_insight', 'lesson',
  ];

  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[#246BFD]/20" data-testid="card-example">
      <PariTeachingHeader cardType="example" cardTitle={displayCompany || title} accent="#246BFD" />
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#246BFD]/10 border border-[#246BFD]/25 text-[#246BFD] text-[10px] font-mono uppercase tracking-[0.2em]">
          <FileText size={11} /> Real Example
        </div>
        {displayCompany && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-bricolage font-semibold text-[var(--color-text)]" data-testid="example-company">
            {displayCompany}
          </div>
        )}
      </div>

      {situation && (() => {
        const [lede, rest] = splitLede(situation);
        return (
          <div className="mb-6 rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-[#246BFD]/6 to-transparent border border-[#246BFD]/15">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#246BFD] mb-2">The story</div>
            <p className="font-clash text-lg sm:text-xl text-[var(--color-text)] font-semibold leading-snug mb-2">
              {lede}
            </p>
            {rest && (
              <p className="text-base font-bricolage text-[var(--color-text-muted)] leading-relaxed">{rest}</p>
            )}
          </div>
        );
      })()}

      {isTabular && (
        <div className="mb-6 rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]/30" data-testid="example-table">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] px-4 sm:px-5 pt-4">
            Side by side
          </div>
          <div className="overflow-x-auto px-2 sm:px-3 pb-3 pt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {dataDict.headers.map((h, i) => (
                    <th
                      key={i}
                      className={`text-left text-xs font-mono uppercase tracking-[0.1em] px-3 py-2 border-b border-[var(--color-border)] ${i === 0 ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)] font-semibold'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataDict.rows.map((row, r) => (
                  <tr
                    key={r}
                    className={`group transition-colors ${r % 2 === 1 ? 'bg-[var(--color-surface)]/40' : ''} hover:bg-[#246BFD]/5`}
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`text-sm px-3 py-2.5 border-b border-[var(--color-border)]/50 ${ci === 0 ? 'font-bricolage text-[var(--color-text)] font-medium' : 'font-mono text-[var(--color-text)]'}`}
                      >
                        {ci === 0 ? cell : (
                          <span className="bg-[#246BFD]/0 group-hover:bg-[#246BFD]/8 px-1 rounded transition-colors">
                            {String(cell)}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isTabular && dataDict && typeof dataDict === 'object' && !Array.isArray(dataDict) && (
        <div className="glass-card rounded-xl p-4 border-[var(--color-border)] mb-5" data-testid="example-data">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
            Inputs
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {Object.entries(dataDict).map(([k, v]) => {
              const isNested = v && typeof v === 'object' && !Array.isArray(v);
              if (isNested) {
                return (
                  <div key={k} className="col-span-1 sm:col-span-2 rounded-lg p-3 bg-[var(--color-surface)]/50 border border-[var(--color-border)]">
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#246BFD] mb-2">{prettyKey(k)}</div>
                    <div className="space-y-1">
                      {Object.entries(v).map(([subK, subV]) => (
                        <div key={subK} className="flex items-start justify-between gap-3 text-xs font-bricolage">
                          <span className="text-[var(--color-text-muted)] break-words">{prettyKey(subK)}</span>
                          <span className="text-[var(--color-text)] font-semibold text-right break-words">
                            {formatValue(subV)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <div key={k} className="flex items-center justify-between gap-2 py-1 border-b border-[var(--color-border)]/50 last:border-0">
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">{prettyKey(k)}</span>
                  <span className="text-sm font-bricolage font-semibold text-[#246BFD] break-words text-right">{formatValue(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {analysis.length > 0 && (
        <div className="mb-6">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#246BFD] mb-3">
            What the numbers tell us
          </div>
          <div className="space-y-3" data-testid="example-analysis">
            {analysis.map((s, i) => {
              const accent = SECTION_ACCENTS[i % SECTION_ACCENTS.length];
              if (typeof s === 'string') {
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl p-4 sm:p-5 bg-[var(--color-surface)]/40 border border-[var(--color-border)]"
                    style={{ borderLeftWidth: '3px', borderLeftColor: `${accent}66` }}
                  >
                    <span className="font-clash text-2xl sm:text-3xl font-bold leading-none" style={{ color: accent }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="text-sm sm:text-base font-bricolage text-[var(--color-text)] leading-relaxed">{s}</p>
                  </div>
                );
              }
              const stepNum = s.step || s.number || i + 1;
              const label = s.label || s.title || s.heading || s.name;
              const value = s.value || s.result || s.output || s.amount;
              const explanation = s.explanation || s.description || s.reasoning || s.text || s.body || s.content || s.commentary;
              const knownKeys = new Set(['step', 'number', 'label', 'title', 'heading', 'name', 'value', 'result', 'output', 'amount', 'explanation', 'description', 'reasoning', 'text', 'body', 'content', 'commentary']);
              const extraEntries = Object.entries(s).filter(
                ([k, v]) => !knownKeys.has(k) && (typeof v === 'string' || typeof v === 'number') && v !== ''
              );
              const hasKnownBody = label || value != null || explanation;
              return (
                <div
                  key={i}
                  className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl p-4 sm:p-5 bg-[var(--color-surface)]/40 border border-[var(--color-border)]"
                  style={{ borderLeftWidth: '3px', borderLeftColor: `${accent}66` }}
                >
                  <span className="font-clash text-2xl sm:text-3xl font-bold leading-none" style={{ color: accent }}>
                    {String(stepNum).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    {label && (
                      <div className="text-xs font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-1">{label}</div>
                    )}
                    {value != null && (
                      <div className="font-mono text-sm font-semibold px-2 py-1 rounded inline-block mb-2 break-words max-w-full" style={{ color: accent, background: `${accent}14` }}>
                        {formatValue(value)}
                      </div>
                    )}
                    {explanation && (
                      <p className="text-sm sm:text-base font-bricolage text-[var(--color-text)] leading-relaxed">{explanation}</p>
                    )}
                    {!hasKnownBody && extraEntries.length > 0 && (
                      <div className="space-y-1.5">
                        {extraEntries.map(([k, v]) => (
                          <div key={k} className="text-sm font-bricolage text-[var(--color-text)] break-words">
                            <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-muted)] mr-2">
                              {prettyKey(k)}:
                            </span>
                            <span>{formatValue(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {total_intrinsic_value != null && (
        <div className="rounded-xl p-5 bg-gradient-to-br from-[#6A5CFF]/10 to-[#246BFD]/5 border border-[#6A5CFF]/25 mb-5 text-center">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6A5CFF] mb-1.5">
            Total Intrinsic Value
          </div>
          <div className="font-clash text-3xl font-bold text-[var(--color-text)]">
            {String(total_intrinsic_value)}
          </div>
        </div>
      )}

      {verdict && (
        <div className="rounded-xl p-5 bg-emerald-500/5 border-l-4 border-emerald-500 mb-5" data-testid="example-verdict">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-500 mb-1.5">
            <CheckCircle2 size={11} /> Verdict
          </div>
          <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed">{verdict}</p>
        </div>
      )}

      {deeper_insight && (
        <div className="rounded-xl p-4 bg-[#FF6AC1]/8 border border-[#FF6AC1]/20 flex gap-3 mb-5">
          <Lightbulb size={18} className="text-[#FF6AC1] shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FF6AC1] mb-1">Deeper Insight</div>
            <p className="text-sm font-bricolage text-[var(--color-text)]">{deeper_insight}</p>
          </div>
        </div>
      )}

      {connection && (
        <div className="rounded-xl p-4 bg-[#246BFD]/6 border border-[#246BFD]/20 mb-5">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#246BFD] mb-1.5">Wider Application</div>
          <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed">{connection}</p>
        </div>
      )}

      {key_insight && !deeper_insight && (
        <div className="rounded-xl p-4 bg-[#FF6AC1]/8 border border-[#FF6AC1]/20 flex gap-3">
          <Lightbulb size={18} className="text-[#FF6AC1] shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FF6AC1] mb-1">Key Insight</div>
            <p className="text-sm font-bricolage text-[var(--color-text)]">{key_insight}</p>
          </div>
        </div>
      )}

      <ExtraFields content={c} handled={handled} accent="#246BFD" />
      <div className="mt-6 flex justify-end">
        <AskPariAboutCard cardType="example" cardTitle={displayCompany || title} cardContent={content} />
      </div>
    </div>
  );
}

function MistakeCard({ content, title }) {
  const c = content || {};
  const mistake_title = c.mistake_title || c.heading || c.title;
  const displayTitle = mistake_title || title;
  const scenario = c.scenario || c.description || c.context || c.body || c.situation;
  const wrong_approach = c.wrong_approach || c.wrong || c.incorrect || c.mistake;
  const right_approach = c.right_approach || c.right || c.correct || c.fix;
  const remember = c.remember || c.takeaway || c.key_insight || c.tip || c.lesson;

  const handled = [
    'mistake_title', 'heading', 'title',
    'scenario', 'description', 'context', 'body', 'situation',
    'wrong_approach', 'wrong', 'incorrect', 'mistake',
    'right_approach', 'right', 'correct', 'fix',
    'remember', 'takeaway', 'key_insight', 'tip', 'lesson',
  ];

  const hasComparison = wrong_approach || right_approach;

  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[#FF6AC1]/20" data-testid="card-mistake">
      <PariTeachingHeader cardType="mistake" cardTitle={displayTitle} accent="#FF6AC1" />
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6AC1]/10 border border-[#FF6AC1]/25 text-[#FF6AC1] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
        <AlertTriangle size={11} /> Common Mistake
      </div>
      {displayTitle && (
        <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-4">
          {displayTitle}
        </h2>
      )}
      {scenario && (
        <p className="text-base text-[var(--color-text)] font-bricolage leading-relaxed mb-6">
          {scenario}
        </p>
      )}

      {hasComparison && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" data-testid="mistake-comparison">
          {/* Wrong */}
          {wrong_approach && (
            <div className="rounded-xl p-5 bg-red-500/5 border border-red-500/20">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-red-500 mb-3">
                <X size={14} /> Wrong Approach
              </div>
              {typeof wrong_approach === 'string' ? (
                <p className="text-sm font-bricolage text-[var(--color-text)]">{wrong_approach}</p>
              ) : (
                <>
                  {(wrong_approach.description || wrong_approach.text || wrong_approach.explanation) && (
                    <p className="text-sm font-bricolage text-[var(--color-text)] mb-3">
                      {wrong_approach.description || wrong_approach.text || wrong_approach.explanation}
                    </p>
                  )}
                  {wrong_approach.consequence && (
                    <div className="text-xs font-bricolage text-red-400 italic border-t border-red-500/15 pt-3">
                      → {wrong_approach.consequence}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {/* Right */}
          {right_approach && (
            <div className="rounded-xl p-5 bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-emerald-500 mb-3">
                <CheckCircle2 size={14} /> Right Approach
              </div>
              {typeof right_approach === 'string' ? (
                <p className="text-sm font-bricolage text-[var(--color-text)]">{right_approach}</p>
              ) : (
                <>
                  {(right_approach.description || right_approach.text || right_approach.explanation) && (
                    <p className="text-sm font-bricolage text-[var(--color-text)] mb-3">
                      {right_approach.description || right_approach.text || right_approach.explanation}
                    </p>
                  )}
                  {right_approach.steps && right_approach.steps.length > 0 && (
                    <ol className="space-y-1.5 text-sm font-bricolage text-[var(--color-text)] list-decimal list-inside">
                      {right_approach.steps.map((s, i) => (
                        <li key={i}>{typeof s === 'string' ? s : (s.text || s.step || s.description || JSON.stringify(s))}</li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {remember && (
        <div className="rounded-xl p-4 bg-[#FF6AC1]/8 border border-[#FF6AC1]/20 flex gap-3">
          <Sparkles size={18} className="text-[#FF6AC1] shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FF6AC1] mb-1">Remember</div>
            <p className="text-sm font-bricolage text-[var(--color-text)] font-medium">{remember}</p>
          </div>
        </div>
      )}

      <ExtraFields content={c} handled={handled} accent="#FF6AC1" />
      <div className="mt-6 flex justify-end">
        <AskPariAboutCard cardType="mistake" cardTitle={displayTitle} cardContent={content} />
      </div>
    </div>
  );
}

function SummaryCard({ content, title }) {
  const c = content || {};
  const session_title = c.session_title;
  let key_takeaways = c.key_takeaways || c.takeaways || c.key_points || c.points || [];
  if (typeof key_takeaways === 'string') {
    key_takeaways = key_takeaways.trim() ? [key_takeaways] : [];
  } else if (!Array.isArray(key_takeaways)) {
    key_takeaways = [];
  }
  const interview_tip = c.interview_tip || c.analysts_mindset || c.tip;
  const next_preview = c.next_preview;
  const displayTitle = session_title || title;
  return (
    <div
      className="w-full rounded-3xl p-6 sm:p-10 border-2 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(36,107,253,0.06) 0%, rgba(106,92,255,0.08) 50%, rgba(255,106,193,0.06) 100%)',
        borderImage: 'linear-gradient(135deg, #246BFD, #6A5CFF, #FF6AC1) 1',
        borderColor: 'transparent',
      }}
      data-testid="card-summary"
    >
      <div className="absolute inset-0 rounded-3xl border-2 bg-clip-border pointer-events-none" style={{
        borderImage: 'linear-gradient(135deg, #246BFD, #6A5CFF, #FF6AC1) 1',
      }} />
      <PariTeachingHeader cardType="summary" cardTitle={displayTitle} accent="#6A5CFF" />
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#246BFD]/15 to-[#FF6AC1]/15 border border-[#6A5CFF]/30 text-[#6A5CFF] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
        <Sparkles size={11} /> Summary
      </div>
      {displayTitle && (
        <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-6">
          {displayTitle}
        </h2>
      )}

      {key_takeaways.length > 0 && (
        <div className="mb-6" data-testid="summary-takeaways">
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-3">
            Key Takeaways
          </div>
          <ol className="space-y-3">
            {key_takeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-3 glass-card rounded-xl p-4 border-[var(--color-border)]">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#246BFD] to-[#6A5CFF] text-white flex items-center justify-center text-xs font-mono font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed">
                    {typeof t === 'string' ? t : t.text || JSON.stringify(t)}
                  </p>
                </div>
                <CheckCircle2 size={18} className="text-[#6A5CFF] shrink-0 mt-1" />
              </li>
            ))}
          </ol>
        </div>
      )}

      {interview_tip && (
        <div className="rounded-xl p-5 bg-[#FF6AC1]/8 border border-[#FF6AC1]/25 mb-5" data-testid="summary-interview-tip">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#FF6AC1] mb-2">
            <Lightbulb size={12} /> Interview Tip
          </div>
          <p className="text-sm font-bricolage text-[var(--color-text)] italic leading-relaxed">
            {interview_tip}
          </p>
        </div>
      )}

      {next_preview && (
        <div className="text-xs font-mono text-[var(--color-text-muted)] pt-4 border-t border-[var(--color-border)] flex items-center gap-2">
          <ArrowRight size={12} /> UP NEXT: <span className="text-[var(--color-text)]">{next_preview}</span>
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <AskPariAboutCard cardType="summary" cardTitle={displayTitle} cardContent={content} />
      </div>
    </div>
  );
}

const CARD_RENDERERS = {
  hook: HookCard,
  concept: ConceptCard,
  formula: FormulaCard,
  visual: VisualCard,
  'deep-dive': DeepDiveCard,
  deep_dive: DeepDiveCard,
  deepdive: DeepDiveCard,
  example: ExampleCard,
  mistake: MistakeCard,
  'common-mistake': MistakeCard,
  common_mistake: MistakeCard,
  summary: SummaryCard,
};

function RawFallbackCard({ card }) {
  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[var(--color-border)]" data-testid="card-raw-fallback">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
        {card?.card_type || 'unknown'} · raw
      </div>
      <pre className="text-xs font-mono text-[var(--color-text-muted)] whitespace-pre-wrap break-words bg-[var(--color-surface)]/50 p-4 rounded-xl border border-[var(--color-border)] overflow-auto max-h-[60vh]">
        {JSON.stringify(card?.content || {}, null, 2)}
      </pre>
    </div>
  );
}

function isContentEmpty(content) {
  if (!content || typeof content !== 'object') return true;
  const vals = Object.values(content);
  if (!vals.length) return true;
  return vals.every(
    (v) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)
  );
}

function CardRenderer({ card }) {
  // Log for debugging once per card
  if (typeof window !== 'undefined' && card) {
    // eslint-disable-next-line no-console
    console.log('[NotesPage] card_type:', card.card_type, 'content:', card.content);
  }

  let content = card?.content;
  // Some JSONB columns come through as stringified JSON — try parsing
  if (typeof content === 'string') {
    try { content = JSON.parse(content); } catch { /* leave as-is */ }
  }

  // Normalize card_type: lowercase, replace spaces/underscores with hyphens
  const key = (card?.card_type || '').toString().toLowerCase().trim();
  const Cmp =
    CARD_RENDERERS[key] ||
    CARD_RENDERERS[key.replace(/[_\s]+/g, '-')] ||
    CARD_RENDERERS[key.replace(/[-\s]+/g, '_')];

  if (!Cmp || isContentEmpty(content)) {
    return <RawFallbackCard card={{ ...card, content }} />;
  }
  // Pass top-level title as a fallback for renderers that use heading/main_text
  return <Cmp content={content} title={card?.title} cardId={card?.id} />;
}

// -----------------------------------------------------------
// MAIN PAGE
// -----------------------------------------------------------

export default function NotesPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cards, setCards] = useState([]);
  const [session, setSession] = useState(null);
  const [idx, setIdx] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [startedAt] = useState(() => Date.now());

  // Track active reading time on this page → user_stats.total_time_minutes
  useTimeTracking(user?.id);

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
          .maybeSingle();
        if (sErr) throw sErr;
        if (!mounted) return;
        if (!sess) {
          setError("This session isn't unlocked yet for your account. Please continue from your dashboard.");
          setLoading(false);
          return;
        }
        setSession(sess);

        if (!sess.master_session_id) {
          setCards([]);
          setLoading(false);
          return;
        }

        const { data: notes, error: nErr } = await supabase
          .from('master_notes_cards')
          .select('*')
          .eq('session_id', sess.master_session_id)
          .order('order_index');
        if (nErr) throw nErr;
        if (!mounted) return;
        setCards(notes || []);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load notes');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [sessionId, user?.id]);

  const total = cards.length;
  const isLast = idx === total - 1;

  const goPrev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setIdx((i) => Math.min(total - 1, i + 1));
  }, [total]);

  const complete = useCallback(async () => {
    if (completing || !session) return;
    // In review mode, "complete" just navigates back without re-marking.
    if (session.notes_completed) {
      navigate(`/session/${sessionId}/start`);
      return;
    }
    setCompleting(true);
    const timeSpent = Math.round((Date.now() - startedAt) / 1000);
    try {
      await markPhaseComplete(session.id, 'notes');
      try {
        await triggerBadgeEvaluation({
          source_event: 'notes_complete',
          session_id: session.id,
        });
      } catch { /* fire-and-forget */ }
      try {
        await updateDailyChallengesForPhase(user.id, 'notes', { minutes: Math.max(1, Math.round(timeSpent / 60)) });
      } catch { /* fire-and-forget */ }
    } catch (e) {
      // still navigate
    }
    navigate(`/session/${sessionId}/notes/complete`, {
      state: { cardsReviewed: total, timeSpentSeconds: timeSpent },
    });
  }, [completing, session, startedAt, navigate, sessionId, total]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') {
        if (isLast) complete(); else goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, isLast, complete]);

  // Touch swipe
  const [touchStart, setTouchStart] = useState(null);
  const onTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchStart == null) return;
    const dx = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(dx) > 50) {
      if (dx < 0) { if (isLast) complete(); else goNext(); }
      else goPrev();
    }
    setTouchStart(null);
  };

  const currentCard = useMemo(() => cards[idx], [cards, idx]);
  const isReview = !!session?.notes_completed;

  // ------------- render -------------
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative flex flex-col" style={{ overflowX: 'clip' }}>
      <div className="absolute top-[-10%] left-[10%] w-[600px] h-[600px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.05] blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--color-border)]" data-testid="notes-header">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link
            to={`/session/${sessionId}/start`}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-bricolage group"
            data-testid="notes-back"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">Back</span>
          </Link>

          {session && (
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
              <FileText size={14} className="text-[var(--color-primary)] shrink-0" />
              <span className="text-sm font-bricolage text-[var(--color-text)] truncate" data-testid="notes-session-title">
                {session.title}
              </span>
              {isReview && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)] shrink-0" data-testid="notes-review-badge">
                  <CheckCircle2 size={10} /> REVIEW
                </span>
              )}
            </div>
          )}

          {total > 0 && (
            <div className="text-xs font-mono text-[var(--color-text-muted)] shrink-0" data-testid="notes-counter">
              {idx + 1} / {total}
            </div>
          )}
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-[var(--color-surface)]">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] transition-all duration-500"
            style={{ width: total ? `${((idx + 1) / total) * 100}%` : '0%' }}
          />
        </div>
      </header>

      {/* Card area */}
      <main
        className="flex-1 relative z-10 flex items-start justify-center px-4 sm:px-6 py-8 sm:py-12"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="w-full max-w-3xl mx-auto">
          {loading && (
            <div className="flex items-center justify-center py-20" data-testid="notes-loading">
              <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center text-center py-16" data-testid="notes-error">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center mb-5">
                <AlertCircle size={28} className="text-[var(--color-error)]" />
              </div>
              <p className="text-[var(--color-text)] font-bricolage mb-2">Couldn't load notes</p>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
              >
                <RefreshCw size={16} /> Try Again
              </button>
            </div>
          )}

          {!loading && !error && session && !session.master_session_id && (
            <div className="flex flex-col items-center text-center py-16" data-testid="notes-ai-placeholder">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/20 flex items-center justify-center mb-5">
                <Sparkles size={28} className="text-[var(--color-accent-purple)]" />
              </div>
              <h2 className="font-clash text-2xl font-bold text-[var(--color-text)] mb-2">
                AI-Generated Notes Coming Soon
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage max-w-md mb-6">
                This session was added specifically for your learning path. We're generating custom notes tailored to your goals — check back soon.
              </p>
              <button
                onClick={complete}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)]"
                data-testid="notes-skip-ai"
              >
                Mark Complete & Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {!loading && !error && total > 0 && currentCard && (
            <div key={currentCard.id || idx} className="animate-[fadeIn_0.35s_ease-out]" data-testid="notes-card">
              <CardRenderer card={currentCard} />
            </div>
          )}

          {!loading && !error && session?.master_session_id && total === 0 && (
            <div className="flex flex-col items-center text-center py-16" data-testid="notes-empty">
              <p className="text-[var(--color-text-muted)] font-bricolage mb-5">
                No notes cards for this session yet.
              </p>
              <button
                onClick={complete}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold font-bricolage"
              >
                Mark Complete <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="mt-8 max-w-3xl mx-auto px-4">
          <AskPariButton phase="notes" courseSessionId={sessionId} variant="card" />
        </div>
      </main>
      {(() => {
        const t = resolveTutorPhase('notes_intro');
        return <AvatarPersona pose={t?.pose || 'explaining'} size="sm" position="bottom-right" message={t?.message} />;
      })()}

      {/* Bottom nav bar */}
      {!loading && !error && total > 0 && (
        <div className="sticky bottom-0 z-40 bg-[var(--bg-primary)]/85 backdrop-blur-xl border-t border-[var(--color-border)]" data-testid="notes-nav-bar">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <button
              onClick={goPrev}
              disabled={idx === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bricolage font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="notes-prev"
            >
              <ArrowLeft size={14} /> Previous
            </button>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[50%]" data-testid="notes-dots">
              {cards.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`h-2 rounded-full transition-all shrink-0 ${
                    i === idx
                      ? 'w-8 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)]'
                      : i < idx
                      ? 'w-2 bg-[var(--color-primary)]/40'
                      : 'w-2 bg-[var(--color-surface)] hover:bg-[var(--color-border)]'
                  }`}
                  aria-label={`Go to card ${i + 1}`}
                />
              ))}
            </div>

            {isLast ? (
              isReview ? (
                <Link
                  to={`/session/${sessionId}/start`}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bricolage font-semibold bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)] transition-all"
                  data-testid="notes-review-back"
                >
                  <CheckCircle2 size={14} /> Back to Session
                </Link>
              ) : (
                <button
                  onClick={complete}
                  disabled={completing}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bricolage font-semibold bg-gradient-to-r from-[var(--color-success)] to-emerald-500 text-white hover:shadow-[0_0_24px_rgba(16,185,129,0.4)] transition-all disabled:opacity-60"
                  data-testid="notes-complete"
                >
                  {completing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Complete Notes
                </button>
              )
            ) : (
              <button
                onClick={goNext}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bricolage font-semibold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
                data-testid="notes-next"
              >
                Next <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

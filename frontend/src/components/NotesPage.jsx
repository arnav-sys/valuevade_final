import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { markPhaseComplete } from '../utils/progress';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Lightbulb, AlertTriangle, Sparkles,
  Zap, TrendingUp, Target, FileText, Loader2, AlertCircle, RefreshCw, X,
} from 'lucide-react';

// -----------------------------------------------------------
// CARD RENDERERS
// -----------------------------------------------------------

function HookCard({ content, title }) {
  const { main_text, sub_text, call_to_action } = content || {};
  const displayMain = main_text || title;
  return (
    <div
      className="relative w-full h-full flex flex-col justify-center overflow-hidden rounded-3xl px-8 py-12 sm:px-14 sm:py-16"
      style={{
        background: 'linear-gradient(135deg, rgba(255,106,193,0.12) 0%, rgba(106,92,255,0.08) 100%)',
        border: '1px solid rgba(255,106,193,0.2)',
      }}
      data-testid="card-hook"
    >
      <div className="absolute top-0 left-0 w-48 h-48 bg-[#FF6AC1] opacity-20 blur-[100px] rounded-full" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#6A5CFF] opacity-20 blur-[120px] rounded-full" />

      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6AC1]/15 border border-[#FF6AC1]/30 text-[#FF6AC1] text-[10px] font-mono uppercase tracking-[0.2em] mb-6">
          <Zap size={11} /> Hook
        </div>
        {displayMain && (
          <h2 className="font-clash text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text)] leading-[1.1] mb-5" data-testid="hook-main">
            {displayMain}
          </h2>
        )}
        {sub_text && (
          <p className="text-base sm:text-lg text-[var(--color-text-muted)] font-bricolage leading-relaxed max-w-2xl">
            {sub_text}
          </p>
        )}
        {call_to_action && (
          <div className="mt-8 pt-5 border-t border-[var(--color-border)]">
            <p className="text-sm font-bricolage text-[#FF6AC1] font-medium italic">
              → {call_to_action}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConceptCard({ content, title }) {
  const { heading, explanation, key_terms = [], core_principle } = content || {};
  const displayHeading = heading || title;
  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[#246BFD]/20" data-testid="card-concept">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#246BFD]/10 border border-[#246BFD]/25 text-[#246BFD] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
        <Target size={11} /> Concept
      </div>
      {displayHeading && (
        <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-4" data-testid="concept-heading">
          {displayHeading}
        </h2>
      )}
      {explanation && (
        <p className="text-base text-[var(--color-text)] font-bricolage leading-relaxed mb-6">
          {explanation}
        </p>
      )}

      {key_terms.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6" data-testid="concept-key-terms">
          {key_terms.map((t, i) => (
            <div key={i} className="glass-card rounded-xl p-4 border-[var(--color-border)]">
              <div className="text-xs font-mono uppercase tracking-[0.1em] text-[#246BFD] mb-1.5">
                {t.term}
              </div>
              <div className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                {t.definition}
              </div>
            </div>
          ))}
        </div>
      )}

      {core_principle && (
        <div className="rounded-xl p-5 bg-[#246BFD]/5 border-l-4 border-[#246BFD]" data-testid="concept-principle">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#246BFD] mb-2">
            <Sparkles size={11} /> Core Principle
          </div>
          <p className="text-base font-bricolage text-[var(--color-text)] leading-relaxed italic">
            {core_principle}
          </p>
        </div>
      )}
    </div>
  );
}

function FormulaCard({ content, title }) {
  const { formula_name, formula_display, variables = [], example_calculation, quick_rule } = content || {};
  const displayName = formula_name || title;
  const ex = example_calculation || {};
  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[#6A5CFF]/20" data-testid="card-formula">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6A5CFF]/10 border border-[#6A5CFF]/25 text-[#6A5CFF] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
        <TrendingUp size={11} /> Formula
      </div>
      {displayName && (
        <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-6" data-testid="formula-name">
          {displayName}
        </h2>
      )}

      {formula_display && (
        <div className="rounded-2xl px-5 sm:px-8 py-6 sm:py-8 bg-gradient-to-br from-[#6A5CFF]/10 to-[#246BFD]/5 border border-[#6A5CFF]/25 text-center mb-6 overflow-x-auto">
          <code className="font-mono text-xl sm:text-2xl lg:text-3xl text-[var(--color-text)] font-semibold whitespace-pre-wrap" data-testid="formula-display">
            {formula_display}
          </code>
        </div>
      )}

      {variables.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-3">
            Variables
          </div>
          <div className="space-y-2" data-testid="formula-variables">
            {variables.map((v, i) => (
              <div key={i} className="flex items-start gap-3 text-sm font-bricolage">
                <code className="font-mono text-[#6A5CFF] font-semibold bg-[#6A5CFF]/10 px-2 py-0.5 rounded shrink-0">
                  {v.symbol}
                </code>
                <span className="text-[var(--color-text-muted)]">{v.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(ex.context || ex.values || ex.result) && (
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
    </div>
  );
}

function VisualCard({ content, title: topTitle }) {
  const { title, description, svg_content, image_url, caption, alt_text } = content || {};
  const displayTitle = title || topTitle;
  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[#246BFD]/20 text-center" data-testid="card-visual">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#246BFD]/10 border border-[#246BFD]/25 text-[#246BFD] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
        <FileText size={11} /> Visual
      </div>
      {displayTitle && (
        <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-3">
          {displayTitle}
        </h2>
      )}
      {description && (
        <p className="text-sm text-[var(--color-text-muted)] font-bricolage max-w-xl mx-auto mb-6">
          {description}
        </p>
      )}
      <div className="rounded-2xl bg-[var(--color-surface)]/50 border border-[var(--color-border)] p-4 sm:p-6 flex items-center justify-center min-h-[240px] overflow-auto">
        {svg_content ? (
          <div
            className="max-w-full"
            data-testid="visual-svg"
            dangerouslySetInnerHTML={{ __html: svg_content }}
          />
        ) : image_url ? (
          <img src={image_url} alt={alt_text || title || 'Visual'} className="max-w-full h-auto rounded-lg" data-testid="visual-img" />
        ) : (
          <span className="text-xs text-[var(--color-text-faint)] font-mono">NO VISUAL</span>
        )}
      </div>
      {caption && (
        <p className="text-xs text-[var(--color-text-muted)] font-bricolage italic mt-4">{caption}</p>
      )}
    </div>
  );
}

function DeepDiveCard({ content, title }) {
  const { heading, introduction, sections = [], bottom_line } = content || {};
  const displayHeading = heading || title;
  const [openIdx, setOpenIdx] = useState(() => new Set(sections.map((_, i) => i)));

  const toggle = (i) => {
    setOpenIdx((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[#6A5CFF]/20 max-h-[70vh] overflow-y-auto" data-testid="card-deepdive">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6A5CFF]/10 border border-[#6A5CFF]/25 text-[#6A5CFF] text-[10px] font-mono uppercase tracking-[0.2em] mb-5">
        <TrendingUp size={11} /> Deep Dive
      </div>
      {displayHeading && (
        <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-4">
          {displayHeading}
        </h2>
      )}
      {introduction && (
        <p className="text-base text-[var(--color-text)] font-bricolage leading-relaxed mb-6">
          {introduction}
        </p>
      )}

      <div className="space-y-2 mb-6" data-testid="deepdive-sections">
        {sections.map((sec, i) => {
          const isOpen = openIdx.has(i);
          const subheading = sec.subheading || sec.heading || sec.title || `Section ${i + 1}`;
          const body = sec.content || sec.text || sec.body || '';
          return (
            <div key={i} className="glass-card rounded-xl overflow-hidden border-[var(--color-border)]">
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-surface)] transition-colors"
              >
                <span className="font-clash text-sm font-semibold text-[var(--color-text)]">
                  {subheading}
                </span>
                <ArrowRight
                  size={14}
                  className={`text-[var(--color-text-muted)] shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                />
              </button>
              {isOpen && body && (
                <div className="px-4 pb-4 pt-1 text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                  {body}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {bottom_line && (
        <div className="rounded-xl p-5 bg-gradient-to-br from-[#6A5CFF]/10 to-[#246BFD]/5 border border-[#6A5CFF]/25">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6A5CFF] mb-2">
            Bottom Line
          </div>
          <p className="text-base font-bricolage text-[var(--color-text)] font-medium leading-relaxed">
            {bottom_line}
          </p>
        </div>
      )}
    </div>
  );
}

function ExampleCard({ content, title }) {
  const { company_name, context, walkthrough_steps = [], key_insight } = content || {};
  const displayCompany = company_name || title;
  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[#246BFD]/20" data-testid="card-example">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#246BFD]/10 border border-[#246BFD]/25 text-[#246BFD] text-[10px] font-mono uppercase tracking-[0.2em]">
          <FileText size={11} /> Real Example
        </div>
        {displayCompany && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-bricolage font-semibold text-[var(--color-text)]" data-testid="example-company">
            {displayCompany}
          </div>
        )}
      </div>
      {context && (
        <p className="text-base text-[var(--color-text)] font-bricolage leading-relaxed mb-6">
          {context}
        </p>
      )}

      {walkthrough_steps.length > 0 && (
        <ol className="space-y-3 mb-6" data-testid="example-steps">
          {walkthrough_steps.map((s, i) => (
            <li key={i} className="flex items-start gap-4 glass-card rounded-xl p-4 border-[var(--color-border)]">
              <div className="w-7 h-7 rounded-lg bg-[#246BFD]/15 border border-[#246BFD]/30 text-[#246BFD] flex items-center justify-center text-xs font-mono font-semibold shrink-0">
                {s.step || i + 1}
              </div>
              <div className="flex-1 min-w-0">
                {s.label && (
                  <div className="text-xs font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-1">
                    {s.label}
                  </div>
                )}
                {s.value && (
                  <div className="font-mono text-sm text-[#246BFD] font-semibold bg-[#246BFD]/8 px-2 py-1 rounded inline-block mb-2">
                    {s.value}
                  </div>
                )}
                {s.explanation && (
                  <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed">
                    {s.explanation}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {key_insight && (
        <div className="rounded-xl p-4 bg-[#FF6AC1]/8 border border-[#FF6AC1]/20 flex gap-3">
          <Lightbulb size={18} className="text-[#FF6AC1] shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FF6AC1] mb-1">Key Insight</div>
            <p className="text-sm font-bricolage text-[var(--color-text)]">{key_insight}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MistakeCard({ content, title }) {
  const { mistake_title, scenario, wrong_approach, right_approach, remember } = content || {};
  const displayTitle = mistake_title || title;
  return (
    <div className="w-full rounded-3xl p-6 sm:p-10 glass-card border-[#FF6AC1]/20" data-testid="card-mistake">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" data-testid="mistake-comparison">
        {/* Wrong */}
        <div className="rounded-xl p-5 bg-red-500/5 border border-red-500/20">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-red-500 mb-3">
            <X size={14} /> Wrong Approach
          </div>
          {wrong_approach?.description && (
            <p className="text-sm font-bricolage text-[var(--color-text)] mb-3">
              {wrong_approach.description}
            </p>
          )}
          {wrong_approach?.consequence && (
            <div className="text-xs font-bricolage text-red-400 italic border-t border-red-500/15 pt-3">
              → {wrong_approach.consequence}
            </div>
          )}
        </div>
        {/* Right */}
        <div className="rounded-xl p-5 bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-emerald-500 mb-3">
            <CheckCircle2 size={14} /> Right Approach
          </div>
          {right_approach?.description && (
            <p className="text-sm font-bricolage text-[var(--color-text)] mb-3">
              {right_approach.description}
            </p>
          )}
          {right_approach?.steps && right_approach.steps.length > 0 && (
            <ol className="space-y-1.5 text-sm font-bricolage text-[var(--color-text)] list-decimal list-inside">
              {right_approach.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {remember && (
        <div className="rounded-xl p-4 bg-[#FF6AC1]/8 border border-[#FF6AC1]/20 flex gap-3">
          <Sparkles size={18} className="text-[#FF6AC1] shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FF6AC1] mb-1">Remember</div>
            <p className="text-sm font-bricolage text-[var(--color-text)] font-medium">{remember}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ content, title }) {
  const { session_title, key_takeaways = [], interview_tip, next_preview } = content || {};
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
  return <Cmp content={content} title={card?.title} />;
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
          .single();
        if (sErr) throw sErr;
        if (!mounted) return;
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
    setCompleting(true);
    const timeSpent = Math.round((Date.now() - startedAt) / 1000);
    try {
      await markPhaseComplete(session.id, 'notes');
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

  // ------------- render -------------
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden flex flex-col">
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
        className="flex-1 relative z-10 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12"
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
      </main>

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
              <button
                onClick={complete}
                disabled={completing}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bricolage font-semibold bg-gradient-to-r from-[var(--color-success)] to-emerald-500 text-white hover:shadow-[0_0_24px_rgba(16,185,129,0.4)] transition-all disabled:opacity-60"
                data-testid="notes-complete"
              >
                {completing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Complete Notes
              </button>
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

import { useState } from 'react';
import {
  CheckCircle2, Eye, BookOpen, Sparkles, Layers, Grid3X3, ArrowRight,
} from 'lucide-react';

/**
 * Shared fallback renderer for any simulation config shape.
 * Renders description + all non-meta fields as readable cards,
 * with an "Mark as Explored" action. Exported as a default component
 * so it can be reused across sim_type dispatchers.
 */

const SKIP_KEYS = new Set([
  'id', 'type', 'label', 'scoring', 'scoring_rubric', 'max_score', 'total_points',
  'scenario_count', 'completion_requirement', 'description', 'difficulty',
  'time_limit_minutes', 'role', 'format', 'firm_type', 'debrief_focus',
  'design_theme', 'ui_framework', 'formulas_covered', 'simulation_structure',
  'acid_test', 'firm_context', 'indian_market_context', 'time_pressure_context',
  'font_colour_convention', 'tools_required',
]);

const PREFERRED_TITLE_KEYS = [
  'text', 'label', 'title', 'name', 'question', 'transaction', 'narrative',
  'description', 'scenario', 'prompt',
];

function isPrimitive(v) {
  return v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function prettyKey(k) {
  return String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function briefValue(v) {
  if (isPrimitive(v)) return String(v ?? '');
  if (Array.isArray(v)) return `${v.length} items`;
  if (typeof v === 'object') return `${Object.keys(v).length} fields`;
  return '';
}

function KeyValueList({ data }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return null;
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-3 text-xs font-bricolage break-words">
          <span className="text-[var(--color-text-muted)] font-mono text-[10px] uppercase tracking-[0.12em] shrink-0">
            {prettyKey(k)}
          </span>
          <span className="text-[var(--color-text)] text-right break-words">
            {isPrimitive(v) ? String(v) : briefValue(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ArrayList({ items, limit = 8 }) {
  const [expanded, setExpanded] = useState(false);
  if (!Array.isArray(items) || !items.length) return null;
  const visible = expanded ? items : items.slice(0, limit);
  const rest = items.length - visible.length;

  return (
    <div className="space-y-2">
      {visible.map((item, i) => {
        if (isPrimitive(item)) {
          return (
            <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-[var(--color-surface)]/40 border border-[var(--color-border)]">
              <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <span className="text-sm font-bricolage text-[var(--color-text)] break-words">{String(item)}</span>
            </div>
          );
        }
        const titleKey = PREFERRED_TITLE_KEYS.find((k) => typeof item[k] === 'string');
        const title = titleKey ? item[titleKey] : `Item ${i + 1}`;
        const subFields = Object.entries(item).filter(([k, v]) => {
          if (['label', 'title', 'name', 'id', titleKey].includes(k)) return false;
          return v != null && v !== '';
        });
        return (
          <div key={i} className="rounded-xl p-3 bg-[var(--color-surface)]/40 border border-[var(--color-border)]">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <div className="font-clash text-sm font-semibold text-[var(--color-text)] break-words flex-1 min-w-0">
                {title}
              </div>
            </div>
            {subFields.length > 0 && (
              <div className="pl-9 space-y-1">
                {subFields.slice(0, 6).map(([k, v]) => (
                  <div key={k} className="text-xs font-bricolage text-[var(--color-text-muted)] break-words">
                    <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-[var(--color-text-faint)] mr-2">
                      {prettyKey(k)}:
                    </span>
                    <span className="text-[var(--color-text)]">
                      {isPrimitive(v) ? String(v) :
                        Array.isArray(v) ? `${v.length} items` :
                          briefValue(v)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {rest > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-xs font-mono text-[var(--color-primary)] hover:text-[var(--color-accent-purple)] py-2 rounded-lg hover:bg-[var(--color-surface)]/40 transition-all"
        >
          Show {rest} more
        </button>
      )}
      {expanded && items.length > limit && (
        <button
          onClick={() => setExpanded(false)}
          className="w-full text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 rounded-lg hover:bg-[var(--color-surface)]/40 transition-all"
        >
          Show less
        </button>
      )}
    </div>
  );
}

export default function GenericRenderer({ config, title, onComplete, typeLabel, headerRight = null }) {
  const description = config?.description || config?.task_description || config?.scenario_context || config?.firm_context;
  const extraEntries = Object.entries(config || {}).filter(([k]) => !SKIP_KEYS.has(k));
  const [acknowledged, setAcknowledged] = useState(false);

  const handleComplete = () => {
    setAcknowledged(true);
    onComplete?.({
      tasks_completed: 1,
      tasks_total: 1,
      accuracy: 1,
    });
  };

  return (
    <div className="space-y-5" data-testid="generic-sim-renderer">
      {/* Header */}
      {(title || typeLabel) && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            {typeLabel && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-[10px] font-mono uppercase tracking-[0.2em] mb-2">
                <BookOpen size={11} /> {typeLabel}
              </div>
            )}
            {title && (
              <h2 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)] break-words">{title}</h2>
            )}
          </div>
          {headerRight}
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="glass-card rounded-2xl p-5 sm:p-6" data-testid="generic-sim-description">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-[var(--color-primary)]" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              What you'll do
            </span>
          </div>
          <p className="text-sm sm:text-base font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap break-words">
            {description}
          </p>
        </div>
      )}

      {/* Other fields */}
      {extraEntries.map(([k, v]) => {
        if (v == null || v === '' || v === false) return null;

        if (Array.isArray(v) && v.length > 0) {
          return (
            <div key={k} className="glass-card rounded-2xl p-5" data-testid={`generic-field-${k}`}>
              <div className="flex items-center gap-2 mb-4">
                <Layers size={14} className="text-[var(--color-primary)]" />
                <span className="text-xs font-clash font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                  {prettyKey(k)}
                </span>
                <span className="ml-auto text-[10px] font-mono text-[var(--color-text-muted)]">{v.length} items</span>
              </div>
              <ArrayList items={v} />
            </div>
          );
        }

        if (typeof v === 'object') {
          return (
            <div key={k} className="glass-card rounded-2xl p-5" data-testid={`generic-field-${k}`}>
              <div className="flex items-center gap-2 mb-3">
                <Grid3X3 size={14} className="text-[var(--color-primary)]" />
                <span className="text-xs font-clash font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                  {prettyKey(k)}
                </span>
              </div>
              <KeyValueList data={v} />
            </div>
          );
        }

        return (
          <div key={k} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3" data-testid={`generic-field-${k}`}>
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
              {prettyKey(k)}
            </span>
            <span className="text-sm font-bricolage font-semibold text-[var(--color-text)] break-words text-right">
              {String(v)}
            </span>
          </div>
        );
      })}

      {/* Complete button */}
      {onComplete && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--color-border)]">
          <span className="text-xs font-mono text-[var(--color-text-muted)]">
            {acknowledged ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--color-success)]">
                <CheckCircle2 size={12} /> Simulation reviewed
              </span>
            ) : (
              'Review the content above, then mark as complete'
            )}
          </span>
          <button
            onClick={handleComplete}
            disabled={acknowledged}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="generic-sim-complete"
          >
            <Eye size={14} />
            {acknowledged ? 'Completed' : 'Mark as Complete'}
            {!acknowledged && <ArrowRight size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}

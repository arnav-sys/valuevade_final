import { useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, ExternalLink, CheckCircle2, Circle } from 'lucide-react';

/**
 * Reusable task card used in Module Project and Capstone task lists.
 * Props:
 * - index: 0-based index
 * - task: { title, description, hints?: string[], resources?: [{label,url}] }
 * - isCompleted: boolean
 * - onToggle: () => void
 * - testIdPrefix: e.g. "module-project-task" or "capstone-task"
 */
export default function TaskCard({ index, task, isCompleted, onToggle, testIdPrefix = 'task' }) {
  const [descOpen, setDescOpen] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);

  const hints = Array.isArray(task?.hints) ? task.hints : [];
  const resources = Array.isArray(task?.resources) ? task.resources : [];
  const description = task?.description || '';

  return (
    <div
      className={`glass-card rounded-2xl p-4 sm:p-5 transition-all ${
        isCompleted
          ? 'border-[var(--color-success)]/30 bg-[var(--color-success)]/[0.04]'
          : 'hover:border-[var(--color-primary)]/30'
      }`}
      data-testid={`${testIdPrefix}-${index}`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-all ${
            isCompleted
              ? 'bg-[var(--color-success)] text-white border border-[var(--color-success)]'
              : 'bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]'
          }`}
          data-testid={`${testIdPrefix}-${index}-checkbox`}
          aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={14} className="text-[var(--color-text-faint)]" />}
        </button>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <span className="text-[10px] font-mono text-[var(--color-text-faint)] mt-1">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3
              className={`font-clash text-base sm:text-lg font-semibold leading-snug flex-1 ${
                isCompleted ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'
              }`}
              data-testid={`${testIdPrefix}-${index}-title`}
            >
              {task?.title || `Task ${index + 1}`}
            </h3>
          </div>

          {/* Description toggle */}
          {description && (
            <button
              onClick={() => setDescOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mt-1"
              data-testid={`${testIdPrefix}-${index}-desc-toggle`}
            >
              {descOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {descOpen ? 'Hide details' : 'Show details'}
            </button>
          )}
          {descOpen && description && (
            <p
              className="mt-2 text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap"
              data-testid={`${testIdPrefix}-${index}-description`}
            >
              {description}
            </p>
          )}

          {/* Hints */}
          {hints.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setHintsOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--color-accent-purple)] hover:text-[var(--color-accent-pink)] transition-colors"
                data-testid={`${testIdPrefix}-${index}-hints-toggle`}
              >
                <Lightbulb size={12} />
                {hintsOpen ? 'Hide hints' : `Show hints (${hints.length})`}
              </button>
              {hintsOpen && (
                <ul className="mt-2 space-y-1.5" data-testid={`${testIdPrefix}-${index}-hints-list`}>
                  {hints.map((hint, hi) => (
                    <li
                      key={hi}
                      className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed pl-3 border-l-2 border-[var(--color-accent-purple)]/30"
                      data-testid={`${testIdPrefix}-${index}-hint-${hi}`}
                    >
                      {typeof hint === 'string' ? hint : (hint.text || JSON.stringify(hint))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Resources */}
          {resources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" data-testid={`${testIdPrefix}-${index}-resources`}>
              {resources.map((res, ri) => {
                const label = typeof res === 'string' ? res : (res.label || res.title || 'Resource');
                const url = typeof res === 'string' ? res : res.url;
                if (!url) return null;
                return (
                  <a
                    key={ri}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/15 transition-colors"
                    data-testid={`${testIdPrefix}-${index}-resource-${ri}`}
                  >
                    <ExternalLink size={11} />
                    {label}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

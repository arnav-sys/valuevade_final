import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Sparkles, ArrowRight, ArrowLeft, FileText } from 'lucide-react';
import GenericRenderer from './GenericRenderer';

function formatNumber(n) {
  if (n == null || n === '') return '—';
  const num = typeof n === 'number' ? n : parseFloat(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Tooltip({ text, children, onOpen }) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    setOpen((v) => !v);
    onOpen?.();
  };
  return (
    <span className="relative inline-block">
      <button
        onClick={toggle}
        className="underline decoration-dotted decoration-[#246BFD] underline-offset-4 text-[#0F172A] hover:text-[#246BFD] transition-colors cursor-help"
        data-testid="document-highlight"
      >
        {children}
      </button>
      {open && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-20 w-64 p-3 rounded-xl bg-[#0F172A] text-white text-xs font-bricolage leading-relaxed shadow-xl border border-[#334155]" data-testid="document-tooltip">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-[#0F172A]" />
        </span>
      )}
    </span>
  );
}

function evalText(answer, expected) {
  if (!answer) return false;
  const a = String(answer).trim().toLowerCase();
  if (Array.isArray(expected)) {
    return expected.some((k) => a.includes(String(k).toLowerCase()));
  }
  return a.includes(String(expected).toLowerCase());
}

function evalNumber(answer, expected, tolerance = 0.01) {
  const num = parseFloat(answer);
  if (Number.isNaN(num)) return false;
  return Math.abs(num - expected) <= tolerance;
}

function TaskPanel({ tasks, answers, setAnswers, submitted, setSubmitted, onComplete }) {
  const [idx, setIdx] = useState(0);
  const task = tasks[idx];
  const total = tasks.length;

  if (!task) return null;

  const answer = answers[task.id] ?? '';
  const isSubmitted = !!submitted[task.id];
  const result = submitted[task.id];

  const handleSubmit = () => {
    let correct = false;
    if (task.answer_type === 'number') {
      correct = evalNumber(answer, task.expected_value, task.tolerance);
    } else if (task.answer_type === 'text') {
      correct = evalText(answer, task.expected_keywords || task.expected_answer);
    } else {
      correct = String(answer).trim().length > 0; // free_text is "submitted"
    }
    setSubmitted({ ...submitted, [task.id]: { correct, answer } });
  };

  const correctCount = Object.values(submitted).filter((r) => r?.correct).length;
  const answeredCount = Object.keys(submitted).length;
  const accuracy = total > 0 ? correctCount / total : 0;

  const isLast = idx === total - 1;

  return (
    <div className="space-y-4" data-testid="document-task-panel">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          Task {idx + 1} of {total}
        </div>
        <div className="flex items-center gap-1">
          {tasks.map((t, i) => (
            <div
              key={t.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                submitted[t.id]?.correct
                  ? 'bg-[var(--color-success)]'
                  : submitted[t.id]
                    ? 'bg-[#EF4444]'
                    : i === idx
                      ? 'bg-[var(--color-primary)]'
                      : 'bg-[var(--color-border)]'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-5 bg-[var(--color-surface)]/60 border border-[var(--color-border)]" data-testid={`document-task-${idx}`}>
        <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed mb-4" data-testid="document-task-question">
          {task.question}
        </p>

        {task.answer_type === 'number' && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="any"
              value={answer}
              onChange={(e) => setAnswers({ ...answers, [task.id]: e.target.value })}
              disabled={isSubmitted}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-mono focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-60"
              placeholder="Enter a number"
              data-testid="document-input-number"
            />
            {task.unit && <span className="text-sm font-mono text-[var(--color-text-muted)]">{task.unit}</span>}
          </div>
        )}

        {task.answer_type === 'text' && (
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswers({ ...answers, [task.id]: e.target.value })}
            disabled={isSubmitted}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-bricolage focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-60"
            placeholder="Type your answer"
            data-testid="document-input-text"
          />
        )}

        {task.answer_type === 'free_text' && (
          <textarea
            value={answer}
            onChange={(e) => setAnswers({ ...answers, [task.id]: e.target.value })}
            disabled={isSubmitted}
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-bricolage focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-60 resize-none"
            placeholder="Write out your analysis…"
            data-testid="document-input-freetext"
          />
        )}

        {isSubmitted && (
          <div className="mt-4 space-y-3 animate-vv-slide-in" data-testid="document-task-feedback">
            {task.answer_type !== 'free_text' && (
              <div
                className={`flex items-start gap-2 px-3 py-2 rounded-lg ${
                  result.correct
                    ? 'bg-[var(--color-success)]/10 border border-[var(--color-success)]/25'
                    : 'bg-[#EF4444]/10 border border-[#EF4444]/25'
                }`}
              >
                {result.correct ? (
                  <CheckCircle2 size={15} className="text-[var(--color-success)] shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={15} className="text-[#EF4444] shrink-0 mt-0.5" />
                )}
                <span className={`text-xs font-mono ${result.correct ? 'text-[var(--color-success)]' : 'text-[#EF4444]'}`}>
                  {result.correct ? 'Nice — that matches.' : 'Not quite.'}
                </span>
              </div>
            )}
            {task.explanation && (
              <div className="rounded-lg p-3 bg-[var(--color-accent-purple)]/8 border border-[var(--color-accent-purple)]/25">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-accent-purple)] mb-1">Explanation</div>
                <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed">{task.explanation}</p>
              </div>
            )}
            {task.answer_type === 'free_text' && task.sample_answer && (
              <div className="rounded-lg p-3 bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/25">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={12} className="text-[var(--color-primary)]" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-primary)]">Sample strong answer</span>
                </div>
                <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                  {task.sample_answer}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          data-testid="document-prev-task"
        >
          <ArrowLeft size={14} /> Prev
        </button>
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={!String(answer).trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="document-submit-task"
          >
            Submit
          </button>
        ) : isLast ? (
          <button
            onClick={() => onComplete({
              tasks_completed: correctCount,
              tasks_total: total,
              accuracy,
            })}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
            data-testid="document-complete"
          >
            Complete Simulation <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={() => setIdx(Math.min(total - 1, idx + 1))}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold font-bricolage hover:border-[var(--color-primary)]/40 transition-all"
            data-testid="document-next-task"
          >
            Next Task <ArrowRight size={14} />
          </button>
        )}
      </div>

      <div className="text-[10px] font-mono text-[var(--color-text-muted)] text-right" data-testid="document-progress">
        {answeredCount} / {total} answered · {correctCount} correct
      </div>
    </div>
  );
}

export default function DocumentSim({ config, title, onComplete }) {
  const doc = config?.document_data || {};
  const highlights = config?.interactive_highlights || [];
  const tasks = config?.tasks || [];
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState({});

  const highlightMap = useMemo(() => {
    const m = {};
    highlights.forEach((h) => { m[h.id || h.item_id] = h.tooltip || h.text; });
    return m;
  }, [highlights]);

  // If this sim doesn't use the structured document_data shape, fall back to
  // the generic renderer (handles document_content + questions + red_flags_to_spot etc.).
  const hasStructuredDoc = doc && (doc.company_name || doc.sections || doc.period);
  if (!hasStructuredDoc) {
    return <GenericRenderer config={config} title={title} typeLabel="Document Analysis" onComplete={onComplete} />;
  }

  const renderLabel = (itemId, label) => {
    if (highlightMap[itemId]) {
      return <Tooltip text={highlightMap[itemId]}>{label}</Tooltip>;
    }
    return label;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6" data-testid="document-sim">
      {/* Document */}
      <div className="rounded-2xl bg-gradient-to-b from-[#FAFAF7] to-[#F5F5EE] text-[#0F172A] shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden border border-[#E5E7EB]/20" data-testid="document-surface">
        <div className="px-6 sm:px-8 py-5 border-b border-[#E5E7EB] bg-white/60">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={14} className="text-[#64748B]" />
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#64748B]">Financial Statement</span>
          </div>
          <h3 className="font-clash text-xl font-bold text-[#0F172A]" data-testid="document-company">{doc.company_name || '—'}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs font-mono text-[#64748B]">
            {doc.period && <span data-testid="document-period">{doc.period}</span>}
            {doc.currency && (
              <>
                <span>·</span>
                <span data-testid="document-currency">Amounts in {doc.currency}</span>
              </>
            )}
          </div>
        </div>

        <div className="px-6 sm:px-8 py-6 space-y-6 font-serif">
          {(doc.sections || []).map((section, sIdx) => (
            <div key={sIdx} data-testid={`document-section-${sIdx}`}>
              {section.title && (
                <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-[#64748B] mb-3 border-b border-[#E5E7EB] pb-1.5">
                  {section.title}
                </h4>
              )}
              <div className="space-y-1.5">
                {(section.line_items || []).map((item, iIdx) => (
                  <div
                    key={item.id || iIdx}
                    className="grid grid-cols-[1fr_100px_100px] gap-4 items-baseline py-1"
                    data-testid={`document-line-${item.id || iIdx}`}
                  >
                    <div className={`text-sm text-[#374151] ${item.indent ? 'pl-4' : 'pl-2'}`}>
                      {renderLabel(item.id, item.label)}
                    </div>
                    <div className="text-sm font-mono text-right text-[#0F172A] tabular-nums">
                      {formatNumber(item.current_year)}
                    </div>
                    <div className="text-sm font-mono text-right text-[#64748B] tabular-nums">
                      {formatNumber(item.previous_year)}
                    </div>
                  </div>
                ))}
              </div>
              {section.section_total && (
                <div className="grid grid-cols-[1fr_100px_100px] gap-4 items-baseline mt-2 pt-2 border-t-2 border-[#0F172A] font-bold">
                  <div className="text-sm text-[#0F172A] pl-2">{section.section_total.label}</div>
                  <div className="text-sm font-mono text-right text-[#0F172A] tabular-nums">
                    {formatNumber(section.section_total.current_year)}
                  </div>
                  <div className="text-sm font-mono text-right text-[#64748B] tabular-nums">
                    {formatNumber(section.section_total.previous_year)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Task panel (sidebar desktop, stacked mobile) */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 h-fit lg:sticky lg:top-24">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--color-border)]">
          <Sparkles size={14} className="text-[var(--color-primary)]" />
          <h3 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">Your Tasks</h3>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm font-bricolage text-[var(--color-text-muted)]">No tasks configured.</p>
        ) : (
          <TaskPanel
            tasks={tasks}
            answers={answers}
            setAnswers={setAnswers}
            submitted={submitted}
            setSubmitted={setSubmitted}
            onComplete={onComplete}
          />
        )}
      </div>
    </div>
  );
}

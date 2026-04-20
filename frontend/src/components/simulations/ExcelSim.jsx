import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Lightbulb, RefreshCw, CheckSquare } from 'lucide-react';
import ExcelWorkspace from './ExcelWorkspace';

function formatValue(val, format) {
  if (val === '' || val == null) return '';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (Number.isNaN(num)) return String(val);
  if (format === 'decimal_2') return num.toFixed(2);
  if (format === 'percentage_1') return `${num.toFixed(1)}%`;
  if (format === 'number') return String(Math.round(num));
  return num.toLocaleString();
}

function formatDisplay(val, format) {
  if (val == null || val === '') return '—';
  if (typeof val === 'string' && Number.isNaN(parseFloat(val))) return val;
  return formatValue(val, format);
}

function checkRow(input, expected, tolerance) {
  const num = parseFloat(input);
  if (Number.isNaN(num)) return false;
  const tol = tolerance ?? 0.01;
  return Math.abs(num - expected) <= tol;
}

export default function ExcelSim({ config, title, onProgress, onComplete }) {
  // Route to the structured ExcelSim (expected_value grading) only when the
  // legacy grid schema with `columns` + `rows[].type` markers is present.
  // Any other shape (tabs, workbook, dataset, spreadsheet_setup, ...) routes
  // to the new ExcelWorkspace which renders a full working spreadsheet.
  const grid = config?.grid || {};
  const columns = grid.columns || [];
  const rows = grid.rows || [];
  const hasLegacyGridShape =
    Array.isArray(columns) && columns.length > 0 &&
    Array.isArray(rows) && rows.some((r) => r && (r.type === 'answer_row' || r.type === 'section_header' || r.type === 'data'));

  const showHints = grid.show_hints_after_wrong_attempt ?? config?.show_hints_after_wrong_attempt ?? true;

  const answerRows = useMemo(
    () => rows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.type === 'answer_row'),
    [rows]
  );

  const [inputs, setInputs] = useState({});
  const [results, setResults] = useState({}); // { rowIdx: { correct, attempts } }
  const [checked, setChecked] = useState(false);

  if (!hasLegacyGridShape) {
    return <ExcelWorkspace config={config} title={title} onComplete={onComplete} />;
  }

  const correctCount = Object.values(results).filter((r) => r.correct).length;
  const totalAnswers = answerRows.length;

  const handleCheck = () => {
    const next = { ...results };
    answerRows.forEach(({ row, idx }) => {
      const input = inputs[idx];
      if (input == null || String(input).trim() === '') return;
      const isCorrect = checkRow(input, row.expected_value, row.tolerance);
      const prev = next[idx] || { attempts: 0 };
      next[idx] = {
        correct: isCorrect,
        attempts: (prev.attempts || 0) + (prev.correct ? 0 : 1),
      };
    });
    setResults(next);
    setChecked(true);
    const correct = Object.values(next).filter((r) => r.correct).length;
    onProgress?.({ correct, total: totalAnswers });
  };

  const handleReset = (idx) => {
    const nextInputs = { ...inputs };
    delete nextInputs[idx];
    setInputs(nextInputs);
    const nextResults = { ...results };
    delete nextResults[idx];
    setResults(nextResults);
  };

  const allAnswered = answerRows.every(({ idx }) => results[idx]?.correct);
  const accuracy = totalAnswers > 0 ? correctCount / totalAnswers : 0;

  return (
    <div className="space-y-5" data-testid="excel-sim">
      {/* Spreadsheet */}
      <div className="rounded-2xl overflow-hidden border border-[#1F2937] bg-[#0B1220] shadow-[0_0_40px_rgba(0,0,0,0.3)]" data-testid="excel-sim-grid">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
            <thead>
              <tr className="bg-[#111827] border-b border-[#1F2937]">
                {columns.map((col, i) => (
                  <th
                    key={col.key || i}
                    className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9CA3AF]"
                    style={{ width: col.width ? `${col.width}px` : undefined, minWidth: i === 0 ? 180 : 100 }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => {
                if (row.type === 'section_header') {
                  return (
                    <tr key={rIdx} className="bg-[#0D1624] border-b border-[#1F2937]">
                      <td
                        colSpan={columns.length}
                        className="px-4 py-2.5 font-bold text-xs uppercase tracking-[0.15em] text-[#60A5FA]"
                        data-testid={`excel-section-${rIdx}`}
                      >
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                if (row.type === 'data') {
                  const zebra = rIdx % 2 === 0 ? 'bg-[#0B1220]' : 'bg-[#0E1726]';
                  return (
                    <tr key={rIdx} className={`${zebra} border-b border-[#1F2937]`} data-testid={`excel-data-${rIdx}`}>
                      {columns.map((col, cIdx) => {
                        const cellVal = row.cells?.[col.key];
                        const isLabel = cIdx === 0;
                        return (
                          <td
                            key={col.key}
                            className={`px-4 py-2.5 ${isLabel ? 'text-[#E5E7EB]' : 'text-right text-[#D1D5DB]'}`}
                            data-testid={`excel-cell-${rIdx}-${col.key}`}
                          >
                            {isLabel ? (row.label ?? cellVal ?? '') : formatDisplay(cellVal, row.format)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }
                if (row.type === 'answer_row') {
                  const zebra = rIdx % 2 === 0 ? 'bg-[#0B1220]' : 'bg-[#0E1726]';
                  const result = results[rIdx];
                  const borderColor = result
                    ? result.correct
                      ? 'border-[#10B981]'
                      : 'border-[#EF4444]'
                    : 'border-[#334155]';
                  const answerCol = row.answer_key || columns[columns.length - 1]?.key;

                  return (
                    <tr key={rIdx} className={`${zebra} border-b border-[#1F2937]`} data-testid={`excel-answer-${rIdx}`}>
                      {columns.map((col, cIdx) => {
                        const isAnswerCol = col.key === answerCol;
                        const isLabel = cIdx === 0;

                        if (isAnswerCol && !isLabel) {
                          return (
                            <td key={col.key} className="px-3 py-2">
                              <div className="flex items-center justify-end gap-2">
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="any"
                                    value={inputs[rIdx] ?? ''}
                                    onChange={(e) => setInputs({ ...inputs, [rIdx]: e.target.value })}
                                    disabled={result?.correct}
                                    placeholder={row.format === 'percentage_1' ? '0.0%' : row.format === 'decimal_2' ? '0.00' : '0'}
                                    className={`w-32 px-3 py-1.5 rounded-lg bg-[#0B1220] text-right text-[#E5E7EB] border-2 ${borderColor} focus:outline-none focus:border-[#60A5FA] focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)] transition-all disabled:opacity-75`}
                                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                                    data-testid={`excel-input-${rIdx}`}
                                  />
                                  {result?.correct && (
                                    <CheckCircle2
                                      size={16}
                                      className="absolute -right-5 top-1/2 -translate-y-1/2 text-[#10B981]"
                                    />
                                  )}
                                  {result && !result.correct && (
                                    <XCircle
                                      size={16}
                                      className="absolute -right-5 top-1/2 -translate-y-1/2 text-[#EF4444]"
                                    />
                                  )}
                                </div>
                                {row.format === 'percentage_1' && (
                                  <span className="text-[#64748B] text-xs">%</span>
                                )}
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td
                            key={col.key}
                            className={`px-4 py-2.5 ${isLabel ? 'text-[#E5E7EB]' : 'text-right text-[#64748B]'}`}
                          >
                            {isLabel ? row.label : (row.cells?.[col.key] != null ? formatDisplay(row.cells[col.key], row.format) : '—')}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }
                return null;
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hints / explanations */}
      {checked && (
        <div className="space-y-2" data-testid="excel-hints">
          {answerRows.map(({ row, idx }) => {
            const result = results[idx];
            if (!result || result.correct) return null;

            const showHint = showHints && result.attempts >= 1 && row.hint;
            const showExplanation = result.attempts >= 2 && row.explanation;

            return (
              <div
                key={idx}
                className="rounded-xl p-4 bg-[#EF4444]/8 border border-[#EF4444]/25 flex items-start gap-3"
                data-testid={`excel-hint-${idx}`}
              >
                <Lightbulb size={16} className="text-[#FBBF24] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#EF4444] mb-1">
                    {row.label}
                  </div>
                  {showHint && (
                    <div className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed mb-2">
                      <span className="font-semibold">Hint:</span> {row.hint}
                    </div>
                  )}
                  {showExplanation && (
                    <div className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                      <span className="font-semibold text-[var(--color-text)]">Explanation:</span>{' '}
                      {row.explanation}
                    </div>
                  )}
                  {row.allow_retry !== false && (
                    <button
                      onClick={() => handleReset(idx)}
                      className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-primary)] hover:text-[var(--color-accent-purple)] transition-colors"
                      data-testid={`excel-reset-${idx}`}
                    >
                      <RefreshCw size={11} /> Reset & retry
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-xs font-mono text-[var(--color-text-muted)]">
          {checked ? (
            <span data-testid="excel-score">
              <span className="text-[var(--color-text)] font-semibold">{correctCount}</span> / {totalAnswers} correct
              <span className="mx-2 text-[var(--color-text-faint)]">·</span>
              {Math.round(accuracy * 100)}%
            </span>
          ) : (
            <span>{totalAnswers} answers to fill</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCheck}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold font-bricolage hover:border-[var(--color-primary)]/40 hover:shadow-[0_0_16px_rgba(36,107,253,0.15)] transition-all"
            data-testid="excel-check-answers"
          >
            <CheckSquare size={15} /> Check Answers
          </button>
          <button
            onClick={() => onComplete({
              tasks_completed: correctCount,
              tasks_total: totalAnswers,
              accuracy,
            })}
            disabled={!checked}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
            data-testid="excel-complete"
          >
            Complete Simulation
          </button>
        </div>
      </div>
      {!allAnswered && checked && (
        <p className="text-xs font-mono text-[var(--color-text-muted)] text-right">
          Tip: Finish more rows for a higher score, or complete with your current accuracy.
        </p>
      )}
    </div>
  );
}

import { useEffect, useRef, useState, useMemo } from 'react';
import jspreadsheet from 'jspreadsheet-ce';
import 'jspreadsheet-ce/dist/jspreadsheet.css';
import 'jsuites/dist/jsuites.css';
import {
  FileSpreadsheet, CheckCircle2, Target, Sparkles, Info, Lightbulb,
  BookOpen, Plus, Minus, RotateCcw, ArrowRight,
} from 'lucide-react';

/* =============================================================
   Config-shape extractor
   Looks across the many different excel sim config shapes and
   pulls out: starter_data, headers, task, hints, expected_output,
   evaluation_criteria.
   ============================================================= */

function pickDataset(config) {
  // Try known keys for starter data (array of arrays, or array of objects)
  const candidates = [
    'dataset', 'data', 'starter_data', 'spreadsheet_setup', 'grid',
    'assumptions_sheet', 'sample_data', 'rows',
  ];
  for (const key of candidates) {
    const v = config?.[key];
    if (!v) continue;
    // Normalize common nested shapes
    if (Array.isArray(v) && v.length > 0) {
      // Array of rows (each row is array or object)
      if (Array.isArray(v[0])) return { rows: v, headers: null, source: key };
      if (typeof v[0] === 'object') {
        const headers = Object.keys(v[0]);
        const rows = v.map((obj) => headers.map((h) => {
          const val = obj[h];
          if (val == null) return '';
          if (typeof val === 'object') return JSON.stringify(val).slice(0, 100);
          return String(val);
        }));
        return { rows, headers, source: key };
      }
    }
    if (typeof v === 'object') {
      // { columns: [...], rows: [...] } or { headers, data }
      const cols = v.columns || v.headers || v.fields;
      const rows = v.rows || v.data;
      if (Array.isArray(cols) && Array.isArray(rows)) {
        const normalizedCols = cols.map((c) => (typeof c === 'string' ? c : c.header || c.title || c.name || c.key || ''));
        const normalizedRows = rows.map((r) => {
          if (Array.isArray(r)) return r.map((x) => String(x ?? ''));
          if (typeof r === 'object') return normalizedCols.map((_, i) => {
            const colKey = typeof cols[i] === 'string' ? cols[i] : cols[i].key || cols[i].header;
            return String(r[colKey] ?? r.cells?.[colKey] ?? '');
          });
          return [String(r)];
        });
        return { rows: normalizedRows, headers: normalizedCols, source: key };
      }
    }
  }
  return null;
}

function toColumnLetter(n) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/* =============================================================
   Excel Workspace — full spreadsheet with formula support
   ============================================================= */

export default function ExcelWorkspace({ config, title, onComplete }) {
  const containerRef = useRef(null);
  const instanceRef = useRef(null);
  const [completed, setCompleted] = useState(false);
  const [rowsToAdd, setRowsToAdd] = useState(0);

  const dataset = useMemo(() => pickDataset(config), [config]);
  const taskDescription = config?.task_description || config?.description || config?.scenario_context;
  const hints = config?.hints || config?.tips || [];
  const expectedOutput = config?.expected_output || config?.expected_results || config?.solution || config?.acid_test;
  const evaluationCriteria = config?.evaluation_criteria || config?.scoring_rubric || config?.scoring;
  const toolsRequired = config?.tools_required || config?.formulas_required;
  const timeLimit = config?.time_limit_minutes;
  const difficulty = config?.difficulty;

  // Build initial grid
  const { initialData, columns } = useMemo(() => {
    const MIN_COLS = 12;
    const MIN_ROWS = 30;

    let rows = [];
    let headers = null;

    if (dataset) {
      rows = dataset.rows;
      headers = dataset.headers;
    }

    // Pad rows
    const maxCols = Math.max(
      MIN_COLS,
      headers?.length || 0,
      ...rows.map((r) => (Array.isArray(r) ? r.length : 0))
    );
    const padded = rows.map((r) => {
      const arr = Array.isArray(r) ? [...r] : [r];
      while (arr.length < maxCols) arr.push('');
      return arr.slice(0, maxCols);
    });
    while (padded.length < MIN_ROWS) {
      padded.push(new Array(maxCols).fill(''));
    }

    // Columns config
    const cols = [];
    for (let i = 0; i < maxCols; i++) {
      const hdr = headers?.[i];
      cols.push({
        type: 'text',
        title: hdr ? String(hdr) : toColumnLetter(i),
        width: 140,
      });
    }

    return { initialData: padded, columns: cols };
  }, [dataset]);

  // Initialize jspreadsheet
  useEffect(() => {
    if (!containerRef.current) return;
    // Cleanup any previous instance
    if (instanceRef.current) {
      try { instanceRef.current.destroy(); } catch {/* noop */}
      instanceRef.current = null;
    }
    // Clear DOM in container (jspreadsheet adds siblings)
    containerRef.current.innerHTML = '';

    const inst = jspreadsheet(containerRef.current, {
      data: initialData,
      columns,
      minDimensions: [columns.length, initialData.length],
      tableOverflow: true,
      tableWidth: '100%',
      tableHeight: '560px',
      freezeColumns: 0,
      allowInsertRow: true,
      allowDeleteRow: true,
      allowInsertColumn: true,
      allowDeleteColumn: false,
      allowRenameColumn: false,
      columnSorting: true,
      columnResize: true,
      rowResize: true,
      contextMenu: function () { return []; }, // disable context menu
      onload: function () {
        // no-op
      },
    });
    instanceRef.current = inst;

    return () => {
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch {/* noop */}
        instanceRef.current = null;
      }
    };
  }, [initialData, columns]);

  const handleAddRows = (n) => {
    if (!instanceRef.current) return;
    try {
      instanceRef.current.insertRow(n);
      setRowsToAdd(0);
    } catch (e) {
      console.error('add rows failed', e);
    }
  };

  const handleReset = () => {
    if (!instanceRef.current) return;
    try {
      instanceRef.current.setData(initialData);
    } catch (e) {
      console.error('reset failed', e);
    }
  };

  const handleComplete = () => {
    setCompleted(true);
    onComplete?.({
      tasks_completed: 1,
      tasks_total: 1,
      accuracy: 1,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5" data-testid="excel-workspace">
      {/* Spreadsheet */}
      <div className="space-y-4 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] flex items-center justify-center">
              <FileSpreadsheet size={16} />
            </div>
            <div>
              <div className="font-clash text-sm font-semibold text-[var(--color-text)]">Workbook</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                Cell refs (=A1+B1), formulas (=SUM, =IF, =VLOOKUP), paste, sort
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAddRows(10)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition-all"
              data-testid="excel-ws-add-rows"
            >
              <Plus size={12} /> 10 rows
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] hover:border-[#EF4444]/40 hover:text-[#EF4444] transition-all"
              data-testid="excel-ws-reset"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </div>

        {/* Spreadsheet container */}
        <div
          ref={containerRef}
          className="rounded-2xl overflow-hidden border border-[var(--color-border)] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.3)] jexcel-wrapper"
          data-testid="excel-ws-grid"
        />

        {/* Complete row */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-xs font-mono text-[var(--color-text-muted)]">
            {completed ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--color-success)]">
                <CheckCircle2 size={12} /> Work submitted
              </span>
            ) : (
              'Build your model, then submit when ready'
            )}
          </span>
          <button
            onClick={handleComplete}
            disabled={completed}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="excel-ws-complete"
          >
            {completed ? 'Completed' : 'Submit & Complete'}
            {!completed && <ArrowRight size={15} />}
          </button>
        </div>
      </div>

      {/* Side panel */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        {title && (
          <div className="glass-card rounded-2xl p-4" data-testid="excel-ws-title">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2">Task</div>
            <h3 className="font-clash text-base font-semibold text-[var(--color-text)] break-words">{title}</h3>
            <div className="mt-3 flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-[0.12em]">
              {difficulty && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)]">
                  {String(difficulty)}
                </span>
              )}
              {timeLimit != null && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface)]/70 border border-[var(--color-border)] text-[var(--color-text-muted)]">
                  ~{timeLimit} min
                </span>
              )}
            </div>
          </div>
        )}

        {taskDescription && (
          <div className="glass-card rounded-2xl p-4" data-testid="excel-ws-task">
            <div className="flex items-center gap-2 mb-2">
              <Info size={13} className="text-[var(--color-primary)]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Brief
              </span>
            </div>
            <p className="text-xs font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap break-words">
              {taskDescription}
            </p>
          </div>
        )}

        {Array.isArray(toolsRequired) && toolsRequired.length > 0 && (
          <div className="glass-card rounded-2xl p-4" data-testid="excel-ws-tools">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={13} className="text-[var(--color-accent-purple)]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Tools / formulas
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {toolsRequired.map((t, i) => (
                <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)]">
                  {String(t).slice(0, 40)}
                </span>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(hints) && hints.length > 0 && (
          <div className="glass-card rounded-2xl p-4" data-testid="excel-ws-hints">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb size={13} className="text-[#FBBF24]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Hints</span>
            </div>
            <ul className="space-y-1.5">
              {hints.slice(0, 6).map((h, i) => (
                <li key={i} className="text-xs font-bricolage text-[var(--color-text)] leading-relaxed break-words flex items-start gap-2">
                  <span className="text-[#FBBF24] shrink-0 mt-0.5">•</span>
                  <span>{typeof h === 'string' ? h : h.text || JSON.stringify(h).slice(0, 120)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {expectedOutput && (
          <div className="glass-card rounded-2xl p-4" data-testid="excel-ws-expected">
            <div className="flex items-center gap-2 mb-2">
              <Target size={13} className="text-[var(--color-success)]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Expected output</span>
            </div>
            {typeof expectedOutput === 'string' ? (
              <p className="text-xs font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap break-words">{expectedOutput}</p>
            ) : Array.isArray(expectedOutput) ? (
              <ul className="space-y-1">
                {expectedOutput.slice(0, 8).map((it, i) => (
                  <li key={i} className="text-xs font-bricolage text-[var(--color-text)] break-words flex items-start gap-2">
                    <CheckCircle2 size={11} className="text-[var(--color-success)] shrink-0 mt-0.5" />
                    <span>{typeof it === 'string' ? it : (it.label || it.text || JSON.stringify(it).slice(0, 120))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs font-mono text-[var(--color-text-muted)] space-y-0.5">
                {Object.entries(expectedOutput).slice(0, 8).map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-2 break-words">
                    <span className="text-[var(--color-text-muted)]">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-[var(--color-text)] text-right">
                      {typeof v === 'string' ? v.slice(0, 80) : JSON.stringify(v).slice(0, 80)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {evaluationCriteria && (
          <div className="glass-card rounded-2xl p-4" data-testid="excel-ws-rubric">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} className="text-[var(--color-primary)]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Evaluation</span>
            </div>
            {typeof evaluationCriteria === 'string' ? (
              <p className="text-xs font-bricolage text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap break-words">
                {evaluationCriteria}
              </p>
            ) : Array.isArray(evaluationCriteria) ? (
              <ul className="space-y-1">
                {evaluationCriteria.slice(0, 6).map((it, i) => (
                  <li key={i} className="text-xs font-bricolage text-[var(--color-text-muted)] break-words">
                    • {typeof it === 'string' ? it : (it.label || JSON.stringify(it).slice(0, 100))}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-1">
                {Object.entries(evaluationCriteria).slice(0, 6).map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-2 text-xs font-mono break-words">
                    <span className="text-[var(--color-text-muted)]">{k.replace(/_/g, ' ')}</span>
                    <span className="text-[var(--color-text)] text-right">
                      {typeof v === 'number' ? `${v} pts` : typeof v === 'string' ? v.slice(0, 60) : `${Object.keys(v || {}).length} items`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Dark-theme tweaks for jspreadsheet */}
      <style>{`
        .jexcel-wrapper .jexcel {
          font-family: 'JetBrains Mono', ui-monospace, monospace !important;
          font-size: 12px !important;
          background: #FFFFFF !important;
        }
        .jexcel-wrapper .jexcel > thead > tr > td {
          background: #F1F5F9 !important;
          color: #0F172A !important;
          font-weight: 700 !important;
          border-color: #E2E8F0 !important;
        }
        .jexcel-wrapper .jexcel > tbody > tr > td {
          color: #0F172A !important;
          border-color: #E5E7EB !important;
        }
        .jexcel-wrapper .jexcel > tbody > tr.selected > td {
          background: #DBEAFE !important;
        }
        .jexcel-wrapper .jexcel > tbody > tr > td.highlight {
          background: #DBEAFE !important;
        }
        .jexcel-wrapper .jexcel > tbody > tr > td.highlight-selected {
          background: #BFDBFE !important;
          color: #0F172A !important;
        }
      `}</style>
    </div>
  );
}

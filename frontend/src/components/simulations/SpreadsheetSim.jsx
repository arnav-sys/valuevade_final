import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Save, Send, Loader2, Trash2, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { evaluateFormula, formatCellDisplay, isFormulaError } from './excelFormula';
import PivotTableSheet from './PivotTableSheet';

// Batch 5, Mini-spreadsheet component.
//
// Props:
//   workbook      , adapted from excelSimAdapter.adaptSimToWorkbook(sim)
//   onAutoSave    , async (workbookState) called every 5s when dirty
//   onSubmit      , async (workbookState, scoreOrNull) called by user
//   restoredState , optional previous workbook_state to start from
//   onFocusChange , (focus) → void, fired when the active cell changes;
//                    parent uses this to feed Pari current_focus
//   readOnly      , boolean, freezes the whole grid (post-submit view)
//
// Storage shape mirrors the adapter shape so onAutoSave can pass it straight
// to /api/simulations/workbook/save.

const COL_WIDTH = 96;
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 26;
const ROW_NUM_WIDTH = 44;
const MAX_ROWS = 50;
const MAX_COLS = 26;

function colIndexToLetter(i) {
  let s = ''; let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function deepCloneWorkbook(wb) {
  return {
    header: { ...wb.header },
    sheets: wb.sheets.map((s) => ({
      name: s.name,
      kind: s.kind,
      cells: Object.fromEntries(Object.entries(s.cells || {}).map(([k, v]) => [k, { ...v }])),
      rowCount: s.rowCount,
      colCount: s.colCount,
      spec: s.spec ? { ...s.spec } : undefined,
      pivot_state: s.pivot_state ? JSON.parse(JSON.stringify(s.pivot_state)) : undefined,
    })),
    scoring: { ...wb.scoring },
  };
}

// Given a pivot sheet spec ({source:{sheet,range}}) and the current workbook,
// extract the rows in that range and return { headers, rows } that the
// PivotTableSheet expects. Range may be "A1:F500" or "A:F" (whole-column).
function resolvePivotSourceData(workbook, spec) {
  if (!spec || !spec.source) return { headers: [], rows: [] };
  const sheet = workbook.sheets.find((s) => s.name === spec.source.sheet);
  if (!sheet || !sheet.cells) return { headers: [], rows: [] };
  const m = String(spec.source.range || '').match(
    /^\$?([A-Z]+)(\d+)?:\$?([A-Z]+)(\d+)?$/i
  );
  if (!m) return { headers: [], rows: [] };
  const colA = m[1].toUpperCase(), colB = m[3].toUpperCase();
  const rowA = m[2] ? parseInt(m[2], 10) : 1;
  let rowB = m[4] ? parseInt(m[4], 10) : null;

  // Letter → 0-index helper (matches Excel: A=0, B=1, …, AA=26)
  const colIdx = (s) => {
    let n = 0; for (const c of s.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
    return n - 1;
  };
  const colToLetter = (i) => {
    let s = ''; let n = i + 1;
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const c1 = Math.min(colIdx(colA), colIdx(colB));
  const c2 = Math.max(colIdx(colA), colIdx(colB));

  // Probe to find max populated row if range was open-ended.
  if (rowB == null) {
    let max = rowA;
    for (let c = c1; c <= c2; c++) {
      for (let r = rowA; r <= 1024; r++) {
        const addr = colToLetter(c) + r;
        const v = sheet.cells[addr]?.value;
        if (v != null && v !== '') max = Math.max(max, r);
      }
    }
    rowB = max;
  }
  if (rowB < rowA) return { headers: [], rows: [] };

  // First row of the range = headers; subsequent rows = data.
  const headers = [];
  for (let c = c1; c <= c2; c++) {
    const addr = colToLetter(c) + rowA;
    headers.push(sheet.cells[addr]?.value ?? `Col${c}`);
  }
  const rows = [];
  for (let r = rowA + 1; r <= rowB; r++) {
    const row = [];
    let nonEmpty = false;
    for (let c = c1; c <= c2; c++) {
      const addr = colToLetter(c) + r;
      const v = sheet.cells[addr]?.value;
      if (v != null && v !== '') nonEmpty = true;
      // Coerce numeric strings → numbers so aggregations work
      if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v.replace(/[₹,\s]/g, '')))) {
        row.push(Number(v.replace(/[₹,\s]/g, '')));
      } else row.push(v ?? '');
    }
    if (nonEmpty) rows.push(row);
  }
  return { headers, rows };
}

export default function SpreadsheetSim({
  workbook: initialWorkbook,
  onAutoSave,
  onSubmit,
  restoredState = null,
  onFocusChange = null,
  readOnly: forceReadOnly = false,
}) {
  // Workbook state, starting from any restored row.
  const [workbook, setWorkbook] = useState(() => {
    const base = deepCloneWorkbook(initialWorkbook);
    if (restoredState && Array.isArray(restoredState.sheets)) {
      // Merge restored user values into the canonical structure (preserves
      // readOnly + expected meta from the adapter).
      restoredState.sheets.forEach((rs) => {
        const sheet = base.sheets.find((s) => s.name === rs.name);
        if (!sheet) { base.sheets.push({ ...rs, rowCount: rs.rowCount || 30, colCount: rs.colCount || 10 }); return; }
        Object.entries(rs.cells || {}).forEach(([addr, cell]) => {
          sheet.cells[addr] = { ...(sheet.cells[addr] || {}), ...cell };
        });
      });
    }
    return base;
  });

  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
  const [editingValue, setEditingValue] = useState(null); // null = not editing
  const [submitState, setSubmitState] = useState({ submitted: false, score: null });
  const [dirty, setDirty] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);

  const inputRef = useRef(null);
  const gridRef = useRef(null);

  const activeSheet = workbook.sheets[activeSheetIdx] || workbook.sheets[0];
  const readOnly = forceReadOnly || submitState.submitted;

  // ---------- Formula resolution (cached per render) ----------
  const cellResolved = useMemo(() => {
    const cache = {};
    const get = (sheetName, addr) => {
      const sheet = workbook.sheets.find((s) => s.name === sheetName);
      if (!sheet) return '';
      return sheet.cells[addr]?.value ?? '';
    };
    workbook.sheets.forEach((sheet) => {
      Object.entries(sheet.cells).forEach(([addr, cell]) => {
        const v = cell.value;
        if (typeof v === 'string' && v.startsWith('=')) {
          const res = evaluateFormula(v, {
            activeSheet: sheet.name,
            getCell: (sn, a) => get(sn, a),
          });
          cache[`${sheet.name}!${addr}`] = res;
        }
      });
    });
    return cache;
  }, [workbook]);

  const displayValueAt = useCallback((sheetName, addr) => {
    const sheet = workbook.sheets.find((s) => s.name === sheetName);
    if (!sheet) return '';
    const cell = sheet.cells[addr];
    if (!cell) return '';
    if (typeof cell.value === 'string' && cell.value.startsWith('=')) {
      const r = cellResolved[`${sheetName}!${addr}`];
      return formatCellDisplay(r);
    }
    return cell.value == null ? '' : String(cell.value);
  }, [workbook, cellResolved]);

  // ---------- Cell mutations ----------
  const updateCell = useCallback((sheetIdx, row, col, value) => {
    setWorkbook((prev) => {
      const next = deepCloneWorkbook(prev);
      const sheet = next.sheets[sheetIdx];
      if (!sheet) return prev;
      const addr = `${colIndexToLetter(col)}${row + 1}`;
      const existing = sheet.cells[addr] || {};
      // Don't allow writing to a read-only cell.
      if (existing.readOnly) return prev;
      sheet.cells[addr] = { ...existing, value };
      return next;
    });
    setDirty(true);
  }, []);

  // ---------- Sheet ops ----------
  const addSheet = () => {
    if (readOnly) return;
    setWorkbook((prev) => {
      const next = deepCloneWorkbook(prev);
      const name = `Sheet${next.sheets.length + 1}`;
      next.sheets.push({ name, cells: {}, rowCount: 30, colCount: 10 });
      return next;
    });
    setActiveSheetIdx(workbook.sheets.length);
    setDirty(true);
  };
  const removeSheet = (idx) => {
    if (readOnly) return;
    if (workbook.sheets.length <= 1) return;
    setWorkbook((prev) => {
      const next = deepCloneWorkbook(prev);
      next.sheets.splice(idx, 1);
      return next;
    });
    setActiveSheetIdx((cur) => Math.max(0, Math.min(cur, workbook.sheets.length - 2)));
    setDirty(true);
  };
  const renameSheet = (idx, name) => {
    if (readOnly || !name.trim()) return;
    setWorkbook((prev) => {
      const next = deepCloneWorkbook(prev);
      next.sheets[idx].name = name.trim();
      return next;
    });
    setDirty(true);
  };

  // ---------- Keyboard navigation ----------
  const startEdit = (row, col) => {
    if (readOnly) return;
    const sheet = workbook.sheets[activeSheetIdx];
    const addr = `${colIndexToLetter(col)}${row + 1}`;
    const cell = sheet.cells[addr];
    if (cell?.readOnly) return;
    setEditingValue(cell?.value == null ? '' : String(cell.value));
    setActiveCell({ row, col });
    setTimeout(() => inputRef.current?.focus(), 10);
  };
  const commitEdit = (nextCell) => {
    if (editingValue === null) return;
    updateCell(activeSheetIdx, activeCell.row, activeCell.col, editingValue);
    setEditingValue(null);
    if (nextCell) setActiveCell(nextCell);
  };
  const cancelEdit = () => setEditingValue(null);

  const onKeyDown = useCallback((e) => {
    if (readOnly) return;
    if (editingValue !== null) {
      if (e.key === 'Enter') { e.preventDefault(); commitEdit({ row: Math.min(activeCell.row + 1, MAX_ROWS - 1), col: activeCell.col }); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const dx = e.shiftKey ? -1 : 1;
        commitEdit({ row: activeCell.row, col: Math.max(0, Math.min(activeCell.col + dx, MAX_COLS - 1)) });
      }
      return;
    }
    let { row, col } = activeCell;
    if (e.key === 'ArrowUp')    { row = Math.max(0, row - 1); }
    else if (e.key === 'ArrowDown')  { row = Math.min(activeSheet.rowCount - 1, row + 1); }
    else if (e.key === 'ArrowLeft')  { col = Math.max(0, col - 1); }
    else if (e.key === 'ArrowRight') { col = Math.min(activeSheet.colCount - 1, col + 1); }
    else if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); startEdit(row, col); return; }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      updateCell(activeSheetIdx, row, col, '');
      return;
    }
    else if (e.key === 'Tab') {
      e.preventDefault();
      col = e.shiftKey ? Math.max(0, col - 1) : Math.min(activeSheet.colCount - 1, col + 1);
    }
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      // Start typing → enter edit mode and seed with this char.
      e.preventDefault();
      const addr = `${colIndexToLetter(col)}${row + 1}`;
      const cell = activeSheet.cells[addr];
      if (cell?.readOnly) return;
      setEditingValue(e.key);
      setActiveCell({ row, col });
      setTimeout(() => inputRef.current?.focus(), 10);
      return;
    }
    else { return; }
    e.preventDefault();
    setActiveCell({ row, col });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingValue, activeCell, activeSheet, activeSheetIdx, readOnly, updateCell]);

  useEffect(() => {
    const node = gridRef.current;
    if (!node) return undefined;
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // ---------- Auto-save every 5s when dirty ----------
  useEffect(() => {
    if (!dirty || !onAutoSave) return undefined;
    const t = setTimeout(async () => {
      try {
        setAutoSaving(true);
        await onAutoSave(workbook);
        setDirty(false);
      } finally {
        setAutoSaving(false);
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [dirty, workbook, onAutoSave]);

  // ---------- Notify parent of focus changes (for Pari) ----------
  useEffect(() => {
    if (!onFocusChange) return;
    const sheet = workbook.sheets[activeSheetIdx];
    const addr = `${colIndexToLetter(activeCell.col)}${activeCell.row + 1}`;
    const cell = sheet?.cells[addr];
    const displayed = displayValueAt(sheet.name, addr);
    // Pull a small "column header context" snippet: the first row of the same column.
    const headerCell = sheet?.cells[`${colIndexToLetter(activeCell.col)}1`];
    const headerLabel = headerCell?.value != null && headerCell.value !== '' ? String(headerCell.value) : '';
    const snippet = [
      `Sheet: ${sheet.name}`,
      `Cell: ${addr}`,
      headerLabel ? `Column header: ${headerLabel}` : null,
      displayed ? `Current value: ${displayed}` : '(empty)',
      cell?.readOnly ? '(read-only)' : null,
    ].filter(Boolean).join(' · ');
    onFocusChange({
      type: 'cell',
      label: `${addr} in '${sheet.name}'`,
      snippet,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCell.row, activeCell.col, activeSheetIdx]);

  // ---------- Submit ----------
  const handleSubmit = async () => {
    let score = null;
    if (workbook.scoring?.mode === 'auto') {
      const { scoreWorkbook } = await import('./excelSimAdapter');
      score = scoreWorkbook(workbook);
    }
    setSubmitState({ submitted: true, score });
    if (onSubmit) await onSubmit(workbook, score);
  };

  // ---------- Render ----------
  const renderColHeader = () => (
    <div className="flex sticky top-0 z-10 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
      <div style={{ width: ROW_NUM_WIDTH, height: HEADER_HEIGHT }} className="shrink-0 border-r border-[var(--color-border)]" />
      {Array.from({ length: activeSheet.colCount }, (_, c) => (
        <div
          key={c}
          style={{ width: COL_WIDTH, height: HEADER_HEIGHT }}
          className="shrink-0 border-r border-[var(--color-border)] flex items-center justify-center text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]"
        >
          {colIndexToLetter(c)}
        </div>
      ))}
    </div>
  );

  const renderRow = (r) => (
    <div key={r} className="flex" style={{ height: ROW_HEIGHT }}>
      <div
        style={{ width: ROW_NUM_WIDTH }}
        className="shrink-0 border-r border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 flex items-center justify-center text-[10px] font-mono text-[var(--color-text-muted)]"
      >
        {r + 1}
      </div>
      {Array.from({ length: activeSheet.colCount }, (_, c) => {
        const addr = `${colIndexToLetter(c)}${r + 1}`;
        const cell = activeSheet.cells[addr];
        const isActive = activeCell.row === r && activeCell.col === c;
        const isEditing = isActive && editingValue !== null;
        const isReadOnly = !!cell?.readOnly;
        const isHeaderRow = r === 0;
        const isFormula = typeof cell?.value === 'string' && cell.value.startsWith('=');
        const display = displayValueAt(activeSheet.name, addr);
        const isExpected = cell?.expected !== undefined;
        const passResult = submitState.score?.per_cell?.[`${activeSheet.name}!${addr}`];
        const numericLike = !isFormula && display !== '' && !Number.isNaN(Number(display)) && !isHeaderRow;
        return (
          <div
            key={c}
            style={{ width: COL_WIDTH }}
            onClick={() => { setActiveCell({ row: r, col: c }); }}
            onDoubleClick={() => startEdit(r, c)}
            className={[
              'shrink-0 border-r border-b border-[var(--color-border)] px-2 truncate text-[12px] font-mono flex items-center cursor-cell',
              isActive ? 'outline outline-2 outline-[var(--color-primary)] z-10' : '',
              isHeaderRow ? 'bg-[var(--color-surface)] font-semibold text-[var(--color-text)]' : 'bg-[var(--color-bg-card)]',
              isReadOnly ? 'text-[var(--color-text-muted)] italic' : 'text-[var(--color-text)]',
              isExpected && !submitState.submitted ? 'bg-[var(--color-warning,#F59E0B)]/5' : '',
              passResult === 'pass' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : '',
              passResult === 'fail' ? 'bg-[var(--color-error)]/15 text-[var(--color-error)]' : '',
              numericLike ? 'justify-end' : 'justify-start',
              isFormulaError(cellResolved[`${activeSheet.name}!${addr}`]) ? 'text-[var(--color-error)]' : '',
            ].join(' ')}
            data-testid={`spreadsheet-cell-${addr}`}
            data-cell-addr={addr}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={() => commitEdit(null)}
                className="w-full h-full bg-transparent outline-none text-[12px] font-mono text-[var(--color-text)]"
                data-testid={`spreadsheet-input-${addr}`}
              />
            ) : (
              <span className="truncate">{display}</span>
            )}
            {passResult === 'pass' && <CheckCircle2 size={10} className="ml-1 shrink-0" />}
            {passResult === 'fail' && <XCircle size={10} className="ml-1 shrink-0" />}
          </div>
        );
      })}
    </div>
  );

  // Current cell formula box value
  const curAddr = `${colIndexToLetter(activeCell.col)}${activeCell.row + 1}`;
  const curCell = activeSheet.cells[curAddr];
  const formulaBoxValue = editingValue !== null ? editingValue : (curCell?.value == null ? '' : String(curCell.value));

  return (
    <div className="space-y-3" data-testid="spreadsheet-sim">
      {/* Header / brief panel */}
      {(workbook.header.firm || workbook.header.role || workbook.header.instructions) && (
        <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-accent-purple)]/5 px-4 py-3" data-testid="spreadsheet-brief">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center shrink-0">
              <FileSpreadsheet size={16} />
            </div>
            <div className="flex-1 min-w-0">
              {(workbook.header.firm || workbook.header.role) && (
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
                  {workbook.header.firm}{workbook.header.firm && workbook.header.role ? ' · ' : ''}{workbook.header.role}
                </div>
              )}
              {workbook.header.category && (
                <h3 className="font-clash text-base text-[var(--color-text)] font-bold mb-1">{workbook.header.category}</h3>
              )}
              {workbook.header.instructions && (
                <p className="text-sm text-[var(--color-text)] font-bricolage leading-relaxed">{workbook.header.instructions}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {workbook.scoring?.mode === 'free_form' && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-accent-purple)] bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/20 px-2 py-0.5 rounded">free-form</span>
              )}
              {workbook.scoring?.mode === 'auto' && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-success)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 px-2 py-0.5 rounded">auto-scored</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Formula bar, hidden for pivot sheets (they have their own UI) */}
      {activeSheet.kind !== 'pivot' && (
      <div className="flex items-center gap-2 text-xs">
        <div className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[var(--color-text-muted)] min-w-[60px] text-center" data-testid="spreadsheet-active-addr">
          {curAddr}
        </div>
        <div className="text-[var(--color-text-faint)] font-mono">fx</div>
        <input
          value={formulaBoxValue}
          onChange={(e) => {
            if (readOnly || curCell?.readOnly) return;
            setEditingValue(e.target.value);
          }}
          onFocus={() => { if (!readOnly && !curCell?.readOnly) setEditingValue(formulaBoxValue); }}
          onBlur={() => commitEdit(null)}
          placeholder={curCell?.readOnly ? '(read-only)' : 'type a value or =SUM(A1:A5)'}
          className="flex-1 px-3 py-1 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text)] font-mono text-xs outline-none focus:border-[var(--color-primary)]"
          data-testid="spreadsheet-formula-bar"
          disabled={readOnly || curCell?.readOnly}
        />
        <div className="text-[10px] font-mono text-[var(--color-text-muted)] min-w-[100px] text-right" data-testid="spreadsheet-save-indicator">
          {autoSaving ? <span className="inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> saving…</span>
            : dirty ? 'unsaved'
            : 'saved'}
        </div>
      </div>
      )}

      {/* Grid (or PivotTable, when the active sheet is a pivot) */}
      {activeSheet.kind === 'pivot' ? (
        <PivotTableSheet
          spec={activeSheet.spec}
          sourceData={resolvePivotSourceData(workbook, activeSheet.spec)}
          state={activeSheet.pivot_state || activeSheet.spec?.initial_state || { rows: [], columns: [], values: [], filters: [] }}
          readOnly={readOnly}
          onChange={(newState) => {
            setWorkbook((prev) => {
              const next = deepCloneWorkbook(prev);
              next.sheets[activeSheetIdx] = { ...next.sheets[activeSheetIdx], pivot_state: newState };
              return next;
            });
            setDirty(true);
          }}
        />
      ) : (
      <div
        ref={gridRef}
        tabIndex={0}
        className="rounded-lg border border-[var(--color-border)] overflow-auto bg-[var(--color-bg-card)] focus:outline-none"
        style={{ maxHeight: '60vh' }}
        data-testid="spreadsheet-grid"
      >
        {renderColHeader()}
        {Array.from({ length: activeSheet.rowCount }, (_, r) => renderRow(r))}
      </div>
      )}

      {/* Tab bar (Excel-style) */}
      <div className="flex items-center gap-1 border-t border-[var(--color-border)] pt-2" data-testid="spreadsheet-tab-bar">
        {workbook.sheets.map((s, i) => (
          <div
            key={i}
            className={`group flex items-center gap-1 px-3 py-1 rounded-t-md text-xs font-mono cursor-pointer transition-colors ${
              i === activeSheetIdx
                ? 'bg-[var(--color-bg-card)] border border-b-0 border-[var(--color-border)] text-[var(--color-text)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/50'
            }`}
            onClick={() => setActiveSheetIdx(i)}
            onDoubleClick={() => {
              if (readOnly) return;
              const n = window.prompt('Rename sheet:', s.name);
              if (n) renameSheet(i, n);
            }}
            data-testid={`spreadsheet-tab-${i}`}
            title="Double-click to rename"
          >
            {s.name}
            {workbook.sheets.length > 1 && !readOnly && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeSheet(i); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`spreadsheet-tab-remove-${i}`}
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button
            type="button"
            onClick={addSheet}
            className="px-2 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] rounded-md transition-colors"
            data-testid="spreadsheet-add-tab"
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Score banner */}
      {submitState.submitted && submitState.score && (
        <div
          className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-4 py-3"
          data-testid="spreadsheet-score-banner"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[var(--color-primary)]" />
            <span className="font-clash text-base font-bold text-[var(--color-text)]">
              Score: {submitState.score.total}/100
            </span>
            <span className="text-xs font-mono text-[var(--color-text-muted)]">
              {Object.values(submitState.score.per_cell).filter((v) => v === 'pass').length} cells correct
              {' / '}
              {Object.values(submitState.score.per_cell).filter((v) => v === 'fail').length} need work
            </span>
          </div>
        </div>
      )}
      {submitState.submitted && !submitState.score && (
        <div
          className="rounded-xl border border-[var(--color-accent-purple)]/30 bg-[var(--color-accent-purple)]/5 px-4 py-3"
          data-testid="spreadsheet-submitted-freeform"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-[var(--color-accent-purple)]" />
            <span className="font-clash text-sm font-semibold text-[var(--color-text)]">
              Submitted in free-form mode, your analysis was saved for your portfolio.
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      {!submitState.submitted && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <div className="text-[10px] font-mono text-[var(--color-text-faint)] mr-auto">
            Tip: click a cell, type, Enter to commit. Use =SUM(B2:B6) for formulas.
          </div>
          <button
            type="button"
            onClick={() => onAutoSave && onAutoSave(workbook).then(() => setDirty(false))}
            className="px-3 py-1.5 rounded-lg text-xs font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all flex items-center gap-1.5"
            data-testid="spreadsheet-save-btn"
          >
            <Save size={12} /> Save draft
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-lg text-xs font-bricolage text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] hover:brightness-110 transition-all flex items-center gap-1.5"
            data-testid="spreadsheet-submit-btn"
          >
            <Send size={12} /> Submit
          </button>
        </div>
      )}
    </div>
  );
}

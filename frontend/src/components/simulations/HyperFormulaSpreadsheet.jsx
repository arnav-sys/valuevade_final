/**
 * HyperFormulaSpreadsheet, MVP 2.0 Part B rebuild of the Excel simulation.
 *
 * • Formula engine: HyperFormula (headless, spec-compliant).
 * • Virtualized rendering: react-window (fixes UI freeze on 100×26 sheets).
 * • Features: SUM/AVG/MIN/MAX/COUNT/IF/VLOOKUP/ROUND/CONCAT + arithmetic,
 *   drag-fill (autofill w/ relative & absolute refs), copy/paste,
 *   undo/redo, multi-sheet (add/rename/switch/delete), A1 notation +
 *   ranges ($A$1 / $A1 / A$1), error cells (#REF!, #DIV/0!, #NAME?).
 * • Cap: 100 rows × 26 columns per sheet (guardrail against freezes).
 * • NO formatting (bold/colors/borders/fonts) per spec.
 *
 * Input: canonical workbook object (same shape produced by excelSimAdapter.js).
 * Output: onAutoSave(workbookState), onSubmit(workbookState, score).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeGrid } from 'react-window';
import { HyperFormula } from 'hyperformula';
import {
  Plus, Save, Send, Loader2, Trash2, FileSpreadsheet,
  CheckCircle2, XCircle, AlertCircle, Undo2, Redo2, Copy, ClipboardPaste,
} from 'lucide-react';

// ---------- Constants ----------
const COL_WIDTH = 104;
const ROW_HEIGHT = 28;
const HEADER_H = 26;
const ROW_NUM_W = 48;
const MAX_ROWS = 100;
const MAX_COLS = 26;
const GRID_HEIGHT = 460;

// ---------- Address helpers ----------
function colIndexToLetter(i) {
  let s = ''; let n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function letterToColIndex(s) {
  let n = 0; for (const c of s.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}
function addrToRC(addr) {
  const m = /^([A-Z]+)(\d+)$/.exec(addr || '');
  return m ? { row: parseInt(m[2], 10) - 1, col: letterToColIndex(m[1]) } : null;
}
function rcToAddr(r, c) { return `${colIndexToLetter(c)}${r + 1}`; }

// ---------- Workbook <-> HyperFormula sheets ----------
function workbookToSheetsData(workbook) {
  // Returns { SheetName: [[val, val, ...], ...] } for HyperFormula.buildFromSheets
  const out = {};
  workbook.sheets.forEach((s) => {
    const rows = s.rowCount || MAX_ROWS;
    const cols = s.colCount || MAX_COLS;
    const arr = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const cell = s.cells?.[rcToAddr(r, c)];
        row.push(cell?.value == null || cell?.value === '' ? null : cell.value);
      }
      arr.push(row);
    }
    out[s.name] = arr;
  });
  return out;
}

function deepCloneWorkbook(wb) {
  return {
    header: { ...wb.header },
    sheets: wb.sheets.map((s) => ({
      name: s.name,
      kind: s.kind,
      cells: Object.fromEntries(Object.entries(s.cells || {}).map(([k, v]) => [k, { ...v }])),
      rowCount: Math.min(s.rowCount || MAX_ROWS, MAX_ROWS),
      colCount: Math.min(s.colCount || MAX_COLS, MAX_COLS),
      spec: s.spec ? { ...s.spec } : undefined,
    })),
    scoring: { ...wb.scoring },
  };
}

// Format displayable value from HyperFormula result
function formatDisplay(v) {
  if (v == null) return '';
  if (typeof v === 'object' && v.type === 'ERROR') {
    return v.value || `#${v.type}!`;
  }
  if (typeof v === 'object' && v.error) {
    // hf detailedCellError sometimes returns {type: 'DIV_BY_ZERO'}
    const t = v.type || 'ERROR';
    return t.startsWith('#') ? t : `#${t}!`;
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '#NUM!';
    // Trim trailing zeros for pretty display, keep up to 4 decimals
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 10000) / 10000);
  }
  return String(v);
}

function isHFError(v) {
  return v != null && typeof v === 'object' && (v.type || v.error);
}

// Shift a formula token's A1 refs by (dRow, dCol), respecting $ pins.
function shiftFormula(formula, dRow, dCol) {
  if (typeof formula !== 'string' || !formula.startsWith('=')) return formula;
  return formula.replace(
    /(\$?)([A-Z]+)(\$?)(\d+)/g,
    (_m, cPin, col, rPin, row) => {
      const c = cPin ? letterToColIndex(col) : letterToColIndex(col) + dCol;
      const r = rPin ? parseInt(row, 10) - 1 : parseInt(row, 10) - 1 + dRow;
      if (r < 0 || c < 0) return '#REF!';
      return `${cPin}${colIndexToLetter(c)}${rPin}${r + 1}`;
    },
  );
}

// Detect if the source contains a linear number series (e.g. 1,2,3 or 10,20,30).
function detectSeriesStep(values) {
  const nums = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (nums.length < 2 || nums.length !== values.length) return null;
  const step = nums[1] - nums[0];
  for (let i = 2; i < nums.length; i++) {
    if (Math.abs((nums[i] - nums[i - 1]) - step) > 1e-9) return null;
  }
  return step;
}

// ============================================================================
// Cell renderer (defined outside the main component to keep react-window happy)
// ============================================================================
function GridCell({ columnIndex, rowIndex, style, data }) {
  const r = rowIndex; const c = columnIndex;
  const {
    activeSheet, activeCell, editingValue, submitState, selection,
    dragFillActive, dragFillOrigin, dragFillTarget, readOnly, inputRef,
    getDisplayValue, setActiveCell, setSelection,
    setDragFillActive, setDragFillOrigin, setDragFillTarget,
    setEditingValue, commitEdit, startEdit,
  } = data;

  const addr = rcToAddr(r, c);
  const cell = activeSheet.cells[addr];
  const isActive = activeCell.row === r && activeCell.col === c;
  const isEditing = isActive && editingValue !== null;
  const isReadOnly = !!cell?.readOnly;
  const isHeaderRow = r === 0;
  const isFormula = typeof cell?.value === 'string' && cell.value.startsWith('=');
  const passResult = submitState.score?.per_cell?.[`${activeSheet.name}!${addr}`];
  const display = getDisplayValue(activeSheet.name, r, c);
  const numericLike = !isFormula && display !== '' && !Number.isNaN(Number(display)) && !isHeaderRow;

  let inSelection = false;
  if (selection) {
    const r1 = Math.min(selection.r1, selection.r2); const r2 = Math.max(selection.r1, selection.r2);
    const c1 = Math.min(selection.c1, selection.c2); const c2 = Math.max(selection.c1, selection.c2);
    inSelection = r >= r1 && r <= r2 && c >= c1 && c <= c2;
  }
  let isFillPreview = false;
  if (dragFillActive && dragFillTarget && dragFillOrigin) {
    const or1 = Math.min(dragFillOrigin.r1, dragFillOrigin.r2); const or2 = Math.max(dragFillOrigin.r1, dragFillOrigin.r2);
    const oc1 = Math.min(dragFillOrigin.c1, dragFillOrigin.c2); const oc2 = Math.max(dragFillOrigin.c1, dragFillOrigin.c2);
    const inSource = r >= or1 && r <= or2 && c >= oc1 && c <= oc2;
    if (!inSource) {
      if (dragFillTarget.r > or2 && c >= oc1 && c <= oc2 && r > or2 && r <= dragFillTarget.r) isFillPreview = true;
      else if (dragFillTarget.r < or1 && c >= oc1 && c <= oc2 && r < or1 && r >= dragFillTarget.r) isFillPreview = true;
      else if (dragFillTarget.c > oc2 && r >= or1 && r <= or2 && c > oc2 && c <= dragFillTarget.c) isFillPreview = true;
      else if (dragFillTarget.c < oc1 && r >= or1 && r <= or2 && c < oc1 && c >= dragFillTarget.c) isFillPreview = true;
    }
  }

  const isErr = display && typeof display === 'string' && display.startsWith('#');
  const showFillHandle = isActive && !readOnly && !isEditing && (!selection || (selection.r1 === selection.r2 && selection.c1 === selection.c2));

  return (
    <div
      style={style}
      onMouseDown={(e) => {
        if (e.detail === 2) return;
        setActiveCell({ row: r, col: c });
        setSelection({ r1: r, c1: c, r2: r, c2: c });
      }}
      onMouseEnter={(e) => {
        if (e.buttons === 1 && !dragFillActive) {
          setSelection((prev) => (prev ? { ...prev, r2: r, c2: c } : { r1: r, c1: c, r2: r, c2: c }));
        }
        if (dragFillActive) setDragFillTarget({ r, c });
      }}
      onDoubleClick={() => startEdit(r, c)}
      className={[
        'relative border-r border-b border-[var(--color-border)] px-2 truncate text-[12px] font-mono flex items-center cursor-cell',
        isActive ? 'outline outline-2 outline-[var(--color-primary)] z-10' : '',
        isHeaderRow ? 'bg-[var(--color-surface)] font-semibold text-[var(--color-text)]' : 'bg-[var(--color-bg-card)]',
        isReadOnly ? 'text-[var(--color-text-muted)] italic' : 'text-[var(--color-text)]',
        cell?.expected !== undefined && !submitState.submitted ? 'bg-amber-500/5' : '',
        passResult === 'pass' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : '',
        passResult === 'fail' ? 'bg-[var(--color-error)]/15 text-[var(--color-error)]' : '',
        inSelection && !isActive ? 'bg-[var(--color-primary)]/8' : '',
        isFillPreview ? 'bg-[var(--color-primary)]/10 outline outline-1 outline-dashed outline-[var(--color-primary)]/60' : '',
        numericLike ? 'justify-end' : 'justify-start',
        isErr ? 'text-[var(--color-error)]' : '',
      ].filter(Boolean).join(' ')}
      data-testid={`spreadsheet-cell-${addr}`}
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
      {showFillHandle && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation(); e.preventDefault();
            setDragFillActive(true);
            setDragFillOrigin(selection || { r1: r, c1: c, r2: r, c2: c });
            setDragFillTarget({ r, c });
          }}
          className="absolute -bottom-[3px] -right-[3px] w-2 h-2 bg-[var(--color-primary)] border border-white cursor-crosshair z-20"
          data-testid={`spreadsheet-fill-handle-${addr}`}
        />
      )}
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================
export default function HyperFormulaSpreadsheet({
  workbook: initialWorkbook,
  restoredState = null,
  onAutoSave,
  onSubmit,
  onFocusChange = null,
  readOnly: forceReadOnly = false,
}) {
  // ---- State ----
  const [workbook, setWorkbook] = useState(() => {
    const base = deepCloneWorkbook(initialWorkbook);
    if (restoredState && Array.isArray(restoredState.sheets)) {
      restoredState.sheets.forEach((rs) => {
        const sheet = base.sheets.find((s) => s.name === rs.name);
        if (!sheet) return;
        Object.entries(rs.cells || {}).forEach(([addr, cell]) => {
          sheet.cells[addr] = { ...(sheet.cells[addr] || {}), ...cell };
        });
      });
    }
    return base;
  });
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
  const [editingValue, setEditingValue] = useState(null);
  const [submitState, setSubmitState] = useState({ submitted: false, score: null });
  const [dirty, setDirty] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [selection, setSelection] = useState(null); // {r1,c1,r2,c2}
  const [dragFillOrigin, setDragFillOrigin] = useState(null); // starting selection at drag start
  const [dragFillActive, setDragFillActive] = useState(false);
  const [dragFillTarget, setDragFillTarget] = useState(null); // {r,c}
  const inputRef = useRef(null);
  const gridWrapRef = useRef(null);
  const gridApiRef = useRef(null); // FixedSizeGrid ref

  // Undo/Redo stacks
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  const activeSheet = workbook.sheets[activeSheetIdx] || workbook.sheets[0];
  const readOnly = forceReadOnly || submitState.submitted;

  // ---- HyperFormula engine ----
  const hfRef = useRef(null);
  useEffect(() => {
    if (hfRef.current) {
      try { hfRef.current.destroy(); } catch { /* noop */ }
      hfRef.current = null;
    }
    const sheetsData = workbookToSheetsData(workbook);
    try {
      hfRef.current = HyperFormula.buildFromSheets(sheetsData, {
        licenseKey: 'gpl-v3',
        maxRows: MAX_ROWS,
        maxColumns: MAX_COLS,
      });
      // HyperFormula does not treat bare TRUE / FALSE as boolean literals, it
      // parses them as named expressions. Register them so formulas like
      // =VLOOKUP("Infosys",A2:H6,3,FALSE) evaluate correctly instead of #NAME?.
      try { hfRef.current.addNamedExpression('TRUE', '=TRUE()'); } catch { /* already exists */ }
      try { hfRef.current.addNamedExpression('FALSE', '=FALSE()'); } catch { /* already exists */ }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[HF] init failed', e);
    }
    return () => {
      try { hfRef.current?.destroy(); } catch { /* noop */ }
    };
    // Rebuild engine on any sheet name/count change (structural changes).
    // Cell value changes are batched via engine.setCellContents (below), not here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbook.sheets.map((s) => `${s.name}:${s.rowCount}x${s.colCount}`).join('|')]);

  // Sync cell edits to HF engine whenever workbook.cells changes
  useEffect(() => {
    const hf = hfRef.current;
    if (!hf) return;
    workbook.sheets.forEach((s) => {
      const sheetId = hf.getSheetId(s.name);
      if (sheetId == null) return;
      const rows = s.rowCount || MAX_ROWS;
      const cols = s.colCount || MAX_COLS;
      const matrix = [];
      for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
          const cell = s.cells?.[rcToAddr(r, c)];
          row.push(cell?.value == null || cell?.value === '' ? null : cell.value);
        }
        matrix.push(row);
      }
      try {
        hf.setSheetContent(sheetId, matrix);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[HF] setSheetContent failed', e);
      }
    });
  }, [workbook]);

  // Compute display value for a cell (uses HF engine)
  const getDisplayValue = useCallback((sheetName, r, c) => {
    const hf = hfRef.current;
    const sheet = workbook.sheets.find((s) => s.name === sheetName);
    const cell = sheet?.cells?.[rcToAddr(r, c)];
    if (!cell || cell.value === '' || cell.value == null) return '';
    if (typeof cell.value === 'string' && cell.value.startsWith('=') && hf) {
      const sheetId = hf.getSheetId(sheetName);
      if (sheetId == null) return cell.value;
      try {
        const v = hf.getCellValue({ sheet: sheetId, row: r, col: c });
        return formatDisplay(v);
      } catch (e) {
        return '#ERR!';
      }
    }
    return formatDisplay(cell.value);
  }, [workbook]);

  // ---- Cell mutations ----
  const pushUndo = useCallback((prevWb) => {
    undoStack.current.push(prevWb);
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const applyMutation = useCallback((mutator) => {
    setWorkbook((prev) => {
      pushUndo(prev);
      const next = deepCloneWorkbook(prev);
      mutator(next);
      return next;
    });
    setDirty(true);
  }, [pushUndo]);

  const writeCell = useCallback((sheetIdx, r, c, value) => {
    if (r >= MAX_ROWS || c >= MAX_COLS || r < 0 || c < 0) return;
    applyMutation((next) => {
      const sheet = next.sheets[sheetIdx];
      if (!sheet) return;
      const addr = rcToAddr(r, c);
      const existing = sheet.cells[addr] || {};
      if (existing.readOnly) return;
      sheet.cells[addr] = { ...existing, value };
    });
  }, [applyMutation]);

  const writeManyCells = useCallback((sheetIdx, entries) => {
    // entries: [{r, c, value}]
    applyMutation((next) => {
      const sheet = next.sheets[sheetIdx];
      if (!sheet) return;
      entries.forEach(({ r, c, value }) => {
        if (r >= MAX_ROWS || c >= MAX_COLS || r < 0 || c < 0) return;
        const addr = rcToAddr(r, c);
        const existing = sheet.cells[addr] || {};
        if (existing.readOnly) return;
        sheet.cells[addr] = { ...existing, value };
      });
    });
  }, [applyMutation]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    setWorkbook((cur) => {
      const prev = undoStack.current.pop();
      redoStack.current.push(cur);
      return prev;
    });
    setDirty(true);
  }, []);
  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    setWorkbook((cur) => {
      const nxt = redoStack.current.pop();
      undoStack.current.push(cur);
      return nxt;
    });
    setDirty(true);
  }, []);

  // ---- Sheet ops ----
  const addSheet = () => {
    if (readOnly) return;
    applyMutation((next) => {
      let name = `Sheet${next.sheets.length + 1}`;
      let n = next.sheets.length + 1;
      while (next.sheets.some((s) => s.name === name)) { n += 1; name = `Sheet${n}`; }
      next.sheets.push({ name, cells: {}, rowCount: MAX_ROWS, colCount: MAX_COLS });
    });
    setActiveSheetIdx(workbook.sheets.length);
  };
  const removeSheet = (idx) => {
    if (readOnly || workbook.sheets.length <= 1) return;
    applyMutation((next) => { next.sheets.splice(idx, 1); });
    setActiveSheetIdx((cur) => Math.max(0, Math.min(cur, workbook.sheets.length - 2)));
  };
  const renameSheet = (idx, name) => {
    if (readOnly || !name.trim()) return;
    const trimmed = name.trim().slice(0, 24);
    if (workbook.sheets.some((s, i) => i !== idx && s.name === trimmed)) return;
    applyMutation((next) => { next.sheets[idx].name = trimmed; });
  };

  // ---- Selection & edit lifecycle ----
  const startEdit = (r, c) => {
    if (readOnly) return;
    const sheet = workbook.sheets[activeSheetIdx];
    const addr = rcToAddr(r, c);
    const cell = sheet.cells[addr];
    if (cell?.readOnly) return;
    setEditingValue(cell?.value == null ? '' : String(cell.value));
    setActiveCell({ row: r, col: c });
    setSelection({ r1: r, c1: c, r2: r, c2: c });
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const commitEdit = (nextCell) => {
    if (editingValue === null) return;
    writeCell(activeSheetIdx, activeCell.row, activeCell.col, editingValue);
    setEditingValue(null);
    if (nextCell) {
      setActiveCell(nextCell);
      setSelection({ r1: nextCell.row, c1: nextCell.col, r2: nextCell.row, c2: nextCell.col });
    }
  };
  const cancelEdit = () => setEditingValue(null);

  // ---- Copy / Paste ----
  const copySelectionToClipboard = useCallback(async () => {
    const sel = selection || { r1: activeCell.row, c1: activeCell.col, r2: activeCell.row, c2: activeCell.col };
    const r1 = Math.min(sel.r1, sel.r2); const r2 = Math.max(sel.r1, sel.r2);
    const c1 = Math.min(sel.c1, sel.c2); const c2 = Math.max(sel.c1, sel.c2);
    const lines = [];
    for (let r = r1; r <= r2; r++) {
      const row = [];
      for (let c = c1; c <= c2; c++) {
        const cell = activeSheet.cells[rcToAddr(r, c)];
        row.push(cell?.value == null ? '' : String(cell.value));
      }
      lines.push(row.join('\t'));
    }
    const text = lines.join('\n');
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
  }, [selection, activeCell, activeSheet]);

  const pasteFromClipboard = useCallback(async () => {
    if (readOnly) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const rows = text.replace(/\r/g, '').split('\n').map((l) => l.split('\t'));
      const startR = activeCell.row; const startC = activeCell.col;
      const entries = [];
      rows.forEach((row, dr) => row.forEach((v, dc) => {
        entries.push({ r: startR + dr, c: startC + dc, value: v });
      }));
      writeManyCells(activeSheetIdx, entries);
    } catch (e) { /* clipboard denied, no-op */ }
  }, [activeCell, activeSheetIdx, readOnly, writeManyCells]);

  // ---- Drag-fill (autofill) ----
  const performDragFill = useCallback((from, target) => {
    const r1 = Math.min(from.r1, from.r2); const r2 = Math.max(from.r1, from.r2);
    const c1 = Math.min(from.c1, from.c2); const c2 = Math.max(from.c1, from.c2);
    const rows = r2 - r1 + 1; const cols = c2 - c1 + 1;
    // Determine direction: prefer vertical if target.r extends outside source vertically
    const vertical = target.r < r1 || target.r > r2;
    const entries = [];
    if (vertical) {
      // Extract source column values (per column)
      for (let c = c1; c <= c2; c++) {
        const srcVals = [];
        for (let r = r1; r <= r2; r++) srcVals.push(activeSheet.cells[rcToAddr(r, c)]?.value ?? '');
        const step = detectSeriesStep(srcVals);
        if (target.r > r2) {
          // Fill downward
          const endR = Math.min(target.r, MAX_ROWS - 1);
          for (let rr = r2 + 1; rr <= endR; rr++) {
            const off = rr - r2;
            const seedIdx = (off - 1) % rows;
            const seedR = r1 + seedIdx;
            const seedVal = activeSheet.cells[rcToAddr(seedR, c)]?.value ?? '';
            let newVal;
            if (typeof seedVal === 'string' && seedVal.startsWith('=')) {
              newVal = shiftFormula(seedVal, rr - seedR, 0);
            } else if (step != null) {
              const lastSrc = Number(srcVals[srcVals.length - 1]);
              newVal = lastSrc + step * off;
            } else {
              newVal = seedVal;
            }
            entries.push({ r: rr, c, value: newVal });
          }
        } else if (target.r < r1) {
          const endR = Math.max(target.r, 0);
          for (let rr = r1 - 1; rr >= endR; rr--) {
            const off = r1 - rr;
            const seedIdx = (rows - (off % rows)) % rows;
            const seedR = r1 + seedIdx;
            const seedVal = activeSheet.cells[rcToAddr(seedR, c)]?.value ?? '';
            let newVal;
            if (typeof seedVal === 'string' && seedVal.startsWith('=')) {
              newVal = shiftFormula(seedVal, rr - seedR, 0);
            } else if (step != null) {
              const firstSrc = Number(srcVals[0]);
              newVal = firstSrc - step * off;
            } else {
              newVal = seedVal;
            }
            entries.push({ r: rr, c, value: newVal });
          }
        }
      }
    } else {
      // Horizontal fill
      for (let r = r1; r <= r2; r++) {
        const srcVals = [];
        for (let c = c1; c <= c2; c++) srcVals.push(activeSheet.cells[rcToAddr(r, c)]?.value ?? '');
        const step = detectSeriesStep(srcVals);
        if (target.c > c2) {
          const endC = Math.min(target.c, MAX_COLS - 1);
          for (let cc = c2 + 1; cc <= endC; cc++) {
            const off = cc - c2;
            const seedIdx = (off - 1) % cols;
            const seedC = c1 + seedIdx;
            const seedVal = activeSheet.cells[rcToAddr(r, seedC)]?.value ?? '';
            let newVal;
            if (typeof seedVal === 'string' && seedVal.startsWith('=')) {
              newVal = shiftFormula(seedVal, 0, cc - seedC);
            } else if (step != null) {
              const lastSrc = Number(srcVals[srcVals.length - 1]);
              newVal = lastSrc + step * off;
            } else {
              newVal = seedVal;
            }
            entries.push({ r, c: cc, value: newVal });
          }
        } else if (target.c < c1) {
          const endC = Math.max(target.c, 0);
          for (let cc = c1 - 1; cc >= endC; cc--) {
            const off = c1 - cc;
            const seedIdx = (cols - (off % cols)) % cols;
            const seedC = c1 + seedIdx;
            const seedVal = activeSheet.cells[rcToAddr(r, seedC)]?.value ?? '';
            let newVal;
            if (typeof seedVal === 'string' && seedVal.startsWith('=')) {
              newVal = shiftFormula(seedVal, 0, cc - seedC);
            } else if (step != null) {
              const firstSrc = Number(srcVals[0]);
              newVal = firstSrc - step * off;
            } else {
              newVal = seedVal;
            }
            entries.push({ r, c: cc, value: newVal });
          }
        }
      }
    }
    if (entries.length > 0) writeManyCells(activeSheetIdx, entries);
  }, [activeSheet, activeSheetIdx, writeManyCells]);

  // ---- Keyboard navigation ----
  const onKeyDown = useCallback((e) => {
    // Undo / Redo
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if ((e.metaKey || e.ctrlKey) && (e.shiftKey && e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) { e.preventDefault(); redo(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelectionToClipboard(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteFromClipboard(); return; }

    if (readOnly) return;
    if (editingValue !== null) {
      if (e.key === 'Enter') { e.preventDefault(); commitEdit({ row: Math.min(activeCell.row + 1, MAX_ROWS - 1), col: activeCell.col }); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
      else if (e.key === 'Tab') { e.preventDefault(); commitEdit({ row: activeCell.row, col: Math.max(0, Math.min(activeCell.col + (e.shiftKey ? -1 : 1), MAX_COLS - 1)) }); }
      return;
    }
    let { row, col } = activeCell;
    if (e.key === 'ArrowUp')    row = Math.max(0, row - 1);
    else if (e.key === 'ArrowDown')  row = Math.min(MAX_ROWS - 1, row + 1);
    else if (e.key === 'ArrowLeft')  col = Math.max(0, col - 1);
    else if (e.key === 'ArrowRight') col = Math.min(MAX_COLS - 1, col + 1);
    else if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); startEdit(row, col); return; }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      writeCell(activeSheetIdx, row, col, '');
      return;
    }
    else if (e.key === 'Tab') { e.preventDefault(); col = e.shiftKey ? Math.max(0, col - 1) : Math.min(MAX_COLS - 1, col + 1); }
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const addr = rcToAddr(row, col);
      const cell = activeSheet.cells[addr];
      if (cell?.readOnly) return;
      setEditingValue(e.key);
      setActiveCell({ row, col });
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    else return;
    e.preventDefault();
    setActiveCell({ row, col });
    setSelection({ r1: row, c1: col, r2: row, c2: col });
    // Ensure the grid scrolls to keep the active cell visible
    gridApiRef.current?.scrollToItem?.({ rowIndex: row, columnIndex: col });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingValue, activeCell, activeSheet, activeSheetIdx, readOnly, undo, redo, copySelectionToClipboard, pasteFromClipboard, writeCell]);

  useEffect(() => {
    const node = gridWrapRef.current;
    if (!node) return undefined;
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // ---- Auto-save ----
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

  // ---- Notify parent of focus changes (Pari) ----
  useEffect(() => {
    if (!onFocusChange) return;
    const sheet = activeSheet;
    const addr = rcToAddr(activeCell.row, activeCell.col);
    const cell = sheet?.cells?.[addr];
    const displayed = getDisplayValue(sheet.name, activeCell.row, activeCell.col);
    const headerCell = sheet?.cells?.[rcToAddr(0, activeCell.col)];
    const headerLabel = headerCell?.value != null && headerCell.value !== '' ? String(headerCell.value) : '';
    const snippet = [
      `Sheet: ${sheet.name}`,
      `Cell: ${addr}`,
      headerLabel ? `Column header: ${headerLabel}` : null,
      displayed ? `Current value: ${displayed}` : '(empty)',
      cell?.readOnly ? '(read-only)' : null,
    ].filter(Boolean).join(' · ');
    onFocusChange({ type: 'cell', label: `${addr} in '${sheet.name}'`, snippet });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCell.row, activeCell.col, activeSheetIdx]);

  // ---- Submit + score ----
  const scoreWorkbook = useCallback(() => {
    // Auto-grade expected cells using HF engine (evaluates formulas too).
    const hf = hfRef.current;
    const perCell = {}; let earned = 0; let total = 0;
    workbook.sheets.forEach((sheet) => {
      const sheetId = hf?.getSheetId(sheet.name);
      Object.entries(sheet.cells).forEach(([addr, cell]) => {
        if (cell.expected === undefined || cell.expected === null) return;
        const pts = cell.points || 10; total += pts;
        const rc = addrToRC(addr); if (!rc || sheetId == null) return;
        let userVal = cell.value;
        if (typeof userVal === 'string' && userVal.startsWith('=') && hf) {
          try { userVal = hf.getCellValue({ sheet: sheetId, row: rc.row, col: rc.col }); } catch { /* noop */ }
        }
        const passes = cellPasses(userVal, cell);
        perCell[`${sheet.name}!${addr}`] = passes ? 'pass' : 'fail';
        if (passes) earned += pts;
      });
    });
    return {
      total: total > 0 ? Math.round((earned / total) * 100) : 0,
      per_cell: perCell,
      accepted: true,
    };
  }, [workbook]);

  const handleSubmit = async () => {
    let score = null;
    if (workbook.scoring?.mode === 'auto') score = scoreWorkbook();
    setSubmitState({ submitted: true, score });
    if (onSubmit) await onSubmit(workbook, score);
  };

  // ---- Cell renderers ----
  const rowCount = Math.min(activeSheet.rowCount || MAX_ROWS, MAX_ROWS);
  const colCount = Math.min(activeSheet.colCount || MAX_COLS, MAX_COLS);

  const itemData = useMemo(() => ({
    activeSheet,
    activeCell,
    editingValue,
    submitState,
    selection,
    dragFillActive,
    dragFillOrigin,
    dragFillTarget,
    readOnly,
    inputRef,
    getDisplayValue,
    setActiveCell,
    setSelection,
    setDragFillActive,
    setDragFillOrigin,
    setDragFillTarget,
    setEditingValue,
    commitEdit,
    startEdit,
  }), [activeSheet, activeCell, editingValue, submitState, selection, dragFillActive, dragFillOrigin, dragFillTarget, readOnly, getDisplayValue]);

  // Grid mouse-up listener: complete drag-fill
  useEffect(() => {
    const onUp = () => {
      if (dragFillActive && dragFillOrigin && dragFillTarget) {
        performDragFill(dragFillOrigin, dragFillTarget);
      }
      setDragFillActive(false); setDragFillOrigin(null); setDragFillTarget(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [dragFillActive, dragFillOrigin, dragFillTarget, performDragFill]);

  // ---- Formula bar ----
  const curAddr = rcToAddr(activeCell.row, activeCell.col);
  const curCell = activeSheet.cells[curAddr];
  const formulaBoxValue = editingValue !== null ? editingValue : (curCell?.value == null ? '' : String(curCell.value));

  // ---- Render ----
  return (
    <div className="space-y-3" data-testid="spreadsheet-sim">
      {/* Header brief */}
      {(workbook.header.firm || workbook.header.role || workbook.header.instructions || workbook.header.category) && (
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
                <p className="text-sm text-[var(--color-text)] font-bricolage leading-relaxed whitespace-pre-line">{workbook.header.instructions}</p>
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

      {/* Toolbar: formula bar + undo/redo/copy/paste */}
      <div className="flex items-center gap-2 text-xs">
        <div className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[var(--color-text-muted)] min-w-[60px] text-center" data-testid="spreadsheet-active-addr">
          {curAddr}
        </div>
        <div className="text-[var(--color-text-faint)] font-mono">fx</div>
        <input
          value={formulaBoxValue}
          onChange={(e) => { if (readOnly || curCell?.readOnly) return; setEditingValue(e.target.value); }}
          onFocus={() => { if (!readOnly && !curCell?.readOnly) setEditingValue(formulaBoxValue); }}
          onBlur={() => commitEdit(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitEdit({ row: Math.min(activeCell.row + 1, MAX_ROWS - 1), col: activeCell.col }); }
            if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
          }}
          placeholder={curCell?.readOnly ? '(read-only)' : 'type a value or =SUM(A1:A5)'}
          className="flex-1 px-3 py-1 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text)] font-mono text-xs outline-none focus:border-[var(--color-primary)]"
          data-testid="spreadsheet-formula-bar"
          disabled={readOnly || curCell?.readOnly}
        />
        <button type="button" title="Undo (Ctrl/Cmd+Z)" onClick={undo} disabled={readOnly} className="p-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-40" data-testid="spreadsheet-undo-btn">
          <Undo2 size={12} />
        </button>
        <button type="button" title="Redo (Ctrl/Cmd+Y)" onClick={redo} disabled={readOnly} className="p-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-40" data-testid="spreadsheet-redo-btn">
          <Redo2 size={12} />
        </button>
        <button type="button" title="Copy" onClick={copySelectionToClipboard} className="p-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]" data-testid="spreadsheet-copy-btn">
          <Copy size={12} />
        </button>
        <button type="button" title="Paste" onClick={pasteFromClipboard} disabled={readOnly} className="p-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-40" data-testid="spreadsheet-paste-btn">
          <ClipboardPaste size={12} />
        </button>
        <div className="text-[10px] font-mono text-[var(--color-text-muted)] min-w-[90px] text-right" data-testid="spreadsheet-save-indicator">
          {autoSaving ? <span className="inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> saving…</span> : dirty ? 'unsaved' : 'saved'}
        </div>
      </div>

      {/* Virtualized grid */}
      <div
        ref={gridWrapRef}
        tabIndex={0}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] focus:outline-none"
        data-testid="spreadsheet-grid"
      >
        {/* Column header strip */}
        <div className="flex bg-[var(--color-surface)] border-b border-[var(--color-border)]" style={{ height: HEADER_H }}>
          <div style={{ width: ROW_NUM_W }} className="shrink-0 border-r border-[var(--color-border)]" />
          <div className="flex-1 overflow-hidden" style={{ height: HEADER_H }}>
            <div style={{ display: 'flex' }}>
              {Array.from({ length: colCount }, (_, c) => (
                <div key={c} style={{ width: COL_WIDTH, height: HEADER_H }} className="shrink-0 border-r border-[var(--color-border)] flex items-center justify-center text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  {colIndexToLetter(c)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row-number gutter + virtualized grid side by side */}
        <div className="flex">
          {/* Row numbers (fixed, non-virtualized, only 100 rows) */}
          <div style={{ width: ROW_NUM_W, height: GRID_HEIGHT, overflow: 'hidden' }} className="shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)]/60">
            <div style={{ transform: `translateY(0)` }} id="row-num-inner">
              {Array.from({ length: rowCount }, (_, r) => (
                <div key={r} style={{ height: ROW_HEIGHT }} className="border-b border-[var(--color-border)] flex items-center justify-center text-[10px] font-mono text-[var(--color-text-muted)]">
                  {r + 1}
                </div>
              ))}
            </div>
          </div>
          <FixedSizeGrid
            ref={gridApiRef}
            columnCount={colCount}
            rowCount={rowCount}
            columnWidth={COL_WIDTH}
            rowHeight={ROW_HEIGHT}
            height={GRID_HEIGHT}
            width={Math.min(colCount * COL_WIDTH + 2, 1200)}
            itemData={itemData}
            onScroll={({ scrollTop }) => {
              const inner = document.getElementById('row-num-inner');
              if (inner) inner.style.transform = `translateY(${-scrollTop}px)`;
            }}
          >
            {GridCell}
          </FixedSizeGrid>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-t border-[var(--color-border)] pt-2" data-testid="spreadsheet-tab-bar">
        {workbook.sheets.map((s, i) => (
          <div
            key={i}
            className={`group flex items-center gap-1 px-3 py-1 rounded-t-md text-xs font-mono cursor-pointer transition-colors ${
              i === activeSheetIdx
                ? 'bg-[var(--color-bg-card)] border border-b-0 border-[var(--color-border)] text-[var(--color-text)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/50'
            }`}
            onClick={() => { setActiveSheetIdx(i); setActiveCell({ row: 0, col: 0 }); setSelection({ r1: 0, c1: 0, r2: 0, c2: 0 }); }}
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
              <button type="button" onClick={(e) => { e.stopPropagation(); removeSheet(i); }} className="opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`spreadsheet-tab-remove-${i}`}>
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button type="button" onClick={addSheet} className="px-2 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] rounded-md transition-colors" data-testid="spreadsheet-add-tab">
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Score banner */}
      {submitState.submitted && submitState.score && (
        <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-4 py-3" data-testid="spreadsheet-score-banner">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[var(--color-primary)]" />
            <span className="font-clash text-base font-bold text-[var(--color-text)]">Score: {submitState.score.total}/100</span>
            <span className="text-xs font-mono text-[var(--color-text-muted)]">
              {Object.values(submitState.score.per_cell).filter((v) => v === 'pass').length} correct
              {' / '}
              {Object.values(submitState.score.per_cell).filter((v) => v === 'fail').length} need work
            </span>
          </div>
        </div>
      )}
      {submitState.submitted && !submitState.score && (
        <div className="rounded-xl border border-[var(--color-accent-purple)]/30 bg-[var(--color-accent-purple)]/5 px-4 py-3" data-testid="spreadsheet-submitted-freeform">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-[var(--color-accent-purple)]" />
            <span className="font-clash text-sm font-semibold text-[var(--color-text)]">Submitted in free-form mode, your analysis was saved.</span>
          </div>
        </div>
      )}

      {/* Actions */}
      {!submitState.submitted && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <div className="text-[10px] font-mono text-[var(--color-text-faint)] mr-auto">
            Tip: type <span className="font-semibold">=SUM(A1:A5)</span>, drag the little square to autofill, Ctrl/Cmd+Z to undo.
          </div>
          <button type="button" onClick={() => onAutoSave && onAutoSave(workbook).then(() => setDirty(false))} className="px-3 py-1.5 rounded-lg text-xs font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all flex items-center gap-1.5" data-testid="spreadsheet-save-btn">
            <Save size={12} /> Save draft
          </button>
          <button type="button" onClick={handleSubmit} className="px-4 py-1.5 rounded-lg text-xs font-bricolage text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] hover:brightness-110 transition-all flex items-center gap-1.5" data-testid="spreadsheet-submit-btn">
            <Send size={12} /> Submit
          </button>
        </div>
      )}
    </div>
  );
}

function cellPasses(userVal, cell) {
  if (userVal == null || userVal === '') return false;
  if (typeof userVal === 'object' && (userVal.type || userVal.error)) return false;
  if (cell.type === 'number') {
    const u = Number(userVal); const e = Number(cell.expected);
    if (!Number.isFinite(u) || !Number.isFinite(e)) return false;
    return Math.abs(u - e) <= (cell.tolerance ?? 0.01);
  }
  return String(userVal).trim().toLowerCase() === String(cell.expected).trim().toLowerCase();
}

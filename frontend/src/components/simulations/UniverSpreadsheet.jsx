/**
 * UniverSpreadsheet — real-Excel rebuild of the Excel simulation.
 *
 * Engine/UI: Univer (open-source Excel clone) via @univerjs/presets.
 * Gives learners the full Excel experience: ribbon toolbar, cell formatting,
 * 500+ functions, filters, sorting, merge, freeze, find & replace, drag-fill,
 * copy/paste (incl. from desktop Excel), undo/redo, multi-sheet, context menus.
 *
 * Contract (same as the old HyperFormulaSpreadsheet):
 *   props: { workbook, restoredState, onAutoSave, onSubmit, onFocusChange, readOnly }
 *   onAutoSave(state) / onSubmit(state, score) — state is JSON-serializable.
 *   Saved state shape v2: { version: 2, univer_snapshot, pivot_states }.
 *   Legacy v1 states ({ sheets: [{name, cells}] }) are merged into the
 *   canonical workbook before conversion, so old drafts still restore.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter';
import UniverPresetSheetsFilterEnUS from '@univerjs/preset-sheets-filter/locales/en-US';
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort';
import UniverPresetSheetsSortEnUS from '@univerjs/preset-sheets-sort/locales/en-US';
import { UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace';
import UniverPresetSheetsFindReplaceEnUS from '@univerjs/preset-sheets-find-replace/locales/en-US';
import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-filter/lib/index.css';
import '@univerjs/preset-sheets-sort/lib/index.css';
import '@univerjs/preset-sheets-find-replace/lib/index.css';
import {
  Save, Send, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle, Table2, Eye, EyeOff,
} from 'lucide-react';
import PivotTableSheet from './PivotTableSheet';

function formatCellValue(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString('en-IN', { maximumFractionDigits: 4 });
  return String(v);
}

function SolutionReveal({ details }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 px-4 py-3" data-testid="spreadsheet-solution-reveal">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
        data-testid="spreadsheet-solution-toggle"
      >
        <span className="inline-flex items-center gap-2">
          <CheckCircle2 size={14} className="text-[var(--color-success)]" />
          <span className="font-clash text-sm font-semibold text-[var(--color-text)]">
            Correct solution — see the finished model
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
          {open ? <><EyeOff size={11} /> Hide</> : <><Eye size={11} /> Reveal</>}
        </span>
      </button>
      {open && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]" data-testid="spreadsheet-solution-table">
          <table className="w-full text-xs font-mono">
            <thead className="bg-[var(--color-surface)]">
              <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="px-3 py-2 text-left">Cell</th>
                <th className="px-3 py-2 text-left">Your answer</th>
                <th className="px-3 py-2 text-left">Correct answer</th>
                <th className="px-3 py-2 text-left">Formula pattern</th>
                <th className="px-3 py-2 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d) => (
                <tr
                  key={d.key}
                  className={`border-t border-[var(--color-border)] ${d.passes ? 'bg-[var(--color-success)]/5' : 'bg-[var(--color-error)]/5'}`}
                  data-testid={`solution-row-${d.sheetName}-${d.addr}`}
                >
                  <td className="px-3 py-2 text-[var(--color-text)] font-semibold whitespace-nowrap">
                    {d.sheetName}!{d.addr}
                  </td>
                  <td className={`px-3 py-2 ${d.passes ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                    {formatCellValue(d.user_value)}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text)] font-semibold">
                    {formatCellValue(d.expected_value)}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)] break-all">
                    {d.formula_pattern || '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--color-text-muted)]">{d.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!open && (
        <p className="text-[11px] font-mono text-[var(--color-text-muted)] mt-1">
          Click to see the finished Excel file — every graded cell&apos;s correct value and formula pattern.
        </p>
      )}
    </div>
  );
}

// ---------- Address helpers ----------
function letterToColIndex(s) {
  let n = 0; for (const c of s.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}
function colIndexToLetter(i) {
  let s = ''; let n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function addrToRC(addr) {
  const m = /^([A-Z]+)(\d+)$/.exec(addr || '');
  return m ? { row: parseInt(m[2], 10) - 1, col: letterToColIndex(m[1]) } : null;
}

// ---------- Canonical workbook → Univer IWorkbookData ----------
const STYLE_HEADER = 'vv-hd';
const STYLE_RO = 'vv-ro';
const STYLE_ANS = 'vv-ans';
const STYLE_BOLD = 'vv-b';

function canonicalToUniverData(wb) {
  const styles = {
    [STYLE_HEADER]: { bl: 1, bg: { rgb: '#EDE9FE' }, cl: { rgb: '#312E81' }, tb: 3 },
    [STYLE_RO]: { bg: { rgb: '#F4F5F7' }, cl: { rgb: '#3B4252' }, tb: 3 },
    [STYLE_ANS]: { bg: { rgb: '#FFF4D6' } },
    [STYLE_BOLD]: { bl: 1, tb: 3 },
  };
  const sheets = {};
  const sheetOrder = [];
  wb.sheets.filter((s) => s.kind !== 'pivot').forEach((s, idx) => {
    const id = `vv-sheet-${idx}`;
    const cellData = {};
    const columnData = {};
    let maxColUsed = 0;
    // Track longest string per column so we can widen columns automatically
    const colLen = {};
    Object.entries(s.cells || {}).forEach(([addr, cell]) => {
      const rc = addrToRC(addr);
      if (!rc) return;
      const out = {};
      const v = cell.value;
      if (typeof v === 'string' && v.startsWith('=')) out.f = v;
      else if (v !== '' && v != null) out.v = v;
      const isAns = cell.expected !== undefined && cell.expected !== null;
      if (isAns) out.s = STYLE_ANS;
      else if (cell.readOnly && cell.bold) out.s = STYLE_HEADER;
      else if (cell.readOnly) out.s = STYLE_RO;
      else if (cell.bold) out.s = STYLE_BOLD;
      if (out.v === undefined && out.f === undefined && out.s === undefined) return;
      if (!cellData[rc.row]) cellData[rc.row] = {};
      cellData[rc.row][rc.col] = out;
      if (rc.col > maxColUsed) maxColUsed = rc.col;
      // Widen the column to fit long text labels (only for string values)
      if (typeof v === 'string' && !v.startsWith('=')) {
        const len = v.length;
        if (!colLen[rc.col] || len > colLen[rc.col]) colLen[rc.col] = len;
      }
    });
    // Set per-column widths based on the longest string in that column
    // 7px per char + 24px padding, clamped [104, 320]
    Object.entries(colLen).forEach(([col, len]) => {
      const width = Math.min(320, Math.max(104, Math.round(len * 7 + 24)));
      if (width > 104) columnData[col] = { w: width };
    });
    sheets[id] = {
      id,
      name: s.name,
      rowCount: Math.max(s.rowCount || 0, 200),
      columnCount: Math.max(s.colCount || 0, 30),
      cellData,
      columnData,
      defaultColumnWidth: 104,
      defaultRowHeight: 28,
    };
    sheetOrder.push(id);
  });
  return {
    id: 'vv-workbook',
    name: wb.header?.category || 'Simulation Workbook',
    appVersion: '3.0.0',
    locale: LocaleType.EN_US,
    sheetOrder,
    sheets,
    styles,
  };
}

// Merge a legacy v1 saved state ({sheets:[{name, cells}]}) into a canonical clone.
function mergeLegacyState(wb, legacy) {
  const clone = {
    header: { ...wb.header },
    sheets: wb.sheets.map((s) => ({
      ...s,
      cells: Object.fromEntries(Object.entries(s.cells || {}).map(([k, v]) => [k, { ...v }])),
    })),
    scoring: { ...wb.scoring },
  };
  (legacy.sheets || []).forEach((rs) => {
    const sheet = clone.sheets.find((s) => s.name === rs.name);
    if (!sheet) return;
    Object.entries(rs.cells || {}).forEach(([addr, cell]) => {
      sheet.cells[addr] = { ...(sheet.cells[addr] || {}), ...cell };
    });
  });
  return clone;
}

// Extract { headers, rows } for a pivot sheet from the canonical workbook.
function resolvePivotSourceData(workbook, spec) {
  if (!spec || !spec.source) return { headers: [], rows: [] };
  const sheet = workbook.sheets.find((s) => s.name === spec.source.sheet);
  if (!sheet || !sheet.cells) return { headers: [], rows: [] };
  const m = String(spec.source.range || '').match(/^\$?([A-Z]+)(\d+)?:\$?([A-Z]+)(\d+)?$/i);
  if (!m) return { headers: [], rows: [] };
  const c1 = Math.min(letterToColIndex(m[1]), letterToColIndex(m[3]));
  const c2 = Math.max(letterToColIndex(m[1]), letterToColIndex(m[3]));
  const rowA = m[2] ? parseInt(m[2], 10) : 1;
  let rowB = m[4] ? parseInt(m[4], 10) : null;
  if (rowB == null) {
    let max = rowA;
    for (let c = c1; c <= c2; c++) {
      for (let r = rowA; r <= 1024; r++) {
        const v = sheet.cells[colIndexToLetter(c) + r]?.value;
        if (v != null && v !== '') max = Math.max(max, r);
      }
    }
    rowB = max;
  }
  if (rowB < rowA) return { headers: [], rows: [] };
  const headers = [];
  for (let c = c1; c <= c2; c++) headers.push(sheet.cells[colIndexToLetter(c) + rowA]?.value ?? `Col${c}`);
  const rows = [];
  for (let r = rowA + 1; r <= rowB; r++) {
    const row = []; let nonEmpty = false;
    for (let c = c1; c <= c2; c++) {
      const v = sheet.cells[colIndexToLetter(c) + r]?.value;
      if (v != null && v !== '') nonEmpty = true;
      if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v.replace(/[₹,\s]/g, '')))) {
        row.push(Number(v.replace(/[₹,\s]/g, '')));
      } else row.push(v ?? '');
    }
    if (nonEmpty) rows.push(row);
  }
  return { headers, rows };
}

function cellPasses(userVal, cell) {
  if (userVal == null || userVal === '') return false;
  if (typeof userVal === 'object') return false;
  if (cell.type === 'number') {
    const u = Number(String(userVal).replace(/[₹,\s%]/g, ''));
    const e = Number(cell.expected);
    if (!Number.isFinite(u) || !Number.isFinite(e)) return false;
    return Math.abs(u - e) <= (cell.tolerance ?? 0.01);
  }
  return String(userVal).trim().toLowerCase() === String(cell.expected).trim().toLowerCase();
}

const STRUCTURAL_GUARDS = [
  'remove-sheet', 'set-worksheet-name', 'insert-row', 'insert-col',
  'remove-row', 'remove-col', 'move-rows', 'move-cols', 'move-range',
];
const MUTATING_HINTS = ['set-range', 'clear', 'paste', 'remove', 'insert', 'move', 'auto-fill', 'set-style', 'set-worksheet'];

// ============================================================================
export default function UniverSpreadsheet({
  workbook: initialWorkbook,
  restoredState = null,
  onAutoSave,
  onSubmit,
  onFocusChange = null,
  readOnly: forceReadOnly = false,
}) {
  const containerRef = useRef(null);
  const apiRef = useRef(null); // { univer, univerAPI, fWorkbook }
  const submittedRef = useRef(forceReadOnly);
  const guardedSheetIdsRef = useRef(new Set());

  const [dirty, setDirty] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [submitState, setSubmitState] = useState({ submitted: false, score: null });
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState(null);

  // Canonical workbook (with legacy draft merged in when applicable).
  const canonical = useMemo(() => {
    if (restoredState && !restoredState.univer_snapshot && Array.isArray(restoredState.sheets)) {
      return mergeLegacyState(initialWorkbook, restoredState);
    }
    return initialWorkbook;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pivotSheets = useMemo(() => canonical.sheets.filter((s) => s.kind === 'pivot'), [canonical]);
  const [activePivot, setActivePivot] = useState(null); // null = spreadsheet tab
  const [pivotStates, setPivotStates] = useState(() => {
    const fromSave = restoredState?.pivot_states || {};
    const out = {};
    pivotSheets.forEach((s) => {
      out[s.name] = fromSave[s.name] || s.pivot_state || s.spec?.initial_state
        || { rows: [], columns: [], values: [], filters: [] };
    });
    return out;
  });
  const pivotStatesRef = useRef(pivotStates);
  useEffect(() => { pivotStatesRef.current = pivotStates; }, [pivotStates]);

  // Protected (read-only) cells + expected (graded) cells from the canonical wb.
  const { protectedBySheet, expectedCells } = useMemo(() => {
    const prot = {}; const exp = [];
    canonical.sheets.forEach((s) => {
      if (s.kind === 'pivot') return;
      Object.entries(s.cells || {}).forEach(([addr, cell]) => {
        const rc = addrToRC(addr);
        if (!rc) return;
        if (cell.readOnly) {
          if (!prot[s.name]) prot[s.name] = new Set();
          prot[s.name].add(`${rc.row}:${rc.col}`);
        }
        if (cell.expected !== undefined && cell.expected !== null) {
          exp.push({ sheetName: s.name, addr, cell });
        }
      });
    });
    return { protectedBySheet: prot, expectedCells: exp };
  }, [canonical]);
  const protectedRef = useRef(protectedBySheet);
  useEffect(() => { protectedRef.current = protectedBySheet; }, [protectedBySheet]);

  const isProtected = (sheetName, row, col) => !!protectedRef.current[sheetName]?.has(`${row}:${col}`);

  const rangeOverlapsProtected = (sheetName, range) => {
    const set = protectedRef.current[sheetName];
    if (!set || !range) return false;
    for (const key of set) {
      const [r, c] = key.split(':').map(Number);
      if (r >= range.startRow && r <= range.endRow && c >= range.startColumn && c <= range.endColumn) return true;
    }
    return false;
  };

  // ---- Univer lifecycle ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let disposed = false;
    const disposers = [];
    let univer = null;
    try {
      const isDark = document.documentElement.classList.contains('dark') || !!document.querySelector('.dark');
      const created = createUniver({
        locale: LocaleType.EN_US,
        darkMode: isDark,
        locales: {
          [LocaleType.EN_US]: mergeLocales(
            UniverPresetSheetsCoreEnUS,
            UniverPresetSheetsFilterEnUS,
            UniverPresetSheetsSortEnUS,
            UniverPresetSheetsFindReplaceEnUS,
          ),
        },
        presets: [
          UniverSheetsCorePreset({ container }),
          UniverSheetsFilterPreset(),
          UniverSheetsSortPreset(),
          UniverSheetsFindReplacePreset(),
        ],
      });
      univer = created.univer;
      const { univerAPI } = created;

      const data = restoredState?.univer_snapshot
        ? restoredState.univer_snapshot
        : canonicalToUniverData(canonical);
      const fWorkbook = univerAPI.createWorkbook(data);
      apiRef.current = { univer, univerAPI, fWorkbook };

      // Map guarded sheet names → runtime sheet ids (structural protection).
      const guarded = new Set();
      canonical.sheets.filter((s) => s.kind !== 'pivot').forEach((s) => {
        try {
          const ws = fWorkbook.getSheetByName(s.name);
          if (ws) guarded.add(ws.getSheetId());
        } catch { /* noop */ }
      });
      guardedSheetIdsRef.current = guarded;

      // 1. Block editing of read-only cells (and everything after submit).
      disposers.push(univerAPI.addEvent(univerAPI.Event.BeforeSheetEditStart, (params) => {
        const name = params.worksheet?.getSheetName?.();
        if (submittedRef.current || isProtected(name, params.row, params.column)) {
          params.cancel = true;
        }
      }));

      // 2. Block paste landing on protected cells.
      if (univerAPI.Event.BeforeClipboardPaste) {
        disposers.push(univerAPI.addEvent(univerAPI.Event.BeforeClipboardPaste, (params) => {
          if (submittedRef.current) { params.cancel = true; return; }
          try {
            const ws = apiRef.current.fWorkbook.getActiveSheet();
            const rng = ws.getSelection()?.getActiveRange?.();
            if (rng && rangeOverlapsProtected(ws.getSheetName(), rng.getRange())) params.cancel = true;
          } catch { /* noop */ }
        }));
      }

      // 3. Structural + clear guards via command interception (soft-cancel, never throw).
      disposers.push(univerAPI.addEvent(univerAPI.Event.BeforeCommandExecute, (event) => {
        const id = event?.id || '';
        if (!id.startsWith('sheet.command.')) return;
        if (submittedRef.current && MUTATING_HINTS.some((k) => id.includes(k))) {
          event.cancel = true;
          return;
        }
        if (STRUCTURAL_GUARDS.some((k) => id.includes(k))) {
          const p = event.params || {};
          const target = p.subUnitId
            || (() => { try { return apiRef.current.fWorkbook.getActiveSheet().getSheetId(); } catch { return null; } })();
          if (target && guardedSheetIdsRef.current.has(target)) {
            event.cancel = true;
            return;
          }
        }
        if (id.includes('clear-selection')) {
          try {
            const ws = apiRef.current.fWorkbook.getActiveSheet();
            const rng = ws.getSelection()?.getActiveRange?.();
            if (rng && rangeOverlapsProtected(ws.getSheetName(), rng.getRange())) {
              event.cancel = true;
            }
          } catch { /* noop */ }
        }
      }));

      // 4. Dirty tracking for autosave.
      if (univerAPI.Event.SheetValueChanged) {
        disposers.push(univerAPI.addEvent(univerAPI.Event.SheetValueChanged, () => {
          if (!submittedRef.current) setDirty(true);
        }));
      }

      // 5. Pari focus context on selection change.
      if (onFocusChange && univerAPI.Event.SelectionChanged) {
        disposers.push(univerAPI.addEvent(univerAPI.Event.SelectionChanged, () => {
          try {
            const ws = apiRef.current.fWorkbook.getActiveSheet();
            const rng = ws.getSelection()?.getActiveRange?.();
            if (!rng) return;
            const r = rng.getRange();
            const addr = `${colIndexToLetter(r.startColumn)}${r.startRow + 1}`;
            let display = '';
            try { display = ws.getRange(addr).getDisplayValue() || ''; } catch { /* noop */ }
            onFocusChange({
              type: 'cell',
              label: `${addr} in '${ws.getSheetName()}'`,
              snippet: `Sheet: ${ws.getSheetName()} · Cell: ${addr}${display ? ` · Current value: ${display}` : ' · (empty)'}`,
            });
          } catch { /* noop */ }
        }));
      }

      setEngineReady(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[UniverSpreadsheet] init failed:', e);
      setEngineError('The spreadsheet engine failed to load. Please refresh the page.');
    }
    return () => {
      disposed = true;
      disposers.forEach((d) => { try { d?.dispose?.(); } catch { /* noop */ } });
      try { univer?.dispose(); } catch { /* noop */ }
      apiRef.current = null;
      void disposed;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Save-state builder ----
  const buildSaveState = useCallback(() => {
    let snapshot = null;
    try { snapshot = apiRef.current?.fWorkbook?.save() || null; } catch { /* noop */ }
    return { version: 2, univer_snapshot: snapshot, pivot_states: pivotStatesRef.current };
  }, []);

  // ---- Autosave (debounced) ----
  useEffect(() => {
    if (!dirty || !onAutoSave || submitState.submitted) return undefined;
    const t = setTimeout(async () => {
      try {
        setAutoSaving(true);
        await onAutoSave(buildSaveState());
        setDirty(false);
      } finally {
        setAutoSaving(false);
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [dirty, onAutoSave, submitState.submitted, buildSaveState]);

  const handleManualSave = async () => {
    if (!onAutoSave) return;
    try {
      setAutoSaving(true);
      await onAutoSave(buildSaveState());
      setDirty(false);
    } finally {
      setAutoSaving(false);
    }
  };

  // ---- Grading ----
  const gradeWorkbook = useCallback(() => {
    const fWorkbook = apiRef.current?.fWorkbook;
    const perCell = {}; const details = []; let earned = 0; let total = 0;
    expectedCells.forEach(({ sheetName, addr, cell }) => {
      const pts = cell.points || 10;
      total += pts;
      let userVal = null;
      let range = null;
      try {
        const ws = fWorkbook?.getSheetByName(sheetName);
        range = ws?.getRange(addr) || null;
        userVal = range?.getValue();
        if ((userVal == null || userVal === '') && range) {
          const disp = range.getDisplayValue();
          if (disp) userVal = disp;
        }
      } catch { /* missing sheet → fail */ }
      const passes = cellPasses(userVal, cell);
      const key = `${sheetName}!${addr}`;
      perCell[key] = passes ? 'pass' : 'fail';
      details.push({
        key,
        sheetName,
        addr,
        user_value: userVal == null || userVal === '' ? null : userVal,
        expected_value: cell.expected,
        formula_pattern: cell.formula_pattern || cell.formula || null,
        points: pts,
        passes,
      });
      if (passes) earned += pts;
      try { range?.setBackgroundColor(passes ? '#D7F5E3' : '#FBDCDC'); } catch { /* noop */ }
    });
    return {
      total: total > 0 ? Math.round((earned / total) * 100) : 0,
      per_cell: perCell,
      details,
      accepted: true,
    };
  }, [expectedCells]);

  const handleSubmit = async () => {
    let score = null;
    if (canonical.scoring?.mode === 'auto' && expectedCells.length > 0) score = gradeWorkbook();
    submittedRef.current = true;
    setSubmitState({ submitted: true, score });
    setDirty(false);
    if (onSubmit) await onSubmit(buildSaveState(), score);
  };

  const header = canonical.header || {};
  const showPivotTabs = pivotSheets.length > 0;

  return (
    <div className="space-y-3" data-testid="spreadsheet-sim">
      {/* Header brief */}
      {(header.firm || header.role || header.instructions || header.category) && (
        <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-accent-purple)]/5 px-4 py-3" data-testid="spreadsheet-brief">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center shrink-0">
              <FileSpreadsheet size={16} />
            </div>
            <div className="flex-1 min-w-0">
              {(header.firm || header.role) && (
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
                  {header.firm}{header.firm && header.role ? ' · ' : ''}{header.role}
                </div>
              )}
              {header.category && (
                <h3 className="font-clash text-base text-[var(--color-text)] font-bold mb-1">{header.category}</h3>
              )}
              {header.instructions && (
                <p className="text-sm text-[var(--color-text)] font-bricolage leading-relaxed whitespace-pre-line">{header.instructions}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {canonical.scoring?.mode === 'free_form' && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-accent-purple)] bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/20 px-2 py-0.5 rounded">free-form</span>
              )}
              {canonical.scoring?.mode === 'auto' && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-success)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 px-2 py-0.5 rounded">auto-scored</span>
              )}
              <div className="text-[10px] font-mono text-[var(--color-text-muted)]" data-testid="spreadsheet-save-indicator">
                {autoSaving ? <span className="inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> saving…</span> : dirty ? 'unsaved' : 'saved'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pivot tab strip (only when the sim has pivot sheets) */}
      {showPivotTabs && (
        <div className="flex items-center gap-1" data-testid="spreadsheet-pivot-tabs">
          <button
            type="button"
            onClick={() => setActivePivot(null)}
            className={`px-3 py-1 rounded-md text-xs font-mono transition-colors ${activePivot === null ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] border border-transparent'}`}
            data-testid="pivot-tab-spreadsheet"
          >
            <span className="inline-flex items-center gap-1.5"><FileSpreadsheet size={11} /> Spreadsheet</span>
          </button>
          {pivotSheets.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setActivePivot(s.name)}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-colors ${activePivot === s.name ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] border border-transparent'}`}
              data-testid={`pivot-tab-${s.name}`}
            >
              <span className="inline-flex items-center gap-1.5"><Table2 size={11} /> {s.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Univer container (kept mounted; hidden when a pivot tab is active) */}
      <div style={{ display: activePivot === null ? 'block' : 'none' }}>
        {engineError && (
          <div className="rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 px-5 py-4 text-sm text-[var(--color-error)] font-bricolage" data-testid="spreadsheet-engine-error">
            {engineError}
          </div>
        )}
        {!engineReady && !engineError && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-6 flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <Loader2 size={14} className="animate-spin" /> Starting spreadsheet engine…
          </div>
        )}
        <div
          ref={containerRef}
          className="rounded-lg border border-[var(--color-border)] overflow-hidden"
          style={{ height: 640, width: '100%' }}
          data-testid="spreadsheet-grid"
        />
      </div>

      {/* Pivot sheet body */}
      {activePivot !== null && (() => {
        const ps = pivotSheets.find((s) => s.name === activePivot);
        if (!ps) return null;
        return (
          <PivotTableSheet
            spec={ps.spec}
            sourceData={resolvePivotSourceData(canonical, ps.spec)}
            state={pivotStates[ps.name]}
            readOnly={submitState.submitted || forceReadOnly}
            onChange={(next) => {
              setPivotStates((prev) => ({ ...prev, [ps.name]: next }));
              setDirty(true);
            }}
          />
        );
      })()}

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
          <p className="text-[11px] font-mono text-[var(--color-text-muted)] mt-1">Graded cells are highlighted green (correct) or red (needs work) in the sheet.</p>
        </div>
      )}

      {/* Correct solution reveal — after submit, shows the correct file value for every graded cell */}
      {submitState.submitted && submitState.score && Array.isArray(submitState.score.details) && submitState.score.details.length > 0 && (
        <SolutionReveal details={submitState.score.details} />
      )}
      {submitState.submitted && !submitState.score && (
        <div className="rounded-xl border border-[var(--color-accent-purple)]/30 bg-[var(--color-accent-purple)]/5 px-4 py-3" data-testid="spreadsheet-submitted-freeform">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-[var(--color-accent-purple)]" />
            <span className="font-clash text-sm font-semibold text-[var(--color-text)]">Submitted — your work was saved.</span>
          </div>
        </div>
      )}

      {/* Actions */}
      {!submitState.submitted && !forceReadOnly && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <div className="text-[10px] font-mono text-[var(--color-text-faint)] mr-auto">
            Full Excel: formulas, formatting, filters, sort, freeze, merge, find &amp; replace. Amber cells are your answer cells.
          </div>
          <button type="button" onClick={handleManualSave} className="px-3 py-1.5 rounded-lg text-xs font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all flex items-center gap-1.5" data-testid="spreadsheet-save-btn">
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

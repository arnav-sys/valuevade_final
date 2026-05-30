// Batch 5 — Renderer adapter for master_simulations.config.
//
// Normalises the THREE known config shapes into a single canonical
// "workbook" object the SpreadsheetSim component consumes:
//
//   {
//     header: { firm, role, category, instructions, time_limit_minutes },
//     sheets: [
//       {
//         name: "Sheet1",
//         columns: ["A","B","C", ...] | null  (optional row-of-objects mode)
//         cells: {
//           "A1": { value: "Header", readOnly: true },
//           "B5": { value: "", readOnly: false, expected?: 42, type?: "number", tolerance?: 0.01, points?: 5 },
//           ...
//         },
//         rowCount: 30,
//         colCount: 8,
//       },
//       ...
//     ],
//     scoring: { max_points, mode: 'auto' | 'free_form' },
//   }
//
// Known input shapes:
//   1. NEW (M2-M13): { firm, role, category, format:"multi_tab_excel_workbook",
//                      raw_data: { Headers, Tab_1, Tab_2, ... }, scoring: {...} }
//   2. LEGACY (M1): { instructions, starter_grid: { columns, rows[] },
//                     tasks:[{cell, expected, type, points, tolerance}] }
//   3. ARRAY rows  : { rows:[{...}], cols:[...] }  (the original
//                     ExcelWorkspace.jsx free-form shape)
//
// Anything we don't recognise falls back to a free-form 30×10 empty grid so
// the user can still attempt; auto-scoring is disabled in that mode.

import { evaluateFormula } from './excelFormula';

function colIndexToLetter(i) {
  let s = ''; let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Build a Sheet from a 2D array of values (first row = headers).
function sheetFromMatrix(name, matrix, opts = {}) {
  const cells = {};
  let maxC = 0;
  matrix.forEach((row, rIdx) => {
    if (!Array.isArray(row)) return;
    row.forEach((v, cIdx) => {
      const addr = `${colIndexToLetter(cIdx)}${rIdx + 1}`;
      cells[addr] = {
        value: v == null ? '' : v,
        // Headers (row 0) + given-data rows are read-only by default. The
        // FE marks "answer" columns (when known) as editable downstream.
        readOnly: opts.allReadOnly === true ? true : (rIdx === 0 && opts.headersReadOnly !== false),
      };
      if (cIdx > maxC) maxC = cIdx;
    });
  });
  return {
    name,
    cells,
    rowCount: Math.max(matrix.length + 5, 20),
    colCount: Math.max(maxC + 2, 8),
  };
}

function looksLikeMatrix(v) {
  return Array.isArray(v) && v.length > 0 && Array.isArray(v[0]);
}

// Coerce a tab payload into a 2D matrix. Tabs can be:
//   - Array of arrays      → use directly
//   - Array of objects     → first row = keys, subsequent rows = values
//   - { Headers, Rows: [...] } shaped objects
//   - { columns:[...], rows:[{...}] }  legacy
function tabToMatrix(tab, fallbackHeaders = null) {
  if (!tab) return [];
  if (looksLikeMatrix(tab)) return tab;
  if (Array.isArray(tab) && tab.length > 0 && typeof tab[0] === 'object') {
    const keys = Object.keys(tab[0]);
    const headerRow = keys;
    const rows = tab.map((r) => keys.map((k) => r?.[k] ?? ''));
    return [headerRow, ...rows];
  }
  if (typeof tab === 'object') {
    if (Array.isArray(tab.Headers) && Array.isArray(tab.Rows)) {
      return [tab.Headers, ...tab.Rows.map((r) => (
        Array.isArray(r) ? r : tab.Headers.map((k) => r?.[k] ?? '')
      ))];
    }
    if (Array.isArray(tab.columns) && Array.isArray(tab.rows)) {
      const cols = tab.columns.map((c) => (typeof c === 'string' ? c : c.key || c.header || c));
      return [cols, ...tab.rows.map((r) => cols.map((c) => r?.[c] ?? ''))];
    }
    // Last-resort: an object of {colKey: array-of-values} → transpose.
    const keys = Object.keys(tab);
    if (keys.length > 0 && Array.isArray(tab[keys[0]])) {
      const rowLen = Math.max(...keys.map((k) => (Array.isArray(tab[k]) ? tab[k].length : 0)));
      const m = [keys];
      for (let r = 0; r < rowLen; r++) {
        m.push(keys.map((k) => (Array.isArray(tab[k]) ? tab[k][r] ?? '' : '')));
      }
      return m;
    }
  }
  if (fallbackHeaders) return [fallbackHeaders];
  return [];
}

export function adaptSimToWorkbook(sim) {
  const config = sim?.config || {};
  // Pull a richer brief from the various prose fields M2-M13 sims use.
  const briefParts = [];
  if (config.instructions) briefParts.push(config.instructions);
  if (config.brief)        briefParts.push(config.brief);
  if (config.prompt)       briefParts.push(config.prompt);
  if (config.task_description) briefParts.push(config.task_description);
  if (config.spreadsheet_setup) briefParts.push(`Setup: ${typeof config.spreadsheet_setup === 'string' ? config.spreadsheet_setup : JSON.stringify(config.spreadsheet_setup)}`);
  if (config.expected_output)   briefParts.push(`Expected output: ${typeof config.expected_output === 'string' ? config.expected_output : JSON.stringify(config.expected_output)}`);
  if (Array.isArray(config.hints) && config.hints.length > 0) {
    briefParts.push(`Hints:\n• ${config.hints.map((h) => (typeof h === 'string' ? h : (h.text || JSON.stringify(h)))).join('\n• ')}`);
  }
  const header = {
    firm:       config.firm  || null,
    role:       config.role  || null,
    category:   config.category || sim?.title || null,
    instructions: briefParts.length > 0 ? briefParts.join('\n\n') : null,
    time_limit_minutes: config.time_limit_minutes || null,
  };

  // ----- Shape 0 (NEW — HIGHEST priority): LLM-populated `multi_tab_excel_workbook` ----
  // This is the canonical shape produced by `/app/scripts/populate_excel_sims.py`.
  // When present, it always wins over any other detected shape because the
  // populate pass is the only source of realistic finance data + cell-level
  // expected_answers for auto-scoring.
  //
  // Shape:
  //   config.multi_tab_excel_workbook = {
  //     sheets: [
  //       { name: "Data", cells: { A1: { value:"Company", readOnly:true, bold:true }, ... } },
  //       { name: "Answers", cells: { B2: { value:"", readOnly:false, label:"Total Revenue" }, ... } },
  //     ],
  //   }
  //   config.expected_answers = {
  //     "Answers!B2": { formula_pattern: "=SUM(Data!B2:B11)", expected_value: 4500000,
  //                      type:"number", tolerance: 0.01, points: 10 }
  //   }
  const mw = config.multi_tab_excel_workbook;
  if (mw && Array.isArray(mw.sheets) && mw.sheets.length > 0) {
    const sheets = mw.sheets.map((s) => {
      const cells = {};
      let maxC = 0; let maxR = 0;
      Object.entries(s.cells || {}).forEach(([addr, c]) => {
        cells[addr] = { ...c, value: c?.value ?? '' };
        const m = /^([A-Z]+)(\d+)$/.exec(addr);
        if (m) {
          // Convert letter back to col index
          let col = 0; for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
          if (col > maxC) maxC = col;
          if (parseInt(m[2], 10) > maxR) maxR = parseInt(m[2], 10);
        }
      });
      return {
        name: s.name || 'Sheet1',
        cells,
        rowCount: Math.max(maxR + 5, 20),
        colCount: Math.max(maxC + 2, 8),
      };
    });
    // Stamp expected_answers onto Answers-sheet cells so scoreWorkbook picks them up.
    const ea = config.expected_answers || {};
    Object.entries(ea).forEach(([key, spec]) => {
      // key shape: "SheetName!A1"
      const [sname, addr] = String(key).split('!');
      const sheet = sheets.find((s) => s.name === sname);
      if (!sheet) return;
      sheet.cells[addr] = {
        ...(sheet.cells[addr] || { value: '', readOnly: false }),
        readOnly: false,
        expected: spec.expected_value,
        type: spec.type || (typeof spec.expected_value === 'number' ? 'number' : 'text'),
        tolerance: spec.tolerance ?? 0.01,
        points: spec.points ?? 10,
        formula_pattern: spec.formula_pattern || null,
      };
    });
    const totalPoints = Object.values(ea).reduce((s, v) => s + (v.points || 10), 0) || 100;
    return {
      header,
      sheets,
      scoring: { max_points: totalPoints, mode: 'auto' },
    };
  }

  // ----- Shape 2: legacy { starter_grid + tasks } -----
  if (config.starter_grid && Array.isArray(config.starter_grid.columns)) {
    const cols = config.starter_grid.columns;
    const rows = config.starter_grid.rows || [];
    const matrix = [cols, ...rows.map((r) => cols.map((k) => r?.[k] ?? ''))];
    const sheet = sheetFromMatrix('Sheet1', matrix);
    (config.tasks || []).forEach((t) => {
      if (!t.cell) return;
      sheet.cells[t.cell] = {
        ...(sheet.cells[t.cell] || { value: '' }),
        readOnly: false,
        expected: t.expected,
        type: t.type || 'number',
        tolerance: t.tolerance,
        points: t.points || 10,
      };
    });
    return {
      header, sheets: [sheet],
      scoring: { max_points: (config.tasks || []).reduce((s, t) => s + (t.points || 10), 0) || 100, mode: 'auto' },
    };
  }

  // ----- Shape 1a: multi-tab workbook (Tab_1 / Tab_2 keys) -----
  const raw = config.raw_data || config.data || null;
  const sheets = [];
  if (raw && typeof raw === 'object') {
    const tabKeys = Object.keys(raw).filter((k) => /^Tab[_ ]?\d+/i.test(k));
    if (tabKeys.length > 0) {
      tabKeys.sort();
      tabKeys.forEach((tk, idx) => {
        const name = (Array.isArray(config.tab_names) && config.tab_names[idx])
          || raw[`${tk}_name`]
          || tk.replace(/_/g, ' ');
        const matrix = tabToMatrix(raw[tk], raw.Headers);
        if (matrix.length > 0) sheets.push(sheetFromMatrix(name, matrix));
      });
    }
    // ----- Shape 1b: paired "<X>_columns" + "<X>_rows" convention -----
    // Examples from M2-M13:
    //   raw_data = { columns:[...], daily_rows:[...],
    //                shareholding_columns:[...], shareholding_stocks:[...], ... }
    // The naming is loose. We pair them by inferring:
    //   • the "default" pair = columns / (daily_rows | rows | data_rows)
    //   • for prefix P:  P_columns + (P_rows | P)
    if (sheets.length === 0) {
      const colKeys = Object.keys(raw).filter((k) => /columns?$/i.test(k));
      // Map column-key → likely rows-key
      const pairs = [];
      colKeys.forEach((ck) => {
        const prefix = ck.replace(/_?columns?$/i, '');
        const candidates = prefix === ''
          ? ['daily_rows', 'rows', 'data_rows', 'monthly_rows', 'quarterly_rows', 'yearly_rows']
          : [`${prefix}_rows`, `${prefix}_data`, prefix, `${prefix}_stocks`, `${prefix}_records`];
        const rowKey = candidates.find((c) => Array.isArray(raw[c]) && raw[c].length > 0);
        if (rowKey && Array.isArray(raw[ck])) pairs.push({ name: prefix || 'Data', cols: ck, rows: rowKey });
      });
      pairs.forEach(({ name, cols, rows: rk }) => {
        const headers = raw[cols];
        const matrix = [headers, ...raw[rk].map((r) => (
          Array.isArray(r) ? r : headers.map((h) => r?.[h] ?? '')
        ))];
        if (matrix.length > 0) sheets.push(sheetFromMatrix(prettySheetName(name), matrix));
      });
    }
    // ----- Shape 1c: Headers + Rows -----
    if (sheets.length === 0 && (raw.Headers || raw.Rows || raw.headers || raw.rows)) {
      const headers = raw.Headers || raw.headers;
      const rows = raw.Rows || raw.rows || [];
      const matrix = headers ? [headers, ...rows.map((r) => Array.isArray(r) ? r : headers.map((h) => r?.[h] ?? ''))] : [];
      if (matrix.length > 0) sheets.push(sheetFromMatrix('Sheet1', matrix));
    }
    // ----- Shape 1d: by-column object -----
    if (sheets.length === 0) {
      const matrix = tabToMatrix(raw);
      if (matrix.length > 0) sheets.push(sheetFromMatrix('Sheet1', matrix));
    }
  }

  // ----- Shape 1e (new): top-level array-of-objects domain keys -----
  // For sims with no raw_data wrapper but rich domain tables at config root
  // (e.g. config.stocks, config.day1_market_data, config.shareholding).
  if (sheets.length === 0) {
    const SKIP_KEYS = new Set([
      'firm','role','category','format','scoring','difficulty','total_tabs',
      'time_limit_minutes','concepts_tested','data_period','indian_market_context',
      'tab_names','instructions','brief','prompt','base_date','base_value',
      'index_name','bond_yield_pct','historical_avg_pe','excel_formulas_tested',
      'expected_solutions','raw_data','data',
      // ----- rubric / meta keys (added 2026-05-30) — never render as a sheet -----
      'evaluation_criteria','deliverables','expected_outputs','expected_output',
      'expected_answers','stress_tests','acid_test','tools_required','three_layers',
      'font_colour_convention','firm_context','hints','task_description',
      'spreadsheet_setup','populated_at','multi_tab_excel_workbook',
      'starting_state','expected_final_state','shortcuts_tested','total_points',
      'dataset','starter_grid','tasks','rows','cols',
    ]);
    const candidateKeys = Object.keys(config).filter((k) => {
      if (SKIP_KEYS.has(k)) return false;
      const v = config[k];
      return Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && !Array.isArray(v[0]);
    });
    candidateKeys.slice(0, 6).forEach((k) => {
      const matrix = tabToMatrix(config[k]);
      if (matrix.length > 0) sheets.push(sheetFromMatrix(prettySheetName(k), matrix));
    });
  }

  if (sheets.length > 0) {
    sheets.push({
      name: 'Answers',
      cells: { A1: { value: 'Write your analysis below', readOnly: true } },
      rowCount: 30,
      colCount: 10,
    });
    const scoring = config.scoring || {};
    return {
      header,
      sheets,
      scoring: { max_points: scoring.max_points || 100, mode: 'free_form' },
    };
  }

  // ----- Shape 3: rows array -----
  if (Array.isArray(config.rows) && config.rows.length > 0) {
    const cols = Array.isArray(config.cols) ? config.cols : Object.keys(config.rows[0]);
    const headers = cols.map((c) => (typeof c === 'string' ? c : c.key || c.header || c));
    const matrix = [headers, ...config.rows.map((r) => headers.map((k) => r?.[k] ?? ''))];
    return {
      header, sheets: [sheetFromMatrix('Sheet1', matrix), {
        name: 'Answers', cells: { A1: { value: 'Write your analysis below', readOnly: true } },
        rowCount: 30, colCount: 10,
      }],
      scoring: { max_points: 100, mode: 'free_form' },
    };
  }

  // ----- Fallback: empty grid + show the brief prominently -----
  return {
    header: { ...header, instructions: header.instructions || 'No starter data — type your analysis below.' },
    sheets: [{
      name: 'Sheet1',
      cells: { A1: { value: '', readOnly: false } },
      rowCount: 30,
      colCount: 10,
    }],
    scoring: { max_points: 100, mode: 'free_form' },
  };
}

function prettySheetName(s) {
  return String(s || 'Data').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 28);
}

// Run a scoring pass on a workbook against its expected cells.
// Returns { total, per_cell: { "B5": "pass"|"fail" }, accepted }.
export function scoreWorkbook(workbook) {
  const perCell = {};
  let totalPoints = 0;
  let earnedPoints = 0;
  workbook.sheets.forEach((sheet) => {
    Object.entries(sheet.cells).forEach(([addr, cell]) => {
      if (cell.expected === undefined) return;
      const points = cell.points || 10;
      totalPoints += points;
      // Resolve the user's value — evaluate formulas if needed.
      const raw = cell.value;
      let userVal = raw;
      if (typeof raw === 'string' && raw.startsWith('=')) {
        userVal = evaluateFormula(raw, {
          activeSheet: sheet.name,
          getCell: (sn, a) => {
            const s = workbook.sheets.find((x) => x.name === sn) || sheet;
            return s.cells[a]?.value ?? '';
          },
        });
      }
      const passes = cellPasses(userVal, cell);
      perCell[`${sheet.name}!${addr}`] = passes ? 'pass' : 'fail';
      if (passes) earnedPoints += points;
    });
  });
  return {
    total: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
    per_cell: perCell,
    accepted: true,
  };
}

function cellPasses(userVal, cell) {
  if (userVal == null || userVal === '') return false;
  if (cell.type === 'number') {
    const u = Number(userVal);
    const e = Number(cell.expected);
    if (!Number.isFinite(u) || !Number.isFinite(e)) return false;
    return Math.abs(u - e) <= (cell.tolerance ?? 0.01);
  }
  return String(userVal).trim().toLowerCase() === String(cell.expected).trim().toLowerCase();
}

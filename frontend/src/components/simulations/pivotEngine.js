// Pure-function PivotTable engine, used by PivotTableSheet.jsx for live
// recomputation and by the grader for scoring.
//
// Data flow:
//   sourceData = { headers: ['Sector','Quarter','Revenue', …],
//                  rows:    [['Banking','Q1', 12450, …], …] }
//   state      = { rows:[], columns:[], values:[{field,agg}], filters:[{field,allowed:[]}] }
//   computePivot(sourceData, state) → {
//     rowKeys: [['Banking'], ['IT'], …],      // each is a tuple of values, one per row-field
//     colKeys: [['Q1'], ['Q2'], …],
//     cells:   { [rowKeyJoined]: { [colKeyJoined]: { [valueId]: aggValue } } },
//     rowTotals:  { [rowKeyJoined]: { [valueId]: aggValue } },
//     colTotals:  { [colKeyJoined]: { [valueId]: aggValue } },
//     grandTotal: { [valueId]: aggValue },
//     valueIds:   ['SUM(Revenue)', …]
//   }
//
// gradePivotSheet, graded by 4 dimensions:
//   1. fields-in-zones      (rows/columns/values content matches expected)
//   2. value aggregations   (SUM vs AVERAGE matches)
//   3. specific cell values (if expected_cells provided)
//   4. filters              (allowed-list overlap)

export const AGGREGATIONS = ['SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'MAX', 'MIN', 'STDEV'];

function coerceNum(v) {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'boolean') return v ? 1 : 0;
  // Strip ₹, comma, spaces.
  const n = Number(String(v).trim().replace(/[₹$€£,\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

export function aggregateValues(vals, agg) {
  const nums = vals.map(coerceNum).filter((x) => Number.isFinite(x));
  switch ((agg || 'SUM').toUpperCase()) {
    case 'SUM':     return nums.reduce((s, n) => s + n, 0);
    case 'AVERAGE': return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
    case 'COUNT':   return nums.length;
    case 'COUNTA':  return vals.filter((v) => v != null && v !== '').length;
    case 'MAX':     return nums.length ? Math.max(...nums) : 0;
    case 'MIN':     return nums.length ? Math.min(...nums) : 0;
    case 'STDEV': {
      if (nums.length < 2) return 0;
      const mean = nums.reduce((s, n) => s + n, 0) / nums.length;
      const v = nums.reduce((s, n) => s + (n - mean) * (n - mean), 0) / (nums.length - 1);
      return Math.sqrt(v);
    }
    default: return 0;
  }
}

export function valueId(value) {
  return `${(value.agg || 'SUM').toUpperCase()}(${value.field})`;
}

function fieldIndex(headers, name) {
  return headers.findIndex((h) => String(h).trim().toLowerCase() === String(name).trim().toLowerCase());
}

function applyFilters(rows, headers, filters) {
  if (!filters || !filters.length) return rows;
  return rows.filter((row) =>
    filters.every((f) => {
      const idx = fieldIndex(headers, f.field);
      if (idx < 0) return true;
      const cell = row[idx];
      // If no allowed list → keep all (filter is "in place but unconfigured")
      if (!f.allowed || !f.allowed.length) return true;
      return f.allowed.some((a) => String(a) === String(cell));
    })
  );
}

function tupleKey(arr) {
  return arr.map((v) => (v == null ? '∅' : String(v))).join('║');
}

function uniqueTuples(rows, headers, fields) {
  if (!fields.length) return [[]];  // single empty tuple → no grouping
  const seen = new Map();
  for (const row of rows) {
    const tup = fields.map((f) => row[fieldIndex(headers, f)]);
    const k = tupleKey(tup);
    if (!seen.has(k)) seen.set(k, tup);
  }
  return Array.from(seen.values()).sort((a, b) => {
    for (let i = 0; i < a.length; i++) {
      const ai = a[i], bi = b[i];
      const cmp = String(ai ?? '').localeCompare(String(bi ?? ''), undefined, { numeric: true });
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

export function computePivot(sourceData, state) {
  const empty = {
    rowKeys: [], colKeys: [], cells: {}, rowTotals: {}, colTotals: {},
    grandTotal: {}, valueIds: [], rowFields: [], colFields: [],
  };
  if (!sourceData || !Array.isArray(sourceData.headers) || !Array.isArray(sourceData.rows)) return empty;
  const { headers, rows: allRows } = sourceData;
  const rowFields = Array.isArray(state.rows) ? state.rows : [];
  const colFields = Array.isArray(state.columns) ? state.columns : [];
  const values    = Array.isArray(state.values)  ? state.values  : [];
  const filters   = Array.isArray(state.filters) ? state.filters : [];

  const rows = applyFilters(allRows, headers, filters);
  const valueIds = values.map(valueId);

  const rowKeys = uniqueTuples(rows, headers, rowFields);
  const colKeys = uniqueTuples(rows, headers, colFields);

  // Group rows by (rowKey, colKey) → array of source rows
  const groups = new Map(); // 'rowKey||colKey' → row[]
  for (const row of rows) {
    const rk = tupleKey(rowFields.map((f) => row[fieldIndex(headers, f)]));
    const ck = tupleKey(colFields.map((f) => row[fieldIndex(headers, f)]));
    const key = rk + '##' + ck;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  // Cells: aggregate each (rowKey, colKey) bucket per value definition
  const cells = {};
  for (const rk of rowKeys) {
    const rkStr = tupleKey(rk);
    cells[rkStr] = {};
    for (const ck of colKeys) {
      const ckStr = tupleKey(ck);
      const bucket = groups.get(rkStr + '##' + ckStr) || [];
      const result = {};
      for (const v of values) {
        const fIdx = fieldIndex(headers, v.field);
        const colVals = bucket.map((r) => r[fIdx]);
        result[valueId(v)] = aggregateValues(colVals, v.agg);
      }
      cells[rkStr][ckStr] = result;
    }
  }

  // Row totals, aggregate across all col buckets for that row
  const rowTotals = {};
  for (const rk of rowKeys) {
    const rkStr = tupleKey(rk);
    const bucket = [];
    for (const ck of colKeys) {
      const b = groups.get(rkStr + '##' + tupleKey(ck)) || [];
      bucket.push(...b);
    }
    const result = {};
    for (const v of values) {
      const fIdx = fieldIndex(headers, v.field);
      result[valueId(v)] = aggregateValues(bucket.map((r) => r[fIdx]), v.agg);
    }
    rowTotals[rkStr] = result;
  }
  // Column totals
  const colTotals = {};
  for (const ck of colKeys) {
    const ckStr = tupleKey(ck);
    const bucket = [];
    for (const rk of rowKeys) {
      const b = groups.get(tupleKey(rk) + '##' + ckStr) || [];
      bucket.push(...b);
    }
    const result = {};
    for (const v of values) {
      const fIdx = fieldIndex(headers, v.field);
      result[valueId(v)] = aggregateValues(bucket.map((r) => r[fIdx]), v.agg);
    }
    colTotals[ckStr] = result;
  }
  // Grand total
  const grand = {};
  for (const v of values) {
    const fIdx = fieldIndex(headers, v.field);
    grand[valueId(v)] = aggregateValues(rows.map((r) => r[fIdx]), v.agg);
  }

  return {
    rowKeys, colKeys, cells, rowTotals, colTotals,
    grandTotal: grand,
    valueIds, rowFields, colFields,
  };
}

/* ─────────────────────────  Grading  ──────────────────────────
 * gradePivotSheet(currentState, expectedState, sourceData, expectedCells?)
 *
 * Returns { correct: bool, partial_credit: 0-1, feedback: 'string', breakdown }.
 *
 * partial_credit is the weighted average of 3-4 dimensions:
 *   - 40% field placement (rows/cols/values fields match)
 *   - 20% value aggregations match
 *   - 20% filter set + allowed lists overlap
 *   - 20% (or 40% if no filters) expected_cells match within tolerance
 *
 * `correct` is strict, ALL of these must be true:
 *   - same set of fields in rows  (order ignored for now)
 *   - same set of fields in cols
 *   - same set of {field, agg} in values
 *   - if expected_cells provided, every one matches within tolerance
 */
function sameSetCI(a = [], b = []) {
  const sa = new Set(a.map((x) => String(x).trim().toLowerCase()));
  const sb = new Set(b.map((x) => String(x).trim().toLowerCase()));
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

function sameValuesSet(a = [], b = []) {
  const norm = (v) => `${v.field.toString().trim().toLowerCase()}::${(v.agg || 'SUM').toUpperCase()}`;
  const sa = new Set(a.map(norm));
  const sb = new Set(b.map(norm));
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

export function gradePivotSheet(currentState, expectedState, sourceData, expectedCells) {
  const breakdown = {
    fields_match:     sameSetCI(currentState.rows, expectedState.rows) &&
                      sameSetCI(currentState.columns, expectedState.columns) &&
                      sameSetCI((currentState.values || []).map((v) => v.field),
                                (expectedState.values || []).map((v) => v.field)),
    values_match:     sameValuesSet(currentState.values || [], expectedState.values || []),
    filters_match:    true,                       // checked below if expected has filters
    cells_match:      true,                       // checked below if expected_cells provided
    cells_passed: 0, cells_total: 0,
  };
  // Filters check (loose: just compares field sets; allowed-list intersection
  // is too granular to grade strictly).
  if (Array.isArray(expectedState.filters) && expectedState.filters.length) {
    breakdown.filters_match = sameSetCI(
      (currentState.filters || []).map((f) => f.field),
      expectedState.filters.map((f) => f.field),
    );
  }
  // Specific cell checks
  let cellWeight = 0;
  if (Array.isArray(expectedCells) && expectedCells.length) {
    const pivot = computePivot(sourceData, currentState);
    let pass = 0;
    breakdown.cells_total = expectedCells.length;
    breakdown.cell_results = [];
    for (const ec of expectedCells) {
      const rkStr = tupleKey([ec.row_label]);
      const ckStr = tupleKey([ec.col_label]);
      const cell = pivot.cells[rkStr]?.[ckStr];
      let got;
      if (cell) {
        const ids = Object.keys(cell);
        got = ec.value_id && cell[ec.value_id] !== undefined ? cell[ec.value_id] : cell[ids[0]];
      }
      const tol = ec.tolerance == null ? 0.01 : Number(ec.tolerance);
      const ok = typeof got === 'number' && typeof ec.value === 'number'
                  ? Math.abs(got - ec.value) <= tol
                  : (got === ec.value);
      if (ok) pass += 1;
      breakdown.cell_results.push({ row_label: ec.row_label, col_label: ec.col_label,
                                    expected: ec.value, got, ok });
    }
    breakdown.cells_passed = pass;
    breakdown.cells_match = pass === expectedCells.length;
    cellWeight = 0.40;       // when cells provided, give them 40%
  }

  // Weighting
  const wFields  = 0.40;
  const wAgg     = 0.20;
  const wFilters = Array.isArray(expectedState.filters) && expectedState.filters.length ? 0.20 : 0;
  // Remaining goes to cells (if any), else redistribute to fields
  const remaining = 1 - wFields - wAgg - wFilters;
  const wCells = cellWeight > 0 ? cellWeight : 0;
  const wFieldsAdj = wFields + (cellWeight === 0 ? remaining : 0);
  const score =
      (breakdown.fields_match  ? wFieldsAdj : 0)
    + (breakdown.values_match  ? wAgg     : 0)
    + (breakdown.filters_match ? wFilters : 0)
    + (breakdown.cells_total
        ? (breakdown.cells_passed / breakdown.cells_total) * wCells
        : 0);
  const correct = breakdown.fields_match && breakdown.values_match
                  && breakdown.filters_match && breakdown.cells_match;
  let feedback;
  if (correct) {
    feedback = `Pivot built correctly. ${breakdown.cells_total
      ? `${breakdown.cells_passed}/${breakdown.cells_total} expected cells matched.`
      : ''}`.trim();
  } else {
    const issues = [];
    if (!breakdown.fields_match)  issues.push('field placement is off');
    if (!breakdown.values_match)  issues.push('aggregation (SUM/AVG/...) does not match');
    if (!breakdown.filters_match) issues.push('expected filter set is missing');
    if (!breakdown.cells_match && breakdown.cells_total)
      issues.push(`${breakdown.cells_total - breakdown.cells_passed} cell value(s) off`);
    feedback = `Issues: ${issues.join('; ')}.`;
  }
  return { correct, partial_credit: Math.round(score * 100) / 100, feedback, breakdown };
}

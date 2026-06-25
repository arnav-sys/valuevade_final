// Tiny Excel-style formula evaluator. Hand-rolled to keep the bundle lean
// (no new npm deps). Supports the function set the Batch 5 spec asks for:
//   • cell refs: A1, B12, $A$1 (absolute markers are tolerated but ignored —
//     we don't fill-handle drag yet)
//   • ranges: A1:B5
//   • cross-sheet refs: Sheet2!A1, 'Income Statement'!B3
//   • arithmetic: + - * / ^ % parentheses
//   • comparisons: =, <>, <, <=, >, >=  (returns TRUE / FALSE)
//   • string concat with &
//   • functions: SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, ROUND, IF, ABS,
//     SQRT, POWER, CONCAT, IFERROR
//
// Public API:
//   evaluateFormula(formula, ctx)
//     ctx = { activeSheet, getCell(sheetName, addr) → string|number|null,
//             onCircularRef(addr) → void }
//
// All numeric coercion follows Excel semantics:
//   "" / null → 0 in math, ignored by COUNT, counted by COUNTA
//   non-numeric strings → #VALUE! when used in math

const ERR = (code) => ({ __excelError: true, code });
const isErr = (v) => v && typeof v === 'object' && v.__excelError;

function colLetterToIndex(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function colIndexToLetter(i) {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function parseAddr(addr) {
  const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(addr.trim());
  if (!m) return null;
  return { col: colLetterToIndex(m[1]), row: parseInt(m[2], 10) - 1, addr: `${m[1].toUpperCase()}${m[2]}` };
}
function addrFromIndices(c, r) {
  return `${colIndexToLetter(c)}${r + 1}`;
}
function expandRange(a, b) {
  const A = parseAddr(a);
  const B = parseAddr(b);
  if (!A || !B) return [];
  const c1 = Math.min(A.col, B.col), c2 = Math.max(A.col, B.col);
  const r1 = Math.min(A.row, B.row), r2 = Math.max(A.row, B.row);
  const out = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) out.push(addrFromIndices(c, r));
  }
  return out;
}

function coerceNum(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const n = Number(String(v).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/* ───────── helpers for lookup / conditional functions ─────────
 * Ranges carry hidden 2D metadata via a non-enumerable `__range` prop
 * (see evalAst → 'range'). When a function receives a range arg it can
 * recover the 2D values via that prop; for legacy fn signatures the
 * regular array iteration semantics still work via .flat().
 */
function rangeMeta(v) { return v && typeof v === 'object' ? v.__range : null; }
function as2D(v) {
  const m = rangeMeta(v);
  if (m && m.values2d) return m.values2d;
  if (Array.isArray(v)) return [v];
  return [[v]];
}
function asFlat(v) { return Array.isArray(v) ? v : [v]; }

/* Wildcard support for SUMIF/COUNTIF criteria. Excel uses "?" = any char,
 * "*" = any chars. Criterion may also include leading operator: ">=10",
 * "<>NA", "<5", "=Apple". */
function parseCriterion(crit) {
  let c = crit;
  if (Array.isArray(c)) c = c[0];
  if (c == null) c = '';
  if (typeof c !== 'string') {
    const n = coerceNum(c);
    return (v) => coerceNum(v) === n;
  }
  const trimmed = c.trim();
  const opMatch = /^(>=|<=|<>|>|<|=)/.exec(trimmed);
  let op = '=', rhs = trimmed;
  if (opMatch) { op = opMatch[1]; rhs = trimmed.slice(op.length).trim(); }
  const rhsNum = Number(rhs);
  const numeric = rhs !== '' && Number.isFinite(rhsNum);
  if (numeric) {
    return (v) => {
      const n = coerceNum(v);
      switch (op) {
        case '>':  return n >  rhsNum;
        case '<':  return n <  rhsNum;
        case '>=': return n >= rhsNum;
        case '<=': return n <= rhsNum;
        case '<>': return n !== rhsNum;
        default:   return n === rhsNum;
      }
    };
  }
  // String comparison with wildcard support.
  const pat = new RegExp('^' + rhs
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\?/g, '.')
    .replace(/\*/g, '.*') + '$', 'i');
  if (op === '<>') return (v) => !pat.test(String(v ?? ''));
  return (v) => pat.test(String(v ?? ''));
}

const FUNCTIONS = {
  SUM: (args) => args.flat().reduce((s, v) => s + (coerceNum(v) || 0), 0),
  AVERAGE: (args) => {
    const flat = args.flat().map(coerceNum).filter((v) => Number.isFinite(v));
    if (!flat.length) return ERR('#DIV/0!');
    return flat.reduce((s, v) => s + v, 0) / flat.length;
  },
  MIN: (args) => {
    const flat = args.flat().map(coerceNum).filter(Number.isFinite);
    return flat.length ? Math.min(...flat) : 0;
  },
  MAX: (args) => {
    const flat = args.flat().map(coerceNum).filter(Number.isFinite);
    return flat.length ? Math.max(...flat) : 0;
  },
  COUNT: (args) => args.flat().filter((v) => v !== '' && v !== null && Number.isFinite(coerceNum(v))).length,
  COUNTA: (args) => args.flat().filter((v) => v !== '' && v !== null && v !== undefined).length,
  ROUND: ([num, digits]) => {
    const n = coerceNum(Array.isArray(num) ? num[0] : num);
    const d = coerceNum(Array.isArray(digits) ? digits[0] : (digits ?? 0));
    if (!Number.isFinite(n)) return ERR('#VALUE!');
    const f = Math.pow(10, d);
    return Math.round(n * f) / f;
  },
  ABS:  ([v]) => Math.abs(coerceNum(Array.isArray(v) ? v[0] : v)),
  SQRT: ([v]) => {
    const n = coerceNum(Array.isArray(v) ? v[0] : v);
    return n < 0 ? ERR('#NUM!') : Math.sqrt(n);
  },
  POWER: ([base, exp]) => Math.pow(coerceNum(Array.isArray(base)?base[0]:base), coerceNum(Array.isArray(exp)?exp[0]:exp)),
  CONCAT: (args) => args.flat().map((v) => v == null ? '' : String(v)).join(''),
  CONCATENATE: (args) => args.flat().map((v) => v == null ? '' : String(v)).join(''),
  IF: ([cond, a, b]) => {
    const c = Array.isArray(cond) ? cond[0] : cond;
    const truthy = c === true || (typeof c === 'number' && c !== 0) ||
                   (typeof c === 'string' && c.length > 0 && c.toLowerCase() !== 'false');
    const out = truthy ? a : b;
    return Array.isArray(out) ? out[0] : (out === undefined ? false : out);
  },
  IFERROR: ([v, fallback]) => {
    const x = Array.isArray(v) ? v[0] : v;
    if (isErr(x)) return Array.isArray(fallback) ? fallback[0] : fallback;
    return x;
  },

  /* ─────────────────  Conditional aggregates  ──────────────────
   * SUMIF(range, criterion, [sum_range])
   * COUNTIF(range, criterion)
   * AVERAGEIF(range, criterion, [average_range])
   * SUMIFS / COUNTIFS / AVERAGEIFS: positional pairs (range, criterion). */
  SUMIF: ([range, criterion, sumRange]) => {
    const test = parseCriterion(criterion);
    const probe = asFlat(range);
    const target = sumRange === undefined ? probe : asFlat(sumRange);
    let s = 0;
    for (let i = 0; i < probe.length; i++) if (test(probe[i])) s += coerceNum(target[i]);
    return s;
  },
  COUNTIF: ([range, criterion]) => {
    const test = parseCriterion(criterion);
    return asFlat(range).filter(test).length;
  },
  AVERAGEIF: ([range, criterion, avgRange]) => {
    const test = parseCriterion(criterion);
    const probe = asFlat(range);
    const target = avgRange === undefined ? probe : asFlat(avgRange);
    let s = 0, n = 0;
    for (let i = 0; i < probe.length; i++) if (test(probe[i])) { s += coerceNum(target[i]); n++; }
    return n === 0 ? ERR('#DIV/0!') : s / n;
  },
  SUMIFS: (args) => {
    const sumRange = asFlat(args[0]);
    let s = 0;
    for (let i = 0; i < sumRange.length; i++) {
      let match = true;
      for (let j = 1; j < args.length; j += 2) {
        const probe = asFlat(args[j]);
        const test = parseCriterion(args[j + 1]);
        if (!test(probe[i])) { match = false; break; }
      }
      if (match) s += coerceNum(sumRange[i]);
    }
    return s;
  },
  COUNTIFS: (args) => {
    const first = asFlat(args[0]);
    let n = 0;
    for (let i = 0; i < first.length; i++) {
      let match = true;
      for (let j = 0; j < args.length; j += 2) {
        const probe = asFlat(args[j]);
        const test = parseCriterion(args[j + 1]);
        if (!test(probe[i])) { match = false; break; }
      }
      if (match) n++;
    }
    return n;
  },
  AVERAGEIFS: (args) => {
    const avgRange = asFlat(args[0]);
    let s = 0, n = 0;
    for (let i = 0; i < avgRange.length; i++) {
      let match = true;
      for (let j = 1; j < args.length; j += 2) {
        const probe = asFlat(args[j]);
        const test = parseCriterion(args[j + 1]);
        if (!test(probe[i])) { match = false; break; }
      }
      if (match) { s += coerceNum(avgRange[i]); n++; }
    }
    return n === 0 ? ERR('#DIV/0!') : s / n;
  },

  /* ─────────────────  Lookup family  ──────────────────────────
   * VLOOKUP(lookup, table_range, col_index, [exact])
   * HLOOKUP(lookup, table_range, row_index, [exact])
   * INDEX(range, row_num, [col_num])
   * MATCH(lookup, range, [match_type])  -- 0=exact, 1=less-or-eq, -1=greater-or-eq
   * XLOOKUP(lookup, lookup_range, return_range, [if_not_found], [match_mode])
   */
  VLOOKUP: ([lookup, table, colIdx, exact]) => {
    const grid = as2D(table);
    const col = Math.round(coerceNum(Array.isArray(colIdx) ? colIdx[0] : colIdx)) - 1;
    const isExact = (() => {
      const e = Array.isArray(exact) ? exact[0] : exact;
      if (e === undefined || e === null) return false;          // default Excel = TRUE (approx) but we lean exact-match for safety
      if (typeof e === 'boolean') return !e;                    // FALSE → exact
      return coerceNum(e) === 0;
    })();
    const key = Array.isArray(lookup) ? lookup[0] : lookup;
    const keyN = coerceNum(key);
    if (col < 0) return ERR('#REF!');
    if (isExact) {
      for (const row of grid) {
        if (row[0] == null) continue;
        const a = row[0], an = coerceNum(a);
        if (a === key || (Number.isFinite(an) && an === keyN) || String(a) === String(key)) {
          return col < row.length ? row[col] : ERR('#REF!');
        }
      }
      return ERR('#N/A');
    }
    // Approximate: largest value ≤ lookup (assumes sorted ascending).
    let last = null;
    for (const row of grid) {
      const v = coerceNum(row[0]);
      if (Number.isFinite(v) && v <= keyN) last = row; else break;
    }
    if (!last) return ERR('#N/A');
    return col < last.length ? last[col] : ERR('#REF!');
  },
  HLOOKUP: ([lookup, table, rowIdx, exact]) => {
    const grid = as2D(table);
    if (!grid.length) return ERR('#REF!');
    const cols = Math.max(...grid.map((r) => r.length));
    const transposed = [];
    for (let c = 0; c < cols; c++) {
      const row = [];
      for (let r = 0; r < grid.length; r++) row.push(grid[r][c]);
      transposed.push(row);
    }
    return FUNCTIONS.VLOOKUP([lookup, { __range: { values2d: transposed } }, rowIdx, exact]);
  },
  INDEX: ([range, rowNum, colNum]) => {
    const grid = as2D(range);
    const r = Math.round(coerceNum(Array.isArray(rowNum) ? rowNum[0] : rowNum)) - 1;
    const c = colNum === undefined ? 0 : Math.round(coerceNum(Array.isArray(colNum) ? colNum[0] : colNum)) - 1;
    if (r < 0 || r >= grid.length) return ERR('#REF!');
    const row = grid[r];
    if (c < 0 || c >= row.length) return ERR('#REF!');
    return row[c];
  },
  MATCH: ([lookup, range, matchType]) => {
    const arr = asFlat(range);
    const key = Array.isArray(lookup) ? lookup[0] : lookup;
    const m = matchType === undefined ? 1 : coerceNum(Array.isArray(matchType) ? matchType[0] : matchType);
    if (m === 0) {
      // Exact match (string or number).
      const keyN = coerceNum(key);
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (v === key || (Number.isFinite(coerceNum(v)) && coerceNum(v) === keyN) || String(v) === String(key)) return i + 1;
      }
      return ERR('#N/A');
    }
    if (m > 0) {
      // Largest value ≤ lookup (ascending sort assumed).
      const keyN = coerceNum(key);
      let last = -1;
      for (let i = 0; i < arr.length; i++) {
        const v = coerceNum(arr[i]);
        if (Number.isFinite(v) && v <= keyN) last = i; else break;
      }
      return last === -1 ? ERR('#N/A') : last + 1;
    }
    // m < 0 → smallest ≥ lookup (descending sort assumed).
    const keyN = coerceNum(key);
    for (let i = 0; i < arr.length; i++) {
      const v = coerceNum(arr[i]);
      if (Number.isFinite(v) && v >= keyN) {
        // Continue while still ≥ key
        let j = i + 1;
        while (j < arr.length && Number.isFinite(coerceNum(arr[j])) && coerceNum(arr[j]) >= keyN) j++;
        return j;  // last position that satisfied
      }
    }
    return ERR('#N/A');
  },
  XLOOKUP: ([lookup, lookupRange, returnRange, ifNotFound]) => {
    const probe = asFlat(lookupRange);
    const target = asFlat(returnRange);
    const key = Array.isArray(lookup) ? lookup[0] : lookup;
    const keyN = coerceNum(key);
    for (let i = 0; i < probe.length; i++) {
      const v = probe[i];
      if (v === key || (Number.isFinite(coerceNum(v)) && coerceNum(v) === keyN) || String(v) === String(key)) {
        return target[i];
      }
    }
    if (ifNotFound !== undefined) return Array.isArray(ifNotFound) ? ifNotFound[0] : ifNotFound;
    return ERR('#N/A');
  },

  /* ─────────────────  Financial  ───────────────────────────────
   * Excel sign convention: payments OUT are negative. We keep the same.
   * PMT(rate, nper, pv, [fv], [type])
   * PPMT(rate, per, nper, pv, [fv], [type])
   * IPMT(rate, per, nper, pv, [fv], [type])
   * FV(rate, nper, pmt, [pv], [type])
   * PV(rate, nper, pmt, [fv], [type])
   * NPV(rate, ...values)
   * IRR(values, [guess])
   * RATE(nper, pmt, pv, [fv], [type], [guess])
   * NPER(rate, pmt, pv, [fv], [type])
   */
  PMT: (args) => {
    const r = coerceNum(args[0]); const n = coerceNum(args[1]); const pv = coerceNum(args[2]);
    const fv = args[3] !== undefined ? coerceNum(args[3]) : 0;
    const type = args[4] !== undefined ? coerceNum(args[4]) : 0;
    if (n === 0) return ERR('#NUM!');
    if (r === 0) return -(pv + fv) / n;
    const pmt = -(pv * Math.pow(1 + r, n) + fv) * r / ((Math.pow(1 + r, n) - 1) * (1 + r * type));
    return pmt;
  },
  PPMT: (args) => {
    const [rate, per, nper, pv, fv = 0, type = 0] = args.map((a) => coerceNum(a));
    const pmt = FUNCTIONS.PMT([rate, nper, pv, fv, type]);
    if (rate === 0) return pmt;
    // Interest for period `per`: balance at end of previous period.
    const balance = -pv * Math.pow(1 + rate, per - 1) - pmt * ((Math.pow(1 + rate, per - 1) - 1) / rate) * (type === 1 ? (1 + rate) : 1);
    const interest = balance * rate;
    return pmt - interest;
  },
  IPMT: (args) => {
    const [rate, per, nper, pv, fv = 0, type = 0] = args.map((a) => coerceNum(a));
    if (rate === 0) return 0;
    const pmt = FUNCTIONS.PMT([rate, nper, pv, fv, type]);
    const balance = -pv * Math.pow(1 + rate, per - 1) - pmt * ((Math.pow(1 + rate, per - 1) - 1) / rate) * (type === 1 ? (1 + rate) : 1);
    return balance * rate;
  },
  FV: (args) => {
    const r = coerceNum(args[0]); const n = coerceNum(args[1]); const pmt = coerceNum(args[2]);
    const pv = args[3] !== undefined ? coerceNum(args[3]) : 0;
    const type = args[4] !== undefined ? coerceNum(args[4]) : 0;
    if (r === 0) return -(pv + pmt * n);
    return -(pv * Math.pow(1 + r, n) + pmt * (Math.pow(1 + r, n) - 1) * (1 + r * type) / r);
  },
  PV: (args) => {
    const r = coerceNum(args[0]); const n = coerceNum(args[1]); const pmt = coerceNum(args[2]);
    const fv = args[3] !== undefined ? coerceNum(args[3]) : 0;
    const type = args[4] !== undefined ? coerceNum(args[4]) : 0;
    if (r === 0) return -(fv + pmt * n);
    return -(fv + pmt * (1 + r * type) * (Math.pow(1 + r, n) - 1) / r) / Math.pow(1 + r, n);
  },
  NPV: (args) => {
    const r = coerceNum(Array.isArray(args[0]) ? args[0][0] : args[0]);
    let s = 0;
    let t = 1;
    for (let i = 1; i < args.length; i++) {
      const a = args[i];
      const vals = Array.isArray(a) ? a : [a];
      for (const v of vals) { s += coerceNum(v) / Math.pow(1 + r, t); t++; }
    }
    return s;
  },
  IRR: (args) => {
    const flow = asFlat(args[0]).map(coerceNum).filter((v) => Number.isFinite(v));
    if (flow.length < 2) return ERR('#NUM!');
    // Newton-Raphson search for the rate that zeros NPV.
    let rate = args[1] !== undefined ? coerceNum(Array.isArray(args[1]) ? args[1][0] : args[1]) : 0.1;
    for (let iter = 0; iter < 80; iter++) {
      let npv = 0, dnpv = 0;
      for (let t = 0; t < flow.length; t++) {
        const denom = Math.pow(1 + rate, t);
        npv += flow[t] / denom;
        dnpv -= t * flow[t] / (denom * (1 + rate));
      }
      if (Math.abs(npv) < 1e-7) return rate;
      if (dnpv === 0) break;
      rate = rate - npv / dnpv;
      if (!Number.isFinite(rate) || rate < -0.999) return ERR('#NUM!');
    }
    return ERR('#NUM!');
  },
  RATE: (args) => {
    const [nper, pmt, pv, fv = 0, type = 0] = args.map((a) => coerceNum(Array.isArray(a) ? a[0] : a));
    let r = args[5] !== undefined ? coerceNum(Array.isArray(args[5]) ? args[5][0] : args[5]) : 0.1;
    for (let iter = 0; iter < 80; iter++) {
      if (r === 0) return ERR('#NUM!');
      const pow = Math.pow(1 + r, nper);
      const f = pv * pow + pmt * (1 + r * type) * (pow - 1) / r + fv;
      // Numerical derivative.
      const dr = 1e-6;
      const pow2 = Math.pow(1 + r + dr, nper);
      const f2 = pv * pow2 + pmt * (1 + (r + dr) * type) * (pow2 - 1) / (r + dr) + fv;
      const df = (f2 - f) / dr;
      if (Math.abs(f) < 1e-7) return r;
      if (df === 0) break;
      r = r - f / df;
      if (!Number.isFinite(r)) return ERR('#NUM!');
    }
    return ERR('#NUM!');
  },
  NPER: (args) => {
    const [rate, pmt, pv, fv = 0, type = 0] = args.map((a) => coerceNum(Array.isArray(a) ? a[0] : a));
    if (rate === 0) {
      if (pmt === 0) return ERR('#NUM!');
      return -(pv + fv) / pmt;
    }
    const num = (pmt * (1 + rate * type) - fv * rate);
    const den = (pmt * (1 + rate * type) + pv * rate);
    if (num / den <= 0) return ERR('#NUM!');
    return Math.log(num / den) / Math.log(1 + rate);
  },

  /* ─────────────────  Statistical  ─────────────────────────────
   * STDEV/VAR: sample (n-1). MEDIAN: middle (avg of two middles if even).
   * PERCENTILE(range, k) — k ∈ [0,1] — linear interpolation. */
  STDEV: (args) => {
    const flat = args.flat().map(coerceNum).filter(Number.isFinite);
    if (flat.length < 2) return ERR('#DIV/0!');
    const mean = flat.reduce((s, v) => s + v, 0) / flat.length;
    const variance = flat.reduce((s, v) => s + (v - mean) ** 2, 0) / (flat.length - 1);
    return Math.sqrt(variance);
  },
  VAR: (args) => {
    const flat = args.flat().map(coerceNum).filter(Number.isFinite);
    if (flat.length < 2) return ERR('#DIV/0!');
    const mean = flat.reduce((s, v) => s + v, 0) / flat.length;
    return flat.reduce((s, v) => s + (v - mean) ** 2, 0) / (flat.length - 1);
  },
  MEDIAN: (args) => {
    const flat = args.flat().map(coerceNum).filter(Number.isFinite).sort((a, b) => a - b);
    if (!flat.length) return ERR('#NUM!');
    const m = Math.floor(flat.length / 2);
    return flat.length % 2 ? flat[m] : (flat[m - 1] + flat[m]) / 2;
  },
  PERCENTILE: ([range, k]) => {
    const flat = asFlat(range).map(coerceNum).filter(Number.isFinite).sort((a, b) => a - b);
    const p = coerceNum(Array.isArray(k) ? k[0] : k);
    if (!flat.length) return ERR('#NUM!');
    if (p < 0 || p > 1) return ERR('#NUM!');
    if (p === 0) return flat[0];
    if (p === 1) return flat[flat.length - 1];
    const idx = p * (flat.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return flat[lo];
    return flat[lo] + (flat[hi] - flat[lo]) * (idx - lo);
  },

  /* ─────────────────  Text  ────────────────────────────────────── */
  LEFT: ([t, n]) => String(Array.isArray(t) ? t[0] : (t ?? '')).slice(0, Math.max(0, Math.round(coerceNum(Array.isArray(n) ? n[0] : (n ?? 1))))),
  RIGHT:([t, n]) => {
    const s = String(Array.isArray(t) ? t[0] : (t ?? ''));
    const k = Math.max(0, Math.round(coerceNum(Array.isArray(n) ? n[0] : (n ?? 1))));
    return s.slice(-k || s.length);
  },
  MID:  ([t, start, len]) => {
    const s = String(Array.isArray(t) ? t[0] : (t ?? ''));
    const i = Math.max(1, Math.round(coerceNum(Array.isArray(start) ? start[0] : start))) - 1;
    const l = Math.max(0, Math.round(coerceNum(Array.isArray(len) ? len[0] : len)));
    return s.slice(i, i + l);
  },
  LEN:  ([t]) => String(Array.isArray(t) ? t[0] : (t ?? '')).length,
  FIND: ([needle, hay, start]) => {
    const n = String(Array.isArray(needle) ? needle[0] : (needle ?? ''));
    const s = String(Array.isArray(hay)    ? hay[0]    : (hay ?? ''));
    const from = Math.max(1, Math.round(coerceNum(Array.isArray(start) ? start[0] : (start ?? 1)))) - 1;
    const idx = s.indexOf(n, from);
    return idx === -1 ? ERR('#VALUE!') : idx + 1;
  },
  SEARCH: ([needle, hay, start]) => {
    // Case-insensitive variant of FIND. Excel supports * and ? wildcards
    // here too; we honour the most common cases.
    const n = String(Array.isArray(needle) ? needle[0] : (needle ?? '')).toLowerCase();
    const s = String(Array.isArray(hay)    ? hay[0]    : (hay ?? '')).toLowerCase();
    const from = Math.max(1, Math.round(coerceNum(Array.isArray(start) ? start[0] : (start ?? 1)))) - 1;
    if (!n) return from + 1;
    const idx = s.indexOf(n, from);
    return idx === -1 ? ERR('#VALUE!') : idx + 1;
  },
  TRIM: ([t]) => String(Array.isArray(t) ? t[0] : (t ?? '')).replace(/\s+/g, ' ').trim(),
  UPPER:([t]) => String(Array.isArray(t) ? t[0] : (t ?? '')).toUpperCase(),
  LOWER:([t]) => String(Array.isArray(t) ? t[0] : (t ?? '')).toLowerCase(),
  PROPER:([t]) => String(Array.isArray(t) ? t[0] : (t ?? '')).toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (m, b, ch) => b + ch.toUpperCase()),

  /* ─────────────────  Date  ───────────────────────────────────────
   * Internal model: dates as JS Date or YYYY-MM-DD strings. */
  TODAY: () => new Date().toISOString().slice(0, 10),
  YEAR: ([t]) => {
    const d = new Date(Array.isArray(t) ? t[0] : t);
    return Number.isFinite(d.getTime()) ? d.getUTCFullYear() : ERR('#VALUE!');
  },
  MONTH: ([t]) => {
    const d = new Date(Array.isArray(t) ? t[0] : t);
    return Number.isFinite(d.getTime()) ? d.getUTCMonth() + 1 : ERR('#VALUE!');
  },
  DAY: ([t]) => {
    const d = new Date(Array.isArray(t) ? t[0] : t);
    return Number.isFinite(d.getTime()) ? d.getUTCDate() : ERR('#VALUE!');
  },
  DATEDIF: ([start, end, unit]) => {
    const a = new Date(Array.isArray(start) ? start[0] : start);
    const b = new Date(Array.isArray(end)   ? end[0]   : end);
    if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return ERR('#VALUE!');
    const u = String(Array.isArray(unit) ? unit[0] : (unit ?? 'D')).toUpperCase();
    const msPerDay = 86400000;
    const days = Math.floor((b - a) / msPerDay);
    switch (u) {
      case 'D':  return days;
      case 'M':  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
                       - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
      case 'Y':  return b.getUTCFullYear() - a.getUTCFullYear()
                       - ((b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) ? 1 : 0);
      default:   return ERR('#NUM!');
    }
  },
};

// Tokenizer: numbers, strings, identifiers, refs, ranges, operators, parens.
function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue; }
    // String literal "text"
    if (ch === '"') {
      let j = i + 1; let s = '';
      while (j < src.length && src[j] !== '"') { s += src[j]; j++; }
      tokens.push({ type: 'str', value: s });
      i = j + 1; continue;
    }
    // Number
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < src.length && /[0-9.eE+\-]/.test(src[j]) && !(src[j] === '+' && j !== i && !'eE'.includes(src[j-1])) && !(src[j] === '-' && j !== i && !'eE'.includes(src[j-1]))) j++;
      // Trim trailing operator chars we accidentally swallowed.
      let s = src.slice(i, j).replace(/[+\-]+$/, '');
      tokens.push({ type: 'num', value: parseFloat(s) });
      i = i + s.length;
      continue;
    }
    // Single-quoted sheet name 'Income Statement'
    if (ch === "'") {
      let j = i + 1; let s = '';
      while (j < src.length && src[j] !== "'") { s += src[j]; j++; }
      if (src[j + 1] === '!') {
        let k = j + 2;
        let ref = '';
        while (k < src.length && /[A-Za-z0-9$:]/.test(src[k])) { ref += src[k]; k++; }
        tokens.push({ type: 'ref', sheet: s, ref });
        i = k; continue;
      }
      tokens.push({ type: 'str', value: s }); i = j + 1; continue;
    }
    // Identifier / function / unquoted sheet!ref / cell ref
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const ident = src.slice(i, j);
      // Cross-sheet ref: Identifier ! cellref
      if (src[j] === '!') {
        let k = j + 1; let ref = '';
        while (k < src.length && /[A-Za-z0-9$:]/.test(src[k])) { ref += src[k]; k++; }
        tokens.push({ type: 'ref', sheet: ident, ref });
        i = k; continue;
      }
      // Cell range identifier (A1:B5)
      if (src[j] === ':' && /^\$?[A-Za-z]+\$?[0-9]+$/.test(ident)) {
        let k = j + 1; let rhs = '';
        while (k < src.length && /[A-Za-z0-9$]/.test(src[k])) { rhs += src[k]; k++; }
        tokens.push({ type: 'range', from: ident, to: rhs });
        i = k; continue;
      }
      // Standalone cell ref
      if (/^\$?[A-Za-z]+\$?[0-9]+$/.test(ident)) {
        tokens.push({ type: 'ref', sheet: null, ref: ident });
        i = j; continue;
      }
      // Function name
      if (src[j] === '(') {
        tokens.push({ type: 'fn', name: ident.toUpperCase() });
        i = j; continue;
      }
      // Boolean
      if (ident.toUpperCase() === 'TRUE')  { tokens.push({ type: 'bool', value: true });  i = j; continue; }
      if (ident.toUpperCase() === 'FALSE') { tokens.push({ type: 'bool', value: false }); i = j; continue; }
      tokens.push({ type: 'ident', value: ident });
      i = j; continue;
    }
    // Operators
    if ('+-*/^%&'.includes(ch)) { tokens.push({ type: 'op', value: ch }); i++; continue; }
    if (ch === '<' || ch === '>') {
      if (src[i + 1] === '=') { tokens.push({ type: 'op', value: ch + '=' }); i += 2; }
      else if (ch === '<' && src[i + 1] === '>') { tokens.push({ type: 'op', value: '<>' }); i += 2; }
      else { tokens.push({ type: 'op', value: ch }); i++; }
      continue;
    }
    if (ch === '=' && src[i + 1] !== '=') { tokens.push({ type: 'op', value: '=' }); i++; continue; }
    if (ch === '(' || ch === ')' || ch === ',') { tokens.push({ type: ch }); i++; continue; }
    // Unknown — skip.
    i++;
  }
  return tokens;
}

// Recursive-descent parser → AST → evaluator.
function makeParser(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const eat = (t) => {
    const tok = tokens[i];
    if (!tok || (typeof t === 'string' && tok.type !== t)) throw new Error('parse-err');
    i++;
    return tok;
  };
  // Precedence: comparison < concat < add/sub < mul/div < power < unary < primary
  function parseExpression() { return parseCompare(); }
  function parseCompare() {
    let left = parseConcat();
    while (peek() && peek().type === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().value)) {
      const op = eat('op').value;
      const right = parseConcat();
      left = { kind: 'binop', op, left, right };
    }
    return left;
  }
  function parseConcat() {
    let left = parseAddSub();
    while (peek() && peek().type === 'op' && peek().value === '&') {
      eat('op');
      left = { kind: 'binop', op: '&', left, right: parseAddSub() };
    }
    return left;
  }
  function parseAddSub() {
    let left = parseMulDiv();
    while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = eat('op').value;
      left = { kind: 'binop', op, left, right: parseMulDiv() };
    }
    return left;
  }
  function parseMulDiv() {
    let left = parsePower();
    while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = eat('op').value;
      left = { kind: 'binop', op, left, right: parsePower() };
    }
    return left;
  }
  function parsePower() {
    let left = parseUnary();
    while (peek() && peek().type === 'op' && peek().value === '^') {
      eat('op');
      left = { kind: 'binop', op: '^', left, right: parseUnary() };
    }
    return left;
  }
  function parseUnary() {
    if (peek() && peek().type === 'op' && (peek().value === '-' || peek().value === '+')) {
      const op = eat('op').value;
      return { kind: 'unary', op, expr: parseUnary() };
    }
    return parsePrimary();
  }
  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('parse-err');
    if (t.type === 'num') { eat('num'); return { kind: 'num', value: t.value }; }
    if (t.type === 'str') { eat('str'); return { kind: 'str', value: t.value }; }
    if (t.type === 'bool') { eat('bool'); return { kind: 'bool', value: t.value }; }
    if (t.type === '(') { eat('('); const e = parseExpression(); eat(')'); return e; }
    if (t.type === 'fn') {
      const name = eat('fn').name;
      eat('('); const args = [];
      if (peek() && peek().type !== ')') {
        args.push(parseExpression());
        while (peek() && peek().type === ',') { eat(','); args.push(parseExpression()); }
      }
      eat(')');
      return { kind: 'call', name, args };
    }
    if (t.type === 'ref') {
      eat('ref');
      return { kind: 'ref', sheet: t.sheet, ref: t.ref };
    }
    if (t.type === 'range') {
      eat('range');
      return { kind: 'range', sheet: null, from: t.from, to: t.to };
    }
    if (t.type === 'ident') { eat('ident'); return { kind: 'str', value: t.value }; }
    throw new Error('parse-err');
  }
  return { parseExpression };
}

function evalAst(node, ctx, visited) {
  if (!node) return '';
  switch (node.kind) {
    case 'num':  return node.value;
    case 'str':  return node.value;
    case 'bool': return node.value;
    case 'unary': {
      const v = evalAst(node.expr, ctx, visited);
      if (isErr(v)) return v;
      const n = coerceNum(v);
      if (!Number.isFinite(n)) return ERR('#VALUE!');
      return node.op === '-' ? -n : n;
    }
    case 'binop': {
      const L = evalAst(node.left, ctx, visited);
      const R = evalAst(node.right, ctx, visited);
      if (isErr(L)) return L;
      if (isErr(R)) return R;
      if (node.op === '&') return (L == null ? '' : String(L)) + (R == null ? '' : String(R));
      if (['=', '<>', '<', '>', '<=', '>='].includes(node.op)) {
        const a = typeof L === 'number' ? L : (isFinite(Number(L)) ? Number(L) : L);
        const b = typeof R === 'number' ? R : (isFinite(Number(R)) ? Number(R) : R);
        switch (node.op) {
          case '=':  return a === b;
          case '<>': return a !== b;
          case '<':  return a < b;
          case '>':  return a > b;
          case '<=': return a <= b;
          case '>=': return a >= b;
          default: return false;
        }
      }
      const a = coerceNum(L);
      const b = coerceNum(R);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return ERR('#VALUE!');
      switch (node.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? ERR('#DIV/0!') : a / b;
        case '^': return Math.pow(a, b);
        case '%': return a % b;
        default: return ERR('#VALUE!');
      }
    }
    case 'ref': {
      const sheetName = node.sheet || ctx.activeSheet;
      const a = parseAddr(node.ref);
      if (!a) return ERR('#REF!');
      const fullId = `${sheetName}!${a.addr}`;
      if (visited.has(fullId)) { ctx.onCircularRef?.(a.addr); return ERR('#CIRC!'); }
      visited.add(fullId);
      const v = ctx.getCell(sheetName, a.addr);
      visited.delete(fullId);
      // If the value is a formula string, evaluate it transitively.
      if (typeof v === 'string' && v.startsWith('=')) {
        return evaluateFormula(v, ctx, visited);
      }
      if (v == null || v === '') return 0;
      const n = Number(v);
      return Number.isFinite(n) && String(v).trim() !== '' ? n : v;
    }
    case 'range': {
      const sheetName = node.sheet || ctx.activeSheet;
      // Build a 2D matrix so lookup fns (VLOOKUP/INDEX/MATCH/HLOOKUP) can
      // recover row/col shape. We keep the flat array form (used by
      // SUM/AVERAGE/SUMIF/etc.) as the primary return value, and attach
      // the 2D form + metadata as a non-enumerable `__range` prop so
      // existing `.flat()`-based functions keep working unchanged.
      const A = parseAddr(node.from);
      const B = parseAddr(node.to);
      if (!A || !B) return ERR('#REF!');
      const c1 = Math.min(A.col, B.col), c2 = Math.max(A.col, B.col);
      const r1 = Math.min(A.row, B.row), r2 = Math.max(A.row, B.row);
      const flat = [];
      const grid = [];
      for (let r = r1; r <= r2; r++) {
        const row = [];
        for (let c = c1; c <= c2; c++) {
          const addr = addrFromIndices(c, r);
          let v = ctx.getCell(sheetName, addr);
          if (typeof v === 'string' && v.startsWith('=')) {
            v = evaluateFormula(v, ctx, visited);
          }
          row.push(v);
          flat.push(v);
        }
        grid.push(row);
      }
      // Attach metadata; non-enumerable so JSON.stringify doesn't bloat.
      try {
        Object.defineProperty(flat, '__range', {
          value: { sheet: sheetName, rows: r2 - r1 + 1, cols: c2 - c1 + 1, values2d: grid },
          enumerable: false,
        });
      } catch { /* frozen prototypes in test env — ignore */ }
      return flat;
    }
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) return ERR('#NAME?');
      const args = node.args.map((a) => evalAst(a, ctx, visited));
      for (const a of args) if (isErr(a)) return a;
      try {
        return fn(args);
      } catch {
        return ERR('#ERROR!');
      }
    }
    default: return '';
  }
}

export function evaluateFormula(input, ctx, visited = new Set()) {
  if (typeof input !== 'string') return input;
  let src = input.startsWith('=') ? input.slice(1) : input;
  if (!src.trim()) return '';
  let tokens, parser, ast;
  try {
    tokens = tokenize(src);
    parser = makeParser(tokens);
    ast = parser.parseExpression();
  } catch {
    return ERR('#ERROR!');
  }
  return evalAst(ast, ctx, visited);
}

export function formatCellDisplay(value) {
  if (value == null || value === '') return '';
  if (isErr(value)) return value.code;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '#NUM!';
    // Round to 4 decimal places to avoid jitter; truncate trailing zeros.
    const rounded = Math.round(value * 10000) / 10000;
    return String(rounded);
  }
  return String(value);
}

export function isFormulaError(value) { return isErr(value); }

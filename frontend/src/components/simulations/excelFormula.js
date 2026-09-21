// Tiny Excel-style formula evaluator. Hand-rolled to keep the bundle lean
// (no new npm deps). Supports the function set the Batch 5 spec asks for:
//   • cell refs: A1, B12, $A$1 (absolute markers are tolerated but ignored,
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
  INT:  ([v]) => Math.floor(coerceNum(Array.isArray(v) ? v[0] : v)),
  MOD:  ([n, d]) => {
    const a = coerceNum(Array.isArray(n) ? n[0] : n);
    const b = coerceNum(Array.isArray(d) ? d[0] : d);
    if (b === 0) return ERR('#DIV/0!');
    return a - Math.floor(a / b) * b;
  },
  TRUNC: ([v, digits]) => {
    const n = coerceNum(Array.isArray(v) ? v[0] : v);
    const d = digits === undefined ? 0 : coerceNum(Array.isArray(digits) ? digits[0] : digits);
    const f = Math.pow(10, d);
    return Math.trunc(n * f) / f;
  },
  SQRT: ([v]) => {
    const n = coerceNum(Array.isArray(v) ? v[0] : v);
    return n < 0 ? ERR('#NUM!') : Math.sqrt(n);
  },
  POWER: ([base, exp]) => Math.pow(coerceNum(Array.isArray(base)?base[0]:base), coerceNum(Array.isArray(exp)?exp[0]:exp)),
  CONCAT: (args) => args.flat().map((v) => v == null ? '' : String(v)).join(''),
  CONCATENATE: (args) => args.flat().map((v) => v == null ? '' : String(v)).join(''),
  IF: (args, lazy) => {
    if (lazy) {
      const cond = args[0]();
      if (isErr(cond)) return cond;
      const c = Array.isArray(cond) ? cond[0] : cond;
      const truthy = c === true || (typeof c === 'number' && c !== 0) ||
                     (typeof c === 'string' && c.length > 0 && c.toLowerCase() !== 'false');
      const out = truthy ? (args[1] ? args[1]() : false) : (args[2] ? args[2]() : false);
      return Array.isArray(out) ? out[0] : (out === undefined ? false : out);
    }
    const [cond, a, b] = args;
    const c = Array.isArray(cond) ? cond[0] : cond;
    const truthy = c === true || (typeof c === 'number' && c !== 0) ||
                   (typeof c === 'string' && c.length > 0 && c.toLowerCase() !== 'false');
    const out = truthy ? a : b;
    return Array.isArray(out) ? out[0] : (out === undefined ? false : out);
  },
  IFERROR: (args, lazy) => {
    if (lazy) {
      const x = args[0]();
      if (isErr(x)) return args[1] ? args[1]() : '';
      return Array.isArray(x) ? x[0] : x;
    }
    const [v, fallback] = args;
    const x = Array.isArray(v) ? v[0] : v;
    if (isErr(x)) return Array.isArray(fallback) ? fallback[0] : fallback;
    return x;
  },
  IFNA: (args, lazy) => {
    if (lazy) {
      const x = args[0]();
      if (isErr(x) && x.code === '#N/A') return args[1] ? args[1]() : '';
      if (isErr(x)) return x;
      return Array.isArray(x) ? x[0] : x;
    }
    const [v, fallback] = args;
    const x = Array.isArray(v) ? v[0] : v;
    if (isErr(x) && x.code === '#N/A') return Array.isArray(fallback) ? fallback[0] : fallback;
    if (isErr(x)) return x;
    return x;
  },
  // IFS(cond1, val1, cond2, val2, …), first truthy condition wins; the
  // common professional pattern uses TRUE as a final catch-all.
  IFS: (args, lazy) => {
    if (lazy) {
      for (let i = 0; i + 1 < args.length; i += 2) {
        const c = args[i]();
        if (isErr(c)) return c;
        const v = Array.isArray(c) ? c[0] : c;
        const truthy = v === true || (typeof v === 'number' && v !== 0) ||
                       (typeof v === 'string' && v.length > 0 && v.toLowerCase() !== 'false');
        if (truthy) {
          const out = args[i + 1]();
          return Array.isArray(out) ? out[0] : out;
        }
      }
      return ERR('#N/A');
    }
    for (let i = 0; i + 1 < args.length; i += 2) {
      const c = Array.isArray(args[i]) ? args[i][0] : args[i];
      const truthy = c === true || (typeof c === 'number' && c !== 0) ||
                     (typeof c === 'string' && c.length > 0 && c.toLowerCase() !== 'false');
      if (truthy) return Array.isArray(args[i + 1]) ? args[i + 1][0] : args[i + 1];
    }
    return ERR('#N/A');
  },
  AND: (args) => args.flat().every((v) => v === true || (typeof v === 'number' && v !== 0)),
  OR:  (args) => args.flat().some((v) => v === true || (typeof v === 'number' && v !== 0)),
  NOT: ([v]) => !(v === true || (typeof v === 'number' && v !== 0)),
  EXACT: ([a, b]) => {
    const x = Array.isArray(a) ? a[0] : a;
    const y = Array.isArray(b) ? b[0] : b;
    return String(x ?? '') === String(y ?? '');
  },
  // SUMPRODUCT(rangeA, rangeB, …), element-wise multiply across all
  // ranges, then sum. Boolean conditions used as multipliers collapse to
  // 1 / 0, which is how analyst-style scoring formulas like
  // `=SUMPRODUCT((C2:C11>15)*(D2:D11<1))` count quality stocks.
  SUMPRODUCT: (args) => {
    const arrs = args.map((a) => Array.isArray(a) ? a : [a]);
    const n = Math.min(...arrs.map((a) => a.length));
    let s = 0;
    for (let i = 0; i < n; i++) {
      let prod = 1;
      for (const arr of arrs) {
        const v = arr[i];
        const num = v === true ? 1 : v === false ? 0 : coerceNum(v);
        if (!Number.isFinite(num)) { prod = 0; break; }
        prod *= num;
      }
      s += prod;
    }
    return s;
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
   * PERCENTILE(range, k), k ∈ [0,1], linear interpolation. */
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
   * Internal date model: dates as JS Date objects. We auto-coerce
   * ISO date strings (YYYY-MM-DD), DD/MM/YYYY and Excel serials in
   * arithmetic via dateArith() below. */
  TODAY: () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z'),
  NOW: () => new Date(),
  DATEVALUE: ([t]) => {
    const s = String(Array.isArray(t) ? t[0] : (t ?? '')).trim();
    const d = parseAnyDate(s);
    return d ? d : ERR('#VALUE!');
  },
  VALUE: ([t]) => {
    const s = String(Array.isArray(t) ? t[0] : (t ?? '')).trim();
    if (s === '') return 0;
    // Strip common Indian currency markers & thousand separators
    const cleaned = s.replace(/[₹$€£,\s]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : ERR('#VALUE!');
  },
  YEAR: ([t]) => {
    const v = Array.isArray(t) ? t[0] : t;
    const d = v instanceof Date ? v : parseAnyDate(v);
    return d ? d.getUTCFullYear() : ERR('#VALUE!');
  },
  MONTH: ([t]) => {
    const v = Array.isArray(t) ? t[0] : t;
    const d = v instanceof Date ? v : parseAnyDate(v);
    return d ? d.getUTCMonth() + 1 : ERR('#VALUE!');
  },
  DAY: ([t]) => {
    const v = Array.isArray(t) ? t[0] : t;
    const d = v instanceof Date ? v : parseAnyDate(v);
    return d ? d.getUTCDate() : ERR('#VALUE!');
  },
  DATEDIF: ([start, end, unit]) => {
    const va = Array.isArray(start) ? start[0] : start;
    const vb = Array.isArray(end)   ? end[0]   : end;
    const a = va instanceof Date ? va : parseAnyDate(va);
    const b = vb instanceof Date ? vb : parseAnyDate(vb);
    if (!a || !b) return ERR('#VALUE!');
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
  EOMONTH: ([start, months]) => {
    const va = Array.isArray(start) ? start[0] : start;
    const d = va instanceof Date ? va : parseAnyDate(va);
    if (!d) return ERR('#VALUE!');
    const m = Math.round(coerceNum(Array.isArray(months) ? months[0] : months));
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m + 1, 0));
  },

  /* ─────────────────  IS* family  ─────────────────────────────── */
  ISERROR: ([v], lazy) => {
    if (lazy) {
      const x = v();
      return isErr(x);
    }
    return isErr(Array.isArray(v) ? v[0] : v);
  },
  ISERR: ([v], lazy) => {
    if (lazy) {
      const x = v();
      return isErr(x) && x.code !== '#N/A';
    }
    const x = Array.isArray(v) ? v[0] : v;
    return isErr(x) && x.code !== '#N/A';
  },
  ISNA: ([v], lazy) => {
    if (lazy) {
      const x = v();
      return isErr(x) && x.code === '#N/A';
    }
    const x = Array.isArray(v) ? v[0] : v;
    return isErr(x) && x.code === '#N/A';
  },
  ISNUMBER: ([v]) => {
    const x = Array.isArray(v) ? v[0] : v;
    return typeof x === 'number' && Number.isFinite(x);
  },
  ISTEXT: ([v]) => {
    const x = Array.isArray(v) ? v[0] : v;
    return typeof x === 'string';
  },
  ISBLANK: ([v]) => {
    const x = Array.isArray(v) ? v[0] : v;
    return x == null || x === '';
  },

  /* ─────────────────  SUBTOTAL  ──────────────────────────────────
   * SUBTOTAL(function_num, range1, range2, …)
   *
   * Codes (1-11 = include-hidden; 101-111 = exclude-hidden; we treat both
   * identically since the engine has no row-hiding metadata):
   *   1, 101 → AVERAGE     2, 102 → COUNT (numeric)     3, 103 → COUNTA
   *   4, 104 → MAX         5, 105 → MIN                  6, 106 → PRODUCT
   *   7, 107 → STDEV       8, 108 → STDEVP               9, 109 → SUM
   *  10, 110 → VAR        11, 111 → VARP
   *
   * We implement codes 1-5, 9 (and their 101-105, 109 mirrors) which cover
   * the M3 curriculum. Unsupported codes return #VALUE!. */
  SUBTOTAL: (args) => {
    const code = Math.round(coerceNum(Array.isArray(args[0]) ? args[0][0] : args[0]));
    const ranges = args.slice(1);
    const k = code >= 101 ? code - 100 : code;
    switch (k) {
      case 1:  return FUNCTIONS.AVERAGE(ranges);
      case 2:  return FUNCTIONS.COUNT(ranges);
      case 3:  return FUNCTIONS.COUNTA(ranges);
      case 4:  return FUNCTIONS.MAX(ranges);
      case 5:  return FUNCTIONS.MIN(ranges);
      case 9:  return FUNCTIONS.SUM(ranges);
      default: return ERR('#VALUE!');
    }
  },
};

/* ─────────────────  Date helpers (used by FUNCTIONS above) ──────
 * Recognises:
 *   - YYYY-MM-DD    (ISO)
 *   - DD/MM/YYYY    (Indian format Haiku tends to emit)
 *   - MM/DD/YYYY    (US fallback)
 *   - DD-MMM-YYYY   (Excel display, e.g. "31-Dec-2024")
 *   - JS Date       (passthrough)
 *   - Excel serial  (number ≥ 1)
 */
function parseAnyDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'number' && v >= 1 && v < 100000) {
    // Excel serial: days since 1900-01-01 (with the famous 1900 leap-year bug
    //, we ignore the leap-year bug for serials > 60 since modern data rarely
    // hits it). 25569 = days between 1970-01-01 and 1900-01-01.
    return new Date((v - 25569) * 86400000);
  }
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  // ISO
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  // DD/MM/YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000;
    const a = +m[1], b = +m[2];
    // Prefer DD/MM/YYYY (Indian) when first ≥ 13
    if (a > 12) return new Date(Date.UTC(y, b - 1, a));
    if (b > 12) return new Date(Date.UTC(y, a - 1, b));
    return new Date(Date.UTC(y, b - 1, a));   // assume DD/MM/YYYY by default
  }
  // DD-MMM-YYYY / DD MMM YYYY
  m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-](\d{2,4})$/);
  if (m) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mi = months.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi < 0) return null;
    let y = +m[3]; if (y < 100) y += 2000;
    return new Date(Date.UTC(y, mi, +m[1]));
  }
  // Last-resort: JS Date parser
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function dateAsSerial(d) {
  // Days since the Unix epoch, sign and magnitude are what arithmetic uses.
  // We deliberately don't apply Excel's 1900-01-01 baseline because the
  // engine never reports the absolute serial, only date-date differences
  // and date+/-integer roundtrips, both of which work in any consistent
  // baseline.
  return Math.floor(d.getTime() / 86400000);
}

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
        // Split into range vs single-ref (same logic as unquoted sheet refs)
        if (ref.includes(':')) {
          const [from, to] = ref.split(':');
          if (/^\$?[A-Za-z]+$/.test(from) && /^\$?[A-Za-z]+$/.test(to)) {
            tokens.push({ type: 'colrange', from: from.replace(/\$/g, ''), to: to.replace(/\$/g, ''), sheet: s });
          } else {
            tokens.push({ type: 'range', from, to, sheet: s });
          }
        } else {
          tokens.push({ type: 'ref', sheet: s, ref });
        }
        i = k; continue;
      }
      tokens.push({ type: 'str', value: s }); i = j + 1; continue;
    }
    // Identifier / function / unquoted sheet!ref / cell ref
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const ident = src.slice(i, j);
      // Cross-sheet ref: Identifier ! cellref-or-range
      if (src[j] === '!') {
        let k = j + 1; let ref = '';
        while (k < src.length && /[A-Za-z0-9$:]/.test(src[k])) { ref += src[k]; k++; }
        // Split into range vs single-ref so the parser/evaluator can
        // treat Sheet!A1:B5 as a real range (was returning #REF! before
        // because parseAddr can't parse a colon-bearing ref).
        if (ref.includes(':')) {
          const [from, to] = ref.split(':');
          // Whole-column range:  Sheet!D:D, Sheet!$B:$B
          if (/^\$?[A-Za-z]+$/.test(from) && /^\$?[A-Za-z]+$/.test(to)) {
            tokens.push({ type: 'colrange', from: from.replace(/\$/g, ''), to: to.replace(/\$/g, ''), sheet: ident });
          } else {
            tokens.push({ type: 'range', from, to, sheet: ident });
          }
        } else {
          tokens.push({ type: 'ref', sheet: ident, ref });
        }
        i = k; continue;
      }
      // Cell range identifier (A1:B5)
      if (src[j] === ':' && /^\$?[A-Za-z]+\$?[0-9]+$/.test(ident)) {
        let k = j + 1; let rhs = '';
        while (k < src.length && /[A-Za-z0-9$]/.test(src[k])) { rhs += src[k]; k++; }
        tokens.push({ type: 'range', from: ident, to: rhs });
        i = k; continue;
      }
      // Whole-column range (bare):  D:D, $B:$B , column letters only.
      if (src[j] === ':' && /^\$?[A-Za-z]+$/.test(ident)) {
        let k = j + 1; let rhs = '';
        while (k < src.length && /[A-Za-z$]/.test(src[k])) { rhs += src[k]; k++; }
        if (/^\$?[A-Za-z]+$/.test(rhs)) {
          tokens.push({ type: 'colrange', from: ident.replace(/\$/g, ''), to: rhs.replace(/\$/g, ''), sheet: null });
          i = k; continue;
        }
        // Fall through if RHS wasn't column-only, we'll treat ident as a bare identifier.
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
    // Unknown, skip.
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
      return { kind: 'range', sheet: t.sheet || null, from: t.from, to: t.to };
    }
    if (t.type === 'colrange') {
      eat('colrange');
      return { kind: 'colrange', sheet: t.sheet || null, from: t.from, to: t.to };
    }
    if (t.type === 'ident') { eat('ident'); return { kind: 'str', value: t.value }; }
    throw new Error('parse-err');
  }
  return { parseExpression };
}

// Scalar binop, separated so the array-spill path can call it element-wise.
function binopScalar(op, L, R) {
  if (op === '&') return (L == null ? '' : String(L)) + (R == null ? '' : String(R));
  if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
    const a = typeof L === 'number' ? L : (isFinite(Number(L)) ? Number(L) : L);
    const b = typeof R === 'number' ? R : (isFinite(Number(R)) ? Number(R) : R);
    switch (op) {
      case '=':  return a === b;
      case '<>': return a !== b;
      case '<':  return a < b;
      case '>':  return a > b;
      case '<=': return a <= b;
      case '>=': return a >= b;
      default: return false;
    }
  }
  // Date arithmetic, Excel treats dates as numeric serials. We let users
  // subtract two dates (→ days) and add/subtract a number to a date (→ date).
  const Ld = L instanceof Date ? L : null;
  const Rd = R instanceof Date ? R : null;
  if (Ld || Rd) {
    const La = Ld ? dateAsSerial(Ld) : coerceNum(L);
    const Ra = Rd ? dateAsSerial(Rd) : coerceNum(R);
    if (!Number.isFinite(La) || !Number.isFinite(Ra)) return ERR('#VALUE!');
    switch (op) {
      case '+': return Ld && !Rd ? new Date((La + Ra) * 86400000) :
                       !Ld && Rd ? new Date((La + Ra) * 86400000) : La + Ra;
      case '-': return La - Ra;
      default:  return ERR('#VALUE!');
    }
  }
  const aBool = L === true ? 1 : (L === false ? 0 : undefined);
  const bBool = R === true ? 1 : (R === false ? 0 : undefined);
  const a = aBool !== undefined ? aBool : coerceNum(L);
  const b = bBool !== undefined ? bBool : coerceNum(R);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return ERR('#VALUE!');
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? ERR('#DIV/0!') : a / b;
    case '^': return Math.pow(a, b);
    case '%': return a % b;
    default: return ERR('#VALUE!');
  }
}

function evalAst(node, ctx, visited) {  if (!node) return '';
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
      // Array-spill: if either operand is a flat array (range result), apply
      // the binop element-wise. This is how Excel's "array context" works
      // for SUMPRODUCT-style condition multiplies like (A2:A11>15)*(B2:B11<1).
      const Lis = Array.isArray(L);
      const Ris = Array.isArray(R);
      if (Lis || Ris) {
        const len = Math.max(Lis ? L.length : 1, Ris ? R.length : 1);
        const arr = [];
        for (let i = 0; i < len; i++) {
          const li = Lis ? L[i] : L;
          const ri = Ris ? R[i] : R;
          arr.push(binopScalar(node.op, li, ri));
        }
        return arr;
      }
      return binopScalar(node.op, L, R);
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
      } catch { /* frozen prototypes in test env, ignore */ }
      return flat;
    }
    case 'colrange': {
      // Whole-column range:  D:D, $B:$F, Sheet!B:D
      // We don't have row-bounds, so probe rows 1..MAX_PROBE_ROW and trim
      // trailing empties to find the populated extent. MAX_PROBE_ROW=1024
      // matches what real-world analyst sims need and keeps the cost
      // bounded (linear in the column's max-populated row).
      const sheetName = node.sheet || ctx.activeSheet;
      const MAX_PROBE_ROW = 1024;
      const c1 = colLetterToIndex(node.from);
      const c2 = colLetterToIndex(node.to);
      if (c1 < 0 || c2 < 0) return ERR('#REF!');
      const lo = Math.min(c1, c2), hi = Math.max(c1, c2);
      // First pass: find the max populated row across all columns in range.
      let maxRow = 0;
      for (let c = lo; c <= hi; c++) {
        for (let r = 1; r <= MAX_PROBE_ROW; r++) {
          const v = ctx.getCell(sheetName, addrFromIndices(c, r - 1));
          if (v != null && v !== '') maxRow = Math.max(maxRow, r);
        }
      }
      if (maxRow === 0) {
        // Empty column, return empty array so SUMIFS/COUNTIFS yield 0.
        const flat = [];
        try {
          Object.defineProperty(flat, '__range', {
            value: { sheet: sheetName, rows: 0, cols: hi - lo + 1, values2d: [] },
            enumerable: false,
          });
        } catch { /* ignore */ }
        return flat;
      }
      const flat = [];
      const grid = [];
      for (let r = 0; r < maxRow; r++) {
        const row = [];
        for (let c = lo; c <= hi; c++) {
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
      try {
        Object.defineProperty(flat, '__range', {
          value: { sheet: sheetName, rows: maxRow, cols: hi - lo + 1, values2d: grid },
          enumerable: false,
        });
      } catch { /* ignore */ }
      return flat;
    }
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) return ERR('#NAME?');
      // Functions that need *lazy* argument evaluation so they can inspect
      // errors before they propagate (IFERROR/IFNA/IFS/IF) get the raw AST
      // nodes + a thunk-evaluator. Everything else evaluates eagerly and
      // short-circuits on the first error.
      const LAZY = { IFERROR: 1, IFNA: 1, IFS: 1, IF: 1, ISERROR: 1, ISERR: 1, ISNA: 1 };
      if (LAZY[node.name]) {
        const thunks = node.args.map((a) => () => evalAst(a, ctx, visited));
        try {
          return fn(thunks, /* lazy */ true);
        } catch {
          return ERR('#ERROR!');
        }
      }
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

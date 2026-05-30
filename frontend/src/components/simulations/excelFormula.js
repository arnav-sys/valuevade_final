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
      const addrs = expandRange(node.from, node.to);
      return addrs.map((addr) => {
        const v = ctx.getCell(sheetName, addr);
        if (typeof v === 'string' && v.startsWith('=')) {
          return evaluateFormula(v, ctx, visited);
        }
        return v;
      });
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

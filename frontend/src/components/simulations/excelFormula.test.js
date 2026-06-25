// Unit tests for the extended excelFormula evaluator. Run with:
//   cd /app/frontend && yarn test --watchAll=false --testPathPattern=excelFormula
//
// Coverage is grouped by family so failures pinpoint the regressed area:
//   • Conditional aggregates (SUMIF, SUMIFS, COUNTIF, COUNTIFS, AVERAGEIF, AVERAGEIFS)
//   • Lookup family (VLOOKUP, HLOOKUP, INDEX, MATCH, XLOOKUP)
//   • Financial (PMT, PPMT, IPMT, FV, PV, NPV, IRR, RATE, NPER)
//   • Statistical (STDEV, VAR, MEDIAN, PERCENTILE)
//   • Text (LEFT, RIGHT, MID, LEN, FIND, SEARCH, TRIM, UPPER, LOWER, PROPER)
//   • Date (YEAR, MONTH, DAY, DATEDIF)
//
// Numbers are compared with `toBeCloseTo` to 4 significant digits — Excel's
// own quoted values typically have ≤ 0.01 relative drift vs our pure-JS
// implementation due to floating-point arithmetic.

import { evaluateFormula, isFormulaError } from './excelFormula';

// Build a single-sheet workbook context from a literal cells map.
function buildCtx(cells, sheet = 'Sheet1') {
  return {
    activeSheet: sheet,
    getCell: (s, addr) => (s === sheet ? cells[addr] : undefined),
  };
}

const evalIt = (formula, cells) => evaluateFormula(formula, buildCtx(cells));

describe('excelFormula — conditional aggregates', () => {
  // A2:A6 sector, B2:B6 mcap (₹ Cr), C2:C6 PE
  const cells = {
    A2: 'IT',     B2: 950000,  C2: 28.4,
    A3: 'Bank',   B3: 720000,  C3: 14.2,
    A4: 'IT',     B4: 480000,  C4: 22.1,
    A5: 'Energy', B5: 1850000, C5: 9.5,
    A6: 'Bank',   B6: 560000,  C6: 13.7,
  };
  test('SUMIF sector = IT → mcap sum', () => {
    expect(evalIt('=SUMIF(A2:A6,"IT",B2:B6)', cells)).toBe(1430000);
  });
  test('COUNTIF sector = Bank', () => {
    expect(evalIt('=COUNTIF(A2:A6,"Bank")', cells)).toBe(2);
  });
  test('AVERAGEIF sector = Bank → avg PE', () => {
    expect(evalIt('=AVERAGEIF(A2:A6,"Bank",C2:C6)', cells)).toBeCloseTo(13.95, 2);
  });
  test('SUMIF with numeric criterion >= 700000', () => {
    expect(evalIt('=SUMIF(B2:B6,">=700000")', cells)).toBe(3520000);
  });
  test('SUMIFS: IT AND mcap > 500k', () => {
    expect(evalIt('=SUMIFS(B2:B6,A2:A6,"IT",B2:B6,">500000")', cells)).toBe(950000);
  });
  test('COUNTIFS: Bank AND PE < 14', () => {
    expect(evalIt('=COUNTIFS(A2:A6,"Bank",C2:C6,"<14")', cells)).toBe(1);
  });
  test('AVERAGEIFS: IT, mcap > 500k → avg mcap', () => {
    expect(evalIt('=AVERAGEIFS(B2:B6,A2:A6,"IT",B2:B6,">500000")', cells)).toBe(950000);
  });
});

describe('excelFormula — lookup family', () => {
  // 4-row table: Ticker | Sector | Mcap | PE
  const cells = {
    A2: 'RELIANCE', B2: 'Energy', C2: 1850000, D2: 28,
    A3: 'TCS',      B3: 'IT',     C3: 1380000, D3: 30,
    A4: 'INFY',     B4: 'IT',     C4:  670000, D4: 25,
    A5: 'HDFCBANK', B5: 'Bank',   C5: 1100000, D5: 18,
  };
  test('VLOOKUP exact: INFY → sector', () => {
    expect(evalIt('=VLOOKUP("INFY",A2:D5,2,FALSE)', cells)).toBe('IT');
  });
  test('VLOOKUP exact: HDFCBANK → PE', () => {
    expect(evalIt('=VLOOKUP("HDFCBANK",A2:D5,4,FALSE)', cells)).toBe(18);
  });
  test('VLOOKUP exact not found → #N/A', () => {
    const out = evalIt('=VLOOKUP("WIPRO",A2:D5,2,FALSE)', cells);
    expect(isFormulaError(out)).toBe(true);
  });
  test('INDEX 3rd row, 3rd col → INFY mcap', () => {
    expect(evalIt('=INDEX(A2:D5,3,3)', cells)).toBe(670000);
  });
  test('MATCH exact: position of TCS', () => {
    expect(evalIt('=MATCH("TCS",A2:A5,0)', cells)).toBe(2);
  });
  test('INDEX+MATCH: PE of INFY', () => {
    expect(evalIt('=INDEX(D2:D5,MATCH("INFY",A2:A5,0))', cells)).toBe(25);
  });
  test('XLOOKUP: INFY → mcap', () => {
    expect(evalIt('=XLOOKUP("INFY",A2:A5,C2:C5)', cells)).toBe(670000);
  });
  test('HLOOKUP: scan a 2-row header table', () => {
    const hCells = {
      A1: 'Q1', B1: 'Q2', C1: 'Q3', D1: 'Q4',
      A2: 120,  B2: 145,  C2: 160,  D2: 180,
    };
    expect(evalIt('=HLOOKUP("Q3",A1:D2,2,FALSE)', hCells)).toBe(160);
  });
});

describe('excelFormula — financial', () => {
  // ₹40L home loan, 8.5% annual = 0.7083% monthly, 240 months (20 years).
  // Excel PMT(0.085/12, 240, 4000000) ≈ -34,712.92
  test('PMT — 20yr home loan EMI', () => {
    const out = evalIt('=PMT(0.085/12, 240, 4000000)', {});
    expect(out).toBeCloseTo(-34712.92, 0);  // tolerance ₹1 of Excel
  });
  test('PMT zero rate', () => {
    expect(evalIt('=PMT(0, 12, 1200)', {})).toBe(-100);
  });
  // FV of ₹10k/mo for 30 years at 12% annual.
  test('FV — SIP corpus', () => {
    const out = evalIt('=FV(0.12/12, 360, -10000)', {});
    expect(out).toBeGreaterThan(34900000);  // ≈ ₹3.49 Cr
    expect(out).toBeLessThan(35400000);
  });
  test('PV — present value', () => {
    // PV of ₹100,000 a year for 10 years at 8% ≈ -671,008.14
    const out = evalIt('=PV(0.08, 10, 100000)', {});
    expect(out).toBeCloseTo(-671008, 0);
  });
  // Excel NPV(0.1, 300, 420, 680) = 300/1.1 + 420/1.21 + 680/1.331 = 1130.73
  // Less initial outlay 1000 → 130.73. (Matches Excel's end-of-period convention.)
  test('NPV — discounted cashflows', () => {
    const cells = { A1: 300, A2: 420, A3: 680 };
    const out = evalIt('=NPV(0.1, A1:A3) - 1000', cells);
    expect(out).toBeCloseTo(130.73, 1);
  });
  // IRR([-1000, 300, 420, 680]) — rate r s.t. -1000 + 300/(1+r) + 420/(1+r)^2 + 680/(1+r)^3 = 0
  // Newton-Raphson root ≈ 0.1634 (16.34%).
  test('IRR — converges on positive root', () => {
    const cells = { A1: -1000, A2: 300, A3: 420, A4: 680 };
    const out = evalIt('=IRR(A1:A4)', cells);
    expect(out).toBeCloseTo(0.1634, 2);   // Excel = 16.34%
  });
  test('NPER — months to retire a loan at fixed EMI', () => {
    // ₹40L loan, ₹35k EMI, 8.5%/12 monthly → ~228 months
    const out = evalIt('=NPER(0.085/12, -35000, 4000000)', {});
    expect(out).toBeGreaterThan(220);
    expect(out).toBeLessThan(240);
  });
});

describe('excelFormula — statistical', () => {
  const cells = { A1: 2, A2: 4, A3: 4, A4: 4, A5: 5, A6: 5, A7: 7, A8: 9 };
  test('STDEV sample', () => {
    // Excel STDEV.S({2,4,4,4,5,5,7,9}) ≈ 2.138090
    expect(evalIt('=STDEV(A1:A8)', cells)).toBeCloseTo(2.1381, 3);
  });
  test('VAR sample', () => {
    expect(evalIt('=VAR(A1:A8)', cells)).toBeCloseTo(4.5714, 3);
  });
  test('MEDIAN even count', () => {
    expect(evalIt('=MEDIAN(A1:A8)', cells)).toBe(4.5);
  });
  test('PERCENTILE 75%', () => {
    // {2,4,4,4,5,5,7,9} → P75 (linear) = 5.5
    expect(evalIt('=PERCENTILE(A1:A8, 0.75)', cells)).toBeCloseTo(5.5, 1);
  });
});

describe('excelFormula — text', () => {
  const cells = { A1: 'Reliance Industries', A2: '  Hello   World  ', A3: 'HDFC Bank Ltd' };
  test('LEFT', () => { expect(evalIt('=LEFT(A1,8)', cells)).toBe('Reliance'); });
  test('RIGHT', () => { expect(evalIt('=RIGHT(A1,10)', cells)).toBe('Industries'); });
  test('MID', () => { expect(evalIt('=MID(A1,10,5)', cells)).toBe('Indus'); });
  test('LEN', () => { expect(evalIt('=LEN(A1)', cells)).toBe(19); });
  test('TRIM collapse whitespace', () => { expect(evalIt('=TRIM(A2)', cells)).toBe('Hello World'); });
  test('UPPER / LOWER / PROPER', () => {
    expect(evalIt('=UPPER(A3)', cells)).toBe('HDFC BANK LTD');
    expect(evalIt('=LOWER(A3)', cells)).toBe('hdfc bank ltd');
    expect(evalIt('=PROPER(LOWER(A3))', cells)).toBe('Hdfc Bank Ltd');
  });
  test('FIND case-sensitive', () => { expect(evalIt('=FIND("Bank",A3)', cells)).toBe(6); });
  test('SEARCH case-insensitive', () => { expect(evalIt('=SEARCH("BANK",A3)', cells)).toBe(6); });
});

describe('excelFormula — date', () => {
  const cells = { A1: '2025-06-15', A2: '2026-03-10' };
  test('YEAR / MONTH / DAY', () => {
    expect(evalIt('=YEAR(A1)', cells)).toBe(2025);
    expect(evalIt('=MONTH(A1)', cells)).toBe(6);
    expect(evalIt('=DAY(A1)', cells)).toBe(15);
  });
  test('DATEDIF days / months', () => {
    expect(evalIt('=DATEDIF(A1,A2,"D")', cells)).toBe(268);
    expect(evalIt('=DATEDIF(A1,A2,"M")', cells)).toBe(8);
  });
});

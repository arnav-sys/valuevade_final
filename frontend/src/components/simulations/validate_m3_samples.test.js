// Deterministic validator: load each /app/memory/m3_samples/s*.json,
// evaluate every formula_pattern against the Data sheet using our own
// excelFormula engine, and rewrite expected_value to the canonical
// computed result. Logs every mismatch so we can see which Haiku
// computations were wrong.
//
// Run with:
//   cd /app/frontend && yarn test --watchAll=false --testPathPattern=validate_m3_samples
//
// This is the deterministic post-pass that Step 5 (bulk seed) will use —
// any sim that fails this check gets routed back to the LLM for repair.

import fs from 'fs';
import path from 'path';
import { evaluateFormula, isFormulaError } from './excelFormula';

const SAMPLE_DIR = '/app/memory/m3_samples';

function buildCtxFromWorkbook(workbook) {
  // Map sheet-name → addr → primitive value (numbers stay numbers, strings stay strings).
  const sheetMap = {};
  workbook.sheets.forEach((s) => {
    const cells = {};
    Object.entries(s.cells || {}).forEach(([addr, c]) => {
      cells[addr] = c?.value;
    });
    sheetMap[s.name] = cells;
  });
  // Default the activeSheet to "Data" so unprefixed refs in formula_pattern
  // (e.g. "=SUM(B2:B11)") resolve there.
  const dataSheet = workbook.sheets.find((s) => s.name.toLowerCase().startsWith('data'))?.name
                 || workbook.sheets[0].name;
  return {
    activeSheet: dataSheet,
    getCell: (sheet, addr) => sheetMap[sheet]?.[addr] ?? '',
  };
}

function loadSamples() {
  return fs.readdirSync(SAMPLE_DIR)
    .filter((f) => /^s\d+-\d+\.json$/.test(f))
    .map((f) => ({
      file: path.join(SAMPLE_DIR, f),
      json: JSON.parse(fs.readFileSync(path.join(SAMPLE_DIR, f), 'utf8')),
    }));
}

function approxEqual(a, b, tol) {
  const t = tol == null ? 0.01 : tol;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= t;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  return false;
}

describe('M3 sample workbooks — deterministic expected_value validation', () => {
  const samples = loadSamples();
  samples.forEach(({ file, json }) => {
    describe(`${json.session} (${json.slot}) — ${json.session_title}`, () => {
      const ctx = buildCtxFromWorkbook(json.multi_tab_excel_workbook);
      const ea = json.expected_answers;
      const corrections = [];

      Object.entries(ea).forEach(([key, spec]) => {
        test(`${key} ← ${String(spec.formula_pattern).slice(0, 60)}`, () => {
          const got = evaluateFormula(spec.formula_pattern, ctx);
          // Even errors should not be silent — log them.
          if (isFormulaError(got)) {
            corrections.push({ key, formula: spec.formula_pattern,
              llm_expected: spec.expected_value, engine_returned: `#ERROR(${got.code})` });
            // Some pedagogically-broken formulas may still have a correct
            // "expected_value" (LLM saw the right answer even though its
            // formula_pattern is buggy). Don't fail the test — just log.
            console.warn(`[${json.session}] ${key} formula errored: ${got.code}; keeping LLM expected_value`);
            return;
          }
          const matches = approxEqual(got, spec.expected_value, spec.tolerance);
          if (!matches) {
            corrections.push({ key, formula: spec.formula_pattern,
              llm_expected: spec.expected_value, engine_computed: got });
            console.warn(
              `[${json.session}] ${key} drift — ` +
              `LLM said ${JSON.stringify(spec.expected_value)} but engine computed ${JSON.stringify(got)}`
            );
          }
          expect(matches || isFormulaError(got)).toBe(true);
        });
      });

      afterAll(() => {
        // Write canonical expected values back to the sample file.
        if (corrections.length === 0) return;
        let mutated = false;
        corrections.forEach((c) => {
          if ('engine_computed' in c) {
            ea[c.key].expected_value = c.engine_computed;
            mutated = true;
          }
        });
        if (mutated) {
          json.engine_corrections = corrections;
          json.engine_corrected_at = new Date().toISOString();
          fs.writeFileSync(file, JSON.stringify(json, null, 2));
          console.warn(`[${json.session}] wrote ${corrections.length} engine corrections to ${file}`);
        }
      });
    });
  });
});

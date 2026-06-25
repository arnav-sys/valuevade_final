#!/usr/bin/env node
// Node-side engine validator for Excel sims.
//
// Usage:  node validate_excel_sim_node.mjs <path-to-sim.json>
//
// Reads a JSON file with shape:
//   { "multi_tab_excel_workbook": { "sheets": [...] },
//     "expected_answers":         { "Sheet!Addr": {formula_pattern, expected_value, tolerance, type, ...}, ... } }
//
// Evaluates each formula_pattern through the real production `evaluateFormula`
// engine and emits a JSON report to stdout:
//   {
//     "total_questions": N,
//     "corrections":     [ { key, formula, llm_expected, engine_computed }... ]   // numeric drift
//     "errors":          [ { key, formula, code } ]                                // engine error codes
//   }
//
// Each "correction" indicates the engine produced a value DIFFERENT from the
// LLM-claimed expected_value (outside tolerance). The python caller will
// overwrite expected_value with engine_computed to make the sim auto-gradable.
//
// "errors" are formulas the engine refused to evaluate (#VALUE!, #DIV/0!,
// #REF!, #NAME?, etc.) — these usually indicate the LLM emitted a structurally
// broken formula. We surface but don't auto-correct.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// excelFormula.js lives in the frontend tree.
const ENGINE_PATH = '/app/frontend/src/components/simulations/excelFormula.js';
const engineUrl = pathToFileURL(ENGINE_PATH).href;
const { evaluateFormula, isFormulaError } = await import(engineUrl);

function buildCtxFromWorkbook(workbook) {
  const sheetMap = {};
  (workbook.sheets || []).forEach((s) => {
    const cells = {};
    Object.entries(s.cells || {}).forEach(([addr, c]) => {
      cells[addr] = c && typeof c === 'object' ? c.value : c;
    });
    sheetMap[s.name] = cells;
  });
  const dataSheet =
    (workbook.sheets || []).find((s) => s.name.toLowerCase().startsWith('data'))?.name ||
    workbook.sheets?.[0]?.name ||
    'Sheet1';
  return {
    activeSheet: dataSheet,
    getCell: (sheet, addr) => sheetMap[sheet]?.[addr] ?? '',
  };
}

function approxEqual(a, b, tol) {
  const t = tol == null ? 0.01 : Number(tol);
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= t;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  // Tolerant mixed: coerce strings of numbers
  const na = Number(a), nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) <= t;
  return false;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write('Usage: validate_excel_sim_node.mjs <sim.json>\n');
    process.exit(2);
  }
  const raw = fs.readFileSync(file, 'utf8');
  const sim = JSON.parse(raw);
  const wb = sim.multi_tab_excel_workbook;
  const ea = sim.expected_answers || {};
  if (!wb || !Array.isArray(wb.sheets)) {
    process.stdout.write(JSON.stringify({
      total_questions: 0, corrections: [],
      errors: [{ key: '<workbook>', code: 'MISSING', formula: '' }],
    }));
    return;
  }
  const ctx = buildCtxFromWorkbook(wb);
  const corrections = [];
  const errors = [];
  let total = 0;

  for (const [key, spec] of Object.entries(ea)) {
    total += 1;
    const formula = spec?.formula_pattern;
    // Pivot grading entries use a sentinel formula_pattern '<<PIVOT>>' — skip
    // them in the formula engine (they are graded separately via
    // pivotEngine.gradePivotSheet at the SpreadsheetSim layer).
    if (formula === '<<PIVOT>>' || spec?.type === 'pivot') continue;
    if (typeof formula !== 'string' || !formula) {
      errors.push({ key, formula: '', code: 'NO_FORMULA' });
      continue;
    }
    let got;
    try {
      got = evaluateFormula(formula, ctx);
    } catch (e) {
      errors.push({ key, formula, code: `EXCEPT:${(e && e.message) || e}` });
      continue;
    }
    if (isFormulaError(got)) {
      errors.push({ key, formula, code: got.code || '#ERROR!' });
      continue;
    }
    const matches = approxEqual(got, spec.expected_value, spec.tolerance);
    if (!matches) {
      // Don't try to auto-correct text answers when engine produced a number,
      // or vice-versa — those usually mean the formula is conceptually wrong.
      const llmIsNum = typeof spec.expected_value === 'number';
      const gotIsNum = typeof got === 'number';
      if (llmIsNum && gotIsNum) {
        corrections.push({ key, formula, llm_expected: spec.expected_value, engine_computed: got });
      } else if (!llmIsNum && !gotIsNum) {
        corrections.push({ key, formula, llm_expected: spec.expected_value, engine_computed: got });
      } else {
        errors.push({
          key, formula,
          code: `TYPE_MISMATCH(llm=${typeof spec.expected_value} got=${typeof got})`,
          llm_expected: spec.expected_value, engine_computed: got,
        });
      }
    }
  }

  process.stdout.write(JSON.stringify({
    total_questions: total,
    corrections,
    errors,
  }));
}

main();

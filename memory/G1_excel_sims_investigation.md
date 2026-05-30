# G1 — Excel Simulation Investigation (M2–M13)

**Status:** Investigation only — NO FIX applied (per Batch 1 directive).
**Date:** 2026-05-30

## Summary

Excel simulations in M2–M13 render empty in the FE because the seed data for
those modules uses a **different `config` schema** than what
`ExcelSim.jsx` / `ExcelWorkspace.jsx` know how to read. All 68 excel-type sims
across M2–M13 are affected.

## DB-side scan

```text
master_simulations total rows: 171
By sim_type: { decision_making: 43, interactive: 17, excel: 68, ... }
Excel sims with config.tasks[] populated: 0  ← what ExcelSim.jsx expects
Excel sims with NO tasks key in config: 68   ← every excel in M2–M13
```

## Schema mismatch

**What the FE renderer expects (`ExcelSim.jsx`):**

```jsonc
{
  "instructions": "string",
  "starter_grid": {
    "columns": ["A","B","C"],
    "rows": [{"A":1,"B":2,"C":""}, ...]
  },
  "tasks": [
    { "cell": "C2", "expected": 42, "type": "number", "points": 10, "tolerance": 0.01 }
  ]
}
```

If `grid.columns` + `grid.rows` is absent, the component routes to
`ExcelWorkspace.jsx`, which expects an array-of-objects "rows" structure.

**What the actual M2–M13 excel sims contain:**

```jsonc
{
  "firm": "Goldman Sachs",
  "role": "Equity Research Associate",
  "category": "screening | valuation | …",
  "format": "multi_tab_excel_workbook",
  "total_tabs": 4,
  "time_limit_minutes": 45,
  "scoring": { "max_points": 100, "criteria": [...] },
  "raw_data": {
    "Headers": ["Date","Close","Return_Pct","FII_Gross_Buy_Cr", ...],
    "Tab_1": { ... },
    "Tab_2": { ... }
  }
}
```

Neither `tasks[]` nor `grid.columns/rows` is present, so:

1. `ExcelSim.jsx` falls through to `ExcelWorkspace.jsx`.
2. `ExcelWorkspace.jsx` has no handler for `raw_data` or `multi_tab_excel_workbook` —
   `grep raw_data ExcelWorkspace.jsx` returns nothing.
3. Result: empty workspace with no rows, no tasks, no scorable cells.

## What a fix would require

To make these renderable without re-seeding 68 rows, **one** of:

- **Option A — Renderer adapter** (preferred): teach `ExcelWorkspace.jsx` to
  detect the `multi_tab_excel_workbook` shape, build a tabbed grid from
  `raw_data.Tab_N`, and synthesize tasks from `scoring.criteria`. Backwards-
  compatible with existing M1 sims.
- **Option B — Seed-data migration**: write a migration that converts every
  M2–M13 excel sim from the firm/role/raw_data shape into
  `{ instructions, starter_grid: { columns, rows }, tasks: [...] }`. Higher
  effort, risk of losing the multi-tab context, but keeps the FE simple.
- **Option C — New sim_type**: introduce `sim_type='excel_multi_tab'` so the
  renderer routing can be unambiguous. Cleanest long-term but requires routing
  changes in `SessionRunner` + new component.

Recommendation: **Option A** for M2–M13 quick win, then **Option C** as the
proper long-term home for these firm-style case studies.

## Pointers for the implementer (when picked up)

- DB rows: `select id, sim_type, config from master_simulations where sim_type='excel' and config ?| array['raw_data','multi_tab_excel_workbook'];`
- FE files: `/app/frontend/src/components/simulations/ExcelSim.jsx`,
  `/app/frontend/src/components/simulations/ExcelWorkspace.jsx`
- Sample empty sim config seen in DB: `Goldman_Sachs_Equity_Research`-style
  multi-tab packs with `Headers`, `Tab_1`…`Tab_N` keys.

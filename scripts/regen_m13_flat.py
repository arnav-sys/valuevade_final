#!/usr/bin/env python3
"""Targeted regen of M13's 3 flat-DC sims (S13.1, S13.6, S13.16) with
session-specific overrides that force varied Q-types, ramped difficulty
and cell-reference discipline.

Each session gets a bespoke override block appended to EXCEL_PROMPT. If
regen still fails Sonnet ≥4, we KEEP the current version (per user's
non-loop-forever policy) and note it.
"""
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, '/app/scripts')
from bulk_seed_sims import (  # noqa: E402
    EXCEL_PROMPT, INDIAN_CONTEXT, sync_call, parse_json_reply,
    validate_excel, engine_validate_excel, session_slices, LOG_DIR,
)

# ─── session-specific overrides ─────────────────────────────────────────────

OVERRIDE_13_1 = """SESSION-SPECIFIC OVERRIDE (S13.1 The Analyst's Workbench):

Previous version failed Sonnet difficulty_curve = 2. Reason: all 6 questions
were IF(AND(...)) "is the sheet formatted correctly?" sanity checks — same
technique, no ramp, no varied Excel skill exercised.

REQUIRED VARIED QUESTION MIX (6 Qs, must span AT LEAST 4 DIFFERENT
excel skills — pick from the list below, no more than 2 Qs on same skill):
  - SUM / SUMIF / SUMIFS on a Revenue driver range
  - IF / AND / OR nested conditional
  - VLOOKUP / INDEX+MATCH / XLOOKUP on assumptions
  - Named-range dereference (via structured ref like =Assumptions!MarginPct)
  - Simple direct-link across sheets (=Model!D7 or =Assumptions!$B$3)
  - Ratio / percent computation with $-anchored refs

DIFFICULTY RAMP (mandatory, one Q per level, Q6 hardest):
  Q1 (7pt) — direct cell reference across sheets. e.g. =Assumptions!$B$3
  Q2 (10pt) — simple ratio using two cross-sheet refs. e.g. =Model!C5/Model!C4
  Q3 (12pt) — IF() with a business rule. e.g. =IF(Model!D5>0.15,"Above","Below")
  Q4 (15pt) — VLOOKUP / INDEX-MATCH on an Assumptions table
  Q5 (15pt) — SUMIFS with 2 criteria on a Data range
  Q6 (18pt) — Multi-step: nested IF + ratio (e.g. margin bucket assignment)

The session teaches MODEL ARCHITECTURE — colour codes, tab structure,
$ absolute refs, named ranges, freeze panes, workbook flow. Every Q above
lets the student USE that architecture (via cross-sheet refs and named-
range-like patterns) instead of merely observing it. Total 77 points.
"""

OVERRIDE_13_6 = """SESSION-SPECIFIC OVERRIDE (S13.6 WACC):

Previous version failed Sonnet difficulty_curve = 2 because Q5/Q6 produced
NEGATIVE intrinsic values (WACC 12.31% ≈ terminal growth 5%, so denominator
WACC−g was tiny and unstable).

REQUIRED ASSUMPTIONS — must produce a clean, positive, defensible enterprise
value. Use TITAN FY25 illustrative numbers for the running case:
  Risk-free rate:    Rf = 7.10%   (10-yr G-Sec)
  Equity risk prem:  ERP = 6.50%
  Beta (Titan):      β = 0.95     (consumer durables mid-beta)
  Cost of debt:      Kd = 8.20%   (pre-tax; Titan AAA rated)
  Tax rate:          t = 25.17%
  Debt/(D+E):        wd = 15%
  Equity/(D+E):      we = 85%
  Terminal growth:   g = 5.00%    (nominal India long-run)
  FY26E FCFF (₹ Cr): 3800         (Titan illustrative)

CALCULATED WACC = 0.85 × (7.10 + 0.95*6.50) + 0.15 × 8.20 × (1 − 0.2517)
                = 0.85 × 13.275 + 0.15 × 6.1358
                = 11.284 + 0.920 = 12.20%

Gap WACC − g = 12.20 − 5.00 = 7.20% → Gordon growth denominator is a healthy
7.2%, so ANY forecasted FCFF ≥ 1500 Cr yields a comfortably positive
enterprise value.

REQUIRED VARIED QUESTION MIX (6 Qs, must span 4+ different skills):
  Q1 (8pt)  — Cost of equity via CAPM. =Rf + β * ERP
  Q2 (10pt) — After-tax cost of debt. =Kd * (1 − t)
  Q3 (12pt) — WACC formula. =we*Ke + wd*Kd_after_tax
  Q4 (15pt) — Change beta from 0.95 to 1.20 (mini-scenario); recompute WACC
  Q5 (15pt) — Perpetuity value: =FCFF_FY26 * (1+g) / (WACC − g)
  Q6 (15pt) — Nested IF on WACC bucket (Low/Med/High) — VARIED skill
Total 75 points.

VALIDATE before returning: WACC−g must be ≥ 0.05 (500 bps buffer) so
perpetuity value stays sane. Do NOT ship a workbook where numeric values
go negative.
"""

OVERRIDE_13_16 = """SESSION-SPECIFIC OVERRIDE (S13.16 Building a Full LBO Model):

Previous version failed Sonnet difficulty_curve = 2 with the note
"Catastrophically broken expected_answers — formulas reference non-existent
cells (Data!B8, B10, B11, C7, etc. undefined)".

MANDATORY: BEFORE listing any expected_answer formula, the workbook must
DEFINE every cell that formula references. If a formula reads
Data!B8, then the Data sheet MUST contain a Data!B8 cell with a value.
Same for C7, B10, etc. Any missing cell = catastrophic failure.

REQUIRED WORKBOOK PATTERN (3 sheets, all Titan-illustrative LBO):
  Sheet 1: "Sources_Uses"  (rows 1-14)
    - Row 1 header, rows 2-13 the 12 line items
    - USES rows: Purchase EV, Refinance debt, Transaction fees, Cash to
      balance sheet (4 items) → typed values in col C
    - SOURCES rows: New term loan, Mezzanine, Sponsor equity, Rollover equity,
      Cash on hand, Management options (6 items) → typed values in col C
    - Row 14: totals (formula rows validating Sources = Uses)
  Sheet 2: "Model"  (rows 1-14 min)
    - Row 1 header: Year, Revenue, EBITDA, EBITDA margin, D&A, EBIT,
      Interest, PBT, Tax, Net Income, FCF, Debt Beg, Debt End
    - Rows 2-6: FY26E → FY30E (5-year LBO hold)
    - Every cell in this range MUST have a value (either typed or formula)
  Sheet 3: "Assumptions"  (rows 1-11 min)
    - Entry EV/EBITDA multiple, Exit EV/EBITDA multiple, Revenue CAGR,
      EBITDA margin curve, Tax rate, Interest rate on TL, Interest rate on
      Mezz, Cash sweep %, Sponsor equity %, Rollover %, Cost of debt curve
  Sheet 4: "Answers"  (student-graded)

REQUIRED VARIED QUESTIONS (6 Qs, spanning 4+ skills):
  Q1 (8pt)  — Sources = Uses check. =IF(Sources_Uses!C13=Sources_Uses!C7,1,0)
              (or the correct row indices — YOU CHOOSE, but they MUST exist)
  Q2 (10pt) — Sponsor equity as % of total sources. =Sources_Uses!C10/Sources_Uses!C13
  Q3 (12pt) — Exit EV. =Assumptions!$B$3 * Model!F4  (year-5 EBITDA)
  Q4 (12pt) — Exit equity. =Q3_ref − Model!F14  (year-5 debt end)
  Q5 (15pt) — MoM: =(Exit_equity) / Sources_Uses!C10
  Q6 (18pt) — IRR: =IRR({-Sources_Uses!C10, 0, 0, 0, 0, Exit_equity})
              (student uses IRR — engine can pattern-match this)
Total 75 points.

VERIFY BEFORE RETURNING JSON: For every Answers!X formula, WALK the workbook
and confirm every cellref (Sources_Uses!C10, Model!F14, etc.) exists in the
corresponding sheet's cells{} block. If any ref is missing, ADD the cell to
its sheet with a plausible ₹ Cr Titan-illustrative value BEFORE emitting the
JSON.
"""

TARGETS = [
    ('13.1',  OVERRIDE_13_1),
    ('13.6',  OVERRIDE_13_6),
    ('13.16', OVERRIDE_13_16),
]

def build_user_text(title: str, notes: str) -> str:
    return (
        f"SESSION: {title}\n"
        f"Sim type to produce: excel\n\n"
        f"FULL SESSION NOTES:\n---\n{notes}\n---\n\n"
        f"Produce the JSON object now. Return ONLY the JSON."
    )

def regen_one(session_no: str, override: str):
    slices = {s['session_no']: s for s in session_slices(13)}
    slot = slices.get(session_no)
    if not slot:
        raise RuntimeError(f'S{session_no} not found in M13 curriculum')
    sysp = EXCEL_PROMPT + "\n\n" + override
    user_text = build_user_text(slot['title'], slot['notes'])
    last_err = None
    for attempt in range(3):
        try:
            raw = sync_call(sysp, user_text, max_tokens=12000)
            obj = parse_json_reply(raw)
            validate_excel(obj)
            eng = engine_validate_excel(obj)
            errs = eng.get('errors') or []
            if errs:
                last_err = f'engine errors: {errs[:2]}'
                # feed back for next attempt via user_text
                user_text = build_user_text(slot['title'], slot['notes']) + \
                    f"\n\nPREVIOUS ATTEMPT FAILED WITH: {last_err}\nFix and retry."
                time.sleep(1.5)
                continue
            out_path = LOG_DIR / f'm13_s{session_no.replace(".","-")}.json'
            out_path.write_text(json.dumps(obj, ensure_ascii=False, indent=2))
            print(f'  ✓ S{session_no}  regen OK  (eng-fix={len(eng.get("corrections", []))})')
            return obj, eng
        except Exception as e:
            last_err = str(e)
            print(f'  ! S{session_no}  attempt {attempt+1} failed: {last_err[:200]}')
            user_text = build_user_text(slot['title'], slot['notes']) + \
                f"\n\nPREVIOUS ATTEMPT FAILED WITH: {last_err[:300]}\nFix EXACTLY that and retry."
            time.sleep(2)
    print(f'  ✗ S{session_no}  gave up after 3 attempts: {last_err}')
    return None, None


if __name__ == '__main__':
    for sn, ov in TARGETS:
        print(f'\n=== Regenning S{sn} ===')
        regen_one(sn, ov)
    print('\nDone.')

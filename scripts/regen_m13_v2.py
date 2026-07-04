#!/usr/bin/env python3
"""Second-round regen for S13.6 and S13.16 with corrective feedback on the
Sonnet failure points (broken Q values in S13.6; negative exit equity in
S13.16). This is a one-shot polish pass."""
import json, sys, time
from pathlib import Path
sys.path.insert(0, '/app/scripts')
from bulk_seed_sims import (
    EXCEL_PROMPT, sync_call, parse_json_reply,
    validate_excel, engine_validate_excel, session_slices, LOG_DIR,
)

OVERRIDE_13_6_V2 = """SESSION-SPECIFIC OVERRIDE (S13.6 WACC — polish pass):

Previous regen failed Sonnet because:
  - Q4 expected_value came out 6.99 but was described as "recompute WACC
    with beta = 1.20". The correct math is:
        Ke_new  = 7.10 + 1.20*6.50 = 14.90%
        WACC_new = 0.85*14.90 + 0.15*8.20*(1-0.2517)
                 = 12.665 + 0.920 = 13.585%
    So Q4 expected value = 13.58 or 13.59 (percent, as decimal 0.1358).
  - Q6 expected_value = 0 — the LLM's IF bucket returned the wrong output.

Use THESE Titan assumptions (do not change):
  Rf=7.10  ERP=6.50  β=0.95  Kd=8.20  t=25.17  we=0.85  wd=0.15
  g=5.00   FCFF_FY26=3800  β_scenario=1.20
Derive:
  Ke   = Rf + β*ERP = 7.10 + 0.95*6.50 = 13.275%
  Kd_a = Kd*(1-t)   = 8.20*(1-0.2517) = 6.1358%
  WACC = we*Ke + wd*Kd_a = 12.20%
  Ke_new = 7.10 + 1.20*6.50 = 14.90
  WACC_new = 0.85*14.90 + 0.15*6.1358 = 13.585%
  PV_perp = FCFF_FY26 * (1+g) / (WACC - g) = 3800*1.05 / (0.1220-0.05) = 55416.67 Cr

REQUIRED Q MAPPING (6 Qs, total 75pt):
  Q1 (8pt)  =Data!B3 + Data!B5 * Data!B4  → 13.275  [Ke]
  Q2 (10pt) =Data!B6 * (1 - Data!B7)      → 6.1358  [Kd after tax]
  Q3 (12pt) =Data!B9*B1_Q + Data!B8*B2_Q  → 12.20   [WACC, use sheet-qualified refs]
  Q4 (15pt) =Data!B3 + Data!B11 * Data!B4 → 14.90   [Ke_new, β=1.20]
            OR compute WACC_new = 13.585 — pick ONE, put it as expected_value.
  Q5 (15pt) =Data!B12*(1+Data!B10)/(Data!B15-Data!B10)  → 55416.67  [perpetuity]
  Q6 (15pt) =IF(Data!B15<0.10,"Low",IF(Data!B15<0.14,"Medium","High")) → "Medium"
            (WACC=0.1220 → Medium bucket) — expected_value = "Medium"

Every Answers cellref MUST be sheet-qualified. Every referenced Data!Bx MUST
have a value assigned. Do not repeat a value across Qs.
"""

OVERRIDE_13_16_V2 = """SESSION-SPECIFIC OVERRIDE (S13.16 LBO — polish pass):

Previous regen produced Exit Equity = -1211 (impossible — Year-5 Debt > Exit
EV). Fix by scaling Sources correctly so Year-5 Debt does NOT exceed Year-5
Enterprise Value.

Use THESE Titan LBO assumptions (illustrative, coherent):
  Entry EV = 60000 Cr  (Titan FY26 EBITDA 6000 * 10x entry multiple)
  Sources:
    New TL       = 24000 Cr
    Mezzanine    =  6000 Cr
    Sponsor Eq   = 22000 Cr
    Rollover Eq  =  4000 Cr
    Cash on hand =  3000 Cr
    Mgmt Options =  1000 Cr
    TOTAL        = 60000 Cr
  Uses:
    Purchase EV  = 58000 Cr
    Refinance    =   500 Cr
    Fees         =  1000 Cr
    Cash to BS   =   500 Cr
    TOTAL        = 60000 Cr
  Year-5 forecast:
    EBITDA_FY30 = 9500 Cr (5-yr CAGR ~9.6%)
    Debt_FY30_end = 12000 Cr (paid down from 30000 with cash sweep)
    Exit multiple = 11x
    Exit EV = 9500 * 11 = 104500 Cr
    Exit Equity = 104500 - 12000 = 92500 Cr  (POSITIVE)
    MoM = 92500 / 22000 = 4.20x
    IRR = (4.20)^(1/5) - 1 = 33.2%

REQUIRED Q MAPPING (6 Qs, total 75pt) — every ref MUST exist in the workbook:
  Q1 (8pt)  Sources = Uses check.
            =IF(Sources_Uses!C13=Sources_Uses!C7,1,0) → 1
            (C13 = total Sources, C7 = total Uses; both = 60000)
  Q2 (10pt) Sponsor equity share.
            =Sources_Uses!C10 / Sources_Uses!C13 → 0.3667  (22000/60000)
  Q3 (12pt) Exit EV.
            =Assumptions!$B$3 * Model!F4 → 104500  (11 * 9500)
  Q4 (12pt) Exit equity.
            =B3_result - Model!F13 → 92500  (104500 - 12000)
  Q5 (15pt) MoM. =B4_result / Sources_Uses!C10 → 4.20
  Q6 (18pt) IRR. =B5_result^(1/5) - 1 → 0.332  (33.2%)

Every referenced cell (Sources_Uses!C7, C10, C13; Model!F4, F13;
Assumptions!$B$3) MUST be defined in its sheet cells{} block with the
values above.
"""

TARGETS = [
    ('13.6',  OVERRIDE_13_6_V2),
    ('13.16', OVERRIDE_13_16_V2),
]

def build_user_text(title: str, notes: str) -> str:
    return (
        f"SESSION: {title}\nSim type: excel\n\n"
        f"FULL SESSION NOTES:\n---\n{notes}\n---\n\n"
        f"Produce the JSON now. Return ONLY the JSON."
    )

def regen_one(session_no, override):
    slices = {s['session_no']: s for s in session_slices(13)}
    slot = slices[session_no]
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
                user_text = build_user_text(slot['title'], slot['notes']) + \
                    f"\n\nPREVIOUS ATTEMPT FAILED WITH: {last_err}\nFix and retry."
                time.sleep(2)
                continue
            out = LOG_DIR / f'm13_s{session_no.replace(".","-")}.json'
            out.write_text(json.dumps(obj, ensure_ascii=False, indent=2))
            print(f'  ✓ S{session_no}  regen v2 OK  (eng-fix={len(eng.get("corrections", []))})')
            return
        except Exception as e:
            last_err = str(e)
            print(f'  ! S{session_no}  attempt {attempt+1} failed: {last_err[:200]}')
            user_text = build_user_text(slot['title'], slot['notes']) + \
                f"\n\nPREVIOUS ATTEMPT FAILED WITH: {last_err[:300]}\nFix EXACTLY that."
            time.sleep(2)
    print(f'  ✗ S{session_no}  gave up: {last_err}')

if __name__ == '__main__':
    for sn, ov in TARGETS:
        print(f'\n=== Regenning S{sn} v2 ===')
        regen_one(sn, ov)
    print('\nDone.')

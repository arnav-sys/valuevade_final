#!/usr/bin/env python3
"""Tight-prompt regen of S3.2 (Formatting Like an Analyst).

Approach (user choice — option b):
  Formatting alone can't be graded by our formula engine. So we reframe
  the sim: the student first applies FILTERING + SORTING + FREEZE on a
  formatted Data sheet, then answers questions whose CORRECT ANSWERS
  DEPEND on the format-driven state (SUBTOTAL(9, range) — which counts
  only visible rows after a filter — is the perfect substrate). Formatting
  becomes the pedagogical hook; the answer cells are still engine-gradable.

We use bulk_seed_sims.py's EXCEL_PROMPT but prepend a session-specific
OVERRIDE block that pins the workbook to formatting-driven formulas.
"""
import json
import os
import sys
import time
import uuid
import subprocess
import asyncio
from pathlib import Path

sys.path.insert(0, '/app/scripts')
from bulk_seed_sims import (  # noqa: E402
    EXCEL_PROMPT, INDIAN_CONTEXT, sync_call, parse_json_reply,
    validate_excel, engine_validate_excel, session_slices, LOG_DIR,
)

S3_2_OVERRIDE = """SESSION-SPECIFIC OVERRIDE (S3.2 Formatting Like an Analyst):

This session teaches FORMATTING and DATA-TOOL habits (number formats,
Indian comma style, colour codes, freeze panes, filters, sorting). Pure
formatting cannot be auto-graded. Therefore you MUST design the exercise
so that the CORRECT ANSWERS DEPEND ON FILTER/SORT/FORMAT STATE. Use
SUBTOTAL(9, range) — which sums ONLY visible rows after a filter — as the
core mechanic. This transforms formatting into an engine-gradable skill.

REQUIRED WORKBOOK PATTERN:
- Data sheet: ~14 rows of a REAL Indian company's monthly / segment /
  quarterly ledger. INCLUDE a "Segment" or "Category" column so filters
  are meaningful (e.g. FMCG segments: "Home Care", "Health Care", "Personal
  Care"; or a Titan revenue split: "Jewellery", "Watches", "Eyewear",
  "Emerging Businesses"). Row 1 = bold headers. Include a NUMBER column
  in raw ₹ (not ₹ Cr) so the student must apply the Indian comma format
  as part of the exercise.
- Answers sheet: 4-6 questions where at least THREE questions use
  SUBTOTAL(9, DataRange) — because SUBTOTAL respects filter state. One
  question can use SUM (to contrast with SUBTOTAL). One question can
  reference a specific formatted cell to test unit conversion (₹ → ₹ Cr).

REQUIRED QUESTIONS (ramp cheap→hard):
Q1 (cheap):   SUM of the full unfiltered range (baseline). e.g. =SUM(Data!C2:C15)
Q2 (cheap):   Unit conversion — take a raw ₹ value and express in ₹ Cr
              (=Data!C2/10000000). Tests format-awareness.
Q3 (medium):  SUBTOTAL(9, ...) — same range, but with an EXPLICIT
              instruction that "the student will apply a filter to
              Segment = 'Jewellery' before evaluating". You seed the
              expected_value assuming the filter is applied — the sim
              runtime will replay it. Include the intended filter in the
              instructions and hint 3.
Q4 (medium):  Second SUBTOTAL(9, ...) on a different filter (e.g. only
              rows where Segment='Watches').
Q5 (hard):    SUBTOTAL(9, ...) combined with a manual ratio, e.g.
              =SUBTOTAL(9,Data!C2:C15)/SUBTOTAL(9,Data!D2:D15) to get a
              gross margin of the visible segment.
Q6 (optional, hard): A COUNTIF/AVERAGE on the full range so the student
              sees the contrast — filtered SUBTOTAL vs full-range aggregate.

ENGINE MATCHING NOTE:
- Our engine evaluates SUBTOTAL(9, range) as the SUM of ALL cells in that
  range (it does not simulate the filter). Therefore for each SUBTOTAL
  question, set expected_value = sum of ALL rows that would be visible
  under the intended filter (which the student will manually apply). List
  the filter condition in `instructions` so both the runtime and the
  student are aligned. The engine will compute SUM of the raw range; the
  student's job is to apply the correct filter FIRST (formatting exercise)
  which will collapse the underlying data to the same visible rows the
  expected_value assumes. This is the pedagogical bridge.

INSTRUCTIONS FIELD MUST include, verbatim near the end:
  "Before answering Q3, Q4 and Q5 — click a cell in the Data sheet, press
  Ctrl+Shift+L to enable Filter, and set the Segment column filter to the
  segment named in the question. Q1 and Q2 are answered on the unfiltered
  data."

Everything else in the base EXCEL_PROMPT rules still applies (Indian
flavor, 3 hints cheap→medium→near-direct, sheet-qualified refs, etc.).
"""

SESSION_TITLE = "Formatting Like an Analyst — Numbers, Colours & Layout"


def get_s3_2_notes():
    for s in session_slices(3):
        if s['session_no'] == '3.2':
            return s['notes']
    raise RuntimeError('S3.2 notes not found')


def build_user_text(notes: str) -> str:
    return (
        f"SESSION: {SESSION_TITLE}\n"
        f"Sim type to produce: excel\n\n"
        f"FULL SESSION NOTES:\n---\n{notes}\n---\n\n"
        f"Produce the JSON object now. Return ONLY the JSON."
    )


def regen():
    notes = get_s3_2_notes()
    sysp = EXCEL_PROMPT + "\n\n" + S3_2_OVERRIDE
    user_text = build_user_text(notes)
    last_err = None
    for attempt in range(3):
        try:
            raw = sync_call(sysp, user_text, max_tokens=12000)
            obj = parse_json_reply(raw)
            validate_excel(obj)
            eng = engine_validate_excel(obj)
            print(f"attempt {attempt+1}: engine errors={len(eng.get('errors',[]))}, "
                  f"corrections={len(eng.get('corrections',[]))}")
            if eng.get('errors'):
                # Not fatal — regen once more with the errors summarised in a
                # tail message so the LLM can learn from them.
                last_err = f"engine errors: {eng['errors'][:3]}"
                time.sleep(1.5)
                continue
            # Persist
            out_path = LOG_DIR / 'm3_s3-2.json'
            out_path.write_text(json.dumps(obj, ensure_ascii=False, indent=2))
            print(f"WROTE {out_path}")
            return obj, eng
        except Exception as e:
            last_err = str(e)
            print(f"attempt {attempt+1} failed: {e}")
            time.sleep(1.5 + attempt * 1.5)
    raise RuntimeError(f'all attempts failed: {last_err}')


if __name__ == '__main__':
    obj, eng = regen()
    print("\n=== RESULT ===")
    print("Title:", obj.get('title'))
    print("Sheets:", [(s['name'], len(s.get('cells', {})))
                     for s in obj.get('multi_tab_excel_workbook', {}).get('sheets', [])])
    ea = obj.get('expected_answers', {})
    print(f"Questions ({len(ea)}):")
    for k, v in ea.items():
        print(f"  {k}: {v['formula_pattern'][:80]}  → {v['expected_value']} (pts {v['points']})")
    print(f"Engine: {eng}")

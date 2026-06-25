#!/usr/bin/env python3
"""Step 4 — Generate 3 sample M3 Excel sims via Claude Haiku 4.5.

Picks ONE early-M3, ONE mid-M3, ONE late-M3 session (per the user's
"foundational / synthesis / applied" spread directive) from the
curriculum-v2 module-3.md notes and authors a workbook for each.

Output: /app/memory/m3_samples/<session>.json   (full schema-compliant sim)
Plus  : /app/memory/m3_samples/<session>.summary.json (1-line summary + walkthrough)

Schema (excel.v1) — same shape consumed by `excelSimAdapter.js` Shape 0:
{
  "multi_tab_excel_workbook": { "sheets": [{name, cells}] },
  "expected_answers": { "Sheet!Addr": {formula_pattern, expected_value, type, tolerance, points} }
}

NO DB writes happen here. Pure JSON-on-disk so the user can review.
"""
import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path
from datetime import datetime, timezone

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
if not EMERGENT_LLM_KEY:
    # Fallback: read from /app/backend/.env
    env_path = Path('/app/backend/.env')
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith('EMERGENT_LLM_KEY='):
                EMERGENT_LLM_KEY = line.split('=', 1)[1].strip().strip('"')
                break

if not EMERGENT_LLM_KEY:
    print('Missing EMERGENT_LLM_KEY', file=sys.stderr); sys.exit(2)

os.environ['EMERGENT_LLM_KEY'] = EMERGENT_LLM_KEY
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

OUT_DIR = Path('/app/memory/m3_samples')
OUT_DIR.mkdir(exist_ok=True)

M3_MD = Path('/app/memory/curriculum_v2/module-3.md').read_text()

# Session start markers in the markdown. Used to slice each session.
SESSION_HEADERS = list(re.finditer(r'^# SESSION (\d+\.\d+): (.+)$', M3_MD, re.MULTILINE))


def session_notes(num: str) -> tuple[str, str]:
    """Returns (full_title, full_notes_text) for a session number like '3.3'."""
    for i, m in enumerate(SESSION_HEADERS):
        if m.group(1) == num:
            start = m.start()
            end = SESSION_HEADERS[i + 1].start() if i + 1 < len(SESSION_HEADERS) else len(M3_MD)
            return f"{m.group(1)}: {m.group(2)}", M3_MD[start:end]
    raise KeyError(f'session {num} not found')


# ============================================================================
# Prompt — borrowed from populate_excel_sims.py, tightened for sampling.
# ============================================================================
SYSTEM_PROMPT = """You are a senior Indian equity-research analyst designing realistic Excel exercises for finance students.

You will receive ONE session's curriculum notes (hook, concept, deep dive, formula card, mistake card, real-world case, summary, sample quiz/IQ). Your job is to author a JSON workbook that lets a student APPLY the SPECIFIC functions/skills the session teaches — using REAL Indian companies and plausible numbers — and that auto-grades.

OUTPUT — return ONLY a single JSON object (no markdown fences, no preamble) of this exact shape:

{
  "multi_tab_excel_workbook": {
    "sheets": [
      {
        "name": "Data",
        "cells": {
          "A1": {"value": "Company", "readOnly": true, "bold": true},
          "B1": {"value": "Revenue FY25 (₹ Cr)", "readOnly": true, "bold": true},
          "A2": {"value": "Reliance Industries", "readOnly": true},
          "B2": {"value": 869000, "readOnly": true}
          /* ... at LEAST 10 data rows (A2:Bnn or wider). NEVER fewer. ... */
        }
      },
      {
        "name": "Answers",
        "cells": {
          "A1": {"value": "Question", "readOnly": true, "bold": true},
          "B1": {"value": "Your Answer", "readOnly": true, "bold": true},
          "A2": {"value": "Total revenue across all 10 companies (₹ Cr)?", "readOnly": true},
          "B2": {"value": "", "readOnly": false}
          /* ... 4-6 questions, each escalating in difficulty ... */
        }
      }
    ]
  },
  "expected_answers": {
    "Answers!B2": {
      "formula_pattern": "=SUM(Data!B2:B11)",
      "expected_value": 4523000,
      "type": "number",
      "tolerance": 1,
      "points": 15
    }
    /* ... one entry per editable Answers cell ... */
  }
}

HARD RULES — failure on any of these = unusable sim:

1. The Data sheet MUST have at least 10 data rows (rows 2-11+), with row 1 as bold headers. NEVER fewer than 10 real-world rows.
2. Use REAL Indian companies (Reliance, TCS, HDFC Bank, Infosys, Asian Paints, Titan, Bajaj Finance, ICICI Bank, ITC, HUL, Maruti Suzuki, L&T, Tata Steel, Nestle India, Wipro, Adani Ports, Bharti Airtel, SBI, Kotak Mahindra, Sun Pharma, Cipla, Tech Mahindra, Britannia, Dabur, etc.). Use REAL-WORLD-PLAUSIBLE numbers (revenue in ₹ Cr, market caps in ₹ Cr, P/E in normal 10-80 range, prices in INR, growth rates -10% to +50%).
3. The Answers sheet MUST have 4-6 questions, each progressively exercising the SPECIFIC functions named in this session's notes. Column A = question text, Column B = empty editable cell.
4. expected_answers MUST cover EVERY editable cell in Answers. Each entry needs:
   - "formula_pattern": the ideal formula string a student would write (use REAL Excel syntax like "=VLOOKUP(...)", "=INDEX(...,MATCH(...))", "=IFS(...)", etc.)
   - "expected_value": YOU compute it correctly by hand from the Data sheet values above (numbers must actually be right)
   - "type": "number" or "text"
   - "tolerance": absolute tolerance — use 0.01 for percentages/ratios, 1 for ₹Cr integers, 10 for large ₹Cr sums, 0 for text/exact-match
   - "points": integer 10-25 reflecting question difficulty; total 50-100 across the sim
5. Total points across all expected_answers MUST sum to 50-100.
6. Cell addresses use Excel notation (A1, B2, AA1). Sheet names are case-sensitive.
7. Cap: 2 sheets (Data + Answers), max ~15 rows × 7 cols per sheet, total JSON < 6000 tokens.
8. NO comments inside the JSON. NO markdown fences. NO trailing prose.
9. Plain integers/floats for numbers (NEVER strings for numeric data).
10. EVERY question on the Answers sheet MUST actually exercise a function/skill explicitly named in the session notes provided. No off-topic questions. If the session teaches VLOOKUP, every question should use VLOOKUP/INDEX-MATCH/XLOOKUP. If it teaches IF/IFS/AND/OR/IFERROR, every question should use one of those.
11. CRITICAL: Every formula_pattern MUST mathematically yield the expected_value when run against the Data values you wrote. Do the math by hand. Common traps to AVOID:
    - Storing percentages as 18 in the Data sheet but writing a formula `=B*Rate` (where Rate=18) and expecting B*0.18 as the answer — that's a 100x error. Either store the rate as 0.18 OR put the /100 inside the formula_pattern.
    - Writing a formula that multiplies/divides text by a number — that errors. Make sure every cell referenced by an arithmetic formula is numeric.
    - Forgetting that VLOOKUP cannot look LEFT — if the answer column is left of the lookup column, use INDEX-MATCH in formula_pattern.
12. SELF-CHECK every question: trace each formula_pattern through your Data sheet values; verify the result EQUALS the expected_value (within tolerance) before emitting the JSON. If any formula doesn't compute to the expected value, REWRITE it before output.

PEDAGOGY: the sim should feel like a 15-20 minute timed Mumbai broker desk task — pragmatic, India-flavoured, with answers a senior analyst would respect."""


def build_user_text(session_title: str, notes: str) -> str:
    return (
        f"SESSION: {session_title}\n"
        f"MODULE: M3 — Excel Fundamentals for Analysts\n\n"
        f"FULL SESSION NOTES (use these to pick the EXACT functions to drill):\n"
        f"---\n{notes[:14000]}\n---\n\n"
        f"Produce the JSON workbook now. Return ONLY the JSON object — no markdown fences, no preamble."
    )


# ============================================================================
# Validator — same checks as populate_excel_sims.validate_workbook
# ============================================================================
def validate_workbook(obj):
    checks = []
    if not isinstance(obj, dict): raise ValueError('top-level not dict')
    wb = obj.get('multi_tab_excel_workbook')
    if not isinstance(wb, dict): raise ValueError('missing multi_tab_excel_workbook')
    sheets = wb.get('sheets')
    if not isinstance(sheets, list) or len(sheets) < 2:
        raise ValueError(f'need ≥2 sheets, got {len(sheets) if isinstance(sheets, list) else sheets}')
    sheet_names = set()
    for s in sheets:
        if not isinstance(s, dict) or not s.get('name') or not isinstance(s.get('cells'), dict):
            raise ValueError(f'bad sheet shape: {s!r}')
        sheet_names.add(s['name'])
    checks.append(f'sheets ok ({len(sheets)} sheets: {sorted(sheet_names)})')

    # Data sheet row count
    data_sheet = next((s for s in sheets if s['name'].lower().startswith('data')), sheets[0])
    data_rows = set()
    for addr in data_sheet['cells']:
        m = re.match(r'^[A-Z]+(\d+)$', addr)
        if m: data_rows.add(int(m.group(1)))
    max_row = max(data_rows) if data_rows else 0
    if max_row < 11:
        raise ValueError(f'data sheet has only {max_row} rows — need ≥11 (header + 10 data)')
    checks.append(f'data sheet has {max_row} rows ✓')

    # expected_answers
    ea = obj.get('expected_answers') or {}
    if not isinstance(ea, dict) or len(ea) == 0:
        raise ValueError('expected_answers must be non-empty')
    total_pts = 0
    for k, spec in ea.items():
        if '!' not in k: raise ValueError(f'expected_answers key {k!r} missing sheet prefix')
        sname, addr = k.split('!', 1)
        if sname not in sheet_names: raise ValueError(f'{k!r} references unknown sheet')
        if not isinstance(spec, dict): raise ValueError(f'{k!r} spec not dict')
        for req in ('formula_pattern', 'expected_value', 'type', 'tolerance', 'points'):
            if req not in spec: raise ValueError(f'{k!r} missing {req!r}')
        total_pts += int(spec['points'])
    if not (40 <= total_pts <= 120):
        raise ValueError(f'total points {total_pts} outside 40-120 band')
    checks.append(f'{len(ea)} expected answers, {total_pts} total points ✓')

    return checks


# ============================================================================
# LLM call
# ============================================================================
def sync_call(user_text: str) -> str:
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f'm3-sample-{time.time_ns()}',
                system_message=SYSTEM_PROMPT)
        .with_model('anthropic', 'claude-haiku-4-5-20251001')
        .with_params(max_tokens=16000)
    )
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(chat.send_message(UserMessage(text=user_text)))
    finally:
        loop.close()


def parse_json_reply(raw: str) -> dict:
    text = raw.strip()
    if text.startswith('```'):
        text = text.strip('`')
        if text.lstrip().lower().startswith('json'):
            text = text.lstrip()[4:]
        if text.rstrip().endswith('```'):
            text = text.rstrip()[:-3]
        text = text.strip()
    return json.loads(text)


# ============================================================================
# Run
# ============================================================================
SAMPLES = [
    {
        'session': '3.3',
        'slot':    'early',
        'tagline': 'foundational — relative/absolute references, growth %, CAGR',
    },
    {
        'session': '3.5',
        'slot':    'mid',
        'tagline': 'synthesis — IF/IFS/AND/OR funnel logic + IFERROR airbags',
    },
    {
        'session': '3.6',
        'slot':    'late',
        'tagline': 'applied — VLOOKUP, INDEX-MATCH (incl. 2-way), XLOOKUP',
    },
]


async def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='', help='comma-separated session numbers (e.g. 3.3,3.5) to regenerate')
    args = ap.parse_args()
    only = {s.strip() for s in args.only.split(',') if s.strip()}
    summary = []
    targets = [s for s in SAMPLES if not only or s['session'] in only]
    for spec in targets:
        title, notes = session_notes(spec['session'])
        print(f'\n=== Generating {spec["slot"]} sample — Session {title} ===', flush=True)
        user_text = build_user_text(title, notes)
        loop = asyncio.get_event_loop()
        last_err = None
        for attempt in range(3):
            try:
                t0 = time.time()
                reply = await loop.run_in_executor(None, sync_call, user_text)
                obj = parse_json_reply(reply)
                checks = validate_workbook(obj)
                elapsed = time.time() - t0
                # Save full JSON
                fname = OUT_DIR / f's{spec["session"].replace(".", "-")}.json'
                fname.write_text(json.dumps({
                    'session': spec['session'],
                    'session_title': title,
                    'slot': spec['slot'],
                    'tagline': spec['tagline'],
                    'generated_at': datetime.now(timezone.utc).isoformat(),
                    'multi_tab_excel_workbook': obj['multi_tab_excel_workbook'],
                    'expected_answers': obj['expected_answers'],
                }, ensure_ascii=False, indent=2))
                print(f'  ✓ {elapsed:.1f}s — {len(checks)} validator checks passed')
                for c in checks: print(f'    • {c}')
                summary.append({
                    'session': spec['session'], 'slot': spec['slot'], 'title': title,
                    'file': str(fname), 'validator_checks': checks, 'elapsed_s': round(elapsed, 1),
                    'sheets': len(obj['multi_tab_excel_workbook']['sheets']),
                    'expected_count': len(obj['expected_answers']),
                    'total_points': sum(int(v.get('points', 0)) for v in obj['expected_answers'].values()),
                })
                break
            except (ValueError, json.JSONDecodeError) as e:
                last_err = e
                print(f'  ✗ attempt {attempt + 1}: {e}', flush=True)
                await asyncio.sleep(2)
        else:
            print(f'  GAVE UP on {spec["session"]}: {last_err}')
            summary.append({'session': spec['session'], 'error': str(last_err)})

    (OUT_DIR / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print('\n=== SUMMARY ===')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    asyncio.run(main())

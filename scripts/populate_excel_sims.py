#!/usr/bin/env python3
"""STEP-2 bulk-populate every empty Excel sim with realistic Indian-finance
starter data + cell-level expected_answers, written into
`config.multi_tab_excel_workbook` + `config.expected_answers`.

Idempotent — sims with non-null `config.populated_at` are skipped.

Usage:
    python3 populate_excel_sims.py --modules 3              # M3 pilot
    python3 populate_excel_sims.py --modules 2,4,5,7,8,9,10,11,12,13   # all the rest
    python3 populate_excel_sims.py --all                    # everything not yet populated
    python3 populate_excel_sims.py --dry-run                # print what would be done

Per-sim flow:
  1. Skip if config.populated_at present (idempotent).
  2. Build prompt from sim title + module title + task_description + hints +
     spreadsheet_setup + expected_output + indian_market_context (whatever
     prose fields the sim has).
  3. Call claude-haiku-4-5 via Emergent LLM key.
  4. JSON-parse, validate shape, write back via Supabase PATCH.
  5. Log per-sim outcome to /app/scripts/excel_sim_populate_log/*.json.
"""
import argparse
import asyncio
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# ---- env wiring (mirrors enhance_m1_quizzes.py) ----
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://yuadeybycbfqlkdpxbkv.supabase.co').rstrip('/')
SR = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
if not SR or not EMERGENT_LLM_KEY:
    print("Missing SUPABASE_SERVICE_ROLE_KEY or EMERGENT_LLM_KEY in env", file=sys.stderr)
    sys.exit(2)

from emergentintegrations.llm.chat import LlmChat, UserMessage

LOG_DIR = Path('/app/scripts/excel_sim_populate_log')
LOG_DIR.mkdir(exist_ok=True)
SUMMARY_FILE = LOG_DIR / 'summary.json'

# ============================================================================
# Prompt
# ============================================================================
SYSTEM_PROMPT = """You are a senior Indian equity-research analyst designing realistic Excel exercises for finance students.

You will receive ONE simulation's metadata (title, module, task, hints, expected output, etc.). Your job is to produce a JSON workbook the student can manipulate to practise the specific function/skill the session is teaching.

OUTPUT — return ONLY a single JSON object (no markdown fences) of this exact shape:

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
          /* ... at LEAST 10 data rows ... */
        }
      },
      {
        "name": "Answers",
        "cells": {
          "A1": {"value": "Question", "readOnly": true, "bold": true},
          "B1": {"value": "Your Answer", "readOnly": true, "bold": true},
          "A2": {"value": "Total revenue across all 10 companies (₹ Cr)?", "readOnly": true},
          "B2": {"value": "", "readOnly": false}
          /* ... 3-6 questions ... */
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

HARD RULES:
1. The Data sheet MUST have at least 10 data rows (rows 2 through 11+), with row 1 as headers.
2. Use REAL Indian companies (Reliance, TCS, HDFC Bank, Infosys, Asian Paints, Titan, Bajaj Finance, ICICI Bank, ITC, Hindustan Unilever, Maruti Suzuki, Larsen & Toubro, Tata Steel, Nestle India, Wipro, Adani Ports, Bharti Airtel, SBI, Kotak Mahindra, etc.). Use REAL-WORLD-PLAUSIBLE numbers (revenue in ₹ Cr, market caps, P/E ratios in normal ranges, prices in INR).
3. For sessions teaching specific functions (SUMIF / COUNTIF / VLOOKUP / INDEX-MATCH / PMT / IRR / NPV / pivot tables / data cleaning), the Data sheet must give the student something REAL to apply that function to. For a "Data Cleaning" session, deliberately include trailing spaces, mixed-case text, leading apostrophes on numbers, dates as text, etc.
4. The Answers sheet MUST have 3–6 questions, each with a clearly labelled question in column A and a single editable answer cell in column B. Column A is read-only, column B values are empty strings with readOnly:false.
5. expected_answers MUST cover EVERY editable cell in Answers. Each entry has:
   - "formula_pattern": the ideal formula string (e.g., "=SUMIF(Data!C2:C11,\\"IT\\",Data!B2:B11)")
   - "expected_value": the actual numeric or text result (computed by you)
   - "type": "number" or "text"
   - "tolerance": absolute tolerance for numeric matching (use 0.01 for ratios, 1 for ₹Cr values, 10 for ₹crore-scale, etc.)
   - "points": integer 5-25 reflecting difficulty
6. Total points across all expected_answers should sum to 50-100.
7. Cell addresses use Excel notation: A1, B2, AA1, etc. Sheet names are case-sensitive.
8. Cap workbook size at: 3 sheets max, ~15 rows × 7 cols per sheet. Be COMPACT — short header labels, short question wording. The whole JSON must fit within 6000 tokens.
9. NO leading/trailing whitespace in JSON keys. NO comments inside the JSON output. NO markdown code fences.
10. Use plain integers/floats for numbers — NEVER strings for numeric data.

If the session is text-only / data-cleaning / formatting-focused (no numeric answer), expected_answers can include "type":"text" entries with the exact expected cell value.

Make the exercise actually USEFUL — a student should be able to type a formula in B2 of Answers and get a number that matches expected_value when graded."""


# ============================================================================
# Supabase helpers
# ============================================================================
def rest_get(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        'apikey': SR, 'Authorization': f'Bearer {SR}', 'Accept': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def rest_patch(path, body):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(
        url, method='PATCH',
        data=json.dumps(body).encode(),
        headers={
            'apikey': SR, 'Authorization': f'Bearer {SR}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


# ============================================================================
# Validation
# ============================================================================
def validate_workbook(obj):
    """Raise ValueError on any structural issue."""
    if not isinstance(obj, dict):
        raise ValueError(f"top-level not dict: {type(obj).__name__}")
    wb = obj.get('multi_tab_excel_workbook')
    if not isinstance(wb, dict):
        raise ValueError("missing multi_tab_excel_workbook")
    sheets = wb.get('sheets')
    if not isinstance(sheets, list) or len(sheets) < 2:
        raise ValueError(f"sheets must be list with ≥2 entries, got {sheets!r}")
    sheet_names = set()
    data_sheet_row_count = 0
    for s in sheets:
        if not isinstance(s, dict) or not s.get('name') or not isinstance(s.get('cells'), dict):
            raise ValueError(f"sheet shape bad: {s!r}")
        sheet_names.add(s['name'])
        # rough row-count: max numeric row across keys
        max_r = 0
        for addr in s['cells']:
            m = addr
            digits = ''.join(c for c in m if c.isdigit())
            if digits:
                max_r = max(max_r, int(digits))
        if s['name'].lower().startswith('data') or s['name'].lower() in ('sheet1', 'raw'):
            data_sheet_row_count = max(data_sheet_row_count, max_r)
    if data_sheet_row_count < 11:
        # Loose check — at least header + 10 rows somewhere in the data sheet
        pass  # don't fail; some sims (eg data cleaning sketch) might be smaller
    ea = obj.get('expected_answers') or {}
    if not isinstance(ea, dict) or not ea:
        raise ValueError("expected_answers must be a non-empty object")
    for key, spec in ea.items():
        if '!' not in key:
            raise ValueError(f"expected_answers key missing sheet prefix: {key!r}")
        sname = key.split('!', 1)[0]
        if sname not in sheet_names:
            raise ValueError(f"expected_answers key references unknown sheet: {key!r}")
        if not isinstance(spec, dict) or 'expected_value' not in spec:
            raise ValueError(f"expected_answers[{key}] missing expected_value")
    return True


# ============================================================================
# LLM call
# ============================================================================
def sync_call(user_text):
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"excel-sim-{time.time_ns()}",
                system_message=SYSTEM_PROMPT)
        .with_model("anthropic", "claude-haiku-4-5-20251001")
        .with_params(max_tokens=8000)
    )
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(chat.send_message(UserMessage(text=user_text)))
    finally:
        loop.close()


def build_user_text(sim, mod_title):
    cfg = sim.get('config') or {}
    parts = [f"Module: {mod_title}", f"Session simulation title: {sim['title']}"]
    for k in ('task_description', 'spreadsheet_setup', 'expected_output',
              'indian_market_context', 'firm_context', 'brief', 'instructions',
              'prompt', 'difficulty'):
        v = cfg.get(k)
        if v:
            parts.append(f"{k}: {v if isinstance(v, str) else json.dumps(v)[:2000]}")
    hints = cfg.get('hints')
    if isinstance(hints, list) and hints:
        parts.append("hints:\n" + "\n".join(
            f"  - {h if isinstance(h, str) else json.dumps(h)}" for h in hints[:10]))
    parts.append("\nProduce the JSON workbook now. Return ONLY the JSON, no markdown fences.")
    return "\n\n".join(parts)


async def populate_one(sim, mod_title):
    sim_id = sim['id']
    cfg = sim.get('config') or {}
    if cfg.get('populated_at'):
        return {'id': sim_id, 'title': sim['title'], 'status': 'skipped_already_populated'}
    user_text = build_user_text(sim, mod_title)
    loop = asyncio.get_event_loop()
    last_err = None
    raw = ''
    for attempt in range(3):
        try:
            reply = await loop.run_in_executor(None, sync_call, user_text)
            raw = (reply or '').strip()
            text = raw
            if text.startswith('```'):
                text = text.strip('`')
                if text.lstrip().lower().startswith('json'):
                    text = text.lstrip()[4:]
                if text.rstrip().endswith('```'):
                    text = text.rstrip()[:-3]
                text = text.strip()
            obj = json.loads(text)
            validate_workbook(obj)
            # Merge into existing config
            new_cfg = dict(cfg)
            new_cfg['multi_tab_excel_workbook'] = obj['multi_tab_excel_workbook']
            new_cfg['expected_answers'] = obj['expected_answers']
            new_cfg['populated_at'] = datetime.now(timezone.utc).isoformat()
            (LOG_DIR / f"{sim_id}.json").write_text(json.dumps({
                'sim_id': sim_id, 'title': sim['title'],
                'workbook': obj['multi_tab_excel_workbook'],
                'expected_answers': obj['expected_answers'],
            }, ensure_ascii=False, indent=2))
            rest_patch(f"master_simulations?id=eq.{sim_id}", {'config': new_cfg})
            return {'id': sim_id, 'title': sim['title'], 'status': 'populated',
                    'sheets': len(obj['multi_tab_excel_workbook']['sheets']),
                    'expected_cells': len(obj['expected_answers'])}
        except Exception as e:
            last_err = e
            await asyncio.sleep(2 + attempt * 3)
    (LOG_DIR / f"{sim_id}.error.json").write_text(json.dumps({
        'sim_id': sim_id, 'title': sim['title'],
        'error': str(last_err), 'raw_reply': raw[:5000],
    }, ensure_ascii=False, indent=2))
    return {'id': sim_id, 'title': sim['title'], 'status': 'error',
            'error': str(last_err)[:300]}


# ============================================================================
# Main
# ============================================================================
async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--modules', default='', help='comma-separated module order_indexes (e.g. 3 or 2,4,5)')
    ap.add_argument('--all', action='store_true', help='populate every excel sim not yet populated')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--concurrency', type=int, default=3)
    args = ap.parse_args()

    target_orders = set()
    if args.all:
        target_orders = None
    elif args.modules:
        target_orders = {int(x) for x in args.modules.split(',') if x.strip()}
    else:
        print("Pass --modules or --all", file=sys.stderr)
        sys.exit(2)

    modules = rest_get('master_modules?select=id,order_index,title&order=order_index.asc')
    mod_by_id = {m['id']: m for m in modules}

    sessions = rest_get('master_sessions?select=id,module_id,order_index,title,master_simulations(id,sim_type,title,config)&order=order_index.asc&limit=1000')

    targets = []
    for s in sessions:
        mod = mod_by_id.get(s['module_id'])
        if not mod:
            continue
        if target_orders is not None and mod['order_index'] not in target_orders:
            continue
        sims = s.get('master_simulations') or []
        if not isinstance(sims, list):
            sims = [sims]
        for sim in sims:
            if not sim or sim.get('sim_type') != 'excel':
                continue
            targets.append((sim, mod['title'], mod['order_index']))

    print(f"\nTotal Excel sims in scope: {len(targets)}")
    pending = [t for t in targets if not (t[0].get('config') or {}).get('populated_at')]
    print(f"  Already populated (skipped): {len(targets) - len(pending)}")
    print(f"  Pending populate          : {len(pending)}")
    if args.dry_run:
        for sim, mt, mo in pending[:50]:
            print(f"  - M{mo} {sim['id']} {sim['title']}")
        return

    sem = asyncio.Semaphore(args.concurrency)
    results = []
    completed = 0
    total = len(pending)
    t_start = time.time()

    async def run(sim, mt, mo):
        async with sem:
            t0 = time.time()
            r = await populate_one(sim, mt)
            r['module'] = f"M{mo}"
            r['seconds'] = round(time.time() - t0, 1)
            return r

    tasks = [asyncio.create_task(run(sim, mt, mo)) for sim, mt, mo in pending]
    for fut in asyncio.as_completed(tasks):
        r = await fut
        results.append(r)
        completed += 1
        SUMMARY_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2))
        marker = '✓' if r['status'] == 'populated' else ('=' if 'skip' in r['status'] else '✗')
        print(f"[{completed}/{total}] {marker} {r['status']:30s} ({r['seconds']:.1f}s) {r['module']} {r['title'][:60]}", flush=True)
        if r.get('error'):
            print(f"      ↳ {r['error'][:200]}", flush=True)

    by = {}
    for r in results:
        by[r['status']] = by.get(r['status'], 0) + 1
    print(f"\nElapsed: {time.time() - t_start:.0f}s")
    print(f"SUMMARY: {by}")


if __name__ == '__main__':
    asyncio.run(main())

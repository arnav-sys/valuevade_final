#!/usr/bin/env python3
"""
Regenerate every Excel simulation with a much SIMPLER exercise:
  - 5-row tiny data table (single sheet 'Data')
  - Plain-English instructions embedded in the workbook
  - 2-3 tiny guided steps (2-3 editable Answer cells)
  - Small numbers so a student can mentally verify

Runs on ALL sims where sim_type='excel'. NOT idempotent — always regenerates.

Usage:
    python3 simplify_excel_sims.py --dry-run
    python3 simplify_excel_sims.py --limit 5
    python3 simplify_excel_sims.py            # run for all 79
"""
import argparse
import asyncio
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

SUPABASE_URL = os.environ.get('REACT_APP_SUPABASE_URL', '').rstrip('/')
SR = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
if not SUPABASE_URL or not SR or not EMERGENT_LLM_KEY:
    print('Missing SUPABASE URL / service role / EMERGENT_LLM_KEY in env', file=sys.stderr)
    sys.exit(2)

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

LOG_DIR = Path('/app/scripts/excel_sim_simplify_log')
LOG_DIR.mkdir(exist_ok=True)
SUMMARY_FILE = LOG_DIR / 'summary.json'

SYSTEM_PROMPT = """You are designing DEAD-SIMPLE Excel exercises for finance students seeing this function for the FIRST time.

You will receive a session title, module title, and the current (too-complex) exercise. Your job: produce a MUCH easier replacement exercise the student can finish in 2 MINUTES.

OUTPUT: return ONLY a single JSON object (no markdown fences) of this exact shape:

{
  "multi_tab_excel_workbook": {
    "sheets": [
      {
        "name": "Data",
        "cells": {
          "A1": {"value": "Company", "readOnly": true, "bold": true},
          "B1": {"value": "Revenue", "readOnly": true, "bold": true},
          "A2": {"value": "TCS", "readOnly": true},
          "B2": {"value": 100, "readOnly": true}
          /* EXACTLY 5 data rows: A2-A6, B2-B6 */
        }
      },
      {
        "name": "Answers",
        "cells": {
          "A1": {"value": "Instructions", "readOnly": true, "bold": true},
          "A2": {"value": "Step 1: In B4 below, type =SUM(Data!B2:B6) then press Enter.", "readOnly": true},
          "A3": {"value": "Step 2: In B5, type =AVERAGE(Data!B2:B6) then press Enter.", "readOnly": true},
          "A4": {"value": "Total revenue:", "readOnly": true, "bold": true},
          "B4": {"value": "", "readOnly": false},
          "A5": {"value": "Average revenue:", "readOnly": true, "bold": true},
          "B5": {"value": "", "readOnly": false}
        }
      }
    ]
  },
  "expected_answers": {
    "Answers!B4": {
      "formula_pattern": "=SUM(Data!B2:B6)",
      "expected_value": 500,
      "type": "number",
      "tolerance": 1,
      "points": 25
    },
    "Answers!B5": {
      "formula_pattern": "=AVERAGE(Data!B2:B6)",
      "expected_value": 100,
      "type": "number",
      "tolerance": 1,
      "points": 25
    }
  }
}

HARD RULES — DEAD SIMPLE:
1. Data sheet: EXACTLY 5 data rows (rows 2-6). Row 1 is 2-3 short headers. Column widths must be small.
2. Numbers must be TINY and ROUND — under 1000, ideally under 200. Use whole numbers unless the concept demands decimals (like ratios). NO ₹Cr amounts, NO market caps. Think "TCS = 100, Infosys = 90, Wipro = 80" style.
3. Answers sheet: EXACTLY 2 or 3 editable cells (B4, B5, optionally B6). Column A holds short instruction/label text (readOnly).
4. Each instruction in column A must be a SINGLE plain-English sentence, MAX 15 words, telling the student EXACTLY which cell to click and what formula to type. Example: "Step 1: In B4 below, type =SUM(Data!B2:B6) then press Enter."
5. Every editable Answers cell must appear in expected_answers with formula_pattern (the exact formula the student was told to type), expected_value (integer/float the formula produces), type, tolerance (1 for integers, 0.1 for decimals), and points (20-40 each so total = 50-100).
6. Tailor the exercise to the SPECIFIC function/concept the session teaches (e.g., VLOOKUP session must exercise VLOOKUP; SUMIF session must exercise SUMIF). Do NOT dodge the function by using SUM.
7. Use REAL Indian company names (TCS, Infosys, HDFC Bank, Reliance, Titan, etc.) — but keep the exercise's DATA tiny and easy.
8. Cell addresses use standard Excel notation (A1, B2). Sheet names are case-sensitive.
9. NEVER wrap numbers in quotes. Use plain integers/floats.
10. NO markdown fences. NO comments inside JSON. Output raw JSON only.

Design principle: A student who has NEVER used this function should be able to read the instruction, type the exact formula shown, and get a green tick. First success → confidence → learning.
"""


def rest_get(path):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={'apikey': SR, 'Authorization': f'Bearer {SR}', 'Accept': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def rest_patch(path, body):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}", method='PATCH',
        data=json.dumps(body).encode(),
        headers={
            'apikey': SR, 'Authorization': f'Bearer {SR}',
            'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def validate(obj):
    if not isinstance(obj, dict):
        raise ValueError('top-level not dict')
    wb = obj.get('multi_tab_excel_workbook')
    if not isinstance(wb, dict):
        raise ValueError('missing multi_tab_excel_workbook')
    sheets = wb.get('sheets') or []
    if not isinstance(sheets, list) or len(sheets) < 2:
        raise ValueError('need >=2 sheets')
    sheet_names = {s.get('name') for s in sheets if isinstance(s, dict) and s.get('name')}
    ea = obj.get('expected_answers')
    if not isinstance(ea, dict) or not ea:
        raise ValueError('expected_answers must be a non-empty dict')
    for key, spec in ea.items():
        if '!' not in key:
            raise ValueError(f'bad answer key: {key}')
        sname = key.split('!', 1)[0]
        if sname not in sheet_names:
            raise ValueError(f'answer key {key} references missing sheet (have {sheet_names})')
        if not isinstance(spec, dict):
            raise ValueError(f'answer spec must be dict at {key}')
        for req_key in ('expected_value', 'type', 'points'):
            if req_key not in spec:
                raise ValueError(f'missing {req_key} at {key}')
    if len(ea) < 2 or len(ea) > 4:
        raise ValueError(f'expected 2-4 answer cells, got {len(ea)}')
    return True


def sync_call(user_text):
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f'simplify-{time.time_ns()}',
                system_message=SYSTEM_PROMPT)
        .with_model('anthropic', 'claude-sonnet-4-5-20250929')
        .with_params(max_tokens=8000)
    )
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(chat.send_message(UserMessage(text=user_text)))
    finally:
        loop.close()


def build_user_text(sim, mod_title, session_title):
    cfg = sim.get('config') or {}
    parts = [
        f'Module: {mod_title}',
        f'Session: {session_title}',
        f'Simulation title: {sim["title"]}',
    ]
    for k in ('task_description', 'learning_objective', 'indian_market_context',
              'brief', 'instructions', 'prompt'):
        v = cfg.get(k)
        if v:
            snippet = v if isinstance(v, str) else json.dumps(v)
            parts.append(f'{k}: {snippet[:800]}')
    hints = cfg.get('hints')
    if isinstance(hints, list) and hints:
        parts.append('hints: ' + ' | '.join(str(h)[:100] for h in hints[:4]))
    parts.append(
        'Design a DEAD-SIMPLE 2-3-step exercise for this session. '
        'Return ONLY the JSON. No markdown.'
    )
    return '\n\n'.join(parts)


async def simplify_one(sim, mod_title, session_title):
    sim_id = sim['id']
    user_text = build_user_text(sim, mod_title, session_title)
    loop = asyncio.get_event_loop()
    last_err = None
    raw = ''
    for attempt in range(3):
        try:
            reply = await loop.run_in_executor(None, sync_call, user_text)
            raw = (reply or '').strip()
            text = raw
            if text.startswith('```'):
                text = text.strip('`').lstrip()
                if text.lower().startswith('json'):
                    text = text[4:]
                if text.rstrip().endswith('```'):
                    text = text.rstrip()[:-3]
                text = text.strip()
            obj = json.loads(text)
            validate(obj)
            cfg = sim.get('config') or {}
            new_cfg = dict(cfg)
            new_cfg['multi_tab_excel_workbook'] = obj['multi_tab_excel_workbook']
            new_cfg['expected_answers'] = obj['expected_answers']
            new_cfg['simplified_at'] = datetime.now(timezone.utc).isoformat()
            (LOG_DIR / f'{sim_id}.json').write_text(
                json.dumps(obj, ensure_ascii=False, indent=2))
            rest_patch(f'master_simulations?id=eq.{sim_id}', {'config': new_cfg})
            return {
                'id': sim_id,
                'title': sim['title'],
                'status': 'ok',
                'answers': len(obj['expected_answers']),
            }
        except Exception as e:
            last_err = e
            await asyncio.sleep(2 + attempt * 3)
    (LOG_DIR / f'{sim_id}.error.json').write_text(
        json.dumps({'sim_id': sim_id, 'title': sim['title'],
                    'error': str(last_err), 'raw': raw[:4000]},
                   ensure_ascii=False, indent=2))
    return {'id': sim_id, 'title': sim['title'], 'status': 'error',
            'error': str(last_err)[:200]}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--limit', type=int, default=None)
    ap.add_argument('--concurrency', type=int, default=3)
    args = ap.parse_args()

    print('Fetching all sessions + modules …')
    modules = rest_get('master_modules?select=id,order_index,title&order=order_index.asc')
    mod_by_id = {m['id']: m for m in modules}
    sessions = rest_get('master_sessions?select=id,module_id,order_index,title,master_simulations(id,sim_type,title,config)&order=order_index.asc&limit=1000')

    targets = []
    for s in sessions:
        mod = mod_by_id.get(s['module_id'])
        if not mod:
            continue
        sims = s.get('master_simulations') or []
        if not isinstance(sims, list):
            sims = [sims]
        for sim in sims:
            if not sim or sim.get('sim_type') != 'excel':
                continue
            targets.append((sim, mod['title'], s['title'], mod['order_index']))

    if args.limit:
        targets = targets[:args.limit]
    print(f'Excel sims to simplify: {len(targets)}')
    if args.dry_run:
        for sim, mt, st, mo in targets[:20]:
            print(f'  - M{mo} {sim["title"][:70]}')
        return

    sem = asyncio.Semaphore(args.concurrency)
    results = []
    t_start = time.time()

    async def run(sim, mt, st, mo):
        async with sem:
            t0 = time.time()
            r = await simplify_one(sim, mt, st)
            r['module'] = f'M{mo}'
            r['seconds'] = round(time.time() - t0, 1)
            return r

    tasks = [asyncio.create_task(run(*t)) for t in targets]
    completed = 0
    total = len(tasks)
    for fut in asyncio.as_completed(tasks):
        r = await fut
        results.append(r)
        completed += 1
        SUMMARY_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2))
        mark = '✓' if r['status'] == 'ok' else '✗'
        print(f'[{completed}/{total}] {mark} {r["module"]:>4s} {r["seconds"]:>5.1f}s  {r["title"][:60]}', flush=True)
        if r.get('error'):
            print(f'      ↳ {r["error"][:180]}', flush=True)

    by = {}
    for r in results:
        by[r['status']] = by.get(r['status'], 0) + 1
    print(f'\nElapsed: {time.time() - t_start:.0f}s')
    print(f'SUMMARY: {by}')


if __name__ == '__main__':
    asyncio.run(main())

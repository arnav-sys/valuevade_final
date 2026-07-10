#!/usr/bin/env python3
"""
MVP 2.0 Part A — Auto-detect sessions missing simulations and generate one for each.

Flow:
  1. Query Supabase (master_sessions, master_simulations, master_modules).
  2. Find sessions with NO simulation.
  3. Classify each into: decision_making | book | excel (via topic heuristic + LLM fallback).
  4. Generate simulation content via Claude Sonnet 4.5.
  5. Insert a new master_simulations row per session.

Usage:
  python3 /app/scripts/generate_missing_sims.py            # audit only
  python3 /app/scripts/generate_missing_sims.py --run      # actually generate + insert
  python3 /app/scripts/generate_missing_sims.py --run --limit 5   # smoke-test 5 sims first
  python3 /app/scripts/generate_missing_sims.py --run --module M12  # single module

Idempotent: skips sessions that already have a simulation row.
"""
import argparse, asyncio, json, os, sys, re, time
from pathlib import Path
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / 'backend' / '.env')

SB_URL = os.environ.get('REACT_APP_SUPABASE_URL', 'https://yuadeybycbfqlkdpxbkv.supabase.co')
SB_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

if not SB_KEY:
    print('ERROR: SUPABASE_SERVICE_ROLE_KEY not set in /app/backend/.env', file=sys.stderr)
    sys.exit(1)
if not EMERGENT_LLM_KEY:
    print('ERROR: EMERGENT_LLM_KEY not set in /app/backend/.env', file=sys.stderr)
    sys.exit(1)

SB_HEADERS = {
    'apikey': SB_KEY,
    'Authorization': f'Bearer {SB_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}

# ---------- Topic classifier (heuristic) ----------
DECISION_KEYWORDS = [
    'strategy', 'leadership', 'negotiation', 'ethics', 'prioritization', 'prioritisation',
    'judgement', 'judgment', 'decision', 'management quality', 'governance', 'presenting',
    'pitch', 'thesis', 'stock pitch', 'career', 'interview', 'confidence', 'communication',
    'networking', 'referral', 'debiasing', 'behav', 'bias', 'sector rotation', 'target price',
    'synthesis', 'reasoning', 'thinking', 'inversion', 'mental model', 'signal', 'noise',
    'first principle', 'workflow', 'automation', 'agents', 'productivity', 'analyst mind',
    'operating system', 'edge', 'pitfall', 'macro', 'fit', 'hr round', 'salary', 'defending',
    'saying no', 'boundaries', 'assertiveness', 'conflict', 'active listening', 'empathy',
    'emotional intelligence', 'group discussion', 'leadership presence',
]
EXCEL_KEYWORDS = [
    'excel', 'spreadsheet', 'model', 'modelling', 'modeling', 'dcf', 'wacc', 'valuation',
    'multiples', 'ratio', 'ratios', 'forecast', 'budget', 'sensitivity', 'scenario',
    'formula', 'lookup', 'vlookup', 'sumif', 'pivot', 'metric', 'analytics', 'quantitative',
    'compute', 'calculation', 'roe', 'roa', 'roic', 'roce', 'nim', 'casa', 'margin',
    'sales analysis', 'return', 'volume', 'utilisation', 'capital budgeting', 'npv', 'irr',
    'discount', 'terminal value', 'fcf', 'dupont', 'liquidity', 'solvency', 'working capital',
    'financial modelling', 'financial modeling', 'fmva', 'three-statement', '3-statement',
    'dashboard', 'chart pack', 'monte carlo', 'stress test', 'monte-carlo', 'automate',
    'sensitivity table', 'index', 'gdp', 'inflation', 'currency', 'interest rates',
    'sector', 'sales', 'earnings', 'sensitivity',
]
BOOK_KEYWORDS = [
    'concept', 'theory', 'framework', 'principles', 'reading', 'case study', 'storytelling',
    'anatomy', 'structure', 'foundation', 'definition', 'terminology', 'introduction to',
    'explaining', 'explained', 'philosophy', 'landscape', 'chapter', 'story', 'primer',
    'overview', 'context', 'psychology', 'bubbles', 'crashes', 'ai 101', 'inside the machine',
    'prompt engineering', 'prompt library', 'grounding', 'guardrails',
]

def classify_topic(title: str, description: str, module_title: str) -> str:
    """Return one of 'excel', 'decision_making', 'book'."""
    txt = f"{title} {description or ''} {module_title or ''}".lower()

    # Score each type by keyword hits
    scores = {'excel': 0, 'decision_making': 0, 'book': 0}
    for kw in EXCEL_KEYWORDS:
        if kw in txt: scores['excel'] += 2 if len(kw) > 6 else 1
    for kw in DECISION_KEYWORDS:
        if kw in txt: scores['decision_making'] += 2 if len(kw) > 6 else 1
    for kw in BOOK_KEYWORDS:
        if kw in txt: scores['book'] += 2 if len(kw) > 6 else 1

    # Tiebreaker: if excel score is meaningful, prefer excel (data/quant-heavy)
    if scores['excel'] >= 2 and scores['excel'] >= scores['decision_making']:
        return 'excel'
    if scores['decision_making'] >= scores['book']:
        return 'decision_making'
    return 'book'

# ---------- Supabase helpers ----------
def sb_get(path: str) -> list:
    r = requests.get(f'{SB_URL}/rest/v1/{path}', headers={**SB_HEADERS, 'Range': '0-1999'}, timeout=30)
    r.raise_for_status()
    return r.json()

def sb_post(path: str, body: dict) -> dict:
    r = requests.post(f'{SB_URL}/rest/v1/{path}', headers=SB_HEADERS, json=body, timeout=30)
    if r.status_code >= 300:
        print(f'  Supabase error [{r.status_code}]: {r.text[:300]}', file=sys.stderr)
        r.raise_for_status()
    j = r.json()
    return j[0] if isinstance(j, list) and j else j

# ---------- LLM content generation ----------
def _build_llm_chat(system_prompt: str, session_id: str):
    from emergentintegrations.llm.chat import LlmChat
    return (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system_prompt)
        .with_model('anthropic', 'claude-sonnet-4-5-20250929')
    )

async def _generate_json(system_prompt: str, user_prompt: str, session_id: str, retries: int = 2) -> dict:
    from emergentintegrations.llm.chat import UserMessage, TextDelta, StreamDone
    for attempt in range(retries + 1):
        try:
            chat = _build_llm_chat(system_prompt, session_id)
            chunks = []
            async for ev in chat.stream_message(UserMessage(text=user_prompt)):
                if isinstance(ev, TextDelta): chunks.append(ev.content)
                elif isinstance(ev, StreamDone): break
            raw = ''.join(chunks).strip()
            # Extract JSON block (Claude often wraps in ```json)
            m = re.search(r'```json\s*(.+?)\s*```', raw, re.DOTALL)
            if m: raw = m.group(1).strip()
            else:
                m = re.search(r'```\s*(.+?)\s*```', raw, re.DOTALL)
                if m: raw = m.group(1).strip()
            # Find outermost JSON object
            first = raw.find('{'); last = raw.rfind('}')
            if first != -1 and last != -1: raw = raw[first:last + 1]
            return json.loads(raw)
        except (json.JSONDecodeError, Exception) as e:
            if attempt >= retries:
                print(f'  LLM JSON parse failed after {retries + 1} tries: {e}', file=sys.stderr)
                raise
            print(f'  LLM retry {attempt + 1}: {e}', file=sys.stderr)
            await asyncio.sleep(1.5)

# ---------- Simulation generators ----------
def _system_prompt_decision() -> str:
    return (
        'You author interactive decision-making simulations for a finance/equity-research learning platform. '
        'Given a session topic, produce a branching scenario with 3-5 decision points. Each decision has 2-4 '
        'options; each option has a label, description, consequence text, and score_impact (dict of dimension → int). '
        'The FINAL option in the last decision must set is_terminal=true (no next_decision).'
        '\n\nRespond ONLY with strict JSON in this exact shape:'
        '\n{'
        '\n  "title": "Short punchy title",'
        '\n  "scenario_context": "2-4 sentence brief that sets the stage (firm, role, situation)",'
        '\n  "initial_data": { "Portfolio Size": "₹500 Cr", "Time Horizon": "3 years" },'
        '\n  "decision_points": ['
        '\n    { "id":"d1","title":"Decision 1","narrative":"What do you do?",'
        '\n      "options":['
        '\n        {"id":"A","label":"Buy aggressively","description":"...","consequence":"...",'
        '\n         "score_impact":{"quality":3,"risk":-1},"next_decision":"d2","is_terminal":false},'
        '\n        {"id":"B","label":"Wait for clarity","description":"...","consequence":"...",'
        '\n         "score_impact":{"quality":1,"risk":1},"next_decision":"d2","is_terminal":false}'
        '\n      ]},'
        '\n    { "id":"d2","title":"Decision 2","narrative":"...","options":['
        '\n      {"id":"A","label":"...","description":"...","consequence":"...",'
        '\n       "score_impact":{"quality":2},"is_terminal":true},'
        '\n      {"id":"B","label":"...","description":"...","consequence":"...",'
        '\n       "score_impact":{"quality":-2},"is_terminal":true}'
        '\n    ]}'
        '\n  ],'
        '\n  "objectives": ["...", "..."],'
        '\n  "scoring": {'
        '\n    "max_total": 10,'
        '\n    "outcome_mapping": ['
        '\n      {"min_total":-99,"label":"Poor Judgement","narrative":"You leaned too heavily on..."},'
        '\n      {"min_total":3,"label":"Solid Analyst","narrative":"You balanced..."},'
        '\n      {"min_total":6,"label":"Sharp Judgement","narrative":"You nailed..."}'
        '\n    ]'
        '\n  }'
        '\n}'
    )

def _system_prompt_book() -> str:
    return (
        'You author chaptered read-through simulations for a finance/equity-research learning platform. '
        'Each simulation has 3-4 short chapters. Each chapter has: (a) content (200-350 words of clear, '
        'analyst-grade prose with concrete Indian-market examples where relevant), (b) a reflection prompt '
        'with 2-3 key insights, (c) a checkpoint MCQ with 4 options and an explanation.'
        '\n\nRespond ONLY with strict JSON in this exact shape:'
        '\n{'
        '\n  "title": "...",'
        '\n  "summary": "2-3 sentence intro",'
        '\n  "chapters": ['
        '\n    { "title": "Chapter 1 — ...", "content": "300-word prose...",'
        '\n      "reflection": { "prompt": "In 2-3 sentences...", "key_insights": ["...","..."] },'
        '\n      "checkpoint": { "question": "...", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "..." } },'
        '\n    ...'
        '\n  ],'
        '\n  "final_reflection": "Wrap-up prompt"'
        '\n}'
    )

def _system_prompt_excel() -> str:
    return (
        'You author Excel simulations for a finance/equity-research learning platform. '
        'The student is given a small realistic dataset (5-12 rows) and must produce specific formula-based '
        'answers on an "Answers" sheet. Focus on: SUM, AVERAGE, MIN, MAX, COUNT, IF, VLOOKUP, ROUND, CONCAT, '
        'basic arithmetic. Use REAL Indian companies where relevant (Reliance, TCS, HDFC Bank, Infosys, '
        'Asian Paints, Titan, Hindustan Unilever, ITC, ICICI Bank, Larsen & Toubro, etc.).'
        '\n\nRespond ONLY with strict JSON in this exact shape:'
        '\n{'
        '\n  "title": "Short task title",'
        '\n  "instructions": "1-3 sentence brief",'
        '\n  "objectives": ["...", "..."],'
        '\n  "multi_tab_excel_workbook": {'
        '\n    "sheets": ['
        '\n      { "name": "Data", "cells": {'
        '\n        "A1": {"value":"Company","readOnly":true},'
        '\n        "B1": {"value":"Revenue_Cr","readOnly":true},'
        '\n        "A2": {"value":"Reliance","readOnly":true},'
        '\n        "B2": {"value":875000,"readOnly":true}'
        '\n      }},'
        '\n      { "name": "Answers", "cells": {'
        '\n        "A1": {"value":"Task","readOnly":true},'
        '\n        "A2": {"value":"Total Revenue (Cr)","readOnly":true},'
        '\n        "B2": {"value":"","readOnly":false,"label":"=SUM(Data!B2:B11)"}'
        '\n      }}'
        '\n    ]'
        '\n  },'
        '\n  "expected_answers": {'
        '\n    "Answers!B2": { "formula_pattern": "=SUM(Data!B2:B11)", "expected_value": 1234567,'
        '\n                     "type":"number", "tolerance":0.5, "points":20 }'
        '\n  }'
        '\n}'
        '\n\nCRITICAL: The "expected_value" MUST be the numerically correct answer given the "Data" sheet cells. '
        'Compute the expected_value yourself while designing the data. Data sheet must have >=5 data rows (starting row 2). '
        'Answers sheet must have 3-6 tasks. Keep totals to <2 sheets and <30 total cells.'
    )

async def generate_sim_content(sim_type: str, session: dict, module_title: str, session_id: str) -> dict:
    title = session.get('title', '')
    desc = session.get('description', '')[:600] if session.get('description') else ''
    objs = session.get('learning_objectives', '') or ''
    if isinstance(objs, list): objs = '; '.join(str(o) for o in objs)

    user_prompt = (
        f'Module: {module_title}\n'
        f'Session title: {title}\n'
        f'Session description: {desc}\n'
        f'Learning objectives: {str(objs)[:300]}\n\n'
        f'Author a {sim_type.replace("_", "-")} simulation for this session. '
        'Ground it in real equity-research / financial-modelling analyst work. Return ONLY the JSON.'
    )
    if sim_type == 'decision_making':
        return await _generate_json(_system_prompt_decision(), user_prompt, session_id)
    if sim_type == 'book':
        return await _generate_json(_system_prompt_book(), user_prompt, session_id)
    if sim_type == 'excel':
        return await _generate_json(_system_prompt_excel(), user_prompt, session_id)
    raise ValueError(f'Unknown sim_type: {sim_type}')

# ---------- Main audit + generate ----------
async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', action='store_true', help='Actually generate and insert (default is dry-run audit).')
    ap.add_argument('--limit', type=int, default=None, help='Limit how many sims to generate.')
    ap.add_argument('--module', type=str, default=None, help='Only process a specific module (e.g., "M12").')
    ap.add_argument('--only-type', type=str, default=None, choices=['excel', 'decision_making', 'book'])
    args = ap.parse_args()

    print('Fetching sessions, sims, and modules...')
    sessions = sb_get('master_sessions?select=id,title,description,module_id,order_index,learning_objectives')
    sims = sb_get('master_simulations?select=session_id,sim_type')
    modules = {m['id']: m for m in sb_get('master_modules?select=id,module_number,title')}
    sim_session_ids = {s['session_id'] for s in sims}

    missing = [s for s in sessions if s['id'] not in sim_session_ids]
    print(f'\nTotal sessions: {len(sessions)}')
    print(f'Sessions with simulations: {len(sessions) - len(missing)}')
    print(f'Sessions WITHOUT simulations: {len(missing)}\n')

    # Classify all missing
    plan = []
    for s in missing:
        mod = modules.get(s.get('module_id'), {})
        mkey = f'M{mod.get("module_number", "?")}'
        if args.module and mkey != args.module: continue
        stype = classify_topic(s.get('title', ''), s.get('description', ''), mod.get('title', ''))
        if args.only_type and stype != args.only_type: continue
        plan.append({'session': s, 'module_title': mod.get('title', ''), 'module_key': mkey, 'sim_type': stype})

    # Summary
    from collections import Counter
    by_type = Counter(p['sim_type'] for p in plan)
    by_mod = Counter(p['module_key'] for p in plan)
    print(f'Plan — {len(plan)} sims to generate')
    print(f'  By type: {dict(by_type)}')
    print(f'  By module: {dict(sorted(by_mod.items(), key=lambda x: int(x[0][1:]) if x[0][1:].isdigit() else 99))}')

    if args.limit: plan = plan[:args.limit]
    if not args.run:
        print('\n(dry-run — pass --run to actually generate)')
        for p in plan[:20]:
            print(f'  [{p["sim_type"]:<15}] {p["module_key"]:>4} · {p["session"]["title"][:70]}')
        if len(plan) > 20: print(f'  ... ({len(plan) - 20} more)')
        return

    # Actually generate
    print(f'\n=== Generating {len(plan)} sims ===')
    successes = 0; failures = 0
    for idx, p in enumerate(plan, start=1):
        sess = p['session']
        stype = p['sim_type']
        title_preview = sess['title'][:70]
        print(f'[{idx}/{len(plan)}] {p["module_key"]} · {stype:<15} · {title_preview}')

        try:
            content = await generate_sim_content(stype, sess, p['module_title'], sess['id'])
            # 'book' isn't allowed by the DB CHECK constraint on sim_type — store it as
            # 'document' with a `format='book'` marker so the frontend router picks BookSim.
            db_sim_type = 'document' if stype == 'book' else stype
            if stype == 'book':
                content['format'] = 'book'
            # Build the simulation row
            row = {
                'session_id': sess['id'],
                'sim_type': db_sim_type,
                'title': content.get('title') or sess['title'][:100],
                'scenario': content.get('scenario_context') or content.get('brief') or content.get('summary') or content.get('instructions') or sess.get('description', '')[:400] or 'Auto-generated simulation.',
                'instructions': content.get('instructions') or content.get('scenario_context') or content.get('summary') or 'Follow the on-screen guidance.',
                'objectives': content.get('objectives') or [sess.get('title', 'Complete the simulation')],
                'config': content,
            }
            sb_post('master_simulations', row)
            print(f'    ✓ inserted')
            successes += 1
        except Exception as e:
            print(f'    ✗ FAILED: {e}')
            failures += 1
        # Small delay to be nice to the LLM
        await asyncio.sleep(0.5)

    print(f'\n=== Done: {successes} succeeded, {failures} failed ===')
    # Force clean exit — the httpx client in emergentintegrations sometimes hangs.
    os._exit(0)

if __name__ == '__main__':
    asyncio.run(main())

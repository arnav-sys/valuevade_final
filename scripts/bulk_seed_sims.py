#!/usr/bin/env python3
"""STEP 5 — Bulk seed Excel + Document + Decision simulations for the
Equity Research curriculum (M1-M19, skipping M16/17/20-23).

USAGE:
  # Smoke single module
  python3 bulk_seed_sims.py --module 3

  # Excel-only sweep (M3, M4, M13)
  python3 bulk_seed_sims.py --modules 3,4,13

  # Full mixed-best-fit pass (everything else)
  python3 bulk_seed_sims.py --modules 1,2,5,6,7,8,9,10,11,12,14,15,18,19

  # Dry-run (no DB writes)
  python3 bulk_seed_sims.py --module 3 --dry-run

PER-SESSION FLOW:
  1. Load curriculum_v2/module-N.md → split per session.
  2. Pick sim_type:
       - M3/M4/M13          → always "excel"
       - everything else    → best-fit Haiku call ("excel"/"document"/"decision_making")
  3. Generate sim JSON via Haiku 4.5 using a type-specific prompt with all
     six user-mandated rules (no VLOOKUP-look-left, Indian flavour, etc.).
  4. Structurally validate.
  5. For excel sims: run the deterministic engine validator via a Node
     subprocess that uses excelFormula.js — auto-correct expected_values
     when LLM drift is detected.
  6. Upsert into master_simulations (replaces existing sims for that
     session). Updates `sim_type` and `config`.
  7. Log per-sim outcome to /app/scripts/bulk_seed_log/.

REPORTING:
  After each module → /app/scripts/bulk_seed_log/module_N.report.json
  Final summary    → /app/scripts/bulk_seed_log/summary.json

LATER (sonnet_quality_review.py): samples 1-in-5 of these sims for Sonnet
4.5 pedagogy review.
"""
import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import time
import uuid
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# ─── env wiring ────────────────────────────────────────────────────────────
SUPABASE_URL = ''
SR = ''
EMERGENT_LLM_KEY = ''
env_path = Path('/app/backend/.env')
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            v = v.strip().strip('"').strip("'")
            if k == 'SUPABASE_URL': SUPABASE_URL = v.rstrip('/')
            if k == 'SUPABASE_SERVICE_ROLE_KEY': SR = v
            if k == 'EMERGENT_LLM_KEY': EMERGENT_LLM_KEY = v

# Fallback: backend .env stores the POSTGRES connection string, not the REST
# base URL. The REST URL lives in frontend/.env or can be derived from the
# postgres host (`db.<ref>.supabase.co` → `https://<ref>.supabase.co`).
def _coerce_rest_url(u: str) -> str:
    if u.startswith('http://') or u.startswith('https://'):
        return u.rstrip('/')
    # Try postgres URL
    m = re.search(r'@db\.([a-z0-9]+)\.supabase\.co', u or '')
    if m:
        return f'https://{m.group(1)}.supabase.co'
    return u
SUPABASE_URL = _coerce_rest_url(SUPABASE_URL)
if not SUPABASE_URL.startswith('http'):
    # Last fallback: read from frontend/.env REACT_APP_SUPABASE_URL
    fe = Path('/app/frontend/.env')
    if fe.exists():
        for line in fe.read_text().splitlines():
            if line.startswith('REACT_APP_SUPABASE_URL='):
                SUPABASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')
                break
if not (SUPABASE_URL and SR and EMERGENT_LLM_KEY):
    print('Missing SUPABASE_URL/SR/EMERGENT_LLM_KEY in /app/backend/.env', file=sys.stderr)
    sys.exit(2)

os.environ['EMERGENT_LLM_KEY'] = EMERGENT_LLM_KEY
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

LOG_DIR = Path('/app/scripts/bulk_seed_log')
LOG_DIR.mkdir(exist_ok=True)
CURR_DIR = Path('/app/memory/curriculum_v2')
TYPE_ROUTING_PATH = Path('/app/memory/sims_type_routing_v1.json')

# Loaded lazily by load_type_routing()
_TYPE_ROUTING_CACHE = {'loaded': False, 'data': None}

def load_type_routing():
    if _TYPE_ROUTING_CACHE['loaded']:
        return _TYPE_ROUTING_CACHE['data']
    if TYPE_ROUTING_PATH.exists():
        _TYPE_ROUTING_CACHE['data'] = json.loads(TYPE_ROUTING_PATH.read_text())
    else:
        _TYPE_ROUTING_CACHE['data'] = None
    _TYPE_ROUTING_CACHE['loaded'] = True
    return _TYPE_ROUTING_CACHE['data']

# ─── module / curriculum ──────────────────────────────────────────────────
EXCEL_ONLY = {3, 4, 13}
SKIP = {16, 17, 20, 21, 22, 23}

def session_slices(module_num: int):
    """Returns list of {session_no, title, notes} for the given module.
    Handles 4 header variants found across the curriculum_v2 files:
      '# SESSION X.Y: Title'                            (standard, M1-M11, M13-M15)
      '# MODULE N — SESSION X.Y: Title'                 (M12)
      '## Session X.Y: Title'                           (M18)
      '## Session N — Title'                            (M19, no decimal)
    """
    md_path = CURR_DIR / f'module-{module_num}.md'
    if not md_path.exists():
        return []
    md = md_path.read_text()
    patterns = [
        re.compile(r'^# SESSION (\d+\.\d+):\s*(.+)$',                       re.MULTILINE),
        re.compile(r'^# MODULE \d+\s*[—-]\s*SESSION (\d+\.\d+):\s*(.+)$',   re.MULTILINE),
        re.compile(r'^##\s+Session\s+(\d+\.\d+):\s*(.+)$',                  re.MULTILINE),
        re.compile(r'^##\s+Session\s+(\d+)\s*[—-]\s*(.+)$',                 re.MULTILINE),
    ]
    matches = []
    for pat in patterns:
        ms = list(pat.finditer(md))
        if ms:
            matches = ms
            break
    out = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(md)
        out.append({
            'session_no': m.group(1),
            'title': m.group(2).strip(),
            'notes': md[start:end][:14000],
        })
    return out

# ─── prompts (tightened per user brief) ───────────────────────────────────
INDIAN_CONTEXT = """ALWAYS use real Indian companies (Reliance Industries, TCS, HDFC Bank, Infosys, ICICI Bank, Bajaj Finance, Bajaj Auto, Maruti Suzuki, Asian Paints, Titan, Nestle India, ITC, HUL, Adani Ports, Tata Steel, Tata Motors, L&T, Wipro, Sun Pharma, Cipla, Dr. Reddy's, Britannia, Dabur, Marico, Kotak Mahindra, Axis Bank, SBI, Bharti Airtel, NTPC, ONGC, Coal India, Power Grid, Bajaj Finserv, Mahindra & Mahindra, Hero MotoCorp, Tech Mahindra, HCL Tech, Eicher Motors, Hindalco, Vedanta, JSW Steel, Britannia, Pidilite, Berger Paints, Page Industries, Trent, Avenue Supermarts/DMart, Zomato, Paytm, Nykaa, Polycab, KEI Industries). NEVER use "Company A", "ABC Ltd", placeholder names. Use ₹ values, Indian sectors (Banking/IT/FMCG/Auto/Pharma/Energy/Metals/Cement/Real Estate). Indian-flavour is NON-NEGOTIABLE — every name and number must feel Mumbai-desk-real."""

EXCEL_PROMPT = f"""You are a senior Indian equity-research analyst designing an Excel exercise for finance students. You will receive ONE session's curriculum notes. Produce a workbook the student APPLIES the SPECIFIC functions/skills the session teaches.

OUTPUT — ONE JSON object, no markdown fences, this exact shape:

{{
  "sim_type": "excel",
  "title": "<scenario-style title, 8-12 words>",
  "scenario": "<2-3 sentence pragmatic Mumbai-desk scenario>",
  "instructions": "<single line, action-verb start, what the student will DO>",
  "learning_objective": "<single line, action-verb start, what the student CAN DO after — e.g. 'Compute Reliance's 5-year revenue CAGR and identify the trend break'>",
  "hints": ["<cheap nudge>", "<medium nudge>", "<near-direct hint>"],
  "multi_tab_excel_workbook": {{
    "sheets": [{{ "name": "Data", "cells": {{ "A1": {{ "value": "...", "readOnly": true, "bold": true }}, ... }} }},
               {{ "name": "Answers", "cells": {{ ... }} }}]
  }},
  "expected_answers": {{
    "Answers!B2": {{ "formula_pattern": "=SUM(Data!B2:B11)", "expected_value": 4523000, "type": "number", "tolerance": 1, "points": 15 }},
    ...
  }}
}}

HARD RULES (failure on any = unusable sim):
1. Data sheet ≥ 10 data rows (rows 2-11+), row 1 = bold headers.
2. {INDIAN_CONTEXT}
3. SECTOR CONSISTENCY: pick ONE sector (Banking / IT / FMCG / Auto / Pharma / Energy / Metals / Real Estate / Cement / Consumer Discretionary) and stay there — UNLESS the session is explicitly about cross-sector analysis. No mixing HDFC Bank rows with Tata Motors rows for a generic exercise.
4. ANSWERS: 4-6 questions, escalating in difficulty, EACH exercising a function explicitly named in the session notes. Column A read-only question, column B empty editable answer cell.
5. expected_answers covers EVERY editable cell. Each entry has formula_pattern, expected_value (numerically correct), type ("number"|"text"), tolerance (0.01 for ratios, 1 for ₹Cr, 0 for text), points (10-25). Total points 50-100.
6. FORMULA RULES:
   - Every formula_pattern MUST mathematically yield expected_value when run against your Data. Trace by hand BEFORE emitting JSON.
   - FORBIDDEN: VLOOKUP looking LEFT (negative column offset). If the answer column is LEFT of the lookup column, use INDEX-MATCH or XLOOKUP — never VLOOKUP.
   - FORBIDDEN: arithmetic on text cells (text * number → #VALUE!).
   - Percent units: if you store "18" in a cell labelled "GST Rate (%)", the formula MUST divide by 100. Or store as 0.18.
7. Cell addresses Excel-notation (A1, AA1). Sheet names case-sensitive.
8. Cap: 2 sheets, max 15 rows × 7 cols per sheet, total JSON < 7000 tokens.
9. EXACTLY 3 hints: cheap → medium → near-direct. Not 5, not 1.
10. learning_objective must reference the actual session topic (not "learn formulas"). Action-verb start.
11. Plain integers/floats for numbers (NEVER strings).
12. NO comments inside JSON. NO markdown fences. NO preamble. Return ONLY the JSON object."""

DOCUMENT_PROMPT = f"""You are a senior Indian equity-research analyst designing a Document Analysis exercise. You will receive ONE session's curriculum notes. Produce a financial-document sim where the student reads a real-looking Indian company statement, hovers tooltips on key line items, and answers analytical questions.

OUTPUT — ONE JSON object, no markdown, this exact shape:

{{
  "sim_type": "document",
  "title": "<scenario-style title, 8-12 words>",
  "scenario": "<2-3 sentence Mumbai-desk scenario>",
  "instructions": "<single line, what the student will DO>",
  "learning_objective": "<single line, action-verb start, session-specific>",
  "hints": ["<cheap nudge>", "<medium>", "<near-direct>"],
  "document_data": {{
    "company_name": "<real Indian company>",
    "period": "<e.g. 'FY24 Annual Report'>",
    "currency": "<e.g. '₹ Cr'>",
    "sections": [
      {{
        "title": "<e.g. 'Income Statement'>",
        "line_items": [
          {{ "id": "rev", "label": "Revenue from operations", "current_year": 51084, "previous_year": 40575 }},
          ...
        ],
        "section_total": {{ "label": "Profit Before Tax", "current_year": 4200, "previous_year": 3100 }}
      }}
    ]
  }},
  "interactive_highlights": [
    {{ "id": "rev", "tooltip": "Operating revenue only — excludes 'other income' which is grouped below" }},
    ...  // 3-5 tooltips on the most pedagogically loaded line items
  ],
  "tasks": [
    {{
      "id": "t1",
      "question": "What was the YoY growth in Revenue from operations (%)?",
      "answer_type": "number",      // "number" | "text" | "free_text"
      "expected_value": 25.9,        // for "number"
      "tolerance": 0.5,
      "unit": "%",
      "explanation": "(51084-40575)/40575 = 25.9% — Titan's strong jewellery year."
    }},
    {{ "id": "t2", "question": "<text question>", "answer_type": "text", "expected_keywords": ["EBITDA", "operating"], "explanation": "..." }},
    {{ "id": "t3", "question": "<analytical question>", "answer_type": "free_text", "sample_answer": "<3-sentence model answer>", "explanation": "..." }}
  ]
}}

HARD RULES:
1. {INDIAN_CONTEXT}
2. Document MUST look like a real Indian filing — actual line items (e.g. "Revenue from operations", "Cost of materials consumed", "Employee benefits expense", "Finance costs", "Depreciation and amortisation", "Tax expense", "Profit for the year").
3. SECTOR CONSISTENCY: pick one sector for the company, stay there.
4. 3-6 line items per section, 1-3 sections, real ₹ Cr numbers (revenue 10,000-200,000 range typical for large caps).
5. interactive_highlights: 3-5 tooltips, each on the line items most worth explaining (not every line). Tooltip 1-2 sentences, analyst-grade insight.
6. tasks: 3-5 tasks total. Mix at LEAST one "number", one "text", optionally one "free_text". Each question must exercise a concept explicitly named in the session notes.
7. For "number" tasks: tolerance is reasonable (0.5 for %, 1 for ₹ Cr, 10 for ₹ Cr sums). expected_value must be COMPUTED from your line_items numbers.
8. For "text" tasks: expected_keywords is a list of 1-3 lowercase keywords any decent answer would contain. Student answer passes if it INCLUDES ANY keyword.
9. EXACTLY 3 hints: cheap → medium → near-direct.
10. learning_objective: session-specific, action-verb start.
11. Total JSON < 6000 tokens. No comments, no markdown fences."""

DECISION_PROMPT = f"""You are a senior Indian equity-research analyst designing a Decision-Making case study. You will receive ONE session's curriculum notes. Produce a branching scenario where the student walks through 3-5 decision points, each with 2-4 options, accumulating scores across dimensions, ending in a graded outcome.

OUTPUT — ONE JSON object, no markdown, this exact shape:

{{
  "sim_type": "decision_making",
  "title": "<scenario title, 8-12 words>",
  "scenario": "<2-3 sentence Mumbai-desk scenario>",
  "instructions": "<what the student will DO>",
  "learning_objective": "<single line, action-verb start, session-specific>",
  "hints": ["<cheap>", "<medium>", "<near-direct>"],
  "scenario_context": "<3-5 sentence richer setup describing the company, the analyst's role, the immediate question they must answer>",
  "initial_data": {{ "Stock": "Reliance Industries", "Current Price": "₹2,780", "Your Buy Rec": "Pending", "Time to Earnings": "3 days" }},
  "decision_points": [
    {{
      "id": "d1",
      "title": "<short title>",
      "narrative": "<1-2 paragraph situation, what the student is being asked to decide>",
      "options": [
        {{
          "id": "A",
          "label": "<concrete action label>",
          "description": "<1 sentence why this option exists>",
          "consequence": "<2-3 sentence outcome narrative>",
          "score_impact": {{ "rigor": 2, "speed": -1 }},
          "is_terminal": false,
          "next_decision": "d2"
        }},
        ... (2-4 options total)
      ]
    }},
    ... (3-5 decision_points; the LAST decision's options should ALL have "is_terminal": true)
  ],
  "scoring": {{
    "max_total": 12,
    "outcome_mapping": [
      {{ "min_total": 8,  "label": "Strong analyst call", "narrative": "<sentence on why this verdict>" }},
      {{ "min_total": 4,  "label": "Defensible call", "narrative": "..." }},
      {{ "min_total": 0,  "label": "Needs review", "narrative": "..." }},
      {{ "min_total": -99,"label": "Misread", "narrative": "..." }}
    ]
  }}
}}

HARD RULES:
1. {INDIAN_CONTEXT}
2. SECTOR CONSISTENCY: pick one company, stay there for the whole scenario.
3. 3-5 decision_points. Each has 2-4 options. The LAST decision_point's options ALL set is_terminal=true.
4. Earlier options point to the next decision via next_decision. The decision tree is LINEAR (converging) — every non-terminal option's next_decision is the SAME next decision_point's id. (No diverging branches — keeps the case manageable.)
5. score_impact dimensions: pick 2-3 dimensions that match the session (e.g. "rigor", "speed", "client_trust", "risk_management", "stakeholder_alignment"). Use the SAME dimensions across all options of all decision_points.
6. Every option has score_impact values in the range -3 to +3.
7. Every option has a consequence narrative (2-3 sentences) — the student reads this after picking.
8. outcome_mapping has 3-4 buckets, descending min_total, narratives must reference the SCENARIO (not generic). The LOWEST bucket should have min_total: -99 to catch any total.
9. EXACTLY 3 hints. learning_objective session-specific, action-verb start.
10. Total JSON < 6000 tokens. No comments, no markdown fences."""

TYPE_DECIDER_PROMPT = """You are deciding which simulation type best teaches a given equity-research session. You receive the session title + curriculum notes. Return ONLY one word: excel | document | decision_making.

Rules:
- Topics involving formulas, modelling, calculations, lookups, ratios, valuation maths → "excel"
- Topics involving reading financial statements, annual reports, MD&A, disclosures, forensic line-item analysis → "document"
- Topics involving judgment calls, ethics, stakeholder choices, what-would-you-do scenarios, recommendation decisions, sector calls → "decision_making"

Pick the BEST fit. Default to "excel" when the session teaches a quantitative skill. Default to "document" when it teaches reading/interpreting filings. Default to "decision_making" when it teaches analyst judgment under uncertainty."""

# ─── LLM call ─────────────────────────────────────────────────────────────
def sync_call(system_prompt: str, user_text: str, max_tokens: int = 12000) -> str:
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f'bulk-{uuid.uuid4()}',
                system_message=system_prompt)
        .with_model('anthropic', 'claude-haiku-4-5-20251001')
        .with_params(max_tokens=max_tokens)
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

# ─── validators ───────────────────────────────────────────────────────────
def validate_excel(obj):
    wb = obj.get('multi_tab_excel_workbook')
    if not isinstance(wb, dict) or not isinstance(wb.get('sheets'), list) or len(wb['sheets']) < 2:
        raise ValueError('excel: need ≥2 sheets')
    sheet_names = set()
    for s in wb['sheets']:
        if not isinstance(s, dict) or not s.get('name') or not isinstance(s.get('cells'), dict):
            raise ValueError(f'excel: bad sheet shape')
        sheet_names.add(s['name'])
    data_sheet = next((s for s in wb['sheets'] if s['name'].lower().startswith('data')), wb['sheets'][0])
    max_row = max([int(re.match(r'^[A-Z]+(\d+)$', a).group(1)) for a in data_sheet['cells']
                   if re.match(r'^[A-Z]+\d+$', a)] + [0])
    if max_row < 11:
        raise ValueError(f'excel: data sheet only {max_row} rows')
    ea = obj.get('expected_answers') or {}
    if not isinstance(ea, dict) or not ea:
        raise ValueError('excel: expected_answers empty')
    total = 0
    for k, spec in ea.items():
        if '!' not in k:
            raise ValueError(f'excel: bad ea key {k!r}')
        for req in ('formula_pattern', 'expected_value', 'type', 'tolerance', 'points'):
            if req not in spec:
                raise ValueError(f'excel: {k} missing {req}')
        total += int(spec['points'])
    if not (40 <= total <= 120):
        raise ValueError(f'excel: total points {total} outside 40-120')

def validate_document(obj):
    dd = obj.get('document_data')
    if not isinstance(dd, dict) or not dd.get('company_name') or not isinstance(dd.get('sections'), list):
        raise ValueError('document: missing document_data/company_name/sections')
    if not dd['sections']:
        raise ValueError('document: empty sections')
    line_count = sum(len(s.get('line_items') or []) for s in dd['sections'])
    if line_count < 5:
        raise ValueError(f'document: only {line_count} line items total — need ≥5')
    tasks = obj.get('tasks')
    if not isinstance(tasks, list) or len(tasks) < 3:
        raise ValueError(f'document: need ≥3 tasks')
    for t in tasks:
        if not t.get('id') or not t.get('question') or not t.get('answer_type'):
            raise ValueError(f'document: bad task shape')
        if t['answer_type'] == 'number' and 'expected_value' not in t:
            raise ValueError(f"document: number task {t['id']} missing expected_value")
        if t['answer_type'] == 'text' and not t.get('expected_keywords'):
            raise ValueError(f"document: text task {t['id']} missing expected_keywords")

def validate_decision(obj):
    if not obj.get('scenario_context'):
        raise ValueError('decision: missing scenario_context')
    dp = obj.get('decision_points')
    if not isinstance(dp, list) or len(dp) < 3:
        raise ValueError(f'decision: need ≥3 decision_points, got {len(dp) if isinstance(dp, list) else 0}')
    ids = set()
    last_idx = len(dp) - 1
    for i, d in enumerate(dp):
        if not d.get('id') or not d.get('narrative') or not isinstance(d.get('options'), list):
            raise ValueError(f'decision: bad decision_point shape at {i}')
        ids.add(d['id'])
        if not (2 <= len(d['options']) <= 4):
            raise ValueError(f"decision: {d['id']} needs 2-4 options")
        for opt in d['options']:
            if not opt.get('id') or not opt.get('label'):
                raise ValueError(f"decision: bad option in {d['id']}")
            if i == last_idx and not opt.get('is_terminal'):
                raise ValueError(f"decision: last dp {d['id']} option {opt['id']} must be is_terminal=true")
            if i < last_idx and opt.get('is_terminal'):
                raise ValueError(f"decision: non-last dp {d['id']} option {opt['id']} cannot be terminal")
            if not isinstance(opt.get('score_impact'), dict):
                raise ValueError(f"decision: option {opt['id']} missing score_impact")
    # Forward-reference check
    for i, d in enumerate(dp[:-1]):
        for opt in d['options']:
            nd = opt.get('next_decision')
            if not nd or nd not in ids:
                raise ValueError(f"decision: option {d['id']}/{opt['id']} bad next_decision={nd}")
    sc = obj.get('scoring')
    if not isinstance(sc, dict) or not isinstance(sc.get('outcome_mapping'), list) or len(sc['outcome_mapping']) < 2:
        raise ValueError('decision: scoring.outcome_mapping needs ≥2 buckets')

VALIDATORS = {'excel': validate_excel, 'document': validate_document, 'decision_making': validate_decision}

# ─── deterministic engine validator (Node subprocess) ────────────────────
ENGINE_VALIDATOR_JS = '/app/scripts/validate_excel_sim_node.mjs'

def engine_validate_excel(sim_obj):
    """Run the JS engine validator on a single excel sim. Returns
    {corrections: [...], total_questions: N, errors: [...]}. Auto-applies
    corrections to sim_obj['expected_answers']."""
    tmp = Path(f'/tmp/sim_validate_{uuid.uuid4().hex}.json')
    tmp.write_text(json.dumps({
        'multi_tab_excel_workbook': sim_obj['multi_tab_excel_workbook'],
        'expected_answers': sim_obj['expected_answers'],
    }))
    try:
        r = subprocess.run(['node', ENGINE_VALIDATOR_JS, str(tmp)], capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            return {'corrections': [], 'total_questions': len(sim_obj['expected_answers']),
                    'errors': [f'node validator failed: {r.stderr[:500]}']}
        out = json.loads(r.stdout)
        # Apply corrections
        for c in out.get('corrections', []):
            if 'engine_computed' in c and c['key'] in sim_obj['expected_answers']:
                sim_obj['expected_answers'][c['key']]['expected_value'] = c['engine_computed']
        return out
    finally:
        tmp.unlink(missing_ok=True)

# ─── Supabase ─────────────────────────────────────────────────────────────
def rest_get(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        'apikey': SR, 'Authorization': f'Bearer {SR}', 'Accept': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def rest_send(path, method, body):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(
        url, method=method, data=json.dumps(body).encode(),
        headers={
            'apikey': SR, 'Authorization': f'Bearer {SR}',
            'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'{method} {path} → {e.code}: {body[:400]}')

def rest_delete(path):
    return rest_send(path, 'DELETE', body=[])

def rest_post(path, body):
    return rest_send(path, 'POST', body)

# ─── per-session generator ────────────────────────────────────────────────
def pick_type(session_title: str, notes: str, module_num: int, db_session_id: str = '') -> str:
    if module_num in EXCEL_ONLY:
        return 'excel'
    # Prefer the upfront Sonnet 4.5 type-routing file if present
    routing = load_type_routing()
    if routing:
        mod_key = f"M{module_num}"
        mod = (routing.get('modules') or {}).get(mod_key)
        if mod:
            id_map = mod.get('session_id_to_type') or {}
            if db_session_id and db_session_id in id_map:
                return id_map[db_session_id]
    # Fallback to Haiku per-session decision (legacy path, kept for safety)
    raw = sync_call(TYPE_DECIDER_PROMPT,
                    f"Session: {session_title}\n\nNotes (first 6000 chars):\n{notes[:6000]}",
                    max_tokens=20)
    t = raw.strip().lower().split()[0] if raw.strip() else 'excel'
    if t.startswith('decision'):
        return 'decision_making'
    if t in ('excel', 'document'):
        return t
    return 'excel'

def build_user_text(session_title: str, notes: str, sim_type: str) -> str:
    return (f"SESSION: {session_title}\n"
            f"Sim type to produce: {sim_type}\n\n"
            f"FULL SESSION NOTES:\n---\n{notes}\n---\n\n"
            f"Produce the JSON object now. Return ONLY the JSON.")

def generate_sim(session_title: str, notes: str, sim_type: str):
    """Returns (sim_obj, raw_reply, errors). sim_obj=None on failure."""
    prompts = {'excel': EXCEL_PROMPT, 'document': DOCUMENT_PROMPT, 'decision_making': DECISION_PROMPT}
    sysp = prompts[sim_type]
    user = build_user_text(session_title, notes, sim_type)
    last_err = None; raw = ''
    for attempt in range(3):
        try:
            raw = sync_call(sysp, user, max_tokens=12000)
            obj = parse_json_reply(raw)
            VALIDATORS[sim_type](obj)
            return obj, raw, None
        except (json.JSONDecodeError, ValueError) as e:
            last_err = f'{type(e).__name__}: {e}'
            time.sleep(1.5 + attempt * 1.5)
    return None, raw, last_err

# ─── DB write ─────────────────────────────────────────────────────────────
def map_sessions_for_module(module_num: int):
    """Returns list of {db_session_id, order_index, title} for module's sessions."""
    mods = rest_get('master_modules?select=id&order_index=eq.' + str(module_num))
    if not mods:
        return []
    module_id = mods[0]['id']
    sessions = rest_get(f"master_sessions?select=id,order_index,title&module_id=eq.{module_id}&order=order_index.asc&limit=50")
    return sessions

def map_curriculum_to_db(module_num: int, curriculum_sessions, db_sessions):
    """Return list of (curriculum_session_dict, db_session_dict) pairs. Pairs by
    1-based order_index when counts match; falls back to title-substring match
    when counts differ. Curriculum sessions that can't be mapped are skipped."""
    if len(curriculum_sessions) == len(db_sessions):
        return list(zip(curriculum_sessions, db_sessions))
    pairs = []
    used = set()
    for cs in curriculum_sessions:
        # try title prefix match
        ct = cs['title'].lower()
        best = None
        for ds in db_sessions:
            if ds['id'] in used:
                continue
            dt = (ds.get('title') or '').lower()
            if dt and (dt[:20] in ct or ct[:20] in dt):
                best = ds
                break
        if best:
            used.add(best['id'])
            pairs.append((cs, best))
    return pairs

def upsert_sim(db_session_id: str, sim_obj: dict, sim_type: str, source_title: str):
    """Replaces all existing master_simulations rows for the session with the
    fresh sim (one row per session)."""
    rest_delete(f"master_simulations?session_id=eq.{db_session_id}")
    config = {k: v for k, v in sim_obj.items() if k not in ('sim_type', 'title')}
    config['generated_at'] = datetime.now(timezone.utc).isoformat()
    config['generator'] = 'bulk_seed_sims.py · claude-haiku-4-5'
    config['source'] = 'ai_generated_v1'
    row = {
        'id': str(uuid.uuid4()),
        'session_id': db_session_id,
        'sim_type': sim_type,
        'title': sim_obj.get('title') or f"{source_title} — Practice",
        'config': config,
    }
    rest_post('master_simulations', row)
    return row['id']

# ─── Main driver ──────────────────────────────────────────────────────────
def process_module(module_num: int, *, dry_run=False, concurrency=2):
    print(f'\n{"="*72}\nMODULE {module_num}\n{"="*72}', flush=True)
    curriculum = session_slices(module_num)
    if not curriculum:
        print(f'  ! no curriculum file for M{module_num} — skipping')
        return None
    db_sessions = map_sessions_for_module(module_num) if not dry_run else []
    if not dry_run and not db_sessions:
        print(f'  ! no DB sessions for M{module_num} — skipping')
        return None
    pairs = map_curriculum_to_db(module_num, curriculum, db_sessions) if not dry_run else \
            [(c, {'id': '<dry>', 'order_index': i, 'title': c['title']}) for i, c in enumerate(curriculum)]
    print(f'  Curriculum sessions: {len(curriculum)}  ·  DB sessions: {len(db_sessions)}  ·  Paired: {len(pairs)}')

    results = []
    t_start = time.time()
    for i, (cs, ds) in enumerate(pairs, 1):
        t0 = time.time()
        sim_type = pick_type(cs['title'], cs['notes'], module_num, ds.get('id', ''))
        sim, raw, err = generate_sim(cs['title'], cs['notes'], sim_type)
        engine_report = None
        if sim and sim_type == 'excel':
            try:
                engine_report = engine_validate_excel(sim)
            except Exception as e:
                engine_report = {'errors': [str(e)], 'corrections': [], 'total_questions': 0}
        sim_id = None
        if sim and not dry_run:
            try:
                sim_id = upsert_sim(ds['id'], sim, sim_type, cs['title'])
            except Exception as e:
                err = f'upsert failed: {e}'
        marker = '✓' if (sim and not err) else '✗'
        elapsed = time.time() - t0
        row = {
            'session_no': cs['session_no'], 'session_title': cs['title'],
            'db_session_id': ds['id'], 'sim_type': sim_type, 'sim_id': sim_id,
            'seconds': round(elapsed, 1),
            'status': 'ok' if (sim and not err) else 'fail',
            'error': err,
            'engine_corrections': len(engine_report['corrections']) if engine_report else 0,
            'engine_errors': len(engine_report.get('errors', [])) if engine_report else 0,
        }
        results.append(row)
        # Persist raw to log
        if sim:
            (LOG_DIR / f'm{module_num}_s{cs["session_no"].replace(".", "-")}.json').write_text(
                json.dumps(sim, ensure_ascii=False, indent=2))
        else:
            (LOG_DIR / f'm{module_num}_s{cs["session_no"].replace(".", "-")}.error.txt').write_text(
                f'ERROR: {err}\n\nRAW REPLY:\n{raw[:5000]}')
        print(f'  [{i}/{len(pairs)}] {marker} S{cs["session_no"]} {sim_type:14s} ({elapsed:.1f}s) eng-fix={row["engine_corrections"]} · {cs["title"][:55]}{" — "+err if err else ""}', flush=True)

    report = {
        'module': module_num,
        'completed_at': datetime.now(timezone.utc).isoformat(),
        'total_sessions': len(curriculum),
        'sims_generated': sum(1 for r in results if r['status'] == 'ok'),
        'sims_failed': sum(1 for r in results if r['status'] == 'fail'),
        'by_type': {},
        'total_engine_corrections': sum(r['engine_corrections'] for r in results),
        'elapsed_seconds': round(time.time() - t_start, 1),
        'rows': results,
    }
    for r in results:
        if r['status'] == 'ok':
            report['by_type'][r['sim_type']] = report['by_type'].get(r['sim_type'], 0) + 1
    (LOG_DIR / f'module_{module_num}.report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f'\n  REPORT: {report["sims_generated"]}/{report["total_sessions"]} sims · by_type={report["by_type"]} · eng-corrections={report["total_engine_corrections"]} · {report["elapsed_seconds"]}s')
    return report

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--module', type=int, help='single module')
    ap.add_argument('--modules', help='comma-separated module list')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    target = []
    if args.module: target = [args.module]
    elif args.modules: target = [int(x) for x in args.modules.split(',')]
    else:
        print('--module or --modules required'); sys.exit(2)
    target = [m for m in target if m not in SKIP]

    all_reports = []
    for m in target:
        r = process_module(m, dry_run=args.dry_run)
        if r: all_reports.append(r)
    summary = {
        'completed_at': datetime.now(timezone.utc).isoformat(),
        'modules': [r['module'] for r in all_reports],
        'total_sims': sum(r['sims_generated'] for r in all_reports),
        'total_failed': sum(r['sims_failed'] for r in all_reports),
        'by_type_total': {},
        'total_engine_corrections': sum(r['total_engine_corrections'] for r in all_reports),
        'per_module': [{'m': r['module'], 'ok': r['sims_generated'], 'fail': r['sims_failed'], 'by_type': r['by_type']} for r in all_reports],
    }
    for r in all_reports:
        for t, n in r['by_type'].items():
            summary['by_type_total'][t] = summary['by_type_total'].get(t, 0) + n
    (LOG_DIR / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print('\n' + '='*72 + '\nFINAL SUMMARY\n' + '='*72)
    print(json.dumps(summary, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()

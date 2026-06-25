#!/usr/bin/env python3
"""One-shot type-routing: ask Claude Sonnet 4.5 to classify every session
of every MIXED module (M1, M2, M5..M12, M14, M15, M18, M19) as
excel | document | decision_making.

DB is the source of truth for the session list (master_sessions). Markdown
notes (curriculum_v2/module-N.md) are matched by session_number where
available and embedded as evidence to help Sonnet decide.

Markdown header formats handled (variance found in source files):
  '# SESSION X.Y: Title'      (M1-M11, M13, M14, M15)
  '# MODULE N — SESSION X.Y: Title'  (M12)
  '## Session X.Y: Title'     (M18)
  '## Session N — Title'      (M19, no decimal numbering)

OUTPUT:
  /app/memory/sims_type_routing_v1.json
  {
    "generated_at": "...",
    "modules": {
      "M1": {
        "session_id_to_type": { "<uuid>": "excel", ... },
        "by_session_no": { "1.1": {"type": "excel", "reasoning": "..."}, ... }
      },
      ...
    }
  }
"""
import asyncio
import json
import os
import re
import sys
import time
import uuid
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ─── env ───────────────────────────────────────────────────────────────────
SUPABASE_URL = ''
SR = ''
EMERGENT_LLM_KEY = ''
env_path = Path('/app/backend/.env')
for line in env_path.read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        v = v.strip().strip('"').strip("'")
        if k == 'SUPABASE_URL': SUPABASE_URL = v.rstrip('/')
        if k == 'SUPABASE_SERVICE_ROLE_KEY': SR = v
        if k == 'EMERGENT_LLM_KEY': EMERGENT_LLM_KEY = v
# Coerce postgres URL → REST URL
if not SUPABASE_URL.startswith('http'):
    m = re.search(r'@db\.([a-z0-9]+)\.supabase\.co', SUPABASE_URL)
    if m:
        SUPABASE_URL = f'https://{m.group(1)}.supabase.co'
    else:
        fe = Path('/app/frontend/.env')
        if fe.exists():
            for line in fe.read_text().splitlines():
                if line.startswith('REACT_APP_SUPABASE_URL='):
                    SUPABASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')
                    break
if not (SUPABASE_URL and SR and EMERGENT_LLM_KEY):
    print('Missing env vars', file=sys.stderr); sys.exit(2)
os.environ['EMERGENT_LLM_KEY'] = EMERGENT_LLM_KEY
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa

MIXED_MODULES = [1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 18, 19]
OUT = Path('/app/memory/sims_type_routing_v1.json')

# ─── Supabase ──────────────────────────────────────────────────────────────
def rest_get(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        'apikey': SR, 'Authorization': f'Bearer {SR}', 'Accept': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

# ─── markdown parser (handles all four header variants) ───────────────────
HEADER_PATTERNS = [
    re.compile(r'^# SESSION (\d+\.\d+):\s*(.+)$',                 re.MULTILINE),  # standard
    re.compile(r'^# MODULE \d+\s*[—-]\s*SESSION (\d+\.\d+):\s*(.+)$', re.MULTILINE),  # M12
    re.compile(r'^##\s+Session\s+(\d+\.\d+):\s*(.+)$',            re.MULTILINE),  # M18
    re.compile(r'^##\s+Session\s+(\d+)\s*[—-]\s*(.+)$',           re.MULTILINE),  # M19 (no dot)
]

def parse_session_notes(module_num: int) -> dict[str, str]:
    """Returns { session_no: first 3000 chars of session notes }."""
    md_path = Path(f'/app/memory/curriculum_v2/module-{module_num}.md')
    if not md_path.exists():
        return {}
    md = md_path.read_text()
    headers = []
    for pat in HEADER_PATTERNS:
        for m in pat.finditer(md):
            headers.append((m.start(), m.group(1), m.group(2)))
        if headers:  # use the first format that matched
            break
    headers.sort(key=lambda x: x[0])
    out = {}
    for i, (start, sno, title) in enumerate(headers):
        end = headers[i + 1][0] if i + 1 < len(headers) else len(md)
        out[sno] = md[start:end][:3500]
    return out

# ─── Sonnet 4.5 prompt ────────────────────────────────────────────────────
SYSTEM = """You are a senior curriculum designer at an Indian equity-research bootcamp. You decide which SIMULATION TYPE best teaches each session in a module.

THREE TYPES:
  • excel           — student manipulates an Excel workbook; functions/ratios/lookups/models.
  • document        — student reads a financial document (annual report, 10-K, filings) and answers analytical Qs.
  • decision_making — student walks through a branching scenario making analyst judgement calls.

RULES:
1. Map EACH session in the module to exactly ONE type.
2. Bias rules:
   - If session teaches a quantitative skill (formulas, modelling, ratios, valuation calc) → excel
   - If session teaches reading filings, MD&A, footnotes, forensic analysis → document
   - If session teaches judgement under uncertainty, ethics, recommendations, sector calls → decision_making
3. AIM FOR PEDAGOGICAL VARIETY within a module — if all 8 sessions are excel-themed, force 1-2 into document/decision to balance the learning experience. Use the BEST-FIT type unless variety demands otherwise.
4. For each session, provide a 1-line reasoning (max 15 words).

OUTPUT FORMAT — return ONLY this JSON, no markdown fences:
{
  "<session_no>": { "type": "excel"|"document"|"decision_making", "reasoning": "..." },
  ...
}

Cover EVERY session you receive. Use session_no exactly as given."""

def build_user(module_label: str, sessions: list[dict]) -> str:
    blocks = []
    for s in sessions:
        notes = s.get('notes', '')[:2200]  # cap per session
        blocks.append(f"### Session {s['session_no']}: {s['title']}\n{notes}")
    body = '\n\n---\n\n'.join(blocks)
    return (f"MODULE: {module_label}\n\n"
            f"Sessions ({len(sessions)}):\n\n{body}\n\n"
            f"Classify EVERY session above. Return the JSON map only.")

def sonnet_call(system: str, user: str, max_tokens: int = 4000) -> str:
    chat = (LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f'route-{uuid.uuid4()}',
                    system_message=system)
            .with_model('anthropic', 'claude-sonnet-4-5-20250929')
            .with_params(max_tokens=max_tokens))
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(chat.send_message(UserMessage(text=user)))
    finally:
        loop.close()

def parse_reply(raw: str) -> dict:
    text = raw.strip()
    if text.startswith('```'):
        text = text.strip('`')
        if text.lstrip().lower().startswith('json'):
            text = text.lstrip()[4:]
        if text.rstrip().endswith('```'):
            text = text.rstrip()[:-3]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m: return json.loads(m.group(0))
        raise

# ─── per-module driver ────────────────────────────────────────────────────
def route_module(module_num: int) -> dict | None:
    mods = rest_get(f"master_modules?select=id,title,module_number,order_index&module_number=eq.{module_num}")
    if not mods:
        # try order_index match as fallback
        mods = rest_get(f"master_modules?select=id,title,module_number,order_index&order_index=eq.{module_num}")
    if not mods:
        print(f'  [M{module_num}] no module found in DB — skipping')
        return None
    mod = mods[0]
    module_id = mod['id']
    db_sessions = rest_get(
        f"master_sessions?select=id,order_index,title&module_id=eq.{module_id}&order=order_index.asc&limit=50"
    )
    if not db_sessions:
        print(f'  [M{module_num}] no sessions in DB — skipping')
        return None
    notes_by_sno = parse_session_notes(module_num)
    # Build the per-session payloads — match by session_number first, then by
    # order_index when md uses non-decimal numbering (M19).
    md_keys = list(notes_by_sno.keys())
    md_uses_int_only = bool(md_keys) and all('.' not in k for k in md_keys)
    sessions_for_llm = []
    for i, s in enumerate(db_sessions):
        # Synthesize session_no as "module.order_index"
        sno_db = f"{module_num}.{s.get('order_index', i + 1)}"
        # Try to lookup notes
        notes = ''
        if md_uses_int_only:
            notes = notes_by_sno.get(str(s.get('order_index', i + 1)), '')
        else:
            notes = notes_by_sno.get(str(sno_db), '')
            if not notes:
                # try lookup by order index in any decimal form (e.g. md has '13.1' but db is M14)
                # check all md keys; pick the one matching the order index numerically
                idx = str(s.get('order_index', i + 1))
                for k in md_keys:
                    if k.endswith('.' + idx) or k == idx:
                        notes = notes_by_sno[k]
                        break
        sessions_for_llm.append({
            'session_no': str(sno_db),
            'db_session_id': s['id'],
            'order_index': s.get('order_index', i + 1),
            'title': s['title'],
            'notes': notes,
        })

    user_text = build_user(f"M{module_num}: {mod['title']}", sessions_for_llm)
    last_err = None
    for attempt in range(3):
        try:
            raw = sonnet_call(SYSTEM, user_text)
            mapping = parse_reply(raw)
            # Build outputs
            by_session_no = {}
            id_map = {}
            for s in sessions_for_llm:
                v = mapping.get(str(s['session_no'])) or mapping.get(s['session_no'])
                if not v:
                    raise ValueError(f"Sonnet didn't classify session {s['session_no']}")
                t = v.get('type', '').strip().lower()
                if t not in ('excel', 'document', 'decision_making'):
                    raise ValueError(f"bad type {t!r} for session {s['session_no']}")
                by_session_no[s['session_no']] = {
                    'type': t,
                    'reasoning': v.get('reasoning', '')[:200],
                    'title': s['title'],
                    'db_session_id': s['db_session_id'],
                }
                id_map[s['db_session_id']] = t
            # by-type tally
            tally = {}
            for v in by_session_no.values():
                tally[v['type']] = tally.get(v['type'], 0) + 1
            return {
                'module_number': module_num,
                'module_title': mod['title'],
                'total_sessions': len(sessions_for_llm),
                'tally': tally,
                'session_id_to_type': id_map,
                'by_session_no': by_session_no,
            }
        except Exception as e:
            last_err = e
            print(f'  [M{module_num}] attempt {attempt + 1} failed: {e}')
            time.sleep(2 + attempt * 2)
    print(f'  [M{module_num}] GAVE UP: {last_err}')
    return None


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out_obj = {'generated_at': datetime.now(timezone.utc).isoformat(), 'modules': {}}
    for m in MIXED_MODULES:
        print(f'\n=== Routing M{m} ===')
        t0 = time.time()
        r = route_module(m)
        if r:
            key = f"M{m}"
            out_obj['modules'][key] = r
            print(f'  ✓ {time.time()-t0:.1f}s  tally={r["tally"]}')
        else:
            print(f'  ✗ failed')
    OUT.write_text(json.dumps(out_obj, ensure_ascii=False, indent=2))
    # Print compact summary table
    print('\n\n' + '=' * 72)
    print('TYPE ROUTING SUMMARY')
    print('=' * 72)
    grand = {'excel': 0, 'document': 0, 'decision_making': 0}
    for k, v in out_obj['modules'].items():
        t = v['tally']
        line = f"{k:>4}  total={v['total_sessions']:>2}  "
        for kind in ('excel', 'document', 'decision_making'):
            line += f"{kind}={t.get(kind, 0):>2}  "
            grand[kind] += t.get(kind, 0)
        print(line + '  ' + v['module_title'][:50])
    print(f'\nGRAND TOTAL: excel={grand["excel"]}  document={grand["document"]}  decision_making={grand["decision_making"]}')
    print(f'\nWritten to {OUT}')


if __name__ == '__main__':
    main()

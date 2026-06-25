#!/usr/bin/env python3
"""Sonnet 4.5 pedagogy reviewer for bulk-seeded sims.

Samples 1-in-N (default 5) sims from a module's bulk-seed log and asks
Claude Sonnet 4.5 to rate each on a 4-criterion 1-5 rubric:

  1. INDIAN_FLAVOR     — real companies + ₹ values + Indian sectors (not "Co A")
  2. SESSION_RELEVANCE — exercises the SPECIFIC functions/concepts the session teaches
  3. HINT_PROGRESSION  — exactly 3 hints, escalating cheap→medium→near-direct
  4. DIFFICULTY_CURVE  — 4-6 questions / 3-5 decisions / 3-5 tasks ramped sensibly

Scoring scale: 1 = unusable, 2 = poor, 3 = passable, 4 = good, 5 = exemplary.
A sim PASSES if avg of 4 criteria ≥ 4.0 AND no single criterion < 3.

USAGE:
  python3 sonnet_quality_review.py --module 3
  python3 sonnet_quality_review.py --module 3 --sample-rate 5  # 1-in-5 (default)
  python3 sonnet_quality_review.py --module 3 --all            # review every sim
  python3 sonnet_quality_review.py --sims path1.json,path2.json # ad-hoc

OUTPUT:
  /app/scripts/bulk_seed_log/module_N.sonnet_review.json
  {
    "module": N, "sampled": M, "passed": K, "failed": M-K,
    "avg_total":   3.8, "avg_per_criterion": {...},
    "passed_session_nos": [...], "failed_session_nos": [...],
    "rows": [ { session_no, sim_type, scores: {...}, avg, pass, comments }, ... ]
  }
"""
import argparse
import asyncio
import json
import os
import re
import sys
import time
import uuid
from pathlib import Path
from datetime import datetime, timezone

# ─── env ───────────────────────────────────────────────────────────────────
EMERGENT_LLM_KEY = ''
env_path = Path('/app/backend/.env')
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            v = v.strip().strip('"').strip("'")
            if k == 'EMERGENT_LLM_KEY':
                EMERGENT_LLM_KEY = v
if not EMERGENT_LLM_KEY:
    print('Missing EMERGENT_LLM_KEY in /app/backend/.env', file=sys.stderr)
    sys.exit(2)
os.environ['EMERGENT_LLM_KEY'] = EMERGENT_LLM_KEY
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

LOG_DIR = Path('/app/scripts/bulk_seed_log')

# ─── rubric prompt ────────────────────────────────────────────────────────
SONNET_SYSTEM = """You are a senior partner at an Indian equity-research desk reviewing simulation exercises authored by a junior analyst. You are STRICT about pedagogy, ₹-flavour authenticity, and whether the exercise actually trains the named skill.

You will receive ONE sim payload (JSON) plus its session title + session notes. Score it on FOUR criteria, each 1-5:

1. INDIAN_FLAVOR — Real Indian companies named explicitly? Real ₹ values in plausible ranges (Cr or INR)? Indian sectors? Are placeholder names ("Co A", "Company B") forbidden? Score 5 = every name and number is Mumbai-desk-real. Score 1 = generic placeholders dominate. Score 3 = mixed.

2. SESSION_RELEVANCE — Does every question/decision/task exercise a function or concept EXPLICITLY named in the session notes? Score 5 = laser-focused on the session's syllabus. Score 1 = topic drift, off-syllabus, generic finance content. Score 3 = mostly relevant with some drift.

3. HINT_PROGRESSION — Exactly 3 hints, escalating cheap→medium→near-direct? Each hint actually useful? Score 5 = textbook hint laddering. Score 3 = 3 hints but uneven escalation. Score 1 = wrong count or hints are redundant/useless.

4. DIFFICULTY_CURVE — Questions/decisions ramp sensibly (e.g. 4-6 excel Qs going SUM → conditional → lookup → multi-step). For excel: 4-6 Qs total points 50-100. For document: 3-5 tasks mixing number/text/free_text. For decision_making: 3-5 decision_points with 2-4 options each, last decision_point terminal. Score 5 = polished ramp. Score 1 = flat or jumbled. Score 3 = some ramp, some flat.

OUTPUT — return ONLY a single JSON object (no markdown fences, no preamble) of this exact shape:

{
  "scores": {
    "indian_flavor":     <int 1-5>,
    "session_relevance": <int 1-5>,
    "hint_progression":  <int 1-5>,
    "difficulty_curve":  <int 1-5>
  },
  "avg": <float, computed by you, average of 4 scores>,
  "verdict": "pass" | "fail",   // "pass" if avg >= 4.0 AND no single criterion < 3, else "fail"
  "strengths":   "<one sentence on what works>",
  "weaknesses":  "<one sentence on what's broken or weak>",
  "fix_directive": "<one sentence advising the regen LLM what to fix; empty string if pass>"
}

Be brutal. A sim with avg 3.9 fails. We are seeding a paid product."""


def build_user_text(sim_path: Path, session_title: str, session_notes: str) -> str:
    sim_json = json.loads(sim_path.read_text())
    # Trim very large workbooks so the prompt stays cheap. We keep the
    # learning_objective, hints, instructions, scenario, and prune to first
    # 2 sheets / first 12 expected_answers for excel; first 4 tasks for doc;
    # first 4 decision points for decision.
    trimmed = {
        'sim_type': sim_json.get('sim_type'),
        'title': sim_json.get('title'),
        'scenario': sim_json.get('scenario'),
        'instructions': sim_json.get('instructions'),
        'learning_objective': sim_json.get('learning_objective'),
        'hints': sim_json.get('hints'),
    }
    if sim_json.get('sim_type') == 'excel' or 'multi_tab_excel_workbook' in sim_json:
        wb = sim_json.get('multi_tab_excel_workbook', {})
        trimmed['sheets_preview'] = [
            {'name': s.get('name'), 'sample_cells': dict(list((s.get('cells') or {}).items())[:24])}
            for s in (wb.get('sheets') or [])[:2]
        ]
        ea = sim_json.get('expected_answers', {}) or {}
        trimmed['expected_answers'] = dict(list(ea.items())[:8])
        trimmed['total_questions'] = len(ea)
    if 'document_data' in sim_json:
        dd = sim_json['document_data']
        trimmed['document_data'] = {
            'company_name': dd.get('company_name'),
            'period': dd.get('period'),
            'currency': dd.get('currency'),
            'sections_preview': [
                {'title': s.get('title'),
                 'line_items_preview': (s.get('line_items') or [])[:6]}
                for s in (dd.get('sections') or [])[:2]
            ]
        }
        trimmed['tasks_preview'] = (sim_json.get('tasks') or [])[:4]
    if 'decision_points' in sim_json:
        trimmed['scenario_context'] = sim_json.get('scenario_context')
        trimmed['initial_data'] = sim_json.get('initial_data')
        trimmed['decision_points_preview'] = [
            {'id': d.get('id'), 'title': d.get('title'),
             'narrative': (d.get('narrative') or '')[:300],
             'options': [{'id': o.get('id'), 'label': o.get('label'),
                          'score_impact': o.get('score_impact'),
                          'is_terminal': o.get('is_terminal')}
                         for o in (d.get('options') or [])]}
            for d in (sim_json.get('decision_points') or [])[:4]
        ]
        trimmed['scoring'] = sim_json.get('scoring')

    payload = json.dumps(trimmed, ensure_ascii=False, indent=2)[:10000]
    return (f"SESSION: {session_title}\n\n"
            f"SESSION NOTES (first 6000 chars):\n---\n{session_notes[:6000]}\n---\n\n"
            f"SIM PAYLOAD:\n---\n{payload}\n---\n\n"
            f"Score it now. Return ONLY the JSON object.")


def sync_call(system_prompt: str, user_text: str, max_tokens: int = 1200) -> str:
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f'sonnet-review-{uuid.uuid4()}',
                system_message=system_prompt)
        .with_model('anthropic', 'claude-sonnet-4-5-20250929')
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
    # Last-line truncation tolerance
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to lop trailing garbage
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        raise


def session_notes(module_num: int) -> dict[str, tuple[str, str]]:
    """Return { session_no: (title, notes) } for a module."""
    md_path = Path(f'/app/memory/curriculum_v2/module-{module_num}.md')
    if not md_path.exists():
        return {}
    md = md_path.read_text()
    headers = list(re.finditer(r'^# SESSION (\d+\.\d+): (.+)$', md, re.MULTILINE))
    out = {}
    for i, m in enumerate(headers):
        start = m.start()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(md)
        out[m.group(1)] = (m.group(2).strip(), md[start:end])
    return out


def find_sim_files(module_num: int) -> list[Path]:
    """Find m{N}_s{x-y}.json files in the bulk_seed_log dir."""
    return sorted(LOG_DIR.glob(f'm{module_num}_s*.json'),
                  key=lambda p: [int(x) for x in re.findall(r'\d+', p.stem)])


def parse_session_no_from_path(p: Path) -> str:
    m = re.match(r'm\d+_s(\d+)-(\d+)', p.stem)
    return f"{m.group(1)}.{m.group(2)}" if m else p.stem


def score_one(sim_path: Path, session_title: str, notes: str) -> dict:
    user_text = build_user_text(sim_path, session_title, notes)
    last_err = None
    for attempt in range(3):
        try:
            raw = sync_call(SONNET_SYSTEM, user_text)
            obj = parse_json_reply(raw)
            # sanity
            scores = obj.get('scores') or {}
            for k in ('indian_flavor', 'session_relevance', 'hint_progression', 'difficulty_curve'):
                if k not in scores or not isinstance(scores[k], (int, float)):
                    raise ValueError(f'missing/non-numeric score {k}')
            avg = sum(scores[k] for k in scores) / 4.0
            obj['avg'] = round(avg, 2)
            obj['verdict'] = 'pass' if (avg >= 4.0 and min(scores.values()) >= 3) else 'fail'
            return obj
        except Exception as e:
            last_err = e
            time.sleep(1.5 + attempt * 1.5)
    return {'error': f'sonnet review failed: {last_err}',
            'scores': {'indian_flavor': 0, 'session_relevance': 0,
                       'hint_progression': 0, 'difficulty_curve': 0},
            'avg': 0, 'verdict': 'fail',
            'strengths': '', 'weaknesses': str(last_err), 'fix_directive': 'retry'}


def review_module(module_num: int, sample_rate: int, all_flag: bool, sim_paths_override=None):
    notes_by_session = session_notes(module_num) if module_num else {}
    if sim_paths_override:
        paths = sim_paths_override
    else:
        paths = find_sim_files(module_num)
    if not paths:
        print(f'No sim files found for module {module_num} in {LOG_DIR}')
        return None
    # Sample-rate slicing applies ONLY when we auto-discovered the module's
    # files; if the caller passed an explicit --sims list, review every one.
    if not sim_paths_override and not all_flag and sample_rate > 1:
        paths = paths[::sample_rate] if len(paths) >= sample_rate else paths[:1]

    print(f'Sonnet 4.5 reviewing {len(paths)} sims for M{module_num} '
          f'(sample_rate={sample_rate}, all={all_flag})')

    rows = []
    for i, p in enumerate(paths, 1):
        session_no = parse_session_no_from_path(p)
        t0 = time.time()
        if session_no in notes_by_session:
            title, notes = notes_by_session[session_no]
        else:
            title, notes = session_no, ''
        try:
            sim_json = json.loads(p.read_text())
            sim_type = sim_json.get('sim_type', 'unknown')
        except Exception as e:
            sim_type = 'parse_error'
            print(f'  [{i}/{len(paths)}] PARSE FAIL {session_no}: {e}')
            rows.append({'session_no': session_no, 'sim_type': sim_type,
                         'error': str(e), 'avg': 0, 'verdict': 'fail'})
            continue
        result = score_one(p, title, notes)
        result['session_no'] = session_no
        result['sim_type'] = sim_type
        result['file'] = str(p)
        rows.append(result)
        print(f'  [{i}/{len(paths)}] {result["verdict"].upper():4s} '
              f'avg={result["avg"]:.2f}  '
              f'IF/SR/HP/DC={result["scores"]["indian_flavor"]}'
              f'/{result["scores"]["session_relevance"]}'
              f'/{result["scores"]["hint_progression"]}'
              f'/{result["scores"]["difficulty_curve"]}  '
              f'({time.time()-t0:.1f}s) {sim_type:14s} S{session_no}')
        if result.get('weaknesses'):
            print(f'        ↪ {result["weaknesses"][:120]}')

    if not rows:
        return None
    passed = [r for r in rows if r['verdict'] == 'pass']
    failed = [r for r in rows if r['verdict'] == 'fail']
    avg_total = sum(r['avg'] for r in rows) / len(rows)
    avg_per_criterion = {
        k: round(sum(r['scores'].get(k, 0) for r in rows) / len(rows), 2)
        for k in ('indian_flavor', 'session_relevance', 'hint_progression', 'difficulty_curve')
    }
    report = {
        'module': module_num,
        'reviewed_at': datetime.now(timezone.utc).isoformat(),
        'sampled': len(rows), 'passed': len(passed), 'failed': len(failed),
        'avg_total': round(avg_total, 2),
        'avg_per_criterion': avg_per_criterion,
        'passed_sessions': [r['session_no'] for r in passed],
        'failed_sessions': [r['session_no'] for r in failed],
        'rows': rows,
    }
    out_path = LOG_DIR / f'module_{module_num}.sonnet_review.json'
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f'\nREPORT: {report["passed"]}/{report["sampled"]} passed  '
          f'avg_total={report["avg_total"]}  per_criterion={avg_per_criterion}')
    print(f'Written to {out_path}')
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--module', type=int, help='module number to review')
    ap.add_argument('--sample-rate', type=int, default=5,
                    help='sample every Nth sim (default 5 → 1-in-5)')
    ap.add_argument('--all', action='store_true', help='review every sim in the module')
    ap.add_argument('--sims', help='comma-sep list of explicit sim json paths')
    args = ap.parse_args()

    LOG_DIR.mkdir(exist_ok=True)
    override = None
    if args.sims:
        override = [Path(p.strip()) for p in args.sims.split(',') if p.strip()]
    if not args.module and not override:
        print('--module or --sims required')
        sys.exit(2)
    review_module(args.module or 0, args.sample_rate, args.all, override)


if __name__ == '__main__':
    main()

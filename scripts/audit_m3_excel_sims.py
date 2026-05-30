#!/usr/bin/env python3
"""STEP-1 truthful investigation: enumerate every Excel sim across all modules,
classify each by what data the adapter has to work with, and dump:
  - per-sim: id, module, session, title, classification, reason
  - tally per module
  - JSON file for downstream tooling

Classifications:
  A. real_data        — adapter will produce ≥1 populated sheet (raw_data tables,
                        top-level domain arrays, paired columns/rows, etc.).
  B. legacy_tasks     — has config.starter_grid + config.tasks (M1-style; auto-scored).
  C. empty_fallback   — NO populated tables anywhere; the adapter will render a
                        prose brief + blank grid (user reports this as "empty").
  D. unknown          — not classified (no config or truly empty).
"""
import json
import os
import sys
import urllib.request
import urllib.error

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env", file=sys.stderr)
    sys.exit(2)


def rest(path, params=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += '?' + '&'.join(f"{k}={v}" for k, v in params.items())
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def classify(config):
    if not isinstance(config, dict) or not config:
        return ('unknown', 'no config')
    # 0. LLM-populated multi_tab_excel_workbook (added 2026-05-30) — top priority
    mw = config.get('multi_tab_excel_workbook')
    if isinstance(mw, dict) and isinstance(mw.get('sheets'), list) and mw['sheets']:
        ea_count = len(config.get('expected_answers') or {})
        return ('populated', f"{len(mw['sheets'])} sheets, {ea_count} scored cells")
    # B. legacy starter_grid + tasks
    sg = config.get('starter_grid') or {}
    if isinstance(sg, dict) and isinstance(sg.get('columns'), list) and sg['columns']:
        if isinstance(config.get('tasks'), list) and config['tasks']:
            return ('legacy_tasks', f"{len(config['tasks'])} tasks")
        return ('real_data', 'starter_grid only, no tasks')
    # A. raw_data with content
    raw = config.get('raw_data') or config.get('data') or {}
    if isinstance(raw, dict) and raw:
        # multi-tab
        tabs = [k for k in raw if isinstance(k, str) and k.lower().startswith('tab')]
        if tabs:
            return ('real_data', f"multi_tab: {len(tabs)} tabs")
        # Headers + Rows
        if (raw.get('Headers') or raw.get('headers')) and (raw.get('Rows') or raw.get('rows')):
            return ('real_data', 'Headers + Rows')
        # paired *_columns + *_rows
        col_keys = [k for k in raw if k.lower().endswith('columns') or k.lower().endswith('column')]
        row_keys = [k for k in raw if k.lower().endswith('rows') or k.lower().endswith('data') or k.lower().endswith('stocks')]
        if col_keys and row_keys:
            return ('real_data', f"paired cols/rows: {col_keys[:2]}")
        # by-column object
        keys = list(raw.keys())
        if keys and all(isinstance(raw[k], list) and len(raw[k]) > 1 for k in keys[:3]):
            return ('real_data', 'by-column object')
    # A2. top-level domain arrays
    SKIP = {
        'firm', 'role', 'category', 'format', 'scoring', 'difficulty',
        'total_tabs', 'time_limit_minutes', 'concepts_tested', 'data_period',
        'indian_market_context', 'tab_names', 'instructions', 'brief', 'prompt',
        'base_date', 'base_value', 'index_name', 'bond_yield_pct',
        'historical_avg_pe', 'excel_formulas_tested', 'expected_solutions',
        'raw_data', 'data', 'task_description', 'spreadsheet_setup',
        'expected_output', 'hints', 'starter_grid', 'tasks', 'rows', 'cols',
    }
    candidate = [k for k in config if k not in SKIP
                 and isinstance(config[k], list) and config[k]
                 and isinstance(config[k][0], dict)]
    if candidate:
        return ('real_data', f"top-level arrays: {candidate[:2]}")
    # rows-only
    if isinstance(config.get('rows'), list) and config['rows']:
        return ('real_data', f"{len(config['rows'])} rows")
    # If we got here, we'll fallback to empty grid in the UI.
    has_prose = any(config.get(k) for k in (
        'instructions', 'brief', 'prompt', 'task_description',
        'spreadsheet_setup', 'expected_output', 'hints'))
    return ('empty_fallback', 'prose only, no data tables' if has_prose else 'no prose, no data')


def main():
    # 1. master_modules
    modules = rest('master_modules', {
        'select': 'id,order_index,title',
        'order': 'order_index.asc',
    })
    mod_by_id = {m['id']: m for m in modules}

    # 2. master_sessions joined with master_simulations of sim_type=excel
    sessions = rest('master_sessions', {
        'select': 'id,module_id,order_index,title,master_simulations(id,sim_type,title,config)',
        'order': 'order_index.asc',
        'limit': 1000,
    })

    by_module = {}
    excel_rows = []
    for s in sessions:
        sims = s.get('master_simulations') or []
        if not isinstance(sims, list):
            sims = [sims]
        for sim in sims:
            if not sim or sim.get('sim_type') != 'excel':
                continue
            mod = mod_by_id.get(s['module_id']) or {}
            cls, reason = classify(sim.get('config') or {})
            row = {
                'sim_id': sim['id'],
                'sim_title': sim.get('title'),
                'sim_type': sim['sim_type'],
                'module_code': f"M{mod.get('order_index')}",
                'module_title': mod.get('title'),
                'module_order': mod.get('order_index'),
                'session_id': s['id'],
                'session_title': s.get('title'),
                'session_order': s.get('order_index'),
                'classification': cls,
                'reason': reason,
            }
            excel_rows.append(row)
            by_module.setdefault(mod.get('order_index'), {'code': f"M{mod.get('order_index')}", 'title': mod.get('title'), 'rows': []})
            by_module[mod.get('order_index')]['rows'].append(row)

    # Output
    print("\n" + "=" * 80)
    print(f"  EXCEL SIMULATION AUDIT — total found: {len(excel_rows)}")
    print("=" * 80)
    for mord in sorted(by_module.keys(), key=lambda x: (x is None, x)):
        m = by_module[mord]
        rows = m['rows']
        tally = {}
        for r in rows:
            tally[r['classification']] = tally.get(r['classification'], 0) + 1
        print(f"\n[{m['code'] or mord}] {m['title']}  →  {len(rows)} excel sims")
        print(f"   tally: {tally}")
        for r in rows:
            print(f"   • S{r['session_order']:02d}  {r['classification']:<16} {r['sim_title'] or r['session_title']}  ({r['reason']})  sim={r['sim_id']}")

    # Overall tally
    overall = {}
    for r in excel_rows:
        overall[r['classification']] = overall.get(r['classification'], 0) + 1
    print("\n" + "-" * 80)
    print(f"OVERALL: {overall}")
    print("-" * 80)

    # Write json
    out = '/app/memory/excel_sim_audit_2026_05_30.json'
    with open(out, 'w') as f:
        json.dump({'rows': excel_rows, 'by_module_tally': overall}, f, indent=2, default=str)
    print(f"\nWritten: {out}")


if __name__ == '__main__':
    main()

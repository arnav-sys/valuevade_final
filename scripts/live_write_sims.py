#!/usr/bin/env python3
"""Live-write bulk-seeded sims from /app/scripts/bulk_seed_log/ into
Supabase master_simulations.

USAGE:
    python3 live_write_sims.py --module 3
    python3 live_write_sims.py --module 3 --dry-run

For each S{X}.{Y}.json file that already passed the seed pipeline, we:
  1. Find the matching master_sessions row (by module order_index + session
     order_index derived from the file name).
  2. DELETE any existing master_simulations for that session.
  3. INSERT the fresh sim tagged source='ai_generated_v1'.

Idempotent: safe to re-run.
"""
import argparse
import json
import re
import sys
import uuid
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# ─── env ──────────────────────────────────────────────────────────────────
SUPABASE_URL = ''
SR = ''
env_path = Path('/app/backend/.env')
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            v = v.strip().strip('"').strip("'")
            if k == 'SUPABASE_URL':
                SUPABASE_URL = v.rstrip('/')
            if k == 'SUPABASE_SERVICE_ROLE_KEY':
                SR = v

def _coerce_rest_url(u):
    if u.startswith('http://') or u.startswith('https://'):
        return u.rstrip('/')
    m = re.search(r'@db\.([a-z0-9]+)\.supabase\.co', u or '')
    if m:
        return f'https://{m.group(1)}.supabase.co'
    return u
SUPABASE_URL = _coerce_rest_url(SUPABASE_URL)
if not SUPABASE_URL.startswith('http'):
    fe = Path('/app/frontend/.env')
    if fe.exists():
        for line in fe.read_text().splitlines():
            if line.startswith('REACT_APP_SUPABASE_URL='):
                SUPABASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')
                break
if not (SUPABASE_URL and SR):
    print('Missing SUPABASE_URL/SR in /app/backend/.env', file=sys.stderr)
    sys.exit(2)

LOG_DIR = Path('/app/scripts/bulk_seed_log')

# ─── Supabase helpers ─────────────────────────────────────────────────────
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

# ─── main ────────────────────────────────────────────────────────────────
def load_sim_files(module_num):
    """Returns dict { '3.1': Path, '3.2': Path, ... } for m{N}_s{x-y}.json."""
    out = {}
    for p in sorted(LOG_DIR.glob(f'm{module_num}_s*.json')):
        m = re.match(rf'm{module_num}_s(\d+)-(\d+)', p.stem)
        if m:
            out[f'{m.group(1)}.{m.group(2)}'] = p
    return out

def map_db_sessions(module_num):
    """Returns list of {id, order_index, title} for module's sessions, ordered."""
    mods = rest_get(f'master_modules?select=id,order_index&order_index=eq.{module_num}')
    if not mods:
        raise RuntimeError(f'no master_modules row with order_index={module_num}')
    module_id = mods[0]['id']
    sessions = rest_get(
        f"master_sessions?select=id,order_index,title&module_id=eq.{module_id}"
        f"&order=order_index.asc&limit=50"
    )
    return sessions

def upsert_sim(db_session_id, sim_obj, session_no, dry_run=False):
    sim_type = sim_obj.get('sim_type', 'excel')
    title = sim_obj.get('title') or f'Session {session_no} — Practice'
    # These columns exist as top-level fields on master_simulations
    # (mirroring the s6_simulation_content shape used elsewhere in this repo).
    scenario     = sim_obj.get('scenario') or ''
    instructions = sim_obj.get('instructions') or ''
    # `objectives` is a top-level jsonb array column; derive it from the
    # sim's learning_objective (single string) if present.
    lo = sim_obj.get('learning_objective') or ''
    objectives = [lo] if lo else []
    # Everything else — hints, sheets, tasks, decision_points, expected_answers,
    # document_data, learning_objective — goes into config.
    config = {k: v for k, v in sim_obj.items()
              if k not in ('sim_type', 'title', 'scenario', 'instructions')}
    config['generated_at'] = datetime.now(timezone.utc).isoformat()
    config['generator'] = 'bulk_seed_sims.py · claude-haiku-4-5'
    config['source'] = 'ai_generated_v1'
    config['session_no'] = session_no
    row = {
        'id': str(uuid.uuid4()),
        'session_id': db_session_id,
        'sim_type': sim_type,
        'title': title,
        'scenario': scenario,
        'instructions': instructions,
        'objectives': objectives,
        'config': config,
    }
    if dry_run:
        return row['id'], 'dry'
    rest_delete(f'master_simulations?session_id=eq.{db_session_id}')
    rest_post('master_simulations', row)
    return row['id'], 'wrote'

def run(module_num, dry_run):
    sim_files = load_sim_files(module_num)
    print(f'\nMODULE {module_num}: found {len(sim_files)} sim files → {sorted(sim_files)}')
    db_sessions = map_db_sessions(module_num)
    print(f'  DB has {len(db_sessions)} sessions for M{module_num}')

    # Map session_no (e.g. "3.1") to DB session by order_index
    # order_index is 1-based within a module, matching the ".X" suffix.
    db_by_order = {int(s['order_index']): s for s in db_sessions}

    rows = []
    for session_no, path in sorted(sim_files.items(), key=lambda kv: [int(x) for x in kv[0].split('.')]):
        sim_obj = json.loads(path.read_text())
        _, suf = session_no.split('.')
        db_session = db_by_order.get(int(suf))
        if not db_session:
            print(f'  ! S{session_no} → no DB session at order_index={suf} — SKIP')
            rows.append({'session_no': session_no, 'status': 'skip_no_db',
                         'db_session_id': None, 'sim_id': None})
            continue
        try:
            sim_id, status = upsert_sim(db_session['id'], sim_obj, session_no, dry_run)
            marker = '✓ (dry)' if dry_run else '✓'
            print(f'  {marker} S{session_no}  {sim_obj.get("sim_type","?"):14s}  → session_id={db_session["id"]}  sim_id={sim_id}')
            rows.append({
                'session_no': session_no,
                'sim_type': sim_obj.get('sim_type'),
                'title': sim_obj.get('title'),
                'db_session_id': db_session['id'],
                'sim_id': sim_id,
                'status': status,
                'file': str(path),
            })
        except Exception as e:
            print(f'  ✗ S{session_no} FAILED: {e}')
            rows.append({'session_no': session_no, 'status': 'error',
                         'db_session_id': db_session['id'], 'sim_id': None,
                         'error': str(e)})

    # Verify count via SELECT
    if not dry_run:
        cnt_query = (
            f'master_simulations?session_id=in.('
            + ','.join(r['db_session_id'] for r in rows if r['db_session_id']) + ')&select=id'
        )
        try:
            existing = rest_get(cnt_query)
            print(f'\n  VERIFY: master_simulations for M{module_num} sessions → {len(existing)} rows')
        except Exception as e:
            print(f'\n  VERIFY failed: {e}')

    report = {
        'module': module_num,
        'ran_at': datetime.now(timezone.utc).isoformat(),
        'dry_run': dry_run,
        'total_files': len(sim_files),
        'ok': sum(1 for r in rows if r['status'] in ('wrote', 'dry')),
        'error': sum(1 for r in rows if r['status'] == 'error'),
        'skipped': sum(1 for r in rows if r['status'] == 'skip_no_db'),
        'rows': rows,
    }
    out = LOG_DIR / f'module_{module_num}.live_write.json'
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f'\nWROTE {out}')
    return report

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--module', type=int, required=True)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    run(args.module, args.dry_run)

if __name__ == '__main__':
    main()

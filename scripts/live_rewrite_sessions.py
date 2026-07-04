#!/usr/bin/env python3
"""Live-rewrite ONLY specified session sims. For M13 polish pass."""
import sys, json
sys.path.insert(0, '/app/scripts')
from live_write_sims import (
    rest_get, upsert_sim, map_db_sessions,
)
from pathlib import Path

LOG_DIR = Path('/app/scripts/bulk_seed_log')

def main():
    module = int(sys.argv[1])
    session_nos = sys.argv[2].split(',')
    print(f"Rewriting M{module} sessions: {session_nos}")
    db = map_db_sessions(module)
    db_by_order = {int(s['order_index']): s for s in db}
    for sn in session_nos:
        _, suf = sn.split('.')
        db_s = db_by_order.get(int(suf))
        if not db_s:
            print(f'  ! S{sn}: no DB session'); continue
        path = LOG_DIR / f'm{module}_s{sn.replace(".","-")}.json'
        if not path.exists():
            print(f'  ! S{sn}: no file'); continue
        obj = json.loads(path.read_text())
        sim_id, status = upsert_sim(db_s['id'], obj, sn, dry_run=False)
        print(f'  ✓ S{sn}  session_id={db_s["id"]}  sim_id={sim_id}')

if __name__ == '__main__':
    main()

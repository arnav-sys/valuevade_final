#!/usr/bin/env python3
"""Delete + insert decision-making sims for M1 Sessions 14 (Micro) and 15 (Macro)."""
import json, sys, urllib.request

sys.path.insert(0, "/app/scripts")
from s14_15_simulation_content import S14_SIM, S15_SIM

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"


def req(method, path, body=None, want_json=True):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, method=method, data=data, headers={
        "apikey": SR, "Authorization": f"Bearer {SR}",
        "Content-Type": "application/json", "Prefer": "return=representation",
    })
    with urllib.request.urlopen(r) as resp:
        text = resp.read().decode()
        return json.loads(text) if want_json and text else text


def opt_score(o):
    return sum(o.get('score_impact', {}).values())


for sim in (S14_SIM, S15_SIM):
    sid = sim["session_id"]
    print(f"\n{'='*70}")
    print(f"Session {sid}")
    print(f"{'='*70}")

    existing = req("GET", f"master_simulations?session_id=eq.{sid}&select=id,sim_type,title")
    print(f"Existing: {len(existing)}")
    for e in existing:
        print(f"  delete  {e['id']} | {e['sim_type']} | {e['title'][:60]}")
        req("DELETE", f"master_simulations?id=eq.{e['id']}", want_json=False)

    new = req("POST", "master_simulations", body=sim)[0]
    cfg = new["config"]
    print(f"\nInserted: {new['id']}")
    print(f"  Title: {new['title']}")
    print(f"  Sim type: {new['sim_type']}")
    print(f"  Decisions: {len(cfg['decision_points'])}")

    # Validate every option
    errs = []
    ids = {dp['id'] for dp in cfg['decision_points']}
    for dp in cfg['decision_points']:
        for o in dp['options']:
            if o.get('is_terminal'):
                continue
            nxt = o.get('next_decision')
            if nxt not in ids:
                errs.append(f"{dp['id']}.{o['id']}: bad next_decision={nxt}")

    # Compute optimal & worst totals
    total_opt = 0
    cur = cfg['decision_points'][0]
    path_opt = []
    while cur:
        best = max(cur['options'], key=opt_score)
        total_opt += opt_score(best)
        path_opt.append(f"{cur['id']}={best['id']}({opt_score(best)})")
        if best.get('is_terminal'):
            break
        cur = next((d for d in cfg['decision_points'] if d['id'] == best['next_decision']), None)

    total_worst = 0
    cur = cfg['decision_points'][0]
    path_worst = []
    while cur:
        worst = min(cur['options'], key=opt_score)
        total_worst += opt_score(worst)
        path_worst.append(f"{cur['id']}={worst['id']}({opt_score(worst)})")
        if worst.get('is_terminal'):
            break
        cur = next((d for d in cfg['decision_points'] if d['id'] == worst['next_decision']), None)

    print(f"  Max total: {cfg['scoring']['max_total']}")
    print(f"  Optimal path: {' → '.join(path_opt)} = {total_opt}")
    print(f"  Worst path:   {' → '.join(path_worst)} = {total_worst}")
    if errs:
        print("  !! ERRORS:", errs)
    else:
        print("  All checks PASSED ✓")

print("\nDone.")

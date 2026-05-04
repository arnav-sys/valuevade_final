#!/usr/bin/env python3
"""Delete + insert decision-making sim for M1 / Session 10 (Corporate Finance Essentials)."""
import json, sys, urllib.request

sys.path.insert(0, "/app/scripts")
from s10_simulation_content import S10_SIM

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


sid = S10_SIM["session_id"]
existing = req("GET", f"master_simulations?session_id=eq.{sid}&select=id,sim_type,title")
print(f"Existing: {len(existing)}")
for e in existing:
    print(f"  delete  {e['id']} | {e['sim_type']} | {e['title'][:60]}")
    req("DELETE", f"master_simulations?id=eq.{e['id']}", want_json=False)

new = req("POST", "master_simulations", body=S10_SIM)[0]
cfg = new["config"]
print(f"\nInserted: {new['id']}")
print(f"  Title: {new['title']}")
print(f"  Sim type: {new['sim_type']}")
print(f"  Decisions: {len(cfg['decision_points'])}")
for dp in cfg['decision_points']:
    n_term = sum(1 for o in dp['options'] if o.get('is_terminal'))
    n_next = sum(1 for o in dp['options'] if o.get('next_decision'))
    print(f"    · {dp['id']:4s} {dp['title'][:55]:55s} {len(dp['options'])} options (term={n_term}, next={n_next})")
print(f"  Outcome bands: {len(cfg['scoring']['outcome_mapping'])}")
print(f"  Max total: {cfg['scoring']['max_total']}")

# Self-check: every option leads somewhere
errs = []
ids = {dp['id'] for dp in cfg['decision_points']}
for dp in cfg['decision_points']:
    for o in dp['options']:
        if o.get('is_terminal'):
            continue
        nxt = o.get('next_decision')
        if not nxt:
            errs.append(f"{dp['id']}.{o['id']}: no next_decision and not terminal")
        elif nxt not in ids:
            errs.append(f"{dp['id']}.{o['id']}: next_decision={nxt} not found")

# Compute optimal path + max attainable
def opt_score(o):
    return sum(o.get('score_impact', {}).values())

total = 0
cur = cfg['decision_points'][0]
visited_ids = []
while cur:
    best = max(cur['options'], key=opt_score)
    total += opt_score(best)
    visited_ids.append(f"{cur['id']}={best['id']}({opt_score(best)})")
    if best.get('is_terminal'):
        break
    cur = next((d for d in cfg['decision_points'] if d['id'] == best['next_decision']), None)

print(f"\n  Optimal path total: {total}")
print(f"  Path: {' → '.join(visited_ids)}")

# worst path
total_w = 0
cur = cfg['decision_points'][0]
worst_ids = []
while cur:
    worst = min(cur['options'], key=opt_score)
    total_w += opt_score(worst)
    worst_ids.append(f"{cur['id']}={worst['id']}({opt_score(worst)})")
    if worst.get('is_terminal'):
        break
    cur = next((d for d in cfg['decision_points'] if d['id'] == worst['next_decision']), None)
print(f"  Worst path total:   {total_w}")
print(f"  Path: {' → '.join(worst_ids)}")

if errs:
    print("\n!! ERRORS:")
    for e in errs:
        print(f"  - {e}")
else:
    print("\nAll structural checks PASSED ✓")

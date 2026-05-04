#!/usr/bin/env python3
"""Replace M1 simulations for sessions 1, 2, 4, 9, 11, 12, 13.

Resolves session IDs by order_index, deletes existing master_simulations rows,
and inserts the new ones from the content modules.
"""
import json, sys, urllib.request

sys.path.insert(0, "/app/scripts")
from m1_decision_sims_content import S1_SIM, S2_SIM, S11_SIM, S12_SIM, S13_SIM
from m1_document_sims_content import S4_SIM, S9_SIM

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"
M1_ID = "fbaf0f10-6afc-485f-9ee9-d3a1f413d41e"


def req(method, path, body=None, want_json=True):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", method=method, data=data,
        headers={"apikey": SR, "Authorization": f"Bearer {SR}",
                 "Content-Type": "application/json", "Prefer": "return=representation"})
    with urllib.request.urlopen(r) as resp:
        text = resp.read().decode()
        return json.loads(text) if want_json and text else text


# Resolve sessions by order_index
sessions = req("GET", f"master_sessions?module_id=eq.{M1_ID}&select=id,order_index,title")
by_order = {s["order_index"]: s for s in sessions}

# Map sims to their order indices
SIM_TO_ORDER = {
    1: S1_SIM, 2: S2_SIM, 4: S4_SIM, 9: S9_SIM,
    11: S11_SIM, 12: S12_SIM, 13: S13_SIM,
}

# Inject session_id where placeholder exists
for order, sim in SIM_TO_ORDER.items():
    if str(sim["session_id"]).startswith("__resolve"):
        sim["session_id"] = by_order[order]["id"]

# For each sim: delete existing & insert new
for order in sorted(SIM_TO_ORDER):
    sim = SIM_TO_ORDER[order]
    sid = sim["session_id"]
    sess = by_order[order]
    print(f"\n{'='*72}")
    print(f"M1 S{order} · {sess['title']}")
    print(f"  session_id: {sid}")
    print(f"{'='*72}")

    existing = req("GET", f"master_simulations?session_id=eq.{sid}&select=id,sim_type,title")
    print(f"  Existing sims: {len(existing)}")
    for e in existing:
        print(f"    delete  {e['id']} ({e['sim_type']}) {e['title'][:60]}")
        req("DELETE", f"master_simulations?id=eq.{e['id']}", want_json=False)

    inserted = req("POST", "master_simulations", body=sim)[0]
    cfg = inserted["config"]
    print(f"\n  ✓ Inserted: {inserted['id']}")
    print(f"    Title: {inserted['title']}")
    print(f"    sim_type: {inserted['sim_type']}")

    if inserted['sim_type'] == 'decision_making':
        dps = cfg["decision_points"]
        print(f"    decisions: {len(dps)}, total options: {sum(len(d['options']) for d in dps)}")
        # Validate links
        ids = {d['id'] for d in dps}
        errs = []
        for d in dps:
            for o in d['options']:
                if o.get('is_terminal'):
                    continue
                if o.get('next_decision') not in ids:
                    errs.append(f"{d['id']}.{o['id']}: bad next={o.get('next_decision')}")
        # Compute optimal/worst totals
        def s(o): return sum(o.get('score_impact', {}).values())
        opt_total, worst_total = 0, 0
        cur = dps[0]
        opt_path, worst_path = [], []
        while cur:
            best = max(cur['options'], key=s); opt_total += s(best)
            opt_path.append(f"{cur['id']}={best['id']}({s(best)})")
            if best.get('is_terminal'): break
            cur = next((d for d in dps if d['id'] == best['next_decision']), None)
        cur = dps[0]
        while cur:
            wo = min(cur['options'], key=s); worst_total += s(wo)
            worst_path.append(f"{cur['id']}={wo['id']}({s(wo)})")
            if wo.get('is_terminal'): break
            cur = next((d for d in dps if d['id'] == wo['next_decision']), None)
        print(f"    optimal: {' → '.join(opt_path)} = {opt_total}")
        print(f"    worst:   {' → '.join(worst_path)} = {worst_total}")
        if errs: print(f"    !! ERRORS: {errs}")
        else: print(f"    structure OK ✓")
    else:  # document
        doc = cfg['document_data']
        all_ids = {it['id'] for s in doc['sections'] for it in s.get('line_items', [])}
        bad_h = [h for h in cfg['interactive_highlights'] if h['id'] not in all_ids]
        bad_t = [t for t in cfg['tasks'] if not (t.get('explanation') or t.get('sample_answer'))]
        print(f"    sections: {len(doc['sections'])}, highlights: {len(cfg['interactive_highlights'])}, tasks: {len(cfg['tasks'])}")
        if bad_h: print(f"    !! BAD highlights: {[h['id'] for h in bad_h]}")
        if bad_t: print(f"    !! Tasks missing explanation: {[t['id'] for t in bad_t]}")
        if not bad_h and not bad_t: print(f"    structure OK ✓")

print("\n\nDone.")

#!/usr/bin/env python3
"""Delete + insert document-type simulations for M1 sessions 7 and 8."""
import json, sys, urllib.request

sys.path.insert(0, "/app/scripts")
from s78_simulation_content import S7_SIM, S8_SIM

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"


def request(method, path, body=None, want_json=True):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, method=method, data=data,
        headers={
            "apikey": SR, "Authorization": f"Bearer {SR}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req) as r:
        text = r.read().decode()
        if want_json and text:
            return json.loads(text)
        return text


for sim in (S7_SIM, S8_SIM):
    sid = sim["session_id"]
    print(f"\n=== Session {sid} ===")
    existing = request("GET", f"master_simulations?session_id=eq.{sid}&select=id,sim_type,title")
    print(f"Existing simulations: {len(existing)}")
    for e in existing:
        print(f"  - {e['id']} | {e['sim_type']} | {e['title'][:60]}")
        request("DELETE", f"master_simulations?id=eq.{e['id']}", want_json=False)
        print(f"    deleted ✓")

    inserted = request("POST", "master_simulations", body=sim)
    new_row = inserted[0]
    cfg = new_row["config"]
    print(f"Inserted new sim: {new_row['id']}")
    print(f"  Title: {new_row['title']}")
    print(f"  Sim type: {new_row['sim_type']}")
    print(f"  Sections: {len(cfg['document_data']['sections'])}")
    print(f"  Tasks: {len(cfg['tasks'])}")
    print(f"  Highlights: {len(cfg['interactive_highlights'])}")

print("\nAll done.")

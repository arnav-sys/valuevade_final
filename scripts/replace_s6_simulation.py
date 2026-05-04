#!/usr/bin/env python3
"""
Replace the Module 1 / Session 6 simulation:
  - DELETE the existing master_simulations row(s) for session_id = c3a21f75-...
  - INSERT the new document-type simulation
"""
import json, sys, urllib.request

sys.path.insert(0, "/app/scripts")
from s6_simulation_content import S6_SIM

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

SESSION_ID = "c3a21f75-1dac-4656-9264-1cb37ed802c1"


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


# 1. List the existing sims for the session
print("Fetching existing simulations for session...")
existing = request("GET", f"master_simulations?session_id=eq.{SESSION_ID}&select=id,sim_type,title")
print(f"Found {len(existing)} existing simulation(s):")
for e in existing:
    print(f"  - {e['id']} | sim_type={e['sim_type']} | title={e['title'][:60]}")

# 2. Delete each
for e in existing:
    print(f"Deleting {e['id']}...")
    request("DELETE", f"master_simulations?id=eq.{e['id']}", want_json=False)

# 3. Insert the new one
print("\nInserting new document-type simulation...")
inserted = request("POST", "master_simulations", body=S6_SIM)
print(f"Inserted: {inserted[0]['id']}")
print(f"Title: {inserted[0]['title']}")
print(f"Sim type: {inserted[0]['sim_type']}")
print(f"Sections in document: {len(inserted[0]['config']['document_data']['sections'])}")
print(f"Tasks: {len(inserted[0]['config']['tasks'])}")
print(f"Highlights: {len(inserted[0]['config']['interactive_highlights'])}")

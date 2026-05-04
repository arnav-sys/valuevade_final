#!/usr/bin/env python3
"""Fetch all formula cards from Supabase master_notes_cards and dump to JSON."""
import os
import json
import sys
from pathlib import Path
import urllib.request
import urllib.parse

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

def get(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        "apikey": SR_KEY,
        "Authorization": f"Bearer {SR_KEY}",
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

# Get all formula cards
cards = get("master_notes_cards?card_type=eq.formula&select=id,session_id,card_type,title,order_index,content&order=session_id,order_index")
print(f"Found {len(cards)} formula cards", file=sys.stderr)

# Get session info for context
sessions = get("master_sessions?select=id,title,order_index,module_id")
sessions_by_id = {s["id"]: s for s in sessions}

modules = get("master_modules?select=id,title,order_index")
modules_by_id = {m["id"]: m for m in modules}

for c in cards:
    sess = sessions_by_id.get(c["session_id"], {})
    mod = modules_by_id.get(sess.get("module_id"), {})
    c["_session_title"] = sess.get("title", "?")
    c["_session_number"] = sess.get("order_index")
    c["_module_title"] = mod.get("title", "?")
    c["_module_number"] = mod.get("order_index")

out_path = Path("/app/scripts/formula_cards_dump.json")
out_path.write_text(json.dumps(cards, indent=2, ensure_ascii=False))
print(f"Wrote {out_path}", file=sys.stderr)

# Print summary
for c in cards:
    print(f"M{c['_module_number']} S{c['_session_number']} | {c['title'][:60]} | id={c['id']} | session_id={c['session_id']}")

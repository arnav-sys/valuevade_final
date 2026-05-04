#!/usr/bin/env python3
"""Verify the new S6 simulation matches DocumentSim's expected schema."""
import json, urllib.request

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

def get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SR, "Authorization": f"Bearer {SR}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

sims = get("master_simulations?session_id=eq.c3a21f75-1dac-4656-9264-1cb37ed802c1&select=*")
assert len(sims) == 1, f"Expected 1, got {len(sims)}"
sim = sims[0]
print(f"Simulation: {sim['title']}")
print(f"  sim_type: {sim['sim_type']}")

cfg = sim["config"]
doc = cfg["document_data"]
print(f"\n--- DOCUMENT ---")
print(f"  company_name: {doc['company_name']}")
print(f"  period: {doc['period']}")
print(f"  currency: {doc['currency']}")
print(f"  sections: {len(doc['sections'])}")
for s in doc["sections"]:
    items = len(s.get("line_items", []))
    has_total = bool(s.get("section_total"))
    print(f"    · {s['title']:35s} | {items} lines | section_total={has_total}")

# Validate every line_item has id, label, current_year, previous_year
errs = []
for s in doc["sections"]:
    for it in s.get("line_items", []):
        for k in ("id", "label", "current_year", "previous_year"):
            if k not in it:
                errs.append(f"line item missing {k}: {it}")

print(f"\n--- HIGHLIGHTS ---")
print(f"  count: {len(cfg['interactive_highlights'])}")
all_line_ids = {it["id"] for s in doc["sections"] for it in s.get("line_items", [])}
for h in cfg["interactive_highlights"]:
    matches = h["id"] in all_line_ids
    print(f"  · {h['id']:25s} | tooltip len {len(h['tooltip'])} | matches line: {matches}")
    if not matches:
        errs.append(f"highlight id {h['id']} doesn't match any line_item")

print(f"\n--- TASKS ---")
print(f"  count: {len(cfg['tasks'])}")
for t in cfg["tasks"]:
    qid = t.get("id", "?")
    at = t.get("answer_type", "?")
    expected = "—"
    if at == "number":
        expected = f"{t.get('expected_value')} ± {t.get('tolerance')}"
    elif at == "text":
        expected = f"keywords={t.get('expected_keywords')}"
    elif at == "free_text":
        expected = "(free text)"
    has_expl = bool(t.get("explanation") or t.get("sample_answer"))
    print(f"  · {qid:25s} | type={at:10s} | expected={str(expected)[:30]:30s} | explanation={has_expl}")

if errs:
    print("\n!! ERRORS:")
    for e in errs:
        print(f"  - {e}")
else:
    print("\nALL CHECKS PASSED ✓")

#!/usr/bin/env python3
"""Verify Module 1 quiz enhancements: pull from Supabase and check template adherence."""
import json, urllib.request, re

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

def get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SR, "Authorization": f"Bearer {SR}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

mods = get("master_modules?select=id,order_index")
m1 = next(m for m in mods if m["order_index"] == 1)
sessions = get(f"master_sessions?module_id=eq.{m1['id']}&select=id,title,order_index&order=order_index")
session_by_id = {s["id"]: s for s in sessions}
session_ids = [s["id"] for s in sessions]
qs = get(f"master_quiz_questions?session_id=in.({','.join(session_ids)})&select=id,session_id,question,options,correct_answer_index,explanation,order_index")

# Annotate
for q in qs:
    s = session_by_id.get(q["session_id"], {})
    q["_so"] = s.get("order_index")
qs.sort(key=lambda x: (x["_so"] or 0, x.get("order_index") or 0))

print(f"Total Module 1 quizzes in DB: {len(qs)}")

# Check each for template adherence
required_labels = ["Why this is correct:", "Why the others are wrong:", "Intuition:"]
missing_template = []
short = []

for q in qs:
    e = q.get("explanation") or ""
    has_all = all(label in e for label in required_labels)
    has_formula_or_concept = ("Formula:" in e or "Concept:" in e)
    if not (has_all and has_formula_or_concept):
        missing_template.append(q)
    if len(e) < 400:
        short.append(q)

print(f"Missing required template sections: {len(missing_template)}")
for q in missing_template[:10]:
    print(f"  S{q['_so']} Q{q.get('order_index')}: {q['question'][:60]}")
print(f"Short explanations (<400 chars): {len(short)}")

# Length stats
lens = [len(q.get("explanation") or "") for q in qs]
print(f"Length: min={min(lens)} max={max(lens)} avg={sum(lens)//len(lens)}")

# Print a numerical+formula sample
sample = next(q for q in qs if "Sharpe" in q["question"] or "CAPM" in q["question"] or "FV" in q["question"])
print("\n=== SAMPLE ===")
print(f"Q: {sample['question']}")
print(f"E:\n{sample['explanation']}")

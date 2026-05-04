#!/usr/bin/env python3
"""Pull all Module 1 quiz questions and identify which ones lack formula/in-depth explanation."""
import json, urllib.request
from pathlib import Path

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

def get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SR, "Authorization": f"Bearer {SR}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

# Find Module 1
modules = get("master_modules?select=id,title,order_index&order=order_index")
m1 = next(m for m in modules if m["order_index"] == 1)
print(f"Module 1: {m1['title']} ({m1['id']})")

# All sessions in Module 1
sessions = get(f"master_sessions?module_id=eq.{m1['id']}&select=id,title,order_index&order=order_index")
print(f"Sessions in Module 1: {len(sessions)}")
session_by_id = {s["id"]: s for s in sessions}

# All quiz questions in those sessions
session_ids = [s["id"] for s in sessions]
ids_filter = ",".join(session_ids)
qs = get(f"master_quiz_questions?session_id=in.({ids_filter})&select=*")
print(f"Total quiz questions in Module 1: {len(qs)}")

# Annotate with session info
for q in qs:
    s = session_by_id.get(q["session_id"], {})
    q["_session_title"] = s.get("title", "?")
    q["_session_order"] = s.get("order_index")

qs.sort(key=lambda q: (q["_session_order"] or 0, q.get("order_index") or 0))

Path("/app/scripts/m1_quiz_dump.json").write_text(json.dumps(qs, indent=2, ensure_ascii=False))
print(f"Wrote /app/scripts/m1_quiz_dump.json")

# Heuristic: which questions are NUMERICAL (involve calculation) but lack a formula in the explanation?
# A "numerical" question typically has digits/units/% in the question. A "formula present" check looks
# for formula-like patterns in the explanation: "=", "FV =", "PV =", "/", "^", "*", "×", "+ "
import re
def is_numerical_q(q):
    text = q["question"]
    # Has currency/unit/numeric magnitude markers
    return bool(re.search(r"[₹$%]|\d+\s?(crore|cr|lakh|years?|months?|months|bps)|\d+\.\d|\d{2,}", text, re.I))

def explanation_has_formula(expl):
    if not expl: return False
    # A formula usually has: a named variable letter followed by '=', or '×' or '^' or 'sigma' or 'sqrt'
    patterns = [
        r"[A-Za-z]+\s*=\s*",            # like "FV = ..."
        r"\^\d",                          # exponent
        r"×\s*\(",                        # multiplication with parentheses
        r"\(\s*1\s*\+\s*r",               # discount factor pattern
        r"σ\s*=",                         # sigma =
        r"\bformula\b",                   # explicit
    ]
    return any(re.search(p, expl) for p in patterns)

def explanation_is_substantive(expl):
    if not expl: return False
    # Heuristic: long enough AND mentions "because" / "since" / "intuition" or breaks down each option
    return len(expl) >= 200 or ("because" in expl.lower() or "intuition" in expl.lower())

# Categorize
needs_formula = []
needs_depth = []
fine = []
for q in qs:
    e = q.get("explanation") or ""
    if is_numerical_q(q):
        if not explanation_has_formula(e):
            needs_formula.append(q)
        elif not explanation_is_substantive(e):
            needs_depth.append(q)
        else:
            fine.append(q)
    else:
        if explanation_is_substantive(e):
            fine.append(q)
        else:
            needs_depth.append(q)

print(f"\n=== TRIAGE ===")
print(f"Numerical missing formula: {len(needs_formula)}")
print(f"Missing depth (any kind):  {len(needs_depth)}")
print(f"Already fine:              {len(fine)}")

print(f"\n=== Numerical missing formula (top 15 examples) ===")
for q in needs_formula[:15]:
    print(f"\n  S{q['_session_order']} | {q['_session_title'][:30]} | Q{q.get('order_index')}")
    print(f"    Q: {q['question'][:140]}")
    print(f"    E: {(q.get('explanation') or '')[:200]}")

print(f"\n=== Missing depth (top 8 examples) ===")
for q in needs_depth[:8]:
    print(f"\n  S{q['_session_order']} | {q['_session_title'][:30]} | Q{q.get('order_index')}")
    print(f"    Q: {q['question'][:140]}")
    print(f"    E: {(q.get('explanation') or '')[:200]}")

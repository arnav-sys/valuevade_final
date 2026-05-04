#!/usr/bin/env python3
"""Verify the changes are live in Supabase + structural sanity check."""
import json, urllib.request

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

def get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers={
        "apikey": SR_KEY, "Authorization": f"Bearer {SR_KEY}",
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

# 1. Verify the 3 target cards
target_ids = {
    "444fdbc8-ee54-4d36-bc6c-4155d36e23ce": ("S2", "Risk & Return", 3),
    "2a57ec87-50f8-4e92-8b9c-7e8f7840a730": ("S6", "Income Statement HUL", 11),
    "c0ff08d9-9381-412e-a4a6-d64b10e27bba": ("S12", "Yield Curve", 5),
}

print("TARGET CARDS VERIFICATION")
print("=" * 80)
for cid, (label, name, expected_count) in target_ids.items():
    cards = get(f"master_notes_cards?id=eq.{cid}&select=title,content")
    c = cards[0]
    formulas = c["content"].get("formulas", [])
    print(f"\n{label} | {c['title']}")
    print(f"  Formulas: {len(formulas)} (expected {expected_count}) {'✓' if len(formulas)==expected_count else '✗'}")
    has_excel_shortcuts = "excel_shortcuts" in c["content"]
    print(f"  Has excel_shortcuts: {has_excel_shortcuts} (must be False for S6/S12){' ✓' if not has_excel_shortcuts else ' ✗'}")
    # Coverage check on each formula
    for f in formulas:
        name = f.get("name") or f.get("metric") or "?"
        has_v = bool(f.get("variables"))
        has_pe = bool(f.get("plain_english"))
        has_comp = bool(f.get("computation"))
        has_we = bool(f.get("worked_example"))
        flag = "✓" if all([has_v, has_pe, has_comp, has_we]) else "⚠"
        print(f"  {flag} {name[:50]:50s} v={has_v} pe={has_pe} c={has_comp} we={has_we}")

# Confirm S2 no longer has Sharpe/CAPM
s2 = get(f"master_notes_cards?id=eq.444fdbc8-ee54-4d36-bc6c-4155d36e23ce&select=content")[0]
names = [f["name"] for f in s2["content"]["formulas"]]
has_sharpe = any("Sharpe" in n for n in names)
has_capm = any("CAPM" in n for n in names)
print(f"\nS2 has Sharpe? {has_sharpe} | has CAPM? {has_capm} | should be False/False")

# 2. Sanity check across all 119 cards: each card must have a `formulas` array OR top-level
print("\n\nALL FORMULA CARDS COVERAGE")
print("=" * 80)
all_cards = get("master_notes_cards?card_type=eq.formula&select=id,session_id,title,content")
print(f"Total: {len(all_cards)} formula cards")

incomplete = []
for c in all_cards:
    content = c["content"]
    if not isinstance(content, dict):
        continue
    formulas = content.get("formulas") if isinstance(content.get("formulas"), list) else None
    if formulas:
        for f in formulas:
            if not isinstance(f, dict):
                continue
            has_v = bool(f.get("variables") or f.get("vars") or f.get("symbols"))
            has_pe = any(f.get(k) for k in ("plain_english","notes","description","explanation","intuition","tells"))
            has_we = bool(f.get("worked_example") or f.get("example") or f.get("example_calculation"))
            if not (has_v and has_pe and has_we):
                incomplete.append((c["title"][:50], f.get("name") or f.get("metric") or "?"))

print(f"Formulas missing variables OR plain-english/notes OR worked_example: {len(incomplete)}")
for t, n in incomplete[:20]:
    print(f"  - {t:50s} | {n[:50]}")

print("\n" + "=" * 80)
print("VERIFICATION DONE")

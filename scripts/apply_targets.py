#!/usr/bin/env python3
"""
Step 1: Apply manual content rewrites for the 3 target sessions:
  - Session 2 (Risk & Return): drop Sharpe & CAPM, keep HPR/E(R)/σ
  - Session 6 (Income Statement, HUL): add variables/meanings to every metric
  - Session 12 (M10 S4 Yield Curve): full rewrite, 5 formulas
Patches `master_notes_cards.title` and `master_notes_cards.content` only.
"""
import json
import sys
import urllib.request

sys.path.insert(0, "/app/scripts")
from target_cards_content import (
    S2_TITLE, S2_CONTENT,
    S6_TITLE, S6_CONTENT,
    S12_TITLE, S12_CONTENT,
)

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

TARGETS = [
    {
        "id": "444fdbc8-ee54-4d36-bc6c-4155d36e23ce",
        "label": "S2 Risk & Return",
        "title": S2_TITLE,
        "content": S2_CONTENT,
    },
    {
        "id": "2a57ec87-50f8-4e92-8b9c-7e8f7840a730",
        "label": "S6 Income Statement (HUL)",
        "title": S6_TITLE,
        "content": S6_CONTENT,
    },
    {
        "id": "c0ff08d9-9381-412e-a4a6-d64b10e27bba",
        "label": "S12 Yield Curve",
        "title": S12_TITLE,
        "content": S12_CONTENT,
    },
]


def patch(card_id, payload):
    url = f"{SUPABASE_URL}/rest/v1/master_notes_cards?id=eq.{card_id}"
    req = urllib.request.Request(
        url,
        method="PATCH",
        data=json.dumps(payload).encode(),
        headers={
            "apikey": SR_KEY,
            "Authorization": f"Bearer {SR_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


for t in TARGETS:
    print(f"\n=== Patching {t['label']} (id={t['id']}) ===")
    res = patch(t["id"], {"title": t["title"], "content": t["content"]})
    if res:
        print(f"  ✓ Updated. Title now: {res[0]['title']}")
        print(f"  ✓ Formulas count: {len(res[0]['content'].get('formulas', []))}")
    else:
        print(f"  ✗ FAILED — empty response (RLS blocked or id not found)")
        sys.exit(1)

print("\nAll 3 target cards patched successfully.")

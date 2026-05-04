#!/usr/bin/env python3
"""Dry-run: report which cards already have full 4-component coverage."""
import json, sys
sys.path.insert(0, "/app/scripts")
from enhance_formula_cards import has_full_coverage, ALREADY_PATCHED

cards = json.loads(open("/app/scripts/formula_cards_dump.json").read())

complete, missing, target = [], [], []
for c in cards:
    if c["id"] in ALREADY_PATCHED:
        target.append(c); continue
    (complete if has_full_coverage(c["content"]) else missing).append(c)

print(f"Total formula cards: {len(cards)}")
print(f"  Targets (already patched manually): {len(target)}")
print(f"  Already complete (will skip):       {len(complete)}")
print(f"  Need enhancement:                   {len(missing)}")
print()
print("Cards needing enhancement (first 20):")
for c in missing[:20]:
    print(f"  M{c['_module_number']} S{c['_session_number']} | {c['title'][:60]}")

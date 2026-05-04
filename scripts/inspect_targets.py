#!/usr/bin/env python3
"""Pretty-print the 3 target cards + sample of others for structure inspection."""
import json

cards = json.loads(open("/app/scripts/formula_cards_dump.json").read())

target_session_ids = {
    "081d48c1-4ce7-4fec-b8df-de49a8cdc0ab": "S2 Risk & Return",
    "c3a21f75-1dac-4656-9264-1cb37ed802c1": "S6 Income Statement",
    "d9245331-2437-4f18-9bb2-df30914b2117": "S12 Yield Curve",
}

print("=" * 90)
print("THREE TARGET CARDS — full content")
print("=" * 90)
for c in cards:
    if c["session_id"] in target_session_ids:
        label = target_session_ids[c["session_id"]]
        print(f"\n\n#### {label} | id={c['id']} ####")
        print(f"TITLE: {c['title']}")
        print(json.dumps(c["content"], indent=2, ensure_ascii=False)[:6000])

# Also examine 3 random "normal" cards to see schema variation
import random
random.seed(7)
others = [c for c in cards if c["session_id"] not in target_session_ids]
print("\n\n" + "=" * 90)
print("SAMPLE OF 3 OTHER FORMULA CARDS (truncated)")
print("=" * 90)
for c in random.sample(others, 3):
    print(f"\n\n--- M{c['_module_number']} S{c['_session_number']} | {c['title']} ---")
    print(json.dumps(c["content"], indent=2, ensure_ascii=False)[:2500])

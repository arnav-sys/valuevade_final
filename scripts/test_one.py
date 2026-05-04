#!/usr/bin/env python3
"""Test enhancement on a single card."""
import asyncio, json, sys
sys.path.insert(0, "/app/scripts")
from enhance_formula_cards import enhance_one

cards = json.loads(open("/app/scripts/formula_cards_dump.json").read())

# Pick the TVM formulas card (M1 S1) — has decent existing structure
test_card = next(c for c in cards if c["id"] == "1dcdb9f4-1bf3-451c-a324-3f236586397d")

async def run():
    r = await enhance_one(test_card)
    print(json.dumps(r, indent=2))

asyncio.run(run())

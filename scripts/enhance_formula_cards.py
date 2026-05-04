#!/usr/bin/env python3
"""
Step 2: Enhance the remaining 116 formula cards using Claude Sonnet 4.5.

For each formula in each card:
  - Variable definitions — every symbol/term must have its meaning defined
  - Plain-English explanation — what the formula tells you, why it matters
  - Computation guidance — step-by-step calculation
  - Worked example — preserve if present; add if missing

Cards already containing all four components stay UNTOUCHED.

Strategy:
  - For each card, send Claude the existing `content` JSON
  - Claude returns a new JSON with ONLY missing fields added; existing fields
    must be preserved verbatim
  - We validate & write back via Supabase REST PATCH (service-role key)

Skips the 3 already-patched targets.
"""
import os
import json
import sys
import time
import urllib.request
import asyncio
from pathlib import Path

# ------- env / config -------
SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"
EMERGENT_LLM_KEY = "sk-emergent-9D489F2856aA371C5D"

ALREADY_PATCHED = {
    "444fdbc8-ee54-4d36-bc6c-4155d36e23ce",  # S2
    "2a57ec87-50f8-4e92-8b9c-7e8f7840a730",  # S6
    "c0ff08d9-9381-412e-a4a6-d64b10e27bba",  # S12
}

DUMP = Path("/app/scripts/formula_cards_dump.json")
LOG_DIR = Path("/app/scripts/enhancement_log")
LOG_DIR.mkdir(exist_ok=True)
SUMMARY_FILE = LOG_DIR / "summary.json"

from emergentintegrations.llm.chat import LlmChat, UserMessage

SYSTEM_PROMPT = """You are a senior finance educator and equity research analyst. Your job is to enhance Supabase JSON content for "formula" cards used by finance students preparing for equity research roles in India.

For EACH formula entry inside the card's content, ensure the entry contains ALL FOUR of these components. Add ONLY whatever is MISSING. Preserve every existing field verbatim — do not rephrase or remove anything that is already there.

The four required components per formula:

1. **variables** — an array of objects, each {"symbol": "...", "meaning": "..."}.
   Every symbol or named term that appears in the formula must be defined. If the existing entry already has variables in object form ({"FV": "...", "PV": "..."}), KEEP IT AS IS. If it is missing or incomplete, add it as an array of {symbol, meaning} objects.

2. **plain_english** — a short paragraph (2–4 sentences) explaining in plain English what the formula tells you and why it matters. NO mathematical re-derivation — pure intuition. Skip if a plain_english/notes/description field already meaningfully covers the intuition.

3. **computation** — an array of step strings showing how to calculate it where non-obvious. Skip if the formula is trivial (e.g., "Revenue − COGS") AND a clear example is already present.

4. **worked_example** — an object {problem, steps[], result, insight}. PRESERVE any existing worked_example exactly. If missing for a key formula, add a realistic Indian-market worked example (use companies like HUL, TCS, Infosys, Asian Paints, ITC, Bajaj Finance, Reliance, Tata Motors, ICICI Bank). Use ₹ for currency.

CRITICAL RULES:
- Preserve the OUTER JSON SHAPE of `content`. If the original has a top-level `formulas` array, keep that array. If the original has top-level named keys (like `wacc_formula`, `capm_formula`), preserve those keys. Do not reorganise.
- Preserve EVERY existing key inside each formula entry, including `excel`, `analyst_note`, `sensitivity`, `sensitivity_note`, `tells`, `metric`, `name`, `formula`, etc.
- DO NOT add or modify any `excel_shortcuts` field at the top level — leave it exactly as-is in the original.
- DO NOT change keys you did not explicitly need to add. For example, if a formula uses the key `notes` for its plain-English description, keep `notes` and DO NOT also add `plain_english`.
- If a formula entry is already complete (variables defined, plain English/notes present, worked example present, computation either present or trivially obvious from the formula), return it UNCHANGED in the output.
- Output strictly valid JSON. No markdown fences. No commentary.
- Keep new prose concise, professional, India-context-aware, and free of marketing hype.

INPUT will be the existing `content` JSON of a single card. OUTPUT must be the enhanced `content` JSON, same outer shape, with the four-component coverage filled in for every formula. Output JSON only — no explanation."""


def patch_card(card_id, new_content):
    url = f"{SUPABASE_URL}/rest/v1/master_notes_cards?id=eq.{card_id}"
    req = urllib.request.Request(
        url, method="PATCH",
        data=json.dumps({"content": new_content}).encode(),
        headers={
            "apikey": SR_KEY, "Authorization": f"Bearer {SR_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def has_full_coverage(content):
    """Quick pre-check: do all formula entries already have variables AND
    (plain_english OR notes OR description) AND worked_example?
    This is a heuristic to skip clearly-complete cards without an LLM call."""
    if not isinstance(content, dict):
        return False

    formulas = content.get("formulas")
    if isinstance(formulas, list) and formulas:
        candidates = formulas
    else:
        # Try to detect named formula entries at top level
        candidates = [
            v for k, v in content.items()
            if isinstance(v, dict)
            and any(kk in v for kk in ("formula", "equation", "expression"))
        ]
        if not candidates:
            return False

    for f in candidates:
        if not isinstance(f, dict):
            return False
        has_vars = bool(f.get("variables") or f.get("vars") or f.get("symbols"))
        has_plain = any(f.get(k) for k in ("plain_english", "notes", "description", "explanation", "intuition"))
        has_we = bool(f.get("worked_example") or f.get("example") or f.get("example_calculation"))
        if not (has_vars and has_plain and has_we):
            return False
    return True


async def enhance_one(card):
    """Run one card through Claude and patch it if changed."""
    cid = card["id"]
    label = f"M{card['_module_number']} S{card['_session_number']} | {card['title'][:60]}"
    log_file = LOG_DIR / f"{cid}.json"

    if cid in ALREADY_PATCHED:
        return {"id": cid, "status": "skipped_target", "label": label}

    if has_full_coverage(card["content"]):
        return {"id": cid, "status": "skipped_complete", "label": label}

    user_text = (
        f"Card title: {card['title']}\n"
        f"Existing content JSON (enhance and return enhanced JSON only):\n\n"
        + json.dumps(card["content"], ensure_ascii=False, indent=2)
    )

    def _sync_call():
        chat = (
            LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"enhance-{cid}",
                system_message=SYSTEM_PROMPT,
            )
            .with_model("anthropic", "claude-haiku-4-5-20251001")
            .with_params(max_tokens=6000)
        )
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(chat.send_message(UserMessage(text=user_text)))
        finally:
            loop.close()

    last_err = None
    loop = asyncio.get_event_loop()
    for attempt in range(3):
        try:
            reply = await loop.run_in_executor(None, _sync_call)
            text = reply.strip()
            if text.startswith("```"):
                text = text.strip("`")
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
                if text.endswith("```"):
                    text = text[:-3].strip()
            new_content = json.loads(text)
            if not isinstance(new_content, (dict, list)):
                raise ValueError("Top-level not dict/list")
            log_file.write_text(json.dumps({
                "id": cid, "label": label,
                "before": card["content"],
                "after": new_content,
            }, ensure_ascii=False, indent=2))
            patch_card(cid, new_content)
            return {"id": cid, "status": "enhanced", "label": label}
        except Exception as e:
            last_err = e
            await asyncio.sleep(2 + attempt * 2)

    return {"id": cid, "status": "error", "label": label, "error": str(last_err)}


async def main():
    cards = json.loads(DUMP.read_text())
    # Concurrency: process 6 cards in parallel to shrink wall-clock
    sem = asyncio.Semaphore(3)
    results = []
    completed = 0
    total = len(cards)

    async def run_with_sem(idx, c):
        nonlocal completed
        async with sem:
            t0 = time.time()
            r = await enhance_one(c)
            r["seconds"] = round(time.time() - t0, 1)
            r["idx"] = idx
            return r

    tasks = [asyncio.create_task(run_with_sem(i, c)) for i, c in enumerate(cards)]
    for fut in asyncio.as_completed(tasks):
        r = await fut
        results.append(r)
        completed += 1
        SUMMARY_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2))
        print(
            f"[{completed}/{total}] {r['status']:20s} ({r['seconds']:.1f}s) {r['label']}",
            flush=True,
        )
        if r["status"] == "error":
            print(f"   ↳ {r['error'][:200]}", flush=True)

    by_status = {}
    for r in results:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
    print("\n=== SUMMARY ===", flush=True)
    for k, v in by_status.items():
        print(f"  {k}: {v}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())

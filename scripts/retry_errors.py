#!/usr/bin/env python3
"""Re-run only the cards that errored in the first pass.
Use Claude Sonnet 4.5 with max_tokens=12000 to avoid output truncation."""
import os, json, sys, asyncio, time, urllib.request
from pathlib import Path

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"
EMERGENT_LLM_KEY = "sk-emergent-9D489F2856aA371C5D"

from emergentintegrations.llm.chat import LlmChat, UserMessage
sys.path.insert(0, "/app/scripts")
from enhance_formula_cards import SYSTEM_PROMPT, patch_card

DUMP = Path("/app/scripts/formula_cards_dump.json")
LOG_DIR = Path("/app/scripts/enhancement_log")
SUMMARY_FILE = LOG_DIR / "summary.json"


def sync_call(model, max_tokens, system, user_text, session_id):
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system)
        .with_model("anthropic", model)
        .with_params(max_tokens=max_tokens)
    )
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(chat.send_message(UserMessage(text=user_text)))
    finally:
        loop.close()


async def retry(card, model, max_tokens):
    cid = card["id"]
    label = f"M{card['_module_number']} S{card['_session_number']} | {card['title'][:60]}"
    user_text = (
        f"Card title: {card['title']}\n"
        f"Existing content JSON (enhance and return enhanced JSON only):\n\n"
        + json.dumps(card["content"], ensure_ascii=False, indent=2)
    )
    loop = asyncio.get_event_loop()
    last_err = None
    for attempt in range(3):
        try:
            reply = await loop.run_in_executor(
                None, sync_call, model, max_tokens, SYSTEM_PROMPT, user_text, f"retry-{cid}-{attempt}"
            )
            text = reply.strip()
            if text.startswith("```"):
                text = text.strip("`")
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
                if text.endswith("```"):
                    text = text[:-3].strip()
            new_content = json.loads(text)
            log_file = LOG_DIR / f"{cid}.json"
            log_file.write_text(json.dumps({
                "id": cid, "label": label,
                "before": card["content"],
                "after": new_content,
                "model": model,
            }, ensure_ascii=False, indent=2))
            patch_card(cid, new_content)
            return {"id": cid, "status": "enhanced", "label": label}
        except Exception as e:
            last_err = e
            await asyncio.sleep(3 + attempt * 4)
    return {"id": cid, "status": "error", "label": label, "error": str(last_err)}


async def main():
    summary = json.loads(SUMMARY_FILE.read_text())
    error_ids = {r["id"] for r in summary if r["status"] == "error"}
    cards = json.loads(DUMP.read_text())
    to_retry = [c for c in cards if c["id"] in error_ids]

    print(f"Retrying {len(to_retry)} cards with Haiku 4.5, max_tokens=12000")
    sem = asyncio.Semaphore(2)

    async def run(c):
        async with sem:
            t0 = time.time()
            r = await retry(c, "claude-haiku-4-5-20251001", 12000)
            r["seconds"] = round(time.time() - t0, 1)
            return r

    tasks = [asyncio.create_task(run(c)) for c in to_retry]
    fixed = []
    for fut in asyncio.as_completed(tasks):
        r = await fut
        fixed.append(r)
        print(f"  {r['status']:12s} ({r['seconds']:.1f}s) {r['label']}", flush=True)
        if r.get("error"):
            print(f"    ↳ {r['error'][:200]}", flush=True)

    # Update master summary
    by_id = {r["id"]: r for r in summary}
    for r in fixed:
        by_id[r["id"]] = {**by_id.get(r["id"], {}), **r}
    SUMMARY_FILE.write_text(json.dumps(list(by_id.values()), ensure_ascii=False, indent=2))

    by = {}
    for r in by_id.values():
        by[r["status"]] = by.get(r["status"], 0) + 1
    print(f"\nFinal: {by}")


if __name__ == "__main__":
    asyncio.run(main())

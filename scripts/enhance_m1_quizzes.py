#!/usr/bin/env python3
"""
Enhance every Module 1 quiz explanation to follow a consistent template:

  1. Formula (named) — general form, with key variables defined inline
  2. Substitution — plug values into the formula, showing each step
  3. Result — the numerical answer (when applicable)
  4. Why the correct option is right
  5. Per-option breakdown — why A / B / C / D are wrong (explicitly addressing each)
  6. 1–2 sentence intuition (the mental model the analyst should keep)

Conceptual / non-numerical questions skip steps 2–3 but keep all others.

Updates only the `explanation` column of master_quiz_questions.
"""
import os, json, sys, time, asyncio, urllib.request
from pathlib import Path

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"
EMERGENT_LLM_KEY = "sk-emergent-9D489F2856aA371C5D"

LOG_DIR = Path("/app/scripts/quiz_log")
LOG_DIR.mkdir(exist_ok=True)
SUMMARY_FILE = LOG_DIR / "summary.json"

from emergentintegrations.llm.chat import LlmChat, UserMessage

SYSTEM_PROMPT = """You are a senior finance educator preparing answer-key explanations for a Module 1 finance quiz aimed at Indian equity-research aspirants.

You will receive a single multiple-choice question with its options, the correct answer index, the session topic, and the existing explanation. Your job is to REWRITE the `explanation` field so it follows this consistent template:

═══════════════════════════════════
TEMPLATE — every explanation must contain these sections in order:

**Formula:** State the named formula in its general form, with a one-line note defining key variables. (For pure-conceptual questions, replace this with a short conceptual definition labelled "Concept:")

**Step-by-step:** Substitute the given values into the formula and show the calculation across 2–4 short steps. (Skip for pure-conceptual questions.)

**Result:** State the final numerical answer. (Skip for pure-conceptual questions.)

**Why this is correct:** 1–2 sentences explaining why the chosen option is the right answer in plain English.

**Why the others are wrong:** Address EACH incorrect option (A, B, C, D as applicable) on a separate line — explain the specific mistake or misconception each one represents.

**Intuition:** 1–2 sentences capturing the analyst-level mental model — why this matters in real equity research practice.

═══════════════════════════════════

CRITICAL RULES:
- Use ₹ for Indian rupee values; preserve all numeric values from the original question.
- Use plain text formatting — no markdown headers, no asterisks for bold, no bullet characters. Use the section labels as plain text followed by a colon, then the content.
- Separate sections with a single blank line so the rendered explanation reads clearly.
- Reference options by letter (A, B, C, D) where the option index 0=A, 1=B, 2=C, 3=D.
- Keep prose tight — no padding, no marketing tone, no exclamation marks.
- For numerical questions, the formula must be shown explicitly with named variables (e.g., "FV = PV × (1 + r)^n where FV = future value, PV = present value, r = rate per period, n = periods"), NOT just the numeric calculation.
- For conceptual questions, lead with "Concept:" and keep the depth equivalent.

OUTPUT format: return ONLY a JSON object of the shape:
{"explanation": "<rewritten explanation as a single string>"}
No markdown fences, no commentary, no extra fields. The explanation string must use real newlines (\\n) between sections."""


def patch_explanation(qid, explanation):
    url = f"{SUPABASE_URL}/rest/v1/master_quiz_questions?id=eq.{qid}"
    req = urllib.request.Request(
        url, method="PATCH",
        data=json.dumps({"explanation": explanation}).encode(),
        headers={
            "apikey": SR, "Authorization": f"Bearer {SR}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    with urllib.request.urlopen(req) as r:
        return r.status


def sync_call(user_text):
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"quiz-{time.time_ns()}",
                system_message=SYSTEM_PROMPT)
        .with_model("anthropic", "claude-haiku-4-5-20251001")
        .with_params(max_tokens=2500)
    )
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(chat.send_message(UserMessage(text=user_text)))
    finally:
        loop.close()


async def enhance_one(q):
    correct_letter = "ABCD"[q["correct_answer_index"]]
    options_lines = "\n".join(
        f"  {l}) {opt}"
        for l, opt in zip("ABCD", q["options"])
    )
    user_text = (
        f"Session topic: {q['_session_title']} (Module 1, Session {q['_session_order']})\n"
        f"Difficulty: {q.get('difficulty','medium')}\n\n"
        f"Question: {q['question']}\n\n"
        f"Options:\n{options_lines}\n\n"
        f"Correct answer: {correct_letter} ({q['options'][q['correct_answer_index']]})\n\n"
        f"Existing explanation:\n{q.get('explanation') or '(none)'}\n\n"
        f"Rewrite the explanation per the template. Return JSON only: {{\"explanation\": \"...\"}}"
    )

    loop = asyncio.get_event_loop()
    last_err = None
    for attempt in range(3):
        try:
            reply = await loop.run_in_executor(None, sync_call, user_text)
            text = reply.strip()
            if text.startswith("```"):
                text = text.strip("`")
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
                if text.endswith("```"):
                    text = text[:-3].strip()
            obj = json.loads(text)
            new_expl = obj["explanation"].strip()
            if len(new_expl) < 100:
                raise ValueError(f"Suspiciously short: {len(new_expl)} chars")
            (LOG_DIR / f"{q['id']}.json").write_text(json.dumps({
                "id": q["id"],
                "question": q["question"],
                "before": q.get("explanation"),
                "after": new_expl,
            }, ensure_ascii=False, indent=2))
            patch_explanation(q["id"], new_expl)
            return {"id": q["id"], "status": "enhanced",
                    "label": f"S{q['_session_order']} Q{q.get('order_index')}: {q['question'][:60]}"}
        except Exception as e:
            last_err = e
            await asyncio.sleep(2 + attempt * 3)
    return {"id": q["id"], "status": "error",
            "label": f"S{q['_session_order']} Q{q.get('order_index')}",
            "error": str(last_err)}


async def main():
    qs = json.loads(Path("/app/scripts/m1_quiz_dump.json").read_text())
    print(f"Enhancing {len(qs)} Module 1 quiz explanations...")
    sem = asyncio.Semaphore(4)
    results = []
    completed = 0
    total = len(qs)

    async def run(q):
        async with sem:
            t0 = time.time()
            r = await enhance_one(q)
            r["seconds"] = round(time.time() - t0, 1)
            return r

    tasks = [asyncio.create_task(run(q)) for q in qs]
    for fut in asyncio.as_completed(tasks):
        r = await fut
        results.append(r)
        completed += 1
        SUMMARY_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2))
        print(f"[{completed}/{total}] {r['status']:10s} ({r['seconds']:.1f}s) {r['label']}", flush=True)
        if r.get("error"):
            print(f"   ↳ {r['error'][:200]}", flush=True)

    by = {}
    for r in results:
        by[r["status"]] = by.get(r["status"], 0) + 1
    print(f"\nSUMMARY: {by}")


if __name__ == "__main__":
    asyncio.run(main())

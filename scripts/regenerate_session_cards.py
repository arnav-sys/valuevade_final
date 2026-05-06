#!/usr/bin/env python3
"""
Regenerate hook + concept + formula + deep-dive + example notes cards for one
session using Claude Sonnet 4.5 (via emergentintegrations).

The user asked for content that is:
  • detailed but NOT complex (simple, accessible)
  • fun + engaging + uses storytelling
  • teaches enough to solve every quiz / interview / sim question for the session

Schema preserved per existing renderer expectations in NotesPage.jsx:
  • hook       → { scenario, insight, why_it_matters }
  • concept    → { heading, definition, key_terms[], core_principle }
  • formula    → { formulas: [{ metric, formula, tells, plain_english,
                                 variables[], computation? }] }
  • deep-dive  → { sections: [{ heading, text }] }
  • example    → { story, data:{headers,rows}, analysis:[] }

Usage:
  EMERGENT_LLM_KEY=... python3 scripts/regenerate_session_cards.py <session_id>
"""
import asyncio
import json
import os
import sys
import urllib.request
import urllib.error

from emergentintegrations.llm.chat import LlmChat, UserMessage

SUP = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"
KEY = os.environ.get("EMERGENT_LLM_KEY") or "sk-emergent-9D489F2856aA371C5D"

CARD_TYPES = ["hook", "concept", "formula", "deep-dive", "example"]


def sb(method, path, body=None, want_json=True):
    url = f"{SUP}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, method=method, data=data, headers={
        "apikey": SR, "Authorization": f"Bearer {SR}",
        "Content-Type": "application/json", "Prefer": "return=representation",
    })
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            t = resp.read().decode()
            return json.loads(t) if want_json and t else t
    except urllib.error.HTTPError as e:
        print("ERR:", e.read().decode()); raise


SCHEMA_DOC = """
You MUST output a single JSON object with EXACTLY these 5 top-level keys:
"hook", "concept", "formula", "deep-dive", "example"

The shape of each value is fixed. DO NOT add extra keys outside what's specified.
DO NOT use markdown (no **bold**, no _italic_, no headings with #).
Use plain prose. Indian context. Indian companies, ₹ amounts, INR.

Each shape:

"hook" : {
  "scenario": "<2-3 sentence story-style opener that pulls the reader in. Concrete Indian company / situation / number. NO jargon.>",
  "insight": "<1-2 sentence aha moment. The single big idea this session unlocks. Memorable.>",
  "why_it_matters": "<1-2 sentence callout of why an analyst should care, framed as a stake-in-the-ground future-self statement.>"
}

"concept" : {
  "heading": "<5-8 word headline of the core mental model>",
  "definition": "<3-4 sentence explanation in PLAIN English. Use a concrete analogy in the second sentence. NO jargon without instant translation.>",
  "key_terms": [
    {"term": "<short term>", "definition": "<one-line plain-English definition>"}
    // 5 to 8 entries — every term that appears in the session's quiz/interview must be here
  ],
  "core_principle": "<one-sentence first-principles takeaway the reader can quote.>"
}

"formula" : {
  "formulas": [
    {
      "metric": "<formula name>",
      "formula": "<the expression — use ASCII, no LaTeX>",
      "tells": "<what the result tells you, 6-10 words>",
      "plain_english": "<2-3 sentences explaining what this measures and when to reach for it. Use a concrete example with numbers.>",
      "variables": [
        {"symbol": "<symbol or short label>", "meaning": "<one-line meaning>"}
      ],
      "computation": "<one worked example: plug in numbers, show the answer, interpret it. 2-3 sentences.>"
    }
    // ~3 to 5 formulas — cover EVERY ratio/formula referenced in the session's quiz/interview/sim
  ]
}

"deep-dive" : {
  "sections": [
    {
      "heading": "<5-8 word section title>",
      "text": "<3-5 sentences. Each section should add NEW depth, ideally a real Indian-company anecdote (TCS, IL&FS, Yes Bank, Vodafone Idea, Asian Paints, Bajaj Finance, Reliance, etc) or a counter-intuitive insight. STORYTELLING.>"
    }
    // 4 to 6 sections
  ]
}

"example" : {
  "story": "<2-3 sentence narrative wrapper that introduces the worked example like a case-study mini-story>",
  "data": {
    "headers": ["<col1>", "<col2>", "<col3>"],
    "rows": [
      ["<row label>", "<value>", "<value>"]
      // 6-10 rows comparing 2 real or realistic companies
    ]
  },
  "analysis": [
    "<one bullet of insight from the data — 2 sentences max>"
    // 4-6 bullets
  ]
}

CRITICAL RULES:
- Output VALID JSON only. No prose before or after. No code fences.
- Use the EXACT keys above. No extras.
- Be FUN: short sentences, concrete anecdotes, narrative voice. Avoid academic dryness.
- Be SIMPLE: a smart 18-year-old should understand. NO unexplained jargon.
- Be COMPLETE: the 5 cards together must let a learner answer every quiz / interview /
  simulation question listed in the briefing. Audit yourself before outputting.
"""


def build_prompt(session_title, quiz_qs, interview_qs, sims):
    quiz_block = "\n".join(f"  • {q['question']}" for q in quiz_qs)
    iv_block = "\n".join(f"  • {q['question']}" for q in interview_qs)
    sim_block = "\n".join(
        f"  • [{s['sim_type']}] {s['title']}\n      Scenario: {(s.get('scenario') or '')[:600]}"
        for s in sims
    )

    return f"""You are an expert finance educator writing card-style notes for "Valuevade", a premium Indian career-prep platform aimed at finance students aspiring to investment banking, equity research, and corporate strategy roles.

The session you're writing for is:

  SESSION: {session_title}

A learner who reads your 5 cards must, immediately afterwards, be able to confidently answer EVERY question below. So the cards must collectively cover every concept these questions test.

QUIZ QUESTIONS for this session:
{quiz_block}

INTERVIEW QUESTIONS for this session:
{iv_block}

SIMULATIONS for this session:
{sim_block}

Write the 5 cards now, in the EXACT JSON shape below. Tone: Indian context, real company examples (TCS, Asian Paints, Bajaj Finance, IL&FS, Yes Bank, Reliance, Vodafone Idea, Zomato, etc.), narrative voice, fun + memorable. Storytelling matters — open with concrete scenes, not definitions.

{SCHEMA_DOC}

Output the JSON now. Nothing else."""


async def generate_for_session(session_id):
    # Load session metadata + content surface
    sessions = sb("GET", f"master_sessions?id=eq.{session_id}&select=id,title")
    if not sessions:
        raise SystemExit(f"Session {session_id} not found")
    s = sessions[0]

    quiz_qs = sb("GET", f"master_quiz_questions?session_id=eq.{session_id}&select=question&order=order_index")
    iv_qs = sb("GET", f"master_interview_questions?session_id=eq.{session_id}&select=question&order=order_index")
    sims = sb("GET", f"master_simulations?session_id=eq.{session_id}&select=sim_type,title,scenario")

    print(f"\n=== {s['title']} ===")
    print(f"  quiz: {len(quiz_qs)}, interview: {len(iv_qs)}, sims: {len(sims)}")

    chat = (
        LlmChat(
            api_key=KEY,
            session_id=f"vv-cards-{session_id}",
            system_message="You write valid JSON only. No markdown, no prose around the JSON.",
        )
        .with_model("anthropic", "claude-haiku-4-5-20251001")
    )

    prompt = build_prompt(s["title"], quiz_qs, iv_qs, sims)
    print("  Calling Claude Sonnet 4.5...")
    raw = await chat.send_message(UserMessage(text=prompt))

    # Parse — strip code fences if present
    txt = raw.strip()
    if txt.startswith("```"):
        # strip the first fence line and the closing fence
        lines = txt.split("\n")
        # find first { and last }
        start = txt.find("{")
        end = txt.rfind("}")
        txt = txt[start:end + 1]

    try:
        cards = json.loads(txt)
    except json.JSONDecodeError as e:
        out = f"/tmp/vv_cards_{session_id}_RAW.txt"
        with open(out, "w") as f:
            f.write(raw)
        print(f"  JSON parse error: {e}. Raw saved to {out}")
        raise

    # Validate shape
    missing = [k for k in CARD_TYPES if k not in cards]
    if missing:
        print(f"  WARNING: missing keys: {missing}")
        out = f"/tmp/vv_cards_{session_id}_BAD.json"
        with open(out, "w") as f:
            json.dump(cards, f, indent=2)
        print(f"  saved partial to {out}")
        raise SystemExit("incomplete generation")

    # Save artefact
    artefact_path = f"/tmp/vv_cards_{session_id}.json"
    with open(artefact_path, "w") as f:
        json.dump(cards, f, indent=2)
    print(f"  ✓ generation complete, saved to {artefact_path}")
    return cards


def replace_cards(session_id, cards):
    """Delete existing rows for the 5 target card_types, insert new ones."""
    print(f"\nApplying to DB for session {session_id}...")
    # Existing rows for these card_types (need 'in' clause via PostgREST .in.(...))
    types_param = ",".join(CARD_TYPES)
    existing = sb("GET",
        f"master_notes_cards?session_id=eq.{session_id}"
        f"&card_type=in.({types_param})&select=id,card_type,order_index&order=order_index")
    print(f"  existing matching cards: {len(existing)}")

    # Preserve order_indexes — keep the SAME order_index per card_type so the carousel order doesn't shift.
    order_by_type = {row["card_type"]: row["order_index"] for row in existing}
    # Default order if a type is new
    default_order = {"hook": 1, "concept": 2, "formula": 3, "deep-dive": 5, "example": 6}

    # Title fallbacks per card_type if the content doesn't expose a heading
    concept_heading = (cards.get("concept") or {}).get("heading")
    default_title = {
        "hook": "Why this matters",
        "concept": concept_heading or "Core concept",
        "formula": "Formulas you'll need",
        "deep-dive": "Going deeper",
        "example": "Worked example",
    }

    # Delete old
    for row in existing:
        sb("DELETE", f"master_notes_cards?id=eq.{row['id']}", want_json=False)
    print(f"  deleted {len(existing)} old rows")

    # Insert new
    inserted = 0
    for ct in CARD_TYPES:
        content = cards[ct]
        title = content.get("heading") if isinstance(content, dict) else None
        if not title:
            title = default_title[ct]
        row = {
            "session_id": session_id,
            "card_type": ct,
            "title": title,
            "order_index": order_by_type.get(ct, default_order[ct]),
            "content": content,
        }
        sb("POST", "master_notes_cards", body=row, want_json=False)
        inserted += 1
        print(f"  ✓ inserted {ct} (order {row['order_index']}) title={title!r}")
    print(f"  ✓ total inserted: {inserted}")


async def main():
    if len(sys.argv) < 2:
        print("Usage: regenerate_session_cards.py <session_id> [--apply]")
        sys.exit(1)
    session_id = sys.argv[1]
    apply_to_db = "--apply" in sys.argv

    cards = await generate_for_session(session_id)
    if apply_to_db:
        replace_cards(session_id, cards)
    else:
        print("\n(dry run — pass --apply to write to DB)")


if __name__ == "__main__":
    asyncio.run(main())

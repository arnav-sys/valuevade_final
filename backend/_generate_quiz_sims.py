"""
Bulk Quiz + Simulation Generator, Gemini 3 Flash
==================================================
• Generates 5 MCQ quiz questions for every eligible session that lacks them.
• Generates a simulation for every eligible session that lacks one.
• Wipes and regenerates BOTH quiz and sim for M03-S3 "Formatting Like an Analyst".
• Excludes: M16 (NISM Exam), M20 (Interview Mastery), and soft-skill / career modules.

Run:  python3 /app/backend/_generate_quiz_sims.py
"""

import asyncio, json, os, re, sys, traceback, urllib.parse, urllib.request
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

# ── Supabase helpers ─────────────────────────────────────────────────────────
SUPABASE_URL   = os.environ["REACT_APP_SUPABASE_URL"].rstrip("/")
SUPABASE_SR    = os.environ["SUPABASE_SERVICE_ROLE_KEY"]   # service-role for all ops
EMERGENT_KEY   = os.environ["EMERGENT_LLM_KEY"]

# Use service-role key for both reads and writes (server-side script)
_HDR_ANON = {"apikey": SUPABASE_SR, "Authorization": f"Bearer {SUPABASE_SR}"}
_HDR_SR   = {"apikey": SUPABASE_SR, "Authorization": f"Bearer {SUPABASE_SR}",
             "Content-Type": "application/json", "Prefer": "return=representation"}


def sg(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers=_HDR_ANON)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def spost(table, rows):
    """Insert rows (list of dicts) into table."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    data = json.dumps(rows if isinstance(rows, list) else [rows]).encode()
    req = urllib.request.Request(url, data=data, headers=_HDR_SR, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def sdel(table_filter):
    """DELETE rows, table_filter like 'master_quiz_questions?session_id=eq.xxx'"""
    url = f"{SUPABASE_URL}/rest/v1/{table_filter}"
    headers = {**_HDR_SR, "Prefer": "return=minimal"}
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


# ── LLM call ─────────────────────────────────────────────────────────────────
from emergentintegrations.llm.chat import LlmChat, UserMessage


def make_chat():
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"gen-{datetime.now(timezone.utc).timestamp()}",
        system_message=(
            "You are an expert Indian finance education content creator for Valuevade, "
            "a Bloomberg-terminal-aesthetic online course for equity research analysts. "
            "Always return only valid JSON with no markdown fences."
        ),
    )
    chat.with_model("gemini", "gemini-3-flash-preview")
    return chat


async def call_llm(prompt: str) -> str:
    chat = make_chat()
    msg = UserMessage(text=prompt)
    result = await chat.send_message(msg)
    return result.strip()


def clean_json(raw: str) -> str:
    """Strip markdown fences if the model added them."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


# ── Prompt builders ───────────────────────────────────────────────────────────

QUIZ_PROMPT = """You are creating quiz content for Valuevade, an Indian equity-research online course.

Session title: "{title}"
Module: "{module_title}"

Generate exactly 5 multiple-choice quiz questions that test PRACTICAL understanding, not just definitions.
Questions should feel like a real analyst exam, mix conceptual, numerical-reasoning, and application questions.
Use Indian context (Nifty, NSE, BSE, Indian companies, SEBI, RBI, INR) where relevant.

Return ONLY a JSON array. No markdown, no commentary. Schema:
[
  {{
    "question": "Full question text",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correct_answer_index": 0,
    "explanation": "1-2 sentence explanation of WHY this is correct",
    "difficulty": "medium"
  }}
]

Vary difficulty slightly (2 easy, 2 medium, 1 hard). correct_answer_index is 0-based."""


DECISION_SIM_PROMPT = """You are building an interactive simulation for Valuevade, an Indian equity-research online course.

Session title: "{title}"
Module: "{module_title}"

Design a realistic decision-making simulation where the student acts as a junior analyst at an Indian brokerage.
Use a real or plausible Indian company/scenario relevant to this session topic.

Return ONLY a JSON object. No markdown, no commentary. Schema:
{{
  "title": "Short punchy sim title (max 10 words)",
  "difficulty": "medium",
  "config": {{
    "learning_objective": "One sentence: what skill this sim builds",
    "scenario_context": "2-3 sentence setup. Real company/numbers. Indian market context.",
    "initial_data": {{
      "Company": "Company name",
      "Metric 1": "Value with unit",
      "Metric 2": "Value with unit",
      "Metric 3": "Value with unit",
      "Your Role": "Brief role description"
    }},
    "decision_points": [
      {{
        "id": "d1",
        "title": "Decision 1 title",
        "options": [
          {{
            "id": "A",
            "label": "Option A text (1-2 sentences)",
            "consequence": "What happens next + score_impact explanation",
            "score_impact": {{"analysis_quality": 3, "communication": 2}},
            "next_decision": "d2"
          }},
          {{
            "id": "B",
            "label": "Option B text",
            "consequence": "Consequence text",
            "score_impact": {{"analysis_quality": 1, "communication": 1}},
            "next_decision": "d2"
          }},
          {{
            "id": "C",
            "label": "Option C text",
            "consequence": "Consequence text",
            "score_impact": {{"analysis_quality": 0, "communication": 1}},
            "next_decision": "d2"
          }}
        ]
      }},
      {{
        "id": "d2",
        "title": "Decision 2 title",
        "options": [
          {{
            "id": "A",
            "label": "Option A",
            "consequence": "Consequence",
            "score_impact": {{"analysis_quality": 3, "communication": 2}},
            "is_terminal": true
          }},
          {{
            "id": "B",
            "label": "Option B",
            "consequence": "Consequence",
            "score_impact": {{"analysis_quality": 1, "communication": 1}},
            "is_terminal": true
          }},
          {{
            "id": "C",
            "label": "Option C",
            "consequence": "Consequence",
            "score_impact": {{"analysis_quality": 0, "communication": 0}},
            "is_terminal": true
          }}
        ]
      }}
    ],
    "scoring": {{
      "max_total": 10,
      "outcome_mapping": [
        {{"label": "Senior analyst call", "min_total": 8, "narrative": "Excellent reasoning..."}},
        {{"label": "Solid call", "min_total": 5, "narrative": "Good but room for improvement..."}},
        {{"label": "Needs review", "min_total": 1, "narrative": "Revisit the session concepts..."}}
      ]
    }},
    "hints": [
      "Hint 1 relevant to the session topic",
      "Hint 2 with practical formula or rule of thumb",
      "Hint 3 with Indian market context"
    ],
    "source": "ai_generated_v1",
    "generator": "gemini-3-flash-preview"
  }}
}}"""


DOCUMENT_SIM_PROMPT = """You are building an interactive document-analysis simulation for Valuevade, an Indian equity-research online course.

Session title: "{title}"
Module: "{module_title}"

Create a document simulation where the student reads a realistic financial document (annual report excerpt, screener output, research note, balance sheet, etc.) and answers analytical tasks.

Return ONLY a JSON object. No markdown, no commentary. Schema:
{{
  "title": "Short punchy sim title (max 10 words)",
  "difficulty": "medium",
  "config": {{
    "learning_objective": "One sentence: what skill this sim builds",
    "document_data": {{
      "header": "Document title / company",
      "type": "annual_report_excerpt | screener_output | research_note | balance_sheet",
      "rows": [
        {{"label": "Revenue (₹ Cr)", "value": "12,450", "note": "FY24"}},
        {{"label": "EBITDA (₹ Cr)", "value": "2,340"}},
        {{"label": "Net Profit (₹ Cr)", "value": "1,560"}},
        {{"label": "EPS (₹)", "value": "32.4"}},
        {{"label": "ROE (%)", "value": "18.2"}},
        {{"label": "D/E Ratio", "value": "0.42"}},
        {{"label": "P/E Multiple", "value": "24x"}}
      ],
      "context_note": "1-2 sentence context about the company/document"
    }},
    "tasks": [
      {{
        "id": "t1",
        "question": "Calculate/identify specific value or metric from the document",
        "answer_type": "number",
        "expected_value": 2160,
        "tolerance": 10,
        "unit": "₹ Crore",
        "explanation": "Step-by-step explanation of the correct answer"
      }},
      {{
        "id": "t2",
        "question": "Interpret a ratio or trend, requires text reasoning",
        "answer_type": "text",
        "expected_keywords": ["keyword1", "keyword2", "keyword3"],
        "explanation": "What a strong answer includes"
      }},
      {{
        "id": "t3",
        "question": "Open-ended analysis question",
        "answer_type": "free_text",
        "sample_answer": "A model answer demonstrating analyst-level thinking",
        "explanation": "Key points the student should cover"
      }}
    ],
    "hints": [
      "Hint 1 pointing to a specific row in the document",
      "Hint 2 with a formula or ratio definition",
      "Hint 3 with Indian market benchmarks"
    ],
    "interactive_highlights": [],
    "source": "ai_generated_v1",
    "generator": "gemini-3-flash-preview"
  }}
}}

Make the document_data rows realistic for the session topic. Replace the sample rows with topic-appropriate data.
For "how to use screener.in", use screener-style data (filters, ratios, stock list)."""


EXCEL_SIM_PROMPT = """You are building an interactive Excel simulation for Valuevade, an Indian equity-research online course.

Session title: "{title}"
Module: "Excel Fundamentals for Analysts"

Create a simplified Excel workbook simulation where the student formats a financial spreadsheet like a professional analyst.
The simulation should practice: number formatting (₹ Crore), colour coding (blue=input, black=formula), alignment, and borders.

Return ONLY a JSON object. No markdown, no commentary. Schema:
{{
  "title": "Short punchy sim title (max 10 words)",
  "difficulty": "medium",
  "config": {{
    "learning_objective": "One sentence: what formatting skill this builds",
    "multi_tab_excel_workbook": {{
      "sheets": [
        {{
          "name": "Data",
          "cells": {{
            "A1": {{"value": "Titan FY24 P&L (₹)", "bold": true, "readOnly": true}},
            "A2": {{"value": "Revenue", "readOnly": true}},
            "B2": {{"value": 50000000000, "readOnly": true}},
            "A3": {{"value": "Expenses", "readOnly": true}},
            "B3": {{"value": 35000000000, "readOnly": true}},
            "A4": {{"value": "Profit (₹ Cr)", "readOnly": true}},
            "B4": {{"value": "", "readOnly": false, "placeholder": "Enter profit in ₹ crore"}}
          }}
        }},
        {{
          "name": "Answers",
          "cells": {{
            "A1": {{"value": "Instructions", "bold": true, "readOnly": true}},
            "A2": {{"value": "Step 1: In B4 on Data sheet, type the profit in ₹ crore (Revenue - Expenses, converted to crore).", "readOnly": true}},
            "A3": {{"value": "Step 2: In B5 below, enter the formula to convert Revenue from ₹ to ₹ crore.", "readOnly": true}},
            "A4": {{"value": "Revenue (₹ Cr) via formula:", "readOnly": true}},
            "B4": {{"value": "", "readOnly": false, "placeholder": "=Data!B2/10000000"}},
            "A5": {{"value": "Profit margin % formula:", "readOnly": true}},
            "B5": {{"value": "", "readOnly": false, "placeholder": "=B4/Data!B2*100*10000000"}}
          }}
        }}
      ]
    }},
    "expected_answers": {{
      "Data!B4": {{
        "type": "number",
        "points": 30,
        "tolerance": 5,
        "expected_value": 150,
        "formula_pattern": "150"
      }},
      "Answers!B4": {{
        "type": "number",
        "points": 35,
        "tolerance": 1,
        "expected_value": 5000,
        "formula_pattern": "=Data!B2/10000000"
      }},
      "Answers!B5": {{
        "type": "number",
        "points": 35,
        "tolerance": 1,
        "expected_value": 30,
        "formula_pattern": "=B4/Data!B2*100*10000000"
      }}
    }},
    "hints": [
      "Hint about colour coding or formatting rule for this session",
      "Hint with the specific formula or shortcut needed",
      "Hint with the unit conversion (1 crore = 10,000,000)"
    ],
    "source": "ai_generated_v1",
    "generator": "gemini-3-flash-preview"
  }}
}}

IMPORTANT: Replace the sample data with content specific to "{title}". 
The workbook should reflect the formatting concepts taught in this specific session.
Keep the spreadsheet simple, 1-2 tasks maximum, with 2-3 expected_answers."""


# ── Main logic ────────────────────────────────────────────────────────────────

# Modules to SKIP entirely
SKIP_MODULE_NUMS = {14, 15, 16, 18, 20, 21, 22, 23}

# M03-S3 session id (to wipe + regenerate)
M03_S3_TITLE_CONTAINS = "Formatting Like an Analyst"


async def generate_quiz(session_id: str, title: str, module_title: str) -> list:
    prompt = QUIZ_PROMPT.format(title=title, module_title=module_title)
    raw = await call_llm(prompt)
    questions = json.loads(clean_json(raw))
    rows = []
    for i, q in enumerate(questions[:5]):
        rows.append({
            "session_id": session_id,
            "question": q["question"],
            "options": q["options"],
            "correct_answer_index": int(q["correct_answer_index"]),
            "explanation": q.get("explanation", ""),
            "difficulty": q.get("difficulty", "medium"),
            "order_index": i + 1,
        })
    return rows


def _detect_sim_type(title: str, module_num: int) -> str:
    """Auto-detect simulation type from session title and module number."""
    title_lower = title.lower()
    if module_num == 3:
        # Excel module, use excel sim for formatting sessions
        if any(kw in title_lower for kw in ["format", "colour", "color", "layout", "number"]):
            return "excel"
        return "document"
    if any(kw in title_lower for kw in ["screener", "screener.in", "filter", "screen"]):
        return "document"
    if any(kw in title_lower for kw in [
        "valuation", "dcf", "wacc", "cash flow", "terminal value", "relative",
        "multiple", "p/e", "ebitda", "price", "target", "precedent", "sum-of-parts",
        "stress", "scenario", "introduction", "howto", "use"
    ]):
        return "decision_making"
    return "document"


async def generate_sim(session_id: str, title: str, module_title: str, module_num: int) -> dict:
    sim_type = _detect_sim_type(title, module_num)
    if sim_type == "excel":
        prompt = EXCEL_SIM_PROMPT.format(title=title)
    elif sim_type == "decision_making":
        prompt = DECISION_SIM_PROMPT.format(title=title, module_title=module_title)
    else:
        prompt = DOCUMENT_SIM_PROMPT.format(title=title, module_title=module_title)

    raw = await call_llm(prompt)
    parsed = json.loads(clean_json(raw))
    config = parsed.get("config", parsed)
    config["generated_at"] = datetime.now(timezone.utc).isoformat()

    # Extract top-level DB columns from config
    if sim_type == "decision_making":
        scenario_text    = config.get("scenario_context", "")
        objectives_list  = [config.get("learning_objective", title)]
        instructions_txt = (
            "Walk through each decision point and pick the option that best reflects "
            "your analytical judgement. Your choices accumulate scores. At the end "
            "you will receive a performance summary with feedback."
        )
    else:  # document / excel
        doc = config.get("document_data", {})
        scenario_text    = doc.get("context_note") or config.get("learning_objective", title)
        objectives_list  = [config.get("learning_objective", title)]
        instructions_txt = (
            "Read the document carefully, then answer each analytical task. "
            "For number tasks enter a value; for text tasks summarise your reasoning. "
            "Hints are available if you get stuck."
        )

    return {
        "session_id":   session_id,
        "sim_type":     sim_type,
        "title":        parsed.get("title", title[:80]),
        "difficulty":   parsed.get("difficulty", "medium"),
        "scenario":     scenario_text[:500],
        "instructions": instructions_txt[:500],
        "objectives":   objectives_list,
        "config":       config,
    }


async def main():
    print("=" * 65)
    print("VALUEVADE, Quiz & Simulation Bulk Generator")
    print(f"Started: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 65)

    # ── 1. Fetch all data ─────────────────────────────────────────────
    print("\n[1/5] Fetching sessions, modules, quizzes, sims…")
    modules  = sg("master_modules?select=id,title,module_number,is_exam_module&order=module_number&limit=50")
    sessions = sg("master_sessions?select=id,title,order_index,module_id&limit=500")
    quizzes  = sg("master_quiz_questions?select=id,session_id&limit=5000")
    sims     = sg("master_simulations?select=id,session_id,sim_type&limit=1000")

    quiz_by_session = {}
    for q in quizzes:
        quiz_by_session.setdefault(q["session_id"], []).append(q["id"])
    sim_by_session = {}
    for s in sims:
        sim_by_session.setdefault(s["session_id"], []).append(s["id"])

    mod_by_id = {m["id"]: m for m in modules}

    skip_module_ids = {
        m["id"] for m in modules
        if m.get("is_exam_module") or m.get("module_number") in SKIP_MODULE_NUMS
    }

    # ── 2. Identify M03-S3 session to wipe+regenerate ─────────────────
    m03_s3_id = None
    for s in sessions:
        mod = mod_by_id.get(s["module_id"], {})
        if mod.get("module_number") == 3 and M03_S3_TITLE_CONTAINS.lower() in s["title"].lower():
            m03_s3_id = s["id"]
            print(f"\n[2/5] Found M03-S3 to wipe: '{s['title']}' (id={m03_s3_id})")
            break

    if m03_s3_id:
        q_del = sdel(f"master_quiz_questions?session_id=eq.{urllib.parse.quote(m03_s3_id)}")
        s_del = sdel(f"master_simulations?session_id=eq.{urllib.parse.quote(m03_s3_id)}")
        print(f"  Deleted quiz questions (HTTP {q_del}) and simulations (HTTP {s_del})")
        # Remove from tracking so it will be regenerated
        quiz_by_session.pop(m03_s3_id, None)
        sim_by_session.pop(m03_s3_id, None)

    # ── 3. Build work lists ───────────────────────────────────────────
    need_quiz = []
    need_sim  = []
    for s in sessions:
        mid = s["module_id"]
        if mid in skip_module_ids:
            continue
        mod = mod_by_id.get(mid, {})
        if not s.get("id"):
            continue
        if s["id"] not in quiz_by_session:
            need_quiz.append((s, mod))
        if s["id"] not in sim_by_session:
            need_sim.append((s, mod))

    print(f"\n[3/5] Work plan:")
    print(f"  Sessions needing QUIZ: {len(need_quiz)}")
    print(f"  Sessions needing SIM:  {len(need_sim)}")

    # ── 4. Generate quiz questions ────────────────────────────────────
    print(f"\n[4/5] Generating quiz questions…")
    quiz_ok = quiz_fail = 0
    for i, (s, mod) in enumerate(need_quiz, 1):
        mod_num = mod.get("module_number", "?")
        mod_title = mod.get("title", "")
        print(f"  [{i:02d}/{len(need_quiz)}] M{mod_num} S{s['order_index']}: {s['title'][:55]}", end=" … ", flush=True)
        try:
            rows = await generate_quiz(s["id"], s["title"], mod_title)
            spost("master_quiz_questions", rows)
            print(f"✓ {len(rows)} questions")
            quiz_ok += 1
        except Exception as e:
            print(f"✗ FAILED: {e}")
            traceback.print_exc()
            quiz_fail += 1
        await asyncio.sleep(0.5)   # small delay between API calls

    # ── 5. Generate simulations ───────────────────────────────────────
    print(f"\n[5/5] Generating simulations…")
    sim_ok = sim_fail = 0
    for i, (s, mod) in enumerate(need_sim, 1):
        mod_num = mod.get("module_number", "?")
        mod_title = mod.get("title", "")
        print(f"  [{i:02d}/{len(need_sim)}] M{mod_num} S{s['order_index']}: {s['title'][:55]}", end=" … ", flush=True)
        try:
            row = await generate_sim(s["id"], s["title"], mod_title, mod_num or 0)
            spost("master_simulations", row)
            print(f"✓ {row['sim_type']} sim, '{row['title'][:40]}'")
            sim_ok += 1
        except Exception as e:
            print(f"✗ FAILED: {e}")
            traceback.print_exc()
            sim_fail += 1
        await asyncio.sleep(0.5)

    # ── Summary ───────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print(f"DONE, {datetime.now(timezone.utc).isoformat()}")
    print(f"  Quiz:       {quiz_ok} ok, {quiz_fail} failed")
    print(f"  Simulation: {sim_ok} ok, {sim_fail} failed")
    print("=" * 65)
    if quiz_fail or sim_fail:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

"""
M18 AI Module — Rich Notes Generator
=======================================
Generates 7 note cards per session for all 20 M18 sessions.
Cards: hook → concept → deep-dive → example → formula/mistake → summary → study_card

Run:  python3 /app/backend/_generate_ai_notes.py

Flags:
  --session N      Generate only for session at order_index N (1-based)
  --dry-run        Print prompts but don't call LLM or write DB
"""

import asyncio, json, os, re, sys, traceback, urllib.parse, urllib.request, argparse
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

SUPABASE_URL = os.environ["REACT_APP_SUPABASE_URL"].rstrip("/")
SUPABASE_SR  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
EMERGENT_KEY = os.environ["EMERGENT_LLM_KEY"]

_HDR_R  = {"apikey": SUPABASE_SR, "Authorization": f"Bearer {SUPABASE_SR}"}
_HDR_W  = {**_HDR_R, "Content-Type": "application/json", "Prefer": "return=representation"}

M18_MODULE_ID = "6928cd65-c7a8-4b75-bb01-ae7a8a12c547"


# ── Supabase helpers ──────────────────────────────────────────────────────────

def sg(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers=_HDR_R)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def spost(table, rows):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    payload = rows if isinstance(rows, list) else [rows]
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=_HDR_W, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"\n  [spost ERROR] HTTP {e.code}: {body[:300]}")
        raise


def sdel(table_filter):
    url = f"{SUPABASE_URL}/rest/v1/{table_filter}"
    hdrs = {**_HDR_W, "Prefer": "return=minimal"}
    req = urllib.request.Request(url, headers=hdrs, method="DELETE")
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


# ── LLM setup ────────────────────────────────────────────────────────────────

from emergentintegrations.llm.chat import LlmChat, UserMessage

SYSTEM_MSG = """You are a senior content writer for Valuevade — India's sharpest equity-research online course.

Your job: write session notes that feel like a brilliant senior analyst wrote them for a smart friend.
NOT a textbook. NOT a Wikipedia article. Definitely NOT an AI summary.

Writing rules you must follow every time:
- Open with energy. The hook card should grab someone who almost skipped the session.
- Use analogies, short stories, or a surprising fact to make abstract things stick.
- Speak directly to the reader ("you", "your portfolio", "your report").
- Use Indian context: Nifty, SEBI, NSE, Reliance, Infosys, HDFC, Zomato, real INR numbers.
- Mix short punchy sentences with longer analytical ones — avoid wall-of-text.
- Bold exactly the terms that matter. No random bolding.
- Use markdown tables where a comparison or formula is cleaner as a table.
- study_card type = a hands-on self-check the reader does right now, not passive review.
- Each card should stand alone — a reader who sees only that card still learns something complete.
- Never use generic AI filler: "In conclusion", "It is important to note", "As an AI language model".
- Do not start sentences with "This session covers..." or "In this module...".

Return ONLY a valid JSON array. No markdown fences, no commentary outside the JSON."""


def make_chat(session_num):
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"ai-notes-s{session_num:02d}-{datetime.now(timezone.utc).timestamp():.0f}",
        system_message=SYSTEM_MSG,
    )
    chat.with_model("gemini", "gemini-3-flash-preview")
    return chat


async def call_llm(prompt: str, session_num: int) -> str:
    chat = make_chat(session_num)
    msg  = UserMessage(text=prompt)
    result = await chat.send_message(msg)
    return result.strip()


def clean_json(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


# ── Card-type plan per session category ──────────────────────────────────────
# 7 cards per session; the types shift to match session nature.

def card_plan(order_index: int) -> list:
    """Returns ordered list of card_types for this session."""
    # Sessions 1-6: conceptual foundation
    if order_index <= 6:
        return ["hook", "concept", "deep-dive", "example", "mistake", "summary", "study-card"]
    # Sessions 7-12: applied / practical
    elif order_index <= 12:
        return ["hook", "concept", "deep-dive", "example", "formula", "summary", "study-card"]
    # Sessions 13-20: automation / career / workflows
    else:
        return ["hook", "concept", "deep-dive", "example", "example", "summary", "study-card"]


CARD_INSTRUCTIONS = {
    "hook": (
        "An opening card (200-320 words) that makes the reader HAVE to keep reading. "
        "Start with a specific scenario, a surprising stat, or a short story — never a definition. "
        "End with one punchy sentence that teases why this session changes how they work."
    ),
    "concept": (
        "Core concept explanation (280-400 words). Teach the main idea in plain English first, "
        "then layer in precision. Use a brief analogy early. Define 2-4 key terms in bold. "
        "No jargon without immediate explanation."
    ),
    "deep-dive": (
        "Deeper technical or analytical exploration (350-500 words). Structured with 2-3 "
        "subheadings (use ### in markdown). Include a short table or bullet comparison where it adds clarity. "
        "This is where the real learning happens — go further than the concept card."
    ),
    "example": (
        "A worked real-world example (300-420 words) grounded in India — a specific company, "
        "sector, or analyst workflow. Walk through the example step by step. "
        "Show numbers or a mini output wherever possible. End with the lesson extracted."
    ),
    "formula": (
        "A formula or structured reference card (250-380 words). Lead with the formula or framework, "
        "then explain every variable/component. Include a worked example with ₹ numbers. "
        "Add a quick reference table if helpful."
    ),
    "mistake": (
        "A common-mistake / pitfall card (250-350 words). Describe one or two specific mistakes "
        "analysts make with this topic — with realistic examples of what went wrong. "
        "Then give the correction clearly. Tone: experienced colleague warning you, not lecturing."
    ),
    "summary": (
        "A punchy summary (200-280 words). 3-5 key takeaways in bold, each followed by one "
        "sentence of context. End with one 'bottom-line' sentence about why this session matters "
        "for their career as an equity research analyst in India."
    ),
    "study-card": (
        "A practice / self-check card (250-380 words). Give the reader 3 short hands-on tasks "
        "or self-check questions they do NOW — not 'think about', but actually do. "
        "For AI sessions, tasks could be: 'open ChatGPT and run this prompt', 'try this with "
        "a real screener', 'compare two model outputs'. Include a sample answer or expected output "
        "for each task so they can verify they got it right."
    ),
}


# ── Prompt builder ────────────────────────────────────────────────────────────

NOTES_PROMPT = """\
Write 7 note cards for this Valuevade session.

Session title: "{title}"
Module: "AI for Finance & Equity Research — From Fundamentals to Full Automation"
Session number: {order_index} of 20

The 7 cards you must write, in this exact order:
{card_list}

For each card follow these specific instructions:
{card_instructions}

Additional context for this session:
{context}

Return ONLY a JSON array of 7 objects. Each object:
{{
  "card_type": "<type from the list above>",
  "title": "<a specific, punchy card title — NOT the session title>",
  "content": {{"body_md": "<full markdown content>"}}
}}

Markdown supported in body_md: **bold**, *italic*, ### subheadings, - bullet lists, 
1. numbered lists, | tables |, > blockquotes, `inline code`.
Do NOT use # or ## headings (the card title already acts as H2)."""


# Per-session context hints (additional guidance for each session's unique content)
SESSION_CONTEXT = {
    1: """Focus on the intuition of how LLMs work — no maths, no architecture diagrams.
The key insight: LLMs are sophisticated pattern matchers trained on human text, not 'thinking machines'.
Cover: what a language model actually is, why they're good at language tasks, what they can't do (reasoning, real-time data, precision arithmetic).
Real examples: ChatGPT, Claude, Gemini — what they're each better at.
Common misconception to bust: AI 'knows' facts. Reality: it generates plausible text.""",

    2: """Deep explanation of tokens, context windows, and why AI 'forgets' or drifts in long conversations.
Key concepts: tokenization (show that "Reliance" ≠ "reliance" as tokens), context window size (32K vs 128K vs 1M tokens), how context gets truncated.
The 'drift' problem: why a 50-page annual report pasted into one prompt gives worse answers than structured chunking.
Practical implication: for long research tasks, structure your prompts in sections.""",

    3: """Landscape of AI tools relevant to finance analysts in 2024-2025.
Must cover: ChatGPT (GPT-4o), Claude (Anthropic), Gemini (Google), Perplexity (for real-time research), Copilot in Excel.
Framework for choosing: is the task creative writing? → Claude. Real-time data? → Perplexity. Complex calculations? → Code Interpreter in ChatGPT. 
Indian context: tools accessible from India, pricing in INR, which tools work with Indian financial data.""",

    4: """Foundational prompt engineering for finance analysts.
The anatomy of an investment-grade prompt: Role + Context + Task + Format + Constraints.
Show the difference between a bad prompt ("Analyse Reliance") and a great one (full analyst-grade prompt with role, context, specific ask, output format).
Include 2-3 complete worked examples with actual prompt text.""",

    5: """Advanced prompting techniques.
Chain-of-thought: making the model reason step-by-step (great for valuation logic).
Few-shot: giving 2-3 examples of what you want before asking.
Personas: asking the model to think 'as a Goldman Sachs MD reviewing this'.
Structured output: asking for JSON, tables, or specific formats for downstream use.
Each technique: show the actual prompt syntax and a finance-specific example.""",

    6: """How to stop AI from hallucinating and how to verify its outputs.
The hallucination problem: AI confidently makes up numbers, quotes, citations.
Grounding techniques: paste the source data yourself (annual report excerpt), use Retrieval-Augmented Generation (RAG) conceptually, always ask the model to cite from provided context.
Verification workflow: every number AI gives you, cross-reference. Never use AI numbers in a research report without checking.
Guardrails in practice: asking the model 'what are you not certain about?'""",

    7: """Building a personal prompt library that compounds over time.
The idea: great prompts are reusable assets. Save them, refine them, share them.
Categories of prompts a finance analyst needs: research synthesis, financial modelling, sector comparison, management quality assessment, risk identification.
Show 5 complete, reusable prompt templates with fill-in-the-blank placeholders for company name, financials, sector.
Notion/Obsidian for prompt management.""",

    8: """Using AI to process annual reports, concalls, and regulatory filings at speed.
Workflow: extract → chunk → summarize → extract specifics.
Practical: how to paste a 50-page concall transcript and extract management guidance, risks, and commitments.
Show actual prompt sequence for processing an annual report: first call MD&A summary, then key risks, then specific number extraction.
Tools: ChatGPT Code Interpreter for PDFs, Claude for long documents, Perplexity for recent news.""",

    9: """Using AI for spreadsheet analysis and data work.
ChatGPT Code Interpreter: upload an Excel file, get AI to clean, analyze, chart.
Prompting for data: asking for specific statistical analysis, outlier detection, trend identification.
Practical demo: upload a screener export of 50 Nifty 500 stocks, ask AI to rank by quality metrics.
Excel Copilot: what it can and can't do in Indian Office 365 deployments.""",

    10: """Using AI as a modelling assistant for 3-statement models.
Where AI genuinely helps: formula checking, assumption documentation, identifying circular references.
Where AI fails: getting exact numbers from memory (always provide your own data).
Workflow: build your own model skeleton → use AI to populate sections with your data → use AI to stress-test assumptions.
Practical: a prompt sequence to build a revenue schedule for a FMCG company.""",

    11: """Sector screening and idea generation using AI.
The workflow: Screener.in export → AI analysis → filtered shortlist.
Prompt strategies: 'acting as a Motilal Oswal analyst, screen these 200 companies for...'
Idea generation: asking AI to identify companies that benefit from a macro trend (EV adoption, data centre growth, defence capex).
Sector comparison: use AI to synthesise sector reports from multiple brokerages.""",

    12: """Automating parts of DCF, comparable company analysis, and scenario modelling with AI.
What you can automate: pulling comparable company data structure, building scenario tables, sensitising WACC assumptions.
What you can't: AI does not know a company's current market price or earnings (give it your own).
Show a worked example: DCF for a mid-cap Indian pharma company built with AI assistance.
Scenario analysis: how to prompt for bull/base/bear case narratives.""",

    13: """Building multi-step AI research workflows (pipelines).
The idea: chain prompts together so output of step 1 feeds step 2.
Example pipeline for initiating coverage: (1) gather data → (2) AI summarises → (3) AI identifies risks → (4) AI drafts investment thesis → (5) analyst edits.
Tools for pipelines: ChatGPT Projects, Claude Projects, basic Python scripts.
Why this compounds: once built, it cuts 3-day research to 4 hours.""",

    14: """AI agents explained — from simple chatbots to systems that take actions.
Conceptual: agent = LLM + tools + memory + loop.
Finance examples: an agent that reads new SEBI filings, flags relevant ones, and drafts a summary.
Reality check for 2024-2025: agents are powerful but unreliable for high-stakes tasks. Use for first-draft, not final output.
What 'agentic' means in tools like Perplexity, Claude, and upcoming financial copilots.""",

    15: """No-code automation tools (Zapier, Make, n8n) for finance workflows.
Why no-code matters: most analysts don't code. These tools let you automate repetitive tasks without Python.
Practical workflows: 'when SEBI announces a new circular → extract key points with AI → send me a Slack summary'.
Finance automation examples: earnings date reminders, news aggregation, portfolio monitoring alerts.
n8n self-hosted option for sensitive financial data.""",

    16: """Building custom AI tools — APIs, Custom GPTs, and mini-apps.
Custom GPTs: create a GPT that knows your firm's house style, has your prompt library built in, and follows your output format.
OpenAI API basics: how to make an API call, what 'system prompt' means in the API context.
Use case: a 'coverage universe monitor' that, when given a company name, follows your research template automatically.
For non-coders: use Claude Projects and ChatGPT Projects as a lighter version.""",

    17: """End-to-end automated equity research engine — the capstone workflow.
Walk through a complete, automated workflow: idea identification → data gathering → financial analysis → report drafting.
Tools: Perplexity for news, Code Interpreter for financials, Claude for writing, Canva AI for presentation.
Time comparison: manual process (3-5 days) vs AI-assisted process (6-8 hours) for an initiating coverage note.
What still requires the analyst: judgement, conviction, client relationships.""",

    18: """Automating the wider finance function beyond equity research.
Monitoring: set up alerts for earnings surprises, management changes, regulatory actions.
Reporting: automate regular portfolio performance summaries.
Risk: AI-assisted scenario monitoring for macro risks (RBI rate decisions, global credit events).
The limit: AI handles information processing; risk judgement stays human.""",

    19: """Building your personal AI analyst operating system.
The idea: combine all tools into a coherent daily workflow that makes you 10× more productive.
Morning routine: news digest with AI, concall prep with AI, overnight reports summarised.
Research workflow: from idea to report draft with AI at every step.
Productivity principles: fewer, better prompts > many mediocre ones. Invest in your prompt library.""",

    20: """How to showcase AI skills in your resume, CV, and finance interviews.
The signal problem: everyone now says 'AI proficient'. How to stand out.
What to include: specific tools, specific workflows, quantified productivity gains ('reduced report prep time by 60%').
Interview answers: show don't tell. Walk through an actual AI-assisted workflow you built.
The risk to avoid: overclaiming AI work as your own. Explain your role clearly.""",
}


async def generate_notes_for_session(session: dict, dry_run: bool = False) -> list:
    idx = session["order_index"]
    title = session["title"]
    types = card_plan(idx)
    context = SESSION_CONTEXT.get(idx, "")

    card_list = "\n".join(
        f"{i+1}. card_type='{t}'" for i, t in enumerate(types)
    )
    card_instructions_text = "\n\n".join(
        f"For '{t}' card:\n{CARD_INSTRUCTIONS[t]}"
        for t in types
    )

    prompt = NOTES_PROMPT.format(
        title=title,
        order_index=idx,
        card_list=card_list,
        card_instructions=card_instructions_text,
        context=context,
    )

    if dry_run:
        print(f"\n--- DRY RUN PROMPT (S{idx:02d}) ---")
        print(prompt[:800], "...")
        return []

    raw = await call_llm(prompt, idx)
    cards_raw = json.loads(clean_json(raw))
    if not isinstance(cards_raw, list) or len(cards_raw) != 7:
        raise ValueError('Expected exactly seven generated cards')

    # Validate and normalise
    # Map any underscore variants the LLM may return to the DB-valid hyphen form
    TYPE_MAP = {"deep_dive": "deep-dive", "study_card": "study-card", "real_world": "example", "real-world": "example"}
    result = []
    for i, card in enumerate(cards_raw):
        raw_ct = card.get("card_type", types[i] if i < len(types) else "concept")
        ct = TYPE_MAP.get(raw_ct, raw_ct)
        content = card.get("content", {})
        if isinstance(content, str):
            content = {"body_md": content}
        if "body_md" not in content:
            content = {"body_md": str(content)}
        if ct not in CARD_INSTRUCTIONS or len(content['body_md'].split()) < 100:
            raise ValueError('Invalid card type or incomplete generated content')

        result.append({
            "session_id":   session["id"],
            "card_type":    ct,
            "title":        (card.get("title") or title)[:200],
            "content":      content,
            "order_index":  i + 1,
        })
    return result


# ── Main ─────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", type=int, default=None,
                        help="Only process session at this order_index (1-20)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print prompts, skip LLM calls and DB writes")
    parser.add_argument('--from-session', type=int, default=1)
    parser.add_argument('--to-session', type=int, default=20)
    parser.add_argument('--skip-complete', action='store_true')
    args = parser.parse_args()

    print("=" * 68)
    print("VALUEVADE — M18 AI Module Notes Generator")
    print(f"Started: {datetime.now(timezone.utc).isoformat()}")
    if args.dry_run:
        print("MODE: DRY RUN (no LLM calls, no DB writes)")
    print("=" * 68)

    # Fetch sessions
    sessions = sg(
        f"master_sessions?module_id=eq.{urllib.parse.quote(M18_MODULE_ID)}"
        f"&select=id,title,order_index&order=order_index&limit=100"
    )
    print(f"\nFound {len(sessions)} sessions in M18")

    if args.session:
        sessions = [s for s in sessions if s["order_index"] == args.session]
        if not sessions:
            print(f"ERROR: No session found with order_index={args.session}")
            sys.exit(1)
        print(f"Processing only S{args.session:02d}: {sessions[0]['title']}")

    ok = fail = skipped = 0
    sessions = [s for s in sessions if args.from_session <= s['order_index'] <= args.to_session]

    for session in sessions:
        idx = session["order_index"]
        print(f"\n[S{idx:02d}/{len(sessions):02d}] {session['title'][:60]}")

        old_cards = []
        if not args.dry_run:
            old_cards = sg(f"master_notes_cards?session_id=eq.{session['id']}&select=*")
            if args.skip_complete and len(old_cards) == 7:
                skipped += 1
                print('  Already complete; preserving existing notes')
                continue

        # Generate new notes
        print(f"  Generating {len(card_plan(idx))} cards…", end=" ", flush=True)
        try:
            cards = await generate_notes_for_session(session, dry_run=args.dry_run)
            if not args.dry_run and cards:
                backup = Path('/app/backend/notes_backups')
                backup.mkdir(exist_ok=True)
                (backup / f"m18-s{idx:02d}.json").write_text(json.dumps(old_cards))
                # Preserve old notes throughout generation. Restore on failed insertion.
                sdel(f"master_notes_cards?session_id=eq.{session['id']}")
                try:
                    spost("master_notes_cards", cards)
                except Exception:
                    if old_cards:
                        spost('master_notes_cards', old_cards)
                    raise
                print(f"✓ inserted {len(cards)} cards "
                      f"({', '.join(c['card_type'] for c in cards)})")
            ok += 1
        except json.JSONDecodeError as e:
            print(f"✗ JSON parse error: {e}")
            fail += 1
        except Exception as e:
            print(f"✗ FAILED: {e}")
            traceback.print_exc()
            fail += 1

        # Rate limit courtesy
        if not args.dry_run:
            await asyncio.sleep(1.0)

    print("\n" + "=" * 68)
    print(f"DONE: {datetime.now(timezone.utc).isoformat()}")
    print(f"  OK={ok}  FAIL={fail}  SKIPPED={skipped}")
    print("=" * 68)
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

"""Fix corrupted quiz for Financial Modelling → Session 1 (THE 3-STATEMENT MODEL-1).

The `master_quiz_questions` table has ONE row holding 5 questions concatenated
into the `question` field (with answers exposed inline and junk in `options`).
This script:
  1. Deletes the corrupt row.
  2. Inserts 5 clean rows — one per question, correct answer isolated, options split.

Idempotent: safe to re-run (deletes any existing rows for the session first).
"""
import json
import os
import urllib.request

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
URL = os.environ["REACT_APP_SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SESSION_ID = "72ff5396-cd3b-48f7-9485-908134d49609"  # THE 3-STATEMENT MODEL-1


def sb(method, path, body=None, prefer=None):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", data=data,
                                  headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


QUESTIONS = [
    {
        "question": "In the universal colour convention, what does a **blue** font cell signify?",
        "options": [
            "A formula that must not be edited",
            "A hardcoded input or assumption you're allowed to change",
            "A link to another worksheet",
            "An error in the model",
        ],
        "correct_answer_index": 1,
        "explanation": "Blue means and only means a hardcoded assumption — an opinion the reader can challenge. The instant a cell contains a formula, it turns black.",
        "difficulty": "easy",
        "order_index": 1,
    },
    {
        "question": "Which formula correctly keeps the growth assumption as a single source of truth?",
        "options": [
            "`=B7*1.12`",
            "`=B7*112%`",
            "`=B7*(1+$B$10)` where B10 is a labelled blue cell",
            "`=B7+12`",
        ],
        "correct_answer_index": 2,
        "explanation": "The assumption lives in one visible, labelled, blue cell (B10), and the `$` anchors keep every copied formula pointing at it. Options A and B bury the assumption invisibly inside the formula.",
        "difficulty": "medium",
        "order_index": 2,
    },
    {
        "question": "A cell shows a number in **green** font. What does this tell the reader?",
        "options": [
            "The number is positive",
            "The number is a hardcoded input",
            "The number is pulled (linked) from another sheet in the same workbook",
            "The number has been checked and approved",
        ],
        "correct_answer_index": 2,
        "explanation": "Green marks an inter-sheet link — the number lives elsewhere in the workbook and is being imported. (Red is reserved for links to *external files*, which break when the other file moves.)",
        "difficulty": "medium",
        "order_index": 3,
    },
    {
        "question": "Your forecast revenue row reads ₹0 in the final three years, but Excel shows no error message. What is the most likely cause?",
        "options": [
            "A #REF! error",
            "A missing absolute reference — the assumption reference shifted to blank cells when the formula was copied across",
            "The tax rate is too high",
            "A circular reference",
        ],
        "correct_answer_index": 1,
        "explanation": "Without `$` anchors, copying `=B7*B10` across shifts `B10` to `C10`, `D10`... which are blank, and Excel reads blank as **zero** — so it fails *silently* rather than throwing an error. The tell is that it's the *final* years that are zero. Fix with `$B$10` (press F4).",
        "difficulty": "hard",
        "order_index": 4,
    },
    {
        "question": "Why does a professional analyst build a \"Checks\" tab into every model?",
        "options": [
            "To make the model look longer and more professional",
            "To flag broken links, unbalanced balance sheets and formula errors before decisions are made",
            "To store backup copies of important cells in case the workbook crashes",
            "To hide sensitive assumptions from reviewers",
        ],
        "correct_answer_index": 1,
        "explanation": "A Checks tab is the model's built-in smoke alarm: BS = A - L - E should equal 0, cash-flow-statement cash tie-out to the balance sheet, no #REF!/#DIV/0!, no broken links. It catches mistakes before they reach the investment committee.",
        "difficulty": "easy",
        "order_index": 5,
    },
]


def main():
    print(f"→ Deleting existing quiz rows for session {SESSION_ID}…")
    sb("DELETE", f"master_quiz_questions?session_id=eq.{SESSION_ID}")

    print(f"→ Inserting {len(QUESTIONS)} clean rows…")
    for q in QUESTIONS:
        row = {"session_id": SESSION_ID, **q}
        sb("POST", "master_quiz_questions", row, prefer="return=representation")
        print(f"   ✓ Q{q['order_index']} [{q['difficulty']}] inserted")

    remaining = sb("GET",
                   f"master_quiz_questions?session_id=eq.{SESSION_ID}"
                   "&select=id,order_index,difficulty,question&order=order_index")
    print(f"\n✅ Done — session now has {len(remaining)} quiz questions:")
    for r in remaining:
        preview = r["question"][:70].replace("\n", " ")
        print(f"   {r['order_index']}. [{r['difficulty']}] {preview}…")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Replace master_customization_questions for the Equity Research Analyst path
with a comprehensive 13-question set that drives BOTH module-level AND
session-level customisation across the full 15-module / 173-session curriculum.

Usage:
  python3 scripts/seed_equity_research_questions.py [--dry-run]
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

SUP = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

PATH_ID = "5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c"  # Equity Research Analyst


def sb(method, path, body=None):
    url = f"{SUP}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data, headers={
        "apikey": SR,
        "Authorization": f"Bearer {SR}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode()
            return json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        print("ERR:", e.read().decode())
        raise


# ─────────────────────────────────────────────────────────────────────────────
# 13 QUESTIONS for the Equity Research Analyst path.
# Each `purpose` line documents what the answer signals so the LLM can apply
# the matching session/module removal logic in CUSTOMIZE_SYSTEM_PROMPT.
# ─────────────────────────────────────────────────────────────────────────────
QUESTIONS = [
    {
        "order_index": 1,
        "question_text": "What's your finance background?",
        "question_type": "single_select",
        "purpose": "Baseline knowledge level. q1=fin_grad or professional → remove M1 fully + M2 partial; commerce → keep M1 but remove S5 (Accounting Principles); beginner → keep M1+M2 fully.",
        "is_required": True,
        "options": [
            {"value": "beginner", "label": "Complete beginner", "sub": "No formal finance education yet"},
            {"value": "commerce", "label": "Commerce / B.Com / CA-foundation student", "sub": "Studying accounting & economics"},
            {"value": "fin_grad", "label": "Finance graduate / MBA Finance", "sub": "Covered theory broadly"},
            {"value": "professional", "label": "Working professional pivoting into research", "sub": "Has industry exposure"},
        ],
    },
    {
        "order_index": 2,
        "question_text": "What's your primary career goal?",
        "question_type": "single_select",
        "purpose": "Drives module priority + reordering. q2=ib → move M12 to position 5; q2=er_sell/er_buy → prioritise M11, M12, M13; q2=credit → keep M7-M9, M10 deeper; q2=personal → can drop M13, M14; q2=explore → no removals from goal alone.",
        "is_required": True,
        "options": [
            {"value": "er_sell", "label": "Sell-side equity research (brokerage)"},
            {"value": "er_buy", "label": "Buy-side / AMC / PMS / AIF"},
            {"value": "ib", "label": "Investment banking / M&A"},
            {"value": "credit", "label": "Credit research / Fixed income"},
            {"value": "personal", "label": "Personal investing / Long-term portfolio"},
            {"value": "explore", "label": "Still exploring"},
        ],
    },
    {
        "order_index": 3,
        "question_text": "How comfortable are you reading the 3 financial statements?",
        "question_type": "single_select",
        "purpose": "Drives M1 sessions S4-S9 (Big Three) and M7 intro removal. q3=confident → remove M1 S4-S9; read_no_link → remove M1 S4, S6-S8 but keep S9 (Linking); heard or never → keep all.",
        "is_required": True,
        "options": [
            {"value": "never", "label": "Never read one"},
            {"value": "heard", "label": "Heard of them, struggle to interpret"},
            {"value": "read_no_link", "label": "Can read individually, linkage shaky"},
            {"value": "confident", "label": "Confident reading + linking all 3"},
        ],
    },
    {
        "order_index": 4,
        "question_text": "How would you rate your Excel skill for finance work?",
        "question_type": "single_select",
        "purpose": "Direct map to M3 sessions. q4=basic → keep M3 fully; intermediate → remove M3 S1-S5 (basics + lookups); advanced → remove M3 S1-S8 (keep S9-S13 pivots+dashboards+financial functions); expert → remove M3 entirely.",
        "is_required": True,
        "options": [
            {"value": "basic", "label": "Basic — SUM, formatting, simple formulas"},
            {"value": "intermediate", "label": "Intermediate — VLOOKUP, IF, Pivots"},
            {"value": "advanced", "label": "Advanced — XLOOKUP, INDEX-MATCH, nested formulas"},
            {"value": "expert", "label": "Expert — dashboards, XNPV/IRR, macros"},
        ],
    },
    {
        "order_index": 5,
        "question_text": "Have you built a financial model from scratch?",
        "question_type": "single_select",
        "purpose": "Drives M4. q5=never → keep all M4; tutorial → remove M4 S1-S2 (philosophy + setup); basic → remove M4 S1-S3; confident → remove M4 entirely.",
        "is_required": True,
        "options": [
            {"value": "never", "label": "No, never"},
            {"value": "tutorial", "label": "Followed a tutorial / template"},
            {"value": "basic", "label": "Built 1-2 simple models"},
            {"value": "confident", "label": "Built multiple 3-statement DCF models"},
        ],
    },
    {
        "order_index": 6,
        "question_text": "How deep is your accounting & accrual concept understanding?",
        "question_type": "single_select",
        "purpose": "Drives M1 S5, M7 intro, M8 (forensic) inclusion. q6=basic → keep all; comfortable → remove M1 S5; advanced → remove M1 S5 + M7 S1-S2; expert → remove M1 S5 + M7 S1-S5.",
        "is_required": True,
        "options": [
            {"value": "basic", "label": "Basic — what is debit/credit"},
            {"value": "comfortable", "label": "Comfortable — accrual, deferred revenue, depreciation"},
            {"value": "advanced", "label": "Advanced — segment, consolidation, deferred tax, Ind AS leases"},
            {"value": "expert", "label": "Expert — forensic, restatements, Notes deep-dives"},
        ],
    },
    {
        "order_index": 7,
        "question_text": "How familiar are you with ratio & FSA frameworks (ROE, DuPont, EV/EBITDA)?",
        "question_type": "single_select",
        "purpose": "Drives M9 and M7 ratio sessions. q7=heard → keep all; basic → keep all M9; comfortable → remove M9 S1-S3 (ratio mindset, profitability, DuPont); advanced → remove M9 S1-S5 (keep specialised banks/industry/dashboard).",
        "is_required": True,
        "options": [
            {"value": "heard", "label": "I've heard of them but don't apply"},
            {"value": "basic", "label": "Used basic ratios (P/E, ROE) for screening"},
            {"value": "comfortable", "label": "Comfortable with DuPont, peer benchmarking, working capital"},
            {"value": "advanced", "label": "Build full ratio dashboards including sector-specific (Banks/NBFCs)"},
        ],
    },
    {
        "order_index": 8,
        "question_text": "Which valuation methods have you actually used?",
        "question_type": "multi_select",
        "purpose": "Drives M12 session-level removal — for each method already used, remove corresponding session(s). dcf → remove M12 S6-S8 (DCF Parts 1-3); comps → remove M12 S10 (Trading Comps); precedent → remove M12 S11; sotp → remove M12 S12; sector_specific → remove M12 S13. If 'none' selected, keep all M12. ALWAYS keep M12 S1-S5 (foundations) and S14 (Football Field).",
        "is_required": True,
        "options": [
            {"value": "none", "label": "None"},
            {"value": "dcf", "label": "DCF (basic)"},
            {"value": "comps", "label": "Trading comparables / Multiples"},
            {"value": "precedent", "label": "Precedent transactions"},
            {"value": "sotp", "label": "Sum-of-the-parts (SOTP)"},
            {"value": "sector_specific", "label": "Sector-specific (P/BV for banks, etc.)"},
        ],
    },
    {
        "order_index": 9,
        "question_text": "How comfortable are you reading annual reports & concalls?",
        "question_type": "single_select",
        "purpose": "Drives M6 sessions. q9=never/chairman → keep all M6; mda → remove M6 S1-S5 (anatomy + chairman/MDA); analyst → remove M6 entirely.",
        "is_required": True,
        "options": [
            {"value": "never", "label": "Never opened one"},
            {"value": "chairman", "label": "Skim chairman's letter only"},
            {"value": "mda", "label": "Read MD&A, segments, basic notes"},
            {"value": "analyst", "label": "Analyst-level — Notes, RPTs, KAMs, concall extraction"},
        ],
    },
    {
        "order_index": 10,
        "question_text": "How familiar are you with Indian markets & macro?",
        "question_type": "single_select",
        "purpose": "Drives M2, M10, and M1 macro sessions. q10=none → keep all; basic → remove M2 S4 (Indices); moderate → remove M2 S1-S5 + M10 S1-S3; deep → remove M2 + M10 entirely AND remove M1 S12 (Bonds) + S15 (Macro).",
        "is_required": True,
        "options": [
            {"value": "none", "label": "No idea how NSE/BSE work"},
            {"value": "basic", "label": "Basic — know what Nifty/Sensex are"},
            {"value": "moderate", "label": "Comfortable with FII/DII, RBI, SEBI rules"},
            {"value": "deep", "label": "Deep — yield curves, MPC minutes, currency"},
        ],
    },
    {
        "order_index": 11,
        "question_text": "Which sectors do you want to specialise in?",
        "question_type": "multi_select",
        "purpose": "Drives M11 session-level removal. KEEP only the selected sector sessions; REMOVE others. Sector → session mapping: banking → S4, it → S5, fmcg → S6, auto → S7, pharma → S8, energy → S9, infra → S10. ALWAYS keep M11 S1-S3 (intro frameworks), S11 (rotation), S12 (initiation note). If 'all' selected, keep every M11 session.",
        "is_required": True,
        "options": [
            {"value": "banking", "label": "Banking & Financials"},
            {"value": "it", "label": "IT & Tech"},
            {"value": "fmcg", "label": "FMCG & Consumer"},
            {"value": "auto", "label": "Auto & Ancillaries"},
            {"value": "pharma", "label": "Pharma & Healthcare"},
            {"value": "energy", "label": "Energy / Metals / Commodities"},
            {"value": "infra", "label": "Infra / Real Estate"},
            {"value": "all", "label": "Not sure yet (include all)"},
        ],
    },
    {
        "order_index": 12,
        "question_text": "Certifications you're pursuing or have cleared?",
        "question_type": "multi_select",
        "purpose": "CERTIFICATION OVERRIDE applied AFTER all other removal logic. cfa → force-keep M7, M9, M10, M12; frm → force-keep M8, M10; ca → force-keep M1, M7. If a module was scheduled for removal by other rules, certs override and KEEP it.",
        "is_required": True,
        "options": [
            {"value": "none", "label": "None"},
            {"value": "cfa", "label": "CFA (any level)"},
            {"value": "frm", "label": "FRM"},
            {"value": "ca", "label": "CA / ACCA"},
        ],
    },
    {
        "order_index": 13,
        "question_text": "How much emphasis do you want on each of these output skills?",
        "question_type": "rating_grid",
        "purpose": "Rating-driven module inclusion/removal. For each row: rating 1-2 → REMOVE that module; 3 → keep as-is (no change); 4-5 → keep AND consider reordering earlier. Rows: governance→M5; sectors→M11; valuation→M12 (never remove if rating low, but de-prioritise); reports→M13; jobs→M14 (LOCKED, only reorder); ai→M15 (LOCKED, only reorder).",
        "is_required": True,
        "options": {
            "scale_min": 1,
            "scale_max": 5,
            "scale_labels": {"1": "Skip", "2": "Light", "3": "Standard", "4": "Strong", "5": "Must-have"},
            "items": [
                {"key": "governance", "label": "Corporate governance & red flag analysis (M5)"},
                {"key": "sectors", "label": "Sector deep-dives (M11)"},
                {"key": "valuation", "label": "DCF & valuation modelling (M12)"},
                {"key": "reports", "label": "Report writing & pitch decks (M13)"},
                {"key": "jobs", "label": "Job-hunt & networking (M14)"},
                {"key": "ai", "label": "AI prompt engineering for analysts (M15)"},
            ],
        },
    },
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    existing = sb("GET", f"master_customization_questions?select=id,order_index,question_text&path_id=eq.{PATH_ID}&order=order_index")
    print(f"Existing questions for path: {len(existing)}")
    for q in existing:
        print(f"  #{q['order_index']} {q['question_text']}")

    if args.dry_run:
        print(f"\n[DRY RUN] Would insert {len(QUESTIONS)} new questions:")
        for q in QUESTIONS:
            print(f"  #{q['order_index']} ({q['question_type']}) {q['question_text']}")
        return

    print(f"\nDeleting {len(existing)} existing questions...")
    sb("DELETE", f"master_customization_questions?path_id=eq.{PATH_ID}")
    print("Deleted.")

    print(f"\nInserting {len(QUESTIONS)} new questions...")
    payload = [{**q, "path_id": PATH_ID} for q in QUESTIONS]
    inserted = sb("POST", "master_customization_questions", body=payload)
    print(f"Inserted {len(inserted)} rows.")

    print("\nDone. Final state:")
    final = sb("GET", f"master_customization_questions?select=order_index,question_text,question_type&path_id=eq.{PATH_ID}&order=order_index")
    for q in final:
        print(f"  #{q['order_index']} ({q['question_type']}) {q['question_text']}")


if __name__ == "__main__":
    main()

"""Seed the 5 Module-20 full interview simulations (idempotent upsert on firm_slug).

Run: python3 /app/scripts/seed_interview_sims.py
"""
import json
import os
import urllib.request

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
URL = os.environ["REACT_APP_SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
MODULE_ID = "755956dd-51e8-47b9-8e22-fbbed253127a"  # M20


def sb(method, path, body=None, prefer=None):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def build_case_workbook(firm, role, company, rev0, growth, ebitda_margin, dna, interest, tax, shares, exit_pe):
    """Generic 3-yr earnings model. Returns (workbook, expected_summary)."""
    rev = [rev0]
    for g in growth:
        rev.append(round(rev[-1] * (1 + g / 100.0), 1))
    r25, r26, r27 = rev[1], rev[2], rev[3]
    ebitda27 = round(r27 * ebitda_margin / 100.0, 1)
    ebit27 = round(ebitda27 - dna, 1)
    pbt27 = round(ebit27 - interest, 1)
    pat27 = round(pbt27 * (1 - tax / 100.0), 1)
    eps27 = round(pat27 / shares, 2)
    tp = round(eps27 * exit_pe, 0)

    ro = {"readOnly": True}
    rob = {"readOnly": True, "bold": True}
    cells = {
        "A1": {"value": f"{company} — FY25E-FY27E Earnings Model", **rob},
        "A2": {"value": "All figures in ₹ Cr unless stated. Fill the amber cells (use formulas).", **ro},
        "B4": {"value": "FY24A", **rob}, "C4": {"value": "FY25E", **rob},
        "D4": {"value": "FY26E", **rob}, "E4": {"value": "FY27E", **rob},
        "A5": {"value": "Revenue", **rob},
        "B5": {"value": rev0, **ro},
        "C5": {"value": "", "expected": r25, "tolerance": 2, "points": 10},
        "D5": {"value": "", "expected": r26, "tolerance": 2, "points": 10},
        "E5": {"value": "", "expected": r27, "tolerance": 3, "points": 10},
        "A6": {"value": "Revenue growth (%)", **ro},
        "C6": {"value": growth[0], **ro}, "D6": {"value": growth[1], **ro}, "E6": {"value": growth[2], **ro},
        "A7": {"value": f"EBITDA (@ {ebitda_margin}% margin)", **rob},
        "E7": {"value": "", "expected": ebitda27, "tolerance": 3, "points": 15},
        "A8": {"value": "Less: D&A", **ro}, "E8": {"value": dna, **ro},
        "A9": {"value": "EBIT", **ro},
        "A10": {"value": "Less: Interest", **ro}, "E10": {"value": interest, **ro},
        "A11": {"value": "PBT", **ro},
        "A12": {"value": f"Tax @ {tax}%", **ro},
        "A13": {"value": "PAT", **rob},
        "E13": {"value": "", "expected": pat27, "tolerance": 3, "points": 20},
        "A15": {"value": "Shares outstanding (Cr)", **ro}, "E15": {"value": shares, **ro},
        "A16": {"value": "FY27E EPS (₹)", **rob},
        "E16": {"value": "", "expected": eps27, "tolerance": 0.3, "points": 15},
        "A17": {"value": "Exit P/E multiple (x)", **ro}, "E17": {"value": exit_pe, **ro},
        "A18": {"value": "Target Price (₹)", **rob},
        "E18": {"value": "", "expected": tp, "tolerance": 8, "points": 20},
    }
    workbook = {
        "header": {
            "firm": firm,
            "role": role,
            "category": "Live Modelling Test",
            "instructions": (
                f"Build the FY25E-FY27E earnings model for {company}. Amber cells are graded. "
                "Use formulas (e.g. =B5*1.12) — the grader checks computed values."
            ),
        },
        "scoring": {"mode": "auto"},
        "sheets": [{"name": "Model", "rowCount": 26, "colCount": 8, "cells": cells}],
    }
    summary = {
        "rev_fy27": r27, "ebitda_fy27": ebitda27, "pat_fy27": pat27,
        "eps_fy27": eps27, "target_price": tp, "exit_pe": exit_pe,
    }
    return workbook, summary


FIRMS = [
    {
        "firm_slug": "jpmorgan",
        "firm_name": "J.P. Morgan",
        "firm_type": "global",
        "role_title": "Equity Research Associate — India Consumer",
        "location": "Mumbai (BKC)",
        "salary_band": "₹28-34 LPA + bonus",
        "order_index": 1,
        "about_md": "J.P. Morgan's India Equity Research desk covers 180+ NSE-listed companies. The Consumer team is ranked top-3 by Institutional Investor. You will support two senior analysts covering QSR, staples and retail names.",
        "brand": {"accent": "#8B6F47", "initials": "JPM", "tagline": "Global Investment Bank · New York HQ"},
        "process": {
            "persona": "A rigorous, globally-calibrated interviewer. Professional, direct, expects structured answers with numbers. References global frameworks but tests Indian market knowledge.",
            "aptitude": {"num_questions": 12, "time_limit_minutes": 15, "pass_pct": 40,
                         "topics": ["numerical reasoning", "data interpretation", "logical reasoning", "verbal reasoning"]},
            "behavioural": {"num_questions": 4, "focus": "Leadership under pressure, teamwork across time zones, integrity dilemmas, client-first thinking. STAR probing."},
            "technical": {"num_questions": 5, "focus": "DCF mechanics, comparable company analysis, consumer sector unit economics (QSR SSSG, gross margins), 3-statement links, Nifty/RBI awareness."},
            "case": {"time_limit_minutes": 45, "company_blurb": "UrbanBite QSR — India's #2 pizza & fried-chicken chain, 2,100 stores."},
        },
        "case_args": ("J.P. Morgan", "Equity Research Associate", "UrbanBite QSR Ltd",
                      5000.0, [12, 10, 8], 22.0, 250.0, 60.0, 25.0, 66.0, 45),
        "case_brief_md": """### Case brief — UrbanBite QSR Ltd (UBITE.NS)

UrbanBite is India's #2 QSR chain (2,100 stores, pizza + fried chicken). The stock trades at ₹540.

**Assumptions given by your senior analyst:**
- FY24A revenue: ₹5,000 Cr. Store-led growth of **12% (FY25E), 10% (FY26E), 8% (FY27E)**.
- EBITDA margin steady at **22%** (post-Ind AS 116).
- FY27E D&A ₹250 Cr, interest ₹60 Cr, tax **25%**, shares outstanding **66 Cr**.
- The sector re-rates to an exit P/E of **45x** FY27E EPS.

**Your tasks:**
1. Complete the amber cells of the earnings model (use formulas).
2. Write a 150-300 word recommendation: **BUY / HOLD / SELL** vs the current price of ₹540, with your target price, 2 key drivers and 1 risk.""",
    },
    {
        "firm_slug": "morganstanley",
        "firm_name": "Morgan Stanley",
        "firm_type": "global",
        "role_title": "Equity Research Associate — India Technology",
        "location": "Mumbai (Lower Parel)",
        "salary_band": "₹26-32 LPA + bonus",
        "order_index": 2,
        "about_md": "Morgan Stanley India Research is known for thematic, differentiated calls — its 'India Decade' franchise is widely read by global funds. The Technology team covers IT services, SaaS and internet names.",
        "brand": {"accent": "#0067B1", "initials": "MS", "tagline": "Global Investment Bank · New York HQ"},
        "process": {
            "persona": "An intellectually curious, thesis-driven interviewer. Loves 'what's your view?' questions and pushes candidates to defend a differentiated opinion with evidence.",
            "aptitude": {"num_questions": 12, "time_limit_minutes": 15, "pass_pct": 40,
                         "topics": ["numerical reasoning", "data interpretation", "logical reasoning", "verbal reasoning"]},
            "behavioural": {"num_questions": 4, "focus": "Intellectual honesty, contrarian thinking, handling ambiguity, collaboration with global teams. STAR probing."},
            "technical": {"num_questions": 5, "focus": "IT services model (utilisation, pricing, attrition), currency sensitivity, DCF vs multiples, margin bridges, deal TCVs, generative-AI impact on Indian IT."},
            "case": {"time_limit_minutes": 45, "company_blurb": "Zenith Infotech — India's #4 IT services exporter."},
        },
        "case_args": ("Morgan Stanley", "Equity Research Associate", "Zenith Infotech Ltd",
                      16600.0, [9, 8, 7], 18.0, 480.0, 40.0, 26.0, 54.0, 24),
        "case_brief_md": """### Case brief — Zenith Infotech Ltd (ZENI.NS)

Zenith is India's #4 IT services exporter (BFSI-heavy, 62% US revenue). The stock trades at ₹1,120.

**Assumptions given by your senior analyst:**
- FY24A revenue: ₹16,600 Cr. Constant-currency growth of **9% / 8% / 7%** for FY25E-FY27E.
- EBITDA margin holds at **18%** as pyramid rationalisation offsets wage hikes.
- FY27E D&A ₹480 Cr, interest ₹40 Cr, tax **26%**, shares outstanding **54 Cr**.
- Exit P/E of **24x** FY27E EPS (sector average).

**Your tasks:**
1. Complete the amber cells of the earnings model (use formulas).
2. Write a 150-300 word recommendation: **BUY / HOLD / SELL** vs ₹1,120, with target price, 2 drivers and 1 risk (mention the GenAI overhang).""",
    },
    {
        "firm_slug": "goldmansachs",
        "firm_name": "Goldman Sachs",
        "firm_type": "global",
        "role_title": "Research Analyst — India Financials & Fintech",
        "location": "Mumbai (Worli)",
        "salary_band": "₹30-36 LPA + bonus",
        "order_index": 3,
        "about_md": "Goldman Sachs Global Investment Research covers Indian banks, NBFCs and the fast-growing fintech ecosystem. The desk is famous for its deep proprietary datasets and India internet primers.",
        "brand": {"accent": "#6B8DC4", "initials": "GS", "tagline": "Global Investment Bank · New York HQ"},
        "process": {
            "persona": "A sharp, quant-leaning interviewer. Fires quick numerical follow-ups, expects precision with figures, and probes for commercial instinct about unit economics.",
            "aptitude": {"num_questions": 12, "time_limit_minutes": 15, "pass_pct": 40,
                         "topics": ["numerical reasoning", "data interpretation", "logical reasoning", "verbal reasoning"]},
            "behavioural": {"num_questions": 4, "focus": "Extreme ownership, resilience after failure, speed vs accuracy trade-offs, ethics around MNPI. STAR probing."},
            "technical": {"num_questions": 5, "focus": "Bank P&L basics (NII, NIM, credit cost), fintech take-rates and contribution margins, payment economics (MDR, UPI), valuation of loss-making growth companies, RBI regulation."},
            "case": {"time_limit_minutes": 45, "company_blurb": "PayOrbit — India's #3 payments & credit-distribution fintech."},
        },
        "case_args": ("Goldman Sachs", "Research Analyst", "PayOrbit Fintech Ltd",
                      4600.0, [22, 18, 15], 11.0, 140.0, 30.0, 25.0, 210.0, 60),
        "case_brief_md": """### Case brief — PayOrbit Fintech Ltd (PAYO.NS)

PayOrbit is India's #3 payments platform (38 Cr users) now scaling credit distribution. The stock trades at ₹385.

**Assumptions given by your senior analyst:**
- FY24A revenue: ₹4,600 Cr. Growth of **22% / 18% / 15%** for FY25E-FY27E as lending revenue scales.
- EBITDA margin reaches **11%** by FY27E (operating leverage on payments infra).
- FY27E D&A ₹140 Cr, interest ₹30 Cr, tax **25%**, shares outstanding **210 Cr**.
- Exit P/E of **60x** FY27E EPS (growth-fintech premium).

**Your tasks:**
1. Complete the amber cells of the earnings model (use formulas).
2. Write a 150-300 word recommendation: **BUY / HOLD / SELL** vs ₹385, with target price, 2 drivers and 1 regulatory risk.""",
    },
    {
        "firm_slug": "motilaloswal",
        "firm_name": "Motilal Oswal",
        "firm_type": "india",
        "role_title": "Research Associate — Midcaps",
        "location": "Mumbai (Prabhadevi)",
        "salary_band": "₹9-14 LPA + bonus",
        "order_index": 4,
        "about_md": "Motilal Oswal Financial Services runs one of India's most respected domestic research franchises — the annual Wealth Creation Study is an industry institution. The midcap team hunts multi-baggers with a QGLP lens (Quality, Growth, Longevity, Price).",
        "brand": {"accent": "#F5A623", "initials": "MO", "tagline": "Indian Broking & Research House · Mumbai HQ"},
        "process": {
            "persona": "A warm but street-smart Indian interviewer. Uses QGLP framework language, loves stock stories and promoter-quality judgement, tests hunger and honesty more than polish.",
            "aptitude": {"num_questions": 12, "time_limit_minutes": 15, "pass_pct": 40,
                         "topics": ["numerical reasoning", "data interpretation", "logical reasoning", "verbal reasoning"]},
            "behavioural": {"num_questions": 4, "focus": "Hunger to learn, honesty about mistakes, long-term thinking, handling monotony of channel checks. STAR probing."},
            "technical": {"num_questions": 5, "focus": "QGLP framework, promoter & governance red flags, working-capital cycles, midcap valuation (EV/EBITDA vs P/E), stock pitch quality, annual-report reading."},
            "case": {"time_limit_minutes": 45, "company_blurb": "Meridian Pipes — midcap PVC & CPVC pipes leader in West India."},
        },
        "case_args": ("Motilal Oswal", "Research Associate", "Meridian Pipes Ltd",
                      3200.0, [14, 12, 11], 13.0, 90.0, 40.0, 25.0, 48.0, 28),
        "case_brief_md": """### Case brief — Meridian Pipes Ltd (MERI.NS)

Meridian is a West-India PVC/CPVC pipes midcap riding the housing + agri capex cycle. The stock trades at ₹310.

**Assumptions given by your senior analyst:**
- FY24A revenue: ₹3,200 Cr. Volume-led growth of **14% / 12% / 11%** for FY25E-FY27E.
- EBITDA margin normalises at **13%** (PVC spreads stable).
- FY27E D&A ₹90 Cr, interest ₹40 Cr, tax **25%**, shares outstanding **48 Cr**.
- Exit P/E of **28x** FY27E EPS (building-materials midcap average).

**Your tasks:**
1. Complete the amber cells of the earnings model (use formulas).
2. Write a 150-300 word recommendation: **BUY / HOLD / SELL** vs ₹310, with target price. Apply the QGLP lens — comment on Quality and Longevity, plus 1 risk.""",
    },
    {
        "firm_slug": "kotak",
        "firm_name": "Kotak Institutional Equities",
        "firm_type": "india",
        "role_title": "Associate — Consumer & Retail",
        "location": "Mumbai (BKC)",
        "salary_band": "₹12-18 LPA + bonus",
        "order_index": 5,
        "about_md": "Kotak Institutional Equities is consistently voted India's #1 domestic research house by Asiamoney. Its daily 'Kotak Morning Insight' sets the conversation for institutional India. The consumer team is its crown jewel.",
        "brand": {"accent": "#ED3237", "initials": "KIE", "tagline": "India's #1 Institutional Research House · Mumbai HQ"},
        "process": {
            "persona": "A meticulous, detail-obsessed Indian interviewer. Expects command over reported numbers of real Indian companies, probes accounting subtleties, and values written clarity.",
            "aptitude": {"num_questions": 12, "time_limit_minutes": 15, "pass_pct": 40,
                         "topics": ["numerical reasoning", "data interpretation", "logical reasoning", "verbal reasoning"]},
            "behavioural": {"num_questions": 4, "focus": "Attention to detail, writing discipline, handling analyst pressure and late nights during results season, client interactions. STAR probing."},
            "technical": {"num_questions": 5, "focus": "FMCG volume vs value growth, gross-margin bridges (palm oil, crude derivatives), retail SSSG & store economics, GST/rural demand dynamics, forensic red flags in consumer names."},
            "case": {"time_limit_minutes": 45, "company_blurb": "GlowMart Retail — value-fashion retailer, 610 stores across Tier 2/3 India."},
        },
        "case_args": ("Kotak Institutional Equities", "Associate", "GlowMart Retail Ltd",
                      9800.0, [18, 15, 13], 8.5, 310.0, 120.0, 25.0, 92.0, 55),
        "case_brief_md": """### Case brief — GlowMart Retail Ltd (GLOW.NS)

GlowMart is a value-fashion retailer (610 stores, Tier 2/3 focus) — often called 'the next big value-retail story'. The stock trades at ₹412.

**Assumptions given by your senior analyst:**
- FY24A revenue: ₹9,800 Cr. Store-addition-led growth of **18% / 15% / 13%** for FY25E-FY27E.
- EBITDA margin at **8.5%** (pre-Ind AS 116 basis).
- FY27E D&A ₹310 Cr, interest ₹120 Cr, tax **25%**, shares outstanding **92 Cr**.
- Exit P/E of **55x** FY27E EPS (value-retail scarcity premium).

**Your tasks:**
1. Complete the amber cells of the earnings model (use formulas).
2. Write a 150-300 word recommendation: **BUY / HOLD / SELL** vs ₹412, with target price, 2 drivers (store economics, SSSG) and 1 risk.""",
    },
]


def main():
    for f in FIRMS:
        wb, summary = build_case_workbook(*f.pop("case_args"))
        row = {
            **{k: v for k, v in f.items() if k != "case_brief_md"},
            "module_id": MODULE_ID,
            "case_config": {
                "brief_md": f["case_brief_md"],
                "workbook": wb,
                "expected_summary": summary,
            },
        }
        sb("POST", "master_interview_sims?on_conflict=firm_slug", row,
           prefer="resolution=merge-duplicates,return=representation")
        print(f"seeded {row['firm_slug']}: TP ₹{summary['target_price']}")
    rows = sb("GET", "master_interview_sims?select=firm_slug,order_index&order=order_index")
    print("total sims:", len(rows))


if __name__ == "__main__":
    main()

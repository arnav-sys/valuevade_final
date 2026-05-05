#!/usr/bin/env python3
"""Delete + insert structured decision_making sim for M1 / Session 3
(How Businesses Make Money — Business Models & Unit Economics).

Renders natively via /app/frontend/src/components/simulations/DecisionMakingSim.jsx
(decision_points + scoring with outcome_mapping). Linear flow, 3 decisions, 3 options
each, last decision terminal. Scoring uses 3 dimensions consistent across all options.
"""
import json, sys, urllib.request, urllib.error

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

S3_SESSION_ID = "1381f79a-54d6-4e49-a437-fe8558e9fdfd"

SIM = {
    "session_id": S3_SESSION_ID,
    "sim_type": "decision_making",
    "title": "Unit Economics Workshop — Reading the Margins of Three Indian Businesses",
    "scenario": (
        "You are a junior analyst on an Indian sell-side equity research desk. The "
        "Head of Research drops three coverage files on your desk: a B2B SaaS firm, "
        "a D2C beauty brand, and a B2B grocery marketplace. Before you can value "
        "any of them, you must classify each business model correctly, spot the "
        "single biggest unit-economics red flag in the D2C deck, and recommend "
        "where the marketplace should deploy its remaining cash. One wrong call "
        "and the desk's note goes out under your name with a public mistake."
    ),
    "instructions": (
        "Three sequential analyst calls, three decisions. Each decision has three "
        "options. Pick what an experienced analyst would actually say — not what "
        "the founder wants to hear. After each pick you'll see the consequence and "
        "score impact across three dimensions: Model Fluency (do you know which "
        "valuation framework to use?), Unit Economics Intuition (can you read CAC, "
        "LTV, contribution margin, take-rate?), and Capital Discipline (do you "
        "know where money should and shouldn't go?). The flow is linear — each "
        "decision opens the next; the third is terminal and produces your final "
        "outcome. Aim for the highest cumulative score across all three dimensions."
    ),
    "objectives": [
        "Classify a business as SaaS, services-led, or marketplace using the right diagnostic signals (gross margin, recurring revenue, NRR, take-rate)",
        "Compute and interpret core unit-economics levers: CAC, contribution margin per order, LTV via repeat rate × repeat orders, and LTV/CAC ratio",
        "Identify the single highest-impact red flag in a D2C deck rather than getting distracted by surface-level concerns",
        "Apply marketplace-specific capital allocation logic — recognise when monetisation (take-rate) should precede scale (GMV)",
        "Push back on founder narratives ('scale solves margins') with quantitative analyst framing",
        "Build a vocabulary for one-line analyst recommendations that capital allocators can act on",
    ],
    "config": {
        "scenario_context": (
            "Welcome to your first day on the equity research desk. The Head of "
            "Research drops three Indian company files on your desk and says: "
            "\"Before lunch, tell me what each of these companies actually does to "
            "make money — and which of them have unit economics that will scale.\" "
            "You'll work through three quick analyst calls, each with a different "
            "business model and a different question hidden inside the numbers."
        ),
        "initial_data": {
            "Tools you'll use": "Business model lens · CAC payback · LTV/CAC · Contribution margin · Take-rate logic",
            "Lens": "Buy-side analyst",
            "Time on the clock": "~12 minutes",
            "Coverage": "3 Indian companies · 1 SaaS · 1 D2C · 1 Marketplace",
        },
        "decision_points": [
            {
                "id": "d1_classify",
                "title": "Decision 1 · Classify the Business Model",
                "narrative": (
                    "Company file: ZohoFlow Inc. — a Bangalore-based B2B software firm "
                    "selling a workflow-automation platform to SMBs. Last year:\n\n"
                    "• Revenue ₹420 cr, growing 78% YoY\n"
                    "• Gross margin 86%\n"
                    "• 88% of revenue is from contracts that auto-renew annually\n"
                    "• Net Revenue Retention 124%\n"
                    "• CAC payback period: 7 months\n\n"
                    "Before you can value ZohoFlow, you need to label its business model "
                    "correctly — that decides which valuation framework you'll even use. "
                    "How do you classify it?"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Pure SaaS (recurring revenue, software-style margins, scalable)",
                        "description": (
                            "High gross margin + auto-renewing contracts + NRR > 100% + "
                            "CAC paid back in <12 months = textbook SaaS."
                        ),
                        "consequence": (
                            "Right call. The 86% gross margin is a software signature — "
                            "the marginal cost to serve one more customer is ~zero. NRR > "
                            "100% means cohorts are expanding faster than they're churning, "
                            "which is the SaaS compounding engine. You'll value this on "
                            "ARR multiples or DCF on FCF margins, not on revenue x EBITDA "
                            "industrials math."
                        ),
                        "score_impact": {
                            "model_fluency": 5,
                            "unit_economics_intuition": 2,
                            "capital_discipline": 2,
                        },
                        "next_decision": "d2_unit_econ",
                    },
                    {
                        "id": "B",
                        "label": "Services-led IT firm (project-based, lower scalability)",
                        "description": (
                            "Treat it like an Indian IT services company — billable hours, "
                            "people-cost driven, mid-30s gross margin."
                        ),
                        "consequence": (
                            "You missed the structural difference. Indian IT services firms "
                            "(TCS, Infosys, Wipro) run 30–35% gross margins because their cost "
                            "of revenue is people. ZohoFlow's 86% gross margin is impossible "
                            "in a services model — that's the dead giveaway it's a software "
                            "product, not labour-arbitrage. You'd massively under-value the "
                            "scalability."
                        ),
                        "score_impact": {
                            "model_fluency": -3,
                            "unit_economics_intuition": -1,
                            "capital_discipline": 0,
                        },
                        "next_decision": "d2_unit_econ",
                    },
                    {
                        "id": "C",
                        "label": "Marketplace (take-rate on third-party transactions)",
                        "description": (
                            "Treat it like a Zomato or Nykaa — GMV with a take-rate."
                        ),
                        "consequence": (
                            "Wrong frame. Marketplaces don't auto-renew — they monetise "
                            "transactions. ZohoFlow has annual recurring contracts, not a "
                            "take-rate on third-party GMV. Marketplace gross margins are "
                            "typically 25–40% (logistics, payment fees); 86% rules this out. "
                            "You'd track the wrong KPIs (GMV growth) and miss the core engine "
                            "(NRR + CAC payback)."
                        ),
                        "score_impact": {
                            "model_fluency": -2,
                            "unit_economics_intuition": -1,
                            "capital_discipline": 0,
                        },
                        "next_decision": "d2_unit_econ",
                    },
                ],
            },
            {
                "id": "d2_unit_econ",
                "title": "Decision 2 · Spot the Unit-Economics Red Flag",
                "narrative": (
                    "Company file: BlushBerry — a 3-year-old D2C beauty brand selling on "
                    "its own website + Nykaa + Amazon. Founder is raising a Series B at a "
                    "₹600 cr valuation. The data room shows:\n\n"
                    "• AOV (Average Order Value): ₹950\n"
                    "• Blended CAC: ₹720 (mostly Meta + Google ads)\n"
                    "• Contribution margin per order: 32% (after COGS, packaging, shipping, payment fees)\n"
                    "• 12-month repeat purchase rate: 18%\n"
                    "• Average orders per repeat customer over 24 months: 1.4\n\n"
                    "The deck claims \"world-class unit economics.\" You have 5 minutes "
                    "before the call. Which is the single biggest red flag in this pack?"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "CAC payback is fine — 1 order recovers most of CAC",
                        "description": (
                            "Contribution per order = 32% × ₹950 = ₹304. So roughly 2.4 orders "
                            "to recover ₹720. That's healthy."
                        ),
                        "consequence": (
                            "You did the math but missed the punchline. Contribution per order "
                            "is only ₹304. CAC is ₹720. With only 18% of customers repeating "
                            "and just 1.4 repeat orders on average, the average customer "
                            "delivers only ~₹304 × 1.18 ≈ ₹360 of contribution — well below "
                            "₹720 CAC. The first-order payback is irrelevant if customers "
                            "don't come back. Saying \"CAC is fine\" hides the real problem."
                        ),
                        "score_impact": {
                            "model_fluency": 0,
                            "unit_economics_intuition": -2,
                            "capital_discipline": -1,
                        },
                        "next_decision": "d3_capital",
                    },
                    {
                        "id": "B",
                        "label": "LTV/CAC is below 1 — they're paying ₹720 to acquire a customer worth ~₹360",
                        "description": (
                            "Contribution × (1 + repeat_rate × repeat_orders) = ₹304 × "
                            "(1 + 0.18×1.4) ≈ ₹304 × 1.25 ≈ ₹380. CAC ₹720 → LTV/CAC ≈ 0.5."
                        ),
                        "consequence": (
                            "Sharp catch — and this is THE red flag. Every customer they "
                            "acquire destroys ~₹340 of value before any fixed costs. "
                            "Scaling this with a Series B doesn't fix it — it pours fuel "
                            "on a leaky bucket. The fix isn't more ad spend; it's either "
                            "(a) cut CAC by leaning on organic / referral, (b) lift contribution "
                            "margin (raise prices, drop discount-led SKUs), or (c) lift "
                            "repeat rate (subscription, refill SKUs). Until LTV/CAC > 3, "
                            "this isn't a fundable D2C — it's a paid-marketing arbitrage."
                        ),
                        "score_impact": {
                            "model_fluency": 1,
                            "unit_economics_intuition": 5,
                            "capital_discipline": 3,
                        },
                        "next_decision": "d3_capital",
                    },
                    {
                        "id": "C",
                        "label": "Gross margin should be higher — 32% is the real problem",
                        "description": (
                            "Premium D2C brands target 60–70% contribution. 32% is too thin."
                        ),
                        "consequence": (
                            "Half right, half wrong. 32% contribution margin (not gross "
                            "margin — those are different) is on the lower end for D2C "
                            "beauty, but it's not the BIGGEST red flag. You can scale a 32% "
                            "contribution business if customers repeat. The decisive killer "
                            "is the 18% repeat rate × 1.4 reorders, which collapses LTV. "
                            "Margin is an upstream issue; retention is the immediate "
                            "value-destruction."
                        ),
                        "score_impact": {
                            "model_fluency": 0,
                            "unit_economics_intuition": 1,
                            "capital_discipline": 0,
                        },
                        "next_decision": "d3_capital",
                    },
                ],
            },
            {
                "id": "d3_capital",
                "title": "Decision 3 · Marketplace Capital Allocation",
                "narrative": (
                    "Company file: DukanBazaar — a 5-year-old Indian B2B marketplace "
                    "connecting kirana stores to FMCG distributors. Current state:\n\n"
                    "• GMV ₹3,200 cr (grew 45% YoY)\n"
                    "• Take-rate: 4.2% (industry average for B2B grocery: 6–8%)\n"
                    "• Contribution margin on net revenue: 18%\n"
                    "• Cash burn: ₹220 cr last year, ₹600 cr in the bank\n"
                    "• Founder pitch: \"Push GMV harder — scale solves margins.\"\n\n"
                    "Board meeting in 30 minutes. They want your one-sentence "
                    "recommendation on where to point the next ₹600 cr. Pick your call:"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Push GMV hardest — outgrow competitors, worry about margins later",
                        "description": (
                            "Classic land-grab playbook: subsidise on-platform pricing, "
                            "incentivise stores, double ad spend. Get to ₹6,000 cr GMV next year."
                        ),
                        "consequence": (
                            "You backed the founder's gut. But marketplaces have a "
                            "specific failure mode: GMV is vanity; take-rate × volume × "
                            "contribution margin is sanity. Doubling GMV at 4.2% take-rate "
                            "and 18% contribution adds ~₹24 cr of contribution, against ₹400+ "
                            "cr of incremental burn. You'll run out of cash before the next "
                            "round, and by then competitors will have copied the playbook. "
                            "GMV-first works only if it directly enables take-rate "
                            "expansion — which the deck doesn't explain."
                        ),
                        "score_impact": {
                            "model_fluency": -1,
                            "unit_economics_intuition": -2,
                            "capital_discipline": -3,
                        },
                        "is_terminal": True,
                    },
                    {
                        "id": "B",
                        "label": "Hold GMV, invest in lifting take-rate from 4.2% to 6%+ over 18 months",
                        "description": (
                            "Build value-added services on top — credit, logistics, private "
                            "label. Raise take-rate where the marketplace is already winning. "
                            "Margin compounds before you scale."
                        ),
                        "consequence": (
                            "This is the textbook marketplace move. Take-rate going from "
                            "4.2% → 6% on flat ₹3,200 cr GMV = +₹58 cr of net revenue at "
                            "near-100% incremental margin. That single lever, done well, "
                            "swings the business from cash-burning to cash-positive within "
                            "the runway. THEN you can deploy GMV growth on top. The Board "
                            "loves capital-efficient stories — this is one. Memorise this "
                            "framework: in marketplaces, monetisation precedes scale, never "
                            "the other way around."
                        ),
                        "score_impact": {
                            "model_fluency": 4,
                            "unit_economics_intuition": 4,
                            "capital_discipline": 5,
                        },
                        "is_terminal": True,
                    },
                    {
                        "id": "C",
                        "label": "Pivot to inventory/wholesale — buy goods, hold stock, sell to stores directly",
                        "description": (
                            "Move from a marketplace to a distributor. Bigger revenue line "
                            "(gross instead of net), more control over margins."
                        ),
                        "consequence": (
                            "You changed the company's DNA. Inventory businesses run at "
                            "8–12% gross margin (vs 18% contribution today on a near-zero "
                            "asset base) and need huge working capital — exactly the wrong "
                            "use of ₹600 cr. You'd also be competing head-on with Reliance "
                            "and Udaan in their core game. The marketplace model isn't "
                            "broken; the take-rate is just under-monetised. Pivoting away "
                            "from a working model in favour of a heavier one destroys "
                            "optionality."
                        ),
                        "score_impact": {
                            "model_fluency": -2,
                            "unit_economics_intuition": -1,
                            "capital_discipline": -2,
                        },
                        "is_terminal": True,
                    },
                ],
            },
        ],
        "scoring": {
            "dimensions": [
                "model_fluency",
                "unit_economics_intuition",
                "capital_discipline",
            ],
            # max path: A (5+2+2=9) -> B (1+5+3=9) -> B (4+4+5=13)  => 31
            # min path: B (-3-1+0=-4) -> A (0-2-1=-3) -> A (-1-2-3=-6) => -13
            "max_total": 31,
            "min_total": -13,
            "outcome_mapping": [
                {
                    "min_total": -20,
                    "label": "Initiation Withdrawn",
                    "narrative": (
                        "Your director sends the file back: \"You're calling SaaS as "
                        "services and pushing money into a leaky bucket. Sit in on the "
                        "Monday recap — let's rebuild the business-model intuition before "
                        "you write another note.\""
                    ),
                },
                {
                    "min_total": 0,
                    "label": "Caveated Pass",
                    "narrative": (
                        "You got most of the labels right but missed the punchline on "
                        "unit economics. The note goes out with edits. Ahead of next "
                        "week's coverage call, the director hands you a one-page LTV/CAC "
                        "primer with the words \"this is the muscle to build.\""
                    ),
                },
                {
                    "min_total": 12,
                    "label": "Solid Initiation",
                    "narrative": (
                        "The note prints clean. You correctly classified the SaaS, flagged "
                        "the D2C retention problem, and pushed back on a marketplace "
                        "GMV-grab. Your name is now on the model — keep building this "
                        "frame and you'll get harder names in two quarters."
                    ),
                },
                {
                    "min_total": 22,
                    "label": "Best-in-Class Coverage",
                    "narrative": (
                        "Three for three — clean classification, sharp red-flag spot, "
                        "and a take-rate-first capital recommendation that the desk circulates "
                        "internally. The Head of Research forwards your note to the buy-side "
                        "with a cover line: \"This is how we want junior analysts framing "
                        "business models.\" Welcome to the desk."
                    ),
                },
            ],
        },
    },
}


def req(method, path, body=None, want_json=True):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, method=method, data=data, headers={
        "apikey": SR, "Authorization": f"Bearer {SR}",
        "Content-Type": "application/json", "Prefer": "return=representation",
    })
    try:
        with urllib.request.urlopen(r) as resp:
            text = resp.read().decode()
            return json.loads(text) if want_json and text else text
    except urllib.error.HTTPError as e:
        print("ERR body:", e.read().decode())
        raise


def verify():
    """Sanity checks before insert."""
    cfg = SIM["config"]
    dpoints = {d["id"]: d for d in cfg["decision_points"]}
    optimal_total = 0
    worst_total = 0
    for d in cfg["decision_points"]:
        best = max(d["options"], key=lambda o: sum(o["score_impact"].values()))
        worst = min(d["options"], key=lambda o: sum(o["score_impact"].values()))
        optimal_total += sum(best["score_impact"].values())
        worst_total += sum(worst["score_impact"].values())
        # next_decision validity
        for o in d["options"]:
            if not o.get("is_terminal"):
                assert o.get("next_decision") in dpoints, f"bad next_decision: {o['id']} -> {o.get('next_decision')}"
            else:
                assert "next_decision" not in o or o["next_decision"] is None
    assert optimal_total == cfg["scoring"]["max_total"], f"max mismatch: {optimal_total} vs {cfg['scoring']['max_total']}"
    assert worst_total == cfg["scoring"]["min_total"], f"min mismatch: {worst_total} vs {cfg['scoring']['min_total']}"

    # outcome bands sorted, top band reachable from optimal_total, bottom from worst_total
    bands = sorted(cfg["scoring"]["outcome_mapping"], key=lambda b: b["min_total"])
    top = bands[-1]
    bot = bands[0]
    assert optimal_total >= top["min_total"], f"optimal {optimal_total} can't reach top band {top['min_total']}"
    assert worst_total >= bot["min_total"], f"worst {worst_total} below all bands"

    # consistent dimensions across all options
    dims = set(cfg["scoring"]["dimensions"])
    for d in cfg["decision_points"]:
        for o in d["options"]:
            assert set(o["score_impact"].keys()) == dims, f"{o['id']} dim mismatch: {set(o['score_impact'].keys())}"

    print(f"  ✓ optimal_total={optimal_total}, worst_total={worst_total}")
    print(f"  ✓ all next_decision links valid")
    print(f"  ✓ scoring dims consistent across all 9 options")


def main():
    print("Verifying SIM structure...")
    verify()
    print()

    sid = SIM["session_id"]
    print(f"Fetching existing simulations for session {sid}...")
    existing = req("GET", f"master_simulations?session_id=eq.{sid}&select=id,sim_type,title")
    print(f"  Found {len(existing)}")
    for e in existing:
        print(f"  DELETE {e['id']} | {e['sim_type']} | {e['title'][:60]}")
        req("DELETE", f"master_simulations?id=eq.{e['id']}", want_json=False)

    print(f"\nINSERT new {SIM['sim_type']} sim: {SIM['title']}")
    inserted = req("POST", "master_simulations", body=SIM)
    print(f"  ✓ inserted id={inserted[0]['id']}")
    print("\nDone.")


if __name__ == "__main__":
    main()

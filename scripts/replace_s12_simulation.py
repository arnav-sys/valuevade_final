#!/usr/bin/env python3
"""Delete + insert structured decision_making sim for M1 / Session 12
(Interest Rates, Bonds & the Yield Curve).

Fixes the audit catch — sim was still on the legacy `modules`/`slider_interactive`
schema even though PRD Phase 23 claimed it was replaced. Renders natively via
DecisionMakingSim.jsx.
"""
import json, urllib.request, urllib.error

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

S12_SESSION_ID = "76d9023b-b6a6-46e6-9aef-b05c50777111"

SIM = {
    "session_id": S12_SESSION_ID,
    "sim_type": "decision_making",
    "title": "Yield Curve Reading Workshop — Three Curve Shapes, Three Equity Calls",
    "scenario": (
        "You are an equity analyst at a Mumbai-based long-only fund. The CIO has "
        "told the desk: \"The bond market is screaming something at us — I want "
        "every analyst to read the yield curve before they read another P&L.\" "
        "Three different curve shapes have shown up across this quarter, and each "
        "one demands a specific equity call: read the macro signal, rotate the "
        "right sectors, and trim the right duration. Get all three right and you "
        "publish the desk's next macro note."
    ),
    "instructions": (
        "Three sequential decisions, three options each. Each decision tests a "
        "different layer of the rate-curve framework: shape diagnosis, "
        "sector rotation, and equity duration. After each pick you'll see the "
        "consequence and score impact across three dimensions: Macro Framework "
        "(do you know what each curve shape implies for growth and inflation?), "
        "Transmission Logic (can you connect the rate signal to the right sector?), "
        "and Timing Quality (do you act early enough to capture the move?). The "
        "flow is linear; the third decision is terminal."
    ),
    "objectives": [
        "Diagnose yield-curve shapes — inverted (10Y < 2Y), steepening (long end rising faster than short), and flat — and map each shape to the macro state of the world",
        "Use the 10Y minus 3M spread as the most reliable recession-prediction signal (US Fed research shows ~12-month lead)",
        "Compute term spread = 10Y − 2Y and recognise that sustained inversion (>3 months below zero) has preceded every US recession since 1970",
        "Map curve shape to sector rotation — steepening favours net-interest-margin businesses (private banks, NBFCs); flattening favours long-duration cash flows (growth tech, pharma)",
        "Apply equity duration intuition — high-multiple growth stocks behave like long-duration bonds; trim them when the long end of the curve is rising",
        "Push back on the false comfort of 'nominal growth is fine' when real yields are rising — separate nominal-rate moves from real-rate moves",
    ],
    "config": {
        "scenario_context": (
            "Three Friday afternoons across Q1, three different yield-curve "
            "screenshots show up on your desk. Each screenshot demands a one-line "
            "equity call before market close. Bring the framework, not the headline."
        ),
        "initial_data": {
            "Frameworks you'll use": "10Y-2Y term spread · 10Y-3M recession spread · Sector rotation map · Equity duration",
            "Lens": "Long-only equity analyst",
            "Time on the clock": "~12 minutes total",
            "Shapes you'll read": "Inverted · Steepening · Flat",
        },
        "decision_points": [
            {
                "id": "d1_inverted",
                "title": "Decision 1 · Reading an Inverted Curve",
                "narrative": (
                    "Friday 1 of Q1. The screen is showing US Treasury yields:\n\n"
                    "  • 3-month: 5.45%\n"
                    "  • 2-year: 4.85%\n"
                    "  • 10-year: 4.10%\n"
                    "  • 30-year: 4.25%\n\n"
                    "Term spread (10Y − 2Y) = −75 bps. The 10Y − 3M spread = "
                    "−135 bps. This inversion has now persisted for 4 months. CNBC "
                    "anchors are debating it. Your CIO wants your one-line read on "
                    "what this curve shape is signalling for the next 12 months. "
                    "Pick your call:"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Just bond-market noise — yields stayed inverted in 1998 with no recession",
                        "description": (
                            "One historical exception. Don't over-fit a single signal."
                        ),
                        "consequence": (
                            "The 1998 example is a real exception — but it's the "
                            "exception, not the rule. The 10Y − 3M spread (the more "
                            "reliable Fed-research version) has gone meaningfully "
                            "negative for over 3 months before EVERY US recession "
                            "since 1970. Probability the market is wrong here: low. "
                            "Probability you're rationalising long-only positioning: "
                            "high. CIO won't accept this as analysis."
                        ),
                        "score_impact": {
                            "macro_framework": -3,
                            "transmission_logic": -1,
                            "timing_quality": -2,
                        },
                        "next_decision": "d2_steepening",
                    },
                    {
                        "id": "B",
                        "label": "High recession risk in the next 12 months — start trimming cyclicals",
                        "description": (
                            "10Y − 3M spread of −135 bps, sustained 4 months, has "
                            "preceded every US recession since 1970. Position the "
                            "book defensively: trim cyclicals, raise quality."
                        ),
                        "consequence": (
                            "Sharp call. The 10Y − 3M inversion is the cleanest "
                            "single-variable predictor of US recession in the "
                            "literature — Fed Bank of New York's recession-probability "
                            "model relies on exactly this spread. With a sustained "
                            "−135 bps for 4 months, the implied 12-month probability "
                            "of recession is in the 60–70% range. That doesn't mean "
                            "recession is certain; it means you should be position-"
                            "sizing for it: trim deep cyclicals (autos, metals, "
                            "industrials), raise quality (consumer staples, "
                            "regulated utilities, FMCG), and raise cash."
                        ),
                        "score_impact": {
                            "macro_framework": 5,
                            "transmission_logic": 3,
                            "timing_quality": 3,
                        },
                        "next_decision": "d2_steepening",
                    },
                    {
                        "id": "C",
                        "label": "Curve will steepen via Fed rate cuts → reflation trade now",
                        "description": (
                            "Fed cuts → short rates fall → curve un-inverts → reflation. "
                            "Get long cyclicals."
                        ),
                        "consequence": (
                            "You're skipping a step. The curve does eventually "
                            "steepen — but only AFTER the recession arrives. The "
                            "sequence is: invert → recession → Fed cuts → curve "
                            "steepens via lower short rates → reflation trade. "
                            "Buying cyclicals while the curve is still deeply "
                            "inverted means absorbing the recessionary drawdown "
                            "first. Right thesis, wrong window."
                        ),
                        "score_impact": {
                            "macro_framework": 0,
                            "transmission_logic": 1,
                            "timing_quality": -2,
                        },
                        "next_decision": "d2_steepening",
                    },
                ],
            },
            {
                "id": "d2_steepening",
                "title": "Decision 2 · Sector Rotation in a Steepening Curve",
                "narrative": (
                    "Friday 2 of Q1, six weeks later. The Fed has cut 50 bps; short "
                    "rates have dropped sharply but long rates have held. New screen:\n\n"
                    "  • 3-month: 4.95%\n"
                    "  • 2-year: 3.90%\n"
                    "  • 10-year: 4.25%\n"
                    "  • 30-year: 4.50%\n\n"
                    "10Y − 2Y = +35 bps (positive again, after months of inversion). "
                    "This is a classic 'bull-steepener' — short end falling faster "
                    "than long end. Time to pick the sector rotation. Where do you "
                    "rotate the book FIRST?"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Indian private banks (HDFC, ICICI, Kotak) — NIM expansion as the curve steepens",
                        "description": (
                            "Banks borrow short, lend long. Steepening = wider net "
                            "interest margin = textbook bank EPS upside."
                        ),
                        "consequence": (
                            "Cleanest call. The fundamental mechanic: banks fund "
                            "themselves on short-end rates (savings deposits, "
                            "interbank borrowing) and earn on long-end rates "
                            "(home loans, term loans, corporate paper). When the "
                            "curve steepens — short rates fall faster than long "
                            "rates — net interest margin expands directly. Indian "
                            "private banks are the cleanest expression because "
                            "they're not capital-constrained (vs PSU banks) and "
                            "have real CASA franchises. This is the textbook "
                            "first move in a steepening regime."
                        ),
                        "score_impact": {
                            "macro_framework": 3,
                            "transmission_logic": 5,
                            "timing_quality": 4,
                        },
                        "next_decision": "d3_duration",
                    },
                    {
                        "id": "B",
                        "label": "Indian growth tech (Zomato, PB Fintech, Nykaa) — lower discount rate = higher valuations",
                        "description": (
                            "Falling short rates = lower discount rate = higher PV "
                            "of distant cash flows = growth-stock multiple re-rating."
                        ),
                        "consequence": (
                            "Half right. Falling discount rates DO support growth "
                            "multiples — but only if the LONG END falls. Here only "
                            "the short end is falling; long rates are sticky around "
                            "4.25%. Growth stocks are long-duration assets — they "
                            "care about 10Y, not 3M. You'd be early on this trade "
                            "by 2 quarters. Banks first, growth-tech second once "
                            "the long end begins to follow."
                        ),
                        "score_impact": {
                            "macro_framework": 1,
                            "transmission_logic": -1,
                            "timing_quality": 0,
                        },
                        "next_decision": "d3_duration",
                    },
                    {
                        "id": "C",
                        "label": "Wait — let the curve fully un-invert before adding any risk",
                        "description": (
                            "Be conservative. Wait for the all-clear, then deploy."
                        ),
                        "consequence": (
                            "Curve has already un-inverted (+35 bps). Waiting "
                            "another two quarters means missing the entire bank "
                            "rotation. Equity moves anticipate macro, not lag it. "
                            "The 'wait for the all-clear' instinct is exactly what "
                            "loses alpha in rate-cycle inflection points. Risk-off "
                            "is fine when curve is inverted; once it steepens, "
                            "re-allocation is the alpha."
                        ),
                        "score_impact": {
                            "macro_framework": 0,
                            "transmission_logic": -1,
                            "timing_quality": -3,
                        },
                        "next_decision": "d3_duration",
                    },
                ],
            },
            {
                "id": "d3_duration",
                "title": "Decision 3 · Equity Duration Trim on a Flat Curve",
                "narrative": (
                    "Friday 3, end of Q1. The Fed pauses. Long-end yields rise as "
                    "fiscal-deficit concerns push the 10Y back up; short rates "
                    "stay where the Fed left them. New screen:\n\n"
                    "  • 3-month: 4.60%\n"
                    "  • 2-year: 4.55%\n"
                    "  • 10-year: 4.65%\n"
                    "  • 30-year: 4.85%\n\n"
                    "Curve is now FLAT (10Y − 2Y = +10 bps), but the long end is "
                    "rising. This is a 'bear-flattener' — bad for long-duration "
                    "assets. Your portfolio is overweight Indian growth tech "
                    "(Zomato, Paytm, PB Fintech, Nykaa). What's the right move?"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Hold growth tech — earnings are fine, multiples can hold",
                        "description": (
                            "If the underlying companies are still growing, "
                            "multiples should hold."
                        ),
                        "consequence": (
                            "You ignored the rate move. Growth stocks have negative "
                            "convexity to long-end yields — a 50 bps move on the "
                            "10Y typically prints a 10–15% multiple compression on "
                            "high-multiple growth names, regardless of earnings. "
                            "Indian growth tech has 30–60x P/S valuations that "
                            "MATHEMATICALLY require low long rates to make sense. "
                            "Holding through a bear-flattener has destroyed more "
                            "portfolios than any single sector call."
                        ),
                        "score_impact": {
                            "macro_framework": -2,
                            "transmission_logic": -3,
                            "timing_quality": -2,
                        },
                        "is_terminal": True,
                    },
                    {
                        "id": "B",
                        "label": "Trim growth tech, rotate into value (PSU banks, energy, capital goods)",
                        "description": (
                            "Long-duration assets get hurt as long rates rise; "
                            "short-duration value benefits. Rotate."
                        ),
                        "consequence": (
                            "Textbook bear-flattener move. The mechanic: high-"
                            "multiple growth stocks behave like long-duration bonds "
                            "— their PV is dominated by terminal-year cash flows "
                            "discounted at the 10Y. Long rates up → growth multiples "
                            "down. Conversely, value stocks (PSU banks, energy, "
                            "capital goods, autos) earn their cash flow in the next "
                            "1–3 years, so duration is short. The right move "
                            "isn't risk-off broadly — it's a duration-aware rotation. "
                            "Trim growth tech to neutral, add to value cyclicals "
                            "and PSU banks."
                        ),
                        "score_impact": {
                            "macro_framework": 4,
                            "transmission_logic": 5,
                            "timing_quality": 4,
                        },
                        "is_terminal": True,
                    },
                    {
                        "id": "C",
                        "label": "Sell everything — flat curve = recession warning, raise cash",
                        "description": (
                            "Flat curve historically precedes inversion. Get out."
                        ),
                        "consequence": (
                            "Wrong diagnosis. A bear-flattener (long rates rising "
                            "to meet short rates) is fundamentally different from "
                            "a bull-flattener (short rates rising to meet long "
                            "rates). The bear version is a fiscal/inflation signal, "
                            "not a recession warning — and it's exactly when value "
                            "and cyclicals outperform. Going to cash here means "
                            "missing the value rotation completely. Flat ≠ "
                            "inverted; the direction of flattening matters more "
                            "than the level."
                        ),
                        "score_impact": {
                            "macro_framework": -1,
                            "transmission_logic": -2,
                            "timing_quality": -2,
                        },
                        "is_terminal": True,
                    },
                ],
            },
        ],
        "scoring": {
            "dimensions": ["macro_framework", "transmission_logic", "timing_quality"],
            # Best path: B(5+3+3=11) -> A(3+5+4=12) -> B(4+5+4=13) => 36
            # Worst path: A(-3-1-2=-6) -> C(0-1-3=-4) -> A(-2-3-2=-7) => -17
            "max_total": 36,
            "min_total": -17,
            "outcome_mapping": [
                {
                    "min_total": -25,
                    "label": "Macro Read Withdrawn",
                    "narrative": (
                        "The CIO sends your three notes back. \"You missed the "
                        "inversion, missed the steepener, missed the bear-"
                        "flattener. Read Mishkin's chapter on the term structure "
                        "and re-do the framework before next month.\""
                    ),
                },
                {
                    "min_total": 0,
                    "label": "Mixed Macro Calls",
                    "narrative": (
                        "Two of three land directionally correct. Notes go out "
                        "with edits. The CIO hands you the desk's standard "
                        "rate-curve playbook — \"This is the muscle to build "
                        "before next quarter.\""
                    ),
                },
                {
                    "min_total": 16,
                    "label": "Solid Rate Strategist",
                    "narrative": (
                        "Three clean directional calls — recession risk read on "
                        "the inversion, bank rotation on the steepener, value/"
                        "cyclical rotation on the bear-flattener. The macro note "
                        "publishes under your name and gets picked up on the "
                        "morning call."
                    ),
                },
                {
                    "min_total": 28,
                    "label": "Top-Decile Macro Call",
                    "narrative": (
                        "Three for three with sharp framework application — you "
                        "called the recession risk early, rotated into private "
                        "banks at the right window, and trimmed long-duration "
                        "growth ahead of the bear-flattener. The CIO uses your "
                        "note as the desk's quarter-end macro framework. \"This "
                        "is how I want every analyst reading rates from here on.\""
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
        print("ERR body:", e.read().decode()); raise


def verify():
    cfg = SIM["config"]
    dpoints = {d["id"]: d for d in cfg["decision_points"]}
    optimal_total = 0
    worst_total = 0
    for d in cfg["decision_points"]:
        best = max(d["options"], key=lambda o: sum(o["score_impact"].values()))
        worst = min(d["options"], key=lambda o: sum(o["score_impact"].values()))
        optimal_total += sum(best["score_impact"].values())
        worst_total += sum(worst["score_impact"].values())
        for o in d["options"]:
            if not o.get("is_terminal"):
                assert o.get("next_decision") in dpoints
    assert optimal_total == cfg["scoring"]["max_total"], f"max mismatch {optimal_total}"
    assert worst_total == cfg["scoring"]["min_total"], f"min mismatch {worst_total}"
    bands = sorted(cfg["scoring"]["outcome_mapping"], key=lambda b: b["min_total"])
    assert optimal_total >= bands[-1]["min_total"]
    assert worst_total >= bands[0]["min_total"]
    dims = set(cfg["scoring"]["dimensions"])
    for d in cfg["decision_points"]:
        for o in d["options"]:
            assert set(o["score_impact"].keys()) == dims
    print(f"  ✓ optimal={optimal_total}  worst={worst_total}")


def main():
    print("Verifying SIM structure...")
    verify()
    sid = SIM["session_id"]
    existing = req("GET", f"master_simulations?session_id=eq.{sid}&select=id,sim_type,title")
    print(f"\nFound {len(existing)} existing sim(s)")
    for e in existing:
        print(f"  DELETE {e['id']} | {e['sim_type']} | {e['title'][:60]}")
        req("DELETE", f"master_simulations?id=eq.{e['id']}", want_json=False)
    print(f"\nINSERT new {SIM['sim_type']} sim: {SIM['title']}")
    inserted = req("POST", "master_simulations", body=SIM)
    print(f"  ✓ inserted id={inserted[0]['id']}")


if __name__ == "__main__":
    main()

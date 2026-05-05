#!/usr/bin/env python3
"""Delete + insert structured decision_making sim for M1 / Session 5
(Accounting Principles & Accrual Concepts).

Renders natively via DecisionMakingSim.jsx (decision_points + scoring with outcome_mapping).
Linear 3-decision flow, 3 options each, last decision terminal. 3 scoring dimensions.
"""
import json, sys, urllib.request, urllib.error

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

S5_SESSION_ID = "33fb3527-8304-4e1e-8a85-5c02f73870f6"

SIM = {
    "session_id": S5_SESSION_ID,
    "sim_type": "decision_making",
    "title": "Accrual Accounting Workshop — Three Calls That Decide Earnings Quality",
    "scenario": (
        "You are a forensic accounting analyst at a SEBI-registered research firm. "
        "Three Indian companies have flagged on your accrual screen this week and "
        "the desk needs an earnings-quality call on each before the Monday "
        "publication deadline. You'll apply revenue recognition rules under Ind AS "
        "115, the conservatism principle on inventory, and the accrual ratio "
        "framework on cash-vs-profit divergence — and decide whether each company "
        "is clean, watch-list, or red-flagged."
    ),
    "instructions": (
        "Three sequential calls, three decisions. Each decision has three options. "
        "Pick what an Ind AS 115 / IAS 2 / earnings-quality framework would actually "
        "say — not what the CFO of the company wants to hear. After each pick you'll "
        "see the consequence and score impact across three dimensions: Recognition "
        "Discipline (do you apply the right principle at the right time?), "
        "Conservatism Bias (do you write down losses early and recognise gains only "
        "when realised?), and Accrual Forensics (can you read the gap between "
        "reported profit and operating cash?). The flow is linear; the third "
        "decision is terminal and produces your final earnings-quality verdict."
    ),
    "objectives": [
        "Apply Ind AS 115 revenue recognition — distinguish 'point-in-time' from 'over-time' performance obligations and refuse to book multi-year service contracts upfront",
        "Apply the Matching Principle — match revenue with the cost of fulfilling it across the same period, not the period the cash moves",
        "Apply the Conservatism Principle — write inventory down to the lower of cost or net realisable value (Ind AS 2) the moment NRV drops below cost; don't wait for the sale",
        "Compute and interpret the Accrual Ratio = (Net Profit − CFO) / Total Assets, and use the standard bands (negative = excellent, 0–5% = good, 5–10% = investigate, > 10% = warning)",
        "Combine the accrual ratio with secondary signals — receivable days, inventory days, capitalisation rate — to deliver a Clean / Watch / Red Flag verdict",
        "Push back on CFO narratives ('we're growing fast, so cash always lags') with quantitative analyst framing",
    ],
    "config": {
        "scenario_context": (
            "Three earnings-quality calls land on your desk on Monday morning. "
            "The screen has flagged each one for a different reason — an upfront "
            "SaaS payment, a frozen inventory write-down, and a profit-vs-cash "
            "divergence. You have until 4 PM to publish a one-line verdict on "
            "each. Bring the framework, not the founder narrative."
        ),
        "initial_data": {
            "Frameworks you'll use": "Ind AS 115 · Ind AS 2 (lower of cost or NRV) · Accrual Ratio · Receivable Days",
            "Lens": "Forensic earnings-quality analyst",
            "Verdict scale": "Clean / Watch List / Red Flag",
            "Coverage": "1 SaaS · 1 Consumer durables · 1 Mid-cap industrial",
        },
        "decision_points": [
            {
                "id": "d1_revrec",
                "title": "Decision 1 · Revenue Recognition (Ind AS 115)",
                "narrative": (
                    "Company file: CloudKonnect Ltd — a Bangalore B2B SaaS firm. On "
                    "31 March (last day of FY), they signed a 3-year enterprise "
                    "contract with a large Indian bank for ₹3.6 cr, billed entirely "
                    "upfront. The CFO has emailed the auditor saying the entire "
                    "₹3.6 cr should be recognised as Q4 FY revenue because \"cash "
                    "has hit the bank.\" The contract gives the bank continuous "
                    "access to the platform plus support over 36 months — there is "
                    "no separate upfront license, no transfer of any IP. How "
                    "should this revenue actually be recognised under Ind AS 115?"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Recognise the full ₹3.6 cr in Q4 FY (cash received = revenue earned)",
                        "description": (
                            "CFO's view — book it all this quarter to land the FY "
                            "number, since the cash is in."
                        ),
                        "consequence": (
                            "This is exactly what Ind AS 115 was written to prevent. "
                            "Cash received ≠ revenue earned. The performance obligation "
                            "(continuous platform access + support) is satisfied OVER "
                            "TIME, not at signing. Booking ₹3.6 cr in Q4 inflates FY "
                            "revenue by ₹3.0 cr (the portion that belongs to FY+1 and "
                            "FY+2) and creates a deferred-revenue liability that wasn't "
                            "recognised. The auditor will call this out, and if it "
                            "slips through, you'll be writing the corrigendum next quarter."
                        ),
                        "score_impact": {
                            "recognition_discipline": -3,
                            "conservatism_bias": -2,
                            "accrual_forensics": -1,
                        },
                        "next_decision": "d2_inventory",
                    },
                    {
                        "id": "B",
                        "label": "Recognise ₹1.2 cr now (Year 1 worth) and defer ₹2.4 cr as a contract liability",
                        "description": (
                            "Year-by-year split: take the first 12 months into "
                            "current-FY revenue, defer the rest."
                        ),
                        "consequence": (
                            "Closer, but still wrong. The contract was signed on "
                            "31 March — there is effectively ZERO service delivered "
                            "in FY. Recognising ₹1.2 cr would mean booking 12 months "
                            "of revenue for one day of service. Under Ind AS 115, "
                            "revenue recognition is tied to satisfaction of the "
                            "performance obligation, which here means platform access "
                            "actually consumed. The right answer is essentially "
                            "₹0 in current FY, with ₹3.6 cr sitting as a contract "
                            "liability and unwinding ₹0.1 cr / month from April."
                        ),
                        "score_impact": {
                            "recognition_discipline": 0,
                            "conservatism_bias": 0,
                            "accrual_forensics": 0,
                        },
                        "next_decision": "d2_inventory",
                    },
                    {
                        "id": "C",
                        "label": "Defer all ₹3.6 cr; recognise ₹0.1 cr per month over 36 months as service is delivered",
                        "description": (
                            "Ind AS 115 textbook treatment: cash is a contract "
                            "liability until the performance obligation is satisfied "
                            "ratably over the contract period."
                        ),
                        "consequence": (
                            "Correct call — and exactly what an auditor would sign. "
                            "₹3.6 cr / 36 months = ₹0.1 cr / month is recognised "
                            "starting April; the remaining balance sits on the "
                            "balance sheet as 'Contract Liability' (deferred revenue). "
                            "This matches revenue with the period the bank actually "
                            "consumes the service. A SaaS company that books upfront "
                            "cash as immediate revenue is doing channel-stuffing on "
                            "an ARR business — and SEBI has fined this exact pattern "
                            "before. Your verdict: WATCH (because the CFO tried), but "
                            "the corrected number is clean."
                        ),
                        "score_impact": {
                            "recognition_discipline": 5,
                            "conservatism_bias": 2,
                            "accrual_forensics": 2,
                        },
                        "next_decision": "d2_inventory",
                    },
                ],
            },
            {
                "id": "d2_inventory",
                "title": "Decision 2 · Conservatism on Inventory (Ind AS 2)",
                "narrative": (
                    "Company file: AmbarSteel Appliances — a consumer-durables "
                    "mid-cap. On 31 March they hold ₹400 cr of finished-goods "
                    "inventory at cost. Industry-wide demand has cratered after the "
                    "festive season; the company's own MRP-led realisations would "
                    "now bring in only ₹320 cr at most (after expected discounts "
                    "and selling costs) — i.e., NRV ≈ ₹320 cr. The CFO argues:\n\n"
                    "  • \"Demand will recover next quarter — write-downs reverse anyway.\"\n"
                    "  • \"This is a temporary price drop, not a permanent impairment.\"\n"
                    "  • \"Holding at cost preserves balance-sheet strength for the "
                    "lender covenant.\"\n\n"
                    "What's the right accounting treatment under Ind AS 2?"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Hold inventory at cost (₹400 cr) — write-down only when actually sold below cost",
                        "description": (
                            "CFO's view — wait until the loss crystallises in a real "
                            "transaction, then book it."
                        ),
                        "consequence": (
                            "This is exactly the conservatism principle violation that "
                            "Ind AS 2 prevents. You don't wait for the loss to "
                            "crystallise — you recognise it the moment NRV falls "
                            "below cost. Holding at ₹400 cr overstates assets by "
                            "₹80 cr and overstates current-period profit (because the "
                            "write-down hasn't hit COGS). The covenant argument is "
                            "exactly the wrong reason — protecting bank covenants is "
                            "what triggers the SEBI Section 11(B) action. Auditors who "
                            "go along with this lose their licence."
                        ),
                        "score_impact": {
                            "recognition_discipline": -1,
                            "conservatism_bias": -4,
                            "accrual_forensics": -2,
                        },
                        "next_decision": "d3_accrual",
                    },
                    {
                        "id": "B",
                        "label": "Write inventory down to ₹320 cr (lower of cost or NRV); ₹80 cr loss to COGS this quarter",
                        "description": (
                            "Ind AS 2 textbook treatment: inventory carried at the "
                            "LOWER of cost or net realisable value, write-down "
                            "recognised in COGS the period NRV drops."
                        ),
                        "consequence": (
                            "Correct. Inventory now sits at ₹320 cr; the ₹80 cr "
                            "drop hits COGS this quarter, depressing reported profit "
                            "but preserving the integrity of the balance sheet. If "
                            "demand recovers next quarter and NRV rises back above "
                            "cost, Ind AS 2 allows a reversal up to the original "
                            "cost (never above), which mechanically smooths the P&L. "
                            "This is the Conservatism Principle in two lines: "
                            "recognise losses immediately; recognise gains only when "
                            "realised. Your earnings-quality verdict on this name: "
                            "CLEAN once the write-down is taken."
                        ),
                        "score_impact": {
                            "recognition_discipline": 3,
                            "conservatism_bias": 5,
                            "accrual_forensics": 3,
                        },
                        "next_decision": "d3_accrual",
                    },
                    {
                        "id": "C",
                        "label": "Average cost and NRV: carry at ₹360 cr — split the difference",
                        "description": (
                            "A 50/50 compromise to soften the hit while showing some "
                            "prudence."
                        ),
                        "consequence": (
                            "There is no such rule. Ind AS 2 is unambiguous: lower "
                            "of cost OR NRV, not the average. Booking at ₹360 cr "
                            "still overstates assets by ₹40 cr, understates COGS "
                            "this quarter by ₹40 cr, and creates an audit-trail "
                            "smell of arbitrary management estimates. Compromise "
                            "answers in accounting are usually wrong answers — the "
                            "standards exist precisely to remove this kind of "
                            "discretion."
                        ),
                        "score_impact": {
                            "recognition_discipline": -1,
                            "conservatism_bias": -2,
                            "accrual_forensics": -1,
                        },
                        "next_decision": "d3_accrual",
                    },
                ],
            },
            {
                "id": "d3_accrual",
                "title": "Decision 3 · Earnings Quality via Accrual Ratio",
                "narrative": (
                    "Company file: PrithviGears Ltd — a mid-cap auto-component "
                    "supplier. The screen has flagged a sharp profit-vs-cash "
                    "divergence in FY24. Pulling the data:\n\n"
                    "  • Reported Net Profit (PAT): ₹500 cr (up 32% YoY)\n"
                    "  • Cash Flow from Operations (CFO): ₹150 cr (down 18% YoY)\n"
                    "  • Total Assets: ₹3,500 cr\n"
                    "  • Receivable days: 60 → 95 (up 35 days)\n"
                    "  • Inventory days: 50 → 58 (up 8 days)\n"
                    "  • Top 3 customers' share of receivables: 78% (up from 52%)\n\n"
                    "Management's narrative: \"Strong order book, customers asked "
                    "for longer credit terms — temporary working capital swing.\" "
                    "Compute the accrual ratio and pick the verdict you'd publish:"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Verdict: CLEAN — fast-growing companies routinely show CFO lagging PAT",
                        "description": (
                            "Working capital builds with growth. Don't punish a "
                            "company for selling more."
                        ),
                        "consequence": (
                            "You bought the management narrative without doing the "
                            "math. Accrual Ratio = (PAT − CFO) / Total Assets = "
                            "(500 − 150) / 3,500 = 10.0% — squarely in the WARNING "
                            "band (>10%). And it's not just the ratio: receivable "
                            "days jumped 35 days AND customer concentration spiked "
                            "from 52% to 78%. Both are textbook channel-stuffing "
                            "fingerprints — pulling sales forward by extending credit "
                            "to a small group of large customers, who then renegotiate "
                            "or reverse the order. \"Clean\" is the wrong call."
                        ),
                        "score_impact": {
                            "recognition_discipline": -2,
                            "conservatism_bias": -2,
                            "accrual_forensics": -3,
                        },
                        "is_terminal": True,
                    },
                    {
                        "id": "B",
                        "label": "Verdict: RED FLAG — Accrual ratio 10%, receivable blowout, customer concentration spike",
                        "description": (
                            "Quantitative call: (500 − 150) / 3,500 = 10.0% accrual "
                            "ratio, in the warning band. Receivable days 60 → 95 "
                            "and concentration 52% → 78% confirm channel-stuffing "
                            "pattern."
                        ),
                        "consequence": (
                            "This is the clean analyst call. Accrual ratio of 10% "
                            "alone would be a watch-list flag; combined with a "
                            "35-day receivable blowout AND customer concentration "
                            "spike to 78%, you have all three classic earnings-quality "
                            "warnings firing at once. The most likely diagnosis: the "
                            "company is pulling FY25 sales into FY24 by extending "
                            "credit to top customers — a pattern that typically "
                            "reverses violently in the following quarter when those "
                            "receivables age out, get renegotiated, or get written "
                            "off. Your published verdict: RED FLAG, downgrade rating, "
                            "exit before the Q1 numbers hit."
                        ),
                        "score_impact": {
                            "recognition_discipline": 4,
                            "conservatism_bias": 3,
                            "accrual_forensics": 5,
                        },
                        "is_terminal": True,
                    },
                    {
                        "id": "C",
                        "label": "Verdict: PASS — need 5 years of data before calling it",
                        "description": (
                            "Don't have enough history to be sure. Hold the rating "
                            "until FY25 prints."
                        ),
                        "consequence": (
                            "Analysis paralysis. You have the accrual ratio, the "
                            "receivable days, and the concentration spike all "
                            "screaming at you in a single year — that IS the signal. "
                            "Waiting another 4 quarters before publishing a view "
                            "means the buy-side will have already exited and your "
                            "research desk is publishing a stale call. The accrual "
                            "ratio framework is designed for one-period diagnosis "
                            "precisely because waiting destroys the alpha."
                        ),
                        "score_impact": {
                            "recognition_discipline": 0,
                            "conservatism_bias": -1,
                            "accrual_forensics": -1,
                        },
                        "is_terminal": True,
                    },
                ],
            },
        ],
        "scoring": {
            "dimensions": [
                "recognition_discipline",
                "conservatism_bias",
                "accrual_forensics",
            ],
            # Best path: C (5+2+2=9) -> B (3+5+3=11) -> B (4+3+5=12) => 32
            # Worst path: A (-3-2-1=-6) -> A (-1-4-2=-7) -> A (-2-2-3=-7) => -20
            "max_total": 32,
            "min_total": -20,
            "outcome_mapping": [
                {
                    "min_total": -25,
                    "label": "Earnings Note Pulled",
                    "narrative": (
                        "The desk pulls your three notes before publication. The "
                        "Head of Research books a Friday session: \"Re-read Ind AS "
                        "115 and 2 from line one. Until you can run the accrual "
                        "ratio framework cold, you're not on coverage.\""
                    ),
                },
                {
                    "min_total": 0,
                    "label": "Notes Issued With Caveats",
                    "narrative": (
                        "Two out of three calls land directionally right but the "
                        "framework application is shaky. Notes go out with "
                        "supervisor edits. You're handed the standard accrual-"
                        "diagnostics template to internalise before next month's "
                        "screening run."
                    ),
                },
                {
                    "min_total": 14,
                    "label": "Solid Earnings-Quality Coverage",
                    "narrative": (
                        "You correctly applied Ind AS 115 on the SaaS, Ind AS 2 "
                        "on the inventory, and the accrual ratio on the "
                        "auto-supplier. Your three verdicts go out under your "
                        "name. Buy-side calls in for follow-ups — the analyst "
                        "voice is forming."
                    ),
                },
                {
                    "min_total": 24,
                    "label": "Top-of-Desk Forensic Note",
                    "narrative": (
                        "Three for three — accrual discipline, conservative "
                        "write-down, and a clean RED FLAG on PrithviGears with "
                        "the math worked. Two weeks later the company prints a "
                        "Q1 receivables write-back and the stock drops 22%. The "
                        "Head of Research forwards your note to the Risk team "
                        "with: \"This is the level of forensic work we need on "
                        "every name.\""
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
                assert o.get("next_decision") in dpoints, f"bad next_decision: {o['id']} -> {o.get('next_decision')}"
    assert optimal_total == cfg["scoring"]["max_total"], f"max mismatch: {optimal_total} vs {cfg['scoring']['max_total']}"
    assert worst_total == cfg["scoring"]["min_total"], f"min mismatch: {worst_total} vs {cfg['scoring']['min_total']}"

    bands = sorted(cfg["scoring"]["outcome_mapping"], key=lambda b: b["min_total"])
    top = bands[-1]; bot = bands[0]
    assert optimal_total >= top["min_total"], f"optimal {optimal_total} can't reach top band"
    assert worst_total >= bot["min_total"]

    dims = set(cfg["scoring"]["dimensions"])
    for d in cfg["decision_points"]:
        for o in d["options"]:
            assert set(o["score_impact"].keys()) == dims, f"{o['id']} dim mismatch"

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

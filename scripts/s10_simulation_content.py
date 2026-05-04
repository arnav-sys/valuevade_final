"""
Replacement decision-making simulation for Module 1 / Session 10:
"Corporate Finance Essentials — How Companies Fund Themselves"

session_id: 3b749a86-8d68-448d-9ac0-052400b63b34
old sim_id (to delete): 0bbf18c6-5f4a-41d4-816e-241979b6c05e

Scoring dimensions (max +8, min −5):
  - cost_efficiency       (cheaper financing = positive)
  - financial_flexibility (lower leverage / longer tenure = positive)
  - shareholder_value     (less dilution / faster value capture = positive)

Outcome bands:
  min_total ≥ 7: Textbook Capital Strategy
  min_total ≥ 4: Solid Capital Plan
  min_total ≥ 0: Mixed Outcome
  min_total < 0: Capital Structure Damaged
"""

S10_SIM = {
    "session_id": "3b749a86-8d68-448d-9ac0-052400b63b34",
    "sim_type": "decision_making",
    "title": "Capital Structure Workshop — Funding ChaiBro's National Rollout",
    "scenario": (
        "You are the newly appointed CFO of ChaiBro Beverages, a fast-growing Indian "
        "tea-and-coffee retail chain. The Board has approved a ₹400 crore expansion plan "
        "to add 60 new outlets across Bengaluru, Hyderabad, Pune and Chennai over the "
        "next 18–24 months. Your job: decide HOW to fund it. Three back-to-back decisions "
        "lie ahead — funding mix, debt tenure, and capex pacing. Every choice trades off "
        "cost, flexibility and shareholder value. Choose well."
    ),
    "instructions": (
        "Read the brief, then click the option you would back as CFO. After each choice "
        "you'll see the consequence and the impact on three dimensions: Cost Efficiency, "
        "Financial Flexibility, and Shareholder Value. After all three decisions the "
        "Board will rate your overall capital plan. You can replay or peek at the optimal "
        "path at the end."
    ),
    "objectives": [
        "Apply the trade-off between debt and equity financing in a real corporate-finance scenario",
        "Choose the right debt tenure given growth, cash-flow stability and refinance risk",
        "Decide capex pacing under cost-overrun risk versus revenue-ramp opportunity",
        "Develop a cohesive capital-structure point of view across multiple sequential decisions",
    ],
    "config": {
        "scenario_context": (
            "ChaiBro Beverages — FY24 snapshot:\n\n"
            "• Revenue: ₹650 cr (growing ~28% YoY)\n"
            "• EBITDA: ₹120 cr (~18% margin)\n"
            "• Net Debt: ₹50 cr  ·  Total Equity: ₹500 cr  ·  Current D/E: 0.10x\n"
            "• 80 outlets across Mumbai, Delhi-NCR and Kolkata\n\n"
            "The Board has cleared a ₹400 cr expansion: 60 new outlets in Bengaluru, "
            "Hyderabad, Pune and Chennai. As CFO, you must decide the funding mix, the "
            "debt tenure, and the deployment pace. Three decisions, one Board verdict."
        ),
        "initial_data": {
            "Capex required": "₹400 cr",
            "Current EBITDA": "₹120 cr",
            "Current Net Debt": "₹50 cr",
            "Current D/E": "0.10x",
            "New outlets planned": "60",
            "Markets": "Bengaluru · Hyderabad · Pune · Chennai",
        },
        "scoring": {
            "max_total": 8,
            "outcome_mapping": [
                {
                    "min_total": -10,
                    "label": "Capital Structure Damaged",
                    "narrative": (
                        "The Board is concerned. Your funding plan over-leveraged the balance sheet, "
                        "diluted shareholders unnecessarily, OR took on costly capital at the wrong "
                        "tenure. Either way, ChaiBro is now financially constrained going into a "
                        "competitive expansion. The Audit Committee has asked for a do-over before "
                        "the next Board meeting — and your equity-research coverage analysts are "
                        "downgrading their target prices."
                    ),
                },
                {
                    "min_total": 0,
                    "label": "Mixed Outcome",
                    "narrative": (
                        "Your plan is workable but compromised. One or two decisions were sound, "
                        "but at least one created an avoidable cost — either too much leverage, "
                        "too much dilution, or pacing that mismatches operational capacity. The "
                        "Board has approved the plan with caveats and asked you to revisit the "
                        "weak link in twelve months. There is room to improve."
                    ),
                },
                {
                    "min_total": 4,
                    "label": "Solid Capital Plan",
                    "narrative": (
                        "The Board signs off with confidence. Your funding mix is balanced, the "
                        "debt tenure aligns with cash generation, and capex pacing respects "
                        "operational reality. ChaiBro enters the rollout with adequate financial "
                        "flexibility and protected shareholder value. The CFO seat is yours to "
                        "keep — this is the standard expected of a Tier-1 listed mid-cap."
                    ),
                },
                {
                    "min_total": 7,
                    "label": "Textbook Capital Strategy",
                    "narrative": (
                        "An exemplary capital plan. You picked the optimal mix between debt and "
                        "equity, matched the debt tenure to the cash-flow profile of the business, "
                        "and paced capex at the level operations can absorb without cost overruns. "
                        "The Board moves a vote of confidence and sell-side analysts upgrade their "
                        "target prices, citing 'best-in-class capital allocation'. This is the "
                        "decision pattern that defines a great corporate-finance professional."
                    ),
                },
            ],
        },
        "decision_points": [
            # ───────────────────────── D1: Funding mix ─────────────────────────
            {
                "id": "d1",
                "title": "Decision 1 of 3 · Funding Mix",
                "narrative": (
                    "₹400 cr is needed. The market is open — equity capital is available via "
                    "a QIP at a discount of ~5% to current price (≈10% dilution), and HDFC "
                    "Bank has soft-circled a term loan facility at competitive rates. How do "
                    "you split the funding between debt and equity?"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "100% Debt — ₹400 cr term loan",
                        "description": "Cheapest cost of capital, zero dilution, fastest to close. But pushes D/E from 0.10x to ~0.90x — a meaningful step-up in leverage.",
                        "score_impact": {"cost_efficiency": 2, "financial_flexibility": -3, "shareholder_value": 2},
                        "consequence": (
                            "The loan closes within three weeks at a blended ~9.5% cost. Your weighted "
                            "average cost of capital improves and shareholders are not diluted. BUT "
                            "post-drawdown your Debt-to-EBITDA jumps from 0.4x to roughly 3.7x, "
                            "and the rating agency puts ChaiBro on negative watch. Any operational "
                            "stumble in year-1 of the rollout will now be amplified by interest cost."
                        ),
                        "next_decision": "d2",
                    },
                    {
                        "id": "B",
                        "label": "100% Equity — ₹400 cr QIP",
                        "description": "Zero financial leverage added. But existing shareholders are diluted ~10% at a 5% discount, locking in a higher cost of capital and creating an EPS drag.",
                        "score_impact": {"cost_efficiency": -2, "financial_flexibility": 2, "shareholder_value": -2},
                        "consequence": (
                            "The QIP is anchored by long-only mutual funds — strong validation of the "
                            "growth story. Balance sheet remains net-debt-light. But existing shareholders "
                            "are diluted ~10%, EPS dips for two years before recovering, and you have "
                            "paid for capital that costs roughly 14% (cost of equity) when 9.5% debt was "
                            "available. Sell-side analysts trim their target prices on the dilution overhang."
                        ),
                        "next_decision": "d2",
                    },
                    {
                        "id": "C",
                        "label": "60/40 Mix — ₹250 cr term loan + ₹150 cr equity",
                        "description": "A balanced sleeve: take the cheap debt up to a comfortable leverage level (D/E ~0.50x), then top up with equity for ~4% dilution. Most companies in this growth phase pick this.",
                        "score_impact": {"cost_efficiency": 1, "financial_flexibility": 1, "shareholder_value": 1},
                        "consequence": (
                            "Both pieces close in parallel — the term loan in three weeks, the QIP in "
                            "six. Post-drawdown D/E moves to a still-comfortable 0.50x, and dilution is "
                            "limited to ~4%. Rating outlook stable. You have used cheap debt where it is "
                            "safe to do so, then layered equity on top to keep the capital structure "
                            "robust. The Board nods approvingly."
                        ),
                        "next_decision": "d2",
                    },
                ],
            },

            # ───────────────────── D2: Debt tenure ─────────────────────
            {
                "id": "d2",
                "title": "Decision 2 of 3 · Debt Tenure",
                "narrative": (
                    "Whatever debt slug you took, HDFC Bank now needs you to lock the tenure. "
                    "The yield curve is upward sloping — longer tenures cost more but offer "
                    "refinance certainty. New ChaiBro outlets typically take 18 months to break "
                    "even and 36 months to hit steady-state EBITDA. Pick a tenure."
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "3-Year Term Loan @ 9.0%",
                        "description": "Shortest, cheapest. But matures BEFORE the new outlets reach steady-state EBITDA, leaving you to refinance under uncertain rate conditions.",
                        "score_impact": {"cost_efficiency": 1, "financial_flexibility": -2, "shareholder_value": 0},
                        "consequence": (
                            "Cheap funding locked. But year-3 will arrive with the new outlets only halfway "
                            "to maturity EBITDA, and you will need to re-tap the market just as the loan "
                            "comes due. If rates spike or sentiment turns, you may be forced into expensive "
                            "refinancing or an emergency equity raise. The Audit Committee flags refinance "
                            "risk explicitly."
                        ),
                        "next_decision": "d3",
                    },
                    {
                        "id": "B",
                        "label": "5-Year Term Loan @ 9.5%",
                        "description": "Tenure aligns with steady-state EBITDA timing of the new outlets. Modest extra cost, dramatic improvement in financial flexibility.",
                        "score_impact": {"cost_efficiency": 0, "financial_flexibility": 2, "shareholder_value": 0},
                        "consequence": (
                            "Excellent fit. By the time this loan matures, the 60 new outlets will be "
                            "comfortably above their steady-state EBITDA, leaving plenty of cash to "
                            "refinance OR repay outright. The 50 bps extra cost above the 3-year is small "
                            "insurance against refinance risk. Rating agencies appreciate the tenure-asset "
                            "matching."
                        ),
                        "next_decision": "d3",
                    },
                    {
                        "id": "C",
                        "label": "7-Year Term Loan @ 10.25%",
                        "description": "Locks in funding well past the rollout's break-even. But 75 bps more expensive than the 5-year and likely overpays for term-premium.",
                        "score_impact": {"cost_efficiency": -2, "financial_flexibility": 2, "shareholder_value": 0},
                        "consequence": (
                            "Maximum tenure certainty achieved — there is no refinance event in sight. But "
                            "you are paying a 125 bps premium over the 3-year tenor for time you do not need: "
                            "the rollout will be cash-generating long before year-7. Over 7 years that 75 bps "
                            "extra cost (vs the 5-year) compounds to a meaningful drag on PAT — money the "
                            "shareholders effectively pay to the bank for unnecessary insurance."
                        ),
                        "next_decision": "d3",
                    },
                ],
            },

            # ───────────────────── D3: Capex pacing ─────────────────────
            {
                "id": "d3",
                "title": "Decision 3 of 3 · Capex Pacing",
                "narrative": (
                    "Funding is locked. Now decide how fast to deploy. ChaiBro's site-acquisition "
                    "and fit-out teams can stretch — but every accelerated month adds cost-overrun "
                    "risk. Every stretched month delays revenue. Pick a deployment pace."
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Aggressive — All 60 outlets in 12 months",
                        "description": "Fastest revenue ramp. But your fit-out team is currently sized for ~30 stores/year — you will pay heavy contractor premiums and accept fit-out cost overruns of 12–18%.",
                        "score_impact": {"cost_efficiency": -2, "financial_flexibility": -1, "shareholder_value": 1},
                        "consequence": (
                            "Stores open at a furious pace, but ~30% of them go over fit-out budget. Total "
                            "capex creeps from ₹400 cr to ~₹460 cr — an unbudgeted ₹60 cr you must absorb. "
                            "Several of the rushed openings have teething issues with staffing and supply "
                            "chain, and unit-economics in months 1–3 are below pro-forma. Revenue arrives "
                            "early, but profitability is delayed."
                        ),
                        "is_terminal": True,
                    },
                    {
                        "id": "B",
                        "label": "Balanced — 60 outlets in 18 months",
                        "description": "Matches your team's organic execution capacity. Modest contractor stretch, no major cost overruns, and revenue starts ramping by month 6.",
                        "score_impact": {"cost_efficiency": 1, "financial_flexibility": 1, "shareholder_value": 1},
                        "consequence": (
                            "Crisp execution. Capex stays within the ₹400 cr envelope (mild ~3% slippage, "
                            "absorbed easily). Outlets open at a steady cadence of ~3–4 per month, and the "
                            "ops team is able to refine the playbook from each new opening. By month 18, "
                            "all 60 outlets are operational, and the first cohort is already at run-rate "
                            "EBITDA. The Board calls this 'an exemplar of disciplined growth'."
                        ),
                        "is_terminal": True,
                    },
                    {
                        "id": "C",
                        "label": "Conservative — 60 outlets in 24 months",
                        "description": "Lowest execution risk and lowest cost overrun. But you delay revenue by 6 months relative to the balanced plan, and competitors in the four target cities use that time to entrench.",
                        "score_impact": {"cost_efficiency": 1, "financial_flexibility": 1, "shareholder_value": -2},
                        "consequence": (
                            "Execution is flawless and capex is on budget. But revenue arrives 6 months "
                            "later than the balanced plan — and during those six months, two competing "
                            "chains opened 25 outlets in the same target catchments. ChaiBro's eventual "
                            "market share in the new cities is 200–300 bps lower than it would have been "
                            "under the 18-month plan. You saved capex, but you lost first-mover share — "
                            "shareholder value is materially impaired even though the capital plan looks clean."
                        ),
                        "is_terminal": True,
                    },
                ],
            },
        ],
    },
}

"""
Decision-making simulations for Module 1 Sessions 14 & 15.

S14 — Microeconomics for Equity Analysts:
   "Industry Position Workshop — Sizing SunChem Paints in Your Coverage"
   3 sequential decisions: Industry Structure → Pricing-Power Read → Position Sizing
   Dimensions: analytical_rigor, moat_signal_read, conviction_quality

S15 — Macroeconomics for Equity Analysts:
   "Macro-to-Market Workshop — Trading the RBI's Surprise 50 bps Hike"
   3 sequential decisions: Yield-Curve Read → Sector Rotation → Equity Duration Call
   Dimensions: macro_framework, transmission_logic, timing_quality

Both use the same DecisionMakingSim schema as the ChaiBro sim.
Linear (non-branching) flow, last decision is terminal.
"""

# =========================================================================
# S14 — MICROECONOMICS  (session_id 84ea3aa7-c0a2-4800-8283-86affa1b9473)
# =========================================================================
S14_SIM = {
    "session_id": "84ea3aa7-c0a2-4800-8283-86affa1b9473",
    "sim_type": "decision_making",
    "title": "Industry Position Workshop — Sizing SunChem Paints in Your Coverage",
    "scenario": (
        "You are a sector analyst at a Mumbai brokerage covering Indian decorative paints. "
        "It is Initiation Week for SunChem Paints — a mid-cap paints player you have been "
        "asked to formally cover. Before you publish your first note, you must form a view "
        "on three things in sequence: how the industry is structured, whether SunChem has "
        "real pricing power, and how to size the position in your coverage portfolio. The "
        "right answers come from microeconomics frameworks — industry structure, moats, and "
        "evidence-led conviction."
    ),
    "instructions": (
        "Read each brief, then click the option that best applies the microeconomics "
        "framework to the evidence on the table. After each choice you'll see the senior "
        "analyst's feedback and the impact on three dimensions: Analytical Rigor, "
        "Moat-Signal Read, and Conviction Quality. After all three calls, the desk head "
        "rates your initiation note."
    ),
    "objectives": [
        "Apply industry structure analysis (concentration, oligopoly vs commodity) to a real Indian sector",
        "Distinguish a genuine pricing-power signal from a coincidental cost-push pass-through",
        "Convert your industry & moat read into a position-sizing decision the desk can act on",
    ],
    "config": {
        "scenario_context": (
            "Indian Decorative Paints — 2026 snapshot:\n\n"
            "• Top-4 share: ~85% (Asian Paints ~50%, Berger ~17%, Nerolac ~12%, SunChem ~6%)\n"
            "• Bottom 100+ players: ~15% combined, mostly regional/unorganised\n"
            "• Industry has run profitable for 20+ years through multiple raw-material cycles\n"
            "• SunChem just raised prices 8% in March; the rest of the industry followed within 3 weeks\n\n"
            "You have ₹400 cr of incremental coverage capital to allocate. Three decisions stand "
            "between you and your initiation note."
        ),
        "initial_data": {
            "Industry Top-4 Share": "~85%",
            "SunChem Market Share": "~6%",
            "SunChem Recent Price Hike": "+8% (March)",
            "Industry Follow-Through": "Within 3 weeks",
            "Industry Track Record": "20+ years profitable",
        },
        "scoring": {
            "max_total": 10,
            "outcome_mapping": [
                {
                    "min_total": -10,
                    "label": "Initiation Withdrawn",
                    "narrative": (
                        "The desk head reads your draft initiation and asks you to withdraw it. "
                        "The framework reads are inconsistent with the evidence on the table — "
                        "either you classified the industry incorrectly, missed the pricing-power "
                        "signal, or sized the call against your own conclusions. Back to the "
                        "library before the next attempt."
                    ),
                },
                {
                    "min_total": 0,
                    "label": "Caveated Initiation",
                    "narrative": (
                        "Your note ships with caveats. One or two reads were sound but at least "
                        "one was inconsistent with the evidence. Sales is allowed to send the note "
                        "out but the desk head asks you to revisit the weak step before quarterly "
                        "model maintenance. The thesis is workable but not crisp."
                    ),
                },
                {
                    "min_total": 4,
                    "label": "Solid Initiation",
                    "narrative": (
                        "Your initiation is published with a coherent thesis. Industry structure "
                        "is correctly diagnosed, the pricing-power signal is read for what it is, "
                        "and the position size aligns with your conviction. Sales are happy to "
                        "carry the call. This is the standard expected of a competent sector analyst."
                    ),
                },
                {
                    "min_total": 8,
                    "label": "Best-in-Class Initiation",
                    "narrative": (
                        "An exemplary initiation. You diagnosed the oligopoly correctly, recognised "
                        "the price-leader / industry-follow pattern as a textbook moat signal, and "
                        "sized the call with conviction-matched aggression. The desk head circulates "
                        "your note to the firm as a model initiation. This is the analytical pattern "
                        "that defines a top sector specialist."
                    ),
                },
            ],
        },
        "decision_points": [
            # ───────── D1 — Industry Structure ─────────
            {
                "id": "d1",
                "title": "Decision 1 of 3 · Industry Structure",
                "narrative": (
                    "First diagnosis. The Indian decorative-paints industry has top-4 market share "
                    "of ~85%, with hundreds of fringe players sharing the remaining 15%. Industry "
                    "profit pools have been positive every year for 20+ years. How do you classify "
                    "this industry?"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Perfect Competition (commodity)",
                        "description": "Many small players, no pricing power, everyone earns the cost of capital. Standard textbook commodity setup.",
                        "score_impact": {"analytical_rigor": -2, "moat_signal_read": -1},
                        "consequence": (
                            "The desk head looks puzzled. 'Top-4 has 85% share and 20 years of "
                            "consistent profitability — that is the literal opposite of perfect "
                            "competition. Perfect competition has fragmented share and zero economic "
                            "profit. You have just classified one of India's most successful oligopolies "
                            "as a commodity.' Re-read Porter's Five Forces before publishing anything."
                        ),
                        "next_decision": "d2",
                    },
                    {
                        "id": "B",
                        "label": "Oligopoly with Brand & Distribution Moats",
                        "description": "Few large players, repeat profits over decades, brand and distribution barriers — classic oligopoly with sustainable rents.",
                        "score_impact": {"analytical_rigor": 2, "moat_signal_read": 2},
                        "consequence": (
                            "Correct framework. Top-4 share of 85% with 20+ years of positive profit "
                            "pools is the definition of a stable oligopoly. The barriers — brand "
                            "preference, dealer network, distribution depth, working-capital scale — "
                            "are well-documented in the paints industry. This is exactly the structure "
                            "where pricing power exists. Set up perfectly for the next decision."
                        ),
                        "next_decision": "d2",
                    },
                    {
                        "id": "C",
                        "label": "Monopoly Risk — antitrust concerns ahead",
                        "description": "85% top-4 concentration borders on monopolistic. Risk of CCI investigation could cap returns.",
                        "score_impact": {"analytical_rigor": 0, "moat_signal_read": -1},
                        "consequence": (
                            "Half-right, half-wrong. The CONCENTRATION number is high, but the "
                            "industry has FOUR competitors — not one — and they actively compete on "
                            "product innovation, distribution and brand. CCI would have no case under "
                            "Indian antitrust law. The right diagnosis here is OLIGOPOLY, not monopoly. "
                            "You correctly noticed concentration but applied the wrong framework."
                        ),
                        "next_decision": "d2",
                    },
                ],
            },

            # ───────── D2 — Pricing Power Read ─────────
            {
                "id": "d2",
                "title": "Decision 2 of 3 · Pricing-Power Signal",
                "narrative": (
                    "March data point: SunChem raised prices by 8% to pass on a TiO2 (titanium "
                    "dioxide) cost spike. Within 3 weeks, Asian Paints, Berger and Nerolac all raised "
                    "prices by 6–9% across their portfolios. Volumes did not collapse. What does this "
                    "tell you about SunChem's pricing power?"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Strong Pricing Power — moat intact and visible",
                        "description": "Successful price hike followed by industry within weeks, no volume hit — textbook signal of pass-through ability and oligopoly discipline.",
                        "score_impact": {"moat_signal_read": 2, "analytical_rigor": 1, "conviction_quality": 1},
                        "consequence": (
                            "Excellent read. The fact that SunChem moved FIRST and the rest of the "
                            "industry followed within 3 weeks is a near-perfect oligopoly-discipline "
                            "signal. No volume collapse → end-customer pricing power is real, not just "
                            "shelf-price posturing. This is high-quality evidence — the kind that is "
                            "hard to fake and even harder to repeat."
                        ),
                        "next_decision": "d3",
                    },
                    {
                        "id": "B",
                        "label": "Coincidence — everyone faced the same cost push",
                        "description": "TiO2 spiked for everyone simultaneously. The industry-wide hike doesn't tell you anything specific about SunChem's moat.",
                        "score_impact": {"moat_signal_read": -1, "conviction_quality": -2},
                        "consequence": (
                            "Partially valid but missing the point. Yes, all players faced the same "
                            "cost push — but in commodity industries with no pricing power, hikes do "
                            "not stick: customers switch, channels resist, and someone undercuts within "
                            "weeks. Here the hike held AND was followed by competitors, AND volumes "
                            "did not collapse. That is precisely the pattern that demonstrates pricing "
                            "power — not negates it."
                        ),
                        "next_decision": "d3",
                    },
                    {
                        "id": "C",
                        "label": "Volume risk imminent — wait for next quarter",
                        "description": "Price hikes always cause volume loss; just hasn't shown up in this quarter's data.",
                        "score_impact": {"moat_signal_read": -2, "analytical_rigor": -1},
                        "consequence": (
                            "Default skepticism without evidence. The data point is clear: industry-wide "
                            "follow-through within 3 weeks AND volumes held. In oligopoly markets with "
                            "brand-led demand (paints, FMCG), 6–9% hikes routinely stick because there "
                            "is no cheaper functional substitute — the unorganised 15% sells different "
                            "products to a different customer. You have rejected a high-quality moat "
                            "signal on hypothetical concerns."
                        ),
                        "next_decision": "d3",
                    },
                ],
            },

            # ───────── D3 — Position Sizing ─────────
            {
                "id": "d3",
                "title": "Decision 3 of 3 · Position Sizing",
                "narrative": (
                    "Final call. Based on your industry-structure read and pricing-power assessment, "
                    "how do you size SunChem in your model coverage portfolio? Remember: position size "
                    "should reflect conviction, not consensus."
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Underweight — too late, the rerating is already in",
                        "description": "Stock is up 20% this year on the price-hike narrative. Most of the upside is priced in.",
                        "score_impact": {"conviction_quality": -2, "analytical_rigor": -1},
                        "consequence": (
                            "Inconsistent with your own analysis. You diagnosed an oligopoly with "
                            "demonstrated pricing power — that is a multi-year compounding setup, not "
                            "a one-quarter trade. Underweighting it because of a 20% YTD move ignores "
                            "the durable moat you just identified. The desk head asks: 'If this is a "
                            "great business, why are we under-owning it?'"
                        ),
                        "is_terminal": True,
                    },
                    {
                        "id": "B",
                        "label": "Equal-Weight — go with consensus",
                        "description": "Match the benchmark weight. No view.",
                        "score_impact": {"conviction_quality": -1},
                        "consequence": (
                            "Safe, but not what initiation analysts get paid for. You have done the "
                            "framework work and identified a high-quality oligopoly with visible "
                            "pricing power. Equal-weighting against that read effectively says 'I have "
                            "no differentiated view' — which the desk head can get from any sell-side "
                            "consensus screen. The conviction does not match the analysis."
                        ),
                        "is_terminal": True,
                    },
                    {
                        "id": "C",
                        "label": "Overweight — durable oligopoly, visible moat, multi-year compounder",
                        "description": "Size it 1.5x benchmark weight. Conviction matches the analysis: structurally attractive industry + moat-confirmed pricing power.",
                        "score_impact": {"conviction_quality": 2, "moat_signal_read": 1, "analytical_rigor": 1},
                        "consequence": (
                            "Conviction matched to evidence. You have identified a stable oligopoly, "
                            "confirmed the moat through a real-time pricing-power signal, and sized "
                            "the call accordingly. The desk head circulates your initiation as a model "
                            "of how to convert framework analysis into actionable position sizing. "
                            "This is the analytical pattern that defines a great sector specialist."
                        ),
                        "is_terminal": True,
                    },
                ],
            },
        ],
    },
}


# =========================================================================
# S15 — MACROECONOMICS  (session_id d6342f68-8850-45c3-b96f-9a4505a580c9)
# =========================================================================
S15_SIM = {
    "session_id": "d6342f68-8850-45c3-b96f-9a4505a580c9",
    "sim_type": "decision_making",
    "title": "Macro-to-Market Workshop — Trading the RBI's Surprise 50 bps Hike",
    "scenario": (
        "It is 2:30 PM on a Friday. The RBI MPC has just announced a SURPRISE 50 bps hike "
        "in the repo rate — consensus had expected only 25 bps. Within 30 minutes, the 10-year "
        "G-Sec yield is up 25 bps, the 2-year is up 40 bps, the curve is flattening sharply, and "
        "INR is up 0.5% against the USD. As lead analyst on a ₹500 cr equity fund, you have "
        "until 3:30 PM (market close) to make three macro-to-market calls. Apply the macro "
        "framework. Trace the transmission. Move with timing."
    ),
    "instructions": (
        "Read each brief, then click the call you would make. After each choice you'll see "
        "the CIO's feedback and impact on three dimensions: Macro Framework, Transmission Logic, "
        "and Timing Quality. After all three calls, the CIO judges the day's positioning."
    ),
    "objectives": [
        "Read what a flattening yield curve says about market expectations on inflation and growth",
        "Trace rate-hike transmission from policy → curve → sector earnings to identify rotations",
        "Connect rising real yields to equity duration risk and trim long-duration assets accordingly",
    ],
    "config": {
        "scenario_context": (
            "Today's macro shock — Friday 2:30 PM:\n\n"
            "• RBI MPC: Repo rate +50 bps (consensus expected +25 bps)\n"
            "• 10Y G-Sec: 7.10% → 7.35% (+25 bps)\n"
            "• 2Y G-Sec: 6.95% → 7.35% (+40 bps)\n"
            "• Term Spread (10Y − 2Y): was +15 bps, now FLAT (0 bps)\n"
            "• INR: ₹83.40 → ₹83.00 (+0.5% vs USD)\n"
            "• Nifty: −1.4% in 20 minutes\n\n"
            "You have one hour and ₹500 cr of fund AUM to position. Three calls await."
        ),
        "initial_data": {
            "Repo Rate Move": "+50 bps (surprise)",
            "10Y Yield Move": "+25 bps to 7.35%",
            "2Y Yield Move": "+40 bps to 7.35%",
            "Term Spread Now": "0 bps (FLAT)",
            "INR Move": "+0.5% vs USD",
            "Time to Close": "60 minutes",
        },
        "scoring": {
            "max_total": 10,
            "outcome_mapping": [
                {
                    "min_total": -10,
                    "label": "Macro Call Misfired",
                    "narrative": (
                        "The CIO is concerned. Your macro reads were inconsistent with the "
                        "transmission mechanism — you misread the curve, mis-positioned the sectors, "
                        "or held duration risk into a real-yield surge. Performance attribution "
                        "tomorrow will not be flattering. The fund will need to unwind today's "
                        "positions at a loss next week."
                    ),
                },
                {
                    "min_total": 0,
                    "label": "Mixed Macro Day",
                    "narrative": (
                        "One call landed; another did not. You either correctly read the curve and "
                        "rotated sectors, or sized duration well, but not all three. The fund will "
                        "outperform the benchmark slightly, but the desk head wants you to walk "
                        "through the weak call in Monday's morning meeting."
                    ),
                },
                {
                    "min_total": 4,
                    "label": "Solid Macro Trading Day",
                    "narrative": (
                        "Sound execution. Curve read aligned with the framework, sector rotation hit "
                        "the right beneficiaries, and you trimmed duration before the week-end real-"
                        "yield rerating. Fund outperforms the benchmark today — the kind of day macro "
                        "fund managers are paid for."
                    ),
                },
                {
                    "min_total": 8,
                    "label": "Top-Decile Macro Trade",
                    "narrative": (
                        "An exemplary macro day. You correctly diagnosed the flattening curve as a "
                        "growth-versus-inflation signal, rotated into rate-cycle beneficiaries (private "
                        "banks for NIM expansion, IT exporters for the INR/duration balance), and "
                        "trimmed long-duration growth before Monday's gap-down. The CIO circulates the "
                        "trade book as a model macro-to-market response. This is the pattern that "
                        "defines a top macro strategist."
                    ),
                },
            ],
        },
        "decision_points": [
            # ───────── D1 — Yield-curve interpretation ─────────
            {
                "id": "d1",
                "title": "Decision 1 of 3 · Yield-Curve Read",
                "narrative": (
                    "The 10Y rose 25 bps, the 2Y rose 40 bps, and the term spread (10Y − 2Y) "
                    "compressed from +15 bps to a flat 0. What does this curve flattening tell you "
                    "about market expectations?"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Curve flattening = inflation crushed AND growth slowing ahead",
                        "description": "Markets expect higher short rates to bring down inflation AND slow growth — classic recession-warning flattener.",
                        "score_impact": {"macro_framework": 2, "transmission_logic": 2},
                        "consequence": (
                            "Textbook read. A bear flattener (short rates up faster than long rates) "
                            "is the market saying 'the central bank will be tight enough to tame "
                            "inflation, but it will also slow the economy in the next 12–18 months'. "
                            "Globally, a sustained curve flattening below zero has preceded every US "
                            "recession since 1969. India has rarely inverted but flattening below 30 "
                            "bps has historically preceded growth slowdowns."
                        ),
                        "next_decision": "d2",
                    },
                    {
                        "id": "B",
                        "label": "Curve steepening — markets pricing higher long-term inflation",
                        "description": "Long rates rose; that means higher inflation expectations in the long term.",
                        "score_impact": {"macro_framework": -2, "transmission_logic": -1},
                        "consequence": (
                            "Wrong direction. The curve FLATTENED — short rates rose MORE than long "
                            "rates (40 bps vs 25 bps), meaning the spread compressed. A steepening "
                            "would have been long rates rising MORE than short rates. You have "
                            "inverted the sign of the curve move. Re-read the spread arithmetic before "
                            "the next call."
                        ),
                        "next_decision": "d2",
                    },
                    {
                        "id": "C",
                        "label": "Parallel shift — no information content",
                        "description": "The whole curve moved up; not a signal about the curve shape, just a level shift.",
                        "score_impact": {"macro_framework": -1, "transmission_logic": -2},
                        "consequence": (
                            "Empirically wrong. A parallel shift would have meant 10Y and 2Y rising "
                            "by THE SAME amount; here they rose by different amounts (25 vs 40 bps), "
                            "compressing the spread by 15 bps. The differential move IS the signal. "
                            "Treating it as a parallel shift discards the most useful information in "
                            "the day's price action."
                        ),
                        "next_decision": "d2",
                    },
                ],
            },

            # ───────── D2 — Sector rotation ─────────
            {
                "id": "d2",
                "title": "Decision 2 of 3 · Sector Rotation",
                "narrative": (
                    "Given the surprise 50 bps hike, where do you rotate the next 30 days? Higher "
                    "rates and a stronger INR have predictable, mechanical effects on different "
                    "sector earnings. Pick the one to overweight first."
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Overweight Private Banks — NIM expansion",
                        "description": "Loan rates reprice within 1–2 quarters; deposit rates lag. Net Interest Margin expands. Textbook rate-cycle beneficiary.",
                        "score_impact": {"transmission_logic": 2, "macro_framework": 1, "timing_quality": 1},
                        "consequence": (
                            "Excellent transmission read. Private banks (HDFC, ICICI, Axis, Kotak) "
                            "have asset books that reprice to market quickly while deposits — especially "
                            "CASA — reprice slowly. The result is short-term NIM expansion, which "
                            "amplifies PAT growth. Combined with INR strength making FX-volatile asset "
                            "quality stable, this is the textbook macro-to-bank-stock transmission."
                        ),
                        "next_decision": "d3",
                    },
                    {
                        "id": "B",
                        "label": "Overweight High-Growth Tech — buy the sell-off",
                        "description": "Long-duration tech is down 4–5% intraday; this is a buying opportunity.",
                        "score_impact": {"transmission_logic": -2, "timing_quality": -2},
                        "consequence": (
                            "Mechanically backwards. High-growth tech is the MOST rate-sensitive part "
                            "of the equity market because most of its value sits in distant cash flows. "
                            "When real yields rise sharply, those cash flows get discounted more "
                            "aggressively. The sell-off you see today is the FIRST move down, not the "
                            "last — historically, growth multiples compress for 2–3 quarters after a "
                            "sharp rate move. Adding here typically loses 10–15% before bottoming."
                        ),
                        "next_decision": "d3",
                    },
                    {
                        "id": "C",
                        "label": "Wait — do nothing for 30 days",
                        "description": "It's just one MPC meeting. Wait for confirmation in the next set of data.",
                        "score_impact": {"timing_quality": -2, "macro_framework": -1},
                        "consequence": (
                            "Excessive caution against a clear signal. A 50 bps surprise hike — "
                            "100% larger than consensus — IS the confirmation. The yield curve has "
                            "already moved 25–40 bps reflecting that confirmation. By the time you "
                            "wait 30 days, the rotation will already be priced in and you will be "
                            "buying at the post-move levels. Macro positioning rewards moving on the "
                            "first clear signal."
                        ),
                        "next_decision": "d3",
                    },
                ],
            },

            # ───────── D3 — Equity duration ─────────
            {
                "id": "d3",
                "title": "Decision 3 of 3 · Equity Duration",
                "narrative": (
                    "Real yields have just stepped up sharply (nominal +25 bps with inflation "
                    "expectations little-changed). Equity duration matters: long-duration assets "
                    "(value mostly in distant cash flows) get hit hardest by rising real yields. "
                    "Which part of your book do you trim?"
                ),
                "options": [
                    {
                        "id": "A",
                        "label": "Trim long-duration high-growth (tech, consumer discretionary, new-age IPOs)",
                        "description": "These have the highest equity duration (25–35 years). A 25 bps real-yield rise hits them hardest. Take some risk off.",
                        "score_impact": {"transmission_logic": 2, "timing_quality": 2, "macro_framework": 1},
                        "consequence": (
                            "Best-in-class read. Equity duration = the weighted-average time at which "
                            "the stock's discounted cash flows are received. For new-age tech / loss-"
                            "making growth, that is 25–35 years. Using the rule of thumb 'Δ Fair Value "
                            "≈ −Equity Duration × Δ Real Yield', a 25 bps real-yield rise can shave "
                            "6–9% off these names. Trimming now BEFORE Monday's gap-down is the kind "
                            "of pre-emptive risk reduction macro fund managers earn their carry on."
                        ),
                        "is_terminal": True,
                    },
                    {
                        "id": "B",
                        "label": "Trim short-duration value / banks (already cheap)",
                        "description": "Cheap stocks are cheap for a reason; rotate out of them into something with growth.",
                        "score_impact": {"transmission_logic": -2, "macro_framework": -1, "timing_quality": -1},
                        "consequence": (
                            "Inconsistent with the entire macro setup. Short-duration value (banks, "
                            "utilities, mature dividend payers) has the LEAST sensitivity to real "
                            "yield moves AND, in the case of banks, actively benefits from the rate "
                            "cycle through NIM expansion. Trimming them at the moment they are "
                            "fundamentally tailwinded would unwind the very rotation you set up in "
                            "the previous decision."
                        ),
                        "is_terminal": True,
                    },
                    {
                        "id": "C",
                        "label": "No change — equity duration is a textbook concept, not a real driver",
                        "description": "Real yields rise and fall all the time; equity duration shouldn't drive trading decisions.",
                        "score_impact": {"macro_framework": -2, "transmission_logic": -2},
                        "consequence": (
                            "Empirically wrong. The 2022 global tech sell-off (US 10Y real yields "
                            "rising from −1% to +2% over 18 months) was the textbook real-world "
                            "demonstration of equity duration in action: long-duration growth fell "
                            "30–50% while short-duration value fell only 5–15%. Equity duration is "
                            "exactly what drives the cross-section of equity returns when real yields "
                            "move sharply. Ignoring it is a CIO-level red flag."
                        ),
                        "is_terminal": True,
                    },
                ],
            },
        ],
    },
}

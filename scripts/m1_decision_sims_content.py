"""
Decision-making simulations for Module 1:
  S1  Time Value of Money            (session 10ead237-b2fe-4535-8a21-8eec2536cd72)
  S2  Risk & Return Fundamentals      (session 081d48c1-4ce7-4fec-b8df-de49a8cdc0ab)
  S11 Cost of Capital & WACC          (session 5acb0bdf-1c64-4116-9bce-e07a9d3e93dc) [resolved at runtime]
  S12 Interest Rates / Yield Curve    (session d9245331-2437-4f18-9bb2-df30914b2117)
  S13 Statistics & Data Thinking      (session resolved at runtime)
"""

# -------------------- S1 TVM --------------------
S1_SIM = {
    "session_id": "10ead237-b2fe-4535-8a21-8eec2536cd72",
    "sim_type": "decision_making",
    "title": "TVM Workshop — Growing ₹10 Lakh for a 5-Year Home Down-Payment",
    "scenario": (
        "You are 27. An aunt has gifted you ₹10 lakh and you plan to buy a flat in 5 years; "
        "your minimum down-payment target is ₹15 lakh. Three Time Value of Money decisions stand "
        "between you and that target — which vehicle, which compounding frequency, and which "
        "investment timing. Apply FV / PV math at every step."
    ),
    "instructions": (
        "Read each brief, then click the choice you would back. After each choice you'll see why "
        "it works (or doesn't) and the impact on Numerical Reasoning, Goal Alignment, and "
        "Compounding Intuition. After all three calls, your financial planner gives a verdict."
    ),
    "objectives": [
        "Apply FV = PV × (1 + r)^n to compare vehicles against a hard goal",
        "Recognize how compounding frequency raises the effective annual rate (EAR)",
        "Quantify the front-loading advantage — earlier rupees compound longer",
    ],
    "config": {
        "scenario_context": (
            "Starting point — corpus today: ₹10 lakh\n"
            "Goal — corpus needed in 5 years: ≥ ₹15 lakh\n"
            "Required compounding rate: (15/10)^(1/5) − 1 ≈ 8.5% per year\n\n"
            "Three sequential calls follow. The math will tell you whether you reach the goal."
        ),
        "initial_data": {
            "Today's Corpus": "₹10 lakh",
            "Target in 5 yrs": "₹15 lakh",
            "Required CAGR": "≥ 8.5% / year",
            "Time Horizon": "5 years",
        },
        "scoring": {
            "max_total": 12,
            "outcome_mapping": [
                {"min_total": -10, "label": "Goal Not Reached", "narrative": "Two or more TVM mis-reads pulled the corpus below ₹15 lakh in 5 years. The flat purchase will need to be delayed or down-sized."},
                {"min_total": 0, "label": "Marginal Outcome", "narrative": "One sound call, one weak. The corpus lands close to the target but with little buffer for market wobble. Workable, not robust."},
                {"min_total": 5, "label": "Solid TVM Plan", "narrative": "Sound decisions across all three steps. The corpus comfortably exceeds ₹15 lakh, leaving headroom for stamp duty and registration. This is the planning standard expected of a financial-savvy investor."},
                {"min_total": 9, "label": "Textbook Compounding Outcome", "narrative": "Optimal vehicle, highest EAR via monthly compounding, and full front-loading. The corpus grows to ~₹17.6 lakh — almost 18% above target. Your planner uses your file as a teaching example."},
            ],
        },
        "decision_points": [
            {
                "id": "d1", "title": "Decision 1 of 3 · Investment Vehicle",
                "narrative": (
                    "First call. Three vehicles are on the table, each with its 5-year FV at the stated "
                    "rate. Which one gets you to ₹15 lakh — without taking risk you cannot bear?"
                ),
                "options": [
                    {"id": "A", "label": "5-yr Bank FD @ 7%", "description": "FV = 10 × 1.07^5 = ₹14.0 lakh. Capital-protected but falls ₹1 lakh short of the ₹15 lakh target.", "score_impact": {"numerical_reasoning": 1, "goal_alignment": -2, "compounding_intuition": 0}, "consequence": "Math is correct, but the destination is wrong. ₹14 lakh is ~7% below your minimum goal — you would need to bring an additional ₹1 lakh from elsewhere or delay the flat. Capital protection sounds prudent until you realise the goal itself is not achieved.", "next_decision": "d2"},
                    {"id": "B", "label": "5-yr Tax-Free Bond @ 8%", "description": "FV = 10 × 1.08^5 = ₹14.7 lakh. Better than FD but still narrowly misses ₹15 lakh.", "score_impact": {"numerical_reasoning": 1, "goal_alignment": -1, "compounding_intuition": 0}, "consequence": "Closer to the target — only ₹30,000 short. But 'close' does not buy a flat. With a 5-year horizon and a definable goal, accepting a vehicle that fails the goal by design is a planning miss, even if the after-tax math is attractive.", "next_decision": "d2"},
                    {"id": "C", "label": "Diversified Equity Mutual Fund @ 12% expected", "description": "FV = 10 × 1.12^5 = ₹17.6 lakh. Crosses the goal with ~17% buffer; volatility is real but acceptable over 5 years.", "score_impact": {"numerical_reasoning": 2, "goal_alignment": 2, "compounding_intuition": 1}, "consequence": "Right call. Over a 5-year horizon, equity has historically delivered 11–14% CAGR with manageable drawdown when the corpus is held through the cycle. ₹17.6 lakh gives a 17% buffer above the goal — important because equity returns are not deterministic.", "next_decision": "d2"},
                ],
            },
            {
                "id": "d2", "title": "Decision 2 of 3 · Compounding Frequency",
                "narrative": (
                    "Whatever vehicle you picked, you can choose how often returns compound. With the same "
                    "12% nominal rate, three options. Which one delivers the highest Effective Annual Rate "
                    "(EAR)? Recall EAR = (1 + r/n)^n − 1."
                ),
                "options": [
                    {"id": "A", "label": "Annual compounding — 12.00% EAR", "description": "Simple, but leaves 'compounding-on-compounding' value on the table.", "score_impact": {"numerical_reasoning": 0, "compounding_intuition": -2}, "consequence": "Lowest EAR of the three. Over 5 years on ₹10 lakh, annual compounding delivers ~₹17.62 lakh. Acceptable — but you forfeit the small frequency premium that costs you nothing.", "next_decision": "d3"},
                    {"id": "B", "label": "Quarterly compounding — 12.55% EAR", "description": "(1 + 0.12/4)^4 − 1 = 12.55%. A meaningful step-up from annual.", "score_impact": {"numerical_reasoning": 1, "compounding_intuition": 1}, "consequence": "Better. EAR is 55 bps higher than annual. Over 5 years on ₹10 lakh, this delivers ~₹18.06 lakh — about ₹44,000 more than annual compounding for zero extra risk.", "next_decision": "d3"},
                    {"id": "C", "label": "Monthly compounding — 12.68% EAR", "description": "(1 + 0.12/12)^12 − 1 = 12.68%. The highest practical EAR for a 12% nominal.", "score_impact": {"numerical_reasoning": 2, "compounding_intuition": 2}, "consequence": "Optimal frequency for a stated 12% nominal rate. On ₹10 lakh over 5 years monthly compounding delivers ~₹18.17 lakh — ~₹55,000 more than annual compounding. Continuous compounding would add another 12 bps but is rarely available in practice.", "next_decision": "d3"},
                ],
            },
            {
                "id": "d3", "title": "Decision 3 of 3 · Investment Timing",
                "narrative": (
                    "Last call. You can deploy the ₹10 lakh in three different ways. Which one maximises "
                    "the FV at the end of year 5? Remember: every rupee invested earlier compounds longer."
                ),
                "options": [
                    {"id": "A", "label": "₹2 lakh per year, start of each year (5 annual lump-sums)", "description": "Annuity-due of ₹2 lakh × 5 years at 12%. FV ≈ ₹14.23 lakh.", "score_impact": {"numerical_reasoning": 0, "compounding_intuition": 0}, "consequence": "Steady — but you give up compounding on rupees that sit in the bank account waiting to be invested. The first ₹2 lakh compounds for 5 years; the last only for 1.", "is_terminal": True},
                    {"id": "B", "label": "₹16,667 per month SIP (₹2 lakh / year) for 5 years", "description": "Monthly SIP at 1% effective monthly. FV ≈ ₹13.61 lakh.", "score_impact": {"numerical_reasoning": -1, "compounding_intuition": -1}, "consequence": "Slightly worse than option A on pure FV math because rupees come in even more slowly across 60 months. SIPs help with rupee-cost-averaging in volatile markets — useful when the ₹10 lakh is not yet in your account, but here you ALREADY have the full corpus today.", "is_terminal": True},
                    {"id": "C", "label": "Full ₹10 lakh upfront in year 0 (front-load)", "description": "Single lump-sum at start. FV = 10 × 1.12^5 ≈ ₹17.62 lakh.", "score_impact": {"numerical_reasoning": 2, "compounding_intuition": 2, "goal_alignment": 1}, "consequence": "Optimal. Every rupee gets the full 5 years of compounding — the maximum possible. The math is unambiguous: when you ALREADY have the cash, deploying it immediately beats any phased plan on pure expected FV.", "is_terminal": True},
                ],
            },
        ],
    },
}

# -------------------- S2 RISK & RETURN --------------------
S2_SIM = {
    "session_id": "081d48c1-4ce7-4fec-b8df-de49a8cdc0ab",
    "sim_type": "decision_making",
    "title": "Risk & Return Workshop — Picking Among Three Stock Scenarios",
    "scenario": (
        "You are an analyst sizing a new ₹100 cr position. Three stocks have been pre-screened — "
        "Stock A, Stock B and Stock C — each with a bull/base/bear scenario set produced by the "
        "research team. Apply the three formulas you just learned: Expected Return E(R), Standard "
        "Deviation σ, and the return-to-risk ratio E(R)/σ. Three calls, one final stock pick."
    ),
    "instructions": (
        "Each decision tests a different formula. Click the option that the math supports. After each "
        "choice you'll see the working and the impact on Numerical Accuracy, Risk Awareness, and "
        "Position-Sizing Logic."
    ),
    "objectives": [
        "Compute probability-weighted Expected Return E(R) across scenarios",
        "Compute Standard Deviation σ from scenario probabilities and deviations",
        "Translate E(R) and σ into a return-to-risk-aware position-sizing decision",
    ],
    "config": {
        "scenario_context": (
            "Three stocks, three scenarios each:\n\n"
            "Stock A — Bull (40%, +30%) | Base (40%, +12%) | Bear (20%, −10%)\n"
            "Stock B — Bull (30%, +25%) | Base (50%, +10%) | Bear (20%, +2%)\n"
            "Stock C — Bull (50%, +35%) | Base (30%, −5%) | Bear (20%, −25%)\n\n"
            "Compute and choose."
        ),
        "initial_data": {
            "Stock A": "Bull 40%/+30, Base 40%/+12, Bear 20%/−10",
            "Stock B": "Bull 30%/+25, Base 50%/+10, Bear 20%/+2",
            "Stock C": "Bull 50%/+35, Base 30%/−5, Bear 20%/−25",
            "Capital": "₹100 cr",
        },
        "scoring": {
            "max_total": 10,
            "outcome_mapping": [
                {"min_total": -10, "label": "Position Stuck", "narrative": "The math was misread on multiple decisions. The position taken does not match the scenario data, and the desk head has reversed the trade."},
                {"min_total": 0, "label": "Borderline Pick", "narrative": "One sound call, one weak. The position will work if scenarios play out as expected, but you will need to defend the sizing in Monday's morning meeting."},
                {"min_total": 4, "label": "Solid Stock Pick", "narrative": "Numbers cleanly computed, lowest-σ stock identified, and the highest E(R)/σ name correctly sized largest. Solid analytical work."},
                {"min_total": 8, "label": "Best-in-Class Sizing", "narrative": "Textbook execution. You identified the highest E(R), the lowest σ, and recognised that the best return-per-unit-of-risk name is Stock B — sizing it as the largest position. This is exactly how risk-adjusted thinking should drive sizing."},
            ],
        },
        "decision_points": [
            {
                "id": "d1", "title": "Decision 1 of 3 · Highest Expected Return",
                "narrative": "Compute E(R) for each: which stock has the HIGHEST expected return?",
                "options": [
                    {"id": "A", "label": "Stock A — E(R) = 14.8%", "description": "0.4×30 + 0.4×12 + 0.2×(−10) = 12 + 4.8 − 2 = 14.8%.", "score_impact": {"numerical_accuracy": 2, "risk_awareness": 1}, "consequence": "Correct. Stock A's E(R) of 14.8% is the highest of the three — driven mainly by a 40% probability of a +30% bull case. This is the textbook E(R) calculation.", "next_decision": "d2"},
                    {"id": "B", "label": "Stock B — E(R) = 12.9%", "description": "0.3×25 + 0.5×10 + 0.2×2 = 7.5 + 5 + 0.4 = 12.9%.", "score_impact": {"numerical_accuracy": 1, "risk_awareness": 0}, "consequence": "Math is right but the comparison is wrong. Stock B's 12.9% E(R) is real, but Stock A's 14.8% is higher. You correctly computed E(R) but missed the comparison.", "next_decision": "d2"},
                    {"id": "C", "label": "Stock C — E(R) = 11.0%", "description": "0.5×35 + 0.3×(−5) + 0.2×(−25) = 17.5 − 1.5 − 5 = 11.0%.", "score_impact": {"numerical_accuracy": 1, "risk_awareness": -1}, "consequence": "Math correct. But Stock C has the LOWEST E(R) of the three — its big bull-case is more than offset by the large bear-case loss. You got the arithmetic right but missed the cross-comparison.", "next_decision": "d2"},
                ],
            },
            {
                "id": "d2", "title": "Decision 2 of 3 · Lowest Standard Deviation",
                "narrative": "σ measures dispersion of outcomes around E(R). Which stock has the LOWEST σ?",
                "options": [
                    {"id": "A", "label": "Stock A — σ ≈ 14.8%", "description": "Variance 218.6 → σ = √218.6 ≈ 14.8%. Outcomes spread from −10% to +30%.", "score_impact": {"numerical_accuracy": 1, "risk_awareness": 0}, "consequence": "Correct math, wrong comparison. Stock A's σ of 14.8% is moderate but Stock B is lower. You computed correctly but didn't pick the LOWEST.", "next_decision": "d3"},
                    {"id": "B", "label": "Stock B — σ ≈ 8.5%", "description": "Variance 71.9 → σ = √71.9 ≈ 8.5%. Even the bear case is +2% — narrow distribution.", "score_impact": {"numerical_accuracy": 2, "risk_awareness": 2}, "consequence": "Correct. Stock B's σ of 8.5% is the lowest because no scenario goes negative — even the bear case is mildly positive. This narrow distribution is what 'low risk' actually looks like quantitatively.", "next_decision": "d3"},
                    {"id": "C", "label": "Stock C — σ ≈ 25.0%", "description": "Variance 624 → σ = √624 ≈ 25.0%. Outcomes from −25% to +35% — very wide.", "score_impact": {"numerical_accuracy": 1, "risk_awareness": -1}, "consequence": "Math right, comparison wrong. Stock C has the HIGHEST σ — almost 3× Stock B. You correctly computed but mis-ranked.", "next_decision": "d3"},
                ],
            },
            {
                "id": "d3", "title": "Decision 3 of 3 · Sizing the Position",
                "narrative": (
                    "Now combine E(R) and σ. Which stock would you size the LARGEST in a risk-aware "
                    "portfolio? Rule: highest return PER unit of risk wins."
                ),
                "options": [
                    {"id": "A", "label": "Stock A — biggest because E(R) is highest", "description": "E(R)/σ = 14.8/14.8 = 1.00.", "score_impact": {"numerical_accuracy": 0, "position_sizing_logic": -1}, "consequence": "Tempting but wrong. Yes, A has the highest absolute E(R) — but its σ is also high. Per-unit-of-risk return is 1.00, which is mediocre. Sizing on raw E(R) alone is the classic novice mistake.", "is_terminal": True},
                    {"id": "B", "label": "Stock B — biggest because E(R)/σ is highest", "description": "E(R)/σ = 12.9 / 8.5 = 1.52 — best risk-adjusted return.", "score_impact": {"numerical_accuracy": 2, "risk_awareness": 1, "position_sizing_logic": 2}, "consequence": "Optimal. Stock B's 12.9% E(R) on just 8.5% σ delivers 1.52 units of return per unit of risk — clearly the best of the three. In a risk-aware portfolio, you size positions on E(R)/σ (the textbook return-to-risk ratio), not on raw E(R).", "is_terminal": True},
                    {"id": "C", "label": "Stock C — biggest because the bull case is huge", "description": "E(R)/σ = 11/25 = 0.44 — worst risk-adjusted return.", "score_impact": {"numerical_accuracy": -1, "position_sizing_logic": -2}, "consequence": "Worst choice. Stock C has the LOWEST E(R) AND the HIGHEST σ — you're paying maximum volatility for minimum expected return. Sizing on a single bull-case scenario ignores the heavier-weighted bear-case losses.", "is_terminal": True},
                ],
            },
        ],
    },
}

# -------------------- S11 COST OF CAPITAL & WACC --------------------
S11_SIM = {
    "session_id": "__resolve_at_runtime_S11__",
    "sim_type": "decision_making",
    "title": "WACC Workshop — Setting the Discount Rate for an Acquisition",
    "scenario": (
        "You are a corp-dev analyst at a Mumbai brokerage's M&A desk. Your client wants to acquire "
        "TaraTech Ltd — an Indian mid-cap IT services company. Before you build the DCF, you must "
        "set the discount rate. Three WACC inputs lie ahead: cost of equity (CAPM), cost of debt "
        "(after-tax), and the equity-to-debt weights. Get the math right and the DCF will be honest."
    ),
    "instructions": (
        "Each call tests a single WACC building block. Click the choice an experienced analyst "
        "would make. Feedback shows the math and the impact on three dimensions: Methodological "
        "Rigor, Conservatism (avoiding under-stating risk), and Practical Discipline."
    ),
    "objectives": [
        "Apply CAPM correctly to compute cost of equity using a defensible beta",
        "Compute the after-tax cost of debt and recognise why it is lower than coupon rate",
        "Use market-value weights — not book values — for the WACC blend",
    ],
    "config": {
        "scenario_context": (
            "TaraTech Ltd snapshot:\n\n"
            "• Risk-free rate (10Y G-Sec): 7.0%\n"
            "• Equity risk premium (India): 6.5%\n"
            "• Company 5-yr beta: 1.2 | 1-yr beta: 1.5 | Sector beta: 1.1\n"
            "• Outstanding bond coupon: 8.5% | Indian corp tax rate: 25%\n"
            "• Book debt: ₹600 cr | Book equity: ₹1,400 cr (D/E book = 30:70)\n"
            "• Market debt: ₹620 cr | Market cap: ₹2,480 cr (D/E market = 20:80)\n"
        ),
        "initial_data": {
            "Risk-free Rate": "7.0%",
            "ERP (India)": "6.5%",
            "5-yr Beta": "1.2",
            "Bond Coupon": "8.5%",
            "Tax Rate": "25%",
            "Book D/E": "30/70",
            "Market D/E": "20/80",
        },
        "scoring": {
            "max_total": 10,
            "outcome_mapping": [
                {"min_total": -10, "label": "WACC Misspecified", "narrative": "Multiple inputs were chosen incorrectly. The DCF built on this WACC will under- or over-state TaraTech's value materially. Senior asks you to redo the discount rate from scratch."},
                {"min_total": 0, "label": "WACC Workable", "narrative": "One sound input, one weak. The discount rate is in the right ballpark but methodologically defensible only with caveats. Acceptable as a draft, not as the final."},
                {"min_total": 4, "label": "Defensible WACC", "narrative": "All three building blocks chosen on principled grounds. The resulting WACC will hold up in the IC presentation and in the auditor's review."},
                {"min_total": 8, "label": "Textbook WACC Build", "narrative": "Beta drawn from sector for stability, after-tax cost of debt correctly applied, market-value weights used. WACC ≈ 0.20 × 6.4% + 0.80 × 14.15% = 12.6%. Best-in-class methodology."},
            ],
        },
        "decision_points": [
            {
                "id": "d1", "title": "Decision 1 of 3 · Beta for Cost of Equity",
                "narrative": "CAPM: Re = Rf + β × ERP. Pick the beta. The choice changes Re materially.",
                "options": [
                    {"id": "A", "label": "Use 5-year stock beta (1.2)", "description": "Re = 7 + 1.2 × 6.5 = 14.8%. Reflects company-specific behaviour over a normal cycle.", "score_impact": {"methodological_rigor": 1, "practical_discipline": 1}, "consequence": "Reasonable. 5-year beta uses enough history to smooth out one-off events while staying current to the current business model. Slightly more volatile than a sector beta, but defensible.", "next_decision": "d2"},
                    {"id": "B", "label": "Use 1-year stock beta (1.5)", "description": "Re = 7 + 1.5 × 6.5 = 16.75%. Captures the most recent volatility but is unstable.", "score_impact": {"methodological_rigor": -2, "conservatism": 0}, "consequence": "Too short a window. 1-year beta swings sharply with single events (a panicked quarter, a sector rotation) and gives a wildly different Re depending on the day you compute it. Senior analysts would flag this as cherry-picking.", "next_decision": "d2"},
                    {"id": "C", "label": "Use sector beta (1.1)", "description": "Re = 7 + 1.1 × 6.5 = 14.15%. Pure-play Indian IT-services peers, smoothed.", "score_impact": {"methodological_rigor": 2, "practical_discipline": 1}, "consequence": "Best practice for a mid-cap with limited history of its own beta stability. Sector betas are computed from large peer baskets and are far more stable than single-stock betas. The IC will accept this without debate.", "next_decision": "d2"},
                ],
            },
            {
                "id": "d2", "title": "Decision 2 of 3 · Cost of Debt",
                "narrative": "Pick the cost of debt for the WACC. Remember: WACC uses AFTER-TAX cost of debt.",
                "options": [
                    {"id": "A", "label": "Use bond coupon rate (8.5%)", "description": "Pre-tax. Ignores the tax shield on interest payments — overstates Rd.", "score_impact": {"methodological_rigor": -2}, "consequence": "Common rookie mistake. Interest is tax-deductible — the EFFECTIVE cost to the company is the coupon multiplied by (1 − tax rate). Using the pre-tax coupon over-states WACC and would systematically under-value the target.", "next_decision": "d3"},
                    {"id": "B", "label": "Use after-tax cost of debt: 8.5% × (1 − 0.25) = 6.4%", "description": "Standard WACC convention. Reflects the true economic cost of debt to the firm.", "score_impact": {"methodological_rigor": 2, "practical_discipline": 2}, "consequence": "Correct. The tax shield is real money — every ₹100 of interest reduces taxable profit by ₹100, saving ₹25 in tax. The economic cost is therefore ₹75. Using 6.4% (instead of 8.5%) tightens WACC and produces a more accurate enterprise value.", "next_decision": "d3"},
                    {"id": "C", "label": "Use risk-free rate (7%)", "description": "Treats debt as risk-free. Wrong — TaraTech debt has spread above G-Sec.", "score_impact": {"methodological_rigor": -1}, "consequence": "Wrong on multiple counts: (1) corporate debt always carries credit spread above G-Sec; (2) you're missing the tax shield. Using Rf as Rd would understate WACC and over-value TaraTech.", "next_decision": "d3"},
                ],
            },
            {
                "id": "d3", "title": "Decision 3 of 3 · Capital Structure Weights",
                "narrative": "WACC = (E/V) × Re + (D/V) × Rd_after-tax. Which set of weights do you use?",
                "options": [
                    {"id": "A", "label": "Book values (30/70)", "description": "Easier to compute from the balance sheet. But book values don't reflect what investors would pay or lend today.", "score_impact": {"methodological_rigor": -1, "practical_discipline": -1}, "consequence": "Convenient but methodologically wrong. Book equity reflects historical retained earnings; book debt reflects face value. Neither tells you the CURRENT cost of capital. Market values are what an acquirer or investor pays today.", "is_terminal": True},
                    {"id": "B", "label": "Market values (20/80)", "description": "Market cap = ₹2,480 cr; market debt ≈ ₹620 cr. D/V = 20%, E/V = 80%. The standard WACC convention.", "score_impact": {"methodological_rigor": 2, "practical_discipline": 2, "conservatism": 1}, "consequence": "Correct. WACC = 0.20 × 6.4% + 0.80 × 14.15% = 1.28% + 11.32% ≈ 12.6%. Using market weights produces the discount rate an acquirer would actually face today. This is the IC-ready number.", "is_terminal": True},
                    {"id": "C", "label": "Target capital structure (50/50)", "description": "What management wants to be at, not what they are at.", "score_impact": {"methodological_rigor": 0, "conservatism": -1}, "consequence": "Defensible only if there is a binding plan to move to 50/50 within 12 months. Without that, using a hypothetical structure builds pre-deal optimism into the discount rate — the kind of WACC manipulation IC committees specifically watch for.", "is_terminal": True},
                ],
            },
        ],
    },
}

# -------------------- S12 INTEREST RATES & YIELD CURVE --------------------
S12_SIM = {
    "session_id": "d9245331-2437-4f18-9bb2-df30914b2117",
    "sim_type": "decision_making",
    "title": "Yield Curve Reading Workshop — Three Curve Shapes, Three Signals",
    "scenario": (
        "You are a junior macro strategist. Three different yield curve shapes land on your desk, "
        "each on a different morning. For each one, name the signal correctly. The CIO uses these "
        "reads as the macro overlay for the firm's equity book."
    ),
    "instructions": (
        "Each decision is a different curve shape. Identify the textbook signal each shape carries. "
        "After each pick you'll see why — and the impact on Macro Framework, Signal Recognition, "
        "and Strategic Awareness."
    ),
    "objectives": [
        "Recognise an inverted curve as the strongest empirical recession indicator",
        "Recognise a steepening from flat as a growth-recovery / reflation signal",
        "Recognise a flat curve as a late-cycle warning, not a benign neutral state",
    ],
    "config": {
        "scenario_context": (
            "Three curve snapshots, three trading mornings. Identify what each shape is telling you.\n\n"
            "Curve 1 — INVERTED: 2Y at 7.50%, 10Y at 7.10% → spread −40 bps\n"
            "Curve 2 — STEEPENING from flat: 2Y at 6.00%, 10Y at 7.50% → spread +150 bps (was 0 bps a quarter ago)\n"
            "Curve 3 — FLAT: 2Y at 7.30%, 10Y at 7.30% → spread 0 bps\n"
        ),
        "initial_data": {
            "Curve 1": "2Y 7.50% | 10Y 7.10% | spread −40 bps",
            "Curve 2": "2Y 6.00% | 10Y 7.50% | spread +150 bps",
            "Curve 3": "2Y 7.30% | 10Y 7.30% | spread 0 bps",
        },
        "scoring": {
            "max_total": 10,
            "outcome_mapping": [
                {"min_total": -10, "label": "Misread the Curve", "narrative": "Two or more shapes were misread. The macro overlay flowing into the equity book will lean the wrong way. CIO sends you back to the textbook."},
                {"min_total": 0, "label": "Partial Read", "narrative": "One signal called correctly, others muddled. The strategy team flags your reads as 'directionally OK but unreliable'. Workable for now, not for strategy."},
                {"min_total": 4, "label": "Solid Curve Reads", "narrative": "All three shapes diagnosed with the textbook signal. The macro overlay is now usable as input for sector positioning."},
                {"min_total": 8, "label": "Best-in-Class Macro Read", "narrative": "Three different curves, three textbook reads — recession-warning inversion, reflation-trade steepener, late-cycle flat. The CIO uses your note as the morning briefing for the desk."},
            ],
        },
        "decision_points": [
            {
                "id": "d1", "title": "Curve 1 · Inverted (10Y < 2Y)",
                "narrative": "10Y at 7.10%, 2Y at 7.50%. Spread is NEGATIVE 40 bps. What does this most likely signal?",
                "options": [
                    {"id": "A", "label": "Recession ahead within 6–18 months", "description": "Empirically the strongest leading indicator of recession in the US, and a strong slowdown signal in India. Markets are saying short rates are restrictive enough to slow growth.", "score_impact": {"macro_framework": 2, "signal_recognition": 2}, "consequence": "Correct. Every US recession since 1969 was preceded by a curve inversion. India inverts rarely, but when it has (briefly in 2018), GDP slowdown followed within 4 quarters. Inversion implies markets expect short-term rates to FALL (rate cuts coming) because growth will weaken.", "next_decision": "d2"},
                    {"id": "B", "label": "Strong growth ahead", "description": "Long rates lower than short rates means lower long-term inflation expectations.", "score_impact": {"macro_framework": -2, "signal_recognition": -2}, "consequence": "Empirically the OPPOSITE of what an inverted curve has signalled in the past 50+ years. Inversions almost universally precede growth slowdown — not acceleration.", "next_decision": "d2"},
                    {"id": "C", "label": "No information — just demand technicals at the long end", "description": "Pension funds buying long bonds artificially pushes long yields down.", "score_impact": {"macro_framework": -1, "signal_recognition": -1}, "consequence": "Possible at the margin, but the persistent record of inversions preceding recessions across multiple decades and countries is too strong to dismiss as technical noise. This is the framing macro strategists use to look smart while ignoring the signal.", "next_decision": "d2"},
                ],
            },
            {
                "id": "d2", "title": "Curve 2 · Steepening from flat",
                "narrative": (
                    "A quarter ago: spread was 0 bps. Today: 2Y at 6.00%, 10Y at 7.50% → spread +150 bps. "
                    "Short rates fell faster than long rates. What signal?"
                ),
                "options": [
                    {"id": "A", "label": "Rate-cut cycle has begun + recovery / reflation expectations", "description": "Short rates moved on RBI cuts; long rates stayed up because markets expect future growth and inflation. Classic bull steepener.", "score_impact": {"macro_framework": 2, "signal_recognition": 2, "strategic_awareness": 1}, "consequence": "Correct. This is the textbook bull steepener — central bank cuts pull the front of the curve down, while the long end stays up because investors expect economic recovery and inflation to pick back up. Equity-positive: rate-sensitive sectors and cyclicals tend to rally in this regime.", "is_terminal": False, "next_decision": "d3"},
                    {"id": "B", "label": "Disinflation broadly, growth stalling", "description": "Lower rates everywhere mean inflation is coming down and growth slowing.", "score_impact": {"macro_framework": -1, "signal_recognition": -1}, "consequence": "Mis-reads the asymmetry. If everyone was disinflating AND growth was stalling, the LONG end would also fall — that would be a parallel shift down, not a steepener. The fact that the LONG end stayed up while the SHORT end fell tells you markets expect future inflation/growth to firm up.", "is_terminal": False, "next_decision": "d3"},
                    {"id": "C", "label": "No useful signal — one quarter is noise", "description": "150 bps in a quarter could just be flow.", "score_impact": {"macro_framework": -1, "signal_recognition": -1, "strategic_awareness": -1}, "consequence": "150 bps in a single quarter IS a signal — it is a 1-in-many-years event, far above the noise threshold of typical curve drift. Dismissing it as flow concedes the macro overlay entirely.", "is_terminal": False, "next_decision": "d3"},
                ],
            },
            {
                "id": "d3", "title": "Curve 3 · Flat (spread ≈ 0)",
                "narrative": (
                    "2Y and 10Y both at 7.30%. Term spread = 0 bps. The curve was steep (~120 bps) a year "
                    "ago and has been flattening for 3 quarters. What does flat signal?"
                ),
                "options": [
                    {"id": "A", "label": "Late-cycle warning — slowdown approaching", "description": "Flat curves precede inversions, and inversions precede recessions. Three quarters of flattening is a real trend.", "score_impact": {"macro_framework": 2, "signal_recognition": 2, "strategic_awareness": 1}, "consequence": "Correct. Flat is rarely benign. It is usually a way-station between a healthy steep curve and a recession-warning inversion. Three quarters of flattening tells you the trend is intact. Defensive sector positioning is appropriate.", "is_terminal": True},
                    {"id": "B", "label": "Neutral — economy in balance", "description": "Flat means market sees no big surprises — neither acceleration nor slowdown.", "score_impact": {"macro_framework": -1, "signal_recognition": -2}, "consequence": "Common but wrong framing. Flat is not equilibrium — the natural curve shape is upward-sloping (10Y > 2Y by ~50–150 bps) because of term premium. A flat curve means term premium has been compressed, typically because growth expectations have fallen.", "is_terminal": True},
                    {"id": "C", "label": "Growth ahead — markets pricing reflation", "description": "Flat means rates stable, supporting growth.", "score_impact": {"macro_framework": -2, "signal_recognition": -2}, "consequence": "Reflation would show up as a STEEPENING curve (long end rising), not a flat one. A flat curve historically aligns with late-cycle slowdown rather than early reflation.", "is_terminal": True},
                ],
            },
        ],
    },
}

# -------------------- S13 STATISTICS --------------------
S13_SIM = {
    "session_id": "__resolve_at_runtime_S13__",
    "sim_type": "decision_making",
    "title": "Stats Workshop — Three Quick-Fire Calls Every Analyst Faces",
    "scenario": (
        "You are an analyst in the third week of a quant project. The senior partner sends three "
        "stats questions in a row, with one minute each to respond. Each tests a concept that you "
        "will see weekly in equity research: choosing the right central tendency for skewed data, "
        "interpreting correlation correctly, and reading p-values without over-claiming."
    ),
    "instructions": "Three quick-fire decisions. Click the choice that is statistically correct. Feedback shows why.",
    "objectives": [
        "Choose median over mean when data is heavily skewed (returns with crashes, valuations with outliers)",
        "Interpret correlation as association — not causation",
        "Translate a p-value into the right confidence statement, neither over- nor under-claiming",
    ],
    "config": {
        "scenario_context": (
            "Three stats challenges, one minute each:\n\n"
            "Q1 — Stock A's monthly return distribution is HEAVILY left-skewed by occasional 30%+ "
            "drawdowns. Mean = +1.2% / month, Median = +1.6% / month. Which is the better central "
            "tendency measure?\n\n"
            "Q2 — Two Indian banks have a 12-month return correlation of +0.93. What does this most "
            "directly imply?\n\n"
            "Q3 — A backtest of your strategy delivers p-value 0.02 against the null hypothesis of "
            "zero alpha. How do you frame this for the CIO?"
        ),
        "initial_data": {
            "Q1": "Mean +1.2 % | Median +1.6 % (left-skewed)",
            "Q2": "Two banks · ρ = +0.93",
            "Q3": "Backtest p-value = 0.02 vs null=0",
        },
        "scoring": {
            "max_total": 10,
            "outcome_mapping": [
                {"min_total": -10, "label": "Stats Misfires", "narrative": "Two or more concepts confused. Senior partner asks you to refresh the basics before the next quant project."},
                {"min_total": 0, "label": "Partial Read", "narrative": "One concept solid, others muddled. Workable for now, but the partner wants you to walk through the weak one in tomorrow's catch-up."},
                {"min_total": 4, "label": "Solid Stats Calls", "narrative": "All three concepts read correctly. The partner is satisfied — these are the stats that come up on every research call."},
                {"min_total": 8, "label": "Best-in-Class Stats Reads", "narrative": "Median over mean for skewed data, correlation as association (not causation), p-value framed as 'low probability under the null' (not '98% confidence'). Textbook stats discipline."},
            ],
        },
        "decision_points": [
            {
                "id": "d1", "title": "Q1 · Mean or Median for skewed returns?",
                "narrative": "Stock A's monthly returns: mean +1.2%, median +1.6%. Heavy left-skew from occasional 30%+ drawdowns. Which is the better central tendency for typical-month return?",
                "options": [
                    {"id": "A", "label": "Mean — it uses all data points", "description": "The arithmetic mean is the most-informative single number.", "score_impact": {"statistical_rigor": -2, "interpretation_quality": -1}, "consequence": "Wrong choice for skewed data. Means are pulled by extreme tails. With heavy left skew (rare big drawdowns), the mean UNDER-states the typical month — exactly what you saw: mean (+1.2%) < median (+1.6%). Reporting the mean would mislead readers about the typical experience.", "next_decision": "d2"},
                    {"id": "B", "label": "Median — robust to outliers", "description": "Median = the middle observation. Half the months above, half below. Tail-event-resistant.", "score_impact": {"statistical_rigor": 2, "interpretation_quality": 2}, "consequence": "Correct. Median is the right measure of central tendency for skewed distributions. The +1.6% median is what a TYPICAL month looks like; the +1.2% mean is what HAPPENS ON AVERAGE — including the rare 30% crash months. For 'typical month' decisions, median wins.", "next_decision": "d2"},
                    {"id": "C", "label": "Mode — most frequent return", "description": "Most frequent return gives the typical experience.", "score_impact": {"statistical_rigor": -1, "interpretation_quality": -1}, "consequence": "Mode is rarely useful for continuous data like returns — every observation is essentially unique unless rounded. Mode works for categorical data, not for return distributions.", "next_decision": "d2"},
                ],
            },
            {
                "id": "d2", "title": "Q2 · Correlation +0.93 — what does it mean?",
                "narrative": "Two Indian banks. 12-month return correlation = +0.93. What does this most directly imply?",
                "options": [
                    {"id": "A", "label": "Strong association — they tend to move together", "description": "Correlation captures the LINEAR co-movement. High +ρ means when one is up, the other typically is too.", "score_impact": {"statistical_rigor": 2, "interpretation_quality": 2}, "consequence": "Correct framing. Correlation measures co-movement, NOT causation. Two banks have ρ = +0.93 because they share macro drivers (rate cycle, NIM environment, asset-quality cycle). Neither one causes the other.", "next_decision": "d3"},
                    {"id": "B", "label": "One bank causes the other to move", "description": "+0.93 is high enough to be causal.", "score_impact": {"statistical_rigor": -2, "interpretation_quality": -2}, "consequence": "Classic correlation-vs-causation error. Correlation NEVER proves causation. Two banks moving together does not mean one drives the other — they are both driven by SHARED external factors (macro, regulatory, sector). The correct statement is 'common factor exposure'.", "next_decision": "d3"},
                    {"id": "C", "label": "They are independent", "description": "+0.93 is just noise.", "score_impact": {"statistical_rigor": -2, "interpretation_quality": -1}, "consequence": "Empirically wrong. ρ = +0.93 is far above the threshold for 'independent' (which would be ρ ≈ 0). Independence would mean knowing one stock's return tells you NOTHING about the other — clearly not the case here.", "next_decision": "d3"},
                ],
            },
            {
                "id": "d3", "title": "Q3 · Backtest p-value 0.02 — how do you frame it?",
                "narrative": "Your backtest of a strategy gives p-value 0.02 against the null of zero alpha. The CIO asks you to explain the result. Pick the right framing.",
                "options": [
                    {"id": "A", "label": "'There's a 98% chance the strategy works'", "description": "1 − 0.02 = 0.98 confidence the strategy adds alpha.", "score_impact": {"statistical_rigor": -2, "interpretation_quality": -2}, "consequence": "Common but wrong framing. The p-value is NOT the probability that the strategy works. It is the probability of seeing this much alpha (or more) IF the true alpha was zero. Saying '98% chance the strategy works' misrepresents Bayesian probability vs frequentist p-value.", "is_terminal": True},
                    {"id": "B", "label": "'Under the null of zero alpha, results this strong would happen by chance only 2% of the time — statistically significant at the 5% level, with caveats'", "description": "Strict frequentist interpretation. Mentions caveats (data mining, sample period, transaction cost).", "score_impact": {"statistical_rigor": 2, "interpretation_quality": 2, "strategic_awareness": 1}, "consequence": "Correct framing. The p-value is conditional on the null being true; it is not the probability the null IS true. Including caveats about data-mining and sample-period stability is the analytical discipline that separates trustworthy quant work from over-claimed backtests.", "is_terminal": True},
                    {"id": "C", "label": "'Not significant at 1% — discard the strategy'", "description": "p > 0.01 means we shouldn't trust it.", "score_impact": {"statistical_rigor": -1, "interpretation_quality": -1}, "consequence": "Over-conservative without justification. The standard threshold in social science / finance is 5% (p < 0.05), not 1%. Discarding a strategy with p = 0.02 because it doesn't pass an arbitrary 1% bar throws out useful evidence.", "is_terminal": True},
                ],
            },
        ],
    },
}

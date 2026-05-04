"""
New document-type simulation for Module 1 / Session 6: Income Statement Formulas.

Schema (consumed by /app/frontend/src/components/simulations/DocumentSim.jsx):

config = {
  document_data: {
    company_name, period, currency, sections: [{ title, line_items: [...], section_total }]
  },
  interactive_highlights: [ { id, tooltip } ],   # links to line_item.id
  tasks: [ { id, question, answer_type, ... } ]
}
"""

S6_SIM = {
    "session_id": "c3a21f75-1dac-4656-9264-1cb37ed802c1",
    "sim_type": "document",
    "title": "Income Statement Forensics — Reading BharatBites' P&L Like an Analyst",
    "scenario": (
        "It is your second week as an equity research intern at a Mumbai brokerage. "
        "Your senior analyst slides a printed copy of BharatBites Ltd's FY24 Standalone "
        "Income Statement across the desk and says: 'Read it cold. Compute every margin, "
        "spot what is real and what is window-dressing, and tell me whether this business "
        "is improving or quietly hollowing out. You have 25 minutes.' "
        "BharatBites is a mid-cap Indian biscuits and snacks company that competes with "
        "Britannia and Parle. Your job: work through the document, answer the analyst's "
        "tasks, and decide whether you would call this company a Buy, a Hold, or a Sell — "
        "based purely on what the income statement reveals."
    ),
    "instructions": (
        "Click any underlined item in the printed statement to reveal an analyst tooltip. "
        "Work through the tasks on the right one-by-one — they range from quick numerical "
        "computations (e.g., compute Gross Margin %) to text identification "
        "(e.g., name the line that holds non-operating income) to free-text analysis "
        "(e.g., would you normalise earnings, and how?). Use the period-on-period "
        "comparison (FY24 vs FY23) on every line to detect what is improving versus "
        "deteriorating. There is no time pressure inside the simulator; take your time, "
        "but answer like an analyst — show your work, cite numbers, and finish by forming "
        "a clear view."
    ),
    "objectives": [
        "Compute all five income-statement margins (Gross, EBITDA, EBIT, Pre-Tax, Net) from a real-looking P&L",
        "Identify the difference between Revenue from Operations and Other Income, and quantify how much of profit comes from each",
        "Detect operating leverage in action by comparing the rate of revenue growth to the rate of EBITDA growth",
        "Compute the Effective Tax Rate and judge whether it is sustainable",
        "Strip out exceptional/one-off items and compute normalised PAT",
        "Practise the analyst habit of writing a one-paragraph quality-of-earnings assessment from a single statement",
    ],
    "config": {
        "document_data": {
            "company_name": "BharatBites Ltd — Standalone",
            "period": "Year ended 31 March 2024 (FY24 vs FY23) · ₹ in crore",
            "currency": "₹ crore",
            "sections": [
                {
                    "title": "Revenue",
                    "line_items": [
                        {"id": "rev_ops", "label": "Revenue from Operations", "current_year": 4820, "previous_year": 4350},
                        {"id": "other_income", "label": "Other Income", "current_year": 185, "previous_year": 95},
                    ],
                    "section_total": {"label": "Total Income", "current_year": 5005, "previous_year": 4445},
                },
                {
                    "title": "Cost of Goods Sold",
                    "line_items": [
                        {"id": "raw_materials", "label": "Cost of Materials Consumed", "current_year": 2410, "previous_year": 2280},
                        {"id": "purchases_stock", "label": "Purchases of Stock-in-Trade", "current_year": 90, "previous_year": 80},
                        {"id": "inv_change", "label": "Changes in Inventories of Finished Goods & WIP", "current_year": -25, "previous_year": -15, "indent": True},
                    ],
                    "section_total": {"label": "Total COGS", "current_year": 2475, "previous_year": 2345},
                },
                {
                    "title": "Operating Expenses",
                    "line_items": [
                        {"id": "employee_cost", "label": "Employee Benefits Expense", "current_year": 360, "previous_year": 320},
                        {"id": "advertising", "label": "Advertising & Sales Promotion", "current_year": 410, "previous_year": 360},
                        {"id": "other_opex", "label": "Other Operating Expenses (freight, power, distribution)", "current_year": 540, "previous_year": 500},
                        {"id": "depreciation", "label": "Depreciation & Amortisation", "current_year": 165, "previous_year": 145},
                    ],
                    "section_total": {"label": "Total Operating Expenses", "current_year": 1475, "previous_year": 1325},
                },
                {
                    "title": "Finance & Exceptional",
                    "line_items": [
                        {"id": "finance_cost", "label": "Finance Costs (interest)", "current_year": 35, "previous_year": 40},
                        {"id": "exceptional_item", "label": "Exceptional Item — Gain on sale of land parcel (one-off)", "current_year": 80, "previous_year": 0},
                    ],
                },
                {
                    "title": "Profit & Tax",
                    "line_items": [
                        {"id": "pbt", "label": "Profit Before Tax (PBT)", "current_year": 1100, "previous_year": 735},
                        {"id": "tax_expense", "label": "Tax Expense (current + deferred)", "current_year": 281, "previous_year": 188},
                    ],
                    "section_total": {"label": "Profit After Tax (PAT)", "current_year": 819, "previous_year": 547},
                },
                {
                    "title": "Per Share",
                    "line_items": [
                        {"id": "wa_shares", "label": "Weighted-Average Shares Outstanding (crore)", "current_year": 24.0, "previous_year": 24.0},
                        {"id": "eps", "label": "Basic Earnings Per Share (₹)", "current_year": 34.13, "previous_year": 22.79},
                    ],
                },
            ],
        },
        "interactive_highlights": [
            {"id": "rev_ops", "tooltip": "Revenue from Operations is the TOP-LINE for the core business — biscuits and snacks sold through distributors and modern trade. It excludes treasury and investment income."},
            {"id": "other_income", "tooltip": "Other Income captures non-operating earnings — interest on fixed deposits, dividends from subsidiaries, FX gains. A spike here without a matching cash-position rise is a yellow flag."},
            {"id": "inv_change", "tooltip": "A NEGATIVE 'Changes in Inventories' means inventory grew on the balance sheet — production exceeded sales by that amount; this REDUCES COGS for the period."},
            {"id": "advertising", "tooltip": "FMCG firms typically run A&P at 8–11% of revenue. Cutting A&P boosts near-term margins but hurts long-term brand share — always check this trajectory."},
            {"id": "depreciation", "tooltip": "D&A is non-cash; it sits between EBITDA and EBIT. A rising D&A line usually reflects capex catching up — model this against the PP&E roll-forward."},
            {"id": "finance_cost", "tooltip": "Finance Costs falling from ₹40 cr to ₹35 cr suggests deleveraging or refinancing at lower rates. Tie this to the borrowings line on the balance sheet to confirm."},
            {"id": "exceptional_item", "tooltip": "Exceptional items must be STRIPPED OUT to get normalised earnings — otherwise YoY growth gets flattered by a one-time gain that will not recur next year."},
            {"id": "tax_expense", "tooltip": "The Indian corporate tax rate under the new regime is ~25.17% (statutory). Effective Tax Rate = Tax Expense / PBT — if persistently below statutory, look for tax holidays, SEZ benefits, or deferred-tax adjustments."},
        ],
        "tasks": [
            {
                "id": "t1_gross_profit",
                "question": "Compute Gross Profit for FY24 (in ₹ crore). Use Revenue from Operations minus Total COGS.",
                "answer_type": "number",
                "expected_value": 2345,
                "tolerance": 5,
                "unit": "₹ cr",
                "explanation": (
                    "Gross Profit = Revenue from Operations − Total COGS = 4,820 − 2,475 = ₹2,345 cr. "
                    "Note: we use Revenue from Operations (NOT Total Income) because COGS only relates "
                    "to the core business; Other Income has no COGS attached to it."
                ),
            },
            {
                "id": "t2_gross_margin",
                "question": "What is FY24 Gross Margin %? Round to one decimal.",
                "answer_type": "number",
                "expected_value": 48.7,
                "tolerance": 0.3,
                "unit": "%",
                "explanation": (
                    "Gross Margin % = (Gross Profit / Revenue from Operations) × 100 = (2,345 / 4,820) × 100 = 48.7%. "
                    "FY23 Gross Margin = (4,350 − 2,345) / 4,350 = 46.1% → margin EXPANDED by ~260 bps YoY, "
                    "consistent with falling palm-oil and wheat prices and modest price hikes — strong pricing power."
                ),
            },
            {
                "id": "t3_ebitda",
                "question": "Compute EBITDA for FY24 (in ₹ crore). Use Revenue from Operations − COGS − Operating Expenses excluding D&A.",
                "answer_type": "number",
                "expected_value": 1035,
                "tolerance": 5,
                "unit": "₹ cr",
                "explanation": (
                    "EBITDA = 4,820 − 2,475 − (360 employee + 410 ad + 540 other opex) = 4,820 − 2,475 − 1,310 = ₹1,035 cr. "
                    "Note we deliberately EXCLUDE D&A (₹165 cr) — that is the 'DA' in EBITDA. We also exclude Other Income "
                    "because EBITDA is meant to be a CORE-operations measure."
                ),
            },
            {
                "id": "t4_ebitda_margin",
                "question": "What is FY24 EBITDA Margin %? Round to one decimal.",
                "answer_type": "number",
                "expected_value": 21.5,
                "tolerance": 0.3,
                "unit": "%",
                "explanation": (
                    "EBITDA Margin % = (1,035 / 4,820) × 100 = 21.5%. "
                    "FY23 EBITDA was 4,350 − 2,345 − (320+360+500) = 825 cr → 19.0% margin. EBITDA margin EXPANDED ~250 bps. "
                    "FMCG peers: Britannia ~17%, Nestle India ~22%. BharatBites is clearly punching above its size."
                ),
            },
            {
                "id": "t5_ebit",
                "question": "Compute EBIT (Operating Profit) for FY24 (₹ cr). Use EBITDA − D&A.",
                "answer_type": "number",
                "expected_value": 870,
                "tolerance": 5,
                "unit": "₹ cr",
                "explanation": (
                    "EBIT = EBITDA − D&A = 1,035 − 165 = ₹870 cr. "
                    "EBIT (also called Operating Profit) is what the core business earns AFTER recognising the wear-and-tear "
                    "of its assets. ROCE and Interest Coverage are built on EBIT, not EBITDA — that is why it is the more "
                    "honest operating profitability measure for capex-heavy industries."
                ),
            },
            {
                "id": "t6_other_income_line",
                "question": "Which P&L LINE captures non-operating earnings such as interest on bank deposits, FX gains, and dividends from subsidiaries? Type the exact line name.",
                "answer_type": "text",
                "expected_keywords": ["other income"],
                "explanation": (
                    "Other Income (₹185 cr in FY24) is the non-operating line. It nearly DOUBLED from ₹95 cr in FY23 — "
                    "a yellow flag worth investigating. If the cash and investments balance has not also doubled, the rise "
                    "is suspicious. Always verify Other Income against the cash and investment notes in the schedules."
                ),
            },
            {
                "id": "t7_other_income_pct_pbt",
                "question": "What % of FY24 Profit Before Tax (PBT) comes from Other Income? Round to one decimal.",
                "answer_type": "number",
                "expected_value": 16.8,
                "tolerance": 0.5,
                "unit": "%",
                "explanation": (
                    "Other Income / PBT = 185 / 1,100 = 16.8%. "
                    "When more than ~10% of PBT comes from Other Income, you must ask: is the CORE business actually weakening "
                    "and being papered over by treasury income? In FY23 the share was 95/735 = 12.9% — so dependence on Other "
                    "Income is RISING, even though core operations are also growing. A subtle but important signal."
                ),
            },
            {
                "id": "t8_etr",
                "question": "Compute the Effective Tax Rate (ETR) for FY24 in %. Round to one decimal.",
                "answer_type": "number",
                "expected_value": 25.5,
                "tolerance": 0.5,
                "unit": "%",
                "explanation": (
                    "ETR = Tax Expense / PBT × 100 = 281 / 1,100 × 100 = 25.5%. "
                    "This sits almost exactly on the Indian statutory rate of 25.17% under the new regime — clean, mainstream "
                    "operations with no special tax incentives. Compare with FY23 ETR = 188/735 = 25.6%. Stable and predictable. "
                    "Companies with ETR persistently 5–10 percentage points BELOW statutory deserve a closer look — usually they "
                    "have SEZ benefits or deferred-tax recognitions that may roll off."
                ),
            },
            {
                "id": "t9_normalised_pat",
                "question": (
                    "Strip out the one-time exceptional gain (gain on sale of land parcel) on a post-tax basis and compute "
                    "NORMALISED PAT for FY24. Use the same effective tax rate of 25.5% to tax the exceptional item. Answer in ₹ cr."
                ),
                "answer_type": "number",
                "expected_value": 759,
                "tolerance": 5,
                "unit": "₹ cr",
                "explanation": (
                    "After-tax exceptional gain = 80 × (1 − 0.255) = 80 × 0.745 = ₹59.6 cr. "
                    "Normalised PAT = Reported PAT − after-tax exceptional = 819 − 59.6 ≈ ₹759 cr. "
                    "This is the number you carry forward into a forward P/E. Reported PAT growth was +49.7%, but "
                    "normalised PAT growth is (759 − 547)/547 = +38.8% — still strong, but materially less than the headline "
                    "implies. THIS is why analysts always normalise: the reported number includes a tailwind that won't recur in FY25."
                ),
            },
            {
                "id": "t10_eps",
                "question": "Verify Basic EPS for FY24 from first principles. Compute PAT / Weighted-Average Shares Outstanding. Answer in ₹ to two decimals.",
                "answer_type": "number",
                "expected_value": 34.13,
                "tolerance": 0.10,
                "unit": "₹",
                "explanation": (
                    "EPS = PAT / Weighted-Average Shares = 819 / 24.0 = ₹34.13 — matches the reported figure. "
                    "Always cross-check the reported EPS against the math. EPS grew +49.8% YoY (34.13 / 22.79). On NORMALISED "
                    "basis: 759 / 24.0 = ₹31.63, which means normalised EPS growth was +38.8%."
                ),
            },
            {
                "id": "t11_op_leverage_check",
                "question": (
                    "Operating-leverage gut-check. Revenue from Operations grew from ₹4,350 cr to ₹4,820 cr (+10.8%). EBITDA grew "
                    "from ₹825 cr to ₹1,035 cr (+25.5%). What multiple of revenue growth is EBITDA growth? Round to one decimal."
                ),
                "answer_type": "number",
                "expected_value": 2.4,
                "tolerance": 0.2,
                "unit": "x",
                "explanation": (
                    "EBITDA growth / Revenue growth = 25.5% / 10.8% = 2.4x. "
                    "An EBITDA-to-revenue growth multiple of >1.5x is a clear sign of POSITIVE operating leverage — fixed costs "
                    "(rent, salaried headcount, brand investment) were spread over a larger revenue base, so an extra rupee of "
                    "sales dropped a much larger share to EBITDA than the prior year. The flip side: if revenue ever DROPS, the "
                    "leverage works in reverse and EBITDA falls 2.4x as fast — a good thing to model in your bear case."
                ),
            },
            {
                "id": "t12_qoe_view",
                "question": (
                    "Free-text — Write a 4–6 sentence Quality-of-Earnings note. Cover: (a) the headline numbers, (b) the role of "
                    "exceptional items and Other Income, (c) operating leverage, (d) your overall stance — does the underlying "
                    "business look healthy or window-dressed?"
                ),
                "answer_type": "free_text",
                "explanation": (
                    "There is no single 'right' answer — strong analyst notes are concise, cite numbers, and form a clear view. "
                    "Look at the sample for a model response."
                ),
                "sample_answer": (
                    "BharatBites' reported FY24 PAT of ₹819 cr (+49.7% YoY) overstates true operational improvement. Stripping out "
                    "the ₹80 cr one-off gain on land sale (post-tax ~₹60 cr), normalised PAT is ~₹759 cr, +38.8% — still strong, "
                    "but ~11 percentage points lower than the headline.\n\n"
                    "Underlying operations are genuinely improving: Gross Margin expanded ~260 bps (raw-material tailwind plus "
                    "modest price hikes), EBITDA margin expanded ~250 bps to 21.5% (now ahead of Britannia, approaching Nestle "
                    "India), and EBITDA grew 2.4x faster than revenue — clear positive operating leverage.\n\n"
                    "Two yellow flags: Other Income jumped from ₹95 cr to ₹185 cr and now contributes 16.8% of PBT (up from 12.9%) "
                    "— I would tie this to the cash-and-investments line and treasury notes before concluding it is benign. Tax "
                    "rate is clean and aligned to statutory.\n\n"
                    "Net-net: the core P&L is healthy and beating peers, but headline PAT growth is flattered by the exceptional "
                    "item and a meaningful step-up in non-operating income. I would model normalised earnings as the base case "
                    "and use reported numbers only to triangulate — and I would build a separate question for management on the "
                    "Other Income walk."
                ),
            },
        ],
    },
}

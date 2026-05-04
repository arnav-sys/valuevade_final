"""
Document-type simulations for Module 1 Sessions 4 and 9.

S4 — Introduction to Financial Statements (The Big Three):
  Identify where each line lives across P&L, BS, CFS for GreenLeaf Foods.
  Tasks are mostly identification + a few simple computations.

S9 — Linking the Three Statements:
  Roll-forward exercise — given Year-1 closing BS + Year-2 P&L + Year-2 CFS movements,
  compute Year-2 closing BS lines (Reserves, PP&E, Long-term debt, Cash).
"""

# ──────────────── S4 — BIG THREE ────────────────
S4_SIM = {
    "session_id": "__resolve_at_runtime_S4__",
    "sim_type": "document",
    "title": "The Big Three — Identifying Where Each Line Lives in GreenLeaf Foods",
    "scenario": (
        "GreenLeaf Foods is a fictional Indian packaged-foods mid-cap. Today the senior analyst "
        "drops three short statements on your desk — a P&L extract, a Balance Sheet extract, and a "
        "Cash Flow Statement extract — and asks you to play 'where does each thing live'. The point "
        "is not heavy math; the point is to internalise WHICH line lives in WHICH statement, and how "
        "those lines connect."
    ),
    "instructions": (
        "Click any underlined line for an analyst tooltip. Then work through the tasks. They are a "
        "mix of identification ('which statement does X appear on?') and simple computations "
        "('what is gross margin?'). You will not need a calculator for most of them."
    ),
    "objectives": [
        "Identify whether a given line item lives on the P&L, Balance Sheet, or Cash Flow Statement",
        "Trace how D&A appears on BOTH the P&L (deducted) and CFS (added back as non-cash)",
        "Compute basic margins (gross, EBITDA, net) directly from a real-looking P&L",
    ],
    "config": {
        "document_data": {
            "company_name": "GreenLeaf Foods Ltd — Standalone",
            "period": "FY24 · ₹ in crore",
            "currency": "₹ crore",
            "sections": [
                {
                    "title": "Profit & Loss (extract)",
                    "line_items": [
                        {"id": "rev", "label": "Revenue from Operations", "current_year": 2400, "previous_year": 2100},
                        {"id": "cogs", "label": "Cost of Materials Consumed (COGS)", "current_year": 1320, "previous_year": 1180},
                        {"id": "gp", "label": "Gross Profit", "current_year": 1080, "previous_year": 920},
                        {"id": "opex", "label": "Operating Expenses (excl. D&A)", "current_year": 540, "previous_year": 470},
                        {"id": "ebitda", "label": "EBITDA", "current_year": 540, "previous_year": 450},
                        {"id": "da", "label": "Depreciation & Amortisation", "current_year": 90, "previous_year": 80},
                        {"id": "ebit", "label": "EBIT", "current_year": 450, "previous_year": 370},
                        {"id": "tax", "label": "Tax Expense", "current_year": 113, "previous_year": 92},
                        {"id": "pat", "label": "Profit After Tax (PAT)", "current_year": 337, "previous_year": 278},
                    ],
                },
                {
                    "title": "Balance Sheet (extract)",
                    "line_items": [
                        {"id": "ppe", "label": "Property, Plant & Equipment (net)", "current_year": 950, "previous_year": 880},
                        {"id": "inv", "label": "Inventories", "current_year": 380, "previous_year": 320},
                        {"id": "rec", "label": "Trade Receivables", "current_year": 220, "previous_year": 200},
                        {"id": "cash", "label": "Cash & Equivalents", "current_year": 280, "previous_year": 200},
                        {"id": "lt_debt", "label": "Long-Term Borrowings", "current_year": 300, "previous_year": 350},
                        {"id": "equity", "label": "Total Shareholders' Equity", "current_year": 1430, "previous_year": 1180},
                    ],
                },
                {
                    "title": "Cash Flow Statement (extract)",
                    "line_items": [
                        {"id": "cfo_pat_start", "label": "PAT (starting line of indirect-method CFO)", "current_year": 337, "previous_year": 278},
                        {"id": "cfo_da_addback", "label": "Add: Depreciation & Amortisation (non-cash)", "current_year": 90, "previous_year": 80, "indent": True},
                        {"id": "net_cfo", "label": "Net Cash from Operations (CFO)", "current_year": 410, "previous_year": 360},
                        {"id": "capex", "label": "Capex (purchase of PP&E) — CFI", "current_year": -160, "previous_year": -130},
                        {"id": "div_paid", "label": "Dividends Paid — CFF", "current_year": -120, "previous_year": -100},
                        {"id": "debt_repaid", "label": "Net Long-Term Debt Repayment — CFF", "current_year": -50, "previous_year": -40},
                    ],
                },
            ],
        },
        "interactive_highlights": [
            {"id": "rev", "tooltip": "Revenue is the TOP-LINE of the P&L — the first number every analyst checks. It captures sales of the core business; non-operating income lives separately."},
            {"id": "gp", "tooltip": "Gross Profit = Revenue − COGS. It tells you how much room the business has after paying for the physical making of the product, before everything else."},
            {"id": "ebitda", "tooltip": "EBITDA strips out interest, tax, and non-cash D&A. It is the closest accounting proxy for cash operating profit and the metric most M&A bankers anchor to."},
            {"id": "da", "tooltip": "D&A is the connection between the three statements. It sits in the P&L (reducing EBIT and PAT) AND on the CFS (added back as non-cash) AND its accumulation reduces PP&E on the Balance Sheet."},
            {"id": "ppe", "tooltip": "PP&E (net) = Gross PP&E minus Accumulated Depreciation. The change in PP&E year-over-year ≈ Capex − D&A (ignoring asset sales). This is the BS↔P&L↔CFS link in one line."},
            {"id": "inv", "tooltip": "Inventory lives on the Balance Sheet as a Current Asset. Changes in inventory show up as working-capital movements in the CFO. An inventory build absorbs cash; a draw-down releases cash."},
            {"id": "cash", "tooltip": "Cash on the BS is the END-of-period balance. The CFS reconciles the change: Opening Cash + Net Change (CFO + CFI + CFF) = Closing Cash."},
            {"id": "cfo_da_addback", "tooltip": "D&A is added back here because it reduced PAT but no actual cash left the company. This is the single most common reconciling item in indirect-method CFO."},
            {"id": "capex", "tooltip": "Capex is OUTFLOW under Investing Activities (CFI). It does NOT reduce reported PAT directly — its impact on profit comes through D&A in subsequent years."},
            {"id": "div_paid", "tooltip": "Dividends are paid in CASH and reduce Reserves & Surplus on the BS. They appear as a CFF outflow but are NOT a P&L expense."},
        ],
        "tasks": [
            {"id": "t1_rev_statement", "question": "On which financial statement does 'Revenue from Operations' primarily appear? Type the statement name.", "answer_type": "text", "expected_keywords": ["p&l", "profit and loss", "income statement", "profit & loss"], "explanation": "Revenue is the top line of the P&L (also called Income Statement or Profit & Loss). It is the first number every analyst checks. It does NOT appear on the Balance Sheet or Cash Flow Statement directly."},
            {"id": "t2_inv_statement", "question": "On which statement does 'Inventories' appear?", "answer_type": "text", "expected_keywords": ["balance sheet", "bs"], "explanation": "Inventories live on the Balance Sheet under Current Assets. They represent goods waiting to be sold. The CHANGE in inventories shows up on the CFS as a working-capital adjustment, but the stock itself is a BS item."},
            {"id": "t3_da_appears_in_p_and_l", "question": "D&A reduces which line on the P&L? Type the line name (the line just below EBITDA).", "answer_type": "text", "expected_keywords": ["ebit", "operating profit"], "explanation": "EBIT = EBITDA − D&A. D&A is the bridge between EBITDA (cash-like profit) and EBIT (profit after recognising the wear-and-tear of assets). EBIT is also called Operating Profit."},
            {"id": "t4_da_addback_in_cfs", "question": "Where in the Cash Flow Statement is D&A 'added back' to reconcile PAT to cash? Type the section name (operating / investing / financing).", "answer_type": "text", "expected_keywords": ["operating", "cfo", "cash from operations"], "explanation": "D&A is added back inside CFO (Operating Activities) as the FIRST major non-cash adjustment after PAT in the indirect method. It does not appear in CFI or CFF."},
            {"id": "t5_gross_margin", "question": "Compute FY24 Gross Margin %. Round to one decimal.", "answer_type": "number", "expected_value": 45.0, "tolerance": 0.5, "unit": "%", "explanation": "Gross Margin % = (Gross Profit / Revenue) × 100 = (1,080 / 2,400) × 100 = 45.0%. A 45% gross margin is healthy for packaged foods — comparable to Britannia. The Gross Profit line is on the P&L, and dividing by Revenue (also on the P&L) gives the margin."},
            {"id": "t6_ebitda_margin", "question": "Compute FY24 EBITDA Margin %. Round to one decimal.", "answer_type": "number", "expected_value": 22.5, "tolerance": 0.5, "unit": "%", "explanation": "EBITDA Margin % = (540 / 2,400) × 100 = 22.5%. Above 20% is excellent in packaged foods. EBITDA is below Operating Expenses on the P&L."},
            {"id": "t7_net_margin", "question": "Compute FY24 Net Margin %. Round to one decimal.", "answer_type": "number", "expected_value": 14.0, "tolerance": 0.5, "unit": "%", "explanation": "Net Margin % = (PAT / Revenue) × 100 = (337 / 2,400) × 100 = 14.0%. Net margin is the only margin that reflects EVERY cost — operating, financing, and tax. PAT is the bottom of the P&L."},
            {"id": "t8_cash_balance_verify", "question": "What is the closing FY24 Cash & Equivalents balance? (₹ cr)", "answer_type": "number", "expected_value": 280, "tolerance": 5, "unit": "₹ cr", "explanation": "₹280 cr — read directly from the Balance Sheet. The CFS reconciles the change: Opening 200 + CFO 410 + CFI (−160) + CFF (−170) = 280. Same number, three different statement perspectives."},
            {"id": "t9_capex_statement", "question": "Capex (purchase of PP&E) appears on which statement? Type the statement name.", "answer_type": "text", "expected_keywords": ["cash flow", "cfs", "investing", "cfi"], "explanation": "Capex is a Cash Flow Statement item (CFI section — Investing Activities). It does NOT appear on the P&L directly; it grows PP&E on the BS, and that PP&E gets depreciated over time, eventually flowing through D&A on the P&L."},
            {"id": "t10_link_explanation", "question": "Free-text — In 2–3 sentences, explain how D&A connects ALL THREE statements. Mention each statement explicitly.", "answer_type": "free_text", "explanation": "Strong answers explicitly connect all three statements through D&A.", "sample_answer": "D&A is the single line item that touches every statement. On the P&L it reduces EBIT and PAT. On the CFS it is added back inside CFO as a non-cash charge to reconcile PAT to cash. On the Balance Sheet, accumulated depreciation reduces gross PP&E to net PP&E. This is why D&A is the textbook example of how the three statements interlock — change one assumption about D&A and all three statements move."},
        ],
    },
}

# ──────────────── S9 — LINKING THE THREE ────────────────
S9_SIM = {
    "session_id": "__resolve_at_runtime_S9__",
    "sim_type": "document",
    "title": "Linking the Three Statements — A FY25 Roll-Forward Exercise",
    "scenario": (
        "GreenLeaf Foods (continued). The senior analyst gives you the FY24 closing balance sheet "
        "PLUS the FY25 P&L and Cash Flow Statement, and asks you to roll forward — i.e., compute "
        "each FY25 closing balance-sheet number from first principles. This is the single most "
        "important exercise in three-statement modelling."
    ),
    "instructions": (
        "Use the BS opening + P&L + CFS data to roll forward each line. Tasks walk you through "
        "Reserves & Surplus, PP&E, Long-Term Debt, and Cash. Apply the standard linking formulae "
        "(closing = opening + flow_in − flow_out)."
    ),
    "objectives": [
        "Apply the linking formula: Closing R&S = Opening R&S + PAT − Dividends Paid",
        "Apply: Closing PP&E (net) = Opening PP&E + Capex − D&A (ignoring sales)",
        "Apply: Closing LT Debt = Opening LT Debt + Borrowings Drawn − Borrowings Repaid",
        "Apply: Closing Cash = Opening Cash + CFO + CFI + CFF",
    ],
    "config": {
        "document_data": {
            "company_name": "GreenLeaf Foods Ltd — FY25 Roll-Forward",
            "period": "All figures ₹ in crore",
            "currency": "₹ crore",
            "sections": [
                {
                    "title": "Opening Balance Sheet (FY24 close)",
                    "line_items": [
                        {"id": "open_ppe", "label": "PP&E (net)", "current_year": 950, "previous_year": 0},
                        {"id": "open_cash", "label": "Cash & Equivalents", "current_year": 280, "previous_year": 0},
                        {"id": "open_lt_debt", "label": "Long-Term Borrowings", "current_year": 300, "previous_year": 0},
                        {"id": "open_rs", "label": "Reserves & Surplus", "current_year": 1340, "previous_year": 0},
                    ],
                },
                {
                    "title": "FY25 Profit & Loss (key items)",
                    "line_items": [
                        {"id": "fy25_rev", "label": "Revenue from Operations", "current_year": 2700, "previous_year": 2400},
                        {"id": "fy25_da", "label": "Depreciation & Amortisation", "current_year": 110, "previous_year": 90},
                        {"id": "fy25_pat", "label": "Profit After Tax", "current_year": 380, "previous_year": 337},
                    ],
                },
                {
                    "title": "FY25 Cash Flow Statement (key items)",
                    "line_items": [
                        {"id": "fy25_cfo", "label": "Net Cash from Operations (CFO)", "current_year": 460, "previous_year": 410},
                        {"id": "fy25_capex", "label": "Capex (purchase of PP&E)", "current_year": -200, "previous_year": -160},
                        {"id": "fy25_cfi", "label": "Net Cash from Investing (CFI total)", "current_year": -200, "previous_year": -160},
                        {"id": "fy25_lt_drawn", "label": "Long-Term Borrowings drawn (new)", "current_year": 100, "previous_year": 0},
                        {"id": "fy25_lt_repaid", "label": "Long-Term Borrowings repaid", "current_year": -150, "previous_year": -50},
                        {"id": "fy25_div", "label": "Dividends Paid", "current_year": -140, "previous_year": -120},
                        {"id": "fy25_cff", "label": "Net Cash from Financing (CFF total)", "current_year": -190, "previous_year": -170},
                    ],
                },
            ],
        },
        "interactive_highlights": [
            {"id": "open_ppe", "tooltip": "Opening PP&E (net) of ₹950 cr is the starting point for the PP&E roll-forward. We add FY25 Capex and subtract FY25 D&A to get FY25 closing PP&E (assuming no asset sales)."},
            {"id": "open_rs", "tooltip": "Opening Reserves & Surplus = ₹1,340 cr. We add FY25 PAT and subtract FY25 Dividends to get FY25 closing R&S — the textbook retained-earnings link between the P&L and BS."},
            {"id": "fy25_pat", "tooltip": "FY25 PAT of ₹380 cr is the FLOW that connects the P&L to the BS. It increases R&S (after dividends) and is the starting line of indirect-method CFO."},
            {"id": "fy25_da", "tooltip": "FY25 D&A reduces PP&E (BS), is deducted on the P&L, and is added back inside CFO. The same number, three different roles."},
            {"id": "fy25_capex", "tooltip": "FY25 Capex of ₹200 cr is a cash outflow (CFI) that increases gross PP&E. After deducting FY25 D&A of ₹110 cr, net PP&E grows by ₹90 cr (200 − 110)."},
            {"id": "fy25_lt_drawn", "tooltip": "Gross debt DRAWN. Net change in long-term debt = drawn − repaid = 100 − 150 = −₹50 cr (net repayment)."},
            {"id": "fy25_div", "tooltip": "Dividends are paid in cash AND reduce Reserves & Surplus by the same amount. They never appear on the P&L."},
        ],
        "tasks": [
            {"id": "t1_close_rs", "question": "Compute closing Reserves & Surplus at end of FY25. (₹ cr)", "answer_type": "number", "expected_value": 1580, "tolerance": 5, "unit": "₹ cr", "explanation": "Closing R&S = Opening R&S + PAT − Dividends Paid = 1,340 + 380 − 140 = ₹1,580 cr. This is the textbook P&L→BS link: every rupee of PAT that is NOT distributed as dividend is retained on the balance sheet as Reserves."},
            {"id": "t2_close_ppe", "question": "Compute closing PP&E (net) at end of FY25 (assume no asset sales). (₹ cr)", "answer_type": "number", "expected_value": 1040, "tolerance": 5, "unit": "₹ cr", "explanation": "Closing PP&E = Opening PP&E + Capex − D&A = 950 + 200 − 110 = ₹1,040 cr. Capex (CFS) builds gross PP&E; D&A (P&L) reduces net PP&E. Net PP&E grows by ₹90 cr — this is the link between CFI, P&L, and BS."},
            {"id": "t3_close_lt_debt", "question": "Compute closing Long-Term Borrowings at end of FY25. (₹ cr)", "answer_type": "number", "expected_value": 250, "tolerance": 5, "unit": "₹ cr", "explanation": "Closing LT Debt = Opening + Drawn − Repaid = 300 + 100 − 150 = ₹250 cr. NET change is −₹50 cr (de-leveraging). Looking at only the 'drawn' or only the 'repaid' line would mislead — always net them."},
            {"id": "t4_net_change_cash", "question": "Compute the FY25 NET CHANGE in Cash & Equivalents (CFO + CFI + CFF). (₹ cr; can be negative)", "answer_type": "number", "expected_value": 70, "tolerance": 5, "unit": "₹ cr", "explanation": "Net change in cash = CFO + CFI + CFF = 460 + (−200) + (−190) = +₹70 cr. The CFS three-section sum is the BS year-over-year cash movement — the most direct three-statement link there is."},
            {"id": "t5_close_cash", "question": "Compute closing Cash & Equivalents at end of FY25. (₹ cr)", "answer_type": "number", "expected_value": 350, "tolerance": 5, "unit": "₹ cr", "explanation": "Closing Cash = Opening Cash + Net Change = 280 + 70 = ₹350 cr. The Balance Sheet must reconcile to this number — if it doesn't, the model is wrong somewhere."},
            {"id": "t6_da_link_check", "question": "FY25 D&A is ₹110 cr. In which TWO statements does this same ₹110 cr appear? Type the two statement names separated by 'and'.", "answer_type": "text", "expected_keywords": ["p&l", "cash flow", "income statement", "profit"], "explanation": "D&A appears on the P&L (reducing EBIT and PAT) AND on the Cash Flow Statement (added back inside CFO as non-cash). This is the most-tested three-statement link in finance interviews. Note: it ALSO appears via accumulated depreciation on the Balance Sheet — making it a three-statement item in the strictest sense."},
            {"id": "t7_dividends_p_and_l", "question": "Do dividends paid appear as an expense on the P&L? Answer 'yes' or 'no'.", "answer_type": "text", "expected_keywords": ["no"], "explanation": "No. Dividends are a distribution of PROFIT to shareholders, not a cost of doing business. They reduce Cash (BS) and Reserves & Surplus (BS) and appear as a CFF outflow — but never on the P&L. This is one of the most common rookie-modelling mistakes."},
            {"id": "t8_quality_check", "question": "Sanity check: With closing PP&E ₹1,040 cr and growing, does the FY25 Capex/D&A ratio of 200/110 ≈ 1.8x suggest GreenLeaf is investing for GROWTH or just MAINTAINING capacity? Answer 'growth' or 'maintenance'.", "answer_type": "text", "expected_keywords": ["growth"], "explanation": "Growth. When Capex > D&A (especially Capex/D&A > 1.5x), the company is adding capacity faster than it's depreciating — i.e., growing the asset base. When Capex ≈ D&A, the company is in maintenance mode. This ratio is one of the fastest reads of investment intensity from the three statements alone."},
            {"id": "t9_three_statement_view", "question": "Free-text — In 3–4 sentences, summarise WHY linking the three statements matters in equity research. Cite at least one specific link (e.g., PAT→Reserves, Capex→PP&E, D&A→three statements).", "answer_type": "free_text", "explanation": "Strong answers cite specific cross-statement links and explain why integrity matters.", "sample_answer": "Linking the three statements is the integrity test of any financial model. Without it, you can have a P&L that books ₹380 cr of PAT but a Balance Sheet whose Reserves & Surplus do not move accordingly — a contradiction. The PAT→Reserves link (closing R&S = opening + PAT − dividends) and the Capex→PP&E link (closing PP&E = opening + capex − D&A) are the two most-tested links in interviews. In equity research, breaking these links is how analysts build wrong DCFs and over- or under-value businesses by 10–20% silently."},
        ],
    },
}

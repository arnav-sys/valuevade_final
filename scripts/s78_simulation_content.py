"""
Document-type simulations for Module 1 / Sessions 7 and 8.

S7: Balance Sheet of TitanWorks Ltd (fictional Indian jewelry/lifestyle mid-cap)
S8: Cash Flow Statement of RangoorPaints Ltd (fictional Indian decorative-paints mid-cap)

Both follow the DocumentSim schema documented in /app/scripts/s6_simulation_content.py
"""

# =====================================================================
# SESSION 7 — Balance Sheet (session_id 9559a9ba-a909-4f8c-9346-4219bf23852a)
# =====================================================================
S7_SIM = {
    "session_id": "9559a9ba-a909-4f8c-9346-4219bf23852a",
    "sim_type": "document",
    "title": "Balance Sheet Forensics — Diagnosing TitanWorks' Financial Health",
    "scenario": (
        "It is your third week as an equity research intern. Your senior analyst slides "
        "across TitanWorks Ltd's standalone balance sheet for FY24 and FY23. TitanWorks "
        "is a mid-cap Indian jewelry and watches company that competes head-to-head with "
        "Titan and Kalyan. The analyst's brief: 'Forget the income statement for now. The "
        "balance sheet alone tells me about the QUALITY of this business — what it owns, "
        "what it owes, how aggressively it's leveraged, and how much working capital is "
        "tied up in inventory. Compute the headline ratios, spot the lease-versus-debt "
        "trick, and tell me whether this is a cash-rich compounder or a working-capital trap.'"
    ),
    "instructions": (
        "Click any underlined item in the balance sheet to see an analyst tooltip. Then "
        "work through the tasks on the right one-by-one. They cover liquidity ratios, "
        "leverage, working-capital intensity, and book-value math. For Inventory Days "
        "and Debt-to-EBITDA tasks the analyst has supplied the income-statement context "
        "you need. End with a short free-text quality-of-balance-sheet note."
    ),
    "objectives": [
        "Compute liquidity ratios (Current Ratio, Quick Ratio) and judge them against the inventory-heavy nature of jewelry",
        "Distinguish interest-bearing debt from lease liabilities and compute Net Debt the right way",
        "Calculate Debt-to-Equity, Net Working Capital, Book Value Per Share and Capital Employed from a real balance sheet",
        "Translate Inventory into Inventory Days using a separately supplied COGS figure",
        "Practise the analyst habit of writing a balance-sheet quality note that addresses liquidity, leverage and working-capital intensity together",
    ],
    "config": {
        "document_data": {
            "company_name": "TitanWorks Ltd — Standalone Balance Sheet",
            "period": "As at 31 March 2024 (FY24 vs FY23) · ₹ in crore",
            "currency": "₹ crore",
            "sections": [
                {
                    "title": "Equity",
                    "line_items": [
                        {"id": "share_capital", "label": "Equity Share Capital (face value ₹1 per share)", "current_year": 89, "previous_year": 89},
                        {"id": "reserves", "label": "Reserves & Surplus", "current_year": 11400, "previous_year": 9200},
                    ],
                    "section_total": {"label": "Total Shareholders' Equity", "current_year": 11489, "previous_year": 9289},
                },
                {
                    "title": "Non-Current Liabilities",
                    "line_items": [
                        {"id": "lt_borrowings", "label": "Long-Term Borrowings (term loans + bonds)", "current_year": 600, "previous_year": 950},
                        {"id": "lease_nc", "label": "Lease Liabilities (non-current)", "current_year": 2200, "previous_year": 1950},
                        {"id": "dtl", "label": "Deferred Tax Liabilities (net)", "current_year": 180, "previous_year": 160},
                        {"id": "other_ncl", "label": "Other Non-Current Liabilities", "current_year": 120, "previous_year": 100},
                    ],
                    "section_total": {"label": "Total Non-Current Liabilities", "current_year": 3100, "previous_year": 3160},
                },
                {
                    "title": "Current Liabilities",
                    "line_items": [
                        {"id": "st_borrowings", "label": "Short-Term Borrowings (working-capital loans)", "current_year": 1000, "previous_year": 1200},
                        {"id": "trade_payables", "label": "Trade Payables", "current_year": 3500, "previous_year": 3100},
                        {"id": "other_cl", "label": "Other Current Liabilities (current portion of leases, accruals)", "current_year": 2800, "previous_year": 2400},
                        {"id": "provisions", "label": "Short-Term Provisions", "current_year": 200, "previous_year": 180},
                    ],
                    "section_total": {"label": "Total Current Liabilities", "current_year": 7500, "previous_year": 6880},
                },
                {
                    "title": "Non-Current Assets",
                    "line_items": [
                        {"id": "ppe", "label": "Property, Plant & Equipment (factories, machinery, owned stores)", "current_year": 3100, "previous_year": 2800},
                        {"id": "rou", "label": "Right-of-Use Assets (leased stores and warehouses)", "current_year": 2400, "previous_year": 2150},
                        {"id": "goodwill", "label": "Goodwill", "current_year": 600, "previous_year": 600},
                        {"id": "intangibles", "label": "Other Intangible Assets (brands, software)", "current_year": 80, "previous_year": 90},
                        {"id": "investments_nc", "label": "Investments (non-current)", "current_year": 1500, "previous_year": 1300},
                        {"id": "other_nca", "label": "Other Non-Current Assets", "current_year": 320, "previous_year": 280},
                    ],
                    "section_total": {"label": "Total Non-Current Assets", "current_year": 8000, "previous_year": 7220},
                },
                {
                    "title": "Current Assets",
                    "line_items": [
                        {"id": "inventories", "label": "Inventories (gold, diamonds, finished goods)", "current_year": 9200, "previous_year": 7800},
                        {"id": "receivables", "label": "Trade Receivables", "current_year": 900, "previous_year": 750},
                        {"id": "cash", "label": "Cash & Cash Equivalents", "current_year": 1800, "previous_year": 1500},
                        {"id": "bank_other", "label": "Other Bank Balances (deposits)", "current_year": 500, "previous_year": 400},
                        {"id": "other_ca", "label": "Other Current Assets", "current_year": 1689, "previous_year": 1659},
                    ],
                    "section_total": {"label": "Total Current Assets", "current_year": 14089, "previous_year": 12109},
                },
                {
                    "title": "Balance Sheet Total",
                    "line_items": [
                        {"id": "tla_eq", "label": "Total Liabilities + Equity", "current_year": 22089, "previous_year": 19329},
                        {"id": "ta", "label": "Total Assets", "current_year": 22089, "previous_year": 19329},
                    ],
                },
            ],
        },
        "interactive_highlights": [
            {"id": "share_capital", "tooltip": "Face value × number of shares. With face value ₹1 and share capital ₹89 cr, total shares outstanding = 89 cr. Used as the denominator for Book Value Per Share."},
            {"id": "reserves", "tooltip": "Reserves & Surplus = retained earnings + securities premium + other reserves. The growth here from ₹9,200 to ₹11,400 cr (₹2,200 cr) is roughly equal to PAT minus dividends paid during FY24 — a good cross-check against the cash flow statement."},
            {"id": "lt_borrowings", "tooltip": "Term loans and bonds with maturity > 12 months. Falling from ₹950 to ₹600 cr indicates active deleveraging during FY24 — verify by checking 'Repayment of long-term borrowings' on the CFF section of the cash flow statement."},
            {"id": "lease_nc", "tooltip": "Under Ind AS 116, right-to-use assets and corresponding lease liabilities sit on the balance sheet. CRUCIAL: most analysts EXCLUDE leases from interest-bearing debt for D/E and leverage ratios because leases reflect operating real-estate, not financial leverage. Always be explicit which definition you use."},
            {"id": "rou", "tooltip": "Right-of-Use Assets — the lessee's recognition of leased physical assets (stores, warehouses, vehicles). Mirror image of Lease Liabilities. ROU growth of ₹250 cr suggests new store rollouts."},
            {"id": "inventories", "tooltip": "₹9,200 cr inventories on revenue of ~₹17,000 cr means jewelry sits unsold for 197 days on average — this is NORMAL for jewelry (you display the entire collection year-round) but would be alarming for FMCG or IT services. Always benchmark within sector."},
            {"id": "receivables", "tooltip": "₹900 cr is small relative to revenue — about 19 days outstanding. Jewelry is largely cash-on-purchase or tightly credit-controlled wholesale. Compare with auto OEMs where receivables can be 60–90 days."},
            {"id": "cash", "tooltip": "Cash + bank deposits (1,800 + 500) = ₹2,300 cr. Compared with total interest-bearing debt of ₹1,600 cr (excluding leases), TitanWorks is in NET CASH territory — a sign of conservative capital management."},
        ],
        "tasks": [
            {
                "id": "t1_current_ratio",
                "question": "Compute the FY24 Current Ratio. Round to two decimals.",
                "answer_type": "number",
                "expected_value": 1.88,
                "tolerance": 0.03,
                "unit": "x",
                "explanation": (
                    "Current Ratio = Current Assets / Current Liabilities = 14,089 / 7,500 = 1.88x. "
                    "FY23 = 12,109 / 6,880 = 1.76x — improved YoY. A ratio above 1.5 is generally healthy "
                    "for a working-capital-heavy business; jewelry typically runs 1.6–2.0x because of large "
                    "inventory parked at all times."
                ),
            },
            {
                "id": "t2_quick_ratio",
                "question": "Compute the FY24 Quick Ratio (acid-test). Round to two decimals.",
                "answer_type": "number",
                "expected_value": 0.65,
                "tolerance": 0.03,
                "unit": "x",
                "explanation": (
                    "Quick Ratio = (Current Assets − Inventories) / Current Liabilities = (14,089 − 9,200) / 7,500 = "
                    "4,889 / 7,500 = 0.65x. The big drop from Current Ratio (1.88) to Quick Ratio (0.65) reflects "
                    "the fact that ~65% of TitanWorks' current assets sit as physical jewelry inventory. For a "
                    "FMCG company a 0.65 quick ratio would be a flag; for a jeweller it is sector-normal."
                ),
            },
            {
                "id": "t3_total_debt_no_lease",
                "question": (
                    "Compute interest-bearing debt at FY24-end, EXCLUDING lease liabilities. (Hint: long-term "
                    "borrowings + short-term borrowings.) Answer in ₹ cr."
                ),
                "answer_type": "number",
                "expected_value": 1600,
                "tolerance": 5,
                "unit": "₹ cr",
                "explanation": (
                    "Interest-bearing debt = Long-Term Borrowings + Short-Term Borrowings = 600 + 1,000 = ₹1,600 cr. "
                    "Lease liabilities (₹2,200 cr non-current) are EXCLUDED here because most analysts treat leases "
                    "as an operating commitment rather than financial leverage. If you include leases, total balance-sheet "
                    "obligations would be ₹3,800 cr — always state which definition you are using."
                ),
            },
            {
                "id": "t4_net_debt",
                "question": (
                    "Compute Net Debt at FY24-end. Use interest-bearing debt minus (Cash & Equivalents + Other Bank "
                    "Balances). Answer in ₹ cr (negative number = net cash position)."
                ),
                "answer_type": "number",
                "expected_value": -700,
                "tolerance": 30,
                "unit": "₹ cr",
                "explanation": (
                    "Net Debt = 1,600 − (1,800 + 500) = 1,600 − 2,300 = −₹700 cr (NET CASH of ₹700 cr). "
                    "TitanWorks holds more cash than it owes the bank — a luxury position that gives it firepower "
                    "for store rollouts or a special dividend. Companies in net-cash territory usually trade at premium "
                    "multiples because they cannot go bankrupt from debt alone."
                ),
            },
            {
                "id": "t5_debt_to_equity",
                "question": (
                    "Compute Debt-to-Equity ratio at FY24-end (interest-bearing debt only, excluding leases). Round to two decimals."
                ),
                "answer_type": "number",
                "expected_value": 0.14,
                "tolerance": 0.02,
                "unit": "x",
                "explanation": (
                    "D/E = Interest-Bearing Debt / Shareholders' Equity = 1,600 / 11,489 = 0.14x. "
                    "This is extremely low — for context, Indian capital-intensive industrials run 0.5–1.0x; "
                    "FMCG / jewelry compounders typically run 0.0–0.3x. TitanWorks' 0.14x signals that growth has "
                    "been funded almost entirely by equity (retained earnings) — the hallmark of a high-ROE business."
                ),
            },
            {
                "id": "t6_nwc",
                "question": "Compute Net Working Capital at FY24-end. (NWC = Current Assets − Current Liabilities.) Answer in ₹ cr.",
                "answer_type": "number",
                "expected_value": 6589,
                "tolerance": 10,
                "unit": "₹ cr",
                "explanation": (
                    "NWC = 14,089 − 7,500 = ₹6,589 cr. POSITIVE NWC means the company funds its short-term "
                    "obligations from short-term assets without relying on rolling debt. NWC grew from 5,229 cr "
                    "(FY23) to 6,589 cr (FY24) — a ₹1,360 cr capital absorption that flowed mostly into inventory "
                    "(+₹1,400 cr). This is normal for a growing jewellery business but is a real cash drag."
                ),
            },
            {
                "id": "t7_lease_line",
                "question": "Which line on the asset side captures the value of LEASED stores and warehouses? Type the exact name (or its common abbreviation).",
                "answer_type": "text",
                "expected_keywords": ["right-of-use", "right of use", "rou"],
                "explanation": (
                    "Right-of-Use Assets (often abbreviated 'ROU') — required by Ind AS 116. ROU sits on the asset "
                    "side and is offset by an equal Lease Liabilities entry on the liability side. ROU/Lease growth "
                    "of ₹250 cr signals new store leases signed during FY24. Pre-Ind AS 116, this would have been "
                    "an off-balance-sheet operating lease — leverage-light optically but economically the same."
                ),
            },
            {
                "id": "t8_bvps",
                "question": (
                    "Compute Book Value Per Share (BVPS) at FY24-end. Use Total Equity divided by shares outstanding "
                    "(face value ₹1 per share, Equity Share Capital ₹89 cr ⇒ 89 cr shares). Answer in ₹ to one decimal."
                ),
                "answer_type": "number",
                "expected_value": 129.1,
                "tolerance": 1.0,
                "unit": "₹",
                "explanation": (
                    "Shares outstanding = Share Capital / Face Value = 89 / 1 = 89 cr shares. "
                    "BVPS = Total Equity / Shares = 11,489 / 89 = ₹129.1. "
                    "BVPS by itself is unhelpful for a brand-led business — TitanWorks likely trades at 25–35x "
                    "P/B because the brand is intangible and not on the balance sheet. P/B is most useful for "
                    "asset-heavy businesses (banks, real estate)."
                ),
            },
            {
                "id": "t9_inventory_days",
                "question": (
                    "Inventory Days check. The senior analyst tells you TitanWorks' FY24 COGS is ₹17,000 cr. Compute "
                    "Inventory Days using FY24-end inventory. (Formula: Inventory / COGS × 365.) Round to whole days."
                ),
                "answer_type": "number",
                "expected_value": 197,
                "tolerance": 5,
                "unit": "days",
                "explanation": (
                    "Inventory Days = (Inventory / COGS) × 365 = (9,200 / 17,000) × 365 ≈ 197 days. "
                    "Almost two-thirds of a year of inventory on the shelf — completely normal for jewelry "
                    "(you stock everything you display). For FMCG it would be 30–60 days; for IT services, ~0. "
                    "ALWAYS sector-benchmark this number — comparing TitanWorks' 197 days with HUL's 50 days "
                    "would lead to nonsense conclusions."
                ),
            },
            {
                "id": "t10_capital_employed",
                "question": (
                    "Compute Capital Employed at FY24-end. Use the convention: Capital Employed = Total Assets − "
                    "Current Liabilities. Answer in ₹ cr."
                ),
                "answer_type": "number",
                "expected_value": 14589,
                "tolerance": 10,
                "unit": "₹ cr",
                "explanation": (
                    "Capital Employed = Total Assets − Current Liabilities = 22,089 − 7,500 = ₹14,589 cr. "
                    "This is the long-term capital (equity + non-current liabilities) actually deployed in the "
                    "business. ROCE in the next session = EBIT / Capital Employed — so this number is the denominator "
                    "for one of the most important profitability metrics in equity research."
                ),
            },
            {
                "id": "t11_quality_view",
                "question": (
                    "Free-text — Write a 4–6 sentence Balance-Sheet Quality note. Cover: (a) liquidity stance, "
                    "(b) leverage / net-debt position, (c) working-capital intensity (especially inventory), "
                    "(d) overall verdict — robust, average or stretched."
                ),
                "answer_type": "free_text",
                "explanation": (
                    "There is no single 'right' answer — strong analyst notes are concise, cite numbers, and "
                    "express a clear view. See the sample for a model response."
                ),
                "sample_answer": (
                    "TitanWorks' balance sheet is unambiguously robust. Liquidity is solid (Current Ratio 1.88x; "
                    "Quick Ratio 0.65x is sector-normal for jewelry given the inventory weight) and the company is "
                    "in a NET CASH position of ₹700 cr — interest-bearing debt of ₹1,600 cr is more than covered by "
                    "₹2,300 cr of cash and bank balances.\n\n"
                    "Leverage (D/E 0.14x excluding leases) is conservative; growth has been funded almost entirely "
                    "by retained earnings, evidenced by Reserves & Surplus expanding ₹2,200 cr YoY against a tiny "
                    "borrowings step-down. Even if we capitalise leases (₹2,200 cr), total obligations of ₹3,800 cr "
                    "stay comfortable against ₹4,200 cr of EBITDA.\n\n"
                    "The one yellow flag is working-capital intensity: inventory grew ₹1,400 cr to ₹9,200 cr (197 "
                    "days), absorbing ~₹1,360 cr of incremental NWC. This is structurally inherent to jewelry but it "
                    "is the line I would model carefully — if same-store inventory turnover is slipping, the business "
                    "is pre-emptively stocking unsold goods.\n\n"
                    "Net-net: a high-quality, conservatively financed balance sheet typical of compounders. The only "
                    "real risk is operational, not financial — a slowdown in jewelry demand would strand the inventory."
                ),
            },
        ],
    },
}


# =====================================================================
# SESSION 8 — Cash Flow Statement (session_id 4af45899-19ee-4ab1-bb85-92b29c995557)
# =====================================================================
S8_SIM = {
    "session_id": "4af45899-19ee-4ab1-bb85-92b29c995557",
    "sim_type": "document",
    "title": "Cash Flow Forensics — Following the Money at RangoorPaints",
    "scenario": (
        "Same desk, same intern. Your senior analyst hands you the FY24 cash flow "
        "statement of RangoorPaints Ltd — a fictional Indian decorative-paints mid-cap "
        "in the Asian Paints / Berger archetype. The brief: 'Profit is an opinion. Cash is "
        "a fact. Walk me through CFO, CFI and CFF, calculate FCF, judge the cash conversion, "
        "and tell me whether this business actually generates cash or just earnings on paper. "
        "Pay close attention to working-capital changes and the difference between debt drawn "
        "and debt repaid — that is where the real story hides.'"
    ),
    "instructions": (
        "Click any underlined item in the cash flow statement to see an analyst tooltip. "
        "Then work through the 12 tasks on the right. They walk you from Net CFO calculation, "
        "to cash-conversion ratio, to Free Cash Flow, to net debt repayment and shareholder "
        "payout, and finally to a free-text cash-quality assessment. The income-statement "
        "context you need (PAT) is supplied inside the tasks where required."
    ),
    "objectives": [
        "Read a standalone cash flow statement under the indirect method and compute Net CFO, Net CFI, Net CFF",
        "Compute the cash-conversion ratio (CFO / PAT) and judge whether reported earnings are backed by cash",
        "Calculate Free Cash Flow (CFO − Capex) and understand why FCF is the discount-rate-relevant cash flow in DCF",
        "Distinguish between gross debt drawn and net debt repayment, and quantify total payout to shareholders",
        "Spot working-capital drag inside CFO and explain the gap between Operating Profit before WC changes and Cash from Operations",
        "Practise the analyst habit of writing a quality-of-cash-flow note that triangulates CFO, capex, and shareholder payouts",
    ],
    "config": {
        "document_data": {
            "company_name": "RangoorPaints Ltd — Standalone Cash Flow Statement",
            "period": "Year ended 31 March 2024 · Indirect Method · ₹ in crore",
            "currency": "₹ crore",
            "sections": [
                {
                    "title": "A · Cash Flow from Operating Activities",
                    "line_items": [
                        {"id": "pat", "label": "Profit After Tax (from P&L)", "current_year": 4200, "previous_year": 3450},
                        {"id": "add_da", "label": "Add: Depreciation & Amortisation (non-cash)", "current_year": 1200, "previous_year": 1050, "indent": True},
                        {"id": "add_finance_cost", "label": "Add: Finance Costs (interest expense reversed)", "current_year": 180, "previous_year": 220, "indent": True},
                        {"id": "add_tax_expense", "label": "Add: Tax Expense reversed (current + deferred)", "current_year": 1420, "previous_year": 1170, "indent": True},
                        {"id": "less_other_income", "label": "Less: Other Income (interest, dividend received — moved to CFI)", "current_year": -350, "previous_year": -260, "indent": True},
                        {"id": "op_before_wc", "label": "Operating Profit before Working Capital Changes", "current_year": 6650, "previous_year": 5630},
                        {"id": "wc_inv", "label": "(Increase) / Decrease in Inventories", "current_year": -800, "previous_year": -550, "indent": True},
                        {"id": "wc_recv", "label": "(Increase) / Decrease in Trade Receivables", "current_year": -250, "previous_year": -180, "indent": True},
                        {"id": "wc_payables", "label": "Increase / (Decrease) in Trade Payables", "current_year": 600, "previous_year": 450, "indent": True},
                        {"id": "wc_other_a", "label": "(Increase) / Decrease in Other Current Assets", "current_year": -120, "previous_year": -60, "indent": True},
                        {"id": "wc_other_l", "label": "Increase / (Decrease) in Other Current Liabilities", "current_year": 200, "previous_year": 150, "indent": True},
                        {"id": "cash_from_ops", "label": "Cash Generated from Operations", "current_year": 6280, "previous_year": 5440},
                        {"id": "tax_paid", "label": "Less: Direct Taxes Paid", "current_year": -1500, "previous_year": -1290, "indent": True},
                    ],
                    "section_total": {"label": "A · Net Cash Flow from Operating Activities (CFO)", "current_year": 4780, "previous_year": 4150},
                },
                {
                    "title": "B · Cash Flow from Investing Activities",
                    "line_items": [
                        {"id": "capex", "label": "Purchase of Property, Plant & Equipment (Capex)", "current_year": -1800, "previous_year": -1500},
                        {"id": "ppe_sale", "label": "Proceeds from Sale of PP&E", "current_year": 50, "previous_year": 30},
                        {"id": "buy_inv", "label": "Purchase of Investments", "current_year": -2500, "previous_year": -2000},
                        {"id": "sale_inv", "label": "Sale / Maturity of Investments", "current_year": 1800, "previous_year": 1400},
                        {"id": "acquisition", "label": "Acquisition of subsidiary (net of cash acquired)", "current_year": -400, "previous_year": 0},
                        {"id": "interest_recd", "label": "Interest Received", "current_year": 220, "previous_year": 170},
                        {"id": "dividend_recd", "label": "Dividend Received from Investments", "current_year": 50, "previous_year": 40},
                    ],
                    "section_total": {"label": "B · Net Cash Flow from Investing Activities (CFI)", "current_year": -2580, "previous_year": -1860},
                },
                {
                    "title": "C · Cash Flow from Financing Activities",
                    "line_items": [
                        {"id": "lt_drawn", "label": "Proceeds from Long-Term Borrowings", "current_year": 500, "previous_year": 200},
                        {"id": "lt_repaid", "label": "Repayment of Long-Term Borrowings", "current_year": -800, "previous_year": -300},
                        {"id": "st_net", "label": "Net change in Short-Term Borrowings", "current_year": -200, "previous_year": 100},
                        {"id": "interest_paid", "label": "Interest Paid (cash)", "current_year": -200, "previous_year": -240},
                        {"id": "dividends_paid", "label": "Dividends Paid to Equity Shareholders", "current_year": -1400, "previous_year": -1100},
                        {"id": "lease_paid", "label": "Repayment of Lease Liabilities", "current_year": -350, "previous_year": -310},
                    ],
                    "section_total": {"label": "C · Net Cash Flow from Financing Activities (CFF)", "current_year": -2450, "previous_year": -1650},
                },
                {
                    "title": "Reconciliation",
                    "line_items": [
                        {"id": "net_change", "label": "Net Increase / (Decrease) in Cash (A + B + C)", "current_year": -250, "previous_year": 640},
                        {"id": "open_cash", "label": "Cash & Cash Equivalents at the beginning of the year", "current_year": 2050, "previous_year": 1410},
                    ],
                    "section_total": {"label": "Cash & Cash Equivalents at the end of the year", "current_year": 1800, "previous_year": 2050},
                },
            ],
        },
        "interactive_highlights": [
            {"id": "pat", "tooltip": "PAT comes straight from the income statement — the starting point of the indirect method. The whole purpose of the rest of CFO is to convert this accrual-accounting number back to actual cash."},
            {"id": "add_da", "tooltip": "D&A is added BACK because it reduced PAT but no cash actually left the company. This is the single biggest non-cash add-back in most income statements."},
            {"id": "add_tax_expense", "tooltip": "P&L tax expense is reversed here, then ACTUAL taxes paid (further down) are subtracted. This separates accrual-accounting tax from cash tax — the gap shows up as deferred tax movements on the balance sheet."},
            {"id": "less_other_income", "tooltip": "Other Income (interest received, dividend received) is reversed out of CFO and shown separately in CFI. This is the right place for those cash flows — they are returns on investments, not operating cash."},
            {"id": "wc_inv", "tooltip": "An INCREASE in inventory absorbs cash (we paid suppliers but haven't sold yet). Hence the negative sign. RangoorPaints absorbed ₹800 cr in inventory build-up in FY24 — typical for a growing paints company stocking ahead of the dry season."},
            {"id": "wc_payables", "tooltip": "An INCREASE in trade payables RELEASES cash (we received goods but haven't paid yet). Positive sign on the cash flow. ₹600 cr of cash was effectively financed by suppliers for FY24."},
            {"id": "capex", "tooltip": "Gross capex — money spent to buy/build new factories, depots and machinery. Critical input to Free Cash Flow calculation: FCF = CFO − Capex."},
            {"id": "acquisition", "tooltip": "₹400 cr deployed for an inorganic acquisition. This is INVESTING cash flow but reflects strategic intent — track whether this acquisition shows up as new revenue / EBITDA in the next year's P&L."},
            {"id": "lt_drawn", "tooltip": "Gross debt DRAWN during the year. Important: net debt change = Drawn − Repaid. Looking at only one number gives a misleading picture."},
            {"id": "lt_repaid", "tooltip": "Gross debt REPAID during the year. Combined with proceeds, RangoorPaints' net long-term debt move was −₹300 cr (drew ₹500, repaid ₹800)."},
            {"id": "dividends_paid", "tooltip": "Cash returned to equity shareholders. Combined with any buyback (none here), this is the total shareholder payout — a key signal of management's capital allocation discipline."},
            {"id": "lease_paid", "tooltip": "Under Ind AS 116 lease repayments sit in CFF, not CFO. This is one reason 'CFO' under Ind AS is structurally HIGHER than under old GAAP — be careful with multi-year comparisons that span the standard change."},
        ],
        "tasks": [
            {
                "id": "t1_net_cfo",
                "question": "What is FY24 Net Cash Flow from Operating Activities (CFO)? Answer in ₹ cr.",
                "answer_type": "number",
                "expected_value": 4780,
                "tolerance": 5,
                "unit": "₹ cr",
                "explanation": (
                    "Net CFO = ₹4,780 cr (read directly from Section A's section total). "
                    "FY23 CFO was ₹4,150 cr → CFO grew 15.2% YoY. This is the single most important "
                    "number on the cash flow statement; everything in DCF starts here."
                ),
            },
            {
                "id": "t2_cash_conversion",
                "question": (
                    "Compute the cash-conversion ratio (CFO / PAT) for FY24. Round to two decimals."
                ),
                "answer_type": "number",
                "expected_value": 1.14,
                "tolerance": 0.03,
                "unit": "x",
                "explanation": (
                    "Cash Conversion = CFO / PAT = 4,780 / 4,200 = 1.14x. "
                    "Anything above 1.0 means CFO is HIGHER than reported PAT — usually a sign of healthy cash "
                    "earnings quality (the D&A add-back exceeds working-capital absorption). Persistent ratios "
                    "below 0.8x for several years are a serious red flag — the company books revenue / profit "
                    "but isn't collecting the cash."
                ),
            },
            {
                "id": "t3_fcf",
                "question": (
                    "Compute Free Cash Flow (FCF) for FY24. Use the standard analyst convention: FCF = CFO − "
                    "Gross Capex (purchase of PP&E only; ignore proceeds from sale and acquisitions for this view). "
                    "Answer in ₹ cr."
                ),
                "answer_type": "number",
                "expected_value": 2980,
                "tolerance": 10,
                "unit": "₹ cr",
                "explanation": (
                    "FCF = CFO − Capex = 4,780 − 1,800 = ₹2,980 cr. "
                    "This is the cash available AFTER the business has paid for its operating cash needs and reinvested "
                    "to maintain/grow capacity — i.e., the rupees genuinely free for shareholders, lenders and acquisitions. "
                    "DCF models discount FCF (technically FCFF or FCFE), not PAT, because only FCF reflects the real "
                    "economic cash a business produces."
                ),
            },
            {
                "id": "t4_da_addback_line",
                "question": (
                    "Which line in CFO captures the non-cash add-back representing wear-and-tear of the company's "
                    "fixed and intangible assets? Type the name (or abbreviation)."
                ),
                "answer_type": "text",
                "expected_keywords": ["depreciation", "d&a", "d & a", "amortisation"],
                "explanation": (
                    "Depreciation & Amortisation (D&A) — ₹1,200 cr in FY24. This is added BACK because it reduced PAT "
                    "but no cash actually left the company in the period. D&A is by far the largest non-cash "
                    "reconciliation item in most companies' cash flows — and a fast-rising D&A line is often the "
                    "first signal that capex is catching up with the business."
                ),
            },
            {
                "id": "t5_net_capex",
                "question": (
                    "Compute Net Capex for FY24 (Gross Capex minus Proceeds from sale of PP&E). Answer in ₹ cr."
                ),
                "answer_type": "number",
                "expected_value": 1750,
                "tolerance": 5,
                "unit": "₹ cr",
                "explanation": (
                    "Net Capex = 1,800 − 50 = ₹1,750 cr. "
                    "Net Capex is a slightly more conservative measure for sustaining-investment analysis. For DCF, "
                    "the convention varies — some analysts use gross capex, some use net. Pick a convention and apply "
                    "it consistently across peers so comps are comparable."
                ),
            },
            {
                "id": "t6_net_lt_debt",
                "question": (
                    "Compute the FY24 NET change in long-term borrowings (Proceeds − Repayment). A negative number means "
                    "net repayment. Answer in ₹ cr."
                ),
                "answer_type": "number",
                "expected_value": -300,
                "tolerance": 5,
                "unit": "₹ cr",
                "explanation": (
                    "Net long-term debt change = Drawn − Repaid = 500 − 800 = −₹300 cr (NET REPAYMENT). "
                    "Looking only at the proceeds line (₹500 cr) would have been misleading. Always net the two — "
                    "this is one of the most common rookie misreads on cash flow statements."
                ),
            },
            {
                "id": "t7_total_shareholder_payout",
                "question": (
                    "Compute total cash returned to equity shareholders during FY24. (No buyback occurred — only "
                    "dividends.) Answer in ₹ cr (positive number)."
                ),
                "answer_type": "number",
                "expected_value": 1400,
                "tolerance": 5,
                "unit": "₹ cr",
                "explanation": (
                    "Dividends Paid = ₹1,400 cr. Up from ₹1,100 cr in FY23 (+27%). Total payout / FCF = 1,400 / 2,980 = "
                    "47% — a healthy payout ratio. Some investors use dividend yield; the more rigorous metric is "
                    "Shareholder Payout Yield = (Dividends + Buyback) / Market Cap, because management can switch between "
                    "the two channels for tax-efficiency reasons."
                ),
            },
            {
                "id": "t8_wc_drag",
                "question": (
                    "Compute the NET working-capital change inside CFO for FY24. (Sum the five WC line items: "
                    "inventories, receivables, payables, other current assets, other current liabilities.) Negative = "
                    "WC absorbed cash. Answer in ₹ cr."
                ),
                "answer_type": "number",
                "expected_value": -370,
                "tolerance": 10,
                "unit": "₹ cr",
                "explanation": (
                    "Net WC change = (−800) + (−250) + 600 + (−120) + 200 = −₹370 cr (cash absorbed by WC build-up). "
                    "This is the gap between Operating Profit before WC (₹6,650 cr) and Cash from Operations (₹6,280 cr). "
                    "A growing business will almost always show NEGATIVE WC changes — that is normal. What you watch "
                    "for is when WC absorption grows FASTER than revenue (e.g., receivables ballooning), which signals "
                    "credit-stuffing or weakening collection."
                ),
            },
            {
                "id": "t9_acquisition_spend",
                "question": (
                    "How much cash did RangoorPaints deploy on inorganic growth (acquisitions) in FY24? Answer in ₹ cr (positive number)."
                ),
                "answer_type": "number",
                "expected_value": 400,
                "tolerance": 5,
                "unit": "₹ cr",
                "explanation": (
                    "Acquisition of subsidiary (net of cash acquired) = ₹400 cr. "
                    "FY23 had no acquisition spend, so this is a strategic departure. The next thing to check: did "
                    "this acquisition add EBITDA / revenue in the FY24 P&L? Management will usually disclose this in "
                    "the analyst presentation — track whether the implied acquisition multiple was reasonable."
                ),
            },
            {
                "id": "t10_closing_cash",
                "question": "What is the FY24 closing Cash & Cash Equivalents balance? Answer in ₹ cr.",
                "answer_type": "number",
                "expected_value": 1800,
                "tolerance": 5,
                "unit": "₹ cr",
                "explanation": (
                    "Closing Cash = Opening Cash + Net Change = 2,050 + (−250) = ₹1,800 cr. "
                    "Cash on the balance sheet went DOWN ₹250 cr despite ₹4,780 cr of CFO — most of it was redeployed "
                    "into capex, M&A, debt repayment, and dividends. This is the entire 'Sources and Uses' story in one "
                    "number — a healthy capital allocator returns excess cash, not hoards it."
                ),
            },
            {
                "id": "t11_fcf_yield_check",
                "question": (
                    "Quick analyst sanity check. The senior analyst tells you RangoorPaints' market cap is ₹70,000 cr. "
                    "Compute the FCF Yield (FY24 FCF / Market Cap), expressed in %, rounded to one decimal."
                ),
                "answer_type": "number",
                "expected_value": 4.3,
                "tolerance": 0.2,
                "unit": "%",
                "explanation": (
                    "FCF Yield = 2,980 / 70,000 × 100 = 4.3%. "
                    "FCF Yield is the inverse of P/FCF — a higher yield means a 'cheaper' stock on cash-flow terms. "
                    "Indian compounder paints/staples typically trade at 2–4% FCF yields (P/FCF 25–50x); 4.3% suggests "
                    "RangoorPaints is at the cheaper end of that range. Compare against the 10Y G-Sec yield (~7%) to "
                    "see why high-quality consumer stocks ALWAYS trade rich relative to bonds."
                ),
            },
            {
                "id": "t12_quality_view",
                "question": (
                    "Free-text — Write a 4–6 sentence Quality-of-Cash-Flow note. Cover: (a) cash conversion versus PAT, "
                    "(b) FCF and capital-allocation pattern (debt repayment, dividends, M&A), (c) any working-capital signal, "
                    "(d) overall verdict — does this company actually generate cash, and how well is management deploying it?"
                ),
                "answer_type": "free_text",
                "explanation": (
                    "There is no single 'right' answer — strong analyst notes are concise, cite numbers, and form a "
                    "clear capital-allocation view. See the sample for a model response."
                ),
                "sample_answer": (
                    "RangoorPaints' FY24 cash flow is high quality and consistent with a true compounder. Cash conversion "
                    "is 1.14x (CFO ₹4,780 cr vs PAT ₹4,200 cr), with the D&A add-back (₹1,200 cr) more than absorbing the "
                    "₹370 cr working-capital build-up — the small WC drag is consistent with growth and not a red flag.\n\n"
                    "Free Cash Flow of ₹2,980 cr (CFO − ₹1,800 cr capex) is robust and translates into a 4.3% FCF yield at "
                    "₹70,000 cr market cap — at the cheap end of the Indian decorative-paints peer range. Capital allocation "
                    "looks disciplined: the company net-repaid ₹300 cr of long-term debt, deployed ₹400 cr on inorganic "
                    "growth, and returned ₹1,400 cr (~47% of FCF) to shareholders via dividend — a textbook balanced mix.\n\n"
                    "I would only follow up on two things: (i) what EBITDA contribution the ₹400 cr acquisition is expected "
                    "to deliver in FY25, and (ii) whether the ₹800 cr inventory build-up is structural (new SKUs / new geographies) "
                    "or cyclical (over-stocking ahead of slowing demand).\n\n"
                    "Net-net: this is a genuinely cash-generative business with a management team that pays down debt, returns "
                    "cash, and reinvests for growth — exactly the pattern you want in a long-term hold."
                ),
            },
        ],
    },
}

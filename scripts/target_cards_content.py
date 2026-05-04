"""
Hand-authored content JSON for the three target formula cards.
Schema convention used (consistent with FormulaCard reader in NotesPage.jsx):
  Each formula in the `formulas` array carries:
    - name              (string)
    - formula           (string display)
    - variables         (array of {symbol, meaning})
    - plain_english     (string — intuition / what it tells you)
    - computation       (array of step strings — how to calculate it)
    - worked_example    (object with: problem, steps[], result, insight)
    - excel             (optional — preserved from original where helpful)
    - sensitivity_note  (optional)
    - analyst_note      (optional)
NO `excel_shortcuts` field at the top level (per user instruction for S6 and S12).
"""

# =====================================================================
# SESSION 2 — Risk & Return: keep ONLY HPR, Expected Return, Std Dev
# id=444fdbc8-ee54-4d36-bc6c-4155d36e23ce
# Remove Sharpe Ratio and CAPM entirely. Update title.
# =====================================================================
S2_TITLE = "Risk & Return Formulas: HPR, Expected Return, Standard Deviation"

S2_CONTENT = {
    "formulas": [
        {
            "name": "Holding Period Return (HPR)",
            "formula": "HPR = (Ending Value − Beginning Value + Income) / Beginning Value",
            "variables": [
                {"symbol": "HPR", "meaning": "Holding Period Return — the total percentage return earned over the time you held the asset"},
                {"symbol": "Beginning Value", "meaning": "Price you paid when you bought the asset (₹ per share or total ₹ invested)"},
                {"symbol": "Ending Value", "meaning": "Price at the end of the holding period (₹)"},
                {"symbol": "Income", "meaning": "Cash distributions received during the period — dividends on equities, coupons on bonds, interest on deposits"}
            ],
            "plain_english": "HPR captures the FULL return you earned on an investment — both the change in price (capital gain/loss) AND the cash you collected along the way (dividends or coupons). It is the most honest single number to describe how a held position performed, because it does not ignore income.",
            "computation": [
                "Step 1 — Note the price you paid when you opened the position (Beginning Value).",
                "Step 2 — Sum every cash distribution you received during the holding period (dividends + coupons + buy-back proceeds).",
                "Step 3 — Find the price today or on the day you sold (Ending Value).",
                "Step 4 — Compute the numerator: (Ending Value − Beginning Value) is the capital gain; add Income to get total profit in rupees.",
                "Step 5 — Divide that total profit by the Beginning Value, then multiply by 100 to express as a percentage."
            ],
            "worked_example": {
                "problem": "You buy Tata Motors at ₹620, hold for one year, receive a ₹8 dividend, and sell at ₹710.",
                "steps": [
                    "Capital gain = 710 − 620 = ₹90",
                    "Add income (dividend) = 90 + 8 = ₹98",
                    "HPR = 98 / 620 = 0.1581 = 15.81%"
                ],
                "result": "HPR = 15.81%",
                "insight": "Of the 15.81%, 14.52% came from price appreciation and 1.29% came from the dividend. Ignoring the dividend would have understated total return by ~130 bps — meaningful for high-yield names like ITC, Coal India, or Power Grid where dividends are 30–50% of total return."
            },
            "analyst_note": "Always include dividends in return calculations. Comparing two stocks on capital gain alone systematically penalises mature, dividend-paying businesses — a common rookie mistake."
        },
        {
            "name": "Expected Return — Probability-Weighted",
            "formula": "E(R) = Σ (Pᵢ × Rᵢ)",
            "variables": [
                {"symbol": "E(R)", "meaning": "Expected Return — the probability-weighted average return across all scenarios"},
                {"symbol": "Pᵢ", "meaning": "Probability of scenario i occurring (must be between 0 and 1; all probabilities sum to 1)"},
                {"symbol": "Rᵢ", "meaning": "Return that would be realised in scenario i (e.g., bull case +35%, bear case −15%)"},
                {"symbol": "Σ", "meaning": "Summation symbol — add up the (P × R) products across every scenario"}
            ],
            "plain_english": "Expected Return answers: 'If I could replay this investment thousands of times under the same set of probabilities, what return would I average?' It is the weighted-average return, not the most-likely return. A 30% chance of a huge win and a 70% chance of a small loss can still produce a positive expected return — that is the whole point.",
            "computation": [
                "Step 1 — List every distinct outcome you can foresee (bull, base, bear is the standard 3-scenario setup).",
                "Step 2 — Assign a probability to each scenario; double-check they sum to exactly 1.00 (= 100%).",
                "Step 3 — Estimate the return Rᵢ in each scenario (use research, history, peer comps, management guidance).",
                "Step 4 — For each scenario, multiply Pᵢ × Rᵢ.",
                "Step 5 — Add the products. The sum is E(R). In Excel: =SUMPRODUCT(probabilities, returns)."
            ],
            "worked_example": {
                "problem": "Zomato has three scenarios: Bull case (probability 30%, return +35%), Base case (50%, +12%), Bear case (20%, −15%).",
                "steps": [
                    "Bull contribution = 0.30 × 35% = 10.5%",
                    "Base contribution = 0.50 × 12% = 6.0%",
                    "Bear contribution = 0.20 × (−15%) = −3.0%",
                    "E(R) = 10.5% + 6.0% − 3.0% = 13.5%"
                ],
                "result": "E(R) = 13.5%",
                "insight": "13.5% is the number you carry forward into valuation work — it embeds your view of upside, base, and downside. If a peer trades at an implied 18% expected return, your idea is relatively rich; if 9%, it looks attractive."
            }
        },
        {
            "name": "Standard Deviation of Returns (Risk)",
            "formula": "σ = √[ Σ Pᵢ × (Rᵢ − E(R))² ]",
            "variables": [
                {"symbol": "σ", "meaning": "Standard Deviation — the volatility of returns; the conventional measure of risk"},
                {"symbol": "Pᵢ", "meaning": "Probability of scenario i"},
                {"symbol": "Rᵢ", "meaning": "Return in scenario i"},
                {"symbol": "E(R)", "meaning": "Expected (probability-weighted) return — the centre of the distribution"},
                {"symbol": "(Rᵢ − E(R))²", "meaning": "Squared deviation of scenario return from the expected return — squaring removes negatives so dispersion does not net to zero"}
            ],
            "plain_english": "Standard deviation measures how much returns BOUNCE around their expected value. A stock with σ = 5% behaves predictably; a stock with σ = 30% can deliver wild surprises in either direction. Two investments can have the same expected return yet very different standard deviations — and the lower-σ one is the safer bet.",
            "computation": [
                "Step 1 — Compute E(R) using the probability-weighted-average formula above.",
                "Step 2 — For each scenario i, compute the deviation (Rᵢ − E(R)).",
                "Step 3 — Square each deviation to remove negatives.",
                "Step 4 — Multiply each squared deviation by its probability Pᵢ.",
                "Step 5 — Sum the weighted squared deviations — this is the VARIANCE.",
                "Step 6 — Take the square root of variance. The result is the standard deviation σ. In Excel for historical data: =STDEV.S(range)."
            ],
            "worked_example": {
                "problem": "Continuing the Zomato example: E(R) = 13.5%. Compute σ from the three scenarios.",
                "steps": [
                    "Bull: 0.30 × (35 − 13.5)² = 0.30 × (21.5)² = 0.30 × 462.25 = 138.675",
                    "Base: 0.50 × (12 − 13.5)² = 0.50 × (−1.5)² = 0.50 × 2.25 = 1.125",
                    "Bear: 0.20 × (−15 − 13.5)² = 0.20 × (−28.5)² = 0.20 × 812.25 = 162.450",
                    "Variance = 138.675 + 1.125 + 162.450 = 302.25",
                    "σ = √302.25 = 17.39%"
                ],
                "result": "σ ≈ 17.4%",
                "insight": "Returns will plausibly land in a band of E(R) ± σ = 13.5% ± 17.4% (i.e., roughly −4% to +31%) about two-thirds of the time. That is a wide band, which is exactly what you would expect from a high-growth, still-profitless tech name."
            },
            "sensitivity_note": "If the bear-case probability rises from 20% to 30% (and base falls to 40%), E(R) drops to 11.5% AND σ rises to ~19%. Both metrics worsen together — a clear flag for the analyst."
        }
    ]
}

# =====================================================================
# SESSION 6 — Income Statement (HUL): add variables/meanings to every metric
# id=2a57ec87-50f8-4e92-8b9c-7e8f7840a730
# NO excel_shortcuts field.
# =====================================================================
S6_TITLE = "Income Statement Formulas and HUL Worked Example"

S6_CONTENT = {
    "formulas": [
        {
            "name": "Gross Profit",
            "formula": "Gross Profit = Revenue − COGS",
            "variables": [
                {"symbol": "Revenue", "meaning": "Top-line sales (also called Net Sales or Turnover) — total value of goods/services billed to customers in the period"},
                {"symbol": "COGS", "meaning": "Cost of Goods Sold — direct costs of producing what was sold (raw materials, direct labour, factory overheads tied to production)"}
            ],
            "plain_english": "Gross Profit is the rupees left after paying for the physical making of the product. It tells you how much room the business has to cover everything else — salaries, marketing, rent, R&D — before any operating profit is earned.",
            "computation": [
                "Step 1 — Pull Revenue from the top of the P&L (a.k.a. 'Sales' or 'Revenue from Operations').",
                "Step 2 — Pull COGS — sometimes labelled 'Cost of Materials Consumed' + 'Changes in Inventory' for manufacturers, or 'Cost of Services' for service firms.",
                "Step 3 — Subtract: Revenue − COGS = Gross Profit (in ₹ crore)."
            ],
            "worked_example": {
                "problem": "HUL FY-style: Revenue ₹60,580 cr, COGS ₹29,080 cr.",
                "steps": ["GP = 60,580 − 29,080 = ₹31,500 cr"],
                "result": "Gross Profit = ₹31,500 cr (52.0% of revenue)",
                "insight": "A 52% gross margin says HUL keeps ₹52 out of every ₹100 of sales after paying for raw materials — a hallmark of strong brands and pricing power."
            }
        },
        {
            "name": "Gross Margin %",
            "formula": "Gross Margin % = (Gross Profit / Revenue) × 100",
            "variables": [
                {"symbol": "Gross Profit", "meaning": "Revenue − COGS, computed in the previous step"},
                {"symbol": "Revenue", "meaning": "Top-line sales for the same period"}
            ],
            "plain_english": "Gross Margin % is the percentage version of Gross Profit. It strips out company size so a ₹600 cr business and a ₹60,000 cr business can be compared on equal footing. Higher gross margin generally signals pricing power, brand strength, or efficient sourcing.",
            "computation": [
                "Step 1 — Compute Gross Profit (Revenue − COGS).",
                "Step 2 — Divide by Revenue.",
                "Step 3 — Multiply by 100 to express as a percentage."
            ],
            "worked_example": {
                "problem": "HUL: GP ₹31,500 cr, Revenue ₹60,580 cr.",
                "steps": ["GM% = (31,500 / 60,580) × 100 = 52.0%"],
                "result": "Gross Margin = 52.0%",
                "insight": "Compare with Marico (~45%) and Britannia (~40%) — HUL leads peers, which is consistent with its premium FMCG portfolio."
            }
        },
        {
            "name": "EBITDA",
            "formula": "EBITDA = Revenue − COGS − OpEx (excluding D&A)",
            "variables": [
                {"symbol": "EBITDA", "meaning": "Earnings Before Interest, Tax, Depreciation & Amortisation — proxy for cash operating profit"},
                {"symbol": "Revenue", "meaning": "Top-line sales"},
                {"symbol": "COGS", "meaning": "Direct production costs"},
                {"symbol": "OpEx (excl. D&A)", "meaning": "All other operating expenses except non-cash D&A — employee costs, advertising, rent, freight, admin, other manufacturing overheads"},
                {"symbol": "D&A", "meaning": "Depreciation (on tangible assets) and Amortisation (on intangibles) — non-cash charges that reduce reported profit but do not represent actual cash outflow"}
            ],
            "plain_english": "EBITDA strips out the financing decision (interest), the government's cut (tax), and non-cash accounting charges (D&A). What is left is a clean read on operational cash generation — the metric most M&A bankers and credit analysts anchor to.",
            "computation": [
                "Step 1 — Start with Revenue.",
                "Step 2 — Subtract COGS to get Gross Profit.",
                "Step 3 — Subtract operating expenses (employee costs + other operating expenses) but DO NOT subtract D&A.",
                "Step 4 — The result is EBITDA. Verify by an alternative path: EBIT + D&A = EBITDA."
            ],
            "worked_example": {
                "problem": "HUL: Revenue ₹60,580 cr, COGS ₹29,080 cr, Employee Costs ₹4,200 cr, Other OpEx ₹13,800 cr.",
                "steps": [
                    "Gross Profit = 60,580 − 29,080 = 31,500",
                    "Less Employee Costs = 31,500 − 4,200 = 27,300",
                    "Less Other OpEx = 27,300 − 13,800 = ₹13,500 cr"
                ],
                "result": "EBITDA = ₹13,500 cr (22.3% of revenue)",
                "insight": "An EBITDA margin above 20% in FMCG is excellent — it means the brand commands enough premium to absorb advertising and distribution and still leave one-fifth of every rupee as cash operating profit."
            }
        },
        {
            "name": "EBITDA Margin %",
            "formula": "EBITDA Margin % = (EBITDA / Revenue) × 100",
            "variables": [
                {"symbol": "EBITDA", "meaning": "Earnings before interest, tax, depreciation & amortisation"},
                {"symbol": "Revenue", "meaning": "Top-line sales"}
            ],
            "plain_english": "Tells you how many rupees of cash operating profit the business squeezes out of every rupee of sales. It is the most-cited operational efficiency yardstick across sectors.",
            "computation": [
                "Step 1 — Compute EBITDA (formula above).",
                "Step 2 — Divide by Revenue.",
                "Step 3 — Multiply by 100."
            ],
            "worked_example": {
                "problem": "HUL: EBITDA ₹13,500 cr, Revenue ₹60,580 cr.",
                "steps": ["EBITDA Margin = (13,500 / 60,580) × 100 = 22.3%"],
                "result": "EBITDA Margin = 22.3%",
                "insight": "Track the YoY trend — a stable margin signals pricing discipline; a falling margin during input-cost spikes signals weak pass-through power."
            }
        },
        {
            "name": "EBIT (Operating Profit)",
            "formula": "EBIT = EBITDA − D&A",
            "variables": [
                {"symbol": "EBIT", "meaning": "Earnings Before Interest and Tax — also called Operating Profit"},
                {"symbol": "EBITDA", "meaning": "Cash operating profit (computed above)"},
                {"symbol": "D&A", "meaning": "Depreciation and amortisation expense charged against tangible and intangible assets"}
            ],
            "plain_english": "EBIT is what the core business actually earns AFTER recognising the wear-and-tear of the assets it uses. Unlike EBITDA, it does not flatter capital-heavy businesses — that is why ROCE and Interest Coverage are built on EBIT, not EBITDA.",
            "computation": [
                "Step 1 — Take EBITDA.",
                "Step 2 — Find Depreciation & Amortisation in the P&L (often a single line item).",
                "Step 3 — Subtract D&A from EBITDA. The result is EBIT."
            ],
            "worked_example": {
                "problem": "HUL: EBITDA ₹13,500 cr, D&A ₹1,200 cr.",
                "steps": ["EBIT = 13,500 − 1,200 = ₹12,300 cr"],
                "result": "EBIT = ₹12,300 cr (20.3% of revenue)",
                "insight": "The ₹1,200 cr D&A reflects amortisation of brand acquisitions plus depreciation of factories — a real economic cost the business must replenish."
            }
        },
        {
            "name": "Operating Margin % (EBIT Margin)",
            "formula": "Operating Margin % = (EBIT / Revenue) × 100",
            "variables": [
                {"symbol": "EBIT", "meaning": "Operating profit (after D&A, before interest and tax)"},
                {"symbol": "Revenue", "meaning": "Top-line sales"}
            ],
            "plain_english": "Operating Margin shows how profitable the CORE business is after recognising depreciation. Unlike EBITDA margin, this metric will not let a capital-intensive business hide behind non-cash charges.",
            "computation": [
                "Step 1 — Compute EBIT.",
                "Step 2 — Divide by Revenue.",
                "Step 3 — Multiply by 100."
            ],
            "worked_example": {
                "problem": "HUL: EBIT ₹12,300 cr, Revenue ₹60,580 cr.",
                "steps": ["Op Margin = (12,300 / 60,580) × 100 = 20.3%"],
                "result": "Operating Margin = 20.3%",
                "insight": "A 20%+ operating margin in consumer staples is exceptional — comparable peers like Nestle India sit at ~22%, while Britannia sits at ~16%."
            }
        },
        {
            "name": "EBT (Profit Before Tax)",
            "formula": "EBT = EBIT − Interest + Other Income",
            "variables": [
                {"symbol": "EBT", "meaning": "Earnings Before Tax — also called Profit Before Tax (PBT)"},
                {"symbol": "EBIT", "meaning": "Operating profit"},
                {"symbol": "Interest", "meaning": "Net finance cost — interest paid on borrowings minus interest earned on deposits (some firms report gross)"},
                {"symbol": "Other Income", "meaning": "Non-operating income — investment income, gain on sale of assets, dividend received from subsidiaries, FX gains"}
            ],
            "plain_english": "EBT is the profit the company is taxed on. It captures the financing decision (interest cost) and any non-operating gains/losses, but excludes the tax line itself.",
            "computation": [
                "Step 1 — Start with EBIT.",
                "Step 2 — Subtract Interest expense (or 'Finance Costs').",
                "Step 3 — Add Other Income (a separate P&L line).",
                "Step 4 — The result is EBT (a.k.a. PBT)."
            ],
            "worked_example": {
                "problem": "HUL: EBIT ₹12,300 cr, Interest ₹200 cr, Other Income ₹800 cr.",
                "steps": ["EBT = 12,300 − 200 + 800 = ₹12,900 cr"],
                "result": "EBT = ₹12,900 cr",
                "insight": "Notice Other Income (₹800 cr) is more than 6x Interest (₹200 cr) — typical of cash-rich FMCG firms that earn meaningful treasury income on their float."
            }
        },
        {
            "name": "Net Profit (PAT)",
            "formula": "Net Profit = EBT − Tax",
            "variables": [
                {"symbol": "PAT", "meaning": "Profit After Tax — also called Net Profit, Net Income, or 'bottom line'"},
                {"symbol": "EBT", "meaning": "Profit before tax"},
                {"symbol": "Tax", "meaning": "Total tax expense — current tax + deferred tax — as recognised in the P&L"}
            ],
            "plain_english": "PAT is the rupees left for shareholders after every cost — production, operations, depreciation, interest, tax. It is the number that flows into EPS and ultimately drives dividend capacity and retained earnings.",
            "computation": [
                "Step 1 — Take EBT.",
                "Step 2 — Pull Tax Expense from the P&L (sum of current tax + deferred tax).",
                "Step 3 — Subtract: PAT = EBT − Tax."
            ],
            "worked_example": {
                "problem": "HUL: EBT ₹12,900 cr, Tax ₹3,225 cr (effective tax rate ~25%).",
                "steps": ["PAT = 12,900 − 3,225 = ₹9,675 cr"],
                "result": "PAT = ₹9,675 cr (16.0% of revenue)",
                "insight": "₹9,675 cr is the pool from which dividends are paid and reserves are built. A 16% net margin means HUL converts ₹16 of every ₹100 of sales into rupees that genuinely belong to shareholders."
            }
        },
        {
            "name": "Net Margin %",
            "formula": "Net Margin % = (PAT / Revenue) × 100",
            "variables": [
                {"symbol": "PAT", "meaning": "Profit After Tax (Net Profit)"},
                {"symbol": "Revenue", "meaning": "Top-line sales"}
            ],
            "plain_english": "Net Margin tells you what fraction of every sales rupee finally lands in shareholders' pockets — after EVERY cost. Unlike Gross or EBITDA margin, net margin is the only one that reflects the full cost of doing business.",
            "computation": [
                "Step 1 — Compute PAT.",
                "Step 2 — Divide by Revenue.",
                "Step 3 — Multiply by 100."
            ],
            "worked_example": {
                "problem": "HUL: PAT ₹9,675 cr, Revenue ₹60,580 cr.",
                "steps": ["Net Margin = (9,675 / 60,580) × 100 = 16.0%"],
                "result": "Net Margin = 16.0%",
                "insight": "Beware comparing net margins across sectors — a 16% net margin is great for FMCG but mediocre for software, where net margins of 20–25% are common (TCS, Infosys)."
            }
        },
        {
            "name": "EPS (Earnings Per Share)",
            "formula": "EPS = PAT / Weighted-Average Shares Outstanding",
            "variables": [
                {"symbol": "EPS", "meaning": "Earnings Per Share — net profit attributable to one equity share"},
                {"symbol": "PAT", "meaning": "Profit after tax"},
                {"symbol": "Weighted-Average Shares Outstanding", "meaning": "Average number of equity shares outstanding during the period, weighted by the duration each lot was outstanding (reported in the notes)"}
            ],
            "plain_english": "EPS converts the company's total profit into a per-share number so investors can compare it directly against the share price (P/E ratio = Price / EPS). Even if profit grows, EPS can fall when the company issues new shares — that is dilution.",
            "computation": [
                "Step 1 — Take PAT for the period.",
                "Step 2 — Use Weighted-Average Shares from the notes (NOT just year-end share count) to handle buy-backs and issuances during the year.",
                "Step 3 — Divide PAT by the share count.",
                "Step 4 — For Diluted EPS, add the dilutive effect of ESOPs and convertibles to the share count denominator."
            ],
            "worked_example": {
                "problem": "HUL: PAT ₹9,675 cr, Weighted-Average Shares Outstanding ≈ 235 cr.",
                "steps": ["EPS = 9,675 / 235 = ₹41.2 per share"],
                "result": "EPS = ₹41.2",
                "insight": "If HUL trades at ₹2,500, P/E = 2,500 / 41.2 ≈ 60.7x — premium multiple reflecting its quality, but also its sensitivity to even small earnings disappointments."
            }
        },
        {
            "name": "Effective Tax Rate",
            "formula": "Effective Tax Rate % = (Tax Expense / EBT) × 100",
            "variables": [
                {"symbol": "Tax Expense", "meaning": "Total tax recognised in the P&L (current + deferred)"},
                {"symbol": "EBT", "meaning": "Earnings Before Tax (Profit Before Tax)"}
            ],
            "plain_english": "Effective Tax Rate is the actual % of pre-tax profit handed over as tax. It is almost always different from the statutory rate because of tax holidays, deferred tax adjustments, foreign-income mix, and tax incentives. A wide and persistent gap from the statutory rate is worth investigating.",
            "computation": [
                "Step 1 — Pull Tax Expense from the P&L.",
                "Step 2 — Divide by EBT.",
                "Step 3 — Multiply by 100. Compare against the Indian statutory rate (~25.17% for most domestic companies under the new regime)."
            ],
            "worked_example": {
                "problem": "HUL: Tax ₹3,225 cr, EBT ₹12,900 cr.",
                "steps": ["ETR = (3,225 / 12,900) × 100 = 25.0%"],
                "result": "Effective Tax Rate = 25.0%",
                "insight": "An ETR of 25% lines up almost exactly with the statutory rate — a sign of clean, mainstream Indian operations. Persistent ETRs of 18–20% (e.g., some IT firms with SEZ benefits) flag a dependency on tax incentives that may roll off."
            }
        }
    ],
    "worked_example": {
        "company": "Hindustan Unilever (HUL) — Simplified illustrative numbers",
        "data": {
            "Revenue": "60,580 cr",
            "COGS": "29,080 cr",
            "Gross_Profit": "31,500 cr (52.0%)",
            "Employee_Costs": "4,200 cr",
            "Other_OpEx": "13,800 cr",
            "EBITDA": "13,500 cr (22.3%)",
            "DA": "1,200 cr",
            "EBIT": "12,300 cr (20.3%)",
            "Interest": "200 cr",
            "Other_Income": "800 cr",
            "EBT": "12,900 cr",
            "Tax": "3,225 cr (25%)",
            "PAT": "9,675 cr (16.0%)"
        },
        "sensitivity": "If COGS rises 5% while revenue stays flat, gross profit drops by ~4.6%. Because most OpEx is fixed in the short term, that drop falls almost entirely through to EBITDA — that is operating leverage in action."
    }
}

# =====================================================================
# SESSION 12 (M10 S4) — Yield Curve Formulas: full rewrite
# id=c0ff08d9-9381-412e-a4a6-d64b10e27bba
# Comprehensive variables, plain-English, computation, worked example
# for each of the 5 formulas. NO excel_shortcuts field.
# =====================================================================
S12_TITLE = "The Yield Curve Formulas — Spreads, Real Rates, and DCF Sensitivity"

S12_CONTENT = {
    "formulas": [
        {
            "name": "Term Spread (10Y − 2Y)",
            "formula": "Term Spread (bps) = [10-Year Yield (%) − 2-Year Yield (%)] × 100",
            "variables": [
                {"symbol": "10-Year Yield", "meaning": "Yield-to-maturity on the on-the-run 10-year government bond, in % per annum (India: 10Y G-Sec; US: 10Y UST)"},
                {"symbol": "2-Year Yield", "meaning": "YTM on the 2-year government bond — heavily influenced by current and near-term policy-rate expectations"},
                {"symbol": "Term Spread", "meaning": "The 'slope' of the yield curve between the 2-year and 10-year tenors, expressed in basis points (1% = 100 bps)"},
                {"symbol": "bps", "meaning": "Basis points — 1 bp = 0.01% (one-hundredth of a percent), the convention used for fixed-income spreads"}
            ],
            "plain_english": "The Term Spread captures whether long-term borrowers must pay MORE than short-term borrowers (a 'normal' or upward-sloping curve) or LESS (an 'inverted' curve). A wide positive spread reflects optimism about growth and inflation; a narrow or negative spread reflects expectations of slowdown or imminent rate cuts. It is the single most-watched curve metric on every macro desk.",
            "computation": [
                "Step 1 — Pull the 10Y benchmark yield from the central bank or a market data terminal (India: RBI website / NSE; US: Treasury).",
                "Step 2 — Pull the 2Y benchmark yield from the same source on the same date.",
                "Step 3 — Subtract: 10Y − 2Y, expressed in % points.",
                "Step 4 — Multiply by 100 to convert to basis points (more precise for tracking small changes)."
            ],
            "worked_example": {
                "problem": "Indian G-Sec, mid-2024: 10Y yield = 7.10%; 2Y yield = 7.05%.",
                "steps": [
                    "Difference in % = 7.10 − 7.05 = 0.05%",
                    "Convert to bps = 0.05 × 100 = 5 bps"
                ],
                "result": "Term Spread = +5 bps",
                "insight": "5 bps is an extremely flat curve — far below India's historical normal of 70–120 bps. Either markets expect a sharp slowdown in coming quarters OR they expect imminent rate cuts that will pull the entire curve down. In the US in July 2023 the same calculation gave 3.95 − 5.04 = −109 bps — a deep inversion."
            },
            "sensitivity_note": "Above 100 bps = healthy growth expectations. 50–100 bps = normal. 0–50 bps = flattening warning. Below 0 = inversion. India has rarely inverted, but flattening below 30 bps has preceded every Indian growth slowdown of the last 20 years."
        },
        {
            "name": "Recession Probability from 10Y − 3M Spread",
            "formula": "P(Recession in next 12M) ≈ N(α + β × Spread_bps)",
            "variables": [
                {"symbol": "Spread_bps", "meaning": "10-Year yield minus 3-Month T-Bill yield, expressed in basis points"},
                {"symbol": "10Y Yield", "meaning": "Yield on the 10-year benchmark government bond"},
                {"symbol": "3M T-Bill Yield", "meaning": "Yield on the 3-month government Treasury bill — a near-perfect proxy for the current policy rate"},
                {"symbol": "α (alpha)", "meaning": "Empirically fitted intercept (Fed model: ≈ −0.5)"},
                {"symbol": "β (beta)", "meaning": "Empirically fitted slope coefficient (Fed model: ≈ −0.025)"},
                {"symbol": "N(·)", "meaning": "Standard cumulative normal distribution function — converts the linear score into a probability between 0% and 100%"},
                {"symbol": "P(Recession)", "meaning": "Estimated probability of an official recession beginning within the next 12 months"}
            ],
            "plain_english": "When the 3-month rate rises ABOVE the 10-year yield (negative spread), markets are saying 'short-term rates are too restrictive — a slowdown is coming and the central bank will be forced to cut.' Empirically, every US recession since 1969 has been preceded by such an inversion. The 10Y−3M spread (not 10Y−2Y) is the Fed's preferred recession indicator because the 3M leg is anchored to current policy, not to forecasts.",
            "computation": [
                "Step 1 — Pull 10Y and 3M yields from the same date.",
                "Step 2 — Compute Spread = (10Y − 3M) × 100, in bps. Note the SIGN — inversions are negative.",
                "Step 3 — In daily practice, analysts skip the formal N(·) and use the empirical lookup table below.",
                "Step 4 — For more rigour, the Fed's NY Fed model exposes monthly probabilities — search 'NY Fed Recession Probability'."
            ],
            "worked_example": {
                "problem": "US Treasury, July 2023: 10Y = 3.95%, 3M = 5.55% → Spread = (3.95 − 5.55) × 100 = −160 bps.",
                "steps": [
                    "Apply the Fed empirical lookup table:",
                    "Spread +200 bps → ~5%   |  Spread +100 bps → ~8%",
                    "Spread     0 bps → ~15% |  Spread  −50 bps → ~25%",
                    "Spread −100 bps → ~38% |  Spread −200 bps → ~70%",
                    "−160 bps is between −100 and −200 → interpolate ≈ 50% recession probability"
                ],
                "result": "P(Recession in next 12M) ≈ 50%",
                "insight": "A 50% recession probability over 12 months is a very loud warning. Even though the US recession had not yet materialised by mid-2024, this remains one of the most-watched curve signals in modern macro. India equivalent: 10Y−3M rarely goes below 50 bps, but when it does (briefly in late 2018), GDP growth typically slowed by 100–150 bps over the next 4 quarters."
            },
            "sensitivity_note": "The 10Y−3M spread is statistically the strongest recession predictor according to NY Fed research. Use 10Y−3M for recession calls; 10Y−2Y for shorter-term tactical positioning."
        },
        {
            "name": "Real Yield (Inflation-Adjusted Return)",
            "formula": "Real Yield (%) ≈ Nominal Yield (%) − Expected Inflation (%)",
            "variables": [
                {"symbol": "Nominal Yield", "meaning": "Yield on a conventional (non-inflation-linked) bond, expressed in % per annum — what the bond will actually pay you in rupees or dollars"},
                {"symbol": "Expected Inflation", "meaning": "Forward-looking inflation expectation over the same horizon as the bond — typically estimated from RBI forecasts, consensus surveys, or the breakeven implied by inflation-linked bonds"},
                {"symbol": "Real Yield", "meaning": "The yield AFTER subtracting inflation — i.e., the return in terms of actual purchasing power. A positive real yield means your money grows in real terms; negative means inflation erodes it."}
            ],
            "plain_english": "The nominal yield is what a bond promises in cash terms. But if inflation runs at 5% and your bond pays 7%, your actual purchasing power grows only 2%. Real yield is the number that drives equity valuations, capex decisions, and currency flows — not the headline nominal yield.",
            "computation": [
                "Step 1 — Pull the nominal yield on the relevant tenor (e.g., 10Y G-Sec).",
                "Step 2 — Source expected inflation for the same horizon — RBI 5-year inflation expectation, consensus CPI forecast, or breakeven implied by Inflation-Indexed Bonds.",
                "Step 3 — Subtract: Nominal − Expected Inflation. The result is an APPROXIMATE real yield (the exact Fisher formula uses (1 + nominal)/(1 + inflation) − 1, but the simple subtraction is accurate within ~10–20 bps at low rates).",
                "Step 4 — Track monthly — large monthly swings flag regime changes for equity multiples."
            ],
            "worked_example": {
                "problem": "Indian 10Y G-Sec mid-2024: Nominal yield = 7.10%; RBI 5-year expected CPI = 4.5%.",
                "steps": [
                    "Real Yield ≈ 7.10 − 4.5 = 2.60%"
                ],
                "result": "Real 10Y Yield ≈ 2.60%",
                "insight": "A 2.60% real yield is close to the long-term Indian average. ABOVE 3% is restrictive — equity multiples compress, growth stocks underperform. BELOW 1% is stimulative — multiples expand, growth stocks outperform. For comparison, US 10Y real yield (TIPS-implied) was ~2.0% in mid-2024 — the highest sustained level since 2008, which is precisely why US growth/tech struggled relative to value through 2022–23."
            },
            "sensitivity_note": "Real yields are the actual driver of equity valuations, not nominal yields. A nominal yield drop from 7.5% to 7.0% combined with inflation rising from 4.5% to 5.0% means real yield went from 3.0% to 2.0% — meaningful equity tailwind even though nominal rates fell only modestly."
        },
        {
            "name": "Equity DCF Sensitivity to a 100 bps Yield Move",
            "formula": "Δ Fair Value (%) ≈ −Effective Equity Duration × Δ Discount Rate (in % points)",
            "variables": [
                {"symbol": "Δ Fair Value", "meaning": "Estimated percentage change in DCF-based fair value of the equity"},
                {"symbol": "Effective Equity Duration", "meaning": "The weighted-average time at which a stock's discounted cash flows are received — longer for high-growth, low-current-cash-flow names; shorter for mature dividend payers"},
                {"symbol": "Δ Discount Rate", "meaning": "Change in the cost of equity (or WACC) being used in the DCF — typically moves with the long-end government yield, often with a partial pass-through of 70–100%"},
                {"symbol": "Negative sign", "meaning": "Fair value moves OPPOSITE to discount rate — when rates rise, DCF value falls"}
            ],
            "plain_english": "A 100 bps move in long-end yields hits different stocks differently. Mature dividend payers (ITC, Coca-Cola) lose maybe 12–15% because most of their value comes from cash flows in the next 10–15 years. Loss-making hyper-growth names (Zomato in early years, Nykaa, Snowflake) can lose 30–40% because almost all their value sits 15+ years out and is discounted by many doublings. This is the mechanical reason high-multiple growth crashed in 2022.",
            "computation": [
                "Step 1 — Estimate effective equity duration. Quick rules of thumb:",
                "  • Long-duration government bond benchmark: ~7–8 years",
                "  • Mature value/dividend stock (ITC, HUL, utilities): 12–15 years",
                "  • Quality compounder (Bajaj Finance, Asian Paints in growth phase): 18–25 years",
                "  • High-growth tech / disruptive (Nykaa, Zomato, PolicyBazaar): 30–40 years",
                "Step 2 — Estimate the change in discount rate (typically 70–100% of the change in 10Y yield).",
                "Step 3 — Multiply: Δ Fair Value (%) ≈ −Duration × Δ Discount Rate (in % points).",
                "Step 4 — Sense-check by re-running the actual DCF; this approximation is most accurate for moves under 200 bps."
            ],
            "worked_example": {
                "problem": "10Y G-Sec rises 100 bps (1.00%). Estimate fair-value impact for three Indian names: ITC (mature dividend), Asian Paints (compounder), Nykaa (high-growth).",
                "steps": [
                    "Assume 100% pass-through to discount rate → Δ Discount Rate = +1.00%",
                    "ITC duration ≈ 13 years → Δ Fair Value ≈ −13 × 1.00 = −13%",
                    "Asian Paints duration ≈ 22 years → Δ Fair Value ≈ −22 × 1.00 = −22%",
                    "Nykaa duration ≈ 35 years → Δ Fair Value ≈ −35 × 1.00 = −35%"
                ],
                "result": "ITC ≈ −13% | Asian Paints ≈ −22% | Nykaa ≈ −35%",
                "insight": "This matches what we observed empirically: when US 10Y rose ~200 bps from near-zero in 2022, high-multiple growth stocks fell 30–50% while mature dividend payers were down only 5–15%. Equity duration is rarely calculated explicitly but is one of the most useful mental models for rate-sensitivity calls."
            },
            "sensitivity_note": "Stocks with most cash flow in the distant future are most rate-sensitive. Stocks with most cash flow today are least rate-sensitive. Position-size accordingly when forming a rate view."
        },
        {
            "name": "OIS-Implied Forward Rate (Future Policy-Rate Path)",
            "formula": "Forward Rate ≈ [(1 + Long-Tenor OIS)^T_long / (1 + Short-Tenor OIS)^T_short]^(1 / (T_long − T_short)) − 1",
            "variables": [
                {"symbol": "OIS", "meaning": "Overnight Index Swap — a derivative that exchanges fixed for the compounded overnight policy-anchored rate (in India: MIBOR-OIS); its rate is the cleanest market read on expected average policy rate over the swap's tenor"},
                {"symbol": "Long-Tenor OIS", "meaning": "The OIS rate for the longer maturity (e.g., 1-year OIS = 6.95%)"},
                {"symbol": "Short-Tenor OIS", "meaning": "The OIS rate for the shorter maturity (e.g., 6-month OIS = 6.85%)"},
                {"symbol": "T_long, T_short", "meaning": "Tenors of the two swaps in years (e.g., 1.0 and 0.5)"},
                {"symbol": "Forward Rate", "meaning": "The market-implied policy rate that will prevail BETWEEN T_short and T_long (e.g., the 6m–12m forward rate)"}
            ],
            "plain_english": "Spot OIS rates tell you what AVERAGE policy rate the market expects over the next N months. The FORWARD rate, derived from two OIS rates, isolates what the market expects ONLY in the gap between them — a cleaner read on the timing of cuts/hikes. If the 6m–12m forward sits BELOW the current policy rate, markets are pricing rate CUTS in the second half of the year.",
            "computation": [
                "Step 1 — Pull two OIS rates from the curve (e.g., 6m and 12m OIS) — Bloomberg, Refinitiv, or NSE OIS curve.",
                "Step 2 — Convert tenors to fractions of a year (T_short = 0.5, T_long = 1.0).",
                "Step 3 — Apply the forward formula above. For short tenors, a quick linear approximation works: Forward ≈ [(Long × T_long) − (Short × T_short)] / (T_long − T_short).",
                "Step 4 — Compare the forward rate against the current policy repo rate. Forward < Repo ⇒ market pricing cuts. Forward > Repo ⇒ pricing hikes. Forward ≈ Repo ⇒ pricing 'on hold'."
            ],
            "worked_example": {
                "problem": "Indian OIS, mid-2024 (illustrative): 6-month OIS = 6.85%; 12-month OIS = 6.95%. Current RBI repo rate = 6.50%. What is the 6m–12m forward and what does it imply?",
                "steps": [
                    "Use the linear approximation:",
                    "Forward ≈ [(0.0695 × 1.0) − (0.0685 × 0.5)] / (1.0 − 0.5)",
                    "Forward ≈ [0.0695 − 0.03425] / 0.5",
                    "Forward ≈ 0.03525 / 0.5 = 0.0705 = 7.05%"
                ],
                "result": "6m–12m Forward Rate ≈ 7.05%",
                "insight": "A forward rate ABOVE the spot 12m OIS and ABOVE the current repo rate (6.50%) is unusual — it implies the market expects a small rate HIKE in H2, OR more likely it reflects a liquidity/term premium rather than directional view. In a clean cut-priced curve, the 6m–12m forward would sit below the current repo. The skill is reading whether the market is pricing direction, term premium, or both."
            },
            "sensitivity_note": "Cross-check OIS-implied forwards against RBI minutes, governor commentary, and consensus. When markets price something different from the central bank's signalled path, that gap is itself a tradable view (long bonds if you agree with markets, short if you side with the RBI)."
        }
    ]
}

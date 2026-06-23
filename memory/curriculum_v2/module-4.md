# MODULE 4: FINANCIAL MODELLING — FROM SCRATCH TO 3-STATEMENT

> **Tagline:** First understand the three statements like your own pocket money. Then build a simple model that balances. Then build the real thing — schedules, scenarios and all. Basics first, always.

**Learning Outcome:** After this module, you can read all three financial statements line by line, explain exactly how they connect (including the famous "₹10 of depreciation" interview walk), build a simple three-statement model that balances, and then scale up to a full professional model of a real Indian company — driver-based revenue, working capital, capex-depreciation and debt schedules, a balance sheet that balances by construction, Bull/Base/Bear scenarios on one dropdown, and sensitivity tables. You'll be ready for valuation in Module 12 and for timed model tests in real interviews.

**Number of Sessions:** 10

| # | Session Title | What It Covers |
|---|---------------|----------------|
| 4.1 | What Is a Financial Model — and the P&L, Line by Line | What a model actually is, why analysts build them, every P&L line explained simply, margins, the five profits |
| 4.2 | The Balance Sheet & Cash Flow Statement, Line by Line | A = L + E, every balance sheet line, why profit ≠ cash, the three cash flow sections, reserves vs cash |
| 4.3 | How the Three Statements Connect — The ₹10 Walk | The three links, the depreciation walk-through, the ₹100 capex walk, why capex never hits the P&L directly |
| 4.4 | Your First Three-Statement Model — Simple, Complete, Balanced | A small model built end-to-end on one sheet: forecast P&L → balance sheet → cash flow → watch it balance |
| 4.5 | Going Pro — Model Architecture & Spreading Historicals | Inputs/Engine/Outputs, date spine, A/E flags, loading 5 years from filings, consolidated vs standalone, tie-outs |
| 4.6 | Forecasting the P&L — Revenue Drivers & Cost Builds | Driver trees, the D-Mart store build, price × volume, % of revenue costs, operating leverage, tax, EPS |
| 4.7 | The Working Capital Schedule — Where Growth Eats Cash | Receivables, inventory, payables, DSO/DIO/DPO, the cash conversion cycle, D-Mart's negative working capital |
| 4.8 | Capex, Depreciation & Debt Schedules — plus Circularity, Gently | Gross block roll-forward, the depreciation waterfall, debt schedule, interest, and the famous circular reference |
| 4.9 | Linking It All — Balance Sheet, Cash Flow & the Balance Check | Assembling the full model, retained earnings, cash closing the loop, the balance check, debugging when it breaks |
| 4.10 | Scenarios, Sensitivity & Shipping the Model | The Bull/Base/Bear dropdown switch, Data Tables, the output page, error checks, free cash flow, model tests |

---

# SESSION 4.1: What Is a Financial Model — and the P&L, Line by Line

> "You can't model what you can't read. So before any Excel, we learn to read a P&L the way an analyst does — line by line, top to bottom, with zero fear."

---

## NOTES

## 🎣 HOOK: "You Already Run Three Financial Statements"

Imagine you run a dosa stall. Without knowing any finance, you already track three things.

One: a sales diary. "Sold ₹4,000 today, batter and gas cost ₹1,500, helper's wage ₹500. Made ₹2,000." That's a **P&L** — what you earned and spent over a period.

Two: a mental list of what you own and owe. "The tawa and cart are worth ₹40,000. I still owe the supplier ₹5,000." That's a **balance sheet** — a photo of your position right now.

Three: the cash box. "Started the day with ₹2,000, ended with ₹3,800." That's a **cash flow statement** — where the money actually moved.

Titan, Reliance and Zomato track exactly these same three things. The statements are just bigger and wear formal names. And a **financial model**? It's simply this: writing next year's version of all three statements in Excel — before next year happens. That's the whole game. Read the statements first; forecasting them comes after.

🧠 Remember: P&L = the diary, balance sheet = the photo, cash flow = the cash box. A model is next year's version of all three, written today.

---

## 💡 CONCEPT: "What a Financial Model Actually Is"

A financial model is **a linked Excel workbook that takes a company's past, adds your assumptions, and produces its future financial statements.**

Three parts of that sentence matter:

- **The past:** 4–5 years of real, filed numbers. The foundation.
- **Your assumptions:** "Revenue grows 12%." "Margins stay at 8%." These are *your* opinions, typed in blue.
- **Linked:** change one assumption, and everything downstream updates automatically. This is why you drilled Module 3 — the links are formulas.

Why do analysts build them? Because every big number in finance comes out of one. A broker's "target price ₹4,150" — from a model. An IPO price band — from a model. A bank deciding whether to lend ₹500 crore — from a model. The model is where opinions about the future become numbers you can argue about.

One naming note: the basic version — forecasting the P&L, balance sheet and cash flow together — is called a **three-statement model**. It's the foundation. Fancier models (DCF valuation in Module 12, and others) are built *on top* of a three-statement model. Master this one, and the rest are extensions.

🧠 Remember: Past numbers + your assumptions + Excel links = future statements. Every target price you've ever seen came out of exactly this.

---

## 🔬 DEEP DIVE: "The P&L, Line by Line — Top to Bottom"

Here is a simple P&L for an imaginary retailer, **Sharma Retail Ltd**, FY25. Round numbers, real structure — this is the same shape you'll see in Titan's or D-Mart's annual report. Read it top to bottom with me.

| Line | ₹ cr | What it means |
|------|------|---------------|
| Revenue from operations | 1,000 | Money from actually selling things — the business itself |
| Other income | 20 | Side money — interest on deposits, one-off gains. NOT the business |
| **Total income** | 1,020 | The two above, added |
| Cost of goods sold (COGS) | 600 | What the things you sold cost you to buy or make |
| **Gross profit** | 400 | Revenue minus COGS — profit before running costs |
| Employee costs | 90 | Salaries |
| Other expenses | 150 | Rent, electricity, marketing, freight — the long tail |
| **EBITDA** | 180 | Earnings Before Interest, Tax, Depreciation & Amortisation |
| Depreciation & amortisation | 50 | Assets wearing out — a cost, but no cash leaves (more in 4.3) |
| **EBIT** | 130 | Operating profit — what the business earns before financing |
| Finance costs (interest) | 30 | The cost of borrowed money |
| **PBT** | 100 | Profit before tax |
| Tax | 25 | The government's share |
| **PAT** | 75 | Profit after tax — the bottom line, the owners' profit |
| EPS | ₹7.5 | PAT ÷ number of shares (here, 10 crore shares) |

Now the part that makes this a *modelling* lesson, not just accounting. Beside each line, a modeller asks: **"How will I forecast this?"** Here's the cheat sheet for the whole module:

- **Revenue** → forecast with drivers (Session 4.6). The most important line.
- **COGS, employee costs, other expenses** → usually as a % of revenue, anchored to history (4.6).
- **Depreciation** → comes from the capex schedule (4.8). Never just "grow it 10%."
- **Interest** → comes from the debt schedule (4.8).
- **Tax** → a rate applied to PBT (4.6).
- **Other income** → kept separate, forecast gently — it's not the business.

Notice something? Two lines — depreciation and interest — can't be forecast inside the P&L at all. They need their own mini-sheets, called **schedules**. That single observation is why this module has Sessions 4.7 and 4.8. The P&L just told you the module's structure.

🧠 Remember: Read top to bottom: Revenue → Gross profit → EBITDA → EBIT → PBT → PAT → EPS. Depreciation and interest come from schedules — the P&L can't forecast them alone.

---

## 🔢 FORMULA: "The Margin Family — Profit as a Percentage"

Formula: `Margin = Profit ÷ Revenue from operations`

| Margin | Formula | Sharma Retail |
|--------|---------|---------------|
| Gross margin | Gross profit ÷ Revenue | 400/1,000 = **40%** |
| EBITDA margin | EBITDA ÷ Revenue | 180/1,000 = **18%** |
| Net margin | PAT ÷ Revenue | 75/1,000 = **7.5%** |

Why bother converting to percentages? Because **crores can't be compared, percentages can.** Sharma Retail's ₹180 cr EBITDA versus D-Mart's thousands of crores tells you nothing — D-Mart is just bigger. But 18% EBITDA margin versus another retailer's 8%? Now you're learning something: who keeps more of every rupee sold.

Margins are also **how you'll forecast**. In your model, you won't guess "other expenses will be ₹164 cr next year." You'll say "other expenses run at about 15% of revenue, like they have for five years" — and the formula does the rest. Margins are the handles the whole forecast hangs from.

**Plain-English translation:** "Out of every ₹100 of sales, how many rupees survive to this level of profit?"

**What happens if you get it wrong:** the most common slip — using **Total income** (which includes other income) as the denominator instead of **Revenue from operations**. Your "margin" then mixes the business with the company's fixed deposits, and it stops being comparable to anyone. Always divide by operating revenue.

**Watch out:** know *which* margin you're quoting. "Margin" alone is ambiguous — gross, EBITDA and net are very different animals (40% vs 18% vs 7.5% here).

Signal: rising margins over the years → the business is getting more efficient or has pricing power. Falling margins → costs are winning. Either way, the trend matters more than any single year.

Analyst Insight: in interviews, always say the level — "EBITDA margin of 18%" — never just "margin of 18%." It's a tiny habit that instantly sounds trained.

🧠 Remember: Margin = profit ÷ operating revenue. Crores compare sizes; margins compare businesses — and margins are the handles your forecast will hang from.

---

## ⚠️ MISTAKE: "Treating 'Profit' as One Thing"

The error: saying "the company made a profit of…" without saying *which* profit. There are **five** on every P&L — gross profit, EBITDA, EBIT, PBT, PAT — and they can be wildly different numbers. Sharma Retail's gross profit is ₹400 cr; its PAT is ₹75 cr. Same company, same year, more than a 5x gap.

Why beginners make it: newspapers say "profit," and it feels like one idea. The correct understanding: each profit answers a *different question*. Gross profit asks "is the basic product profitable?" EBITDA asks "does the operation make money before financing and accounting charges?" PAT asks "what's actually left for shareholders?"

Where it bites, concretely: comparing Company A's **EBITDA margin** to Company B's **net margin** and concluding A is "more profitable." That's not analysis — that's comparing someone's marks before negative marking to someone else's marks after. And in interviews, "what was Titan's profit last year?" is often a trap: the strong answer asks back, politely, "PAT or EBITDA?" — or states both.

The fix is a habit, not knowledge: **never say a profit number without its surname.** EBITDA of ₹180 cr. PAT of ₹75 cr. Five seconds of precision, permanent credibility.

🧠 Remember: Five profits, five different questions. Never quote a profit without its surname.

---

## 📊 REAL WORLD: "Zomato's P&L — Watching the Lines Tell a Story"

For years, Zomato was India's favourite example of "huge revenue, no profit." Then FY24 happened: revenue of roughly **₹12,114 crore**, and — for the first time — a full-year **PAT of about ₹351 crore**. Positive. Small, but positive.

Read that flip through the lines you just learned. Revenue had been growing fast for years — the top line was never the problem. The problem lived in the middle of the P&L: delivery costs, discounts, marketing — the expense lines were growing as fast as revenue, so nothing survived to the bottom. The FY24 story was simple when read line by line: **revenue kept growing, but the expense lines grew slower.** The gap between them — which is just EBITDA — turned positive, and enough of it survived depreciation, interest and tax to leave a positive PAT.

This is the whole skill of P&L reading: a profit flip is never magic. It's always two lines changing speed relative to each other — and once you can name *which* two lines, you understand the company better than the headline does. (When the expense lines grow slower than revenue on purpose, by design of the business, it has a name — operating leverage — and Session 4.6 will let you forecast it.)

🧠 Remember: Zomato's ₹351 cr FY24 profit wasn't magic — revenue grew faster than costs, and you can see exactly where, line by line.

---

## 🎨 VISUAL: "The P&L Staircase — ₹1,000 Walking Down to ₹75"

Create a dark-themed infographic with navy background (#02073D). Show a descending staircase / waterfall chart from left to right. The first tall bar in glowing blue (#246BFD) reads "Revenue ₹1,000 cr". Each step down is a falling red-tinted block with a label: "− COGS ₹600", landing on a purple (#6A5CFF) platform "Gross profit ₹400 (40%)"; then "− Employees ₹90" and "− Other expenses ₹150" landing on a platform "EBITDA ₹180 (18%)"; then "− Depreciation ₹50" landing on "EBIT ₹130"; then "− Interest ₹30" landing on "PBT ₹100"; then "− Tax ₹25" landing on the final pink (#FF6AC1) platform "PAT ₹75 (7.5%)" with a small tag beneath it "÷ 10 cr shares = EPS ₹7.5". Above three platforms, small lavender (#F5ECFF) badges read "the five profits live on the platforms". A side note with an arrow to the Depreciation step: "no cash actually leaves here — Session 4.3". Another arrow to the Interest step: "comes from the debt schedule — Session 4.8". Title at top: "Every P&L Is a Staircase: ₹1,000 In, ₹75 Out." Style: clean, minimal, professional financial infographic, Valuevade dark cosmic aesthetic.

What this visual shows: the entire P&L as one downward walk — students stop seeing fifteen scary lines and start seeing money entering at the top and shrinking step by step, with the five profits as landings on the staircase.

🧠 Remember: The P&L is a staircase. Money walks in at the top, and each step takes a bite.

---

## 📋 SUMMARY: "What Is a Model & the P&L — Key Takeaways"

This session in 60 seconds:

1. You already run three statements at a dosa stall: the diary (P&L), the photo (balance sheet), the cash box (cash flow). A financial model is simply next year's version of all three, written in Excel today.
2. Model = past numbers + your assumptions (blue) + links. Change a dial, everything updates. Every target price and IPO band comes out of one.
3. The P&L reads top to bottom: Revenue → COGS → Gross profit → opex → EBITDA → depreciation → EBIT → interest → PBT → tax → PAT → EPS. Five profits, five different questions — never quote one without its surname.
4. Margins (profit ÷ operating revenue) are how businesses get compared and how forecasts get built — and the denominator is always revenue from operations, never total income.
5. The one thing to never forget going into an interview: depreciation and interest cannot be forecast inside the P&L — they come from the capex and debt schedules, which is exactly why those schedules exist in every real model.

What you can now do: read any Indian company's P&L line by line, compute and quote the right margins, explain a profit flip like Zomato's in terms of which lines changed speed — and explain what a three-statement model is in one sentence.

🧠 Remember: Read the staircase before you build it. Revenue at the top, PAT at the bottom, schedules feeding the middle.

---

## QUIZ

### Q1. In a standard P&L, which comes first, reading top to bottom?

a) EBIT, then EBITDA
b) EBITDA, then EBIT
c) PBT, then EBIT
d) PAT, then PBT

✅ Answer: b) EBITDA, then EBIT
📝 Why: EBITDA appears before depreciation is subtracted; subtract depreciation and you get EBIT. The order is the staircase: Gross profit → EBITDA → EBIT → PBT → PAT. Get the staircase order wrong and every calculation downstream scrambles.

### Q2. Revenue from operations ₹800 cr, COGS ₹480 cr, employee + other expenses ₹176 cr. What are gross profit and EBITDA?

a) Gross profit ₹320 cr; EBITDA ₹144 cr
b) Gross profit ₹144 cr; EBITDA ₹320 cr
c) Gross profit ₹320 cr; EBITDA ₹320 cr
d) Gross profit ₹624 cr; EBITDA ₹144 cr

✅ Answer: a)
📝 Why: Gross profit = 800 − 480 = ₹320 cr. EBITDA = 320 − 176 = ₹144 cr. Two subtractions, two landings on the staircase. Option (b) swaps the order of the landings — the classic scramble.

### Q3. A company's "EBITDA margin is 18% and net margin is 7.5%." The gap between the two is explained by:

a) COGS and employee costs
b) Depreciation, interest and tax
c) Other income
d) Revenue growth

✅ Answer: b)
📝 Why: EBITDA to PAT, the staircase passes exactly three steps — depreciation, interest, tax. COGS and opex (option a) were already taken out *before* EBITDA. Knowing which costs live above and below EBITDA is the whole point of the five-profits idea.

### Q4. True or False: When computing margins, other income should be included in the denominator because it's part of total income.

a) True
b) False

✅ Answer: b) False
📝 Why: Margins measure the *business*, and other income (deposit interest, one-off gains) is not the business. Divide by revenue from operations only — otherwise your margin mixes dosas with fixed deposits and stops being comparable.

### Q5. Fill in the blank: PAT divided by the number of shares gives ______ — the profit earned per share.

✅ Answer: EPS (Earnings Per Share)
📝 Why: ₹75 cr PAT ÷ 10 cr shares = ₹7.5 per share. EPS is the bridge between company-level profit and per-share thinking — and the number the P/E ratio sits on, which Module 12 will use constantly.

---

## INTERVIEW QUESTIONS

### 🎙️ IQ1: "Walk me through a P&L, from revenue to PAT."
*The opening question of countless ER and IB interviews in India — they're checking whether the staircase is automatic for you.*

**Answer Framework:**
- Start at the top, name the business line: "Revenue from operations — money from actually selling; other income sits separately because it's not the business."
- Walk the landings in order: "Subtract COGS for gross profit; subtract employee and other expenses for EBITDA; subtract depreciation for EBIT; subtract interest for PBT; subtract tax for PAT."
- Show you know what each landing *means*: "Gross profit tests the product, EBITDA tests the operation, PAT is what shareholders actually keep."
- Add one practical flag: "I'd note exceptional items separately if any year has them — they distort comparisons."
- Close with the modeller's eye: "And two of those lines — depreciation and interest — can't be forecast inside the P&L; they come from the capex and debt schedules."

**🔑 Power Phrase:** "It's a staircase — revenue walks in at the top, and each step takes its bite until PAT is left for shareholders."

**⚠️ Trap:** Reciting the lines but blanking when asked "and what does EBITDA actually tell you?" — the order is table stakes; the *meaning* of each landing is the test.

### 🎙️ IQ2: "What is EBITDA, and why do analysts both love it and distrust it?"
*A judgement question asked from first rounds to final rounds — the two-sided answer is what separates levels.*

**Answer Framework:**
- Define it plainly: "Earnings before interest, tax, depreciation and amortisation — operating profit before financing choices and accounting charges."
- Why analysts love it: "It compares the *operations* of companies regardless of how they're financed or how old their assets are — clean for peer comparison, and the base for EV/EBITDA valuation."
- Why they distrust it: "It ignores real claims — interest must be paid, assets genuinely wear out and need replacing. A capex-heavy company can show fat EBITDA and thin cash."
- Give the Indian flavour: "For asset-heavy businesses like telecom, EBITDA and PAT live far apart — huge depreciation sits between them — so quoting one without the other misleads."
- Close balanced: "So I use EBITDA for comparison, but never alone — always beside PAT and actual cash flow."

**🔑 Power Phrase:** "EBITDA compares operations; it doesn't pay salaries — interest and worn-out machines are still real."

**⚠️ Trap:** A one-sided answer. Pure praise sounds naive; pure criticism sounds like a quote you read. The question is fishing for both hands.

### 🎙️ IQ3: "Revenue ₹500 cr, COGS is 60% of revenue, opex ₹120 cr, depreciation ₹30 cr, interest ₹20 cr, tax 25%. Find PAT — out loud."
*The live staircase test — asked in Excel tests and verbally, because it checks order and composure together.*

**Answer Framework:**
- Narrate each landing as you compute: "COGS is 60% of 500 = ₹300, so gross profit ₹200."
- "Minus opex ₹120 → EBITDA ₹80."
- "Minus depreciation ₹30 → EBIT ₹50. Minus interest ₹20 → PBT ₹30."
- "Tax at 25% is ₹7.5 → PAT ₹22.5 crore."
- Close with the free credibility line: "Net margin of 4.5% — thin, so this business lives or dies on volumes and cost control."

**🔑 Power Phrase:** "Walking the landings in order: 200, 80, 50, 30 — PAT ₹22.5 crore."

**⚠️ Trap:** Applying tax to EBIT instead of PBT — forgetting that interest comes out *before* tax. It's the single most common slip in this exact question, and interviewers wait for it.

---

# SESSION 4.2: The Balance Sheet & Cash Flow Statement, Line by Line

> "A P&L can look healthy while the company is quietly dying. The balance sheet and the cash flow statement are where the truth hides — and they're easier to read than they look."

---

## NOTES

## 🎣 HOOK: "The Two Statements People Skip — and Regret"

Most beginners read the P&L and stop. Revenue, profit, done. And then the markets keep teaching the same expensive lesson: companies with good-looking profits collapse, and everyone asks "how did nobody see it?"

Somebody usually did see it — in the other two statements. The **balance sheet** would have shown debt piling up faster than the business. The **cash flow statement** would have shown that the "profits" weren't turning into actual money. The P&L is the trailer; these two are the full movie.

Here's the good news: both statements are built on ideas you already understand. The balance sheet is one equation — so simple you'll wonder why it scared you. The cash flow statement is literally a cash box diary with three compartments. By the end of this session, you'll read both line by line, and you'll know the single most important fact in all of finance: **profit and cash are not the same thing.**

🧠 Remember: The P&L is the trailer. The balance sheet and cash flow statement are the full movie — and both are simpler than they look.

---

## 💡 CONCEPT: "A = L + E — The One Equation"

The balance sheet is a photo taken on one date (say, 31-Mar-2025) answering two questions: **what does the company own, and who paid for it?**

The equation: **Assets = Liabilities + Equity.**

The house analogy makes it instant. You buy a house worth ₹1 crore. You took a ₹70 lakh home loan and put in ₹30 lakh of your own money.

- The house = the **asset** (₹1 cr) — what you own.
- The loan = the **liability** (₹70 lakh) — other people's money.
- Your contribution = the **equity** (₹30 lakh) — your own money.

₹1 cr = ₹70 lakh + ₹30 lakh. It balances. And here's why it *always* balances, for every company, forever: **every rupee of stuff a company owns was paid for by someone** — either borrowed (liability) or owned (equity). There's no third source. The balance sheet isn't balanced by luck or effort; it balances by definition, the way both sides of "5 = 2 + 3" agree.

One more idea before the lines: **equity is a leftover.** Sell the house, repay the loan — whatever remains is yours. Same for companies: Equity = Assets − Liabilities. That's why equity is also called "net worth."

🧠 Remember: Assets = Liabilities + Equity, always — because every rupee of stuff was either borrowed or owned. Equity is what's left after debts.

---

## 🔬 DEEP DIVE: "The Balance Sheet, Line by Line"

Sharma Retail Ltd again — balance sheet as on 31-Mar-2025. Same shape as any Ind AS balance sheet you'll open.

**THE ASSETS SIDE (what we own) — ₹900 cr total:**

| Line | ₹ cr | Plain meaning |
|------|------|---------------|
| Property, plant & equipment (PP&E) | 400 | Stores, warehouses, machines — the long-life stuff |
| Capital work-in-progress | 30 | Assets still being built — the half-finished warehouse |
| Intangible assets | 20 | Software, brands — valuable but untouchable |
| Investments | 50 | Money parked in FDs, mutual funds, other companies |
| **Inventory** | 180 | Stock sitting in stores and godowns, waiting to be sold |
| **Trade receivables (debtors)** | 120 | Sales made, money not yet collected — customers owe us |
| **Cash & bank** | 80 | Actual money |
| Other assets | 20 | The miscellaneous drawer |

The first four are **non-current** (long-life); the bold three are **current** (will turn into cash within a year). Inventory, receivables and cash are the assets that move every single day — remember them, they star in Session 4.7.

**THE OTHER SIDE (who paid for it) — also ₹900 cr:**

| Line | ₹ cr | Plain meaning |
|------|------|---------------|
| Share capital | 10 | The face value of all shares issued |
| Reserves & surplus | 440 | Mostly **retained earnings** — every year's PAT the company kept instead of paying out |
| **Total equity** | 450 | The owners' money |
| Long-term borrowings | 250 | Loans repayable after a year |
| Short-term borrowings | 80 | Loans due within a year |
| **Trade payables (creditors)** | 100 | We bought stock, haven't paid suppliers yet — we owe them |
| Other liabilities | 20 | The miscellaneous drawer, other side |

Check: 450 + 250 + 80 + 100 + 20 = ₹900 cr. Balances. Always will.

Now the modeller's pass — beside each line, "where will my model get next year's number from?" This map IS the rest of the module:

- **PP&E** → the capex & depreciation schedule (4.8)
- **Inventory, receivables, payables** → the working capital schedule (4.7)
- **Borrowings** → the debt schedule (4.8)
- **Reserves** → last year's reserves + this year's PAT − dividends (4.9)
- **Cash** → the cash flow statement's closing balance (4.9)

Every balance sheet line is fed by something. Nothing is guessed directly. That's the deepest design idea in modelling, and you just saw the full wiring diagram.

🧠 Remember: Assets on one side, equity + borrowings + payables on the other, always equal — and in a model, every line is fed by a schedule, never guessed.

---

## 🔬 DEEP DIVE: "The Cash Flow Statement — The Cash Box with Three Compartments"

Why does this statement even exist? One scenario explains it. Sharma Retail sells ₹100 cr of goods in March — on credit, payment due in May. The P&L proudly books ₹100 cr of revenue. The cash box receives… **₹0.** Profit went up. Cash didn't move. **Profit and cash are different animals** — and the cash flow statement exists to track the real one.

The statement answers one question — *where did cash actually come and go this year?* — sorted into three compartments:

**1. Cash from Operations (CFO)** — cash from running the business. Built by a clever method called **indirect**: start with PAT, then fix it.

- Start: PAT ₹75 cr (from the P&L)
- **Add back depreciation +₹50 cr** — it was subtracted in the P&L, but no cash actually left (the machine just got older). Un-subtract it.
- **Adjust for working capital:** inventory went UP ₹30 cr → we *spent* cash buying stock → **−30**. Receivables UP ₹20 cr → sales booked, cash not collected → **−20**. Payables UP ₹15 cr → we delayed paying suppliers → cash stayed with us → **+15**.
- CFO = 75 + 50 − 30 − 20 + 15 = **₹90 cr**

The sign logic, once and forever: **an asset going up eats cash; a liability going up saves cash.** Bought more stock? Cash gone. Delayed the supplier? Cash kept. Say it twice; it runs the whole of Session 4.7.

**2. Cash from Investing (CFI)** — buying and selling long-life things. Bought ₹60 cr of new stores (capex) → **−60**. Usually negative for a growing company — and that's healthy, not alarming.

**3. Cash from Financing (CFF)** — money to and from funders. Took a new loan +₹20, repaid old loans −₹25, paid dividends −₹15 → **−20**.

**The grand finale:** Opening cash 70 + CFO 90 + CFI (−60) + CFF (−20) = **closing cash ₹80 cr**. Flip back to the balance sheet's cash line: ₹80 cr. **They match — they must.** That match is the lock that holds the whole three-statement model together, and Session 4.9 builds it with your own hands.

🧠 Remember: CFO = PAT + depreciation back ± working capital. Assets up eat cash, liabilities up save cash — and closing cash must equal the balance sheet's cash.

---

## ⚠️ MISTAKE: "Reserves Are NOT Cash in the Bank"

The error — and it's everywhere, from WhatsApp forwards to actual interviews: "This company has ₹40,000 crore in reserves. Why doesn't it just *use* that money?" The assumption underneath: reserves are a vault of cash somewhere, waiting.

They aren't. **Reserves are a record, not a vault.** Reserves & surplus simply says: "over its lifetime, this company has *kept* this much profit instead of paying it out." But that kept profit was immediately *put to work* — it became stores, machines, inventory, receivables. The money was spent on assets; the reserves line just remembers that it once existed.

Look at Sharma Retail: reserves ₹440 cr. Cash ₹80 cr. The other ₹360 cr of retained profit isn't missing — it's *standing in the stores and sitting on the shelves*. To "use the reserves," the company would have to sell the assets they became.

Why this matters for you, practically: in modelling, **reserves and cash are computed by completely different machinery** — reserves roll forward with PAT (4.9), cash comes from the cash flow statement (4.9) — and confusing them is how beginners build models where money appears from nowhere. And in interviews, "can the company pay a special dividend from its reserves?" is a trap: legally reserves matter, but *practically the question is whether there's cash* — and the cash line, not the reserves line, answers it.

🧠 Remember: Reserves remember the profit; assets are where the profit went. Check the cash line, not the reserves line, to know what's spendable.

---

## 📊 REAL WORLD: "Two Companies, Two Mismatches — Profit ≠ Cash, Both Ways"

**Direction one: cash without profit.** Zomato, for years after its 2021 IPO, reported losses — yet sat on a war chest of cash and investments running into many thousands of crores, raised from the IPO itself. Loss-making *and* cash-rich, simultaneously. The P&L said "losing money"; the balance sheet and CFF said "but the financing compartment filled the tank." Anyone reading only the P&L would have predicted a funeral; the cash told you the company could fund its losses for years while fixing them — which is exactly what happened by FY24.

**Direction two: profit without cash.** The recurring Indian pattern — infrastructure and EPC-style companies booking healthy profits while their *receivables* balloon. Revenue recognised, P&L smiling, but the cash stuck with clients for months or years. The tell sits in plain sight: PAT positive year after year, while CFO limps far below it and receivables swell on the balance sheet. When such companies hit trouble, the P&L is always the last statement to admit it — the cash flow confessed quarters earlier.

The professional habit both stories teach: **read PAT and CFO side by side, every time.** Roughly tracking each other over the years → profits are real. CFO chronically far below PAT → the profits exist on paper and somewhere on the balance sheet, but not in the bank — go find out where, and why.

🧠 Remember: Zomato — losses with a full tank. EPC pattern — profits with an empty one. PAT and CFO read together tell the truth neither tells alone.

---

## 🎨 VISUAL: "The Weighing Scale and the Three Pipes"

Create a dark-themed infographic with navy background (#02073D), split into two halves. Left half, "THE BALANCE SHEET" : a large balanced weighing scale in glowing blue (#246BFD). On the left pan, labelled blocks stacked by size: "PP&E 400", "Inventory 180", "Receivables 120", "Cash 80", "Investments 50", "Other 70" with a total badge "Assets ₹900 cr". On the right pan: "Equity 450" in purple (#6A5CFF) (with a small inner label "incl. retained earnings"), "Borrowings 330", "Payables 100", "Other 20", total badge "₹900 cr". The scale's beam is perfectly level, with a caption beneath: "balances by definition — every rupee of stuff was borrowed or owned". Right half, "THE CASH FLOW": a cash tank labelled "Opening ₹70 cr" with three glowing pipes feeding/draining it — a blue pipe "CFO +90 (the business)", a purple pipe "CFI −60 (buying assets)", a pink (#FF6AC1) pipe "CFF −20 (loans & dividends)" — emptying into a final tank "Closing ₹80 cr"; a lavender (#F5ECFF) dotted line connects this closing tank back across to the "Cash 80" block on the scale's left pan, labelled "must match — the lock". Bottom strip: one chip reading "asset ↑ eats cash · liability ↑ saves cash". Title at top: "One Scale, Three Pipes, One Lock." Style: clean, minimal, professional financial infographic, Valuevade dark cosmic aesthetic.

What this visual shows: the balance sheet as a scale that cannot tip, the cash flow as three pipes into a tank, and the single dotted line — closing cash equals balance-sheet cash — that will become the lock holding the student's entire model together.

🧠 Remember: A scale that can't tip, three pipes into a tank, and one dotted line that locks them together.

---

## 📋 SUMMARY: "Balance Sheet & Cash Flow — Key Takeaways"

This session in 60 seconds:

1. The balance sheet is a photo answering "what do we own, and who paid for it" — Assets = Liabilities + Equity, balanced by definition because every rupee of stuff was either borrowed or owned. Equity is the leftover: assets minus debts.
2. The lines that matter most: PP&E (fed by the capex schedule), inventory–receivables–payables (the working capital trio), borrowings (the debt schedule), reserves (rolls with PAT), cash (comes from the cash flow statement) — in a model, every line is *fed*, never guessed.
3. The cash flow statement exists because profit ≠ cash (credit sales book profit with zero cash). Three compartments: CFO (the business), CFI (buying/selling assets, capex lives here), CFF (loans, repayments, dividends).
4. CFO is built indirectly: PAT + depreciation added back ± working capital changes — where an asset going up *eats* cash and a liability going up *saves* cash. Opening cash + CFO + CFI + CFF = closing cash, which must equal the balance sheet's cash line — the lock.
5. The one thing to never forget going into an interview: reserves are a record, not a vault — the retained profit became stores and stock; the cash line, read beside PAT and CFO, tells you what's actually real and spendable.

What you can now do: read any Indian balance sheet and cash flow statement line by line, explain why the sheet always balances, trace why a profitable company can be cash-poor (and a loss-maker cash-rich), and name which schedule will feed every balance sheet line in your model.

🧠 Remember: One equation, three compartments, one lock — and profit is an opinion while cash is a fact.

---

## QUIZ

### Q1. A company has assets of ₹1,200 cr and total liabilities of ₹750 cr. Its equity is:

a) ₹1,950 cr
b) ₹450 cr
c) ₹750 cr
d) Cannot be determined

✅ Answer: b) ₹450 cr
📝 Why: Equity is the leftover: Assets − Liabilities = 1,200 − 750 = ₹450 cr. The equation A = L + E can be rearranged but never escaped — and "cannot be determined" is the option for people who think balance sheets sometimes don't balance.

### Q2. The company buys ₹60 cr of new store equipment, paid in cash. In the cash flow statement, this appears in:

a) CFO, as an operating cost
b) CFI, as capex — an outflow of ₹60 cr
c) CFF, since it was funded by the company
d) Nowhere — it's a balance sheet item

✅ Answer: b)
📝 Why: Buying long-life assets is investing activity — CFI. It is *not* an expense in CFO (the P&L will feel it slowly, as depreciation — Session 4.3's whole story). Option (d) is half-clever: it does hit the balance sheet too, but cash moved, so the cash statement must record it.

### Q3. During the year: inventory up ₹25 cr, receivables down ₹10 cr, payables up ₹8 cr. The combined working capital effect on cash is:

a) −₹43 cr
b) −₹7 cr
c) +₹7 cr
d) −₹27 cr

✅ Answer: b) −₹7 cr
📝 Why: Asset up eats cash (inventory: −25), asset *down* releases cash (receivables: +10 — customers paid up), liability up saves cash (payables: +8). Net: −25 + 10 + 8 = −₹7 cr. One sign rule, applied three times.

### Q4. True or False: A company with ₹40,000 cr in reserves & surplus necessarily has a large amount of cash available to spend.

a) True
b) False

✅ Answer: b) False
📝 Why: Reserves record profits *kept*; those profits were immediately put to work as stores, machines and inventory. The vault is the cash line, not the reserves line — Sharma Retail keeps ₹440 cr of reserves and only ₹80 cr of cash, and that's completely normal.

### Q5. Fill in the blank: Trade receivables are also called ______, and trade payables are also called ______.

✅ Answer: Debtors; creditors
📝 Why: Old names, still everywhere in Indian filings and conversations. Debtors owe *us* (an asset); we owe creditors (a liability). Mixing up which side is which scrambles every working capital calculation you'll ever do.

---

## INTERVIEW QUESTIONS

### 🎙️ IQ1: "Why does a balance sheet always balance?"
*A deceptively simple opener — they're checking whether you understand the logic or just memorised the equation.*

**Answer Framework:**
- Lead with the principle, not the formula: "Because every rupee of assets had to be paid for by someone — either borrowed money or the owners' money. There's no third source."
- Give the instant analogy: "A ₹1 crore house bought with a ₹70 lakh loan and ₹30 lakh of your own money — the asset equals the funding, by construction."
- Name equity correctly: "Equity is the leftover — assets minus liabilities — which is why it's called net worth."
- Show the modelling consequence: "In a model, the sheet balancing isn't automatic — every line must be correctly fed by its schedule, and the balance check at the bottom is how we prove the plumbing is right."
- Close: "So a real company's sheet balances by definition; *my model's* sheet balancing is the test that I built it correctly."

**🔑 Power Phrase:** "Every rupee of stuff was either borrowed or owned — the two sides are the same money, described twice."

**⚠️ Trap:** Answering "because accountants make it balance." The interviewer wants the funding logic — sources and uses — not a procedural shrug.

### 🎙️ IQ2: "A company reports profits every year but never seems to have cash. How is that possible?"
*One of the most-loved questions at every level — it tests whether you've internalised profit ≠ cash.*

**Answer Framework:**
- State the principle first: "Profit is recorded when earned; cash arrives when collected. The gap between those two events lives on the balance sheet."
- Name suspect one: "Receivables — sales booked on credit, customers paying in 90, 180 days. The P&L celebrates; the bank account waits. Common in EPC and B2B businesses."
- Suspect two: "Inventory — profit reinvested straight into stock sitting in godowns. The cash became things."
- Suspect three: "Capex — a growing company pouring every rupee of operating cash into new stores or plants; CFO positive, but CFI swallows it."
- Close with the diagnostic: "The check is reading PAT against CFO over several years — tracking together means real profits; CFO chronically far below PAT means the profit is on paper and parked somewhere on the balance sheet, and my job is finding out where."

**🔑 Power Phrase:** "Profit is an opinion about the year; cash is a fact about the bank account — and the gap between them always has an address on the balance sheet."

**⚠️ Trap:** Giving only one reason. The strong answer lists the three parking spots — receivables, inventory, capex — and then names the PAT-vs-CFO diagnostic.

### 🎙️ IQ3: "Where does depreciation appear in the cash flow statement, and why is it added back?"
*The warm-up to the famous ₹10 walk — getting this crisp sets up the next session's showpiece.*

**Answer Framework:**
- Locate it: "In CFO, under the indirect method — the first adjustment after starting from PAT."
- Explain the why in one move: "Depreciation was subtracted in the P&L as a cost, but no cash actually left — the machine just got a year older. Since we *started* from PAT, which already absorbed that non-cash subtraction, we un-subtract it: add it back."
- Pre-empt the misreading: "Adding it back doesn't mean depreciation *gives* the company cash — it means it never took any. The cash left years ago, when the asset was bought, through CFI."
- Connect the statements: "That's why capex-heavy companies — telecom is the classic — show modest PAT but much stronger CFO: a big non-cash charge sits between the two."
- Close: "It's one piece of the bigger loop — and the full ₹10 depreciation walk through all three statements is the cleanest way to show the loop end to end."

**🔑 Power Phrase:** "We add it back because we started from a number it had already reduced — depreciation is a cost, not a cash flow."

**⚠️ Trap:** Saying "depreciation increases cash." It doesn't increase anything — it simply never decreased it. The wording you choose here is exactly what the interviewer is grading.

---

# SESSION 4.3: How the Three Statements Connect — The ₹10 Walk

> "One interview question has decided more analyst offers in India than any other: 'Depreciation goes up by ₹10 — walk me through all three statements.' Today you make it the easiest question you'll ever get."

---

## NOTES

## 🎣 HOOK: "Three Statements, One Machine"

You now know all three statements separately. Here's the twist that turns knowledge into modelling: **they were never separate.**

Change one number anywhere, and it ripples through all three. Book a sale — the P&L moves, receivables move on the balance sheet, and the cash flow adjusts. Buy a machine — cash flow and balance sheet move today, and the P&L feels it for the next ten years through depreciation. The three statements are one machine viewed from three angles: performance (P&L), position (balance sheet), and cash (the passbook).

This session teaches the connections through two famous walks — small stories where we push one number into the machine and follow it everywhere it goes. The first walk, "₹10 of depreciation," is the single most-asked technical question in Indian finance interviews. The second, "₹100 of capex," kills the most common beginner confusion in modelling. Walk them slowly today, and every model you ever build — including the one starting next session — will feel obvious instead of frightening.

🧠 Remember: The three statements are one machine, three angles. Push one number in, and it ripples through all three — every time.

---

## 💡 CONCEPT: "The Three Links — Memorise These Before Anything Else"

Everything in this session, and in Sessions 4.4 through 4.9, hangs on three connections. Learn them as a chant:

**Link 1 — Profit travels.** PAT, the bottom of the P&L, goes two places at once: it's the **starting line of the cash flow statement** (the indirect method begins "Start with PAT…"), and it flows into the balance sheet's **retained earnings** (inside reserves), minus any dividends paid out. Formula worth memorising now: *Closing retained earnings = Opening + PAT − Dividends.*

**Link 2 — Cash closes the loop.** The cash flow statement's final answer — closing cash — **is** the cash line on the balance sheet. Not "should match." *Is.* One number, two homes.

**Link 3 — Some items live in multiple statements at once.** Depreciation sits in the P&L (a cost), in the cash flow (added back), and on the balance sheet (PP&E shrinks). Capex sits in the cash flow (CFI outflow) and on the balance sheet (PP&E grows). New loans sit in the cash flow (CFF inflow) and on the balance sheet (borrowings grow). These shared items are the bolts holding the machine together.

One picture to hold it all: the P&L produces profit → profit feeds the cash flow and the equity → the cash flow produces closing cash → cash sits on the balance sheet → and the balance sheet balances only if every link was honoured. When your model's balance sheet refuses to balance in Session 4.9, it will *always* be because one of these three links got broken somewhere. Always.

🧠 Remember: Profit travels (to CFS and retained earnings). Cash closes the loop (CFS closing = BS cash). Shared items bolt the statements together.

---

## 🔬 DEEP DIVE: "Walk 1 — ₹10 of Depreciation, Through All Three Statements"

The setup, exactly as interviewers say it: *"Depreciation increases by ₹10. Tax rate is 25%. Walk me through the three statements."* We'll do it slowly once; the fast version comes at the end.

**STATEMENT 1 — THE P&L (start here, always):**

**Step 1:** Depreciation up ₹10 → it's a cost → **EBIT falls by ₹10**. (EBITDA doesn't move — depreciation sits *below* EBITDA. Saying this aloud earns instant marks.)

**Step 2:** PBT falls by ₹10 → tax falls by 25% of 10 = **₹2.5** (less profit, less tax — the "tax shield").

**Step 3:** So **PAT falls by ₹7.5** (the ₹10 cost, softened by ₹2.5 of tax saved).
👉 What you'll see so far: profit down ₹7.5. A beginner stops here and thinks "bad news." Keep walking.

**STATEMENT 2 — THE CASH FLOW:**

**Step 4:** CFO starts with PAT → starts **₹7.5 lower**.

**Step 5:** But depreciation is non-cash, so the indirect method adds the *full* ₹10 back → **+₹10**.

**Step 6:** Net effect on CFO: −7.5 + 10 = **+₹2.5**. Cash actually went UP by ₹2.5.
👉 What you'll see: the headline surprise — profit fell, **cash rose**. Why? The only *real* cash event in the whole story was the ₹2.5 of tax we didn't pay. Depreciation itself never touched cash; the tax shield did.

**STATEMENT 3 — THE BALANCE SHEET (prove it balances):**

**Step 7:** Assets side: cash **+2.5** (from Step 6), PP&E **−10** (the asset depreciated more) → assets net **−₹7.5**.

**Step 8:** Other side: retained earnings carry the lower PAT → equity **−₹7.5**.

**Step 9:** −7.5 = −7.5. **Balanced.** The loop closed.

**The 30-second interview version — say it like this:** *"P&L: EBIT down 10, tax saves 2.5, PAT down 7.5. Cash flow: start 7.5 lower, add the full 10 back since it's non-cash — CFO up 2.5; the only real cash is the tax shield. Balance sheet: cash up 2.5, PP&E down 10 — assets down 7.5; retained earnings down 7.5. Balances."* Practise it out loud five times today. Yes, actually out loud.

🧠 Remember: PAT −7.5, CFO +2.5, assets −7.5 = equity −7.5. Profit fell, cash rose — and the only real money was the tax shield.

---

## 🔬 DEEP DIVE: "Walk 2 — ₹100 of Capex, and Why It Never Hits the P&L"

The most common beginner confusion in all of modelling: *"The company spent ₹100 crore on a new plant — why isn't that an expense in the P&L?"* This walk answers it forever. Sharma Retail buys ₹100 cr of equipment, paid in cash, with a 10-year life.

**TODAY — the day of purchase:**

**Step 1:** The P&L: **nothing happens.** Genuinely nothing. The company didn't *lose* ₹100 cr — it *swapped* ₹100 cr of cash for ₹100 cr of equipment. Swapping one asset for another isn't a cost.

**Step 2:** The cash flow: CFI shows **−₹100** (capex). Cash physically left, so the passbook records it.

**Step 3:** The balance sheet: cash **−100**, PP&E **+100**. Assets unchanged in total, just wearing different clothes. Liabilities and equity untouched. **Still balances.**
👉 What you'll see: a big cash event with zero profit impact — the exact mirror of Walk 1, where there was a profit impact with (almost) zero cash.

**OVER THE NEXT 10 YEARS — the slow echo:**

**Step 4:** Each year, depreciation of ₹10 (₹100 ÷ 10 years) appears in the P&L — and runs through Walk 1's exact mechanics: EBIT −10, PAT −7.5, CFO +2.5, PP&E shrinking ₹10 a year until it reaches zero.

Here's the sentence that makes the whole design click: **depreciation is just capex visiting the P&L in instalments.** The cash left once, on day one, through CFI. The *cost* arrives in ten yearly EMIs, through the P&L, matched against the ten years the asset actually earns money. Accountants call this "matching"; modellers call it the reason the capex schedule (Session 4.8) exists — to keep track of which instalments are due when.

And one bonus variant, because interviewers love it: *"same purchase, but funded by a loan."* Today: PP&E +100, borrowings +100 (balances instantly); CFI −100, CFF +100 (cash flow nets to zero). Over time: depreciation as above, **plus** interest on the loan in the P&L. Two slow echoes instead of one.

🧠 Remember: Capex never hits the P&L on day one — it swaps cash for an asset. Depreciation is that capex visiting the P&L in instalments, matched to the years the asset earns.

---

## ⚠️ MISTAKE: "Editing One Statement and Walking Away"

The error: treating the statements as three separate sheets. The beginner builds a model, decides revenue should be higher, types a bigger number into the P&L… and stops. The P&L looks great. But nothing else moved — receivables didn't grow with the sales, cash didn't change, retained earnings didn't carry the extra profit. The "model" is now three strangers in a trench coat — and the balance sheet, the honest one, refuses to balance.

Why it happens: in school, statements are taught as separate chapters. In real companies — and real models — they're one machine, and **you never edit a statement directly. You edit assumptions, and the links carry the change everywhere it must go.** Want higher revenue? Change the growth assumption (blue cell), and watch: P&L revenue rises → PAT rises → retained earnings rise → receivables rise with sales → cash flow adjusts → cash lands on the balance sheet → it still balances. One dial, six ripples, zero hand-editing.

The test of understanding — use it on yourself: pick any event (a sale, a loan, a dividend, buying stock) and ask, *"which statements does this touch, and where?"* If your answer ever involves only one statement, walk it again — almost everything touches at least two. (The rare exceptions, like swapping cash for inventory, touch only the balance sheet — but they touch *two lines* of it, so even they keep the scale level.)

The consequence of the habit, left unfixed: Session 4.9's balance check glowing red, hours of hunting, and — under deadline pressure — the temptation of Module 3's cardinal sin, the plug. The cure was always upstream: respect the links, edit only dials.

🧠 Remember: Never edit a statement; edit an assumption and let the links carry it. Everything touches at least two statements — if your story touches one, the story is incomplete.

---

## 📊 REAL WORLD: "Jio's ₹2 Lakh Crore Echo"

Reliance Jio spent well over **₹2 lakh crore** building its telecom network — towers, fibre, spectrum — across its launch years. Now apply Walk 2 to that number, and modern India's most-discussed P&L makes sudden sense.

On the days that money was spent, **none of it appeared in the P&L.** It flowed out through CFI as capex and stacked up on the balance sheet as a colossal PP&E and spectrum line. Then the echo began: year after year, that capex visits the P&L in instalments — depreciation and amortisation charges so large that they sit among the biggest cost lines Jio reports. This is why, for years, Jio could simultaneously show **enormous EBITDA and modest PAT**: a mountain of non-cash D&A stood between the two landings of the staircase.

And it's why analysts covering telecom — Jio, Airtel, Indus Towers — lean so heavily on EBITDA and on cash flow rather than PAT alone: Walk 1 taught you that depreciation suppresses PAT while leaving actual cash generation far healthier (CFO gets the add-back, plus the tax shield). A telecom analyst who can't run the ₹10 walk literally cannot explain their own sector's most basic pattern. You now can, in thirty seconds.

🧠 Remember: Jio's network cash left once, through CFI — and has been visiting the P&L in giant instalments ever since. That's why telecom lives on EBITDA and cash flow, not PAT.

---

## 🎨 VISUAL: "The ₹10 Walk — Tokens Moving Through the Machine"

Create a dark-themed infographic with navy background (#02073D), laid out as three connected statement panels with numbered glowing tokens travelling between them. Panel 1, "P&L" in blue (#246BFD): a mini staircase showing token ① "Depreciation +10" hitting the EBIT step (EBIT −10, with a small note "EBITDA untouched — dep sits below it"), token ② "Tax saved +2.5" at the tax step, token ③ "PAT −7.5" at the bottom, glowing. Panel 2, "CASH FLOW" in purple (#6A5CFF): token ③ arriving as "Start: PAT −7.5", token ④ "+10 added back (non-cash)", and a result badge "CFO +2.5" with the caption "the only real cash = the tax shield". Panel 3, "BALANCE SHEET" in pink (#FF6AC1): a small weighing scale — left pan "Cash +2.5, PP&E −10 → Assets −7.5", right pan "Retained earnings −7.5 → Equity −7.5" — beam perfectly level, stamped with a lavender (#F5ECFF) "BALANCED ✓". Curved glowing arrows carry the tokens: P&L→CFS (labelled "Link 1: profit travels"), CFS→BS cash (labelled "Link 2: cash closes the loop"), and a thin arc from the P&L's depreciation directly to PP&E (labelled "Link 3: shared items"). A compact footer strip shows Walk 2 in miniature: "Capex ₹100 today: P&L nothing · CFI −100 · BS swaps cash↔PP&E — then ₹10/yr instalments via depreciation." Title at top: "One Number In, Three Statements Moved, Still Balanced." Style: clean, minimal, professional financial infographic, Valuevade dark cosmic aesthetic.

What this visual shows: the complete ₹10 walk as physical tokens moving through one machine, with all three links labelled in action — the student can rehearse the interview answer just by tracing the arrows.

🧠 Remember: Trace the tokens — ①②③④ — and the famous question becomes a picture you've already seen.

---

## 📋 SUMMARY: "How the Statements Connect — Key Takeaways"

This session in 60 seconds:

1. The three statements are one machine seen from three angles — and three links hold it together: profit travels (PAT starts the cash flow and feeds retained earnings: closing = opening + PAT − dividends), cash closes the loop (CFS closing cash IS the balance sheet's cash), and shared items like depreciation, capex and loans bolt multiple statements together.
2. The ₹10 depreciation walk, cold: P&L — EBIT −10, tax shield +2.5, PAT −7.5 (EBITDA untouched). Cash flow — start −7.5, add back +10, CFO +2.5. Balance sheet — cash +2.5, PP&E −10, assets −7.5 = retained earnings −7.5. Balanced. Profit fell; cash rose; the only real money was the tax saved.
3. The ₹100 capex walk: day one, the P&L feels nothing — cash swaps into PP&E (CFI −100). Then depreciation delivers the cost in instalments over the asset's life. Capex never hits the P&L directly; depreciation is capex visiting in EMIs.
4. Never edit a statement — edit an assumption and let the links carry it everywhere. Every business event touches at least two statements; a story that touches one is incomplete, and the balance sheet will say so.
5. The one thing to never forget going into an interview: rehearse the 30-second walk out loud until it's automatic — it is the most-asked technical question in Indian finance, and Jio's entire EBITDA-vs-PAT pattern is the walk playing out at ₹2-lakh-crore scale.

What you can now do: trace any event — depreciation, capex, a loan, a credit sale — through all three statements and prove the balance sheet still balances; which means you're ready to build your first complete model in the next session.

🧠 Remember: Profit travels, cash closes the loop, shared items bolt it together — push any number in, and you can now follow it everywhere.

---

## QUIZ

### Q1. Depreciation rises by ₹20, tax rate 30%. The effect on PAT and on CFO respectively is:

a) PAT −₹20; CFO −₹20
b) PAT −₹14; CFO +₹6
c) PAT −₹14; CFO +₹20
d) PAT −₹20; CFO +₹6

✅ Answer: b) PAT −₹14; CFO +₹6
📝 Why: PAT falls by 20 × (1 − 0.30) = ₹14. CFO: starts −14, adds back the full 20 → +₹6 — which is exactly the tax saved (30% of 20). Same walk, new numbers: if you can do it at 25%, you must be able to do it at 30%.

### Q2. A company buys a ₹50 cr machine for cash today. The immediate effect on the P&L is:

a) An expense of ₹50 cr
b) An expense of ₹5 cr (first year's depreciation)
c) Nothing — cash was swapped for an asset; the P&L feels it later through depreciation
d) Other income of ₹50 cr

✅ Answer: c)
📝 Why: Capex is a swap, not a cost — cash −50, PP&E +50, CFI −50, P&L silent. The cost arrives in instalments as depreciation over the machine's life. Option (b) is tempting but wrong about *today* — depreciation begins from use, as a separate, later entry.

### Q3. In the ₹10 walk at a 25% tax rate, the balance sheet stays balanced because:

a) Cash +2.5 and PP&E −10 net to assets −7.5, which equals retained earnings −7.5
b) Cash −7.5 equals PP&E −7.5
c) Liabilities rise by ₹10 to offset
d) The auditor adjusts it

✅ Answer: a)
📝 Why: Both sides fall by exactly ₹7.5 — assets via the cash/PP&E combination, equity via the lower PAT flowing into retained earnings. No liabilities move anywhere in this walk. If your version doesn't land on −7.5 = −7.5, retrace a step.

### Q4. True or False: Adding depreciation back in the cash flow statement means depreciation brings cash into the company.

a) True
b) False

✅ Answer: b) False
📝 Why: The add-back exists only because we *started* from PAT, a number depreciation had already reduced. Depreciation never took cash, so we un-subtract it. The only genuine cash in the walk is the tax shield — wording this correctly is exactly what interviewers grade.

### Q5. Fill in the blank: Closing retained earnings = Opening retained earnings + ______ − Dividends.

✅ Answer: PAT (profit after tax)
📝 Why: This is Link 1 written as a formula — the profit the company keeps stacks up in reserves year after year. Session 4.9 will build this exact roll-forward as one row of your model, and it's half the reason model balance sheets balance.

---

## INTERVIEW QUESTIONS

### 🎙️ IQ1: "Depreciation increases by ₹10. Walk me through the three statements. Tax rate 25%."
*THE question. Asked at Goldman, Kotak, ICICI Securities, Big-4 — everywhere, at every level. Deliver it in under 40 seconds.*

**Answer Framework:**
- P&L first, with the bonus flag: "EBITDA is untouched — depreciation sits below it. EBIT falls ₹10, tax falls ₹2.5, PAT falls ₹7.5."
- Cash flow, with the why: "CFO starts ₹7.5 lower, but we add the full ₹10 back since it's non-cash — net CFO is UP ₹2.5."
- Name the real money: "The only actual cash in the story is the ₹2.5 tax shield."
- Balance sheet, and prove it: "Cash +2.5, PP&E −10 — assets down 7.5. Retained earnings down 7.5. Balances."
- Close with one line of command: "Profit fell, cash rose — which is exactly why capex-heavy companies are judged on cash flow, not PAT alone."

**🔑 Power Phrase:** "PAT down 7.5, cash UP 2.5 — and the only real money in the entire walk is the tax shield."

**⚠️ Trap:** Starting anywhere other than the P&L, or forgetting the tax effect entirely (saying PAT falls ₹10). Both are instant tells of a memorised-not-understood answer.

### 🎙️ IQ2: "A company buys a ₹100 cr machine, funded entirely by a new loan. Walk me through all three statements — today, and over time."
*The capex walk with a financing twist — tests whether you can run two links at once.*

**Answer Framework:**
- Today, P&L: "Nothing. No cost has occurred — an asset was acquired, not consumed."
- Today, balance sheet: "PP&E +100, borrowings +100 — both sides rise together; balances instantly."
- Today, cash flow: "CFI −100 for the capex, CFF +100 for the loan — they offset; net cash unchanged, which matches the balance sheet showing no cash movement."
- Over time, the two echoes: "Depreciation drips the ₹100 through the P&L over the asset's life — running the standard ₹10-walk mechanics each year — and interest on the loan hits the P&L as a second, separate cost, with repayments flowing out through CFF."
- Close: "One event, two slow echoes — the asset's cost via depreciation, the funding's cost via interest. Keeping those two echoes straight is exactly what the capex and debt schedules in a model exist to do."

**🔑 Power Phrase:** "Day one is just two swaps — asset for liability, CFI for CFF. The P&L only meets this machine later, in instalments."

**⚠️ Trap:** Putting the ₹100 purchase into the P&L as an expense, or forgetting that the two cash flow legs net to zero — both reveal the walks haven't been internalised.

### 🎙️ IQ3: "Why do telecom analysts focus on EBITDA and cash flow instead of PAT?"
*A sector-flavoured version of this whole session — connects the walks to real Indian coverage.*

**Answer Framework:**
- Name the structural fact: "Telecom is brutally capex-heavy — Jio alone has invested over ₹2 lakh crore in its network — and all of that returns to the P&L as massive yearly depreciation and amortisation."
- Run the consequence: "So a giant non-cash charge sits between EBITDA and PAT — PAT looks modest even when the operations are gushing cash."
- Apply the walk: "The ₹10 logic at scale: depreciation suppresses PAT while CFO stays strong, because the add-back returns it and the tax shield even helps."
- The analyst's response: "EBITDA compares the operating engines across Jio, Airtel and Vi without the distortion of asset age and capex timing — and cash flow shows what's genuinely available for spectrum payments, capex and debt."
- Close with the caution: "But EBITDA alone can flatter — the capex that created that depreciation is real and recurring in telecom, so I'd always read EBITDA beside capex and free cash flow."

**🔑 Power Phrase:** "When ₹2 lakh crore of network visits the P&L in instalments, PAT stops describing the business — EBITDA and cash flow take over."

**⚠️ Trap:** Saying "PAT doesn't matter in telecom." It matters — it's just *distorted by design*; the strong answer explains the distortion's mechanics instead of dismissing the metric.

---

# SESSION 4.4: Your First Three-Statement Model — Simple, Complete, Balanced

> "Reading statements is theory. Today you build one — a small, complete, three-statement model that balances on its own. The moment that balance check turns green, finance stops being abstract."

---

## NOTES

## 🎣 HOOK: "The Day It Clicks"

Every analyst remembers the first time their model balanced. You change one assumption, watch the number ripple through three statements, glance at the bottom — and the balance check reads zero. Not because you forced it. Because you built the links correctly and the machine *worked.*

That moment is today. We're going to build a genuinely complete three-statement model for Sharma Retail Ltd — P&L, balance sheet, cash flow, all linked, all balancing — on a single sheet, with deliberately simple numbers. It will be small. It will skip the schedules and scenarios that come later. But it will be *real*: change the growth assumption and all three statements move together, exactly like a ₹500 crore broker model.

This is the most important session in the module. Everything before was preparation; everything after is making this same machine bigger and more detailed. Build along in Excel — reading this session without typing is like reading about swimming. Open a blank sheet now.

🧠 Remember: A small model that truly balances teaches more than a giant one you copied. Today you build the machine — then later sessions just scale it up.

---

## 💡 CONCEPT: "The Build Order — Why We Go P&L → BS → CF"

Before touching cells, know the *order*. A three-statement model is always built in the same sequence, and the order isn't arbitrary — each statement needs the one before it.

1. **P&L first.** It needs nothing from the others — just revenue and costs. It produces PAT.
2. **Balance sheet second.** It needs PAT (for retained earnings) and the working capital / asset lines. It's *almost* complete — but one line is left blank: **cash.**
3. **Cash flow third.** It takes PAT and the balance sheet changes and computes the actual cash movement — producing **closing cash.**
4. **Close the loop.** That closing cash gets plugged into the balance sheet's blank cash line — and *now* the balance sheet balances.

This is the master pattern. The cash flow statement is the bridge: it takes everything the P&L and balance sheet generated and produces the one number (cash) that makes the balance sheet whole. Build cash flow *before* you fill in the balance sheet's cash, and the loop closes itself.

One more principle: **the balance sheet is the honesty check.** The P&L and cash flow can both look fine while hiding an error — but if you've made a mistake anywhere in the links, the balance sheet will refuse to balance. It's the smoke detector of the whole model. We build it to balance *by construction*, then verify with a check cell.

🧠 Remember: P&L → balance sheet (cash left blank) → cash flow → plug closing cash back in. The cash flow is the bridge; the balance sheet is the honesty check.

---

## 🔬 DEEP DIVE: "Build the Model — Part 1: Assumptions & the P&L"

Open Excel. We'll keep two columns: **FY25 (Actual)** and **FY26 (Forecast)**. Label column B "FY25A", column C "FY26E". Let's go.

**THE ASSUMPTIONS BLOCK (top of the sheet, all blue).** Before any statement, list the dials. Type these in blue cells, labelled:

| Assumption | Value |
|------------|-------|
| Revenue growth | 12% |
| Gross margin | 40% |
| Other expenses (% of revenue) | 24% |
| Depreciation (% of opening PP&E) | 12.5% |
| Interest rate on debt | 10% |
| Tax rate | 25% |
| Dividend payout (% of PAT) | 20% |
| Capex | ₹120 cr |

These eight dials will drive the entire model. Everything else is a formula. (This is a baby version of Session 4.5's Inputs tab — same idea, one sheet.)

**THE FY25 ACTUALS (column B, typed black — these are facts).** Enter Sharma Retail's FY25 P&L from Session 4.1: Revenue 1,000, COGS 600, Gross profit 400, Other expenses 240, EBITDA 160, Depreciation 50, EBIT 110, Interest 30, PBT 80, Tax 20, PAT 60. (Slightly simplified from 4.1 — we've folded employee costs into other expenses to keep it clean. Also note: these are the *given* historical numbers.)

**THE FY26 FORECAST (column C, formulas — this is the modelling):**

**Step 1:** Revenue. `=B_revenue * (1 + growth)` → 1,000 × 1.12 = **1,120**.
👉 What you'll see: your first forecast cell. Change the 12% dial and this moves.

**Step 2:** COGS and Gross profit. COGS isn't forecast directly — gross *margin* is the dial. Gross profit = `Revenue × gross margin` = 1,120 × 40% = **448**. COGS = Revenue − Gross profit = **672**.

**Step 3:** Other expenses = `Revenue × 24%` = **268.8**. EBITDA = Gross profit − Other expenses = 448 − 268.8 = **179.2**.

**Step 4:** Depreciation = `opening PP&E × 12.5%`. We'll define opening PP&E in Part 2, but it's FY25's closing PP&E. Say FY25 PP&E was 400 → depreciation = **50**. EBIT = 179.2 − 50 = **129.2**.

**Step 5:** Interest = `opening debt × 10%`. FY25 debt, say, 300 → interest = **30**. PBT = 129.2 − 30 = **99.2**.

**Step 6:** Tax = `PBT × 25%` = **24.8**. PAT = 99.2 − 24.8 = **₹74.4 cr**.
👉 What you'll see: a complete forecast P&L, every line driven by a dial or a link. PAT of ₹74.4 cr — hold that number; it's about to travel into the other two statements.

Notice what you did *not* do: you never typed a forecast number directly. Growth, margins and rates were the inputs; the staircase did the rest. That discipline — Module 3's "assumptions in cells, logic in formulas" — is the entire reason this will balance.

🧠 Remember: Assumptions in blue, actuals in black, forecast in formulas — revenue from growth, costs from margins, depreciation and interest from balances, down to PAT.

---

## 🔬 DEEP DIVE: "Build the Model — Part 2: Balance Sheet, Cash Flow & the Lock"

Now the part that makes it a *three-statement* model. Keep FY25 actuals in column B.

**FY25 BALANCE SHEET (column B, the given starting photo):** PP&E 400, Inventory 180, Receivables 120, Cash 50, → Total assets 750. Equity: Share capital 10, Reserves 290 → 300. Debt 300, Payables 150 → Total 750. Balanced (it's a real starting point).

**FY26 BALANCE SHEET (column C) — build each line from its rule:**

**Step 1 — PP&E roll-forward:** `Opening PP&E + Capex − Depreciation` = 400 + 120 − 50 = **470**. (Asset grows by what you buy, shrinks by what wears out — Walk 2 from Session 4.3, now as a formula.)

**Step 2 — Working capital lines, the simple way:** grow them with revenue. Inventory = `180 × 1.12` = 201.6. Receivables = `120 × 1.12` = 134.4. Payables = `150 × 1.12` = 168. (Session 4.7 will do this far more precisely with days — for now, growing with revenue is a fine first approximation.)

**Step 3 — Reserves roll-forward:** `Opening reserves + PAT − Dividends`. Dividends = PAT × 20% = 74.4 × 20% = 14.88. Reserves = 290 + 74.4 − 14.88 = **349.5**. (Link 1 from Session 4.3, as a formula — profit travels into reserves.)

**Step 4 — Debt:** assume no new borrowing this year → stays **300**. Share capital unchanged → **10**.

**Step 5 — Cash: LEAVE IT BLANK.** This is the secret of the whole build. Don't compute cash yet. Every other line is filled; cash is the one missing piece — and the cash flow statement is about to hand it to us.

At this point, add up everything *except* cash: Other side total = Equity (10 + 349.5) + Debt 300 + Payables 168 = **827.5**. Asset side without cash = PP&E 470 + Inventory 201.6 + Receivables 134.4 = **806**. The gap, 827.5 − 806 = **21.5**, is what cash *must* be for the sheet to balance. Hold that — the cash flow will independently produce the same number, and when it does, you'll know the model is correct.

**FY26 CASH FLOW STATEMENT (column C) — the bridge:**

**Step 6 — CFO:** Start with PAT 74.4. Add back depreciation +50. Working capital changes (asset up eats, liability up saves): inventory +21.6 → −21.6; receivables +14.4 → −14.4; payables +18 → +18. CFO = 74.4 + 50 − 21.6 − 14.4 + 18 = **₹106.4 cr**.

**Step 7 — CFI:** Capex −120. CFI = **−120**.

**Step 8 — CFF:** No new debt (0), dividends paid −14.88. CFF = **−14.88**.

**Step 9 — Closing cash:** `Opening cash + CFO + CFI + CFF` = 50 + 106.4 − 120 − 14.88 = **₹21.5 cr**.
👉 What you'll see: **₹21.5 cr** — the *exact* number the balance sheet needed. The two arrived at it independently. That's not a coincidence; it's the machine working.

**Step 10 — Close the loop:** link the balance sheet's blank cash cell to this closing cash (`=closing cash`). Now total the asset side: 806 + 21.5 = **827.5**. Other side: **827.5**. 

**Step 11 — The balance check:** in a cell at the very bottom, type `=TotalAssets − TotalEquityAndLiabilities`. It reads **0**. Wrap it in Session 3.5's tolerance check: `=IF(ABS(diff)<0.1, "BALANCED ✓", "CHECK ✗")`.
👉 What you'll see: **BALANCED ✓**. Now change the revenue growth dial from 12% to 18% — and watch every statement move, cash recompute, and the check stay green. *That* is a three-statement model. You built it.

🧠 Remember: Fill every balance sheet line but cash, let the cash flow produce closing cash, link it back, and the check goes green — because the links were honoured, not forced.

---

## ⚠️ MISTAKE: "Plugging Cash Instead of Linking It"

The error: the balance sheet doesn't balance, so the beginner types whatever number into the cash cell makes it balance. The check goes green — and the model is now a lie. This is Module 3's cardinal sin, the **plug**, arriving in its native habitat.

Why it's so tempting here specifically: cash is the *last* line you fill, and it's the line that "makes it balance," so it feels natural to just… put the balancing number there. But there's a world of difference between **cash computed by the cash flow statement** (which then *happens* to balance the sheet, proving the model is right) and **cash typed to force a balance** (which hides the fact that something upstream is wrong).

The tell that distinguishes them: in a correct model, closing cash comes from `=Opening + CFO + CFI + CFF` — a formula referencing the cash flow statement. In a plugged model, the cash cell contains a *typed number* or, worse, `=other side − assets without cash` (literally back-solving the balance). If you ever find your cash line defined as "whatever makes it balance," you haven't built a model — you've built a sheet that balances by assertion, and the moment you change an assumption, it'll either break or silently mislead.

The deeper point: **a balance check is only meaningful if cash is computed independently.** If cash is plugged, the check *always* reads zero — it's checking nothing, like a smoke detector wired to stay silent. The whole value of the balance sheet as an honesty check evaporates. Build cash from the cash flow, always, and let the balance be the *reward* for correctness, never the *method* of achieving it.

🧠 Remember: Cash comes from the cash flow statement, never typed to force a balance. A check on a plugged model checks nothing.

---

## 📊 REAL WORLD: "The Same Machine, Just Bigger"

The model you just built has maybe forty cells. A sell-side analyst's model of HDFC Bank or Infosys might have forty *thousand* — dozens of tabs, hundreds of assumptions, schedules for everything. Here's what should encourage you: **it is the identical machine.**

Open any professional model and you'll find exactly what you just built, scaled up. The P&L still walks revenue down to PAT. The balance sheet still has every line fed by a rule, with cash left as the closing piece. The cash flow still starts from PAT, adds back depreciation, adjusts for working capital, and produces a closing cash that links back. And at the bottom — always, in every serious model on every desk — sits a balance check, the same `Assets − (Liabilities + Equity)` reading zero, the same smoke detector you just installed.

The difference is detail, not structure. Where you grew inventory with revenue, the pro uses a days-of-inventory schedule (Session 4.7). Where you grew PP&E by one capex number, the pro has a full asset register (Session 4.8). Where you held debt flat, the pro has a debt schedule with draws and repayments (Session 4.8). And where you had one forecast column, the pro has five years and three scenarios (Sessions 4.6, 4.10). But strip all that away and the skeleton is *this* — which means you've already built the hard part. Everything remaining in this module is adding rooms to a house whose foundation you just poured.

🧠 Remember: A ₹500 crore broker model is this same machine with more detail — same staircase, same fed balance sheet, same closing-cash link, same balance check at the bottom.

---

## 🎨 VISUAL: "The Build Sequence — Four Moves to a Balanced Model"

Create a dark-themed infographic with navy background (#02073D), laid out as a numbered circular flow of four stages with a final lock. Stage 1, "P&L" in glowing blue (#246BFD): a mini staircase from "Revenue 1,120" down to "PAT 74.4", with a small tag "driven by 8 blue dials". An arrow labelled "PAT travels →". Stage 2, "BALANCE SHEET (cash blank)" in purple (#6A5CFF): a weighing scale tilted slightly off-level, with most lines filled — "PP&E 470 (open+capex−dep)", "Inventory/Receivables/Payables grow w/ revenue", "Reserves 349.5 (open+PAT−div)", "Debt 300" — but the cash block drawn as a glowing empty dashed box labelled "??? — left blank on purpose". Stage 3, "CASH FLOW" in pink (#FF6AC1): three stacked pipes — "CFO +106.4 (PAT + dep ± WC)", "CFI −120 (capex)", "CFF −14.88 (dividends)" — feeding a result tank "Closing cash 21.5". A bold glowing arrow carries "21.5" from this tank back to the empty box in Stage 2, labelled "Stage 4: PLUG IN THE LINK (=closing cash)". Once connected, the Stage 2 scale snaps perfectly level with a lavender (#F5ECFF) stamp "BALANCED ✓ 0.0". A side caption with a red ✗: "NEVER type cash to force this — cash must come from the pipes". Title at top: "Four Moves: Staircase → Scale → Pipes → Lock." Style: clean, minimal, professional financial infographic, Valuevade dark cosmic aesthetic.

What this visual shows: the entire build sequence as four moves, with the deliberately-blank cash box and the closing-cash link drawn as the climactic connection — the student sees exactly why leaving cash blank and computing it from the cash flow is what makes the model balance honestly.

🧠 Remember: Staircase, scale (cash blank), pipes, lock. Four moves, and the lock is closing cash — never a typed plug.

---

## 📋 SUMMARY: "Your First Three-Statement Model — Key Takeaways"

This session in 60 seconds:

1. Build order is always P&L → balance sheet (cash left blank) → cash flow → plug closing cash back into the balance sheet. The cash flow is the bridge that produces the one number making the balance sheet whole.
2. The P&L is driven entirely by blue dials (growth, margins, rates) — you never type a forecast number directly; revenue comes from growth, costs from margins, depreciation and interest from opening balances, down to PAT.
3. Each balance sheet line is built from its rule: PP&E = opening + capex − depreciation; working capital lines grow with revenue (for now); reserves = opening + PAT − dividends; debt and share capital roll forward — and cash is left blank until the cash flow fills it.
4. The cash flow produces closing cash (opening + CFO + CFI + CFF); link that to the balance sheet's cash cell and the sheet balances — verified by a check cell, `Assets − (Liab + Equity)`, wrapped in a tolerance test reading "BALANCED ✓".
5. The one thing to never forget going into an interview: cash comes from the cash flow statement, never typed to force a balance — a balance check is only meaningful when cash is computed independently, and a real ₹500 crore broker model is this exact machine with more detail.

What you can now do: build a complete, linked, self-balancing three-statement model from a blank sheet — and change any assumption and watch all three statements move together while the balance holds. You have built the core skill of financial modelling.

🧠 Remember: You built a machine that balances itself. Everything left in this module just adds rooms to this foundation.

---

## QUIZ

### Q1. In what order are the three statements built in a three-statement model?

a) Balance sheet, then P&L, then cash flow
b) P&L, then balance sheet (cash blank), then cash flow, then link cash back
c) Cash flow, then P&L, then balance sheet
d) All three simultaneously

✅ Answer: b)
📝 Why: The P&L needs nothing from the others; the balance sheet needs PAT; the cash flow needs both and produces closing cash, which then completes the balance sheet. The order follows what each statement depends on — get it wrong and you're referencing numbers that don't exist yet.

### Q2. When building the FY26 balance sheet, which line is deliberately left blank until the cash flow statement is complete?

a) Reserves
b) PP&E
c) Cash
d) Debt

✅ Answer: c) Cash
📝 Why: Every other line is built from its own rule; cash is the closing piece that the cash flow statement computes (opening + CFO + CFI + CFF). Leaving it blank and then linking it is exactly what makes the balance sheet balance by construction rather than by force.

### Q3. PP&E opens at ₹400 cr, capex is ₹120 cr, depreciation is ₹50 cr. Closing PP&E is:

a) ₹570 cr
b) ₹470 cr
c) ₹330 cr
d) ₹520 cr

✅ Answer: b) ₹470 cr
📝 Why: Opening + capex − depreciation = 400 + 120 − 50 = ₹470 cr. The asset grows by what you buy and shrinks by what wears out — Walk 2 from Session 4.3 as a formula. Option (a) forgets depreciation; option (c) forgets capex.

### Q4. True or False: If your model's balance sheet only balances after you type a number directly into the cash cell, the model is correct as long as the check reads zero.

a) True
b) False

✅ Answer: b) False
📝 Why: A plugged cash line makes the check *always* read zero — it's checking nothing, like a disabled smoke detector. Cash must come from the cash flow statement; only then does the balance prove the model's links are right rather than merely asserting it.

### Q5. Fill in the blank: Closing cash on the cash flow statement = Opening cash + CFO + CFI + ______.

✅ Answer: CFF (cash from financing)
📝 Why: The three compartments — operations, investing, financing — added to opening cash give closing cash, which links to the balance sheet. Forget CFF (dividends, loans, repayments) and your cash is wrong, your balance breaks, and the honesty check correctly screams.

---

## INTERVIEW QUESTIONS

### 🎙️ IQ1: "Build me a simple three-statement model. What's your sequence, and how do you make it balance?"
*A conceptual build question at ER and IB rounds — they want the method, not the numbers; it reveals whether you've actually built one.*

**Answer Framework:**
- State the order with reasons: "P&L first — it depends on nothing else, just growth and margins down to PAT. Balance sheet second — built from PAT and each line's rule, but I leave cash blank. Cash flow third — it produces closing cash. Then I link closing cash into the balance sheet."
- Explain the balancing logic: "The sheet balances *by construction*, not by force — because cash comes from the cash flow statement, which itself is built from the same PAT and balance sheet movements. The two arrive at the same cash number independently."
- Name the lines' rules crisply: "PP&E rolls forward — opening plus capex minus depreciation; reserves roll forward — opening plus PAT minus dividends; working capital ties to revenue or days; debt from a schedule."
- The check: "A balance check at the bottom — assets minus liabilities-plus-equity — wrapped in a tolerance formula. Green means the links are right."
- Close with the discipline: "And cash is never typed — if I have to plug it, I've made an error upstream, and I go find it rather than hide it."

**🔑 Power Phrase:** "Cash comes from the cash flow, never from my keyboard — so when it balances, the balance has *proven* the model, not been forced onto it."

**⚠️ Trap:** Describing the three statements separately without the *linking* mechanism. The question is entirely about how they connect into one balancing machine — that's the skill being tested.

### 🎙️ IQ2: "Your balance sheet is off by ₹15 crore. Where do you look, and what do you absolutely not do?"
*A debugging-plus-ethics question — tests both your mental model of the links and your professional integrity.*

**Answer Framework:**
- The forbidden move first: "What I absolutely don't do is plug it — type ₹15 cr into the cash line or anywhere to force the balance. That hides the error and makes the check worthless."
- Then the systematic hunt, following the links: "An imbalance always means a broken link. I check the three: did PAT flow correctly into both retained earnings and the cash flow's start? Does the cash flow's closing cash actually link to the balance sheet's cash cell? Are all shared items — depreciation, capex — consistent across statements?"
- Common culprits, named: "Often it's a working capital change with the wrong sign in the cash flow, a dividend deducted from reserves but not from cash, or capex hitting one statement but not the other."
- The technique: "I'd use the size of the error as a clue — ₹15 cr might match a specific line I can search for — and trace precedents on the cash and reserves cells."
- Close: "And if it's late and I can't find it, I flag it honestly — 'balance off by ₹15 cr, investigating' — rather than ship a plugged model. A wrong-but-honest model can be fixed; a plugged one quietly misleads everyone downstream."

**🔑 Power Phrase:** "An imbalance is a broken link with an address — I hunt the link; I never silence the alarm."

**⚠️ Trap:** Any hint of "I'd just adjust cash to make it balance." That single sentence ends serious interviews — it reveals you don't understand what the balance check is *for*.

### 🎙️ IQ3: "Why is the balance sheet considered the 'check' on a model rather than the P&L or cash flow?"
*A conceptual question that separates those who understand model architecture from those who memorised steps.*

**Answer Framework:**
- The core reason: "The P&L and cash flow can each look completely reasonable while containing an error — there's no internal contradiction that forces them to reveal a mistake."
- Why the balance sheet is different: "The balance sheet must satisfy Assets = Liabilities + Equity *by identity*. If any link in the model is wrong — a number that should have flowed to two places only went to one — the two sides stop matching, and the error surfaces immediately."
- The mechanism: "It's a global consistency check: every number that touches multiple statements has to be consistent everywhere, and the balance sheet is where any inconsistency mathematically must appear."
- The practical payoff: "So a balancing sheet is strong evidence the entire model's plumbing is correct — it's the cheapest, most powerful test in modelling, which is why every professional model has the check cell at the bottom."
- Close: "The catch — it only works if cash is computed independently from the cash flow. Plug cash, and you've disconnected the alarm; the check reads zero while testing nothing."

**🔑 Power Phrase:** "The balance sheet can't be fooled — any broken link mathematically has to show up as an imbalance, which is why it's the model's smoke detector."

**⚠️ Trap:** Saying "because it has to balance" without explaining *why* that property makes it a useful error-catcher — the depth is in the mechanism, not the restatement.

---

# SESSION 4.5: Going Pro — Model Architecture & Spreading Historicals

> "Your first model lived on one sheet with two columns. A real model spans many tabs and five years of real filings. Same machine — now we learn the professional way to organise and feed it."

---

## NOTES

## 🎣 HOOK: "Why Your One-Sheet Model Won't Survive a Desk"

The model you built in 4.4 was correct — and it would get you in trouble on a real desk. Not because the logic was wrong, but because it was all crammed onto one sheet, with assumptions, calculations and outputs tangled together. The moment it grows to five years, multiple schedules and a real company's complexity, that tangle becomes unworkable: nobody can find the assumptions, nobody can audit the logic, and changing one input means hunting through a maze.

Professionals solve this with **architecture** — a standard way of organising a model into layers and tabs that every analyst on every desk recognises. And before any forecasting, they do the unglamorous work of **spreading**: loading four or five years of real, filed numbers as the foundation. Your toy model used made-up FY25 actuals. A real model uses Titan's actual audited statements, tied out to the filing.

This session upgrades you from "I can build a model" to "I can build a model the way a desk expects." Same machine as 4.4 — bigger, organised, and fed with real truth.

🧠 Remember: 4.4 taught the machine; 4.5 teaches the professional way to organise and feed it — architecture plus real historical data.

---

## 💡 CONCEPT: "The Three-Layer Architecture"

Every professional model separates into three layers, and the separation is the whole point:

| Layer | Tabs (examples) | What lives here | Font |
|-------|-----------------|-----------------|------|
| **INPUTS** | Inputs | Every assumption — growth, margins, days, rates | Blue |
| **ENGINE** | Historicals, P&L, Working Capital, Capex, Debt, BS-CF | Formulas only — the machinery | Black (green for links across tabs) |
| **OUTPUTS** | Summary, Scenarios, Charts | What people read — never typed into | Formulas pulling from the engine |

The flow runs **one way: Inputs → Engine → Outputs.** Nothing flows backwards. You change blue dials on Inputs; the engine recalculates; the outputs update. This is exactly your 4.4 model, but with the assumptions block promoted to its own tab and the statements split across several tabs.

Why bother splitting what worked fine on one sheet? Three concrete reasons. **Speed:** "show me at 8% growth" is one trip to the Inputs tab, not a hunt. **Auditability:** a reviewer checks all your assumptions in one place, and Module 3's Go-To-Special-Constants trick on the engine should light up *nothing* (no stray hardcodes). **Scaling:** five years and four schedules need room to breathe — cramming them onto one sheet is how errors hide.

The laws of the house, carried from Module 3 and 4.4: **no blue (assumptions) outside the Inputs tab; one row, one formula filled across; time flows left to right with every tab on the same column grid** (FY24 is the same column letter on every sheet, so links stay sane); **checks built in from the start.**

🧠 Remember: Inputs (blue dials) → Engine (black formulas) → Outputs (read-only), one-way flow — your 4.4 model, professionally split across tabs.

---

## 🔬 DEEP DIVE: "The Date Spine & the A/E Flag — One Setup That Runs Everything"

Before loading data, build the time backbone every tab will share. This is a small setup with an enormous payoff.

**Step 1 — the date spine.** On your main Model tab, pick one cell for the model's anchor date: the last actual year-end, say 31-Mar-2025, typed in blue. Then lay out the year columns: five actuals (FY21–FY25) and five forecasts (FY26–FY30). The first date is 31-Mar-2021; each next column uses `=EOMONTH(previous, 12)` — Session 3.7's date function doing its real job. Custom-format the row as `"FY"YY` so it reads FY21, FY22… while staying genuine dates underneath.
👉 What you'll see: ten columns, each a real period-end date wearing an "FY" label — and changing the one anchor date re-derives the whole timeline.

**Step 2 — the A/E flag row.** Below the dates, one formula tells every column whether it's history or forecast:

`=IF(C$4 <= $B$2, "A", "E")`

where C$4 is the column's date (row pinned) and $B$2 is the anchor date (fully pinned). Fill it across.
👉 What you'll see: FY21–FY25 read **"A"** (Actual), FY26–FY30 read **"E"** (Estimate). Every column now knows its own identity.

**Why this row is worth its own deep dive:** it lets one formula handle both history and forecast. A line can say "if this column is Actual, pull the filed number; if Estimate, run the forecast formula" — `=IF(C$5="A", historical_value, forecast_formula)`. And here's the magic: when FY26 results arrive next year, you change **one cell** — the anchor date rolls to 31-Mar-2026 — the flags flip FY26 from E to A, and the whole model re-bases itself from forecast to actual. Desks call this "rolling the model," and it happens every results season under time pressure. Analysts who built proper flags roll in seconds; those who didn't rebuild for hours.

**Step 3 — copy the spine to every tab.** The date row and flag row go on every engine tab, in the same columns. Now FY24 is column F everywhere, and a link from the P&L tab to the Working Capital tab lines up automatically.

🧠 Remember: One anchor date drives an EOMONTH spine and an A/E flag row — and rolling the model each results season becomes a one-cell edit.

---

## 🔬 DEEP DIVE: "Spreading — Loading Five Years of Real Truth"

"Spreading" is the desk's term for entering a company's filed statements into your model's standard format. It's where the forecast gets its foundation — because every forecast is anchored to history (margins to historical margins, growth to historical growth), and a spreading error propagates forward through every assumption that references it.

**WHERE THE TRUTH LIVES (ranked):**

| Rank | Source | Use for |
|------|--------|---------|
| 1 | Annual Report (company site / BSE) | The authority — audited statements and notes |
| 2 | Quarterly filings (BSE/NSE) | Recent periods before the AR exists |
| 3 | screener.in / Tickertape | Speed — many years in one table |

The professional contract with rank 3: aggregators are brilliant for *speed* and forbidden as *final authority*. Spread fast from screener, then **tie out** the key totals against the actual filing.

**THE ONE DECISION THAT TRIPS EVERY BEGINNER — consolidated vs standalone.** Indian companies file both: standalone (the parent alone) and consolidated (parent + subsidiaries). For any company with material subsidiaries, **the market trades the consolidated entity**, so you spread consolidated — and never mix the two across years (doing so manufactures a growth jump that never happened). The toggle sits right at the top of every screener page; it's decision number one, written into your Historicals tab's title.

**THE WORKFLOW:**

**Step 1 — set the standard line items** down column A in your model's order: Revenue from operations, Other income, COGS, Employee costs, Other expenses, EBITDA, Depreciation, EBIT, Interest, PBT, Exceptional items, Tax, PAT, then the balance sheet blocks, then the cash flow subtotals. Title cell: "Titan Company — Consolidated (₹ cr)". Basis and units declared before any number.

**Step 2 — load each year** into its A-column. These are typed facts (data, not assumptions) — a "historical input" style, distinct from blue assumptions.

**Step 3 — the per-column balance check.** As each year's balance sheet lands, one formula: `=ROUND(Total assets − Total equity and liabilities, 1)`. It must read **zero** — the filed sheet already balances, so any difference is *your* typo. This runs per year, as you type, catching errors immediately. (And note the discipline: it's a check, never a plug — Module 3's and 4.4's law.)

**Step 4 — tie out to the filing.** Four totals per year against the AR — revenue, EBITDA, PAT, total assets — each with a Session 3.5 tolerance check underneath. A wall of "OK" means your spread is faithful; one red cell points to the exact year and line to fix.

**Step 5 — tag the one-offs.** Read each year's exceptional-items note and tag any one-time gain, provision or write-off in a comments row. The forecast's anchors (next session) must be built on *recurring* history — a one-off year left untagged lets a single event impersonate a trend. (The extreme example: Vodafone Idea's roughly ₹73,878 crore FY20 loss was dominated by a one-time court-ordered provision, not by operations — anchoring a forecast to that untagged would poison every projected year.)

🧠 Remember: Annual report is authority, aggregators are speed-then-verify, consolidated for the market's entity — spread to a standard format, balance-check each column, tie out four totals, tag the one-offs.

---

## ⚠️ MISTAKE: "The Frankenstein History"

The error: a five-year spread stitched from mismatched sources — two years from screener's standalone view, one from the consolidated annual report, one hand-keyed with other income blended into revenue, one from a broker note's adjusted numbers. Each piece looks correct alone. The assembled history is a monster: its year-to-year "changes" are presentation differences wearing the costume of performance.

Why it happens innocently: spreading gets interrupted, sources get switched for convenience ("the AR pdf was slow, I grabbed the last two years from screener"), and nobody records which basis was used where. Excel doesn't object — to it, numbers are numbers.

The damage is specific and severe. A standalone-to-consolidated switch between two years manufactures a revenue jump that your growth calculation reports as real acceleration — and the next session's forecast, anchored to that phantom acceleration, carries it forward five more years. An other-income migration shifts margins 100–200 basis points between years, and your margin anchors average fiction. A Frankenstein history is *worse* than no history, because it answers with confidence.

The defence is bureaucratic and absolute: **one basis, declared in the title cell** (Consolidated, ₹ cr, Ind AS); **one source per statement block, named in a source row** beneath the spread (e.g., "AR FY23 p.187"; "screener pulled 12-Jun-26, tied out"); and the **tie-out wall** — because a stitched-together spread almost never reconciles to any single filing, which is exactly how it gets caught. When a company genuinely restates prior years, take the *latest filing's version* of each year and note it.

🧠 Remember: One basis, one declared source per block, tie-outs as the lie detector — a history stitched from mixed sources lies structurally while answering confidently.

---

## 📊 REAL WORLD: "Why Titan Must Be Modelled Consolidated"

Take Titan Company — a clean illustration of the consolidated-vs-standalone law. The standalone entity is the core watches-and-jewellery parent. But the *listed* Titan that the market prices includes its subsidiaries — the eyewear business, the international arms, and CaratLane, the digital-jewellery company Titan progressively took control of. The consolidated entity captures all of it; the standalone misses a growing slice of the story.

Model Titan standalone and you'd be forecasting a company that doesn't match the share price — leaving out subsidiaries that are, in some cases, the *fastest-growing* parts of the group. The consolidated-versus-standalone gap itself becomes informative: it tells you how much of Titan's economics lives outside the parent, and the trend in that gap signals where growth is migrating.

So the rule applies with full force: **Titan is spread consolidated, declared in the header, every year, every statement, tied out to the consolidated filing.** And Titan's segment disclosures — watches, jewellery, eyewear, others — become the driver tree for the next session's revenue build: consolidated numbers for the model, segment splits for the forecasting logic. This is the everyday version of the law — not exotic, just disciplined: know which entity the market is buying, and model that one.

🧠 Remember: The market prices Titan-plus-subsidiaries, so the model spreads consolidated — and the standalone-vs-consolidated gap tells you where the group's growth is migrating.

---

## 🎨 VISUAL: "The Pro Model — Layers, Spine, and Tied-Out History"

Create a dark-themed infographic with navy background (#02073D), in three stacked zones. Zone 1 (top), "THE ARCHITECTURE" : three layered slabs connected by a one-way downward arrow — a blue (#246BFD) slab "INPUTS — every assumption, blue dials" on top; a purple (#6A5CFF) slab "ENGINE — Historicals · P&L · Working Capital · Capex · Debt · BS-CF (formulas only)" in the middle; a pink (#FF6AC1) slab "OUTPUTS — summary, scenarios, charts (read-only)" at the bottom; a red crossed-out arrow trying to go upward, stamped "never". Zone 2 (middle), "THE SPINE" : a horizontal strip of ten year-columns FY21→FY30, the first five tagged "A" in blue and last five tagged "E" in lavender (#F5ECFF), with one glowing anchor-date cell labelled "31-Mar-2025 — change THIS to roll the model"; a small caption "EOMONTH builds the dates; one flag row drives actual-vs-forecast on every tab". Zone 3 (bottom), "SPREADING" : a document icon labelled "Annual Report (authority)" and a smaller "screener (speed → tie out)" feeding a model grid; beside the grid, a checklist with green ticks — "basis: CONSOLIDATED ✓", "BS balances per column: 0.0 ✓", "Rev/EBITDA/PAT/Assets tied to filing ✓", "one-offs tagged ✓" — and one red ✗ item "mixed sources = Frankenstein history" crossed out. Title at top: "Organised in Layers, Fed with Real Truth." Style: clean, minimal, professional financial infographic, Valuevade dark cosmic aesthetic.

What this visual shows: the professional model on one page — the three-layer architecture with its one-way flow, the shared date spine with the model-rolling anchor cell, and the spreading discipline with its tie-out checklist — so the student sees how 4.4's machine scales into a desk-grade structure.

🧠 Remember: Layers flow one way, the spine is driven by one anchor date, and history is loaded from the authority and tied out.

---

## 📋 SUMMARY: "Going Pro — Key Takeaways"

This session in 60 seconds:

1. Professional models use a three-layer architecture — Inputs (blue dials) → Engine (black formulas across several tabs) → Outputs (read-only) — with one-way flow; it's your 4.4 machine with assumptions promoted to their own tab and statements split for room to breathe, delivering speed, auditability and scale.
2. A shared time backbone runs everything: one anchor date drives an EOMONTH date spine and an A/E flag row (=IF(date ≤ anchor, "A", "E")) copied to every tab — so one formula handles history and forecast, and "rolling the model" each results season is a single-cell edit.
3. Spreading loads four-to-five years of filed truth: annual report as authority, aggregators as speed-then-verify, **consolidated** for any company with material subsidiaries (declared in the header, never mixed across years), into a standard line-item format.
4. Integrity is checked as you build: a per-column balance check (a certain typo-detector, never a plug), a four-total tie-out wall against the filing, and one-off tagging so anchors reflect recurring reality — Vodafone Idea's FY20 court-provision loss being the cautionary extreme.
5. The one thing to never forget going into an interview: the Frankenstein history — one basis, one declared source per block, tie-outs as the lie detector — and the consolidated-vs-standalone law, because the model must describe the entity the market actually prices (Titan-plus-subsidiaries, not the parent alone).

What you can now do: set up a professional multi-tab model skeleton with a shared date spine and flag row, and spread a real Indian company's five years of consolidated financials into it — tied out, single-basis, one-offs tagged — ready for the forecast.

🧠 Remember: Same machine as 4.4, now in proper layers with a shared spine and a real, tied-out foundation under it.

---

## QUIZ

### Q1. In the three-layer architecture, which direction does information flow?

a) Outputs → Engine → Inputs
b) Inputs → Engine → Outputs, one way only
c) All directions — everything links to everything
d) Engine → Inputs → Outputs

✅ Answer: b)
📝 Why: You change blue dials on Inputs; the Engine recalculates; the Outputs display. Nothing flows backwards — assumptions never live in the engine, and outputs are never typed into. Break this and "show me at 8%" becomes a maze instead of a single dial-turn.

### Q2. The A/E flag row reads =IF(C$4 <= $B$2, "A", "E") with the anchor date B2 = 31-Mar-2025. Next year FY26 actuals arrive. To roll the whole model forward, you:

a) Rewrite every FY26 formula by hand
b) Change B2 to 31-Mar-2026 — the flags flip FY26 to "A" and flag-driven formulas re-base
c) Insert a new column
d) Delete all the forecast columns

✅ Answer: b)
📝 Why: One anchor date governs every column's identity, so rolling the model is a single-cell edit — the flags flip, and any formula written as "if Actual, pull filed; if Estimate, forecast" re-bases itself. Options (a) and (d) describe the life of models built without flags.

### Q3. For a company with several large, fast-growing subsidiaries, your model should spread:

a) Standalone — the parent is what's listed
b) Consolidated — the market prices the whole group, and standalone omits the subsidiaries
c) Whichever screener defaults to
d) A mix, depending on the year

✅ Answer: b)
📝 Why: The share price capitalises the group's full economics, so the model must too — and mixing bases across years (option d) is the Frankenstein history. Basis is one decision, declared once, applied to every year and every statement.

### Q4. True or False: screener.in can serve as the final authority for the historical numbers in a professional model.

a) True
b) False

✅ Answer: b) False
📝 Why: Aggregators are excellent for speed but make silent standardisation choices (where other income sits, how exceptionals are treated). Spread fast from screener if you like, but tie the key totals out against the actual annual report — the filing is the authority.

### Q5. Fill in the blank: As you spread each year's balance sheet, a per-column check computes Total assets minus Total equity and liabilities, which must equal ______ — and any other value means a typing error, not a plug to apply.

✅ Answer: Zero
📝 Why: Audited balance sheets balance by definition, so a non-zero check on your *spread* is a certain typo-detector. The fix is finding the mis-keyed line — never forcing it with an adjustment, which would be Module 3's cardinal sin committed on day one of the build.

---

## INTERVIEW QUESTIONS

### 🎙️ IQ1: "Why do professional models separate assumptions from calculations onto different tabs?"
*A design-judgement question at associate rounds — tests whether your standards have reasons behind them.*

**Answer Framework:**
- Speed of argument: "Mixed-in assumptions make 'show me at 8% growth' a hunt through hundreds of formulas; an Inputs tab makes it one dial-turn — and live committee discussions move at dial speed."
- Auditability: "A reviewer audits all my beliefs in one place, and Go-To-Special on the engine should light up zero hardcodes — every assumption is visibly on the Inputs tab, in blue, where it can be challenged."
- Scenarios become possible: "Bull/Base/Bear switching works by repointing inputs — if assumptions are buried in formulas, there's mechanically nothing to switch."
- Error containment: "Typos in clearly-labelled inputs are visible and fixable; typos buried in engine formulas survive review and compound downstream."
- Close: "It's Module 3's blue-font law promoted to architecture — formulas hold logic, cells hold beliefs, and beliefs deserve their own room."

**🔑 Power Phrase:** "The engine should contain zero opinions — every opinion lives on one tab, in blue, where it can be interrogated."

**⚠️ Trap:** Saying "it's cleaner." Cleanliness is the symptom; name the mechanical payoffs — speed, audit, scenarios, containment.

### 🎙️ IQ2: "You're modelling a conglomerate. Standalone or consolidated — and what would make you reconsider?"
*The basis question, asked to test whether you treat it as company-specific judgement or a default.*

**Answer Framework:**
- Default with the reason: "Consolidated — the listed share capitalises the entire group including subsidiaries, so the model must describe what the share actually owns."
- Show you know what's inside: "For a conglomerate that means every operating subsidiary folding in — and the consolidated-versus-standalone gap itself tells me how much economics sits outside the parent, often the fastest-growing parts."
- The reconsider condition: "I'd model standalone only where subsidiaries are genuinely immaterial — low single digits of revenue and profit — and even then I'd state it; the moment a subsidiary is a growth driver, consolidated is non-negotiable."
- Hygiene clause: "Whichever basis, it's declared in the header, applied to every year and statement, and my tie-outs run against that basis's filing."
- Close: "And segment disclosures become my driver tree — consolidated for the totals, segments for the forecasting logic."

**🔑 Power Phrase:** "The share price is a claim on the group, so the model describes the group — and the basis is written in the header before the first number."

**⚠️ Trap:** "Whichever has more data." The basis is an economics decision, not a convenience one — and that answer reveals the spread was never tied out.

### 🎙️ IQ3: "You've spread five years and the EBITDA margin jumps 600 basis points in one year. What's your process before you accept it?"
*A judgement-and-process question — they're watching whether you interrogate history or just transcribe it.*

**Answer Framework:**
- First suspect, my own spread: "Tie-outs for that year against the filing — a mis-keyed line or a cost bucket mapped differently in one year manufactures exactly this jump."
- Second, presentation artifacts: "A basis switch between years, other income migrating into revenue, or a reclassification between cost lines — growth that's really a costume change."
- Third, the one-off hunt: "The exceptional-items and other-income notes for that year — any gain on sale or provision reversal — tagged, and the anchor either adjusted or excluded explicitly."
- Fourth, only then the real business: "Price hikes, mix shift, operating leverage on a demand surge — and those must echo in the concall and segment data, or they didn't happen."
- Close: "A 600bps jump is guilty until explained — my forecast anchors only ever inherit the part of it I can narrate."

**🔑 Power Phrase:** "Big moves in spread history get interrogated in order — my typing, their presentation, one-offs — and only then, the business."

**⚠️ Trap:** Jumping straight to a business explanation ("margins expanded!"). Enthusiasm for a story before eliminating artifacts is exactly how Frankenstein histories get blessed and bad forecasts get built.

---

# SESSION 4.6: Forecasting the P&L — Revenue Drivers & Cost Builds

> "Get revenue wrong by 10% and nothing downstream can save you — every cost, every margin, every valuation inherits the error. This is the line where analysts earn their keep."

---

## NOTES

## 🎣 HOOK: "The Most Expensive Row in the Model"

In your 4.4 model, revenue was "last year × 1.12." Honest for a first build — but on a real desk, that single percentage is where careers are made or exposed. Here's why: revenue is the assumption every other assumption is calibrated against. Costs are forecast as a percentage *of revenue*. Working capital grows *with revenue*. The valuation is built *on revenue*. An error here doesn't stay here — it multiplies through everything, compounding over five forecast years.

So revenue gets special treatment. The lazy version — "grows 15%" — takes four seconds and dies on the first follow-up: *"why 15%?"* The professional version breaks revenue into **drivers** — the physical quantities that actually generate it (stores, customers, volumes), each small enough that you can hold and defend an opinion about it. "Forty-five new D-Mart stores" is an opinion you can defend with the company's own guidance. "15% because it grew 15%" is an echo, not an opinion.

This session teaches the professional revenue build, then the much simpler cost build that hangs off it. Revenue is hard and matters most; costs are easy and mostly follow revenue. Spend your energy accordingly.

🧠 Remember: Revenue errors compound through every cost, margin and valuation — so revenue gets drivers you can defend, never an echo of last year.

---

## 💡 CONCEPT: "The Driver Tree — Decomposing Revenue Until You Can Defend It"

A **driver tree** breaks revenue down, branch by branch, until every endpoint is something you can hold an independent, defensible opinion about. The test for a finished tree: *can I argue for each bottom number, using the company's disclosures?*

Three common shapes, each matched to a business type:

- **Retailer (D-Mart):** Revenue = **average stores × revenue per store**. Stores come from a roll-forward (opening + new); revenue per store comes from history, grown gently.
- **Subscription (Jio):** Revenue = **subscribers × ARPU × 12**. Subscribers from net adds; ARPU from tariff actions and mix.
- **Bank (HDFC Bank):** Income = **loan book × net interest margin**. The tree adapts to whatever physically drives the business.

The organising principle: **bottom-up to build, top-down to sanity-check.** Build revenue from physical drivers (bottom-up), then verify the result implies a believable market share (top-down). If your bottom-up forecast implies D-Mart capturing an absurd share of Indian grocery by FY30, the tree just caught your own over-optimism.

And the three forecasting philosophies, deployed by where you are in the timeline: **drivers for the near years** (FY26–FY27, where precision is defensible), **a faded glide path for the far years** (FY28–FY30, where driver-level precision would be false precision), and **run-rate only for genuinely stable businesses.** Conviction lives in the near years; humility in the far ones.

🧠 Remember: A driver tree decomposes revenue until every endpoint is a defensible opinion — built bottom-up, sanity-checked top-down, with drivers near and a faded path far.

---

## 🔬 DEEP DIVE: "Building the D-Mart Revenue Engine — Step by Step"

On the P&L tab (or a dedicated Revenue tab), under the date spine and flags from 4.5. Assumptions live on Inputs; the engine references them. This exact block is the heart of your module project.

**Step 1 — the store roll-forward.** Three rows: Opening stores, New stores added, Closing stores. Opening FY26 links to closing FY25 (an Actual). New stores in the Estimate columns reference a blue Inputs cell — say 45 per year, defensible against D-Mart's recent run of roughly 40-plus annually.
👉 What you'll see: Closing = Opening + New, and next year's Opening = this year's Closing. This is the *exact same roll-forward shape* as PP&E in 4.4 — and as working capital and debt in the next sessions. Learn the corkscrew once; it appears everywhere.

**Step 2 — average stores.** `=(Opening + Closing)/2`. A store opened in March traded for only weeks, so crediting it a full year overstates revenue. Averaging is the honest approximation of mid-year openings.
👉 What you'll see: the row that quietly prevents a systematic over-forecast — using closing stores would bill every new store for twelve months it didn't trade.

**Step 3 — revenue per store.** In the Actual columns: `=Revenue / Average stores` — history computing its own productivity (D-Mart's recent figure lands in the ₹140–150 crore per store region). In the Estimate columns: `=Prior year × (1 + productivity growth)`, where productivity growth is a blue dial defensible via same-store-sales commentary in concalls.

**Step 4 — the revenue line itself.** `Revenue = Average stores × Revenue per store`, Estimate columns only. The Actual columns keep the spread truth (via the A/E flag branch from 4.5).
👉 What you'll see: a revenue line where every embedded belief — store adds, productivity growth — is a visible blue dial. "What if they open 60 stores?" is now one dial-turn. That's the architecture from 4.5, paying rent.

**Step 5 — the glide path for far years.** Years one and two carry driver precision; year five doesn't deserve it. Fade the implied growth toward a long-run rate using a linear glide: `=Start + (End − Start) × (year − 1)/(n − 1)` — growth walking smoothly from, say, 18% toward 11% across the outer years. Abrupt cliffs (18%, 18%, then suddenly 8%) are the tell of a model that stopped thinking.

**Step 6 — sanity rows, built into the engine.** Beneath revenue, compute what the forecast *implies*: implied store count by FY30, implied revenue per store versus history's range, implied market share if you have a TAM figure. These rows exist to interrogate you before a reviewer does.

For a subscriber business, the identical skeleton re-skins: net adds roll-forward → average subscribers → ARPU build (Jio's sits near ₹200 post the 2024 tariff hikes — and tariff actions are *events* you model as steps, not smooth growth) → revenue = subs × ARPU × 12.

🧠 Remember: Roll-forward → average → per-unit economics → multiply, with drivers near, a faded path far, and implied-metrics rows interrogating the result — the same corkscrew you'll reuse all module.

---

## 🔢 FORMULA: "Price × Volume — Growths Multiply, Never Add"

Formula: `Revenue growth = (1 + price growth) × (1 + volume growth) − 1`

| Variable | Meaning |
|----------|---------|
| price growth (p) | Realisation / ARPU / revenue-per-store growth |
| volume growth (v) | Units / subscribers / average stores growth |

Every revenue line is *how many* × *at what price*, so growth decomposes **multiplicatively, not additively.** Price up 5% and volume up 7% is not 12%:

`(1.05)(1.07) − 1 = 1.1235 − 1 = `**12.35%**

The extra 0.35% is the **cross term** — new volume sold at the new price. Small at small rates, decisive at large ones: price +20%, volume +20% is 44% growth, not 40 — a four-point gap that compounds into an entire scenario's difference over five years.

The decomposition also runs *backwards*, and that direction is analyst gold: D-Mart reports 18% revenue growth, average stores grew 13% → implied productivity growth = `1.18/1.13 − 1 ≈ 4.4%`. **Divide and subtract one — never subtract the rates.** Now you can ask the real question: is that 4.4% per-store growth inflation, footfall, or mix? Growth split into ingredients, each one separately interrogatable — the whole bottom-up philosophy in one operation.

**Plain-English translation:** "New revenue is new volume at the new price — so the two growths multiply through each other, and the bonus sliver is the new units sold at the new price."

**What happens if you get it wrong:** no error code — just a model that systematically under-builds revenue (adding rates) or mis-attributes growth (subtracting rates), with the gap compounding silently every forecast year.

**Watch out:** the same law governs *any* two stacked growth rates — store growth × productivity, subscriber growth × ARPU, even FX × local growth for exporters. Multiplicative, always.

Signal: an interviewer asking "5% price, 7% volume — revenue growth?" is checking for 12.35 versus 12 — a one-word test of whether you think in mechanisms or shortcuts.

Analyst Insight: concall language maps straight onto this — "realisation" is p, "offtake/volumes" is v — and pricing-power stories versus volume stories have opposite margin implications, which the cost build below exploits.

🧠 Remember: Growths multiply — (1+p)(1+v)−1 — and dividing reported growth by volume growth extracts the hidden price story.

---

## 🔬 DEEP DIVE: "The Cost Build — Easy, Because Most Costs Follow Revenue"

Revenue was hard. Costs are mostly easy, because most of them scale with revenue — and the few that don't, you handle deliberately. The key distinction:

- **Variable costs** move with revenue: COGS, freight, packaging. Forecast as a **% of revenue**, anchored to the historical average (from the spread's common-size analysis). If COGS has run at 60% of revenue for five years, forecast 60% — and any deviation needs a *story* (input cost pressure, mix shift).
- **Fixed costs** don't move much with revenue: rent, core salaries, admin. They grow slowly (inflation-ish), independent of sales. Forecast as **prior year × a small growth rate**, not as a percentage of revenue.

**The build, line by line (Estimate columns):**

**Step 1 — COGS:** `=Revenue × gross margin assumption` gives gross profit; COGS = Revenue − Gross profit. (Gross margin is the dial — cleaner than forecasting COGS directly.)

**Step 2 — Employee costs:** if largely fixed, `=Prior year × (1 + wage inflation)`; if scaling (a growing retailer hiring per store), tie partly to store count. Judgement call, stated.

**Step 3 — Other expenses:** the long tail — usually `=Revenue × historical %`, since much of it (freight, utilities, selling costs) is genuinely variable.

**Step 4 — Depreciation: DO NOT guess.** It comes from the capex schedule (Session 4.8). Leave it as a *link* to that schedule — for now, a placeholder. This is the rule from Session 4.1, enforced: depreciation is never "grow it 10%."

**Step 5 — Interest: DO NOT guess.** It comes from the debt schedule (Session 4.8). Another placeholder link.

**Step 6 — Tax:** `=PBT × tax rate`. India's headline corporate tax under the concessional regime (Section 115BAA) is **22% plus surcharge and cess, an effective ~25.17%** for companies that opted in — and most large listed companies have. New manufacturing companies could access an even lower ~17% rate (115BAB). Use the company's *actual effective tax rate* from history (compute it: Tax ÷ PBT across the spread years) rather than the headline — real ETRs differ due to deferred tax, exempt income and the like.

**Step 7 — EPS:** `=PAT / shares outstanding`. Hold shares constant unless there's a known buyback or issuance.

**The operating leverage insight** that makes cost-building *analytical*, not mechanical: when revenue grows but fixed costs don't, **margins expand automatically** — more rupees of revenue spread over the same fixed base, so a larger share survives to EBITDA. This is why a growing company's EBITDA margin often rises even with flat gross margins — and it's exactly Zomato's FY24 story from Session 4.1: revenue outran the (relatively fixed) cost base, and EBITDA flipped positive. Model fixed costs as fixed, and operating leverage *emerges* from the arithmetic — you don't have to assume margin expansion, you let it happen.

🧠 Remember: Variable costs as % of revenue, fixed costs grown slowly, depreciation and interest as links to schedules, tax at the real effective rate — and operating leverage emerges when you keep fixed costs fixed.

---

## ⚠️ MISTAKE: "The Hockey Stick Nobody Can Cash"

The error: forecast growth untethered from physical reality — 20% forever because the recent past was 20%, or because the story is exciting. The graph bends upward like a hockey stick; the name is an industry insult.

Why it happens: extrapolation feels rigorous (it uses data!), optimism feels like conviction, and Excel never objects — it computes 20% in year eight as cheerfully as year one. The correct understanding: **every growth rate implies a physical claim, and the claim must survive arithmetic.** Growth must cash out into stores that need viable locations, subscribers that must exist within a finite population, market share that named competitors must surrender.

The interrogation ritual — the sanity rows from the deep dive, now as law:

1. **Implied units:** 20% growth on a store-driven model implies how many stores by FY30 — and could this company realistically find, fit out and staff that many viable locations every year? (D-Mart's history is a lesson in how hard fast *quality* expansion is — its ownership-economics filter deliberately limits store velocity.)
2. **Implied share:** revenue ÷ a reasonable TAM — does FY30 imply a share requiring competitors to collapse? Name them or cut the number.
3. **Implied productivity:** revenue per store/subscriber versus the historical range from the spread — forecasts outside the historical leash need a *stated* story, not silent drift.
4. **The fade test:** almost nothing compounds at 20%+ for a decade — large numbers fight back. Outer years fade toward nominal-GDP-plus-something unless the story explicitly says otherwise.

The consequence: in reviews and interviews, the first question is always "what does your FY30 number imply?" — and a hockey stick has no answer, because the implication was never computed. The model isn't wrong yet; it's *indefensible*, which on a desk is the same thing.

🧠 Remember: Every growth rate is a physical claim — compute the implied stores, share and productivity, and let arithmetic veto adrenaline.

---

## 📊 REAL WORLD: "D-Mart by the Numbers — A Driver Tree You Can Audit"

Avenue Supermarts is the cleanest revenue-modelling case on the NSE, because its drivers are public and physical. FY24: revenue of about **₹50,789 crore** on a store count reaching roughly **365** by March 2024, having added on the order of **40 stores** in the year. Divide: revenue per store in the neighbourhood of **₹145 crore** on average stores — a productivity figure you *compute*, not copy.

Now watch the driver tree discipline a real forecast. Suppose a bull case whispers "they could triple revenue by FY30." Cash the claim: at productivity growing a defensible ~5% a year, tripling revenue demands roughly doubling-plus the store base — call it 750-plus stores by FY30, meaning ~65 new stores *every year*, against a company whose best years have delivered around 40–50, each store needing land, fit-out, supply chain and a catchment clearing D-Mart's famously strict ownership-economics filter. The tree just converted "triple" from a vibe into a build-rate — and the build-rate is checkable against management's stated pipeline every quarter.

This is why desks love driver-disclosing companies: each quarterly release *grades your leaves*. Store adds land — your addition assumption is marked. Revenue prints — implied productivity is marked. The model stops being a prophecy and becomes a running scoreboard, updated four times a year through the A/E flag roll-forward from 4.5.

🧠 Remember: ₹50,789 cr ÷ ~350 average stores ≈ ₹145 cr each — and any growth claim must cash out into a store build-rate the company's own history says is achievable.

---

## 🎨 VISUAL: "The Driver Tree and the Cost Cascade"

Create a dark-themed infographic with navy background (#02073D), split into two panels. Left panel, "REVENUE — THE DRIVER TREE" : a root node at top in glowing blue (#246BFD) "Revenue FY26E ₹—"; two branches in purple (#6A5CFF) — "Average stores" and "Revenue per store"; the stores branch splitting into leaves "Opening (= FY25 closing)" and "New stores: 45 ◀ blue dial" with a small roll-forward corkscrew icon; the productivity branch splitting into "FY25 actual ≈ ₹145 cr (computed)" and "growth: 5% ◀ blue dial"; each leaf carrying a tiny shield icon "defensible: guidance / concall / history". Below, a lavender (#F5ECFF) strip of three sanity gauges — "implied FY30 stores vs build-rate history", "implied share of TAM", "implied productivity vs range". A small pink (#FF6AC1) chip in the corner: "(1+p)(1+v)−1 — growths multiply". Right panel, "COSTS — THE CASCADE" : a vertical flow from "Revenue" down through cost blocks, each tagged with its forecasting method — "COGS = % of revenue (variable)" in blue, "Other expenses = % of revenue (variable)" in blue, "Employee/Rent = prior × inflation (fixed)" in purple, "Depreciation = LINK to capex schedule" and "Interest = LINK to debt schedule" both drawn as dashed placeholder boxes with arrows pointing off-panel to "Session 4.8", "Tax = PBT × ~25.17% effective" in pink — landing on "PAT → EPS". A glowing side-note arrow points at the gap between revenue and fixed costs: "fixed costs stay flat → operating leverage → margins expand on their own". Title at top: "Revenue Is Built; Costs Mostly Follow." Style: clean, minimal, professional financial infographic, Valuevade dark cosmic aesthetic.

What this visual shows: the effortful driver tree beside the easy cost cascade — every revenue leaf a defensible dial with sanity gauges, every cost line tagged with its method, and the two schedule-fed lines correctly drawn as links — so the student sees exactly where to spend modelling energy.

🧠 Remember: Revenue is a tree you build leaf by leaf; costs are a cascade that mostly follows revenue — with depreciation and interest linked from schedules, never guessed.

---

## 📋 SUMMARY: "Forecasting the P&L — Key Takeaways"

This session in 60 seconds:

1. Revenue is the most expensive row — its errors scale every cost, margin and valuation downstream — so it gets a driver tree decomposed until every endpoint is a defensible opinion: built bottom-up, sanity-checked top-down, with drivers near and a faded glide path far.
2. The build pattern to memorise: roll-forward (opening + additions = closing) → average units → per-unit economics computed from history and grown by a blue dial → multiply — the same corkscrew that reappears for PP&E, working capital and debt.
3. Growths multiply, never add: (1+p)(1+v)−1 — 5% price and 7% volume is 12.35%, the cross term is real money at scale, and dividing reported growth by volume growth extracts the price story for interrogation.
4. Costs are mostly easy: variable costs (COGS, freight) as a % of revenue anchored to history; fixed costs (rent, core salaries) grown slowly; depreciation and interest as *links* to their schedules, never guessed; tax at the company's real effective rate (~25.17% headline for 115BAA opt-ins) — and operating leverage emerges automatically when fixed costs stay fixed.
5. The one thing to never forget going into an interview: every growth rate is a physical claim — compute the implied stores, subscribers, share and productivity, and if the arithmetic can't be cashed (65 D-Mart stores a year against a 40–50 history), cut the assumption before someone cuts it for you.

What you can now do: build a driver-based revenue engine for any disclosed-driver Indian business with blue-dial assumptions, glide paths and sanity rows, and build the cost lines that hang off it down to PAT and EPS — leaving depreciation and interest as links for the schedules ahead.

🧠 Remember: Roll forward, average, multiply, interrogate for revenue — then let costs cascade and operating leverage emerge.

---

## QUIZ

### Q1. Realisation grows 8% and volumes grow 6%. Revenue growth is:

a) 14.00%
b) 14.48%
c) 14.24%
d) 48.00%

✅ Answer: b) 14.48%
📝 Why: (1.08)(1.06) − 1 = 1.1448 − 1 = 14.48%. The 0.48% cross term is new volume sold at the new price; adding rates (option a) systematically under-builds revenue, and the gap compounds every forecast year.

### Q2. Which cost line should NOT be forecast as a percentage of revenue?

a) COGS
b) Freight and packaging
c) Depreciation
d) Selling and distribution expenses

✅ Answer: c) Depreciation
📝 Why: Depreciation comes from the capex schedule (Session 4.8) — it depends on the asset base and capex history, not on this year's sales. Forecasting it as a % of revenue is a classic error that breaks the link between capex and the P&L. The others are genuinely variable.

### Q3. A retailer's revenue formula uses *closing* stores instead of *average* stores. The systematic effect is:

a) Understated revenue — new stores are ignored
b) Overstated revenue — stores opened late in the year are credited a full year's sales
c) No effect — it nets out
d) #VALUE! errors

✅ Answer: b)
📝 Why: A store opened in February traded for weeks but closing-count logic bills it twelve months. Averaging opening and closing is the honest mid-year approximation — a per-store error that compounds across 45 additions a year, every year.

### Q4. True or False: If you forecast fixed costs as flat-ish (growing only with inflation) while revenue grows faster, EBITDA margin will tend to expand on its own.

a) True
b) False

✅ Answer: a) True
📝 Why: That's operating leverage — more revenue spread over the same fixed base means a larger share survives to EBITDA. You don't assume margin expansion; you let it emerge from the arithmetic of fixed costs staying fixed. It's exactly Zomato's FY24 flip.

### Q5. Fill in the blank: For the tax line, rather than the headline rate, you should use the company's actual ______ tax rate, computed as Tax ÷ PBT across the historical years.

✅ Answer: Effective
📝 Why: Effective tax rates differ from the ~25.17% headline (for 115BAA opt-ins) due to deferred tax, exempt income and credits. Computing the real ETR from the spread and applying it forward is more accurate than plugging the statutory rate — a small refinement that separates careful modellers.

---

## INTERVIEW QUESTIONS

### 🎙️ IQ1: "Forecast Reliance Jio's revenue for me — structure first, numbers second."
*A driver-tree construction test at ER and telecom-desk rounds — they want the decomposition, then the opinions.*

**Answer Framework:**
- Name the tree before any number: "Revenue = average subscribers × ARPU × 12 — two branches, each independently forecastable and disclosed every quarter."
- The subscriber branch: "A roll-forward — opening subs plus net adds, where net adds are my dial, calibrated to recent quarterly run-rates, 5G migration and feature-phone conversion."
- The ARPU branch as events plus drift: "ARPU sits near ₹200 after the 2024 tariff hikes — and tariff actions are step changes I model as discrete dated events, layered over gentle mix-driven drift, never smoothed into a fake CAGR."
- The sanity ceiling: "Implied subscribers against India's total wireless base and the three-player structure — my net adds must come from somewhere nameable."
- Close: "Near years carry the event calendar and driver precision; outer years fade to a defensible drift — and every quarterly release grades both branches separately."

**🔑 Power Phrase:** "Subscribers times ARPU — and ARPU moves in steps when tariffs move, so I model events, not averages."

**⚠️ Trap:** Forecasting Jio with a single revenue-growth percentage. The drivers are publicly reported every quarter — ignoring them signals you've never read a release.

### 🎙️ IQ2: "How do you forecast each cost line in a P&L? Walk me through your logic."
*A method question at ER and IB rounds — tests whether you distinguish variable from fixed and know what comes from schedules.*

**Answer Framework:**
- The organising split: "First I classify each line as variable or fixed. Variable costs move with revenue and get forecast as a % of revenue anchored to the historical average; fixed costs grow slowly with inflation, independent of sales."
- Concrete examples: "COGS, freight, selling expenses — % of revenue. Core salaries, rent, admin — prior year times a small growth rate."
- The two lines that aren't free: "Depreciation and interest I never forecast in the P&L — they're *links* to the capex and debt schedules, because they depend on the asset base and the debt balance, not on this year's sales."
- Tax, precisely: "PBT times the company's *effective* rate from history, not the headline — deferred tax and exempt income make the real ETR differ from the statutory ~25%."
- Close with the payoff: "Keeping fixed costs fixed means operating leverage emerges on its own — I don't have to assume margin expansion; the arithmetic produces it when revenue outgrows the fixed base."

**🔑 Power Phrase:** "Variable costs follow revenue, fixed costs follow inflation, and depreciation and interest follow their schedules — never the P&L's imagination."

**⚠️ Trap:** Saying "I grow every cost line by 10%." That blends variable and fixed, ignores operating leverage entirely, and forecasts depreciation independently of capex — three errors in one shortcut.

### 🎙️ IQ3: "Your model has this company growing at twice the industry rate for five years. Defend it or fix it — live."
*The hockey-stick interrogation at buy-side and ER rounds — testing whether your conviction has arithmetic underneath.*

**Answer Framework:**
- Accept the burden immediately: "Growing at 2x industry means taking share every single year — so the defence must name the donors and the mechanism, or the number gets cut."
- Cash the claim physically: "I'd walk my implied-metrics rows — implied FY30 share of TAM, implied unit count against build-rate history, implied productivity against the historical range — and show each one clears."
- Name the mechanism if defending: "Share gains need a reason that *scales* — a cost structure incumbents can't copy, like D-Mart's ownership model — stated in the model's notes, not implied."
- Concede structurally if fixing: "If any gauge fails, the fix is the glide path — keep near-year conviction where evidence is strongest, fade toward industry-plus in outer years, and move the upside into the Bull scenario where it's priced as possibility, not certainty."
- Close: "Either way the model shows its homework — 2x industry is a claim about competitors *losing*, and claims about other people's failures need the most evidence of all."

**🔑 Power Phrase:** "Outgrowing the industry means naming who loses share, why, and for how long — or fading the number."

**⚠️ Trap:** Defending with the company's own past growth alone. Extrapolation is the hockey stick's native argument — the interviewer is specifically testing whether you have anything else.

---

# SESSION 4.7: The Working Capital Schedule — Where Growth Eats Cash

> "A company can grow revenue 30% and run out of cash doing it. The reason hides in three balance sheet lines — and this schedule is where you catch it before it catches the company."

---

## NOTES

## 🎣 HOOK: "The Cash That Growth Quietly Swallows"

Here's a paradox that sinks real businesses: **growing faster can make you *poorer* in cash.** Sell more, and you must stock more inventory (cash out) and wait longer to collect from more customers (cash not yet in). Revenue is booming on the P&L while the bank balance is draining — and many a profitable Indian SME has gone under in exactly this trap, growing itself to death.

In your 4.4 model, you grew inventory, receivables and payables crudely — "× 1.12 with revenue." That works as a first approximation but hides the real lever. The professional way forecasts these three lines using **days** — how many days of sales are stuck in inventory, how many days customers take to pay, how many days you take to pay suppliers. Days are *behavioural*: they capture how the business actually operates, and they're far more stable and forecastable than the rupee amounts.

This session builds the working capital schedule — the small sheet that turns three balance sheet lines into a precise, days-based forecast, and reveals whether a company's growth *generates* cash or *consumes* it. For some businesses (D-Mart), the answer is delightfully counterintuitive.

🧠 Remember: Growth ties up cash in inventory and receivables — and the working capital schedule, built on days, is where you measure exactly how much.

---

## 💡 CONCEPT: "Working Capital — The Three Lines and the Cycle"

**Working capital** is the cash tied up in running the business day to day. The core of it is three balance sheet lines you already met in Session 4.2:

- **Inventory** — stock sitting in stores and godowns. Cash frozen until sold.
- **Trade receivables (debtors)** — sales made, money not yet collected. Cash owed to you.
- **Trade payables (creditors)** — purchases made, not yet paid for. Cash you're holding onto.

The first two are cash *trapped*; the third is cash *borrowed for free* from suppliers. Net working capital (the simple operating version) = Inventory + Receivables − Payables.

The intuition that runs the whole session — **inventory and receivables are cash going out; payables are cash staying in.** The same sign rule from Session 4.2's cash flow: an asset going up eats cash; a liability going up saves cash. A growing company's inventory and receivables swell (eating cash), partly offset by growing payables (saving cash) — and the *net* of those movements is what the cash flow statement's working capital adjustment captures.

The elegant summary metric: the **Cash Conversion Cycle (CCC)** — how many days a rupee is trapped in the business between paying for stock and collecting from customers. Shorter is better; *negative* is magical (the supplier funds your growth — more on that in the real-world card).

🧠 Remember: Inventory + receivables (cash out) minus payables (cash in) = working capital — and the cash conversion cycle measures how many days a rupee stays trapped.

---

## 🔬 DEEP DIVE: "Building the Working Capital Schedule — Days In, Rupees Out"

On the **WC** tab, under the date spine and flags. The method: compute the historical *days*, forecast the days forward (usually flat or gently trending), then convert days back into rupee balances. Build along.

**Step 1 — compute the three historical days ratios** (in the Actual columns):

- **DIO (Days Inventory Outstanding):** `=Inventory / COGS × 365` — how many days of cost sits in stock.
- **DSO (Days Sales Outstanding):** `=Receivables / Revenue × 365` — how many days of sales are uncollected.
- **DPO (Days Payable Outstanding):** `=Payables / COGS × 365` — how many days you take to pay suppliers.

👉 What you'll see: three behavioural ratios per historical year. A retailer like D-Mart shows very low DSO (customers pay instantly at the till) and meaningful DIO (stock on shelves). An infrastructure company shows enormous DSO (clients pay in months). The *pattern* is the company's operating fingerprint.

(One refinement worth knowing: purists use *average* balances — (opening + closing)/2 — in these ratios to avoid a closing-day snapshot distorting things. For a clean first model, closing balances are fine; just be consistent.)

**Step 2 — forecast the days** (Estimate columns). This is the analyst judgement, and it's usually gentle: days tend to be *sticky* — a company that collected in 45 days for five years will likely keep doing so. So the default forecast is **flat at the recent historical average**, with deviations only for a *reason*: a stated push to reduce inventory, a shift toward credit sales, supplier renegotiation. Each forecast day-count is a blue Inputs dial, defensible from the historical pattern and management commentary.

**Step 3 — convert days back into rupee balances** (Estimate columns) — the formulas reverse:

- Inventory = `DIO / 365 × COGS`
- Receivables = `DSO / 365 × Revenue`
- Payables = `DPO / 365 × COGS`

👉 What you'll see: the three balance sheet lines, now forecast *precisely* — they grow because revenue and COGS grow, scaled by the behavioural days. This is the professional upgrade over 4.4's crude "× 1.12": same direction, but now the growth is anchored to *how the business operates*, and you can flex any single day-count to test a scenario.

**Step 4 — compute net working capital and its change:**

- Net WC = Inventory + Receivables − Payables (each year).
- **Change in WC** = this year's Net WC − last year's Net WC.

👉 What you'll see: the single number that flows to the cash flow statement. An *increase* in net working capital means cash was consumed (−); a *decrease* means cash was released (+). This change-in-WC figure is exactly the working capital adjustment in CFO that you'll wire up in Session 4.9.

**Step 5 — compute the Cash Conversion Cycle:** `CCC = DIO + DSO − DPO`. 
👉 What you'll see: the company's cash-trapped days in one number. Falling CCC over the forecast → the business is getting more cash-efficient as it grows. Rising CCC → growth is getting thirstier. Negative CCC → the supplier is funding the business (the D-Mart magic, next card).

🧠 Remember: Compute historical days (DIO/DSO/DPO), forecast them sticky-flat as dials, convert back to rupee balances, then the *change* in net WC flows to the cash flow — and CCC = DIO + DSO − DPO summarises it all.

---

## 🔢 FORMULA: "The Cash Conversion Cycle — Days a Rupee Stays Trapped"

Formula: `CCC = DIO + DSO − DPO`

| Component | Meaning | Direction |
|-----------|---------|-----------|
| DIO | Days inventory sits before sale | Adds (cash trapped in stock) |
| DSO | Days customers take to pay | Adds (cash trapped in receivables) |
| DPO | Days you take to pay suppliers | Subtracts (cash you hold onto) |

The story the formula tells: a rupee enters when you *pay* for inventory, and exits when you *collect* from the customer. DIO + DSO is how long it's trapped; DPO is how long you delayed paying for it, which shortens the trap. The net is the cash conversion cycle.

Example — a typical manufacturer: DIO 60 + DSO 45 − DPO 30 = **75 days**. Seventy-five days of every rupee of growth is locked up — so growing revenue by ₹100 crore ties up roughly 75/365 × ₹100 cr ≈ ₹20 cr of extra cash that the business must fund from somewhere (its own cash, or debt).

**Plain-English translation:** "How many days pass between me paying for stock and finally collecting the cash from selling it — minus the days I made the supplier wait."

**What happens if you get it wrong:** mixing the denominators — using revenue for DIO/DPO instead of COGS — is the classic slip. Inventory and payables relate to *cost* (what you paid), receivables relate to *sales* (what you charged). Mix them and the days are nonsense, though no error appears.

**Watch out:** a falling CCC is usually good (cash-efficient growth), but a *suddenly* falling DPO-driven CCC can be bad news in disguise — suppliers demanding faster payment, often a sign they've lost confidence. Always ask *why* a ratio moved, not just which direction.

Signal: negative CCC → the business collects before it pays, so growth *generates* cash. Long positive CCC → growth is cash-hungry and the company likely needs working capital financing. This single number tells you whether scale is a friend or an enemy to the balance sheet.

Analyst Insight: in a screen, CCC instantly separates business models — supermarkets and quick-commerce (negative or tiny) versus EPC and capital goods (long and dangerous). It's one of the fastest reads of business quality on the balance sheet.

🧠 Remember: CCC = DIO + DSO − DPO — days a rupee is trapped; negative means suppliers fund your growth, long-positive means growth drinks cash.

---

## ⚠️ MISTAKE: "Forecasting the Rupees Instead of the Days"

The error: forecasting inventory, receivables and payables as flat percentages of revenue, or just growing them at the revenue rate (the 4.4 shortcut, left un-upgraded), instead of forecasting the underlying *days*. Why it seems fine: rupees and days move together when nothing changes, so the crude method *looks* equivalent.

It isn't, for two reasons. First, **days are where the analytical insight lives.** "Receivables will be ₹140 cr" tells you nothing; "DSO holds at 45 days" tells you the company's collection behaviour and lets you immediately spot if it's deteriorating. When you forecast rupees directly, you've thrown away the diagnostic. Second, **days are more stable and forecastable than rupees.** A company's collection period is a behavioural constant that barely moves year to year; the rupee receivables balance swings wildly with revenue. Forecasting the stable thing (days) and deriving the volatile thing (rupees) is always more robust than forecasting the volatile thing directly.

Where it bites concretely: a company announces a working-capital improvement programme — "we're cutting inventory days from 60 to 45." In a days-based model, you change one dial (DIO: 60 → 45) and watch the cash release flow through. In a rupees-based model, there's no clean lever — you'd have to back into a percentage, and you've lost the ability to model the company's *actual stated plan*. The days framework isn't just more accurate; it's how you model what management actually tells you they'll do.

And the deeper trap: forecasting receivables as a flat % of revenue *hides deterioration*. If a company is quietly extending credit to push sales (DSO creeping from 45 to 60 to 80), a days model screams it; a flat-percentage model silently scales the problem and calls it growth. Receivables ballooning faster than revenue is one of the loudest red flags in forensic analysis — and only the days view shows it.

🧠 Remember: Forecast the days (stable, diagnostic), derive the rupees (volatile, downstream) — never the reverse, or you lose both the insight and the ability to model management's actual plans.

---

## 📊 REAL WORLD: "D-Mart's Negative Working Capital — The Supplier Funds the Growth"

Here's the counterintuitive magic that makes D-Mart's model so admired. At a supermarket, customers pay *instantly* — cash or UPI at the till — so DSO is essentially **zero**. But D-Mart pays its *suppliers* on credit terms — days, sometimes weeks, later. So the company collects cash from customers *before* it has to pay for the goods.

Run the CCC: DIO (some inventory days) + DSO (near zero) − DPO (meaningful supplier credit). For a well-run supermarket, DPO can rival or exceed DIO, pushing the cash conversion cycle toward **zero or negative**. When CCC is negative, something remarkable happens: **growth generates cash instead of consuming it.** Every new store, every extra rupee of sales, *releases* working capital — the suppliers are effectively funding D-Mart's expansion for free. This is a structural advantage that capital-hungry businesses can only dream of, and it's a big part of why D-Mart can fund aggressive store expansion without drowning in debt.

Contrast the dark mirror: an EPC or infrastructure company books revenue on long projects, collects from government and large clients over *months or years* (DSO of 150+ days), while still paying its own suppliers and labour. CCC stretches enormously, every rupee of growth devours cash, and the company lives on working-capital debt — which is exactly why so many Indian infra firms, profitable on paper, have buckled under their financing. Same country, same accounting, opposite cash dynamics — and the working capital schedule is where you see it years before the headlines do.

🧠 Remember: D-Mart collects before it pays (negative CCC), so growth *funds itself* — the structural opposite of an EPC firm whose 150-day DSO makes growth a cash trap.

---

## 🎨 VISUAL: "The Cash Conversion Cycle — Trapped Days on a Timeline"

Create a dark-themed infographic with navy background (#02073D), centred on a horizontal timeline showing the journey of one rupee. Far left, a blue (#246BFD) marker "Pay supplier for inventory (day 0)". Moving right, a shaded bar labelled "DIO: inventory sits 60 days" in purple (#6A5CFF), then a continuing bar "DSO: wait 45 days to collect" in purple, ending at a marker "Collect cash from customer (day 105)". Below the timeline, a pink (#FF6AC1) bracket spanning the first 30 days labelled "DPO: supplier paid on day 30 (we held cash 30 days)". A large summary box on the right: "CCC = 60 + 45 − 30 = 75 days trapped" with a caption "growing ₹100 cr ties up ~₹20 cr of cash". Bottom of the frame, a split comparison strip: left half titled "D-MART (negative CCC)" in green glow — "DSO ≈ 0 (instant payment) − long DPO → growth RELEASES cash, supplier funds expansion"; right half titled "EPC FIRM (long CCC)" in red — "DSO 150+ days → growth DEVOURS cash, lives on WC debt". A small lavender (#F5ECFF) note: "forecast the DAYS (sticky), derive the rupees — never the reverse". Title at top: "How Many Days Is Your Rupee Trapped?" Style: clean, minimal, professional financial infographic, Valuevade dark cosmic aesthetic.

What this visual shows: the cash conversion cycle as a physical timeline of a trapped rupee, with the two extreme business models (D-Mart's self-funding growth vs the EPC cash trap) side by side — so the student instantly grasps why CCC is a core read of business quality.

🧠 Remember: A rupee trapped from paying for stock to collecting from the customer, minus supplier credit — and whether that number is negative or huge tells you if growth helps or hurts.

---

## 📋 SUMMARY: "The Working Capital Schedule — Key Takeaways"

This session in 60 seconds:

1. Working capital is cash tied up in day-to-day operations — inventory + receivables (cash trapped) minus payables (free supplier credit) — and growth swells it, which is how profitable companies run out of cash.
2. The professional method forecasts *days*, not rupees: compute historical DIO (Inventory/COGS×365), DSO (Receivables/Revenue×365) and DPO (Payables/COGS×365), forecast them sticky-flat as blue dials, then reverse the formulas to derive forecast rupee balances — the precise upgrade over 4.4's crude "× revenue."
3. The *change* in net working capital (this year's minus last year's) is the single number that flows to the cash flow statement's CFO — an increase consumes cash, a decrease releases it — wired up in Session 4.9.
4. The Cash Conversion Cycle (DIO + DSO − DPO) summarises how many days a rupee stays trapped: negative means the supplier funds your growth (D-Mart's structural magic), long-positive means growth devours cash (the EPC trap) — one of the fastest reads of business quality on the balance sheet.
5. The one thing to never forget going into an interview: forecast the days, derive the rupees — never the reverse — because days are stable and diagnostic, they let you model management's actual stated plans (cutting DSO from 60 to 45 is one dial), and a flat-percentage receivables forecast silently hides the credit-stuffing deterioration that days expose.

What you can now do: build a days-based working capital schedule for any company, compute and interpret its cash conversion cycle, forecast the three lines precisely, and produce the change-in-working-capital figure that feeds the cash flow statement.

🧠 Remember: Days in, rupees out — and the cash conversion cycle tells you whether growth is the balance sheet's friend or its enemy.

---

## QUIZ

### Q1. Days Sales Outstanding (DSO) is correctly computed as:

a) Receivables / COGS × 365
b) Receivables / Revenue × 365
c) Inventory / Revenue × 365
d) Payables / Revenue × 365

✅ Answer: b) Receivables / Revenue × 365
📝 Why: Receivables arise from *sales* (what you charged customers), so the denominator is revenue. Inventory and payables relate to *cost* (what you paid), so they use COGS. Mixing the denominators is the classic working-capital error — it produces nonsense days with no error message.

### Q2. A company's CCC is DIO 50 + DSO 70 − DPO 40 = 80 days. It then announces it will cut DSO to 40 days. The new CCC and the cash effect are:

a) 50 days; cash is released
b) 110 days; cash is consumed
c) 50 days; cash is consumed
d) 80 days; no change

✅ Answer: a) 50 days; cash is released
📝 Why: New CCC = 50 + 40 − 40 = 50 days, down from 80. Trapping a rupee for fewer days frees up cash — collecting faster pulls cash in sooner. This is exactly the kind of management plan a *days-based* model captures with a single dial change.

### Q3. In a days-based schedule, forecast inventory is derived as:

a) Prior year inventory × revenue growth
b) DIO / 365 × COGS
c) DIO × Revenue / 365
d) Inventory % of total assets

✅ Answer: b) DIO / 365 × COGS
📝 Why: You forecast the *days* (DIO), then reverse the ratio to get rupees — and inventory relates to COGS, not revenue. Option (a) is the crude 4.4 method that throws away the days insight; option (c) uses the wrong denominator.

### Q4. True or False: A negative cash conversion cycle means the company collects cash from customers before it has to pay its suppliers, so growth generates cash.

a) True
b) False

✅ Answer: a) True
📝 Why: Negative CCC (D-Mart's situation: near-zero DSO, meaningful DPO) means suppliers effectively fund the business — every extra rupee of sales *releases* working capital. It's a structural advantage that lets such companies grow without drowning in working-capital debt.

### Q5. Fill in the blank: The figure that flows from the working capital schedule into the cash flow statement is the ______ in net working capital, where an increase consumes cash and a decrease releases it.

✅ Answer: Change (year-on-year change)
📝 Why: The cash flow cares about the *movement*, not the level — this year's net WC minus last year's. More cash gets trapped when WC rises (outflow), cash is freed when it falls (inflow). Session 4.9 wires this exact number into CFO.

---

## INTERVIEW QUESTIONS

### 🎙️ IQ1: "How would you forecast a company's working capital, and why use days instead of just growing the balances?"
*A method question at ER and IB rounds — tests whether you understand the days framework and its analytical payoff.*

**Answer Framework:**
- The method, crisply: "Compute the historical days — DIO, DSO, DPO — forecast them, usually holding them flat at the recent average since they're behaviourally sticky, then convert back to rupee balances."
- Why days, reason one: "Days are where the insight is — 'DSO at 45 days' tells me the collection behaviour and immediately flags deterioration; 'receivables of ₹140 cr' tells me nothing diagnostic."
- Reason two: "Days are more stable and forecastable than rupees — collection periods barely move year to year, while rupee balances swing with revenue. Forecasting the stable thing and deriving the volatile thing is more robust."
- The clincher — modelling reality: "If management says they'll cut inventory days from 60 to 45, a days model captures that with one dial and shows the cash release; a rupees model has no clean lever for it."
- Close: "And days expose credit-stuffing — receivables growing faster than revenue is a major red flag that a flat-percentage forecast would silently hide."

**🔑 Power Phrase:** "Forecast the days because they're stable and diagnostic; the rupees are just downstream — and days let me model exactly what management says they'll do."

**⚠️ Trap:** Saying "I'd grow them with revenue." That's the crude approximation — it works numerically when nothing changes but throws away the entire diagnostic value and can't model improvement plans.

### 🎙️ IQ2: "Explain the cash conversion cycle, and tell me what a negative one means."
*A conceptual question at every level — the negative-CCC insight separates those who understand business models from those who memorised a formula.*

**Answer Framework:**
- Define it physically: "DIO plus DSO minus DPO — the number of days a rupee is trapped between paying for inventory and collecting from the customer, shortened by how long I make suppliers wait."
- The cash impact: "A long positive CCC means growth devours cash — every extra rupee of sales locks up working capital that must be funded by cash or debt."
- The negative case, with the example: "Negative CCC means I collect *before* I pay — like a supermarket where customers pay instantly but suppliers are paid on credit. Growth then *generates* cash; suppliers effectively fund the expansion. D-Mart is the textbook Indian case."
- The dark mirror: "The opposite extreme is EPC and infrastructure — 150-day-plus DSO from slow-paying clients makes growth a cash trap, which is why so many profitable-on-paper infra firms collapse under working-capital debt."
- Close: "So CCC is one of the fastest reads of business quality on the balance sheet — it tells me whether scale is a friend or an enemy."

**🔑 Power Phrase:** "Negative cash conversion means the supplier funds your growth — it's the structural opposite of the infra firm whose growth drinks cash."

**⚠️ Trap:** Reciting the formula without explaining what negative means or giving a real example. The concept's whole value is the business-quality insight, not the arithmetic.

### 🎙️ IQ3: "A company's revenue grew 25% but its operating cash flow fell. Working capital is a suspect — how do you investigate?"
*A diagnostic question connecting working capital to cash flow — tests whether you can trace a symptom to its balance sheet source.*

**Answer Framework:**
- Frame the paradox: "Revenue up, CFO down — the prime suspect is working capital eating the cash that the P&L is reporting as profit."
- Go to the days: "I'd compute DSO, DIO and DPO across the years. If DSO is climbing — say 45 to 65 days — the company is collecting slower, possibly extending credit to manufacture that 25% growth, and the uncollected cash is sitting in receivables."
- Check the other levers: "Rising DIO means inventory building up — overproduction or slowing sell-through. Falling DPO means suppliers are demanding faster payment, often a confidence signal."
- Quantify it: "The change in net working capital is the exact drag on CFO — I'd isolate that number and see if it explains the entire gap between profit and cash."
- Close with the judgement: "If the growth came with deteriorating days, it's low-quality growth — revenue bought with the balance sheet — and I'd weight cash flow over the P&L in my assessment, because the cash flow confessed what the P&L is hiding."

**🔑 Power Phrase:** "Revenue up with cash down almost always means working capital ate the difference — and the days show me exactly which line did the eating."

**⚠️ Trap:** Looking only at the P&L. The entire point is that the P&L looks *fine* — the answer lives in the balance sheet's days and the change in working capital, which is precisely what this schedule surfaces.

---

# SESSION 4.8: Capex, Depreciation & Debt Schedules — plus Circularity, Gently

> "In Session 4.6 you left depreciation and interest as blank placeholders. Today you build the two small sheets that fill them — and meet the famous circular reference that scares beginners and is actually a one-checkbox fix."

---

## NOTES

## 🎣 HOOK: "The Two IOUs Your P&L Has Been Waiting On"

Remember the rule from Session 4.6: depreciation and interest are *never* forecast inside the P&L — you left them as placeholder links, promising to build the schedules that feed them. Today you keep that promise.

Why couldn't they be guessed? Because both depend on *balances that roll over time*. Depreciation depends on the asset base — which grows with capex and shrinks as things wear out. Interest depends on the debt balance — which grows with new loans and shrinks with repayments. Neither is "last year × some growth"; both need a little engine tracking the balance year by year. Those engines are **schedules**.

You already know the shape — it's the corkscrew roll-forward from the D-Mart store build: *opening + additions − reductions = closing.* Capex schedule: opening assets + capex − depreciation = closing assets. Debt schedule: opening debt + new borrowing − repayment = closing debt. Same skeleton, twice. Build them, link them back to the P&L, and two of your placeholders come alive.

And then, when interest feeds back into the model, something subtle happens — the model starts referring to itself in a loop. That's the **circular reference**, the thing beginners panic about. By the end of this session you'll see it's logical, expected, and fixed with a single checkbox.

🧠 Remember: Depreciation and interest come from schedules — small roll-forward engines tracking the asset and debt balances — because both depend on balances that change over time.

---

## 💡 CONCEPT: "Schedules — The Corkscrew, Reused Twice"

A **schedule** is a small supporting sheet that calculates one item in detail, then feeds a clean number back to the main statements. You've already built one (the store roll-forward); these two follow the identical pattern.

**The capex & depreciation schedule** tracks the asset base (PP&E):

- Opening PP&E (= last year's closing)
- **+ Capex** (new assets bought — a blue assumption or driver-linked)
- **− Depreciation** (assets wearing out — calculated)
- = Closing PP&E

The closing PP&E flows to the balance sheet; the depreciation figure flows to the P&L. Two outputs, one schedule.

**The debt schedule** tracks borrowings:

- Opening debt (= last year's closing)
- **+ New borrowing** (draws — assumption)
- **− Repayments** (scheduled paydowns — assumption)
- = Closing debt

The closing debt flows to the balance sheet; the interest (computed on the balance) flows to the P&L. Again, two outputs, one schedule.

The principle that makes schedules worth the trouble: **detail lives in the schedule; the statements stay clean.** Your P&L shows one depreciation line and one interest line — tidy and readable — while the messy year-by-year asset and debt tracking happens off to the side. This is the same separation-of-concerns idea as the three-layer architecture: keep the machinery contained, expose only clean results.

🧠 Remember: A schedule is a roll-forward engine (opening + additions − reductions = closing) that calculates one item in detail and feeds a clean number to the statements — depreciation from the capex schedule, interest from the debt schedule.

---

## 🔬 DEEP DIVE: "Building the Capex & Depreciation Schedule"

On the **Capex** tab, under the date spine and flags. Build along.

**Step 1 — the gross block roll-forward.** Rows: Opening gross block, Capex (additions), Closing gross block. Opening FY26 links to FY25 closing. Capex is your assumption — and here's the analyst layer: capex isn't one blob. It splits into **maintenance capex** (replacing worn-out assets, keeps the business running) and **growth capex** (new stores, new plants, expansion). For D-Mart, growth capex ties to the store-addition plan — roughly stores added × cost per store — making it a *driver*, not a guess. Maintenance capex often runs near the depreciation level (you replace roughly what wears out).
👉 What you'll see: the asset base growing by what the company invests, split into "keeping the lights on" versus "getting bigger" — a distinction that matters enormously for valuation later.

**Step 2 — the depreciation calculation.** Two common methods:

- **Straight-Line Method (SLM):** the same rupee amount each year over the asset's life. `=Asset cost / useful life`. A ₹100 cr asset with a 10-year life → ₹10 cr a year. Simple, and what most large companies use for reporting under Ind AS / Schedule II.
- **Written-Down Value (WDV):** a fixed *percentage* of the *remaining* balance each year — so depreciation is high early, low later. `=Opening balance × rate`. Common for tax purposes in India.

For a forecast model, the clean approximation: **depreciation = depreciation rate × opening gross block** (or opening net block), where the rate is computed from history (historical depreciation ÷ historical gross block). This is the practical method — it captures the relationship without needing an asset-by-asset register.
👉 What you'll see: a depreciation figure that grows naturally as the asset base grows — exactly right, because more assets means more depreciation.

**Step 3 — the more precise "waterfall" (know it exists).** The rigorous version tracks each year's capex as its own layer, each depreciating over its own life — new capex starts a fresh depreciation stream that stacks on top of the existing ones. This "depreciation waterfall" is what detailed sell-side models use. For most purposes the rate-based approximation in Step 2 is fine; mention the waterfall in interviews to show you know the precise method exists.

**Step 4 — close the schedule and link out.** Closing net block = Opening + Capex − Depreciation. This closing figure → balance sheet PP&E. The depreciation figure → the P&L's depreciation line (filling one of Session 4.6's placeholders) *and* → the cash flow's add-back *and* → the cash flow's CFI (as capex). One schedule, feeding all three statements — exactly the "shared items" from Session 4.3.
👉 What you'll see: placeholder number one, depreciation, now live — and capex flowing to CFI. The P&L's EBIT now responds to your capex assumptions, as it should.

🧠 Remember: Gross block rolls forward (opening + capex − depreciation), depreciation ≈ rate × opening block (with the waterfall as the precise version), capex splits into maintenance vs growth, and the schedule feeds PP&E, the P&L and the cash flow at once.

---

## 🔬 DEEP DIVE: "The Debt Schedule, Interest, and the Circular Reference"

On the **Debt** tab. This schedule is where the famous circularity appears — so we build it carefully and then defuse the circle.

**Step 1 — the debt roll-forward.** Rows: Opening debt, New borrowing (draws), Repayments, Closing debt. Opening links to prior closing; draws and repayments are assumptions (often from the company's stated repayment schedule in its filings). Closing = Opening + Draws − Repayments → flows to the balance sheet.
👉 What you'll see: the third corkscrew of the module — identical shape to stores and assets.

**Step 2 — the interest calculation, and the choice that creates the circle.** Interest = interest rate × debt. But *which* debt — opening or average?

- **Interest on opening debt:** `=rate × opening balance`. Simple, no circularity. A perfectly acceptable simplification, and many models use it deliberately to stay clean.
- **Interest on average debt:** `=rate × (opening + closing)/2`. More accurate (debt changes during the year), but it creates a **circular reference.** Here's why, traced slowly:

Interest depends on average debt → average debt depends on closing debt → but if the company uses *surplus cash to pay down debt* (a "cash sweep"), closing debt depends on how much cash was generated → cash generated depends on net income → net income depends on **interest expense.** The snake bites its tail: interest → debt → cash → income → interest. Excel detects this and either warns "circular reference" or shows zeros.

**Step 3 — defusing the circle (the one-checkbox fix).** This circularity is *legitimate* — it reflects real economics (interest genuinely does depend on average balances). So we don't avoid it; we tell Excel to *solve it by iteration*: File → Options → Formulas → tick **"Enable iterative calculation."** Excel then loops the calculation repeatedly until the numbers stop changing (converge) — typically a few iterations. The circle resolves itself.
👉 What you'll see: with iteration on, the circular formulas compute clean numbers instead of errors or zeros. The model is now solving a genuinely circular piece of real-world logic.

**Step 4 — the safety switch (essential).** Iterative calculation has a dark side: if anything in the model breaks, a circular reference can spiral into **#REF! or wild numbers that cascade everywhere**, and it's hard to debug. So professionals build a **circularity breaker switch**: a single blue cell (say, "Circularity: ON/OFF" = 1 or 0). The interest formula becomes `=IF(switch=1, rate × average debt, rate × opening debt)`. Flip the switch to 0, and interest reverts to the simple non-circular version — instantly breaking the loop so you can find the error, then flip it back. Every serious model has this switch. It is the difference between a circular model you control and one that controls you.

**Step 5 — the cash sweep (the advanced bit, optional).** The most sophisticated debt schedules add a *revolver* or *cash sweep*: if the company generates surplus cash, it automatically pays down debt; if it runs short, it draws more. This makes the model self-financing and realistic — but it's the main *source* of the circularity. For a first real model, a fixed repayment schedule (Step 1) is perfectly fine and avoids the complexity. Know the cash sweep exists; reach for it when the model demands it.

🧠 Remember: Debt rolls forward, interest on average debt creates a legitimate circular reference, "enable iterative calculation" solves it, and a breaker switch (IF on a toggle cell) lets you kill the loop to debug — every serious model has that switch.

---

## ⚠️ MISTAKE: "Panicking at the Circular Reference Warning"

The error: Excel flashes "circular reference" (or cells show 0), and the beginner assumes they've made a catastrophic mistake — frantically deleting formulas, rebuilding, or abandoning the average-debt approach entirely. Why it happens: every other circular reference you've *ever* hit in Excel was a genuine bug (a SUM including its own cell, from Module 3), so the warning trained you to treat circularity as always-wrong.

The correct understanding: **in a financial model, circularity between interest, debt and cash is expected and legitimate.** It's not a bug — it's the model faithfully representing that interest depends on debt balances that depend on cash flows that depend on interest. The economics genuinely loop, so the model loops. The warning isn't saying "you're wrong"; it's saying "this needs iterative calculation turned on."

The two-part professional response: **(1)** enable iterative calculation so Excel solves the loop, and **(2)** install the breaker switch so you can kill the loop on demand. With both in place, circularity is a controlled, understood feature — not a crisis.

Where the *real* danger lies (and what to actually watch for): iterative calculation can *mask* errors. Because Excel is looping and converging, a genuine mistake elsewhere can get absorbed into the circular calculation and produce plausible-but-wrong numbers, or — worse — make the model unstable, with values that change every time it recalculates. This is why the breaker switch matters so much: when something looks off, flip circularity OFF, and if the problem vanishes, you know it was the loop masking something; if it remains, you've isolated the bug from the circularity. The skill isn't avoiding circularity — it's *controlling* it.

🧠 Remember: A circular reference in a debt schedule is expected, not a bug — enable iteration to solve it and build a breaker switch to control it; the danger is iteration *masking* other errors, which the switch helps you isolate.

---

## 📊 REAL WORLD: "Why the Debt Schedule Decides Survival, Not Just Profit"

Consider the heavily-indebted infrastructure and telecom stories that have defined Indian corporate distress — the Vodafone Ideas, the leveraged infra groups carrying tens of thousands of crores in debt. For these companies, the debt schedule isn't a supporting tab — it's *the* tab, because the question isn't "are they profitable?" but "can they service and repay their debt as it comes due?"

Here's what the debt schedule reveals that the P&L hides. A company can be EBITDA-positive — the operations make money — while still failing, because the interest on a mountain of debt devours that EBITDA, and the *repayments* (which never touch the P&L, living only in CFF and the debt schedule) demand cash the company doesn't generate. The debt schedule lays this bare: opening debt, interest eating into cash, repayments falling due, and — critically — whether the company must *borrow more just to repay old debt* (a debt spiral, visible when new borrowing consistently exceeds what operations can fund). Vodafone Idea's years of restructuring, fundraising scrambles and AGR-dues negotiations were, at heart, a debt schedule that didn't close without external rescue.

This is also why the interest-coverage ratio (EBIT ÷ interest) and the debt-maturity profile are among the first things credit analysts and lenders examine — both fall straight out of a well-built debt schedule. And it's why the cash sweep logic, complex as it is, matters for leveraged companies: it models exactly how surplus cash race against the repayment wall. For a healthy, low-debt company like D-Mart, the debt schedule is thin and boring. For a leveraged one, it's where the entire investment thesis — survival or default — gets decided.

🧠 Remember: For leveraged companies the debt schedule decides survival, not profit — it shows whether EBITDA covers interest, whether repayments can be met from cash, and whether the company is borrowing just to repay (the debt spiral the P&L never reveals).

---

## 🎨 VISUAL: "Two Schedules Feeding the Statements — and the Circle"

Create a dark-themed infographic with navy background (#02073D), in two halves with a circularity diagram below. Top-left, "CAPEX & DEPRECIATION SCHEDULE" in blue (#246BFD): a corkscrew roll-forward — "Opening PP&E → + Capex (maintenance + growth) → − Depreciation → Closing PP&E" — with two output arrows: one labelled "Depreciation → P&L (fills placeholder!)" and one "Capex → Cash Flow (CFI)", plus "Closing PP&E → Balance Sheet". A small inset "Depreciation ≈ rate × opening block · precise = waterfall of capex layers". Top-right, "DEBT SCHEDULE" in purple (#6A5CFF): a corkscrew — "Opening Debt → + New Borrowing → − Repayments → Closing Debt" — with outputs "Interest → P&L (fills placeholder!)", "Closing Debt → Balance Sheet", "Draws/Repayments → Cash Flow (CFF)". Bottom, "THE CIRCULAR REFERENCE" in pink (#FF6AC1): a closed loop of four nodes with arrows — "Interest → reduces Net Income → less cash → pays down Debt → changes average Debt → changes Interest" — drawn as a ring, with a glowing caption "legitimate! the economics genuinely loop". Beside the ring, two control icons in lavender (#F5ECFF): a checkbox "✓ Enable iterative calculation (Excel solves the loop)" and a toggle switch "Circularity breaker: ON/OFF — flip OFF to debug". A small red caution tag: "iteration can MASK errors — the switch isolates them". Title at top: "Schedules Feed the Statements; the Switch Controls the Circle." Style: clean, minimal, professional financial infographic, Valuevade dark cosmic aesthetic.

What this visual shows: both schedules as corkscrews feeding all three statements (filling the placeholders from 4.6), and the interest-debt-cash circularity as a labelled ring with its two controls — so the student sees circularity as a controlled feature, not a feared error.

🧠 Remember: Two corkscrews feeding the statements, one legitimate circle, and a switch that keeps it under your control.

---

## 📋 SUMMARY: "Capex, Depreciation & Debt Schedules — Key Takeaways"

This session in 60 seconds:

1. Depreciation and interest can't be forecast in the P&L because they depend on balances that roll over time — so they get schedules, the same corkscrew roll-forward (opening + additions − reductions = closing) you built for D-Mart's stores, reused twice.
2. The capex schedule rolls the gross block forward (opening + capex − depreciation), with capex split into maintenance (≈ replacing what wears out) and growth (driver-linked, e.g. stores × cost) — depreciation computed as rate × opening block (the waterfall being the precise version), feeding PP&E, the P&L *and* the cash flow at once.
3. The debt schedule rolls debt forward (opening + draws − repayments); interest can be charged on opening debt (simple, no circularity) or average debt (accurate, but creates a circular reference because interest → income → cash → debt → interest).
4. That circularity is legitimate, not a bug — enable iterative calculation so Excel solves the loop, and build a breaker switch (an IF on a toggle cell) so you can kill the loop to debug; the real danger is iteration masking other errors, which the switch helps isolate. The cash sweep / revolver is the advanced, self-financing version and the main source of the circle.
5. The one thing to never forget going into an interview: for leveraged companies the debt schedule decides survival, not profit — it reveals whether EBITDA covers interest, whether repayments (which never hit the P&L) can be met from cash, and whether the company is borrowing just to repay; for low-debt companies it's thin and boring.

What you can now do: build capex-depreciation and debt schedules that feed depreciation and interest back into the P&L (filling Session 4.6's placeholders), handle the resulting circular reference with iterative calculation and a breaker switch, and read a debt schedule for solvency.

🧠 Remember: Two corkscrew schedules fill the two placeholders, the circle is real and controllable, and the debt schedule is where leverage reveals survival or default.

---

## QUIZ

### Q1. Why can't depreciation simply be forecast as "last year's depreciation × 10%"?

a) It can — that's the standard method
b) Depreciation depends on the asset base, which grows with capex and shrinks with depreciation — it needs a schedule tracking that balance
c) Depreciation is always a fixed percentage of revenue
d) Because depreciation is non-cash

✅ Answer: b)
📝 Why: Depreciation flows from the capex schedule's asset balance, not from its own prior value — more capex means more assets means more depreciation. Growing it blindly breaks the link between investment and the P&L. Option (d) is true but isn't the reason it needs a schedule.

### Q2. A company charges interest on *average* debt and uses surplus cash to pay down debt. This creates a circular reference because:

a) The model has too many formulas
b) Interest affects net income, which affects cash, which affects debt repayment, which affects average debt, which affects interest — the loop closes
c) Excel can't calculate averages
d) The debt schedule references the wrong cell

✅ Answer: b)
📝 Why: The economics genuinely loop — interest → income → cash → debt → interest. It's legitimate circularity, solved by enabling iterative calculation, not a bug to be deleted. Charging interest on *opening* debt avoids the loop at the cost of some accuracy.

### Q3. Gross block opens at ₹500 cr, capex is ₹150 cr (₹50 cr maintenance, ₹100 cr growth), depreciation is ₹60 cr. Closing gross block is:

a) ₹590 cr
b) ₹650 cr
c) ₹410 cr
d) ₹690 cr

✅ Answer: a) ₹590 cr
📝 Why: Opening + total capex − depreciation = 500 + 150 − 60 = ₹590 cr. The maintenance/growth split is for *analysis* (and valuation later) — both are still capex that adds to the block. Option (b) forgets depreciation; option (c) wrongly subtracts capex.

### Q4. True or False: A circular reference in a debt schedule is always a mistake that should be eliminated by rebuilding the formulas.

a) True
b) False

✅ Answer: b) False
📝 Why: Interest-debt-cash circularity reflects real economics and is expected — you enable iterative calculation to solve it and add a breaker switch to control it. The genuine risk isn't the circularity itself but iteration *masking* other errors, which the switch helps you isolate.

### Q5. Fill in the blank: A ______ switch is a single toggle cell that, when flipped off, reverts interest to the simple non-circular formula — letting you break the loop to find errors, then turn it back on.

✅ Answer: Circularity (breaker / circuit breaker) switch
📝 Why: Built as an IF on a toggle cell, it's standard in every serious model — the difference between a circular model you control and one whose loop spirals out of control when something breaks. Flip it off to debug, on to run.

---

## INTERVIEW QUESTIONS

### 🎙️ IQ1: "Walk me through how depreciation and interest get into the P&L in a three-statement model."
*A core modelling question at ER and IB rounds — tests whether you understand schedules and the no-guessing rule.*

**Answer Framework:**
- State the rule first: "Neither is forecast directly in the P&L — both come from schedules, because both depend on balances that roll over time."
- Depreciation: "From the capex schedule — I roll the asset base forward, opening plus capex minus depreciation, and compute depreciation as a rate off the opening block, or precisely with a waterfall of capex layers each depreciating over its own life. That figure links to the P&L's depreciation line."
- Interest: "From the debt schedule — opening debt plus draws minus repayments, with interest charged on the balance. The closing debt links to the balance sheet, the interest to the P&L."
- The connection back: "These schedules also feed the cash flow — capex into CFI, depreciation added back in CFO, repayments into CFF — so one schedule touches all three statements, which is exactly the shared-items idea."
- Close: "Keeping the detail in schedules keeps the statements clean — the P&L shows one depreciation line and one interest line, while the messy year-by-year tracking happens off to the side."

**🔑 Power Phrase:** "Depreciation and interest are outputs of schedules, never inputs to the P&L — because both depend on balances that roll forward year by year."

**⚠️ Trap:** Saying "I grow depreciation with revenue and interest with debt growth." That severs the link between capex and depreciation, and between the debt schedule and interest — the precise errors schedules exist to prevent.

### 🎙️ IQ2: "Your model shows a circular reference warning. Talk me through what's happening and what you do."
*A question that instantly separates those who understand modelling from those who've only read about it — composure here signals real experience.*

**Answer Framework:**
- Diagnose calmly, not in panic: "In a three-statement model this is usually expected, not a bug — it's the interest-debt-cash loop. Interest affects net income, which affects cash, which affects debt paydown, which affects average debt, which affects interest. The economics genuinely circle."
- The fix: "I enable iterative calculation in Excel options — that tells Excel to loop the calculation until it converges, which resolves the legitimate circularity."
- The control: "And I build a breaker switch — a toggle cell that flips interest to the simple opening-debt formula, killing the loop on demand. Every serious model has one."
- The real risk: "The danger isn't the circularity — it's that iteration can *mask* other errors and make the model unstable. So if numbers look wrong, I flip the breaker off: if the problem vanishes, the loop was masking something; if it stays, I've isolated the real bug."
- Close: "And if I want to avoid circularity entirely on a simpler model, I charge interest on opening debt — a deliberate, clean simplification."

**🔑 Power Phrase:** "The circular reference is the model telling the truth about how interest and debt depend on each other — I solve it with iteration and control it with a breaker switch."

**⚠️ Trap:** Reacting as if circularity is always an error, or not knowing about iterative calculation. Both reveal you've never built a model with a real debt schedule.

### 🎙️ IQ3: "For a heavily indebted company, why might the debt schedule matter more than the P&L?"
*A question connecting modelling to credit and survival analysis — tests whether you see beyond profitability.*

**Answer Framework:**
- The core insight: "For a leveraged company the question isn't 'is it profitable?' but 'can it service and repay its debt as it falls due?' — and that lives entirely in the debt schedule."
- What the P&L hides: "Repayments never touch the P&L — they're in financing cash flows and the debt schedule only. A company can be EBITDA-positive while failing because interest devours operating cash and repayments demand cash it doesn't generate."
- The spiral to spot: "The killer signal is new borrowing consistently exceeding what operations fund — the company is borrowing just to repay old debt. The debt schedule makes that visible; the P&L never would."
- The ratios that fall out: "Interest coverage — EBIT over interest — and the debt-maturity profile come straight from the schedule, and they're the first things lenders and credit analysts examine."
- Close with the Indian context: "It's why the distressed telecom and infra stories were, at heart, debt schedules that wouldn't close without rescue — survival or default gets decided there, not on the profit line."

**🔑 Power Phrase:** "Profit is on the P&L, but survival is in the debt schedule — interest, repayments and whether they're borrowing just to repay."

**⚠️ Trap:** Focusing only on profitability metrics. The entire point is that a leveraged company's fate is a *cash and refinancing* question the P&L can't answer — which is exactly what the debt schedule surfaces.

---

# SESSION 4.9: Linking It All — Balance Sheet, Cash Flow & the Balance Check

> "You've built the pieces — P&L, working capital, capex, debt. Today they become one machine. And when the balance check turns green on a real five-year model, you'll have done what most finance graduates never manage."

---

## NOTES

## 🎣 HOOK: "Assembly Day"

Everything so far has been components on separate tabs: a forecast P&L, a working capital schedule, a capex schedule, a debt schedule. Each works alone. Today you wire them together into a complete, balancing, five-year three-statement model — the real version of what you built in miniature in Session 4.4.

The good news: you already know exactly how this works, because Session 4.3's three links are the entire wiring diagram. **Profit travels** (to retained earnings and the cash flow). **Cash closes the loop** (cash flow's closing cash → balance sheet). **Shared items bolt the statements together** (depreciation, capex, debt — now flowing from your schedules). Assembly is just connecting the tabs according to those three links, then watching the balance check.

And when it *doesn't* balance — and on a five-year model with four schedules, it often won't on the first try — you'll need a systematic way to find the break. The undisciplined hunt can eat an afternoon; the systematic protocol finds it in minutes. Both the assembly and the debugging are this session. By the end, you'll have a living model and the confidence that you can fix it when it breaks.

🧠 Remember: Assembly is wiring the tabs together via Session 4.3's three links — profit travels, cash closes the loop, shared items bolt it together — then making the balance check go green.

---

## 💡 CONCEPT: "The Wiring Diagram — What Connects to What"

Before touching cells, here's the complete map of links. Every connection in your model is one of these:

**Into the P&L:**
- Revenue, costs → from the revenue/cost build (Session 4.6)
- Depreciation → from the capex schedule (4.8)
- Interest → from the debt schedule (4.8)

**Into the Balance Sheet (each line fed by its source):**
- PP&E → closing from the capex schedule
- Inventory, receivables, payables → from the working capital schedule (4.7)
- Debt → closing from the debt schedule
- Reserves → opening + PAT − dividends (the retained earnings roll-forward)
- Share capital → constant (unless issuance)
- **Cash → from the cash flow statement** (left blank until last, exactly as in 4.4)

**Into the Cash Flow Statement:**
- CFO → PAT (from P&L) + depreciation (from capex schedule) ± change in working capital (from WC schedule)
- CFI → capex (from capex schedule), any asset sales
- CFF → debt draws/repayments (from debt schedule) − dividends

Notice the pattern: **the schedules are the suppliers; the statements are the assemblers.** Each schedule computes its detail and hands clean numbers to the statements. The statements just collect and arrange. And the three statements connect to *each other* via the three links — which is what makes the whole thing one machine rather than four spreadsheets.

The build order is identical to 4.4, just bigger: P&L first → schedules → balance sheet (cash blank) → cash flow → link cash back → balance check. Same sequence, same logic, more rooms.

🧠 Remember: Schedules supply, statements assemble — every balance sheet line fed by its source, cash left for last, and the three statements linked to each other via profit-travels, cash-closes-the-loop, shared-items.

---

## 🔬 DEEP DIVE: "Assembling the Full Model — Step by Step"

With all schedules built (Sessions 4.6–4.8), assemble the statements. Build along.

**Step 1 — finish the P&L.** Replace the two placeholders from 4.6: link the depreciation line to the capex schedule's depreciation, and the interest line to the debt schedule's interest. The P&L is now complete and live — EBIT responds to capex, PBT responds to debt.
👉 What you'll see: a forecast P&L driven entirely by assumptions and schedules, running cleanly down to PAT and EPS.

**Step 2 — build the balance sheet, line by line, from sources.** On the BS-CF tab:
- PP&E = capex schedule closing
- Inventory, receivables, payables = working capital schedule
- Debt = debt schedule closing
- **Reserves = opening reserves + PAT − dividends** (type this roll-forward — it's Link 1 as a formula; dividends = PAT × payout assumption)
- Share capital = prior year (constant)
- **Cash = leave blank** (the discipline from 4.4 — the cash flow will fill it)
👉 What you'll see: a balance sheet with every line populated except cash. Add the two sides *excluding* cash — the gap is what cash must be.

**Step 3 — build the cash flow statement.** This is where the schedules' outputs converge:
- **CFO:** Start with PAT. Add back depreciation (from capex schedule). Adjust for the change in working capital (from WC schedule — increase in net WC is negative, the sign rule from 4.7). Result: cash from operations.
- **CFI:** Capex (from capex schedule, negative). Plus any asset sales.
- **CFF:** Debt draws minus repayments (from debt schedule). Minus dividends paid.
- **Closing cash** = Opening cash + CFO + CFI + CFF.
👉 What you'll see: every schedule you built feeding into one statement — the cash flow is the *convergence point* of the whole model.

**Step 4 — close the loop.** Link the balance sheet's blank cash cell to the cash flow's closing cash. The two sides of the balance sheet should now match.
👉 What you'll see: if everything is wired correctly, the balance sheet balances — for all five forecast years.

**Step 5 — the balance check, on every column.** At the bottom of the balance sheet, one row: `=Total assets − Total equity and liabilities` for each year, wrapped in the tolerance check: `=IF(ABS(diff)<0.5, "OK", "CHECK")`. A row of "OK" across all five years means the model is correctly linked.
👉 What you'll see: ideally, five greens. Realistically on the first assembly of a real model — at least one red. That's normal, and the next card is how you find it. Now change a single assumption on the Inputs tab (say, revenue growth) and watch all three statements, all schedules, and the cash recompute — while the balance check stays green. That cascade, holding the balance across a five-year model, is a genuine three-statement model. You built it.

🧠 Remember: Link the placeholders, build the balance sheet from sources (cash blank), converge the schedules into the cash flow, link closing cash back, and check every column — five greens means a living, balanced model.

---

## 🔬 DEEP DIVE: "When It Doesn't Balance — The Debugging Protocol"

The balance check reads "CHECK." Don't panic, and *never* plug it. An imbalance is always a broken link with a findable address. Here's the systematic hunt — work it in order, and it's usually minutes, not hours.

**Step 1 — find which year breaks first.** If FY26 balances but FY27 doesn't, the error was *introduced* in FY27 — narrowing the search to one column immediately. If FY26 itself breaks, start there. (This bisection alone often halves the problem.)

**Step 2 — measure the imbalance, and look for recognisable numbers.** The size of the gap is a clue. Does it match a specific line? An imbalance exactly equal to this year's dividends suggests dividends were deducted from reserves but not from cash (or vice versa). An imbalance equal to depreciation suggests a missing add-back. An imbalance equal to capex suggests it hit one statement but not another. **Pattern-match the error amount against your line items** — it frequently names the culprit directly.

**Step 3 — check the three links in order** (since an imbalance is always one of them broken):
- **Profit travels:** Did PAT flow correctly into *both* retained earnings *and* the cash flow's starting line? A common break: reserves roll-forward forgot to subtract dividends, or used the wrong year's PAT.
- **Cash closes the loop:** Does the balance sheet's cash cell actually link to the cash flow's closing cash? A common break: cash was hardcoded, or links to the wrong cell.
- **Shared items consistent:** Is depreciation the *same number* in the P&L, the cash flow add-back, and the capex schedule? Is capex consistent between CFI and the PP&E roll-forward? A common break: a schedule updated but one of its three destinations didn't.

**Step 4 — the sign-error sweep.** Working capital signs are the single most common culprit (Session 4.7's rule: asset up eats cash, liability up saves cash). An increase in receivables should be *negative* in CFO; getting it positive throws the balance by twice the error. Check every working capital sign.

**Step 5 — use Module 3's tools.** Trace Precedents (Ctrl+[) on the cash and reserves cells to follow what feeds them. F9 to evaluate suspicious formula fragments (then Esc — never Enter). Show Formulas (Ctrl+`) to scan a column for an inconsistency — one cell in a row that differs from its neighbours.

**Step 6 — the circularity check.** If the model has a debt-schedule circular reference, flip the breaker switch OFF (Session 4.8). If the imbalance vanishes, the circularity was masking the error or hadn't converged; if it remains, you've isolated the bug from the loop. Either way, you've learned where it isn't.

The mindset: **the balance check is your friend, not your enemy.** A red check that you chase to its source makes the model *more* trustworthy. A green check achieved by plugging makes it worthless. Every imbalance found and fixed is the model proving its own integrity.

🧠 Remember: Find the first broken year, pattern-match the error amount, check the three links and the working-capital signs, use trace/F9/show-formulas, and flip the circularity breaker to isolate — an imbalance is a findable broken link, never a plug.

---

## ⚠️ MISTAKE: "The Midnight Plug, Revisited"

The error, now in its final and most tempting form: it's late, the five-year model is *almost* done, four years balance, FY29 is off by ₹8 crore, and the deadline is real. The whisper: "just type ₹8 cr into the cash line for FY29 and ship it." This is Module 3's cardinal sin and Session 4.4's warning, arriving at the moment of maximum pressure — and it's worth confronting one final time, because this is *exactly* when models get plugged in the real world.

Why it's catastrophic here specifically: a plugged cash line doesn't just hide one ₹8 cr error — it disables the balance check *permanently* for that column. From then on, FY29 will *always* show "OK" no matter what else breaks, because cash was forced to balance rather than computed. You've removed the smoke detector from the one room where the fire started. And five-year models get reused, rolled forward, handed to colleagues — the plug propagates, and eventually someone builds a decision on a number that was never real.

The professional alternative, even under deadline: **disclose, don't disguise.** If you genuinely can't find the ₹8 cr before the deadline, the honest move is a flagged note — "FY29 balance off by ₹8 cr, investigating, will resolve by morning" — and ship the model *with the red check visible*. A wrong-but-transparent model can be trusted (everyone knows its limitation); a plugged model silently lies to everyone downstream. The ₹8 cr gap costs you one uncomfortable sentence; a discovered plug costs your credibility entirely — and plugs are *always* discovered, because Go-To-Special-Constants lights up the typed cash cell, and version-diffs catch it.

The deeper lesson connecting the whole module: the balance check only has value because it *can* fail. Every protection in this module — separating inputs, building schedules, the three links, the check itself — exists to make errors *visible*. Plugging is the one act that defeats all of them at once. Don't.

🧠 Remember: A plugged cash line permanently disables that column's balance check — the smoke detector removed from where the fire started. Disclose a gap honestly; never disguise it, because plugs are always found and they cost everything.

---

## 📊 REAL WORLD: "Why the Balance Check Is the Most Important Cell on the Desk"

Walk onto any equity research or investment banking desk and open a live model — HDFC Bank, Infosys, any covered company — and somewhere, usually highlighted, sits a balance check: a single cell reading zero (or "OK"). It's often the *first* thing a senior looks at when reviewing a junior's model, before a single assumption is examined. Why? Because that one cell certifies the entire plumbing.

Here's the logic that makes it so powerful. A five-year, four-schedule model has thousands of cells and hundreds of links. Checking each one manually is impossible. But the balance sheet identity — Assets = Liabilities + Equity — is a *global* constraint: if *any* link anywhere is broken, that identity fails, and the check goes red. So one green cell is strong evidence that thousands of links are all correct simultaneously. It's the cheapest, most powerful integrity test in all of finance — a single number that audits the whole machine.

This is why the discipline around it is near-religious on real desks: the check must be *real* (cash computed independently, never plugged), it must run on *every* forecast year (an error can hide in year four while years one to three balance), and a red check is *never* shipped without disclosure. Analysts who internalise this build trust quickly; those who plug get caught the first time a senior runs Go-To-Special on their constants. The balance check is where a junior's reliability is silently judged — and now you know exactly how to keep it green honestly, and how to find the break when it isn't.

🧠 Remember: One balance-check cell certifies thousands of links at once — the cheapest, most powerful integrity test in finance, which is why seniors check it first and why it must never be plugged.

---

## 🎨 VISUAL: "The Complete Machine — All Links Live, Check Green"

Create a dark-themed infographic with navy background (#02073D), showing the full assembled model as a connected system. Center-left, three schedule boxes stacked, each in a distinct colour: "WORKING CAPITAL SCHEDULE" (blue #246BFD), "CAPEX SCHEDULE" (purple #6A5CFF), "DEBT SCHEDULE" (pink #FF6AC1), each labelled "supplies clean numbers". Center, three statement panels: "P&L" at top, "BALANCE SHEET" middle, "CASH FLOW" bottom. Glowing labelled arrows show every link: from Capex schedule → "Depreciation" into P&L and "Capex" into Cash Flow and "PP&E" into Balance Sheet; from Debt schedule → "Interest" into P&L and "Debt" into Balance Sheet and "Draws/Repay" into Cash Flow; from WC schedule → "ΔWC" into Cash Flow and the three lines into Balance Sheet. Between statements, three bold arrows labelled with the links: P&L→ "PAT travels" →both Balance Sheet (retained earnings) and Cash Flow (start); Cash Flow→ "closing cash" →Balance Sheet (the loop closing). Far right, a tall "BALANCE CHECK" column showing five year-cells FY26–FY30 all glowing green "OK ✓", with a caption "one cell certifies thousands of links". Bottom strip, the debugging protocol as five mini-steps in lavender (#F5ECFF): "1 first broken year · 2 match the error amount · 3 check 3 links · 4 sweep WC signs · 5 flip circularity breaker", with a red ✗ tag beside it: "NEVER plug cash — it disables the check forever". Title at top: "Four Schedules, Three Statements, One Green Check." Style: clean, minimal, professional financial infographic, Valuevade dark cosmic aesthetic.

What this visual shows: the entire assembled model with every link drawn and labelled, the balance check certifying all five years, and the debugging protocol — so the student sees the complete machine and knows both how it connects and how to fix it.

🧠 Remember: Schedules supply, statements assemble, three links connect, one green check certifies — and a protocol, not a plug, fixes the breaks.

---

## 📋 SUMMARY: "Linking It All — Key Takeaways"

This session in 60 seconds:

1. Assembly wires the components into one machine via Session 4.3's three links — profit travels (to retained earnings and the cash flow start), cash closes the loop (cash flow's closing cash → balance sheet), shared items bolt the statements together (depreciation, capex, debt, now from your schedules) — building in the same order as 4.4: P&L → schedules → balance sheet (cash blank) → cash flow → link cash back → check.
2. The wiring map: schedules supply, statements assemble — every balance sheet line fed by its source (PP&E from capex, the three WC lines from working capital, debt from the debt schedule, reserves from the opening + PAT − dividends roll-forward), with cash left blank until the cash flow fills it.
3. The cash flow is the convergence point: CFO (PAT + depreciation ± change in WC), CFI (capex), CFF (debt draws/repayments − dividends) — every schedule's output meets here and produces the closing cash that completes the balance sheet.
4. When it doesn't balance, a systematic protocol finds it in minutes: locate the first broken year, pattern-match the error amount against line items, check the three links, sweep the working-capital signs, use trace/F9/show-formulas, and flip the circularity breaker to isolate — an imbalance is always a findable broken link.
5. The one thing to never forget going into an interview: never plug cash — it permanently disables that column's balance check, the smoke detector removed from where the fire started; disclose a gap honestly instead, because the balance check certifies thousands of links at once, seniors check it first, and plugs are always found.

What you can now do: assemble a complete five-year three-statement model from separate schedules, link all three statements so the balance sheet balances by construction across every year, change any assumption and watch the whole machine recompute while holding the balance, and systematically debug an imbalance when one appears.

🧠 Remember: You assembled a full machine that balances across five years and recomputes on any dial — and you know how to fix it when it breaks, without ever plugging it.

---

## QUIZ

### Q1. In the assembled model, the cash line on the balance sheet gets its value from:

a) Growing last year's cash with revenue
b) The cash flow statement's closing cash, linked in
c) Whatever number makes the balance sheet balance
d) A blue input assumption

✅ Answer: b)
📝 Why: Cash is computed independently by the cash flow statement and linked into the balance sheet — which is what makes the balance a *proof* of correctness rather than something forced. Option (c) is the plug — it disables the balance check permanently for that column.

### Q2. Your balance check is "OK" for FY26 and FY27 but "CHECK" for FY28. This tells you:

a) The whole model is wrong
b) The error was introduced in FY28 — narrow the search to that column
c) FY26 and FY27 must also be wrong
d) The balance check formula is broken

✅ Answer: b)
📝 Why: If earlier years balance and a later one doesn't, the broken link was introduced in that later column — bisection immediately narrows the hunt. This is step one of the debugging protocol, and it often halves the problem before any detailed checking.

### Q3. The change in net working capital flows into which part of the cash flow statement, and with what sign for an *increase*?

a) CFI; positive
b) CFF; negative
c) CFO; negative (an increase in working capital consumes cash)
d) CFO; positive

✅ Answer: c) CFO; negative
📝 Why: Working capital is operating, so it sits in CFO, and an *increase* in net working capital means more cash trapped in inventory and receivables — a cash outflow (negative). Getting this sign wrong throws the balance by twice the error, which is why the sign sweep is in the protocol.

### Q4. True or False: Plugging the cash line to force a balance is acceptable if the error is small and the deadline is tight.

a) True
b) False

✅ Answer: b) False
📝 Why: A plug permanently disables that column's balance check — from then on it always reads "OK" regardless of other errors, and the plug propagates as the model is reused. The honest alternative under deadline is to disclose the gap and ship with the red check visible; plugs are always found via Go-To-Special and version-diffs.

### Q5. Fill in the blank: The balance check is powerful because Assets = Liabilities + Equity is a ______ constraint — if any single link anywhere in the model breaks, the identity fails and the check goes red.

✅ Answer: Global
📝 Why: One cell certifies thousands of links simultaneously, because the balance identity must hold everywhere at once. That's why it's the cheapest, most powerful integrity test in finance — and why a senior checks it before examining a single assumption.

---

## INTERVIEW QUESTIONS

### 🎙️ IQ1: "Your three-statement model's balance sheet won't balance. Walk me through how you find the error."
*A debugging question at ER and IB rounds — composure and a systematic method here signal real modelling experience.*

**Answer Framework:**
- The mindset first: "I never plug it — an imbalance is a broken link with a findable address, and plugging disables the check permanently."
- Bisect: "I find the first year that breaks — if FY26 and FY27 balance but FY28 doesn't, the error was introduced in FY28, narrowing the search to one column immediately."
- Pattern-match the amount: "The size of the gap is a clue — if it equals dividends, they were probably deducted from reserves but not cash; if it equals depreciation, a missing add-back; I match the error against my line items."
- Check the three links: "Did PAT flow into both retained earnings and the cash flow start? Does balance sheet cash link to cash flow closing cash? Is depreciation the same number in all three places it appears?"
- Close with tools and signs: "Working capital signs are the most common culprit — an asset increase must be negative in CFO. And I'd use trace precedents and show-formulas, and flip the circularity breaker to isolate the loop. It's usually minutes, not hours, with a method."

**🔑 Power Phrase:** "An imbalance is a broken link I can find — first year, error amount, the three links, the working-capital signs — never a plug."

**⚠️ Trap:** Any answer involving forcing the balance, or an unstructured "I'd check everything." The interviewer wants the *systematic* protocol and the integrity to never plug.

### 🎙️ IQ2: "Why is the balance sheet balancing such a strong test that a model is correct?"
*A conceptual question separating those who understand model architecture from those who memorised steps.*

**Answer Framework:**
- The core property: "Assets = Liabilities + Equity is a global constraint — it must hold everywhere simultaneously. If any single link in a model of thousands of cells is broken, the identity fails and the check goes red."
- Why that's powerful: "So one green cell is strong evidence that thousands of links are all correct at once — it's impossible to verify each manually, but the balance identity verifies them collectively."
- The mechanism: "Every number that touches multiple statements has to be consistent everywhere — depreciation in the P&L, the cash flow, and the asset schedule must agree — and any inconsistency mathematically surfaces as an imbalance."
- The critical caveat: "It only works if cash is computed independently from the cash flow. Plug cash, and the check always reads zero while testing nothing — you've disconnected the alarm."
- Close: "Which is why it's the cheapest, most powerful integrity test in finance, and why every professional model has it highlighted and seniors check it first."

**🔑 Power Phrase:** "The balance sheet can't be fooled — any broken link anywhere mathematically has to show up as an imbalance, so one cell audits the whole machine."

**⚠️ Trap:** Saying "because it has to balance" without explaining *why* that property catches errors — the depth is the global-constraint mechanism, not the restatement.

### 🎙️ IQ3: "How do all three statements connect in your model — give me the specific links."
*A precision question at ER and IB rounds — tests whether you know the exact wiring, not just the concept.*

**Answer Framework:**
- Link one, precisely: "PAT from the P&L goes two places — it starts the cash flow statement under the indirect method, and it flows into the balance sheet's retained earnings as opening reserves plus PAT minus dividends."
- Link two: "The cash flow statement's closing cash — opening plus CFO plus CFI plus CFF — *is* the cash line on the balance sheet. One number, two homes, and it's the line I leave blank until the cash flow computes it."
- Link three, the shared items: "Depreciation sits in the P&L as a cost, in the cash flow as an add-back, and reduces PP&E on the balance sheet; capex is in CFI and grows PP&E; debt draws are in CFF and grow borrowings — each touches multiple statements and must be consistent across all."
- The schedules' role: "Those shared items come from my schedules — capex schedule feeds depreciation and PP&E, debt schedule feeds interest and debt — so the schedules supply and the statements assemble."
- Close: "Get all three links right and the balance sheet balances by construction — which is exactly what the balance check verifies, across every forecast year."

**🔑 Power Phrase:** "Profit travels to reserves and the cash flow, cash closes the loop into the balance sheet, and shared items like depreciation bolt all three together — with the schedules supplying the numbers."

**⚠️ Trap:** Describing the connections vaguely. This question rewards the *specific* links — retained earnings formula, closing-cash-to-cash, depreciation in three places — which is what proves you've actually built and linked a model.

---

# SESSION 4.10: Scenarios, Sensitivity & Shipping the Model

> "A single forecast is a guess dressed up as a number. A model that shows Bull, Base and Bear — and what happens when each assumption moves — is analysis. Today your model grows up."

---

## NOTES

## 🎣 HOOK: "The Future Arrives as a Range, Not a Number"

Your model now produces a forecast — one set of five-year statements. But here's the uncomfortable truth every analyst learns: **that single forecast is almost certainly wrong.** Not because you built it badly, but because the future is uncertain, and any single path through it is one guess among many. The IPO band from Session 4.1 — ₹72–76, not ₹74.18 — was honest precisely because it admitted a *range*.

So professionals never present one number. They present **scenarios** — Bull (things go well), Base (most likely), Bear (things go badly) — and **sensitivities** — how much the answer moves when each key assumption changes. This transforms the model from a fragile prediction into a robust analytical tool: "in our base case the stock is worth ₹4,150; bull ₹5,200; bear ₹3,100; and the single biggest swing factor is the margin assumption." *That* is what a hiring manager wants to hear.

This final session teaches three things: building a scenario switch (one dropdown that flips the whole model between Bull/Base/Bear), sensitivity analysis with Data Tables (Module 3's teaser, finally cashed), and how to ship a model professionally — outputs, error checks, and the bridge to valuation. Your model goes from "it works" to "it's a tool a desk would trust."

🧠 Remember: The future is a range, not a number — so models present Bull/Base/Bear scenarios and sensitivities, turning a fragile guess into robust analysis.

---

## 💡 CONCEPT: "Scenarios vs Sensitivities — Two Different Questions"

These two get confused constantly, so pin the distinction:

- A **scenario** changes *several assumptions together* to tell a coherent story. The Bull case might combine higher revenue growth *and* better margins *and* lower working capital — a consistent "everything goes right" world. The Bear case combines the opposite. Each scenario is a *narrative*, expressed as a *set* of assumptions that move together.
- A **sensitivity** changes *one assumption at a time* to isolate its impact. "Holding everything else at base, if growth moves from 10% to 15%, the valuation moves from X to Y." It answers "which assumption matters most?" — the search for the model's *key swing factors*.

Why you need both: scenarios show the *range of outcomes* (how good could it get, how bad); sensitivities show the *drivers of that range* (what's actually moving the needle). A great analyst uses scenarios to frame the investment ("the risk-reward is asymmetric — more upside than downside") and sensitivities to focus the research ("the whole thesis hinges on margins, so that's where I'll dig deepest").

The Indian research note you'll one day write uses both: a scenario table (bull/base/bear target prices) up top, and a sensitivity table (valuation vs the two key assumptions) showing where the conviction and the risk concentrate.

🧠 Remember: Scenarios change many assumptions together to tell a story (the range of outcomes); sensitivities change one at a time to find what matters most (the drivers of the range).

---

## 🔬 DEEP DIVE: "Building the Bull/Base/Bear Scenario Switch"

The goal: one dropdown cell that flips your *entire* model between three scenarios. Change it from "Base" to "Bull," and every assumption, every statement, every output updates. Here's the professional way, built on Module 3's tools. Build along.

**Step 1 — lay out the scenario inputs.** On the Inputs tab, for each key assumption, create *three* rows — one per scenario. For revenue growth: a Bull row (say 16%), a Base row (12%), a Bear row (8%). Same for margins, working capital days, and any other swing assumption. These are your three coherent stories, side by side.
👉 What you'll see: a grid of assumptions — rows for each driver, three columns for Bull/Base/Bear. The three narratives, fully specified.

**Step 2 — the scenario selector.** One cell at the top, with a Data Validation dropdown (Module 3, Session 3.8) offering "Bull", "Base", "Bear". This is the master switch.

**Step 3 — the CHOOSE or INDEX pick.** Below the selector, a "live assumptions" row that pulls the *selected* scenario's values. The clean way uses a number (1/2/3) and **INDEX** or **CHOOSE**:
- Convert the dropdown to a number: `=MATCH(selector, {"Bull","Base","Bear"}, 0)` → gives 1, 2 or 3.
- Then each live assumption: `=INDEX(Bull:Bear range for this assumption, scenario number)` — or equivalently `=CHOOSE(scenario number, bull value, base value, bear value)`.
👉 What you'll see: the live assumptions row now shows whichever scenario the dropdown selects. Change the dropdown to "Bull" and watch every live assumption flip to its bull value.

**Step 4 — the engine reads the live row.** Here's the key: your *entire engine* references the **live assumptions row**, never the individual scenario rows. The revenue build points at "live growth"; the cost build at "live margin." So when the live row changes (because the dropdown changed), the whole model recomputes through the scenario.
👉 What you'll see: flip the dropdown — and the P&L, balance sheet, cash flow, every schedule, and every output update to the selected scenario, instantly. One cell drives three entire futures.

**Step 5 — the scenario output table.** On the Output tab, a summary showing the *key results* (revenue FY30, EBITDA margin, EPS, and eventually target price) for all three scenarios at once. (You can build this by recording each scenario's outputs, or with a Data Table — Step from the next card.) This is what goes in the research note: three futures, side by side, framing the risk-reward.

This INDEX/CHOOSE switch is the professional standard — far better than manually retyping assumptions for each scenario (error-prone, and you lose the other scenarios). One dropdown, three coherent worlds, the whole model responding. It's also the direct answer to Module 3's promise that Data Validation dropdowns would one day "drive an entire model" — this is that day.

🧠 Remember: Three assumption columns (Bull/Base/Bear), a dropdown selector, INDEX/CHOOSE to pick the live values, and the engine reads only the live row — so one cell flips the entire model between three futures.

---

## 🔬 DEEP DIVE: "Sensitivity Analysis with Data Tables"

Now the second tool — isolating how much one or two assumptions move the answer. Excel's **Data Table** (Data → What-If Analysis → Data Table) does this automatically, sweeping an assumption across a range and recording the output for each value. This is the feature Module 3, Session 3.10 promised would arrive here. Build along.

**The one-variable Data Table:**

**Step 1:** Pick your output (say, FY30 EPS) and put it in a cell. Down a column beside it, list the values you want to test for one assumption — revenue growth of 8%, 10%, 12%, 14%, 16%.
**Step 2:** Select the range covering both the list and the output cell. Data → What-If Analysis → Data Table. In "Column input cell," point to the *actual growth assumption cell* the model uses.
**Step 3:** OK.
👉 What you'll see: Excel substitutes each growth value into the model one by one, and fills in the resulting EPS for each — a table showing exactly how EPS responds to growth, computed automatically. No manual retyping.

**The two-variable Data Table** (the one that appears in every research note):

**Step 4:** Put the output in the top-left corner of a grid. List one assumption's values *across the top* (say, EBITDA margins: 16%, 18%, 20%) and another's *down the side* (growth: 8%, 12%, 16%).
**Step 5:** Select the whole grid. Data Table → "Row input cell" = the margin assumption, "Column input cell" = the growth assumption.
**Step 6:** OK.
👉 What you'll see: a full grid of outcomes — every combination of margin and growth, with the resulting valuation (or EPS) in each cell. This is the **sensitivity table** that anchors valuation sections: at a glance, the reader sees how the answer moves across the two assumptions that matter most, and where the base case sits within the range.

**Reading it like an analyst:** the *spread* across the table tells you how sensitive the answer is — a table where values barely change means the assumption doesn't matter much; a table that swings wildly means small assumption errors have big consequences, so that assumption deserves the most research. Often you'll heat-map it (Module 3's conditional formatting) — green to red — so the risk gradient is visible instantly. And critically, it shows whether the risk-reward is *asymmetric*: if the upside cells exceed the current price by more than the downside cells fall below it, that's a favourable setup.

One caution carried from Module 3: Data Tables recalculate the whole model for every cell, so a large two-way table on a heavy model can be slow — and they don't combine cleanly with the circularity from Session 4.8 (iterative calc plus Data Tables can be unstable). For a clean sensitivity, sometimes flipping the circularity breaker off temporarily helps.

🧠 Remember: One-variable Data Tables sweep a single assumption; two-variable tables grid two assumptions against an output — the sensitivity table every research note uses to show what moves the answer and whether the risk-reward is asymmetric.

---

## 🔢 FORMULA: "Free Cash Flow — The Bridge to Valuation"

Formula: `FCFF = EBIT × (1 − tax rate) + Depreciation − Capex − Change in Working Capital`

| Component | Where it comes from | Why it's here |
|-----------|--------------------|--------------| 
| EBIT × (1 − tax) | P&L (NOPAT — operating profit, taxed) | Cash operating profit, ignoring financing |
| + Depreciation | Capex schedule | Non-cash — add it back (Session 4.3's logic) |
| − Capex | Capex schedule | Real cash spent on assets |
| − Change in WC | Working capital schedule | Cash trapped by growth (Session 4.7) |

This is the single most important *output* your model produces, because it's what valuation runs on. **Free Cash Flow to the Firm (FCFF)** is the cash a business generates after paying for the investment needed to sustain it — the cash genuinely available to all funders (debt and equity). Every component comes from a schedule you've already built: this formula is your model's pieces, reassembled into the number Module 12 will discount to a valuation.

Notice it's *almost* your CFO minus capex — because that's essentially what free cash flow is: operating cash, minus the capex to keep generating it. (FCFF uses EBIT-after-tax rather than PAT to strip out financing effects, so it measures the *business's* cash independent of how it's funded.)

**Plain-English translation:** "Cash the operating business throws off, after taxes and after the investment needed to keep it running — money truly free to return to funders."

**What happens if you get it wrong:** the common error is forgetting the change in working capital — a fast-growing company's FCFF can be far lower than its profit because growth is eating cash (Session 4.7's whole lesson), and omitting the WC drag overstates free cash flow, which overstates valuation.

**Watch out:** FCFF (to the firm, pre-financing) vs FCFE (to equity, after interest and debt movements) — they're different and answer different questions. FCFF is the standard for enterprise valuation; know both exist.

Signal: a company whose FCFF tracks close to its PAT → high-quality, cash-generative profits. FCFF chronically far below PAT → profits consumed by capex and working capital — the cash-vs-profit gap from Session 4.2, quantified.

Analyst Insight: this formula is *why* you built every schedule — depreciation, capex and working capital all converge here into the number that drives valuation. Your three-statement model exists, ultimately, to produce a defensible FCFF stream.

🧠 Remember: FCFF = NOPAT + depreciation − capex − change in WC — the cash truly free to funders, assembled from your schedules, and the bridge from this model to valuation in Module 12.

---

## ⚠️ MISTAKE: "Shipping Without an Output Page or Error Checks"

The error: the model works, the analyst is exhausted, and they send the raw engine — forty tabs of dense formulas — to a senior or save it as "final." Two things are missing, and both matter enormously.

**Missing piece one: the output page.** Nobody reads a model by scrolling through engine tabs. A professional model has a clean **Output / Summary tab** that presents the key results — the forecast P&L summary, key ratios, the scenario table, the sensitivity grid, FCFF, and (eventually) the valuation — formatted for a human, with the units and assumptions visible. This is the Outputs layer from Session 4.5's architecture, and skipping it means the senior has to *do the analyst's synthesis themselves* — which is exactly backwards. The output page is where the model's *answer* lives; the engine is just how it's computed.

**Missing piece two: the error-check suite.** One balance check (Session 4.9) is the minimum, not the whole. A shippable model has a **checks block** — a dedicated area listing every integrity test, each reading "OK" or "CHECK": balance sheet balances (all years), cash flow's closing cash ties to the balance sheet, no negative inventory/cash where impossible, retained earnings roll-forward is consistent, sensible ranges (margins not above 100%, no #REF! anywhere). A single red cell anywhere flags a problem before it reaches a decision. Senior analysts open the checks block *first* — it's the model's self-certification.

The deeper point connecting the module: a model isn't done when it computes — it's done when it's **trustworthy and readable**. The output page makes it readable (someone can grasp the answer in two minutes); the error-check suite makes it trustworthy (someone can verify the plumbing in one glance). Skipping either means shipping a model that's technically correct but practically unusable — and on a desk, an unusable model is a non-existent model. Finish the last 10%: the page that shows the answer, and the checks that certify it.

🧠 Remember: A model isn't done when it computes — it's done when it's readable (a clean output page showing the answer) and trustworthy (an error-check suite certifying the plumbing); skip either and a correct model becomes practically unusable.

---

## 📊 REAL WORLD: "How a Research Note Uses Everything You Built"

Open any sell-side initiation report on an Indian company — a Motilal Oswal note on Titan, a Kotak note on D-Mart — and you'll see this entire module, packaged for a client. Here's the mapping, which is also the answer to "why did I learn all this?"

The **investment thesis** ("we rate Titan a Buy, target ₹4,150") rests on the three-statement model you now know how to build. The **forecast tables** in the appendix are the model's output page — five years of P&L, balance sheet and cash flow, exactly what you assembled in Session 4.9. The **scenario analysis** ("bull ₹5,200 / base ₹4,150 / bear ₹3,100") is your Bull/Base/Bear switch, run three times. The **sensitivity table** ("target price vs revenue growth and EBITDA margin") is your two-variable Data Table, heat-mapped. The **valuation** that produces the target price runs on the **FCFF** stream your schedules generate. And the analyst's *confidence* in all of it rests on the model *balancing* — the integrity check that says the plumbing is sound.

So everything connects: the driver tree (4.6) defends the revenue, the working capital schedule (4.7) catches the cash dynamics, the debt schedule (4.8) assesses solvency, the linking (4.9) makes it one trustworthy machine, and the scenarios and FCFF (4.10) turn it into a recommendation a client can act on. The note is the *deliverable*; the model is the *engine*; this module taught you the engine. Module 12 (Valuation) will take your FCFF stream and turn it into the target price — and Module 13 (Report Writing) will teach you to package it into the note itself.

🧠 Remember: A research note IS this module packaged for a client — the model is the engine, the scenarios and FCFF turn it into a recommendation, and the balance check is why the analyst trusts their own target price.

---

## 🎨 VISUAL: "From Model to Recommendation — The Full Pipeline"

Create a dark-themed infographic with navy background (#02073D), as a left-to-right pipeline with three stages. Stage 1, "THE SCENARIO SWITCH" in blue (#246BFD): a dropdown cell labelled "Scenario: [Base ▼]" feeding three stacked assumption columns "BULL / BASE / BEAR", with an INDEX/CHOOSE gear pulling a glowing "LIVE ASSUMPTIONS" row that arrows into a small model-machine icon; caption "one dropdown flips the whole model between three futures". Stage 2, "SENSITIVITY" in purple (#6A5CFF): a heat-mapped grid (green-to-red) with "EBITDA margin →" across the top and "growth ↓" down the side, the centre cell highlighted "BASE", caption "two-variable Data Table — what moves the answer, and is the risk-reward asymmetric?". Stage 3, "THE OUTPUT" in pink (#FF6AC1): a clean summary card showing a mini scenario table "Bull ₹5,200 / Base ₹4,150 / Bear ₹3,100", an "FCFF stream → Valuation (Module 12)" arrow, and a green "CHECKS: all OK ✓" badge; caption "readable answer + trustworthy checks = shippable". Below the pipeline, the FCFF formula in lavender (#F5ECFF): "FCFF = NOPAT + Depreciation − Capex − ΔWC" with four small arrows showing each piece coming from a schedule (P&L, capex, capex, working capital). A final arrow exits right to a document icon labelled "Research Note (Module 13)". Title at top: "Model → Scenarios → FCFF → Recommendation." Style: clean, minimal, professional financial infographic, Valuevade dark cosmic aesthetic.

What this visual shows: the complete journey from the assembled model to a client recommendation — the scenario switch, the sensitivity heat-map, the FCFF bridge to valuation, and the output-plus-checks that make it shippable — so the student sees how the whole module culminates in a research note.

🧠 Remember: Scenario switch, sensitivity grid, FCFF bridge, output and checks — the model becomes a recommendation.

---

## 📋 SUMMARY: "Scenarios, Sensitivity & Shipping — Key Takeaways"

This session in 60 seconds:

1. The future is a range, not a number — so models present scenarios (Bull/Base/Bear, several assumptions moving together to tell a coherent story, showing the *range of outcomes*) and sensitivities (one assumption at a time, showing the *drivers* of that range and what matters most).
2. The scenario switch: three assumption columns (Bull/Base/Bear), a Data Validation dropdown selector, INDEX or CHOOSE to pick the live values, and an engine that reads *only* the live assumptions row — so one cell flips the entire model between three futures (Module 3's dropdown promise, fulfilled).
3. Sensitivity uses Data Tables (Module 3's teaser, cashed): one-variable tables sweep a single assumption; two-variable tables grid two assumptions against an output into the heat-mapped sensitivity table every research note uses — revealing how sensitive the answer is and whether the risk-reward is asymmetric.
4. FCFF = NOPAT + depreciation − capex − change in working capital — the cash truly free to funders, assembled from the schedules you built, and the bridge from this model to valuation in Module 12; forgetting the working-capital drag overstates it (and the valuation).
5. The one thing to never forget going into an interview: a model isn't done when it computes — it's done when it's readable (a clean output page presenting the answer) and trustworthy (an error-check suite certifying the plumbing); a research note is this entire module packaged for a client, with the model as the engine and the balance check as why the analyst trusts the target price.

What you can now do: build a Bull/Base/Bear scenario switch driven by one dropdown, run one- and two-variable sensitivity tables, derive the FCFF stream that bridges to valuation, and ship a model with a professional output page and error-check suite — a complete, trustworthy, decision-ready financial model.

🧠 Remember: One model, three futures, the swing factors mapped, the free cash flow extracted, the answer presented and certified — your model grew up.

---

## QUIZ

### Q1. What is the key difference between a scenario and a sensitivity?

a) They're the same thing
b) A scenario changes several assumptions together to tell a story; a sensitivity changes one at a time to isolate its impact
c) A sensitivity changes several assumptions; a scenario changes one
d) Scenarios are for the P&L, sensitivities for the balance sheet

✅ Answer: b)
📝 Why: Scenarios are coherent narratives (Bull combines high growth + good margins + low WC) showing the range of outcomes; sensitivities isolate one variable to find what matters most. You need both — scenarios frame the risk-reward, sensitivities focus the research.

### Q2. In a professional scenario switch, what should the model's engine reference?

a) The Bull assumption row directly
b) Whichever scenario row the analyst remembers to use
c) The "live assumptions" row that INDEX/CHOOSE populates from the selected scenario
d) A hardcoded set of base-case numbers

✅ Answer: c)
📝 Why: The engine reads only the live row, which INDEX or CHOOSE fills from the dropdown-selected scenario — so flipping the dropdown recomputes the whole model. Referencing scenario rows directly (a) defeats the switch; you'd have to rewire the engine for each scenario.

### Q3. A two-variable Data Table grids EBITDA margin against revenue growth, with target price in each cell. The cells barely change across the whole table. This tells you:

a) The model is broken
b) The valuation is not very sensitive to these two assumptions — they're not the key swing factors
c) The two assumptions are the most important drivers
d) You should widen the assumption ranges to infinity

✅ Answer: b)
📝 Why: A flat sensitivity table means those assumptions don't move the answer much — so the real swing factors lie elsewhere, and that's where research should focus. A table that swings *wildly* would indicate high sensitivity and high research priority. The spread is the signal.

### Q4. True or False: FCFF = NOPAT + Depreciation − Capex − Change in Working Capital, and omitting the working capital term overstates free cash flow for a fast-growing company.

a) True
b) False

✅ Answer: a) True
📝 Why: Growth traps cash in inventory and receivables (Session 4.7), so the change in working capital is a real drag on free cash flow. Omitting it overstates FCFF — and since valuation runs on FCFF, it overstates the valuation too. The schedules all converge into this number.

### Q5. Fill in the blank: Beyond a single balance check, a shippable model includes a ______ block — a dedicated area of integrity tests each reading "OK" or "CHECK" — which a senior analyst examines first.

✅ Answer: Checks (error-check / checks)
📝 Why: One balance check is the minimum; a full checks block tests every integrity condition (balance, cash ties, no impossible negatives, sensible ranges, no errors) so any problem flags before reaching a decision. It's the model's self-certification, and pairing it with a clean output page is what makes a model trustworthy *and* readable — i.e., actually done.

---

## INTERVIEW QUESTIONS

### 🎙️ IQ1: "How would you build scenario analysis into a model — and how is it different from sensitivity analysis?"
*A core question at ER and IB rounds — tests both the mechanics and the conceptual distinction.*

**Answer Framework:**
- The distinction first: "Scenarios change several assumptions together to tell a coherent story — Bull combines higher growth, better margins and lower working capital; Bear the opposite. Sensitivities change one assumption at a time to isolate what moves the answer most."
- Why both: "Scenarios show me the range of outcomes — how good and how bad it could get; sensitivities show me the drivers of that range, so I know where to focus my research."
- The scenario mechanics: "I lay out three assumption columns — Bull/Base/Bear — add a dropdown selector, and use INDEX or CHOOSE to populate a live assumptions row. The engine reads only that live row, so one dropdown flips the whole model between three futures."
- The sensitivity mechanics: "Two-variable Data Tables — gridding, say, growth against margin with the valuation in each cell, heat-mapped — show how sensitive the answer is and whether the risk-reward is asymmetric."
- Close: "Together they're what goes in a research note — a scenario table framing the recommendation, a sensitivity table showing where the conviction and risk concentrate."

**🔑 Power Phrase:** "Scenarios tell stories with assumptions moving together; sensitivities isolate one driver — one dropdown for the futures, a Data Table for the swing factors."

**⚠️ Trap:** Conflating the two, or describing scenario analysis as manually retyping assumptions. The professional answer uses a dropdown-driven switch and knows the conceptual difference cold.

### 🎙️ IQ2: "What is free cash flow, and why does it matter more than profit for valuation?"
*A bridge question to valuation at ER and IB rounds — tests whether you understand what your model ultimately produces.*

**Answer Framework:**
- Define it from the build: "Free cash flow to the firm is NOPAT — operating profit after tax — plus depreciation, minus capex, minus the change in working capital. It's the cash the business genuinely generates after the investment needed to sustain it, available to all funders."
- Why it beats profit: "Profit is an accounting figure — it includes non-cash charges and ignores the capex and working capital that real growth consumes. Free cash flow is *actual cash*, which is what funders can actually receive and what valuation discounts."
- Connect to the cash-vs-profit lesson: "A company can be highly profitable but generate little free cash if capex and working capital eat it — the gap between PAT and FCFF is exactly the profit-versus-cash distinction, quantified."
- The valuation link: "Discounted cash flow valuation runs on the FCFF stream, not profit — so my entire three-statement model exists, ultimately, to produce a defensible free cash flow forecast."
- Close: "And every piece comes from a schedule I built — depreciation, capex and working capital all converge into this one number that bridges to the target price."

**🔑 Power Phrase:** "Profit is an opinion; free cash flow is the cash funders can actually have — which is why valuation discounts FCFF, not PAT."

**⚠️ Trap:** Forgetting the capex or working-capital subtractions, or saying "free cash flow is just profit." The whole point is that it strips accounting and captures the cash that growth consumes.

### 🎙️ IQ3: "You've finished building a model. What makes it actually ready to ship to a senior or a client?"
*A professionalism question that reveals whether you understand that a model is a communication tool, not just a calculation.*

**Answer Framework:**
- Reframe "done": "A model isn't done when it computes — it's done when it's readable and trustworthy. Those are two separate things I have to deliver."
- Readable — the output page: "A clean summary tab presenting the answer — forecast P&L, key ratios, the scenario table, the sensitivity grid, FCFF — formatted for a human, so a senior grasps the conclusion in two minutes without scrolling through engine tabs."
- Trustworthy — the checks: "A dedicated checks block — every integrity test reading OK or CHECK: balance sheet balances all years, cash ties out, no impossible negatives, sensible ranges, no errors. A senior opens this first; it's the model's self-certification."
- The discipline carried through: "Every assumption visible on the Inputs tab in blue, the colour code consistent, units stated, no hardcodes in the engine — so a reviewer can audit beliefs separately from arithmetic."
- Close: "And honesty — if a check is red and I couldn't resolve it, I flag it explicitly rather than plug it. A model someone can read, verify and trust is the deliverable; a correct-but-opaque model is practically unusable on a desk."

**🔑 Power Phrase:** "Readable so they grasp the answer in two minutes, trustworthy so they verify the plumbing in one glance — a model is a communication tool, not just a calculation."

**⚠️ Trap:** Answering only "make sure the numbers are right." Correctness is necessary but not sufficient — the output page and checks block are what separate a usable professional model from a personal calculation.

---

# 📁 MODULE 4 PROJECT: "Build a Complete Three-Statement Model of an Indian Company"

**🎯 Objective:** Build a full, integrated, five-year three-statement financial model of a real NSE-listed company — from spreading historicals to scenarios and free cash flow — that balances across every year and is genuinely shippable. This is the capstone that proves you can do the core work of an equity research or investment banking analyst.

**🏢 Company Assigned:** **Avenue Supermarts Ltd (D-Mart, NSE: DMART)** — chosen because its drivers are public and physical (stores, revenue per store), its working capital is famously negative (a great teaching case), and it carries little debt (a clean first debt schedule). *Ambitious students: also attempt a leveraged company like a telecom or infra name, where the debt schedule becomes the heart of the model.*

## To-Do List

1. **Set up the architecture.** Create the tabbed workbook from Session 4.5: Inputs (blue), Historicals, P&L/Model, Working Capital, Capex, Debt, BS-CF, Output (purple). Build the EOMONTH date spine and the A/E flag row, copied to every tab on the same column grid. (Sessions 4.5, 3.7)

2. **Spread five years of historicals.** From D-Mart's annual reports (consolidated — declare it in the header) and screener.in (tied out to the filings), load FY21–FY25 into your standard line-item format. Run the per-column balance check as you type; tie out revenue, EBITDA, PAT and total assets to the filings; tag any one-offs. (Session 4.5)

3. **Build the common-size and anchor block.** Express the P&L as % of revenue, and compute the anchors — historical growth, average margins, CAGR, high/low ranges, and the historical working-capital days (DIO/DSO/DPO). These discipline every forecast assumption. (Sessions 4.5, 4.7)

4. **Build the driver-based revenue forecast.** The D-Mart store engine: opening + new stores = closing, average stores, revenue per store (computed from history, grown by a blue dial), revenue = average stores × revenue per store — with a glide path for the outer years and sanity rows (implied stores, implied productivity). (Session 4.6)

5. **Build the cost lines down to PAT and EPS.** Variable costs as % of revenue (anchored to history), fixed costs grown gently, tax at D-Mart's effective rate. Leave depreciation and interest as placeholder links to the schedules. Compute EPS. (Session 4.6)

6. **Build the working capital schedule.** Forecast DIO/DSO/DPO (sticky-flat from history, with any management-stated changes), derive the rupee balances, compute the cash conversion cycle (note D-Mart's near-zero/negative CCC), and produce the change in net working capital for the cash flow. (Session 4.7)

7. **Build the capex and depreciation schedule.** Gross block roll-forward, capex split into maintenance and growth (growth tied to the store plan), depreciation as a rate off the opening block. Link depreciation to the P&L and capex to the cash flow. (Session 4.8)

8. **Build the debt schedule.** Roll debt forward with D-Mart's stated repayments (thin, since D-Mart is low-debt), compute interest, link interest to the P&L and debt to the balance sheet. Install a circularity breaker switch even if the simple opening-debt approach avoids the loop. (Session 4.8)

9. **Assemble and link all three statements.** Replace the placeholders; build the balance sheet from sources with cash left blank; build the cash flow (CFO/CFI/CFF) from the schedules; link closing cash back; run the balance check on every year. Debug systematically if it doesn't balance — never plug. (Session 4.9)

10. **Add the Bull/Base/Bear scenario switch.** Three assumption columns, a dropdown selector, INDEX/CHOOSE driving a live assumptions row that the engine reads. Confirm flipping the dropdown recomputes the whole model. (Session 4.10)

11. **Add sensitivity analysis.** A two-variable Data Table — revenue-per-store growth against EBITDA margin (or store additions against productivity) — with the output (FY30 EPS or a simple valuation) in each cell, heat-mapped. (Session 4.10)

12. **Derive free cash flow and build the output page.** Compute the FCFF stream (NOPAT + depreciation − capex − ΔWC) — the bridge to Module 12. Build a clean Output tab: forecast summary, key ratios, scenario table, sensitivity grid, FCFF. Build a checks block listing every integrity test. (Session 4.10)

**📤 Deliverable:** One Excel workbook — Inputs, Historicals, P&L, Working Capital, Capex, Debt, BS-CF, Output tabs — fully linked, balancing across all five forecast years, with a working scenario switch, a sensitivity table, an FCFF stream, a clean output page, and a green checks block. Plus a one-page written summary of your base-case forecast and the key assumptions behind it.

**⏱️ Time Estimate:** 12–18 hours across several sittings. This is a substantial project — the kind you can show in interviews.

**🏆 What Great Looks Like:**
1. **The balance test:** the balance check reads OK across all five forecast years, with cash computed from the cash flow (never plugged) — and changing any single Inputs dial recomputes the entire model while the balance holds.
2. **The defensibility test:** every revenue assumption traces to a driver you can defend from D-Mart's disclosures (store additions vs guidance, productivity vs history), the working capital days reflect D-Mart's actual negative-CCC structure, and the sanity rows show your FY30 numbers imply an achievable store build-rate — no hockey stick.
3. **The shippability test:** a reviewer opening your model can grasp the base-case story from the output page in two minutes, verify the plumbing from the checks block in one glance, find every assumption in blue on the Inputs tab, and flip the scenario dropdown to see Bull and Bear — without asking you a single question.

---

*Module 4 complete. You can now build the machine that the entire profession runs on — a three-statement model from a blank workbook, balanced, scenario-ready, producing the free cash flow that Module 12 (Valuation) will turn into a target price, and that Module 13 (Report Writing) will package into a research note. You have built the core skill of equity research. Everything ahead is making it sharper.*

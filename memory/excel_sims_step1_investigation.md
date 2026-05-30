# STEP 1 — Excel Simulations Truthful Investigation

**Date:** 2026-05-30
**Scope:** Every Excel-typed simulation in `master_simulations` across the entire course.
**Method:** Programmatic schema audit (`/app/scripts/audit_m3_excel_sims.py`) + live browser tour of 3 representative M3 sims (logged in as `testagent2026@gmail.com`).
**Decision:** **NO FIX APPLIED.** Reporting findings only, per user instruction.

---

## TL;DR — The user is right; my prior "Batch 5 worked" claim was wrong

Programmatic audit said 19/68 sims had "real_data" because the renderer adapter found a top-level array of objects in `config`. **But that array is almost always `evaluation_criteria` (rubric)** — a list of `{points, criterion}` rows. The adapter renders those rows as if they were realistic Excel data, so the student sees a 2-column table of scoring criteria instead of, say, 30 days of Nifty-50 OHLC data.

**Effective truth:** Of the 68 excel sims, only the 3 M2 sims with `paired cols/rows` *attempt* to render real-looking finance data — and even those put the row count as an integer (`daily_rows: 30`) instead of an actual array, so the adapter only produces a single header row.

So in practice **~0 of 68 sims** open with a populated, manipulable workbook. The user reporting "the whole module looks empty" is accurate.

---

## 1. Programmatic audit — full enumeration

Total Excel sims found: **68** (matches G1 investigation report).

| Module | # sims | classification breakdown |
|---|---|---|
| M2  Markets & Microstructure | 3 | 3 paired-cols/rows (cols-only, rows=integer) |
| **M3  Excel Fundamentals** | **17** | **16 "evaluation_criteria" only, 1 empty** |
| M4  Financial Modelling | 6 | all 6 prose-only, no tables |
| M5  Corporate Governance | 2 | all 2 prose-only |
| M7  FSA | 8 | all 8 prose-only |
| M8  Forensic Accounting | 7 | all 7 prose-only |
| M9  Advanced Ratios | 5 | all 5 prose-only |
| M10 Macro | 2 | both prose-only |
| M11 Sector | 3 | all 3 prose-only |
| M12 Valuation | 12 | all 12 prose-only |
| M13 PPT & Reports | 3 | all 3 prose-only |
| **Total** | **68** | **3 "data-shaped but empty rows", 16 "rubric-only", 49 "prose-only"** |

Full per-sim breakdown (with master_simulation_ids) saved to `/app/memory/excel_sim_audit_2026_05_30.json`.

### M3 sims (the user's specific complaint)

All 17 sims listed below. Sessions S03, S05, S08 toured live below.

| Session | master_simulation_id | What the adapter does |
|---|---|---|
| S01 (workspace setup) | `f3c20e7a-…1d-0994c4865d8a` | shows `evaluation_criteria` (rubric) |
| S01 (alt — model audit) | `005e7832-…3-b01b-81da3315c1a4` | rubric |
| S02 (Titan segment model) | `af379531-…d-47a5f9a78439` | rubric |
| S02 (DCF sensitivity) | `03141051-…1-8e03bd4a41ae` | rubric |
| **S03 (Nifty 50 Dashboard)** | `2aa2c38a-…c-a4b0a6e1311c` | **rubric — TOURED, see screenshot 1** |
| S04 (IT Comps Table) | `86e669c0-…f-58c14-5e5a712997b9` | rubric |
| **S05 (Clean the Chaos)** | `17ad4b58-…f-558-162c68c7289b` | **rubric — TOURED, see screenshot 2** |
| S06 (Earnings Calendar) | `af9d572a-…a-d8-8bc81e2e57d8` | rubric |
| S06 (Receivables Aging) | `a12536eb-…d-9-a0d601742242` | rubric |
| S07 (Equity Screener) | `f014304a-…1-cc88-d169ec931536` | rubric |
| S07 (3-Scenario DCF) | `35ac9e65-…b-cc4a-71e5a920d4a5` | rubric + `stress_tests` array |
| **S08 (Home Loan + SIP)** | `0c37fd4f-…9-be93-888074a18f53` | **rubric — TOURED, see screenshot 3** |
| S08 (Tata Steel NPV/IRR) | `3f4e2f0d-…a-abaf-71e5a89bfeed` | rubric |
| S09 (Pivot Tables) | `f758ecbc-…f-156a-44cf-b6f8-60fe8f1a31d3` | `deliverables` array (still rubric-shaped) |
| S10 (Chart Pack) | `bfce721f-…d9-7-d20c20807df9` | `deliverables` array (rubric-shaped) |
| S11 (Bulletproof Dashboard) | `004e610a-…d-3aeb-12c-…11974a40e` | **empty fallback** (no usable arrays) |
| S12 (DCF Sensitivity Suite) | `0e96333b-…f6b3-bf99-7fe6b4a4243f` | `deliverables` array (rubric-shaped) |

---

## 2. Live browser tour — 3 representative M3 sims

To unlock the simulation phase I ran (per user-suggested unblock pattern):

```sql
UPDATE user_sessions
SET notes_completed = true, quiz_completed = true, interview_completed = true
WHERE id IN (
  'f96ea5a1-b651-412c-8fa6-7755bd83a12e',  -- M3 S03 Essential Functions I
  '4b5d9f0c-e9d8-45e1-ad9f-90389944996f',  -- M3 S05 Data Cleaning
  '20befb74-25b8-4027-b0cd-713c3d5ac3a3'   -- M3 S08 Financial Functions
);
```

### Screenshot 1 — M3 S03 "Nifty 50 Sector Intelligence Dashboard: 7 Functions, 1 Dataset, 30 Minutes"
File: `/tmp/m3_s03_essential_fn1.png`

What the student SHOULD see: 50 rows of Nifty 50 tickers with Sector, Mcap, Price, %Δ etc. to run COUNTA/SUMIF/COUNTIF on.

What the student ACTUALLY sees: a 2-column "points / criterion" sheet listing rubric items:
- `10 | Data quality checks complete: COUNT, COUNTA, COUNTBLANK all correct`
- `5  | Trailing spaces cleaned before SUMIF/COUNTIF analysis`
- `10 | COUNTIF c…`
- `10 | SUMIF cor…`
- `10 | AVERAGEIF…`
- `10 | IFERROR w…`
- `15 | IF formul…`
- … etc

There is no Nifty 50 dataset to operate on. The student can't COUNTA a list of rubric criteria.

### Screenshot 2 — M3 S05 "Clean the Chaos: Transform a Messy Nifty 50 Download Into Analysis-Ready Data"
File: `/tmp/m3_s05_data_cleaning.png`

What the student SHOULD see: a deliberately messy CSV-style dump (trailing spaces, mixed-case sector names, BSE codes with `' prefix, dates as text, etc.) — the WHOLE POINT of the exercise.

What the student ACTUALLY sees: rubric again — `Data quality checks 10pts`, `Company normalisation 15pts`, `Revenue cleanup 15pts`, `BSE codes 5pts`, etc. **Nothing messy to clean.**

### Screenshot 3 — M3 S08 "Build a Home Loan Amortisation Schedule and SIP Corpus Calculator"
File: `/tmp/m3_s08_financial_fn.png`

What the student SHOULD see: loan inputs (principal, rate, tenure) + a blank amortisation grid with date / EMI / interest / principal / balance columns to fill via PMT/PPMT/IPMT.

What the student ACTUALLY sees: rubric — `PMT formula 10pts`, `Sign convention 5pts`, `Full 240-row schedule 20pts`, …

---

## 3. Root cause (confirmed against `excelSimAdapter.js`)

`excelSimAdapter.js` line 216-237 (Shape 1e — top-level array-of-objects domain keys):

```js
const candidateKeys = Object.keys(config).filter((k) => {
  if (SKIP_KEYS.has(k)) return false;
  const v = config[k];
  return Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && !Array.isArray(v[0]);
});
candidateKeys.slice(0, 6).forEach((k) => { … sheetFromMatrix … });
```

The `SKIP_KEYS` set doesn't include `evaluation_criteria`, `deliverables`, `expected_outputs`, `stress_tests`, `acid_test`, `tools_required`, etc. — the rubric/scoring meta-keys. So when no real data tables exist, the adapter grabs the rubric and renders it as a sheet.

**Fix is NOT in the renderer.** The renderer is doing its best with what's there. The data does not exist in DB.

## 4. What would actually need to be built (STEP 2 — pending user approval)

To make every Excel sim "operate like real Excel" the user wants, we need **content, not code**. Specifically for each of the 49 prose-only sims:

1. Author/generate a realistic **DATA sheet** with 10-20 rows of Indian-finance-relevant data the student can manipulate (real Indian companies/tickers/numbers — Reliance, TCS, HDFC Bank, Infosys, Asian Paints, Titan, etc.).
2. Author/generate an **ANSWERS sheet** with labelled empty cells where the student writes formulas.
3. Author/generate **expected_answers** for auto-scoring (formula patterns + numeric expected results + tolerance).

For the 19 "rubric-only" sims, the same generation is needed BUT we must also harden the adapter's SKIP_KEYS so the rubric doesn't get rendered as data. (Two-line change once data exists.)

For the 3 M2 sims (`paired cols/rows` shape with `daily_rows: 30` as an integer), we need to expand the integer-count into actual rows of synthetic data.

**Recommended approach (STEP 2):** the user-proposed one-time LLM bulk-populate pass. Estimated:
- 49 prose-only sims + 19 rubric-only sims + 3 integer-stub sims = **71 sims to populate**
- ~1.5k input tokens prompt + ~2k output tokens per sim = ~250k tokens total
- Claude Haiku 4.5 (cheapest Emergent LLM key model) = roughly **$0.20–$0.40 one-time cost**
- Idempotent on `config.populated_at` timestamp.

**STOPPING HERE for user review before any DB writes or code changes.**

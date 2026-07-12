# Valuevade — MVP 2.0 Part 1 & Video Upload Bug PRD

## Original problem statement
Continuing the existing Valuevade project (equity-research / financial-modelling course, Supabase-backed FastAPI+React).

**Part A** — Auto-detect sessions missing simulations and generate one (Decision-Making / Book / Excel) per session using topic classification + Claude Sonnet 4.5.
**Part B** — Rebuild the Excel simulation on HyperFormula + react-window virtualization, with SUM/AVG/MIN/MAX/COUNT/IF/VLOOKUP/ROUND/CONCAT, absolute/relative refs, drag-fill, multi-sheet, copy/paste, undo/redo, and auto-grader. Cap 100×26.

Mid-session bug: Supabase Storage returns 413 for video uploads > 50 MB (Free-tier cap). User needed to upload a 30-min lecture.

## User persona
- Admin uploading lecture videos & course content.
- Student (aspiring equity analyst) working through modules, sessions, and simulations.

## Architecture
- **Backend**: FastAPI (uvicorn) at 8001, routes prefixed `/api`.
- **Frontend**: React (CRA/craco) at 3000, Tailwind + shadcn/ui, `lucide-react` icons.
- **Data**: Supabase (Postgres + Storage). `master_sessions`, `master_simulations`, `master_modules`. `session-videos` bucket.
- **AI**: Emergent Universal LLM key → Claude Sonnet 4.5 (`anthropic/claude-sonnet-4-5-20250929`) via `emergentintegrations`.
- **Excel engine**: HyperFormula 3.3.0 (GPL-v3 headless). Grid virtualization: react-window 1.8.11 (`FixedSizeGrid`).

## What's been implemented (2026-07-10)

### Video-upload bug fix (verified via testing_agent iteration_21 — 9/9 pytest pass)
- Backend `POST /api/admin/sessions/{id}/video-url` now accepts ANY https URL (previously required Supabase bucket path). Enables externally-hosted videos (YouTube / Vimeo / Cloudflare Stream / Mux / BunnyCDN).
- Backend `_MAX_VIDEO_BYTES` raised 500 MB → 5 GB.
- Frontend `VideoEditor.jsx`: added **"Use URL"** button + panel with `data-testid=video-url-{btn,panel,input,save,close}`.
- Frontend `AdminPanel.jsx` Session-Videos tab: per-row **"URL"** button (`admin-video-url-{id}`) that prompts and saves.
- 413 response now shows a clearer message directing admin to the URL workaround.
- Updated `tests/test_admin_video_signed_url.py` — external-URL branch now expects 200 (not 400) and max_bytes = 5 GB.

### MVP 2.0 Part A — missing sims (14 sims generated so far, script running in background)
- Script: `/app/scripts/generate_missing_sims.py`
  - Audit: 148 sessions missing sims across 22 modules.
  - Heuristic classifier maps title/desc/module → `excel` / `decision_making` / `book`.
  - LLM: Claude Sonnet 4.5 generates JSON per type (decision points, book chapters, Excel workbook + expected answers).
  - `book` stored as `sim_type='document'` with `config.format='book'` because the DB CHECK constraint on `master_simulations.sim_type` forbids `'book'`.
- Frontend router (`SimulationPage.jsx`) picks `BookSim` when `sim_type='document' && config.format==='book'`, else `DocumentSim`.

### MVP 2.0 Part B — Excel rebuild
- New `/app/frontend/src/components/simulations/HyperFormulaSpreadsheet.jsx`
  - HyperFormula engine for formula parsing & evaluation.
  - Virtualized grid via `FixedSizeGrid` (react-window 1.8.11).
  - Formulas: SUM/AVG/MIN/MAX/COUNT/IF/VLOOKUP/ROUND/CONCAT + arithmetic.
  - Absolute/relative refs (`$A$1`, `$A1`, `A$1`), ranges (`A1:B10`).
  - Drag-fill (autofill) w/ series detection + relative formula shifting.
  - Multi-sheet (add / rename / delete / switch).
  - Copy/paste, undo/redo, keyboard nav (arrows, Enter, Tab, F2, Delete).
  - Auto-grader (per-cell expected_value + tolerance + points).
  - Cap 100 rows × 26 cols; errors render as `#REF!` / `#DIV/0!` / `#NAME?`.
- `ExcelSim.jsx` swapped `SpreadsheetSim` → `HyperFormulaSpreadsheet`.
- `BookSim.jsx` — chaptered read-through with reflection prompts + MCQ checkpoints + final reflection.

### Env changes
- `/app/backend/.env` — added `REACT_APP_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EMERGENT_LLM_KEY`.
- `/app/frontend/.env` — added `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`.

## Backlog / Next tasks
- P0: Let the background script finish generating the remaining ~130 sims. Verify a few of each type render correctly.
- P0: Manual QA of the Excel rebuild (drag-fill vertical/horizontal, VLOOKUP, IF, undo/redo, multi-sheet).
- P1: Delete the now-unused `SpreadsheetSim.jsx` + `excelFormula.js` + `excelSimAdapter.js` once the new engine is confirmed stable across all existing Excel sims.
- P1: Book renderer regression test on legacy `sim_type='document'` sims (should still use `DocumentSim`).
- P2: Optionally upgrade Supabase project to Pro so direct video uploads > 50 MB work without external URL.

## Feb 2026 update — Course Complete QA seed + confetti polish

- Created `/app/scripts/seed_qa_complete_user.py` — idempotent seed for a
  dedicated QA user (`qa-complete@valuevade.test` / `QaComplete2026!`,
  full_name "Priya Kapoor", user_id `d0ab804b-...`) with an active
  enrollment and all 3 `master_capstone_projects` marked `is_completed=true`
  on their `user_capstone_projects` rows. Enrollment ID
  `c179f15d-2177-44b3-a855-8e6881139e93`.
- Fixed a latent detection bug in `CourseCompletePage.jsx`:
  the query selected `capstone_id` (nonexistent column) — replaced with
  `master_capstone_id`. Without this fix the "Congratulations" branch could
  never render for a real user.
- Added `canvas-confetti` burst on the Congratulations branch: center
  burst + two side cannons + a soft trailing burst, colors matched to
  brand palette. Fires exactly once (guarded by ref), respects
  `prefers-reduced-motion`.
- Test credentials file updated with the QA account (§ "QA — Course Complete").
- Visually verified via screenshot tool: headline renders, 3/3 capstones
  tile, cert panel shows "issued to Priya Kapoor · dated 12 July 2026",
  confetti particles visible mid-animation.

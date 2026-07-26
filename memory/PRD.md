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

## Feb 2026 — Waitlist migration Mongo → Supabase (bug fix)

**Bug**: `/admin-panel?tab=waitlist` on production only showed 3 signups instead
of 15+. Root cause: waitlist was stored in the deploy container's Mongo
(`db.waitlist`), which is ephemeral on Emergent redeploys, so historical
entries were wiped every redeploy.

**Fix**:
- New SQL migration `/app/scripts/migrations/0031_waitlist.sql` — creates
  `public.waitlist` with the same column shape as the old Mongo docs
  (`id, first_name, email, position, timestamp, referral_code, referral_count,
  referred_by`), unique indexes on `lower(email)` and `referral_code`, RLS
  enabled + service-role-only access.
- Backend endpoints migrated from `db.waitlist` → `_supabase_*` helpers:
    - `POST /api/waitlist` (join, idempotent on email)
    - `GET  /api/waitlist/all` (legacy JWT-protected)
    - `GET  /api/waitlist/count` (uses PostgREST HEAD + count=exact)
    - `DELETE /api/waitlist/{id}`
    - `GET  /api/admin/waitlist` (Supabase auth)
- **New endpoint**: `POST /api/admin/waitlist/import` — takes `{csv: "..."}`
  body, batch-inserts to Supabase, skips existing emails, regenerates
  colliding referral codes, returns `{inserted, skipped_existing, errors[]}`.
- Frontend `WaitlistTab` gained an **Import CSV** button + modal
  (`waitlist-import-btn`, `waitlist-import-modal`, `waitlist-import-textarea`,
  `waitlist-import-submit`).

**Deployment required**: SQL migration must be applied to Supabase before the
production backend can serve any waitlist route. Two ways:
1. Supabase Studio → SQL Editor → paste `0031_waitlist.sql` → Run.
2. `SUPABASE_MGMT_PAT=sbp_... python3 scripts/migrations/apply_migration_via_api.py 0031_waitlist.sql`

After that, user redeploys the app + uses the new "Import CSV" button to
paste the Mongo export.


## Feb 2026 — LLM Limits + Capstone Bug Fix + Pari Focus Mode

**User requirements (this session)**:
1. Personalised path generation capped at **4 lifetime** per user.
2. Pari chatbot cumulative LLM cost capped at **₹500** per user; once
   exceeded, Pari is disabled everywhere.
3. Capstones **locked** until every session + module project is done.
4. Pari **hidden** during quiz / interview / simulation active pages.
5. **Bug fix**: capstone pages were rendering "No capstone configured"
   because the multi-capstone (CAP-01/02/03) flow only checked for a
   single legacy user_capstone_projects row.

**Implementation**:
- Migration `0036_llm_limits.sql`: adds
  `profiles.customize_generations_count`, `profiles.pari_total_cost_inr`,
  RPCs `increment_customize_generations(uuid)` and
  `add_pari_cost(uuid, numeric)`, plus a backfill of
  `user_capstone_projects` for every (enrollment, master capstone).
  **NOT applied automatically** — requires Supabase Studio SQL Editor.
- Backend (`server.py`):
  - Helpers `_profile_snapshot`, `_pari_is_over_budget`, `_bump_pari_cost`,
    `_bump_customize_generations` (graceful degradation on missing columns).
  - New endpoint `GET /api/pari/status` returns
    `{pari:{total_cost_inr, limit_inr, over_budget, remaining_inr},
      customize:{generations_used, generations_limit, generations_remaining, exhausted}}`.
  - `/api/customize/generate` now requires `Authorization: Bearer`.
    Returns HTTP 429 with `detail.reason='customize_generation_limit_reached'`
    once count ≥ 4.
  - `/api/doubts/start`, `/api/doubts/ask`,
    `/api/doubts/extended/start`, `/api/doubts/extended/ask` return HTTP
    402 with `detail.reason='pari_cost_limit_reached'` when
    `pari_total_cost_inr ≥ 500`.
  - Every non-cached LLM turn calls `_bump_pari_cost` with a Claude
    Haiku 4.5 pricing estimate (input $1/M, output $5/M @ INR 85/USD).
- Frontend:
  - New hook `useIsPariBlocked` matches `/session/:id/{quiz|interview|simulation}`
    and `/mock-interview[/:id]`.
  - `DoubtsLauncherProvider` fetches `/api/pari/status` on mount, blocks
    `openDoubts` on those routes or when over-budget, and surfaces a
    toast to the user.
  - `AvatarPersona` (fixed positions) and `AskPariButton` both return
    null when `pariBlocked` — no floating chat trigger on graded surfaces.
  - `DoubtsSession` handles HTTP 402 inline (turns the session into an
    error state, blocks further messages).
  - `CustomizePage` shows a counter chip
    (`data-testid=customize-generation-counter`) with used/limit/remaining
    on the final wizard step. Button disabled when exhausted.
  - `PreviewPage` sends the Supabase Bearer token and handles 401/429.
  - `CapstonesListPage` fully locks the capstone grid behind an amber
    banner until every module + module project is complete. Card clicks
    now route to `/capstone/<masterCapstoneId>/start`.
  - `CapstoneStartPage` and `CapstoneTasksPage` accept `:capstoneId`,
    filter `user_capstone_projects` by (enrollment_id,
    master_capstone_id), and **auto-seed** a missing row so CAP-02/03
    never fall back to "No capstone configured".
  - `App.js` exposes new routes `/capstone/:capstoneId/start` and
    `/capstone/:capstoneId/tasks` (legacy routes preserved).

**Testing**: `iteration_33.json` (9/9 backend PASS, capstone bug + Pari
focus-mode verified) → `iteration_34.json` (regression on locked/unlocked
`/capstones` gate — 100% PASS).

**Deploy note**: For the cost / generation caps to actually enforce,
apply `0036_llm_limits.sql` via Supabase Studio → SQL Editor. Until then
the counters read 0 and every call passes through (graceful degradation
is intentional — no user gets locked out because of a missing column).



## Feb 2026 — Session-level Interview phase disabled (cost reduction)

**Rationale**: `/api/interview/evaluate` was the platform's only Claude
Sonnet 4.5 (5× the price of Haiku) call path. Hiding the phase for
learners cuts per-user AI cost by **~40-45%** with zero data loss — all
126 interview-bearing sessions also have quiz + simulation + notes, so
nothing gets stranded. Session-interviews previously awarded 0 direct
XP (comment: "interview pays via overall feedback"), so no XP
redistribution was required.

**Implementation** (fully reversible via a single feature flag):
- New flag `SESSION_INTERVIEW_ENABLED = false` in
  `frontend/src/utils/sessionPhases.js`. Also exports
  `SESSION_PHASE_ORDER = ['notes','quiz','simulation']`.
- `utils/progress.js`: `allDone` gate no longer requires
  `interview_completed`; `PHASE_ORDER = ['notes','quiz','simulation']`.
  `getNextPhaseRoute` naturally skips interview.
- `SessionPhaseGuard.jsx`: `PREV_PHASE.simulation = 'quiz'`; the
  legacy `interview` key redirects forward to `simulation/start`.
- `QuizCompletePage.jsx`: default `nextRoute` = Simulation.
- `DashboardPage.jsx`, `SessionStartPage.jsx`, `SessionCompletePage.jsx`,
  `useSessionTimer.js`: interview phase removed from all phase lists
  and progress bars. Copy updated to "3-phase journey" / "all 3 phases".
- `NotesCompletePage.jsx`: badge says "Phase 1 of 3 done".
- `App.js`: `/session/:sessionId/interview[/start|/complete]` routes
  replaced with an `InterviewToSimulation` wrapper that reads
  `useParams().sessionId` and Navigates absolutely to
  `/session/${sessionId}/simulation/start` (avoids the React Router v6
  flat-route `..` pitfall which was flagged as CRITICAL in
  iteration_35 and fixed in iteration_36).
- Backend `server.py::evaluate_interview_response`: raises HTTP 410
  Gone with `detail.reason='session_interview_disabled'`. Legacy body
  preserved unreachable so re-enable is a one-line revert.

**What was deliberately NOT touched**:
- `master_interview_questions` Supabase table — data preserved.
- Admin panel interview-question CRUD — still fully functional.
- `InterviewPage.jsx`, `InterviewStartPage.jsx`,
  `InterviewCompletePage.jsx` — code intact on disk.
- Existing `user_sessions` rows with `interview_completed=true` — the
  new `allDone` gate ignores that column gracefully.
- `/api/mock-interview/*` (Haiku) — untouched and still the recommended
  interview practice surface.

**Testing**: `iteration_35.json` (found 1 CRITICAL Navigate bug + 2
copy issues) → `iteration_36.json` (100% pass on all 3 fixes).

**Expected per-user cost after this ship**:
| Profile | Before | After |
|---|---|---|
| Typical user | ~₹165 | **~₹90** (~45% cheaper) |
| Power user | ~₹425 | **~₹250** (~40% cheaper) |
| Absolute worst-case with existing caps | ~₹600 | **~₹380** |

To fully close the gap, next step is extending the ₹500 profile-level
cap to also attribute mock-interview cost (currently only Pari doubts
+ customise contribute). That would yield a true single ceiling.



## Feb 2026 — LinkedIn-share Rewards Engine

**User request**: When a learner completes a module project (defaults:
Module 1, Module 10, Module 23 / final) or the first capstone (CAP-01),
show a card offering a free resource (resume template, IB toolkit, etc.)
in exchange for sharing the milestone on LinkedIn. Admin can add/edit/
reorder/delete rewards, re-attach them to different modules, and upload
files up to 25MB (pdf/docx/xlsx/zip).

**Implementation**:
- **DB migration `0037_rewards.sql`** — `master_rewards`
  (trigger_type = module_complete | capstone_complete, trigger_ref_id,
  resource_file_path, linkedin_message, order_index, is_active) +
  `user_reward_claims` (unique per user × reward) + private storage
  bucket `rewards`. RLS: learners read active rewards + read/insert
  their own claims; service_role writes.
- **Backend** (`wave_endpoints.py` +240 lines) —
  learner API: `GET /api/rewards/eligible`, `POST /api/rewards/claim`,
  `GET /api/rewards/{id}/download` (re-issues signed URL);
  admin API: `GET/POST/PATCH/DELETE /api/admin/rewards`,
  `GET /api/admin/rewards/triggers` (populates dropdowns),
  `POST /api/admin/rewards/upload` (25MB max + MIME whitelist,
  service_role → Supabase Storage). Server-side eligibility check on
  every claim so the FE can never fake it. All endpoints degrade
  gracefully if the migration hasn't run (return `table_ready:false`
  with a hint).
- **Frontend** —
  new shared `components/rewards/RewardCard.jsx` handles the whole
  "Share on LinkedIn → I've shared → download" flow. Uses a standard
  (non-AI) post template — admin can override per reward.
  Wired into `ModuleProjectCompletePage.jsx` (fetches
  `master_module_id` from `user_modules`) and `CapstoneCompletePage.jsx`
  (uses `capstone.master_capstone_id`).
- **AdminPanel** — new "Rewards" tab (alongside FAQ, Customisation,
  Feedback). Full CRUD + upload + toggle active + reorder via
  `order_index`. Editor modal populates trigger-target dropdowns from
  `/api/admin/rewards/triggers` and validates before save.

**Bug found & fixed during testing (iteration_37)**:
FastAPI 422 on every `/api/rewards/claim` because
`_RewardClaimReq(BaseModel)` was declared *inside* the
`register_wave_endpoints()` closure — FastAPI's dependency inspector
can't classify function-locally-defined BaseModels as request bodies,
so it fell back to treating them as query params. Fixed by switching
to the `body: dict` + explicit `.get(...)` pattern used by every
sibling endpoint in the same file. Reproducible with a plain curl.

**Testing**: `iteration_37.json` — 100 % pass on 16 backend tests
(auth guards, admin-CRUD gating, upload, graceful-degradation, abuse
guards, idempotency) + 100 % pass on the admin-panel Rewards tab +
RewardCard null-when-no-reward FE checks. Full E2E (LinkedIn share →
claim → download) blocked only until the user applies migration 0037.

**Deploy note**: apply `/app/scripts/migrations/0037_rewards.sql` via
Supabase Studio → SQL Editor. Then in AdminPanel → Rewards tab, click
"Add Reward" for each of Module 1 / Module 10 / Module 23 / CAP-01,
upload the file, and set the LinkedIn post. Learners on those trigger
events see the reward card automatically.


## Jun 2026 — Excel simulation rebuilt on Univer (real-Excel experience)

**User request (previously missed, P0)**: "create the full excel simulation
like a real excel with all the real excel functionalities accurately...
it should work perfectly and operate smoothly". Pain points: formulas not
calculating, drag-fill not working, paste failing.

**Implementation**:
- New `/app/frontend/src/components/simulations/UniverSpreadsheet.jsx`
  built on **Univer 0.25.1** (`@univerjs/presets` + core/filter/sort/
  find-replace presets, `rxjs` peer dep added). Real Excel UI out of the
  box: ribbon toolbar (Start/Formulas/Data), formula bar + name box,
  500+ functions, cross-sheet refs (`Data!B2:B11`), cell formatting,
  number formats, column/row resize, merge, freeze, filters, sorting,
  find & replace, drag-fill/autofill, clipboard paste (incl. from real
  Excel), undo/redo, multi-sheet tabs, right-click menus, dark mode
  (auto-detected from the app's `.dark` class).
- `ExcelSim.jsx` + `DevSimPreview.jsx` swapped from
  `HyperFormulaSpreadsheet` → `UniverSpreadsheet` (identical props
  contract; old component left on disk).
- Canonical workbook → Univer `IWorkbookData` converter with styles:
  bold headers (violet), read-only cells (grey), answer cells (amber).
- **Read-only protection**: `BeforeSheetEditStart` cancel on protected
  cells; `BeforeClipboardPaste` cancel when paste lands on protected
  ranges; `BeforeCommandExecute` soft-cancel (`event.cancel = true`,
  NEVER throw — throwing surfaced CRA's error overlay, found in
  iteration_38) for structural commands (remove/rename sheet,
  insert/remove rows/cols, move) on exercise sheets and all mutations
  after submit.
- **Auto-grader kept**: reads computed values via facade
  `getRange(addr).getValue()`, same tolerance/points logic, colours
  graded cells green/red, same score banner + testids
  (`spreadsheet-submit-btn`, `spreadsheet-score-banner`, ...).
- **Autosave/restore kept**: state v2 = `{version:2, univer_snapshot,
  pivot_states}` via existing `/api/simulations/workbook*` endpoints;
  legacy v1 drafts (`{sheets:[{name,cells}]}`) merge into the canonical
  workbook before conversion. Verified E2E on
  `/session/:id/simulation` (typed value → autosave → reload → restored).
- Pivot sheets (1 sim) render via an outer tab strip → `PivotTableSheet`
  (previously they rendered as an empty grid — regression fixed for free).
- **StrictMode gotcha**: Univer must be disposed *synchronously* in the
  effect cleanup. A deferred (`setTimeout`) dispose kills the second
  StrictMode mount's canvas → blank grid. The resulting React
  "synchronously unmount a root" console warning is dev-only noise.

**Testing**: `iteration_38.json` (~92% pass; 1 HIGH: throw-based command
guard triggered error overlay → fixed with `event.cancel`) + manual
verification of the fix, autosave/restore on the real session route, and
post-submit lock without overlay. Test user session
`7b6958fc-e468-427a-b4cd-514ebe8d4cfd` (M1 "Navigate the Grid") has
notes/quiz flags set true to allow direct simulation-phase access.


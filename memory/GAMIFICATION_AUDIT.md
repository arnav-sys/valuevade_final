# Gamification Audit — Valuevade

**Date**: 2026-05-21
**Audit scope**: Original product spec for the gamification layer vs the live codebase.
**Method**: Static read of `frontend/src/`, `backend/server.py`, `scripts/migrations/*.sql`, plus live REST probes against Supabase Postgres (master_levels, master_badges, RPCs).

Legend: ✅ implemented · 🟡 partial · ❌ missing · ⚠️ broken

---

## 1. XP & LEVELLING ENGINE

| Spec item | Status | Evidence |
|---|---|---|
| Module session completion +50 XP | ✅ | `frontend/src/utils/progress.js:160` → `markPhaseComplete()` calls `awardXP` with `amount: 50, reason: 'session_complete'` |
| Quiz correct +10 XP | ✅ | `frontend/src/utils/xp.js:243` → `computeQuizXP()` uses `correct * 10 + attempted * 2` |
| Quiz attempted +2 XP | ✅ | Same `computeQuizXP()`, line 243 |
| Simulation submit +100 XP | ✅ | `frontend/src/utils/progress.js` calls `awardXP({ amount: 100, reason: 'simulation_complete' })` |
| Daily login streak +25 XP | ✅ | `frontend/src/contexts/XPContext.jsx:215` → `awardXP({ amount: 25, reason: 'daily_login' })` |
| Capstone complete +300 XP | ✅ | `frontend/src/components/CapstoneTasksPage.jsx:165` → `awardXP({ amount: 300, … })` |
| Levels: Junior Analyst 0 → Research Associate 500 → Equity Analyst 1500 → Senior Analyst 3500 → Portfolio Manager 7000 → CIO 12000 | ✅ | Live REST: `master_levels` returns exactly `[{1,Junior Analyst,0},{2,Research Associate,500},{3,Equity Analyst,1500},{4,Senior Analyst,3500},{5,Portfolio Manager,7000},{6,CIO,12000}]` |
| XP bar animates on every gain | ✅ | `frontend/src/components/gamification/XPBar.jsx` — Realtime-driven, animated fill on `total_xp` delta |
| "+50 XP" floating particle on completion | ✅ | `frontend/src/components/gamification/XPGainParticle.jsx`, mounted via `XPRoot.jsx:13`; toast also shown at `XPContext.jsx:127` |

**Section verdict**: ✅ fully implemented.

⚠️ **One stale-constant find**: `SessionCompleteSummaryCard.jsx` hard-codes a different level threshold ladder (`[0, 250, 600, 1200, 2000, 3200, 5000, 7500, 11000, 16000]`) — looks like dead/legacy code from a pre-spec ladder. Live `master_levels` is authoritative (and correct); the summary card never reads from this constant for live display, so it's cosmetic dead code. Flag for cleanup, not a behaviour bug.

---

## 2. STREAK SYSTEM

| Spec item | Status | Evidence |
|---|---|---|
| Daily login streak tracked per user, reset midnight IST | ✅ | `scripts/migrations/0002_streak_engine.sql` — `bump_streak()` RPC keyed on `(now() at time zone 'Asia/Kolkata')::date` |
| 3-day fire badge | ✅ | `master_badges.fire_starter` (rare, consistency, criteria_json `{streak_gte:3}`) |
| 7-day gold flame | ✅ | `master_badges.week_warrior` or equivalent at 7-day threshold (rare, consistency, criteria `{streak_gte:7}`) |
| 30-day legendary aura | ✅ | `master_badges.iron_discipline` (legendary, consistency, `{streak_gte:30}`); `StreakCounter.jsx` renders an aura at the 30-day tier |
| 1 freeze token every 10 days, spendable | ✅ | `scripts/migrations/0002_streak_engine.sql:43` → `freeze_tokens_at_event`; `0002:243` `v_tokens` arithmetic. Token spend RPC + UI in `StreakRoot.jsx` |
| Streak broken → shame card with "Rebuild" CTA | ✅ | `frontend/src/components/gamification/ShameCard.jsx:14` reads `pending_shame.lost_days` + `lost_xp_value` from `user_stats.last_streak_break_*` fields; spec'd Rebuild CTA renders |

**Section verdict**: ✅ fully implemented.

---

## 3. BADGE & ACHIEVEMENT SYSTEM

| Spec item | Status | Evidence |
|---|---|---|
| 20+ badges across Knowledge/Speed/Consistency/Social/Secret | ✅ | Live REST: 24 rows in `master_badges`. Categories present: knowledge, speed, consistency, social, secret. |
| "SQL Wizard" (M6) | ✅ | `master_badges.sql_wizard`, rare, knowledge |
| "Ratio Monk" (M9) | ✅ | `master_badges.ratio_monk`, rare, knowledge |
| "Speed Analyst" (session < 8 min) | ✅ | `master_badges.speed_analyst`, rare, speed, `{session_minutes_lt:8}` |
| "Iron Discipline" (30-day streak) | ✅ | `master_badges.iron_discipline`, legendary, consistency |
| "5-Day Grinder" | ✅ | `master_badges.five_day_grinder`, rare, consistency |
| "Leaderboard Crasher" (top 10) | ❌ | No `leaderboard_crasher` row in `master_badges`. Also no leaderboard infrastructure (see §4). |
| "First Blood" (first quiz) | ✅ | `master_badges.first_blood`, common, knowledge |
| Rarity tiers: common / rare / epic / legendary with glow intensity matching rarity | 🟡 | All 4 rarity tiers populated (common 8, rare 13, epic 1, legendary 2). `BadgeCabinet.jsx` renders rarity-tinted borders, but the **glow intensity scaling** is uniform across tiers — common and legendary look near-identical. |
| Hidden/Secret badges show as silhouettes until unlocked | ✅ | 3 secret badges in DB (`night_owl`, `weekend_warrior`, `comeback_kid`); `BadgeCabinet.jsx` renders locked secrets as silhouettes when `is_unlocked=false` and `is_secret=true` |

**Section verdict**: 🟡 partial — 1 named badge missing, glow intensity scaling not differentiated by rarity.

---

## 4. LEADERBOARD

| Spec item | Status | Evidence |
|---|---|---|
| Weekly + All-time leaderboards | ❌ | No leaderboard route, no `Leaderboard*.jsx` component, no `leaderboard_*` table, no RPC. `grep -rln leaderboard` returns 0 hits in `frontend/src/` and `backend/server.py`. |
| Top 10 with rank/name/XP/level/streak | ❌ | n/a |
| Current user rank highlighted | ❌ | n/a |
| Animated rank changes / confetti for new #1 | ❌ | n/a |
| Filters: This Week / All Time / Module-specific | ❌ | n/a |

**Section verdict**: ❌ entire feature missing. This is the largest single gap.

---

## 5. DAILY CHALLENGES

| Spec item | Status | Evidence |
|---|---|---|
| 3 rotating daily challenges, reset midnight IST | ✅ | `scripts/migrations/0007_daily_challenges.sql` — `generate_daily_challenges()` RPC seeds 3 rows in `user_daily_challenges` per `(user_id, challenge_date IST)` |
| Examples: "Answer 5 quiz questions", "Complete 1 session", "Review 3 flashcards" | 🟡 | Quiz + session challenge types present. **"Review N flashcards"** challenge type **not in pool** — flashcards aren't a current feature, but the spec text named it specifically. |
| Per-challenge progress bar | ✅ | `frontend/src/components/gamification/DailyChallengesCard.jsx` renders per-challenge progress bar |
| All 3 → "Daily Champion" bonus (+75 XP + 24hr badge glow) | ✅ | `0007_daily_challenges.sql:237` awards `+75 XP` with reason `daily_champion_bonus`; `DailyChampionOverlay.jsx` triggers the 24h badge-glow announcement |
| Challenges generated based on user's current module position | 🟡 | `0007_daily_challenges.sql` `generate_daily_challenges()` reads from `user_modules` and biases challenge pick toward the in-progress module, but the **set of challenge types is fixed** — there's no per-module customisation (e.g. "Practice 3 ratio analysis questions" when on M9). |

**Section verdict**: 🟡 partial — flashcard challenge type missing; per-module customisation is shallow.

---

## 6. MODULE PROGRESS MAP

| Spec item | Status | Evidence |
|---|---|---|
| Constellation/star map UI, each module = a star node | ✅ | `frontend/src/components/gamification/ModuleConstellationMap.jsx` mounts at `/journey` and inside `<PortfolioPage>` |
| Completed = glowing gold | ✅ | `ModuleConstellationMap.jsx` node renderer branches on `is_completed` → gold gradient + glow |
| In progress = pulsing blue | ✅ | Same renderer, `completion_percent > 0` and not completed → blue pulse animation |
| Locked = dim | ✅ | Default state (no progress) → dim node |
| Connecting lines between prerequisites | 🟡 | `<line>` elements drawn between nodes (`ModuleConstellationMap.jsx:285`), **but the lines connect by order_index sequence, NOT by `master_module_prerequisites` table.** There's no actual prerequisites table in DB — modules are linear, so this is "linear prereq lines" not "true graph prereq lines." |
| Click node → module stats (completion %, XP earned, time spent) | ✅ | `ModuleConstellationMap.jsx:137–140` shows Completion%, XP earned, Time on click |

**Section verdict**: 🟡 partial — prereq lines are sequence-based, not graph-based. Functionally fine for a linear curriculum; semantically the spec asked for true graph prereqs.

---

## 7. REWARD NOTIFICATIONS & DOPAMINE TRIGGERS

| Spec item | Status | Evidence |
|---|---|---|
| Toast on every XP gain (bottom-right, 2s fade) | ✅ | `frontend/src/contexts/XPContext.jsx:127` → `toast.success(`+${amt} XP`, ...)` via sonner |
| Full-screen celebration overlay for level up | ✅ | `LevelUpOverlay.jsx` — particle burst, `useSound().playSound('level_up')`, auto-dismiss 6s |
| Full-screen overlay for badge unlock | ✅ | `BadgeUnlockOverlay.jsx`, mounted via `BadgeRoot.jsx` |
| Full-screen overlay for streak milestone | ✅ | `StreakMilestoneOverlay.jsx` — uses `canvas-confetti` for fire-themed burst |
| Sound on level up | ✅ | `useSound().playSound('level_up')` in `LevelUpOverlay.jsx:35` |
| End-of-session summary card (XP, badge progress, streak, next milestone) | ✅ | `SessionCompleteSummaryCard.jsx` |
| "You're X XP away from Level Y" persistent dashboard nudge | ✅ | `XPBar.jsx` (variant `near-level`) renders "X XP away from Level N+1" |

**Section verdict**: ✅ fully implemented.

---

## 8. PROFILE & STATS PAGE

| Spec item | Status | Evidence |
|---|---|---|
| Current level | ✅ | `ProfilePage.jsx` renders level via `<XPBar>` |
| Total XP | ✅ | Same, via `user_stats` |
| Active streak | ✅ | `<StreakCounter>` mounted on profile |
| Badges grid | ✅ | `<BadgeCabinet>` mounted on profile |
| Modules completed | ✅ | Pulled from `v_module_progress_summary` |
| Leaderboard rank | ❌ | No rank shown (no leaderboard exists) |
| Join date | ✅ | `ProfilePage.jsx:165` — formats `user.created_at` or `profile.created_at` |
| 90-day GitHub-style heatmap, IST-labelled, green active / purple high / navy none | ✅ | `ActivityHeatmap.jsx` — `TIER_COLORS = ['#1a2030', '#1f5733', '#2d9145', '#3ed05b', '#9c6bff']` (navy → 3 greens → purple). 90 days. IST-bucketed. |

**Section verdict**: 🟡 partial — leaderboard rank tile missing (knock-on from §4).

---

## BEHAVIOURAL HOOKS

| Spec item | Status | Evidence |
|---|---|---|
| 1. Variable reward — quiz XP randomised ±5 | ✅ | `frontend/src/utils/xp.js:245` → `const variance = Math.floor(Math.random() * 11) - 5;` then `base + variance`, clamped ≥ 0 |
| 2. Loss aversion — streak break shows XP lost | ✅ | `ShameCard.jsx:14` reads `lost_xp_value`, computed in `0002_streak_engine.sql:308` as `v_lost_xp := v_current * 25` |
| 3. Progress endowed — new users start at Level 1 with 10 XP pre-filled | ✅ | `XPContext.jsx:175–200` — backfills `+10 XP` via `signup_bonus` reason on first authenticated load if not already awarded |
| 4. Near-miss — "3/5 sessions — so close!" when 60%+ complete | ✅ | `NearMissBanner.jsx` renders when `progress_pct >= 60` |
| 5. Social proof — "12 students completed this module this week" | ❌ | `grep -rn 'students completed\|12 students'` returns 0 hits in `frontend/src/`. No component, no aggregate query. |
| 6. Commitment device — "Set a daily goal" modal on first login (5/10/15 mins), track vs goal | ✅ | `DailyGoalModal.jsx:17–19` shows exactly 5/10/15-min options. `DailyGoalTracker.jsx` mounted on dashboard (line 543) tracks vs goal. |

**Section verdict**: 🟡 partial — Social proof hook missing.

---

## OVERALL SUMMARY

| Section | Status |
|---|---|
| 1. XP & Levelling | ✅ complete |
| 2. Streaks | ✅ complete |
| 3. Badges | 🟡 partial (1 badge, glow scaling) |
| 4. Leaderboard | ❌ entirely missing |
| 5. Daily Challenges | 🟡 partial (flashcards, per-module customisation) |
| 6. Module Map | 🟡 partial (linear vs graph prereqs) |
| 7. Notifications | ✅ complete |
| 8. Profile | 🟡 partial (rank tile) |
| Behavioural hooks | 🟡 partial (social proof) |

**Big picture**: ~75% of the spec is implemented and working in production. The single biggest gap is the **leaderboard system** — it's referenced by multiple other spec items (rank in profile, social proof, leaderboard_crasher badge) so closing it unblocks 3 separate partials.

---

## GAP LIST (PRIORITIZED)

### P1 — Foundational gaps with cascading impact

- [ ] **[P1] Leaderboard system (entire feature)** — Add `leaderboard_weekly` / `leaderboard_all_time` materialized views (or RPCs) over `user_xp_events` + `user_stats`. Build `<LeaderboardPage>` at `/leaderboard` with top-10 table, current-user-rank highlight (even when outside top 10), and weekly-reset confetti for new #1. Filter chips: This Week / All Time / Module-specific.
- [ ] **[P1] Social proof hook ("N students completed this module this week")** — Add aggregate count query over `user_modules.is_completed` grouped by module + last-7-days; surface as small chip on module cards in dashboard / journey map.
- [ ] **[P1] Badge: `leaderboard_crasher` (top 10)** — Add row to `master_badges` (rare, social, criteria `{type:"leaderboard_rank_lte", rank:10, window:"weekly"}`). Wire evaluator to fire when user enters weekly top 10. Blocked on the leaderboard endpoint.

### P2 — Polish-tier gaps that affect feel, not function

- [ ] **[P2] Rarity-scaled glow intensity on badges** — Modify `BadgeCabinet.jsx` badge tile to map rarity → glow halo intensity (common = subtle, rare = medium, epic = strong, legendary = aura-with-particles). Currently uniform.
- [ ] **[P2] Leaderboard rank tile on profile** — Add a "Rank: #N (this week)" stat tile to `<ProfilePage>` after the leaderboard endpoint exists.
- [ ] **[P2] Per-module customised daily challenges** — Extend `generate_daily_challenges()` RPC to pick challenge text from a module-scoped template pool (e.g. on M9, prefer "Solve 3 ratio analysis questions" over generic "Solve 3 quiz questions"). Today the SQL biases pick to the active module but reuses the same generic challenge text.

### P3 — Spec-faithful nice-to-haves

- [ ] **[P3] Daily challenge: "Review N flashcards"** — Either add the flashcard challenge type to the pool (blocked on flashcards being a feature) OR officially rename to "Re-read N notes cards" / "Ask Pari N questions" / "Read today's news" — challenges that map to existing surfaces.
- [ ] **[P3] True prereq graph in module map** — Add `master_module_prerequisites(module_id, requires_module_id)` table + draw connecting lines off that graph instead of `order_index` adjacency. Current linear layout is functionally fine for the 15-module sequence but semantically not a graph.
- [ ] **[P3] Cleanup stale level ladder in `SessionCompleteSummaryCard.jsx`** — Remove the dead `[0, 250, 600, 1200, 2000, 3200, 5000, 7500, 11000, 16000]` constant or wire it to `master_levels` for consistency. Cosmetic dead code; no behaviour bug.

---

## RECOMMENDATION ON SEQUENCING

**Patch first (one focused block)**:

1. **P1 leaderboard** — single biggest unlock. Adds the missing endpoint, the new page, the rank-on-profile tile, and the `leaderboard_crasher` badge in one coherent change. Closes 3 partials at once.
2. **P1 social proof** — small read-side aggregate, ~30 mins. Adds the only missing behavioural hook.

**Defer**:

- **P2 rarity glow** — visual polish, no behaviour change. Bundle with a future "design polish" pass.
- **P2 per-module daily challenges** — challenge engine is already working with generic copy; per-module text is incremental UX, not function.
- **P3 flashcards / true prereq graph / stale-constant cleanup** — defer unless you specifically want spec literalism. Flashcards aren't a current feature; the linear prereq graph is fine for a linear curriculum; the stale constant is dead code with zero user impact.

**Net effort estimate**: P1 leaderboard + social proof is one focused phase (~2–3 hours of solid work end-to-end including migration + view + endpoint + page + badge wiring + tests). Everything else is sub-30-min polish.

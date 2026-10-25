# Iteration 104 — main-agent follow-up (2026-10-25)

## Finding resolved
The duplicate course-ID React key came from sibling `EnterpriseCurriculum` and
`EnterprisePricing` elements in `EnterpriseCourseDetailsPage.jsx`, both using
`key={course.id}`. Changed to `curriculum-${course.id}` and `pricing-${course.id}`.
No duplicate API data or catalogue state concatenation was present.

## Verified
- Live enterprise course renders correct title, 20 published modules and 215 sessions.
- Three repeated student → enterprise → student course-detail switches retain the exact
  ID and load each audience's corresponding content.
- Enterprise All Courses shows six real catalogue cards.
- Catalogue request forced to test-only 503: visible error, retry restores actual six
  courses. Curriculum request forced to test-only 503: visible error, retry restores
  actual module list. No production test hooks were required or added.
- Initial first-request-only failure injection was consumed by dev StrictMode requests;
  re-tested by holding the test-only failure until the explicit retry action.
- No duplicate-key warnings in final browser console after retries/detail rendering.
- Mobile enterprise AI Agents selector updates to Bookkeeping and the associated inputs,
  assisted work, outputs and human owner.
- Reused 3D canvas nonblank: 350×208; 844 opaque pixel samples, 295 unique sampled colours.
- Screenshots: enterprise course at desktop1920×800, AI workflow at mobile390×844;
  overflow offender arrays empty. Prior catalogue screenshots also passed both widths.
- No actual payments, emails, lead writes, account modifications or runtime mocks.

## Evidence
- `/root/.emergent/automation_output/20261025_093412_544e42c7b100/` — course detail and
  audience transitions; first-request-only injection was inconclusive here.
- `/root/.emergent/automation_output/20261025_093504_18d77cab7c28/` — conclusive error/retry,
  zero duplicate warnings, mobile selector/canvas and overflow checks.
- `/app/test_reports/iteration_104.json` — tester report, finding superseded above.
- `/app/backend/tests/test_iter104_catalog_enterprise_smoke.py` — tester-added backend
  smoke tests (4/4 passed), no application-code modifications from tester.

## Remaining external flows outside this request
Resources public API is now200 and enterprise config reports enquiries available.
Do not infer resource purchases/uploads/downloads or notification delivery from those
reads. These require separate E2E validation. Managed email was not sent or verified.
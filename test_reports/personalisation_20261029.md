# Personalisation sections — 2026-10-29

## Scope
Frontend content/presentation update only. Existing AI planner reviewed for accurate copy;
no generation request, database write, authentication change, paid action or API mock added.

## Passed
- JSX parsing: LandingPage.js, CourseDetailsPage.jsx, PersonalisationSection.jsx,
  UpcomingCoursePage.jsx (also rechecked after the accordion correction).
- Real `/api/courses/catalog` returns 200; live and upcoming IDs selected from this response.
- Landing and live detail each show heading, AI/curriculum description, three numbered
  steps and original AI bitmap artwork. New section test IDs are unique.
- Desktop 1920×800 and mobile 390×844: all three routes have no elements extending beyond
  the right viewport edge after the mobile syllabus correction.
- Landing Find your course navigates to `/courses`.
- Light and dark theme checks pass on landing/detail. Dark text rgb(245,241,255),
  accent #99b8ff. Final dark artwork decode check confirms loaded image at 280×139.25px.
- Mobile module-toggle-1 expands and reports `data-state=open`.
- Upcoming section explicitly says planned, confirms enrolment not open and has no CTA.

## Finding and resolution
Existing live detail syllabus AccordionTrigger exceeded the mobile viewport, driven by
the module row minimum intrinsic width. Added local `min-w-0` to the trigger (not the
global accordion). Repeat checks return OVERFLOW [] on all three routes and both themes.

## Tool-run notes / evidence
Initial browser script used unsupported get_by_test_id(exact=True); corrected the test
script only. A dark-mode shot taken before lazy artwork decoded showed an empty image
area; final check awaited decode and confirmed rendering, without changing app code.
- Successful full browser checks: automation_output/20261029_203915_7cd790679956.
- Final visual verification: automation_output/20261029_203958_cbcea2cf4a14.
- Final screenshots: personalisation-desktop-final.jpeg / personalisation-mobile-final.jpeg.

## Limits
No production build/deploy claim. No payment, AI generation or authenticated enrolment
E2E was needed for this incremental content-only task. No runtime mocks introduced.
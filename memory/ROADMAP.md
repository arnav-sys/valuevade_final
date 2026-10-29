# Valuevade — Prioritised Roadmap
Updated 2026-10-29. See PRD.md for current requirements and CHANGELOG.md for history.

## P0 — current request
- No known blocker in the AI-personalisation sections. Await user visual review.

## P1 — previously pending, not changed by this request
- Enterprise enquiry email: complete and verify managed server-side notifications.
  Preserve honest unsent/manual email-draft fallback until real delivery works.
  Use the integration playbook before modifying the external email service.
- Standalone resource purchase: verify non-enrolled purchaser Razorpay checkout,
  captured-payment webhook/recovery and post-payment private download end to end.
- Admin must upload actual professional resource files; preserve File coming soon
  where none exists. Confirm intended prices before enabling paid standalone sales.
- Monitor previously intermittent Supabase eligibility timeouts if they recur.

## P2 — maintenance / future
- Split monolithic backend/server.py into route modules.
- Address existing React hook dependency warnings in EnterprisePage.jsx and ModuleLab.jsx.
- Continue splitting legacy CourseDetailsPage.jsx into focused components.
- Consider queued retry for storage cleanup after provider deletion failures.
- Optional conversion enhancement: clearly labelled example of two learning paths for
  different backgrounds, showing what personalisation changes before sign-up.
- Existing later backlog: admin exam analytics, resource version/update indicators,
  study reminders (scheduled-task skill and email integration required when approved).

## Guardrails
- No new integrations or paid actions are implied by the marketing-section request.
- Upcoming courses must not gain working enrolment or claims of available personalisation
  until their actual launch implementation is verified.
- Preserve Razorpay mode/configuration and webpack heap-memory build fix.
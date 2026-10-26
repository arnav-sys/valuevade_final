# Resources / purchases follow-up — 2026-10-26

## Verification
- Re-ran testing-agent-authored suite after cleanup and dedup hardening:
  `pytest -q tests/test_iter107_resources_purchases.py --junitxml=/app/test_reports/pytest/iteration107_followup.xml`
  **16 passed in 25.44 seconds**.
- Extended signed-file assertion to GET the actual signed URL, open the bytes with openpyxl,
  and confirm `QA!A1 == Valuevade QA`. This verifies content, not just URL shape.
- Browser verification of checkout callback used **TEST-ONLY MOCKED** Razorpay constructor,
  order/verification responses, and the post-success entitlement response. Existing unpaid
  test account used; no real order, payment or entitlement database writes occurred.
  - Rejected verification: no extra enrolment request, cached is_enrolled remains false.
  - Successful verification: request count increased from 1 to 2, cache became true.
  - Test interception exists only in disposable browser session, not application code.
- Original smoke checks: 1920x800 and 390x844 purchases view, overflow lists empty.
- Testing agent covered responsive widths 320/390/768/1024/1440 and cache navigation/reload/isolation.

## Maintenance and cleanup
- Removed obsolete `test_resources_marketplace.py`: superseded by iteration107 suite and
  contained a hardcoded Supabase anon key plus contradictory generated-CSV expectations.
- Fixed QA fixture teardown to read the current replacement object path before deleting metadata.
- Removed three orphaned iteration107 QA files only after confirming no resource row referenced
  their resource folder; only reserved `qa-replace.xlsx`/`qa-upload.pdf` names were removed.
- API deduplicates individual resource items when also bundled; all real orders remain in history.
- No user credentials modified. No real course/resource content generated or left behind.

## Remaining limitations
- The seven seeded resources have no final professional files yet; admin upload is required.
- Full actual Razorpay standalone-resource payment plus webhook journey remains unverified.
- Existing independent lesson eligibility checks remain server-authorised, not bypassed by UI cache.
- Storage cleanup failures are logged; automated orphan retry is future maintenance work.
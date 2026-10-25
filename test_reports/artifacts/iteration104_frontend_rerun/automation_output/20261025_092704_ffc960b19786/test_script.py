async def run_test(page, output_dir, page_url):
    import re

    console_errors = []
    page.on("console", lambda msg: console_errors.append(f"{msg.type}: {msg.text}") if msg.type in ["error", "warning"] else None)

    async def choose_student_if_prompted():
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]', force=True)
            await page.wait_for_timeout(500)

    async def choose_enterprise_if_prompted():
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-enterprise"]', force=True)
            await page.wait_for_timeout(500)

    async def check_overflow(label):
        overflow = await page.evaluate("""() => {
          const de = document.documentElement;
          return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, overflow: de.scrollWidth > de.clientWidth };
        }""")
        print(f"{label} overflow={overflow['overflow']} scrollWidth={overflow['scrollWidth']} clientWidth={overflow['clientWidth']}")

    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        base = "https://fintech-mvp-38.preview.emergentagent.com"
        live_id = "5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c"
        soon_id = "ceccacd7-51aa-42a7-9de4-c89c23757f16"

        print("Step 1: Landing desktop links")
        await page.goto(base, wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="navbar"]', timeout=15000)
        await page.wait_for_selector('[data-testid="landing-all-courses-link"]', timeout=8000)
        await page.wait_for_selector('[data-testid="landing-ai-agents-link"]', timeout=8000)
        print("PASS: Landing links visible")

        print("Step 2: Landing mobile menu")
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto(base, wait_until="domcontentloaded")
        await choose_student_if_prompted()
        await page.click('[data-testid="mobile-menu-toggle"]', force=True)
        await page.wait_for_timeout(400)
        await page.wait_for_selector('[data-testid="landing-mobile-all-courses-link"]', timeout=8000)
        await page.wait_for_selector('[data-testid="landing-mobile-ai-agents-link"]', timeout=8000)
        print("PASS: Mobile menu links present")

        await page.set_viewport_size({"width": 1920, "height": 1080})

        print("Step 3: Student courses nav + filters")
        await page.goto(f"{base}/courses", wait_until="domcontentloaded")
        await choose_student_if_prompted()
        await page.wait_for_selector('[data-testid="student-courses-page"]', timeout=12000)
        await page.wait_for_selector('[data-testid="student-link-all-courses"]', timeout=5000)
        await page.wait_for_selector('[data-testid="student-link-ai-agents"]', timeout=5000)
        nav_text = await page.locator('[data-testid="student-navigation"]').inner_text()
        assert "Programme" not in nav_text and "Programmer" not in nav_text

        card_count = await page.locator('[data-testid^="course-card-"]').count()
        assert card_count >= 6
        print(f"PASS: Student cards >= 6 ({card_count})")

        await page.fill('[data-testid="courses-search"]', 'zzzznoresult')
        await page.wait_for_selector('[data-testid="courses-empty"]', timeout=6000)
        await page.click('[data-testid="courses-clear-filters"]', force=True)
        await page.wait_for_timeout(400)
        print("PASS: Student empty/reset works")

        print("Step 4: Student card detail links")
        cta_links = page.locator('[data-testid^="course-card-cta-"]')
        cta_count = await cta_links.count()
        verified = 0
        for i in range(min(cta_count, 6)):
            href = await cta_links.nth(i).get_attribute('href')
            if not href:
                continue
            await page.goto(f"{base}{href}", wait_until="domcontentloaded")
            has_live = await page.locator('[data-testid="detail-hero"]').count()
            has_upcoming = await page.locator('[data-testid="upcoming-course-page"]').count()
            assert has_live or has_upcoming
            verified += 1
        print(f"PASS: Verified {verified} student detail routes")

        print("Step 5: Live and coming-soon student detail assertions")
        await page.goto(f"{base}/course/{live_id}", wait_until="domcontentloaded")
        await choose_student_if_prompted()
        await page.wait_for_selector('[data-testid="detail-breadcrumb"]', timeout=12000)
        assert (await page.locator('[data-testid="detail-customize-enroll"]').count()) + (await page.locator('[data-testid="detail-go-dashboard"]').count()) >= 1

        await page.goto(f"{base}/course/{soon_id}", wait_until="domcontentloaded")
        await choose_student_if_prompted()
        await page.wait_for_selector('[data-testid="upcoming-course-page"]', timeout=12000)
        assert await page.locator('[data-testid="detail-customize-enroll"]').count() == 0
        assert await page.locator('text=₹4,999').count() == 0
        assert await page.locator('[data-testid="detail-before-salary"]').count() == 0
        print("PASS: Student detail behavior correct for live + coming soon")

        print("Step 6: Audience switch context preservation")
        await page.goto(f"{base}/course/{live_id}", wait_until="domcontentloaded")
        await choose_student_if_prompted()
        await page.wait_for_selector('[data-testid="student-switch-enterprise"]', timeout=8000)
        await page.click('[data-testid="student-switch-enterprise"]', force=True)
        await page.wait_for_url(f"**/enterprise/course/{live_id}", timeout=10000)

        await page.goto(f"{base}/ai-agents", wait_until="domcontentloaded")
        await choose_student_if_prompted()
        await page.wait_for_selector('[data-testid="student-switch-enterprise"]', timeout=8000)
        await page.click('[data-testid="student-switch-enterprise"]', force=True)
        await page.wait_for_url('**/enterprise/ai-agents', timeout=10000)

        await page.goto(f"{base}/courses", wait_until="domcontentloaded")
        await choose_student_if_prompted()
        await page.wait_for_selector('[data-testid="student-switch-enterprise"]', timeout=8000)
        await page.click('[data-testid="student-switch-enterprise"]', force=True)
        await page.wait_for_url('**/enterprise/courses', timeout=10000)
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_url('**/enterprise/courses', timeout=10000)
        print("PASS: Audience switch preserved for /course, /ai-agents, /courses")

        print("Step 7: Fresh visitor gateway chooses enterprise on student course")
        await page.context.clear_cookies()
        await page.goto(base, wait_until="domcontentloaded")
        await page.evaluate("localStorage.clear()")
        await page.goto(f"{base}/course/{live_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="audience-gateway"]', timeout=12000)
        await page.click('[data-testid="choose-enterprise"]', force=True)
        await page.wait_for_url(f"**/enterprise/course/{live_id}", timeout=10000)
        print("PASS: Gateway maps to enterprise detail")

        print("Step 8: Enterprise courses + filters")
        await page.goto(f"{base}/enterprise/courses", wait_until="domcontentloaded")
        await choose_enterprise_if_prompted()
        await page.wait_for_selector('[data-testid="enterprise-courses-page"]', timeout=12000)
        await page.wait_for_selector('[data-testid="business-link-all-courses"]', timeout=5000)
        await page.wait_for_selector('[data-testid="business-link-ai-agents"]', timeout=5000)
        nav_text_e = await page.locator('[data-testid="business-navigation"]').inner_text()
        assert "Programme" not in nav_text_e and "Programmer" not in nav_text_e
        assert await page.locator('[data-testid^="course-card-"]').count() >= 6

        await page.fill('[data-testid="courses-search"]', 'zzzznoresult')
        await page.wait_for_selector('[data-testid="courses-empty"]', timeout=6000)
        await page.click('[data-testid="courses-clear-filters"]', force=True)
        await page.wait_for_timeout(400)
        print("PASS: Enterprise filters work")

        print("Step 9: Enterprise detail content checks")
        await page.goto(f"{base}/enterprise/course/{live_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-course-title"]', timeout=12000)
        assert await page.locator('[data-testid="enterprise-course-outcomes"]').count() == 1
        assert await page.locator('[data-testid="enterprise-course-rollout"]').count() == 1
        assert await page.locator('[data-testid="enterprise-course-curriculum"]').count() == 1
        assert await page.locator('text=Up to ₹12 LPA').count() == 0
        assert await page.locator('[data-testid="detail-customize-enroll"]').count() == 0

        await page.goto(f"{base}/enterprise/course/{soon_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-course-coming-soon"]', timeout=12000)
        assert await page.locator('[data-testid="enterprise-total"]').count() == 0

        await page.goto(f"{base}/enterprise/course/unknown-id-404", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-course-not-found"]', timeout=12000)
        print("PASS: Enterprise detail checks passed")

        print("Step 10: Enquiry context + TEST-ONLY interception")
        captured = {"raw": ""}
        async def intercept_enquiry(route):
            captured["raw"] = route.request.post_data or ""
            await route.fulfill(status=200, content_type='application/json', body='{"reference":"TEST-ONLY-REF","notification":"accepted"}')

        await page.route('**/api/enterprise/enquiries', intercept_enquiry)
        await page.goto(f"{base}/enterprise/course/{live_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-enquiry-form"]', timeout=12000)
        is_valid_initial = await page.eval_on_selector('[data-testid="enterprise-enquiry-form"]', 'f => f.reportValidity()')
        print(f"Native validation initial valid={is_valid_initial}")

        context_text = await page.locator('[data-testid="enquiry-course-context"]').inner_text()
        maxlength = await page.get_attribute('[data-testid="enquiry-requirements"]', 'maxlength')
        print(f"enquiry context: {context_text}")
        print(f"requirements maxlength: {maxlength}")

        await page.fill('[data-testid="enquiry-name"]', 'QA Agent')
        await page.fill('[data-testid="enquiry-email"]', 'qa.agent@example.com')
        await page.fill('[data-testid="enquiry-company"]', 'QA Company')
        await page.fill('[data-testid="enquiry-requirements"]', 'Need role-based rollout with human review and quality checks.')
        await page.check('[data-testid="enquiry-consent"]')
        await page.click('[data-testid="enquiry-submit"]', force=True)
        await page.wait_for_selector('[data-testid="enquiry-success"]', timeout=10000)
        assert 'Course:' in captured['raw']
        print(f"Captured body snippet: {captured['raw'][:250]}")
        await page.unroute('**/api/enterprise/enquiries', intercept_enquiry)
        print("PASS: Enquiry context included; no real lead created")

        print("Step 11: AI Agents student/enterprise behavior")
        await page.goto(f"{base}/ai-agents", wait_until="domcontentloaded")
        await choose_student_if_prompted()
        await page.wait_for_selector('[data-testid="student-ai-agents-page"]', timeout=12000)
        href = await page.get_attribute('[data-testid="student-agents-enterprise-link"]', 'href')
        print(f"Student proposal href: {href}")

        await page.goto(f"{base}/enterprise/ai-agents", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-ai-agents-page"]', timeout=12000)
        t0 = await page.locator('[data-testid="selected-agent-title"]').inner_text()
        await page.click('[data-testid="agent-product-1"]', force=True)
        await page.wait_for_timeout(250)
        t1 = await page.locator('[data-testid="selected-agent-title"]').inner_text()
        await page.click('[data-testid="agent-product-2"]', force=True)
        await page.wait_for_timeout(250)
        t2 = await page.locator('[data-testid="selected-agent-title"]').inner_text()
        assert t0 != t1 and t1 != t2
        await page.click('[data-testid="agents-switch-to-course"]', force=True)
        await page.wait_for_url('**/enterprise/courses', timeout=10000)
        print("PASS: AI agents selectors and links behave correctly")

        print("Step 12: 3D nonblank + control interactions")
        await page.goto(f"{base}/enterprise/ai-agents", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        canvas_count = await page.locator('[data-testid="agent-workbench-3d"] canvas').count()
        fallback_count = await page.locator('[data-testid="agent-workbench-3d-fallback"]').count()
        print(f"canvas_count={canvas_count} fallback_count={fallback_count}")

        f1 = await page.evaluate("""() => {
          const c = document.querySelector('[data-testid="agent-workbench-3d"] canvas');
          return c ? c.toDataURL().slice(0, 100) : null;
        }""")
        await page.wait_for_timeout(700)
        f2 = await page.evaluate("""() => {
          const c = document.querySelector('[data-testid="agent-workbench-3d"] canvas');
          return c ? c.toDataURL().slice(0, 100) : null;
        }""")
        print(f"frame_changed={f1 != f2}")

        await page.click('[data-testid="agent-workbench-3d-pause"]', force=True)
        await page.click('[data-testid="agent-workbench-3d-reset"]', force=True)
        await page.click('[data-testid="agent-workbench-3d-focus-0"]', force=True)
        print("PASS: 3D controls clickable")

        print("Step 13: Student theme toggle")
        await page.goto(f"{base}/courses", wait_until="domcontentloaded")
        await choose_student_if_prompted()
        await page.wait_for_selector('[data-testid="student-theme-toggle"]', timeout=8000)
        await page.click('[data-testid="student-theme-toggle"]', force=True)
        await page.wait_for_timeout(200)
        await page.click('[data-testid="student-theme-toggle"]', force=True)
        print("PASS: Theme toggle clickable")

        print("Step 14: Error/retry via transient failures")
        fail_once = {"catalog": True, "curriculum": True}

        async def fail_catalog(route):
            if fail_once["catalog"]:
                fail_once["catalog"] = False
                await route.fulfill(status=503, content_type='application/json', body='{"detail":"TEST transient"}')
            else:
                await route.continue_()

        async def fail_curriculum(route):
            if fail_once["curriculum"]:
                fail_once["curriculum"] = False
                await route.fulfill(status=500, content_type='application/json', body='{"message":"TEST transient"}')
            else:
                await route.continue_()

        await page.route('**/api/courses/catalog', fail_catalog)
        await page.goto(f"{base}/courses", wait_until="domcontentloaded")
        await choose_student_if_prompted()
        await page.wait_for_selector('[data-testid="courses-error"]', timeout=12000)
        await page.click('[data-testid="courses-retry-button"]', force=True)
        await page.wait_for_selector('[data-testid="courses-grid"]', timeout=12000)
        await page.unroute('**/api/courses/catalog', fail_catalog)
        print("PASS: Catalog retry works")

        await page.route('**/rest/v1/master_modules*', fail_curriculum)
        await page.goto(f"{base}/enterprise/course/{live_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-curriculum-error"]', timeout=14000)
        await page.click('[data-testid="enterprise-curriculum-retry"]', force=True)
        await page.wait_for_selector('[data-testid="enterprise-curriculum-modules"]', timeout=14000)
        await page.unroute('**/rest/v1/master_modules*', fail_curriculum)
        print("PASS: Curriculum retry works")

        print("Step 15: Responsive overflow matrix")
        for w in [320, 390, 768, 1024, 1440, 1920]:
            h = 844 if w <= 390 else 1080
            await page.set_viewport_size({"width": w, "height": h})

            await page.goto(f"{base}/courses", wait_until="domcontentloaded")
            await choose_student_if_prompted()
            await page.wait_for_selector('[data-testid="courses-grid"]', timeout=12000)
            await check_overflow(f"student-{w}")

            await page.goto(f"{base}/enterprise/courses", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="enterprise-courses-page"]', timeout=12000)
            await check_overflow(f"enterprise-{w}")

        await page.set_viewport_size({"width": 1920, "height": 1080})
        await page.goto(f"{base}/enterprise/programme", wait_until="domcontentloaded")
        print(f"PASS: /enterprise/programme reachable at {page.url}")

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

        helmet_logs = [l for l in console_errors if 'helmet' in l.lower()]
        print(f"Helmet-related console entries: {len(helmet_logs)}")
        print("Frontend rerun completed")
    except Exception as e:
        print(f"Frontend rerun failed: {str(e)}")

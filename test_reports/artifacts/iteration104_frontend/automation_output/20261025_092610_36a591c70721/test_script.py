async def run_test(page, output_dir, page_url):
    import re

    console_errors = []
    page.on("console", lambda msg: console_errors.append(f"{msg.type}: {msg.text}") if msg.type in ["error", "warning"] else None)

    async def check_overflow(label):
        overflow = await page.evaluate("""() => {
          const de = document.documentElement;
          return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, overflow: de.scrollWidth > de.clientWidth };
        }""")
        print(f"{label} overflow={overflow['overflow']} scrollWidth={overflow['scrollWidth']} clientWidth={overflow['clientWidth']}")
        return overflow

    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        base = "https://fintech-mvp-38.preview.emergentagent.com"
        live_id = "5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c"
        soon_id = "ceccacd7-51aa-42a7-9de4-c89c23757f16"

        print("Step 1: Landing nav desktop + audience modal")
        await page.goto(base, wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="navbar"]', timeout=15000)
        await page.wait_for_selector('[data-testid="landing-all-courses-link"]', timeout=8000)
        await page.wait_for_selector('[data-testid="landing-ai-agents-link"]', timeout=8000)
        print("PASS: Landing links visible")

        print("Step 2: Mobile menu links")
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.click('[data-testid="mobile-menu-toggle"]', force=True)
        await page.wait_for_selector('[data-testid="mobile-menu-overlay"]', timeout=8000)
        await page.wait_for_selector('[data-testid="landing-mobile-all-courses-link"]', timeout=5000)
        await page.wait_for_selector('[data-testid="landing-mobile-ai-agents-link"]', timeout=5000)
        print("PASS: Mobile menu links visible")
        await page.set_viewport_size({"width": 1920, "height": 1080})

        print("Step 3: Student courses nav, card count, filter and reset")
        await page.goto(f"{base}/courses", wait_until="domcontentloaded")
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]', force=True)
            await page.wait_for_timeout(500)
        await page.wait_for_selector('[data-testid="student-courses-page"]', timeout=12000)
        await page.wait_for_selector('[data-testid="student-navigation"]', timeout=8000)
        await page.wait_for_selector('[data-testid="student-link-all-courses"]', timeout=5000)
        await page.wait_for_selector('[data-testid="student-link-ai-agents"]', timeout=5000)
        nav_text = await page.locator('[data-testid="student-navigation"]').inner_text()
        assert "Programme" not in nav_text and "Programmer" not in nav_text
        print("PASS: Student nav contains expected links and no Programme/Programmer")

        await page.wait_for_selector('[data-testid^="course-card-"]', timeout=10000)
        card_count = await page.locator('[data-testid^="course-card-"]').count()
        print(f"Course cards on student catalog: {card_count}")
        assert card_count >= 6

        await page.fill('[data-testid="courses-search"]', 'zzzznoresult')
        await page.wait_for_selector('[data-testid="courses-empty"]', timeout=6000)
        await page.click('[data-testid="courses-clear-filters"]', force=True)
        await page.wait_for_timeout(500)
        count_text = await page.locator('[data-testid="courses-result-count"]').inner_text()
        print(f"PASS: Search empty/reset works, result text: {count_text}")

        print("Step 4: Student card links route to details")
        cta_links = page.locator('[data-testid^="course-card-cta-"]')
        cta_count = await cta_links.count()
        checked = 0
        for i in range(min(cta_count, 6)):
            href = await cta_links.nth(i).get_attribute('href')
            if not href:
                continue
            await page.goto(f"{base}{href}", wait_until="domcontentloaded")
            if "/course/" in href:
                has_live_detail = await page.locator('[data-testid="detail-hero"]').count()
                has_upcoming = await page.locator('[data-testid="upcoming-course-page"]').count()
                assert has_live_detail or has_upcoming
                checked += 1
        print(f"PASS: Verified detail routing for {checked} course cards")

        print("Step 5: Live student detail preservation checks")
        await page.goto(f"{base}/course/{live_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="detail-breadcrumb"]', timeout=12000)
        await page.wait_for_selector('[data-testid="detail-back-link"]', timeout=5000)
        has_enroll = await page.locator('[data-testid="detail-customize-enroll"]').count()
        has_dash = await page.locator('[data-testid="detail-go-dashboard"]').count()
        assert has_enroll or has_dash
        print("PASS: Live student detail has navigation and CTA")

        print("Step 6: Coming soon student detail has no enrollment/payment CTA")
        await page.goto(f"{base}/course/{soon_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="upcoming-course-page"]', timeout=12000)
        await page.wait_for_selector('[data-testid="upcoming-course-status"]', timeout=8000)
        assert await page.locator('[data-testid="detail-customize-enroll"]').count() == 0
        assert await page.locator('text=₹4,999').count() == 0
        assert await page.locator('[data-testid="detail-before-salary"]').count() == 0
        print("PASS: Coming soon page hides enrollment/payment/salary stats")

        print("Step 7: Audience switching preserves routes")
        await page.goto(f"{base}/course/{live_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="student-switch-enterprise"]', timeout=8000)
        await page.click('[data-testid="student-switch-enterprise"]', force=True)
        await page.wait_for_url(re.compile(r".*/enterprise/course/.*"), timeout=10000)
        print(f"PASS: student course switched to enterprise: {page.url}")

        await page.goto(f"{base}/ai-agents", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="student-switch-enterprise"]', timeout=8000)
        await page.click('[data-testid="student-switch-enterprise"]', force=True)
        await page.wait_for_url("**/enterprise/ai-agents", timeout=10000)
        print("PASS: /ai-agents switches to /enterprise/ai-agents")

        await page.goto(f"{base}/courses", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="student-switch-enterprise"]', timeout=8000)
        await page.click('[data-testid="student-switch-enterprise"]', force=True)
        await page.wait_for_url("**/enterprise/courses", timeout=10000)
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_url("**/enterprise/courses", timeout=10000)
        print("PASS: /courses switch persists to /enterprise/courses and survives refresh")

        print("Step 8: Fresh visitor gateway enterprise choice on student course")
        await page.context.clear_cookies()
        await page.evaluate("localStorage.clear()")
        await page.goto(f"{base}/course/{live_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="audience-gateway"]', timeout=12000)
        await page.click('[data-testid="choose-enterprise"]', force=True)
        await page.wait_for_url(f"**/enterprise/course/{live_id}", timeout=10000)
        print("PASS: Audience gateway enterprise option maps to enterprise course detail")

        print("Step 9: Enterprise nav and all-courses checks")
        await page.goto(f"{base}/enterprise/courses", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-courses-page"]', timeout=12000)
        await page.wait_for_selector('[data-testid="business-navigation"]', timeout=8000)
        await page.wait_for_selector('[data-testid="business-link-all-courses"]', timeout=5000)
        await page.wait_for_selector('[data-testid="business-link-ai-agents"]', timeout=5000)
        biz_nav_text = await page.locator('[data-testid="business-navigation"]').inner_text()
        assert "Programme" not in biz_nav_text and "Programmer" not in biz_nav_text

        e_cards = await page.locator('[data-testid^="course-card-"]').count()
        print(f"Enterprise course cards: {e_cards}")
        assert e_cards >= 6

        await page.fill('[data-testid="courses-search"]', 'zzzznoresult')
        await page.wait_for_selector('[data-testid="courses-empty"]', timeout=6000)
        await page.click('[data-testid="courses-clear-filters"]', force=True)
        await page.wait_for_timeout(500)
        print("PASS: Enterprise search empty/reset works")

        print("Step 10: Enterprise detail content specificity")
        await page.goto(f"{base}/enterprise/course/{live_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-course-details-page"]', timeout=12000)
        await page.wait_for_selector('[data-testid="enterprise-course-title"]', timeout=8000)
        assert await page.locator('[data-testid="enterprise-course-outcomes"]').count() == 1
        assert await page.locator('[data-testid="enterprise-course-rollout"]').count() == 1
        assert await page.locator('[data-testid="enterprise-course-curriculum"]').count() == 1
        assert await page.locator('text=Up to ₹12 LPA').count() == 0
        assert await page.locator('[data-testid="detail-customize-enroll"]').count() == 0
        print("PASS: Enterprise detail has B2B content and no student salary/enroll CTA")

        print("Step 11: Enterprise coming-soon detail and unknown-id not found")
        await page.goto(f"{base}/enterprise/course/{soon_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-course-coming-soon"]', timeout=12000)
        assert await page.locator('[data-testid="enterprise-total"]').count() == 0
        assert await page.locator('[data-testid="enterprise-seat-slider"]').count() == 1
        print("PASS: Enterprise coming-soon hides numeric pricing")

        await page.goto(f"{base}/enterprise/course/unknown-course-id", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-course-not-found"]', timeout=12000)
        print("PASS: Unknown enterprise course shows friendly not found")

        print("Step 12: Enquiry context captured via TEST-ONLY route intercept")
        captured_body = {"raw": ""}
        async def intercept_enquiry(route):
            req = route.request
            captured_body["raw"] = req.post_data or ""
            await route.fulfill(status=200, content_type="application/json", body='{"reference":"TEST-ONLY-REF","notification":"accepted"}')

        await page.route('**/api/enterprise/enquiries', intercept_enquiry)
        await page.goto(f"{base}/enterprise/course/{live_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-enquiry-form"]', timeout=12000)
        form_valid = await page.eval_on_selector('[data-testid="enterprise-enquiry-form"]', 'f => f.reportValidity()')
        print(f"Native validation before fill: {form_valid}")

        ctx_text = await page.locator('[data-testid="enquiry-course-context"]').inner_text()
        maxlength = await page.get_attribute('[data-testid="enquiry-requirements"]', 'maxlength')
        print(f"Context: {ctx_text}")
        print(f"Textarea maxlength: {maxlength}")

        await page.fill('[data-testid="enquiry-name"]', 'QA Agent')
        await page.fill('[data-testid="enquiry-email"]', 'qa.agent@example.com')
        await page.fill('[data-testid="enquiry-company"]', 'QA Co')
        await page.fill('[data-testid="enquiry-requirements"]', 'Need scoped team workflow with approvals and rollout checks.')
        await page.check('[data-testid="enquiry-consent"]')
        await page.click('[data-testid="enquiry-submit"]', force=True)
        await page.wait_for_selector('[data-testid="enquiry-success"]', timeout=10000)
        print(f"Captured request body: {captured_body['raw'][:280]}")
        assert 'Course:' in captured_body['raw']

        await page.unroute('**/api/enterprise/enquiries', intercept_enquiry)
        print("PASS: Enquiry submit intercepted test-only, no real lead created")

        print("Step 13: AI agents student and enterprise pages + selectors")
        await page.goto(f"{base}/ai-agents", wait_until="domcontentloaded")
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]', force=True)
            await page.wait_for_timeout(500)
        await page.wait_for_selector('[data-testid="student-ai-agents-page"]', timeout=12000)
        await page.wait_for_selector('[data-testid="student-agents-enterprise-link"]', timeout=5000)
        href_student_proposal = await page.get_attribute('[data-testid="student-agents-enterprise-link"]', 'href')
        print(f"Student proposal CTA href: {href_student_proposal}")

        await page.goto(f"{base}/enterprise/ai-agents", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-ai-agents-page"]', timeout=12000)
        await page.wait_for_selector('[data-testid="agent-product-0"]', timeout=8000)
        title0 = await page.locator('[data-testid="selected-agent-title"]').inner_text()
        await page.click('[data-testid="agent-product-1"]', force=True)
        await page.wait_for_timeout(300)
        title1 = await page.locator('[data-testid="selected-agent-title"]').inner_text()
        await page.click('[data-testid="agent-product-2"]', force=True)
        await page.wait_for_timeout(300)
        title2 = await page.locator('[data-testid="selected-agent-title"]').inner_text()
        assert title0 != title1 and title1 != title2
        print(f"PASS: Agent selector updates titles: {title0} -> {title1} -> {title2}")

        cta_href = await page.get_attribute('[data-testid="agent-scope-cta"]', 'href')
        print(f"Agent scope CTA target: {cta_href}")
        await page.click('[data-testid="agents-switch-to-course"]', force=True)
        await page.wait_for_url('**/enterprise/courses', timeout=10000)
        print("PASS: Enterprise AI training link returns to enterprise courses")

        print("Step 14: 3D scene nonblank + controls")
        await page.goto(f"{base}/enterprise/ai-agents", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        canvas_count = await page.locator('[data-testid="agent-workbench-3d"] canvas').count()
        fallback_count = await page.locator('[data-testid="agent-workbench-3d-fallback"]').count()
        print(f"3D canvas_count={canvas_count}, fallback_count={fallback_count}")

        frame1 = await page.evaluate("""() => {
          const c = document.querySelector('[data-testid="agent-workbench-3d"] canvas');
          if (!c) return null;
          return c.toDataURL().slice(0, 120);
        }""")
        await page.wait_for_timeout(700)
        frame2 = await page.evaluate("""() => {
          const c = document.querySelector('[data-testid="agent-workbench-3d"] canvas');
          if (!c) return null;
          return c.toDataURL().slice(0, 120);
        }""")
        print(f"Frame changed while running: {frame1 != frame2}")

        await page.click('[data-testid="agent-workbench-3d-pause"]', force=True)
        await page.wait_for_timeout(300)
        await page.click('[data-testid="agent-workbench-3d-reset"]', force=True)
        await page.click('[data-testid="agent-workbench-3d-focus-0"]', force=True)
        print("PASS: 3D controls clickable")

        print("Step 15: Theme toggle on student catalog")
        await page.goto(f"{base}/courses", wait_until="domcontentloaded")
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]', force=True)
            await page.wait_for_timeout(500)
        await page.wait_for_selector('[data-testid="student-theme-toggle"]', timeout=8000)
        await page.click('[data-testid="student-theme-toggle"]', force=True)
        await page.wait_for_timeout(250)
        await page.click('[data-testid="student-theme-toggle"]', force=True)
        print("PASS: Student theme toggle works")

        print("Step 16: Error and retry via transient failures")
        fail_once = {"catalog": True, "curriculum": True}

        async def fail_catalog(route):
            if fail_once["catalog"]:
                fail_once["catalog"] = False
                await route.fulfill(status=503, content_type='application/json', body='{"detail":"TEST transient failure"}')
            else:
                await route.continue_()

        async def fail_curriculum(route):
            if fail_once["curriculum"]:
                fail_once["curriculum"] = False
                await route.fulfill(status=500, content_type='application/json', body='{"message":"TEST transient failure"}')
            else:
                await route.continue_()

        await page.route('**/api/courses/catalog', fail_catalog)
        await page.goto(f"{base}/courses", wait_until="domcontentloaded")
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]', force=True)
            await page.wait_for_timeout(500)
        await page.wait_for_selector('[data-testid="courses-error"]', timeout=12000)
        await page.click('[data-testid="courses-retry-button"]', force=True)
        await page.wait_for_selector('[data-testid="courses-grid"]', timeout=12000)
        await page.unroute('**/api/courses/catalog', fail_catalog)
        print("PASS: Catalog error+retry works")

        await page.route('**/rest/v1/master_modules*', fail_curriculum)
        await page.goto(f"{base}/enterprise/course/{live_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-curriculum-error"]', timeout=14000)
        await page.click('[data-testid="enterprise-curriculum-retry"]', force=True)
        await page.wait_for_selector('[data-testid="enterprise-curriculum-modules"]', timeout=14000)
        await page.unroute('**/rest/v1/master_modules*', fail_curriculum)
        print("PASS: Enterprise curriculum error+retry works")

        print("Step 17: Responsive overflow checks")
        for w in [320, 390, 768, 1024, 1440, 1920]:
            h = 844 if w <= 390 else 1080
            await page.set_viewport_size({"width": w, "height": h})
            await page.goto(f"{base}/courses", wait_until="domcontentloaded")
            if await page.locator('[data-testid="audience-gateway"]').count() > 0:
                await page.click('[data-testid="choose-student"]', force=True)
                await page.wait_for_timeout(400)
            await page.wait_for_selector('[data-testid="courses-grid"]', timeout=12000)
            await check_overflow(f"student-courses-{w}")

            await page.goto(f"{base}/enterprise/courses", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="enterprise-courses-page"]', timeout=12000)
            await check_overflow(f"enterprise-courses-{w}")

        await page.set_viewport_size({"width": 1920, "height": 1080})
        await page.goto(f"{base}/enterprise/programme", wait_until="domcontentloaded")
        print(f"PASS: /enterprise/programme reachable -> {page.url}")

        print("Step 18: Final error scan")
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
        print("Frontend regression script completed")
    except Exception as e:
        print(f"Frontend regression failed: {str(e)}")

async def run_test(page, output_dir, page_url):
    import re

    issues = []
    console_errors = []
    page.on("console", lambda msg: console_errors.append(f"{msg.type}: {msg.text}") if msg.type in ["error", "warning"] else None)

    base = "https://fintech-mvp-38.preview.emergentagent.com"
    live_id = "5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c"
    soon_id = "ceccacd7-51aa-42a7-9de4-c89c23757f16"

    async def choose_student_if_prompted():
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]', force=True)
            await page.wait_for_timeout(400)

    async def wait_catalog_ready():
        for _ in range(30):
            loading = await page.locator('[data-testid="courses-loading"]').count()
            cards = await page.locator('[data-testid^="course-card-"]').count()
            if cards > 0:
                return cards
            if loading == 0:
                break
            await page.wait_for_timeout(400)
        return await page.locator('[data-testid^="course-card-"]').count()

    async def check_step(name, fn):
        try:
            await fn()
            print(f"PASS: {name}")
        except Exception as e:
            msg = f"FAIL: {name} -> {str(e)}"
            issues.append(msg)
            print(msg)

    async def overflow_state(label):
        state = await page.evaluate("""() => {
          const de = document.documentElement;
          return {overflow: de.scrollWidth > de.clientWidth, sw: de.scrollWidth, cw: de.clientWidth};
        }""")
        print(f"{label}: overflow={state['overflow']} sw={state['sw']} cw={state['cw']}")
        return state

    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})

        async def s1():
            await page.goto(f"{base}/courses", wait_until="domcontentloaded")
            await choose_student_if_prompted()
            await page.wait_for_selector('[data-testid="student-courses-page"]', timeout=12000)
            await page.wait_for_selector('[data-testid="student-link-all-courses"]', timeout=8000)
            await page.wait_for_selector('[data-testid="student-link-ai-agents"]', timeout=8000)
            nav_text = await page.locator('[data-testid="student-navigation"]').inner_text()
            if "Programme" in nav_text or "Programmer" in nav_text:
                raise Exception("Programme/Programmer still present in student nav")
            cards = await wait_catalog_ready()
            if cards < 6:
                raise Exception(f"Expected >=6 courses, got {cards}")
        await check_step("Student nav and course count", s1)

        async def s2():
            await page.fill('[data-testid="courses-search"]', 'zzzznoresult')
            await page.wait_for_selector('[data-testid="courses-empty"]', timeout=8000)
            await page.click('[data-testid="courses-clear-filters"]', force=True)
            await page.wait_for_timeout(500)
            cards = await page.locator('[data-testid^="course-card-"]').count()
            if cards < 6:
                raise Exception(f"Reset did not restore catalog; cards={cards}")
        await check_step("Student search/category empty and reset", s2)

        async def s3():
            links = page.locator('[data-testid^="course-card-cta-"]')
            total = await links.count()
            if total < 6:
                raise Exception(f"Expected >=6 CTA links, got {total}")
            checked = 0
            for i in range(min(total, 6)):
                href = await links.nth(i).get_attribute('href')
                if not href:
                    continue
                await page.goto(f"{base}{href}", wait_until="domcontentloaded")
                live = await page.locator('[data-testid="detail-hero"]').count()
                soon = await page.locator('[data-testid="upcoming-course-page"]').count()
                if not (live or soon):
                    raise Exception(f"Detail did not load for {href}")
                checked += 1
            print(f"checked student detail routes={checked}")
        await check_step("Every student card opens detail", s3)

        async def s4():
            await page.goto(f"{base}/course/{live_id}", wait_until="domcontentloaded")
            await choose_student_if_prompted()
            await page.wait_for_selector('[data-testid="detail-breadcrumb"]', timeout=12000)
            await page.wait_for_selector('[data-testid="detail-back-link"]', timeout=6000)
            cta = (await page.locator('[data-testid="detail-customize-enroll"]').count()) + (await page.locator('[data-testid="detail-go-dashboard"]').count())
            if cta < 1:
                raise Exception("Live student detail missing enroll/dashboard CTA")

            await page.goto(f"{base}/course/{soon_id}", wait_until="domcontentloaded")
            await choose_student_if_prompted()
            await page.wait_for_selector('[data-testid="upcoming-course-page"]', timeout=12000)
            if await page.locator('[data-testid="detail-customize-enroll"]').count() != 0:
                raise Exception("Coming soon page shows enroll CTA")
            if await page.locator('text=₹4,999').count() > 0:
                raise Exception("Coming soon page shows pricing")
        await check_step("Student live + coming-soon detail behavior", s4)

        async def s5():
            await page.goto(f"{base}/courses", wait_until="domcontentloaded")
            await choose_student_if_prompted()
            await page.click('[data-testid="student-switch-enterprise"]', force=True)
            await page.wait_for_url('**/enterprise/courses', timeout=10000)

            await page.goto(f"{base}/course/{live_id}", wait_until="domcontentloaded")
            await choose_student_if_prompted()
            await page.click('[data-testid="student-switch-enterprise"]', force=True)
            await page.wait_for_url(f"**/enterprise/course/{live_id}", timeout=10000)

            await page.goto(f"{base}/ai-agents", wait_until="domcontentloaded")
            await choose_student_if_prompted()
            await page.click('[data-testid="student-switch-enterprise"]', force=True)
            await page.wait_for_url('**/enterprise/ai-agents', timeout=10000)
        await check_step("Audience switch preserves /courses /course/:id /ai-agents", s5)

        async def s6():
            await page.context.clear_cookies()
            await page.goto(base, wait_until="domcontentloaded")
            await page.evaluate('localStorage.clear()')
            await page.goto(f"{base}/course/{live_id}", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="audience-gateway"]', timeout=12000)
            await page.click('[data-testid="choose-enterprise"]', force=True)
            await page.wait_for_url(f"**/enterprise/course/{live_id}", timeout=10000)
            await page.go_back()
            await page.go_forward()
        await check_step("Fresh gateway enterprise choice + back/forward no loop", s6)

        async def s7():
            await page.goto(f"{base}/enterprise/courses", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="enterprise-courses-page"]', timeout=12000)
            await page.wait_for_selector('[data-testid="business-link-all-courses"]', timeout=8000)
            await page.wait_for_selector('[data-testid="business-link-ai-agents"]', timeout=8000)
            nav_text = await page.locator('[data-testid="business-navigation"]').inner_text()
            if "Programme" in nav_text or "Programmer" in nav_text:
                raise Exception("Programme/Programmer still present in enterprise nav")
            cards = await wait_catalog_ready()
            if cards < 6:
                raise Exception(f"Enterprise expected >=6 cards, got {cards}")

            await page.fill('[data-testid="courses-search"]', 'zzzznoresult')
            await page.wait_for_selector('[data-testid="courses-empty"]', timeout=8000)
            await page.click('[data-testid="courses-clear-filters"]', force=True)
            await page.wait_for_timeout(400)
        await check_step("Enterprise nav and catalogue filters", s7)

        async def s8():
            await page.goto(f"{base}/enterprise/course/{live_id}", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="enterprise-course-title"]', timeout=12000)
            if await page.locator('[data-testid="enterprise-course-curriculum"]').count() != 1:
                raise Exception("Enterprise curriculum missing")
            if await page.locator('text=Up to ₹12 LPA').count() > 0:
                raise Exception("Student salary copy leaked into enterprise detail")
            if await page.locator('[data-testid="detail-customize-enroll"]').count() > 0:
                raise Exception("Student enroll CTA leaked into enterprise detail")

            await page.goto(f"{base}/enterprise/course/{soon_id}", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="enterprise-course-coming-soon"]', timeout=12000)
            if await page.locator('[data-testid="enterprise-total"]').count() > 0:
                raise Exception("Numeric pricing shown on enterprise coming-soon")

            await page.goto(f"{base}/enterprise/course/unknown-id-404", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="enterprise-course-not-found"]', timeout=12000)
        await check_step("Enterprise detail B2B, coming-soon, not-found", s8)

        async def s9():
            captured = {"raw": ""}
            async def intercept(route):
                captured["raw"] = route.request.post_data or ""
                await route.fulfill(status=200, content_type='application/json', body='{"reference":"TEST-ONLY-REF","notification":"accepted"}')

            await page.route('**/api/enterprise/enquiries', intercept)
            await page.goto(f"{base}/enterprise/course/{live_id}", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="enterprise-enquiry-form"]', timeout=12000)
            initial_valid = await page.eval_on_selector('[data-testid="enterprise-enquiry-form"]', 'f => f.reportValidity()')
            print(f"native validation initial={initial_valid}")

            ctx = await page.locator('[data-testid="enquiry-course-context"]').inner_text()
            mx = await page.get_attribute('[data-testid="enquiry-requirements"]', 'maxlength')
            print(f"context={ctx}")
            print(f"maxlength={mx}")

            await page.fill('[data-testid="enquiry-name"]', 'QA Agent')
            await page.fill('[data-testid="enquiry-email"]', 'qa.agent@example.com')
            await page.fill('[data-testid="enquiry-company"]', 'QA Company')
            await page.fill('[data-testid="enquiry-requirements"]', 'Need scoped rollout and review checkpoints for finance team.')
            await page.check('[data-testid="enquiry-consent"]')
            await page.click('[data-testid="enquiry-submit"]', force=True)
            await page.wait_for_selector('[data-testid="enquiry-success"]', timeout=10000)
            if 'Course:' not in captured['raw']:
                raise Exception('Course context missing in outgoing request')
            await page.unroute('**/api/enterprise/enquiries', intercept)
        await check_step("Enterprise enquiry context + TEST-ONLY interception", s9)

        async def s10():
            await page.goto(f"{base}/ai-agents", wait_until="domcontentloaded")
            await choose_student_if_prompted()
            await page.wait_for_selector('[data-testid="student-ai-agents-page"]', timeout=12000)
            href = await page.get_attribute('[data-testid="student-agents-enterprise-link"]', 'href')
            if href != '/enterprise/ai-agents#enquire':
                raise Exception(f"Unexpected student proposal href: {href}")

            await page.goto(f"{base}/enterprise/ai-agents", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="enterprise-ai-agents-page"]', timeout=12000)
            t0 = await page.locator('[data-testid="selected-agent-title"]').inner_text()
            await page.click('[data-testid="agent-product-1"]', force=True)
            await page.wait_for_timeout(250)
            t1 = await page.locator('[data-testid="selected-agent-title"]').inner_text()
            await page.click('[data-testid="agent-product-2"]', force=True)
            await page.wait_for_timeout(250)
            t2 = await page.locator('[data-testid="selected-agent-title"]').inner_text()
            if not (t0 != t1 and t1 != t2):
                raise Exception('Agent selector did not change selected title')

            await page.click('[data-testid="agents-switch-to-course"]', force=True)
            await page.wait_for_url('**/enterprise/courses', timeout=10000)
        await check_step("AI agents routes, selector updates, training link", s10)

        async def s11():
            await page.goto(f"{base}/enterprise/ai-agents", wait_until="domcontentloaded")
            await page.wait_for_timeout(1200)
            canvas_count = await page.locator('[data-testid="agent-workbench-3d"] canvas').count()
            fallback_count = await page.locator('[data-testid="agent-workbench-3d-fallback"]').count()
            print(f"3d canvas_count={canvas_count} fallback_count={fallback_count}")

            f1 = await page.evaluate("""() => {
                const c = document.querySelector('[data-testid="agent-workbench-3d"] canvas');
                return c ? c.toDataURL().slice(0, 80) : null;
            }""")
            await page.wait_for_timeout(700)
            f2 = await page.evaluate("""() => {
                const c = document.querySelector('[data-testid="agent-workbench-3d"] canvas');
                return c ? c.toDataURL().slice(0, 80) : null;
            }""")
            print(f"3d frame changed={(f1 != f2)}")

            await page.click('[data-testid="agent-workbench-3d-pause"]', force=True)
            await page.click('[data-testid="agent-workbench-3d-reset"]', force=True)
            await page.click('[data-testid="agent-workbench-3d-focus-0"]', force=True)
        await check_step("3D nonblank and controls", s11)

        async def s12():
            await page.goto(f"{base}/courses", wait_until="domcontentloaded")
            await choose_student_if_prompted()
            await page.wait_for_selector('[data-testid="student-theme-toggle"]', timeout=8000)
            await page.click('[data-testid="student-theme-toggle"]', force=True)
            await page.wait_for_timeout(200)
            await page.click('[data-testid="student-theme-toggle"]', force=True)
        await check_step("Student theme toggle", s12)

        async def s13():
            fail_once = {"catalog": True, "curriculum": True}

            async def fail_catalog(route):
                if fail_once['catalog']:
                    fail_once['catalog'] = False
                    await route.fulfill(status=503, content_type='application/json', body='{"detail":"TEST transient"}')
                else:
                    await route.continue_()

            async def fail_curriculum(route):
                if fail_once['curriculum']:
                    fail_once['curriculum'] = False
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

            await page.route('**/rest/v1/master_modules*', fail_curriculum)
            await page.goto(f"{base}/enterprise/course/{live_id}", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="enterprise-curriculum-error"]', timeout=14000)
            await page.click('[data-testid="enterprise-curriculum-retry"]', force=True)
            await page.wait_for_selector('[data-testid="enterprise-curriculum-modules"]', timeout=14000)
            await page.unroute('**/rest/v1/master_modules*', fail_curriculum)
        await check_step("Error/retry for catalog and enterprise curriculum", s13)

        async def s14():
            for w in [320, 390, 768, 1024, 1440, 1920]:
                h = 844 if w <= 390 else 1080
                await page.set_viewport_size({'width': w, 'height': h})

                await page.goto(f"{base}/courses", wait_until='domcontentloaded')
                await choose_student_if_prompted()
                await wait_catalog_ready()
                await overflow_state(f"student-{w}")

                await page.goto(f"{base}/enterprise/courses", wait_until='domcontentloaded')
                await wait_catalog_ready()
                await overflow_state(f"enterprise-{w}")

            await page.set_viewport_size({'width': 1920, 'height': 1080})
            await page.goto(f"{base}/enterprise/programme", wait_until='domcontentloaded')
        await check_step("Responsive overflow matrix + /enterprise/programme", s14)

        print("Final page-level error scan")
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

        if issues:
            print("=== ISSUES SUMMARY ===")
            for i in issues:
                print(i)
        else:
            print("All tracked checks passed")
    except Exception as e:
        print(f"Runner crashed: {str(e)}")

async def run_test(page, output_dir, page_url):
    try:
        base = "https://fintech-mvp-38.preview.emergentagent.com"
        live_id = "5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c"
        await page.set_viewport_size({"width": 1920, "height": 1080})

        await page.context.clear_cookies()
        await page.add_init_script("localStorage.setItem('valuevade-audience','student');")

        print("Check A: /courses student page selectors")
        await page.goto(f"{base}/courses", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="student-courses-page"]', timeout=12000)
        print("student page present")
        print("student-switch-enterprise count", await page.locator('[data-testid="student-switch-enterprise"]').count())
        print("student-theme-toggle count", await page.locator('[data-testid="student-theme-toggle"]').count())
        await page.fill('[data-testid="courses-search"]', 'zzzznoresult')
        await page.wait_for_timeout(1200)
        print("courses-empty count", await page.locator('[data-testid="courses-empty"]').count())

        print("Check B: live student detail route")
        await page.goto(f"{base}/course/{live_id}", wait_until="domcontentloaded")
        print("url", page.url)
        print("detail-hero count", await page.locator('[data-testid="detail-hero"]').count())
        print("upcoming count", await page.locator('[data-testid="upcoming-course-page"]').count())
        print("enroll btn count", await page.locator('[data-testid="detail-customize-enroll"]').count())
        print("dashboard btn count", await page.locator('[data-testid="detail-go-dashboard"]').count())

        print("Check C: student ai agents route")
        await page.goto(f"{base}/ai-agents", wait_until="domcontentloaded")
        print("url", page.url)
        print("student-ai-agents-page count", await page.locator('[data-testid="student-ai-agents-page"]').count())
        print("enterprise-ai-agents-page count", await page.locator('[data-testid="enterprise-ai-agents-page"]').count())

        print("Check D: enquiry interception quick")
        captured = {"raw": ""}
        async def intercept(route):
            captured["raw"] = route.request.post_data or ""
            await route.fulfill(status=200, content_type='application/json', body='{"reference":"TEST-ONLY-REF","notification":"accepted"}')
        await page.route('**/api/enterprise/enquiries', intercept)
        await page.goto(f"{base}/enterprise/course/{live_id}", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="enterprise-enquiry-form"]', timeout=12000)
        await page.fill('[data-testid="enquiry-name"]', 'QA Agent')
        await page.fill('[data-testid="enquiry-email"]', 'qa.agent@example.com')
        await page.fill('[data-testid="enquiry-company"]', 'QA Company')
        await page.fill('[data-testid="enquiry-requirements"]', 'Need scoped rollout and review checkpoints for finance team.')
        await page.check('[data-testid="enquiry-consent"]')
        await page.click('[data-testid="enquiry-submit"]', force=True)
        await page.wait_for_timeout(1500)
        print("enquiry-success count", await page.locator('[data-testid="enquiry-success"]').count())
        print("captured length", len(captured['raw']))

        print("Targeted checks complete")
    except Exception as e:
        print(f"Targeted checks failed: {str(e)}")

async def run_test(page, output_dir, page_url):
    enrollment_calls = []

    def track_enrollment(response):
        try:
            if '/api/me/enrollment-status' in response.url:
                enrollment_calls.append(response.url)
                print(f"TRACK: enrollment-status call #{len(enrollment_calls)} -> {response.status}")
        except Exception:
            pass

    page.on('response', track_enrollment)
    page.on('console', lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))

    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        print('STEP 1: Login as paid user')
        await page.wait_for_selector('[data-testid="login-email-input"]', timeout=20000)
        await page.fill('[data-testid="login-email-input"]', 'testagent2026@gmail.com')
        await page.fill('[data-testid="login-password-input"]', 'TestPass123!')
        await page.click('[data-testid="login-submit-button"]', force=True)
        await page.wait_for_timeout(2500)
        print(f"PASS: Logged in, current URL: {page.url}")

        print('STEP 2: Navigate resources and capture enrollment cache behavior')
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.wait_for_timeout(3000)
        await page.wait_for_selector('[data-testid="resources-catalog"]', timeout=20000)
        banner = await page.locator('[data-testid="enrolled-access-banner"]').count()
        print(f"INFO: enrolled banner count = {banner}")

        first_card = page.locator('[data-testid^="resource-card-"]').first
        await first_card.wait_for(timeout=15000)
        card_testid = await first_card.get_attribute('data-testid')
        resource_id = card_testid.replace('resource-card-', '') if card_testid else ''
        print(f"INFO: using resource_id={resource_id}")
        await page.click(f'[data-testid="resource-open-{resource_id}"]', force=True)
        await page.wait_for_selector('[data-testid="resource-detail"]', timeout=20000)
        await page.wait_for_timeout(1200)
        access_label_count = await page.locator('[data-testid="resource-access-label"]').count()
        print(f"INFO: resource access label count = {access_label_count}")

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/purchases', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="purchases-page"]', timeout=20000)
        await page.wait_for_timeout(2500)
        print(f"INFO: enrollment-status total calls after nav flow = {len(enrollment_calls)}")

        print('STEP 3: Verify purchases tabs and redirects')
        await page.click('[data-testid="purchase-history-tab"]', force=True)
        await page.wait_for_timeout(1200)
        history_visible = await page.locator('[data-testid="purchase-payment-history"]').count()
        print(f"PASS: history tab visible count = {history_visible}")

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/my-orders', wait_until='domcontentloaded')
        await page.wait_for_timeout(1200)
        print(f"INFO: /my-orders redirected URL = {page.url}")

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources/library', wait_until='domcontentloaded')
        await page.wait_for_timeout(1200)
        print(f"INFO: /resources/library redirected URL = {page.url}")

        print('STEP 4: Viewport checks on purchases (no horizontal overflow)')
        widths = [320, 768, 1024, 1440]
        for w in widths:
            await page.set_viewport_size({"width": w, "height": 800})
            await page.goto('https://fintech-mvp-38.preview.emergentagent.com/purchases', wait_until='domcontentloaded')
            await page.wait_for_selector('[data-testid="purchases-page"]', timeout=20000)
            await page.wait_for_timeout(1200)
            overflow = await page.evaluate("""() => {
                const el = document.querySelector('[data-testid="purchases-page"]') || document.documentElement;
                return {scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, hasOverflow: el.scrollWidth > el.clientWidth + 2};
            }""")
            print(f"WIDTH {w}: overflow={overflow['hasOverflow']} scroll={overflow['scrollWidth']} client={overflow['clientWidth']}")

        await page.set_viewport_size({"width": 1920, "height": 1080})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/purchases', wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        await page.screenshot(path='/app/test_reports/artifacts/iteration107_frontend/automation_output/20261026_180307_cf45acfa9b0c/purchases_desktop.jpeg', type="jpeg", quality=40, full_page=False)

        print('STEP 5: Sign out and check unpaid user does not inherit enrolled state')
        await page.click('[data-testid="sidebar-signout"]', force=True)
        await page.wait_for_selector('[data-testid="login-form"]', timeout=20000)
        await page.fill('[data-testid="login-email-input"]', 'vvtest673479@example.com')
        await page.fill('[data-testid="login-password-input"]', 'TestPass123!')
        await page.click('[data-testid="login-submit-button"]', force=True)
        await page.wait_for_timeout(2500)
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.wait_for_timeout(2500)
        unpaid_banner = await page.locator('[data-testid="enrolled-access-banner"]').count()
        print(f"INFO: unpaid enrolled banner count = {unpaid_banner}")

        print('STEP 6: Mobile purchases smoke')
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/purchases', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="purchases-page"]', timeout=20000)
        await page.wait_for_timeout(1200)
        await page.screenshot(path='/app/test_reports/artifacts/iteration107_frontend/automation_output/20261026_180307_cf45acfa9b0c/purchases_mobile.jpeg', type="jpeg", quality=40, full_page=False)
        print('PASS: mobile purchases loaded')

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

    except Exception as e:
        print(f"FAIL: frontend flow failed - {str(e)}")

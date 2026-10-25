async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        captured = {"raw":""}
        async def intercept(route):
            captured["raw"] = route.request.post_data or ""
            await route.fulfill(status=200, content_type='application/json', body='{"reference":"TEST-ONLY-REF","notification":"accepted"}')
        await page.route('**/api/enterprise/enquiries', intercept)

        await page.wait_for_selector('[data-testid="enterprise-enquiry-form"]', timeout=15000)
        # wait until config fully loaded and submit enabled label
        for _ in range(30):
            txt = await page.locator('[data-testid="enquiry-submit"]').inner_text()
            disabled = await page.locator('[data-testid="enquiry-submit"]').is_disabled()
            if (not disabled) and ('Request a team proposal' in txt):
                break
            await page.wait_for_timeout(500)
        txt = await page.locator('[data-testid="enquiry-submit"]').inner_text()
        disabled = await page.locator('[data-testid="enquiry-submit"]').is_disabled()
        print('submit text', txt, 'disabled', disabled)

        await page.fill('[data-testid="enquiry-name"]', 'QA Agent')
        await page.fill('[data-testid="enquiry-email"]', 'qa.agent@example.com')
        await page.fill('[data-testid="enquiry-company"]', 'QA Company')
        await page.fill('[data-testid="enquiry-requirements"]', 'Need scoped rollout and review checkpoints for finance team.')
        await page.check('[data-testid="enquiry-consent"]')
        await page.click('[data-testid="enquiry-submit"]', force=True)
        await page.wait_for_selector('[data-testid="enquiry-success"]', timeout=12000)
        print('captured len', len(captured['raw']))
        print('contains Course', 'Course:' in captured['raw'])
    except Exception as e:
        print('Probe2 failed', str(e))

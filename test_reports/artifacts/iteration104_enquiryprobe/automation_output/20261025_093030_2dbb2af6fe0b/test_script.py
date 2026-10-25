async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        captured = {"raw":""}
        async def intercept(route):
            captured["raw"] = route.request.post_data or ""
            await route.fulfill(status=200, content_type='application/json', body='{"reference":"TEST-ONLY-REF","notification":"accepted"}')
        await page.route('**/api/enterprise/enquiries', intercept)

        await page.wait_for_selector('[data-testid="enterprise-enquiry-form"]', timeout=15000)
        valid_before = await page.eval_on_selector('[data-testid="enterprise-enquiry-form"]', 'f => f.reportValidity()')
        print('valid_before', valid_before)
        context = await page.locator('[data-testid="enquiry-course-context"]').inner_text()
        maxlen = await page.get_attribute('[data-testid="enquiry-requirements"]','maxlength')
        print('context', context)
        print('maxlength', maxlen)

        await page.fill('[data-testid="enquiry-name"]', 'QA Agent')
        await page.fill('[data-testid="enquiry-email"]', 'qa.agent@example.com')
        await page.fill('[data-testid="enquiry-company"]', 'QA Company')
        await page.select_option('[data-testid="enquiry-interest"]', 'training')
        await page.fill('[data-testid="enquiry-requirements"]', 'Need scoped rollout and review checkpoints for finance team.')
        await page.check('[data-testid="enquiry-consent"]')
        await page.click('[data-testid="enquiry-submit"]', force=True)
        await page.wait_for_timeout(1500)

        success = await page.locator('[data-testid="enquiry-success"]').count()
        err = await page.locator('[data-testid="enquiry-error"]').count()
        print('success_count', success)
        print('error_count', err)
        if err:
            txt = await page.locator('[data-testid="enquiry-error"]').inner_text()
            print('error_text', txt)
        print('captured_len', len(captured['raw']))
        print('captured_head', captured['raw'][:250])
    except Exception as e:
        print(f"Enquiry probe failed: {str(e)}")

async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        await page.wait_for_selector('[data-testid="enterprise-enquiry-form"]', timeout=15000)
        await page.fill('[data-testid="enquiry-name"]', 'QA Agent')
        await page.fill('[data-testid="enquiry-email"]', 'qa.agent@example.com')
        await page.fill('[data-testid="enquiry-company"]', 'QA Company')
        await page.fill('[data-testid="enquiry-requirements"]', 'Need scoped rollout and review checkpoints for finance team.')
        await page.check('[data-testid="enquiry-consent"]')
        validity = await page.eval_on_selector('[data-testid="enterprise-enquiry-form"]', 'f => f.reportValidity()')
        print('validity_after_fill', validity)
        submit_disabled = await page.get_attribute('[data-testid="enquiry-submit"]','disabled')
        print('submit_disabled_attr', submit_disabled)
    except Exception as e:
        print('Validity probe failed', str(e))

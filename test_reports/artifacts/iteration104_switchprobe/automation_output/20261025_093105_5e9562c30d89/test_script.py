async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]', force=True)
            await page.wait_for_timeout(400)
        await page.wait_for_selector('[data-testid="student-switch-enterprise"]', timeout=12000)
        await page.click('[data-testid="student-switch-enterprise"]', force=True)
        await page.wait_for_timeout(800)
        print('url after switch', page.url)
        print('enterprise page count', await page.locator('[data-testid="enterprise-courses-page"]').count())
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/ai-agents', wait_until='domcontentloaded')
        print('ai route url', page.url)
        print('enterprise ai count', await page.locator('[data-testid="enterprise-ai-agents-page"]').count())
    except Exception as e:
        print('switch probe failed', str(e))

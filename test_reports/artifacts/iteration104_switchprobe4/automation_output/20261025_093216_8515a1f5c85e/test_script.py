async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]', force=True)
            await page.wait_for_timeout(400)
        before = await page.evaluate("localStorage.getItem('valuevade-audience')")
        print('before audience', before)
        await page.click('[data-testid="student-switch-enterprise"]', force=True)
        await page.wait_for_timeout(300)
        after = await page.evaluate("localStorage.getItem('valuevade-audience')")
        print('after audience', after)
        print('url', page.url)
    except Exception as e:
        print('switch probe4 failed', str(e))

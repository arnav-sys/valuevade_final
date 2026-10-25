async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]')
            await page.wait_for_timeout(400)
        await page.wait_for_selector('[data-testid="student-switch-enterprise"]', timeout=12000)
        pressed_before = await page.get_attribute('[data-testid="student-switch-enterprise"]','aria-pressed')
        print('pressed_before', pressed_before)
        await page.click('[data-testid="student-switch-enterprise"]')
        await page.wait_for_timeout(1000)
        pressed_after = await page.get_attribute('[data-testid="student-switch-enterprise"]','aria-pressed')
        print('pressed_after', pressed_after)
        print('url_after', page.url)
        ls = await page.evaluate("localStorage.getItem('valuevade-audience')")
        print('localStorage audience', ls)
    except Exception as e:
        print('switch probe2 failed', str(e))

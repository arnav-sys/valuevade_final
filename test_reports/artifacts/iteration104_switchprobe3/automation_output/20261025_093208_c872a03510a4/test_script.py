async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        # if gateway appears, choose student and wait close
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]', force=True)
            await page.wait_for_timeout(500)
        # ensure modal closed
        for _ in range(20):
            if await page.locator('[data-testid="audience-gateway"]').count() == 0:
                break
            await page.wait_for_timeout(300)
        print('gateway open count', await page.locator('[data-testid="audience-gateway"]').count())
        await page.click('[data-testid="student-switch-enterprise"]', force=True)
        await page.wait_for_timeout(1200)
        print('url after switch', page.url)
        print('enterprise-courses-page count', await page.locator('[data-testid="enterprise-courses-page"]').count())
    except Exception as e:
        print('switch probe3 failed', str(e))

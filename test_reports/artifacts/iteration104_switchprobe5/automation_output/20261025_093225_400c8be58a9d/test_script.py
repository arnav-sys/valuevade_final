async def run_test(page, output_dir, page_url):
    try:
        await page.context.clear_cookies()
        await page.add_init_script("localStorage.setItem('valuevade-audience','student');")
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.set_viewport_size({"width": 1920, "height": 1080})
        print('gateway count', await page.locator('[data-testid="audience-gateway"]').count())
        print('before', await page.evaluate("localStorage.getItem('valuevade-audience')"))
        await page.wait_for_selector('[data-testid="student-switch-enterprise"]', timeout=12000)
        await page.click('[data-testid="student-switch-enterprise"]', force=True)
        await page.wait_for_timeout(1200)
        print('after', await page.evaluate("localStorage.getItem('valuevade-audience')"))
        print('url', page.url)
        print('enterprise page count', await page.locator('[data-testid="enterprise-courses-page"]').count())
    except Exception as e:
        print('switch probe5 failed', str(e))

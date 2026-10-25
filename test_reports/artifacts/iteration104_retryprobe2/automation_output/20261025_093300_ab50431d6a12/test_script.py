async def run_test(page, output_dir, page_url):
    try:
        await page.context.clear_cookies()
        await page.add_init_script("localStorage.setItem('valuevade-audience','student');")
        await page.set_viewport_size({"width": 1920, "height": 1080})

        hit = {"count":0}
        async def fail_catalog(route):
            hit['count'] += 1
            if hit['count'] == 1:
                await route.fulfill(status=503, content_type='application/json', body='{"detail":"TEST transient"}')
            else:
                await route.continue_()
        await page.route('**/api/courses/catalog*', fail_catalog)

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses?qa_retry=1', wait_until='domcontentloaded')
        await page.wait_for_timeout(1500)
        print('catalog route hit count', hit['count'])
        print('courses-error count', await page.locator('[data-testid="courses-error"]').count())
        if await page.locator('[data-testid="courses-error"]').count() > 0:
            await page.click('[data-testid="courses-retry-button"]', force=True)
            await page.wait_for_selector('article.cc-card', timeout=12000)
            print('retry recovered cards')
    except Exception as e:
        print('retry probe2 failed', str(e))

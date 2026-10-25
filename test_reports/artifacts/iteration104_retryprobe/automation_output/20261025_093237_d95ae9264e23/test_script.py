async def run_test(page, output_dir, page_url):
    try:
        await page.context.clear_cookies()
        await page.add_init_script("localStorage.setItem('valuevade-audience','student');")
        await page.set_viewport_size({"width": 1920, "height": 1080})

        fail_once = {"catalog": True}
        async def fail_catalog(route):
            if fail_once['catalog']:
                fail_once['catalog'] = False
                await route.fulfill(status=503, content_type='application/json', body='{"detail":"TEST transient"}')
            else:
                await route.continue_()
        await page.route('**/api/courses/catalog', fail_catalog)
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="courses-error"]', timeout=12000)
        print('courses-error visible')
        await page.click('[data-testid="courses-retry-button"]', force=True)
        await page.wait_for_selector('article.cc-card', timeout=12000)
        print('catalog recovered after retry')
    except Exception as e:
        print('retry probe failed', str(e))

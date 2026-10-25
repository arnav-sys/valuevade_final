async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        # wait up to 5s for audience modal and choose student
        for _ in range(10):
            if await page.locator('[data-testid="audience-gateway"]').count() > 0:
                await page.click('[data-testid="choose-student"]', force=True)
                await page.wait_for_timeout(500)
                break
            await page.wait_for_timeout(500)
        await page.wait_for_selector('article.cc-card', timeout=12000)
        await page.fill('[data-testid="courses-search"]', 'zzzznoresult')
        await page.wait_for_timeout(800)
        print('empty count', await page.locator('[data-testid="courses-empty"]').count())
        print('result count text', await page.locator('[data-testid="courses-result-count"]').inner_text())
    except Exception as e:
        print('search probe failed', str(e))

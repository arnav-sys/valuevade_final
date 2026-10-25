async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]', force=True)
            await page.wait_for_timeout(400)
        await page.wait_for_selector('[data-testid="student-courses-page"]', timeout=12000)
        await page.wait_for_timeout(3000)
        cards = await page.evaluate("""() => Array.from(document.querySelectorAll('article.cc-card')).map(el => el.getAttribute('data-testid'))""")
        print(f"article cards: {len(cards)}")
        print(cards)
        unique = sorted(set(cards))
        print(f"unique cards: {len(unique)}")
        await page.fill('[data-testid="courses-search"]', 'zzzznoresult')
        await page.wait_for_timeout(2000)
        empty_count = await page.locator('[data-testid="courses-empty"]').count()
        result_count = await page.locator('[data-testid="courses-result-count"]').inner_text()
        print(f"after search empty_count={empty_count}, result_count={result_count}")
    except Exception as e:
        print(f"Probe failed: {str(e)}")

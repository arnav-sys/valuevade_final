async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]', force=True)
            await page.wait_for_timeout(500)
        await page.wait_for_timeout(3000)
        # in case modal reappears
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            await page.click('[data-testid="choose-student"]', force=True)
            await page.wait_for_timeout(500)

        hero = await page.locator('[data-testid="detail-hero"]').count()
        upcoming = await page.locator('[data-testid="upcoming-course-page"]').count()
        err = await page.locator('[data-testid="detail-error"]').count()
        breadcrumb = await page.locator('[data-testid="detail-breadcrumb"]').count()
        print(f"hero={hero} upcoming={upcoming} error={err} breadcrumb={breadcrumb} url={page.url}")

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
          print(f"Found error message: {error_text}")
        else:
          print("No error messages found on the page")
    except Exception as e:
        print(f"Detail probe failed: {str(e)}")

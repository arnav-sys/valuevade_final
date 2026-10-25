async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.evaluate("""() => { localStorage.setItem('valuevade-audience','student'); }""")
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.wait_for_timeout(6000)
        cnt = await page.locator('a[href^="/course/"]').count()
        print(f'CHECK: /course links after 6s = {cnt}')

        # Get error messages using specific selectors
        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

    except Exception as e:
        print(f"FAIL: courseid wait failed: {str(e)}")

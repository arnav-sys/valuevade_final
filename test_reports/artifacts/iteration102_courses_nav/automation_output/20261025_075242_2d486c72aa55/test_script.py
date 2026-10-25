async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.evaluate("""() => { localStorage.setItem('valuevade-audience','student'); }""")
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.wait_for_timeout(2000)
        if await page.get_by_text('Equity Research Analyst').count() > 0:
            await page.get_by_text('Equity Research Analyst').first.click(force=True)
            await page.wait_for_timeout(1200)
            print(f'CHECK: clicking course title navigates to {page.url}')
        else:
            print('WARN: course title text not found')

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
        print(f"FAIL: courses nav failed: {str(e)}")

async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.evaluate("""() => { localStorage.removeItem('valuevade-audience'); }""")
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/course/equity-research-analyst', wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        print(f'URL={page.url}')
        print(f'GATEWAY={await page.locator("[data-testid=audience-gateway]").count() > 0}')

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
        print(f"FAIL: course direct failed: {str(e)}")

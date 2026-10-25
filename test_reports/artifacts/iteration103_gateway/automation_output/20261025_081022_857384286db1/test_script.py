async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.wait_for_timeout(1200)
        print(f"G1 initial url={page.url}")

        # Try switch to student audience if toggle exists
        student_btn = page.locator('button:has-text("Students")').first
        if await student_btn.count() > 0:
          await student_btn.click(force=True)
          await page.wait_for_timeout(700)
          print(f"G2 after Students click url={page.url}")
        else:
          print("G2 students toggle button not found")

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.wait_for_timeout(900)
        print(f"G3 /courses url={page.url}")

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
        print(f"TEST FAILURE: {str(e)}")

async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))
        await page.wait_for_timeout(800)
        await page.wait_for_selector("body", timeout=15000)
        print("PASS: Landing page loaded")
        await page.screenshot(path="/app/test_reports/artifacts/iteration107_smoke/automation_output/20261026_180000_95280b3c0e8d/landing.jpeg", type="jpeg", quality=40, full_page=False)
        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*=\"error\"], [id*=\"error\"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")
    except Exception as e:
        print(f"FAIL: Smoke load failed - {str(e)}")

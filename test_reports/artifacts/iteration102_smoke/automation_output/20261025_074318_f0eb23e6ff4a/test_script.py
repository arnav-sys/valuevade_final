async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))
        await page.wait_for_timeout(1200)
        await page.wait_for_selector('[data-testid="navbar"]', timeout=15000)
        print("PASS: Landing loaded with navbar")
        await page.screenshot(path="/app/test_reports/artifacts/iteration102_smoke/automation_output/20261025_074318_f0eb23e6ff4a/landing_desktop.jpeg", type="jpeg", quality=40, full_page=False)

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise', wait_until='domcontentloaded')
        await page.wait_for_timeout(1500)
        print(f"Enterprise URL: {page.url}")
        await page.screenshot(path="/app/test_reports/artifacts/iteration102_smoke/automation_output/20261025_074318_f0eb23e6ff4a/enterprise_desktop.jpeg", type="jpeg", quality=40, full_page=False)

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.wait_for_timeout(1500)
        print(f"Resources URL: {page.url}")
        await page.screenshot(path="/app/test_reports/artifacts/iteration102_smoke/automation_output/20261025_074318_f0eb23e6ff4a/resources_desktop.jpeg", type="jpeg", quality=40, full_page=False)

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
        print(f"FAIL: Smoke run failed: {str(e)}")

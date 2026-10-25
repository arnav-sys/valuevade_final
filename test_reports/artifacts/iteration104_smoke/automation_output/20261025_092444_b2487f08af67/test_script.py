async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        print("Step 1: Open landing page")
        await page.wait_for_selector('[data-testid="navbar"]', timeout=15000)
        print("Landing navbar loaded")

        print("Step 2: Verify All Courses and AI Agents links exist")
        await page.wait_for_selector('[data-testid="landing-all-courses-link"]', timeout=5000)
        await page.wait_for_selector('[data-testid="landing-ai-agents-link"]', timeout=5000)
        print("Landing links present")

        await page.screenshot(path="/app/test_reports/artifacts/iteration104_smoke/automation_output/20261025_092444_b2487f08af67/landing_desktop.jpeg", type="jpeg", quality=40, full_page=False)
        print("Captured desktop smoke screenshot")

        print("Step 3: Check for error messages")
        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

        print("Smoke test completed successfully")
    except Exception as e:
        print(f"Smoke test failed: {str(e)}")

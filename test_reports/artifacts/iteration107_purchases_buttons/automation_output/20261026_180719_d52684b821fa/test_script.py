async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        await page.wait_for_selector('[data-testid="login-email-input"]', timeout=20000)
        await page.fill('[data-testid="login-email-input"]', 'testagent2026@gmail.com')
        await page.fill('[data-testid="login-password-input"]', 'TestPass123!')
        await page.click('[data-testid="login-submit-button"]', force=True)
        await page.wait_for_timeout(2200)
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/purchases', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="purchases-page"]', timeout=20000)

        for _ in range(15):
            if await page.locator('[data-testid="purchase-included-templates"]').count() > 0:
                break
            await page.wait_for_timeout(1000)

        btns = await page.locator('[data-testid^="purchase-download-"]').all()
        total = len(btns)
        disabled = 0
        for b in btns:
            if await b.is_disabled():
                disabled += 1
        print(f"INFO: purchase download buttons total={total}, disabled={disabled}")

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*=\"error\"], [id*=\"error\"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")
    except Exception as e:
        print(f"FAIL: purchases button check failed - {str(e)}")

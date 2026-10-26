async def run_test(page, output_dir, page_url):
    page.on('console', lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))

    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        await page.wait_for_selector('[data-testid="login-email-input"]', timeout=20000)
        await page.fill('[data-testid="login-email-input"]', 'info@valuevade.com')
        await page.fill('[data-testid="login-password-input"]', 'VV-Admin#2026-Sec')
        await page.click('[data-testid="login-submit-button"]', force=True)
        await page.wait_for_timeout(2500)

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/admin-panel?tab=resources', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="resources-admin-tab"]', timeout=30000)

        add_btn = page.locator('[data-testid="admin-resource-add"]')
        for i in range(12):
            disabled = await add_btn.is_disabled()
            print(f"WAIT add enabled check {i+1}: disabled={disabled}")
            if not disabled:
                break
            retry_btn = page.locator('[data-testid="setup-retry"]')
            if await retry_btn.count() > 0:
                await retry_btn.click(force=True)
            await page.wait_for_timeout(1500)

        disabled_final = await add_btn.is_disabled()
        print(f"INFO: final disabled state={disabled_final}")
        if not disabled_final:
            await add_btn.click(force=True)
            await page.wait_for_timeout(1000)
            open_count = await page.locator('[data-testid="admin-resource-editor-title"]').count()
            print(f"INFO: editor open count={open_count}")
        else:
            print('FAIL: add button remained disabled, cannot test file-picker UI')

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*=\"error\"], [id*=\"error\"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")
    except Exception as e:
        print(f"FAIL: admin final attempt failed - {str(e)}")

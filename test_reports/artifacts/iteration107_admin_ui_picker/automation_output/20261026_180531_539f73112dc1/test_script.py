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
        for i in range(15):
            if not await add_btn.is_disabled():
                break
            await page.wait_for_timeout(1000)
        await add_btn.click(force=True)
        await page.wait_for_selector('[data-testid="admin-resource-editor-title"]', timeout=15000)

        await page.fill('[data-testid="admin-resource-title"]', 'QA temp picker')
        await page.fill('[data-testid="admin-resource-description"]', 'QA file picker validation without save.')

        file_input = page.locator('[data-testid="admin-resource-file"]')
        await file_input.set_input_files('/app/test_reports/artifacts/iteration107_files/bad.exe')
        await page.wait_for_timeout(500)
        err_text = await page.locator('[data-testid="admin-resource-error"]').first.text_content()
        print(f"INFO: invalid file error text = {err_text}")

        await file_input.set_input_files('/app/test_reports/artifacts/iteration107_files/qa_replace.xlsx')
        await page.wait_for_timeout(500)
        selected_count = await page.locator('[data-testid="admin-resource-selected-file"]').count()
        print(f"INFO: selected-file row count after xlsx = {selected_count}")

        await page.click('[data-testid="admin-resource-clear-file"]', force=True)
        await page.wait_for_timeout(400)
        selected_after_clear = await page.locator('[data-testid="admin-resource-selected-file"]').count()
        print(f"INFO: selected-file row after clear = {selected_after_clear}")

        await page.keyboard.press('Escape')
        await page.wait_for_timeout(500)
        print('PASS: file picker checks complete without saving')

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*=\"error\"], [id*=\"error\"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")
    except Exception as e:
        print(f"FAIL: admin picker flow failed - {str(e)}")

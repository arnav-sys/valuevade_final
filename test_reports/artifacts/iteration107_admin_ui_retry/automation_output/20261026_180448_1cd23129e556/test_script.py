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

        disabled = await page.locator('[data-testid="admin-resource-add"]').is_disabled()
        print(f"INFO: add button disabled={disabled}")

        await page.click('[data-testid="admin-resource-add"]', force=True)
        await page.wait_for_timeout(1000)
        editor_title_count = await page.locator('[data-testid="admin-resource-editor-title"]').count()
        print(f"INFO: editor title count after click={editor_title_count}")

        if editor_title_count == 0:
            await page.click('[data-testid="admin-resource-add"]', force=True)
            await page.wait_for_timeout(1500)
            editor_title_count2 = await page.locator('[data-testid="admin-resource-editor-title"]').count()
            print(f"INFO: editor title count after second click={editor_title_count2}")

        if await page.locator('[data-testid="admin-resource-editor-title"]').count() > 0:
            file_input = page.locator('[data-testid="admin-resource-file"]')
            await file_input.set_input_files('/app/test_reports/artifacts/iteration107_files/bad.exe')
            await page.wait_for_timeout(500)
            err = await page.locator('[data-testid="admin-resource-error"]').count()
            print(f"PASS: invalid file error count={err}")

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*=\"error\"], [id*=\"error\"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")
    except Exception as e:
        print(f"FAIL: retry admin flow failed - {str(e)}")

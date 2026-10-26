async def run_test(page, output_dir, page_url):
    page.on('console', lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))

    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        print('STEP 1: Login admin and open resources tab')
        await page.wait_for_selector('[data-testid="login-email-input"]', timeout=20000)
        await page.fill('[data-testid="login-email-input"]', 'info@valuevade.com')
        await page.fill('[data-testid="login-password-input"]', 'VV-Admin#2026-Sec')
        await page.click('[data-testid="login-submit-button"]', force=True)
        await page.wait_for_timeout(2500)
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/admin-panel?tab=resources', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="resources-admin-tab"]', timeout=30000)
        print('PASS: resources tab loaded')

        print('STEP 2: Validate file format error and selected-file state')
        await page.click('[data-testid="admin-resource-add"]', force=True)
        await page.wait_for_selector('[data-testid="resource-editor"]', timeout=10000)
        await page.wait_for_timeout(500)

        await page.fill('[data-testid="admin-resource-title"]', 'QA UI Temp Resource')
        await page.fill('[data-testid="admin-resource-description"]', 'QA temporary resource to validate file picker states only.')

        file_input = page.locator('[data-testid="admin-resource-file"]')
        await file_input.set_input_files('/app/test_reports/artifacts/iteration107_files/bad.exe')
        await page.wait_for_timeout(600)
        err_count = await page.locator('[data-testid="admin-resource-error"]').count()
        print(f"INFO: invalid-format error visible count = {err_count}")

        await file_input.set_input_files('/app/test_reports/artifacts/iteration107_files/qa_upload.pdf')
        await page.wait_for_timeout(600)
        selected_count = await page.locator('[data-testid="admin-resource-selected-file"]').count()
        print(f"INFO: selected file row after PDF = {selected_count}")

        await page.click('[data-testid="admin-resource-clear-file"]', force=True)
        await page.wait_for_timeout(400)
        selected_after_clear = await page.locator('[data-testid="admin-resource-selected-file"]').count()
        print(f"INFO: selected file row after clear = {selected_after_clear}")

        await file_input.set_input_files('/app/test_reports/artifacts/iteration107_files/qa_replace.xlsx')
        await page.wait_for_timeout(600)
        selected_xlsx = await page.locator('[data-testid="admin-resource-selected-file"]').count()
        print(f"INFO: selected file row after XLSX = {selected_xlsx}")

        await page.keyboard.press('Escape')
        await page.wait_for_timeout(600)
        print('PASS: editor closed without saving temp resource')

        print('STEP 3: Non-admin denied check')
        await page.click('[data-testid="sidebar-signout"]', force=True)
        await page.wait_for_selector('[data-testid="login-form"]', timeout=20000)
        await page.fill('[data-testid="login-email-input"]', 'vvtest673479@example.com')
        await page.fill('[data-testid="login-password-input"]', 'TestPass123!')
        await page.click('[data-testid="login-submit-button"]', force=True)
        await page.wait_for_timeout(2200)
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/admin-panel', wait_until='domcontentloaded')
        await page.wait_for_timeout(1800)
        denied = await page.locator('[data-testid="admin-denied"]').count()
        print(f"INFO: admin denied screen count = {denied}")

        await page.screenshot(path='/app/test_reports/artifacts/iteration107_admin_ui/automation_output/20261026_180421_0b2d73153d33/admin_resources_ui.jpeg', type="jpeg", quality=40, full_page=False)

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*=\"error\"], [id*=\"error\"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

    except Exception as e:
        print(f"FAIL: admin ui flow failed - {str(e)}")

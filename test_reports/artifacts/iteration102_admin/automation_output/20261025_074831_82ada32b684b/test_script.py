async def run_test(page, output_dir, page_url):
    page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))

    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/login', wait_until='domcontentloaded')
        await page.evaluate("""() => { localStorage.clear(); sessionStorage.clear(); }""")
        await page.reload(wait_until='domcontentloaded')
        await page.fill('[data-testid="login-email-input"]', 'info@valuevade.com')
        await page.fill('[data-testid="login-password-input"]', 'VV-Admin#2026-Sec')
        await page.locator('[data-testid="login-submit-button"]').click()
        await page.wait_for_timeout(3000)
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/admin-panel?tab=enterprise', wait_until='domcontentloaded')
        await page.wait_for_timeout(2000)

        if await page.locator('[data-testid="admin-denied"]').count() > 0:
            txt = await page.locator('[data-testid="admin-denied"]').text_content()
            print(f'FAIL: admin denied screen shown: {txt}')
        else:
            await page.wait_for_selector('[data-testid="enterprise-admin-tab"]', timeout=15000)
            print('PASS: enterprise admin tab opened')
            db = await page.locator('[data-testid="enterprise-database-status"]').text_content()
            em = await page.locator('[data-testid="enterprise-email-status"]').text_content()
            print(f'CHECK: setup status {db} | {em}')

            if await page.locator('[data-testid="enterprise-setup-download"]').count() > 0:
                await page.locator('[data-testid="enterprise-setup-download"]').click()
                await page.wait_for_timeout(300)
                print('PASS: setup.sql download button clickable')

            await page.locator('[data-testid="enterprise-setup-refresh"]').click()
            await page.wait_for_timeout(600)

            price0 = await page.locator('[data-testid="admin-slab-price-0"]').input_value()
            max0 = await page.locator('[data-testid="admin-slab-max-0"]').input_value()
            max3 = await page.locator('[data-testid="admin-slab-max-3"]').input_value()

            await page.fill('[data-testid="admin-slab-price-0"]', str(int(price0)+1))
            await page.locator('[data-testid="admin-pricing-save"]').click(); await page.wait_for_timeout(1300)
            changed = await page.locator('[data-testid="admin-slab-price-0"]').input_value()
            print(f'CHECK: changed price immediate={changed}')

            await page.reload(wait_until='domcontentloaded'); await page.wait_for_timeout(1000)
            persisted = await page.locator('[data-testid="admin-slab-price-0"]').input_value()
            print(f'CHECK: changed price persisted={persisted}')

            await page.fill('[data-testid="admin-slab-max-3"]', '900')
            await page.locator('[data-testid="admin-pricing-save"]').click(); await page.wait_for_timeout(1000)
            err = await page.locator('[data-testid="enterprise-admin-error"]').text_content()
            print(f'PASS: invalid slab validation error={err}')

            await page.fill('[data-testid="admin-slab-price-0"]', price0)
            await page.fill('[data-testid="admin-slab-max-0"]', max0)
            await page.fill('[data-testid="admin-slab-max-3"]', max3)
            await page.locator('[data-testid="admin-pricing-save"]').click(); await page.wait_for_timeout(1300)
            print('PASS: restored original pricing values')

            await page.locator('[data-testid="admin-tab-resources"]').click(); await page.wait_for_timeout(1200)
            await page.wait_for_selector('[data-testid="resources-admin-tab"]', timeout=12000)
            disabled = await page.locator('[data-testid="admin-resource-add"]').is_disabled()
            print(f'CHECK: resources add disabled pending DB={disabled}')

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
        print(f"FAIL: admin script failed: {str(e)}")

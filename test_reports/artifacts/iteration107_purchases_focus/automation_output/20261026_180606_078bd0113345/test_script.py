async def run_test(page, output_dir, page_url):
    page.on('console', lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))

    purchases_responses = []

    def track_resp(response):
        try:
            if '/api/purchases' in response.url:
                purchases_responses.append(response.status)
                print(f"TRACK purchases API status={response.status}")
        except Exception:
            pass

    page.on('response', track_resp)

    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        await page.wait_for_selector('[data-testid="login-email-input"]', timeout=20000)
        await page.fill('[data-testid="login-email-input"]', 'testagent2026@gmail.com')
        await page.fill('[data-testid="login-password-input"]', 'TestPass123!')
        await page.click('[data-testid="login-submit-button"]', force=True)
        await page.wait_for_timeout(2500)

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/purchases', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="purchases-page"]', timeout=20000)

        loaded = False
        for i in range(20):
            if await page.locator('[data-testid="purchased-course"]').count() > 0:
                loaded = True
                print('PASS: purchased-course section visible')
                break
            if await page.locator('[data-testid="purchases-empty"]').count() > 0:
                loaded = True
                print('PASS: purchases-empty state visible')
                break
            if await page.locator('[data-testid="purchases-error"]').count() > 0:
                loaded = True
                err = await page.locator('[data-testid="purchases-error"]').first.text_content()
                print(f"FAIL: purchases error visible: {err}")
                break
            await page.wait_for_timeout(1000)

        loading_count = await page.locator('[data-testid="purchases-loading"]').count()
        print(f"INFO: purchases-loading count after wait={loading_count}")

        included_count = await page.locator('[data-testid="purchase-included-templates"]').count()
        free_labels = await page.locator('span.purchase-included').count()
        print(f"INFO: included section count={included_count}, free-label count={free_labels}")

        await page.click('[data-testid="purchase-history-tab"]', force=True)
        await page.wait_for_timeout(1200)
        history_count = await page.locator('[data-testid^="purchase-history-"]').count()
        history_empty = await page.locator('[data-testid="purchase-history-empty"]').count()
        print(f"INFO: history rows={history_count}, history empty count={history_empty}")

        print(f"INFO: captured purchases API statuses={purchases_responses}")

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*=\"error\"], [id*=\"error\"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")
    except Exception as e:
        print(f"FAIL: purchases focused test failed - {str(e)}")

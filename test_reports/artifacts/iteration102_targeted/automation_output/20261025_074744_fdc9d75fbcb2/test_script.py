async def run_test(page, output_dir, page_url):
    page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))

    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="enterprise-page"]', timeout=15000)
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_targeted/automation_output/20261025_074744_fdc9d75fbcb2/enterprise_1920x800.jpeg', type="jpeg", quality=40, full_page=False)
        print('PASS: enterprise page loaded at 1920x800')

        await page.locator('[data-testid="enterprise-scene-pause"]').click()
        await page.wait_for_timeout(250)
        await page.locator('[data-testid="enterprise-scene-reset"]').click()
        print('PASS: scene controls clickable')

        case_before = await page.locator('[data-testid="workflow-case-study"] blockquote').text_content()
        await page.locator('[data-testid="workflow-tab-2"]').click()
        await page.wait_for_timeout(300)
        case_after = await page.locator('[data-testid="workflow-case-study"] blockquote').text_content()
        print(f'CHECK: workflow switch changed case={case_before != case_after}')

        await page.locator('[data-testid="agents-training-tab"]').click()
        await page.wait_for_timeout(250)
        copy = await page.locator('[data-testid="agents-mode-description"]').text_content()
        print(f'PASS: agents training copy {copy[:80]}')

        seat = page.locator('[data-testid="enterprise-seat-number"]')
        for n in [1, 10, 11, 50, 51, 200, 201, 1000]:
            await seat.fill(str(n))
            await page.wait_for_timeout(160)
            unit = await page.locator('[data-testid="enterprise-unit-price"]').text_content()
            print(f'SEAT {n} => {unit}')

        await seat.fill('0'); await seat.blur(); await page.wait_for_timeout(200)
        low = await seat.input_value()
        await seat.fill('4000'); await seat.blur(); await page.wait_for_timeout(200)
        high = await seat.input_value()
        submit_disabled = await page.locator('[data-testid="enquiry-submit"]').is_disabled()
        unavailable = await page.locator('[data-testid="enquiry-unavailable"]').text_content()
        print(f'CHECK: clamp low={low} high={high} submit_disabled={submit_disabled} unavailable={unavailable[:70]}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="resources-catalog"]', timeout=12000)
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_targeted/automation_output/20261025_074744_fdc9d75fbcb2/resources_1920x800.jpeg', type="jpeg", quality=40, full_page=False)
        status = await page.locator('[data-testid="resources-status"]').text_content()
        print(f'PASS: resources concept status: {status[:90]}')

        await page.fill('[data-testid="resources-search"]', 'zzzz-no-match')
        await page.wait_for_timeout(250)
        print(f'CHECK: empty state shown={await page.locator("[data-testid=resources-empty]").count() > 0}')

        await page.fill('[data-testid="resources-search"]', 'equity')
        await page.wait_for_timeout(250)
        await page.select_option('[data-testid="resources-category"]', 'Equity research report templates')
        await page.wait_for_timeout(250)
        print(f'CHECK: filtered count text={await page.locator("[data-testid=resources-result-count]").text_content()}')

        await page.locator('[data-testid="resource-open-sample-1"]').click()
        await page.wait_for_timeout(700)
        has_notice = await page.locator('[data-testid="resource-sample-notice"]').count() > 0
        has_buy = await page.locator('[data-testid="resource-purchase-button"]').count() > 0
        print(f'CHECK: sample detail notice={has_notice}, buy_button={has_buy}, url={page.url}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.locator('[data-testid="resources-my-downloads"]').click()
        await page.wait_for_timeout(700)
        print(f'CHECK: my downloads unauth route={page.url}')

        await page.fill('[data-testid="login-email-input"]', 'testagent2026@gmail.com')
        await page.fill('[data-testid="login-password-input"]', 'TestPass123!')
        await page.locator('[data-testid="login-submit-button"]').click()
        await page.wait_for_timeout(2800)
        print(f'PASS: post login redirected to {page.url}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/admin-panel?tab=enterprise', wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        if 'login' in page.url:
            await page.fill('[data-testid="login-email-input"]', 'info@valuevade.com')
            await page.fill('[data-testid="login-password-input"]', 'VV-Admin#2026-Sec')
            await page.locator('[data-testid="login-submit-button"]').click()
            await page.wait_for_timeout(2500)
            await page.goto('https://fintech-mvp-38.preview.emergentagent.com/admin-panel?tab=enterprise', wait_until='domcontentloaded')

        await page.wait_for_selector('[data-testid="enterprise-admin-tab"]', timeout=15000)
        print('PASS: admin enterprise tab accessible')
        db = await page.locator('[data-testid="enterprise-database-status"]').text_content()
        email = await page.locator('[data-testid="enterprise-email-status"]').text_content()
        print(f'CHECK: admin setup statuses => {db} | {email}')

        price0 = await page.locator('[data-testid="admin-slab-price-0"]').input_value()
        max3 = await page.locator('[data-testid="admin-slab-max-3"]').input_value()
        await page.fill('[data-testid="admin-slab-price-0"]', str(int(price0)+1))
        await page.locator('[data-testid="admin-pricing-save"]').click(); await page.wait_for_timeout(1200)
        await page.reload(wait_until='domcontentloaded'); await page.wait_for_selector('[data-testid="admin-slab-price-0"]', timeout=12000)
        persisted = await page.locator('[data-testid="admin-slab-price-0"]').input_value()
        print(f'CHECK: temp price persisted={persisted}')

        await page.fill('[data-testid="admin-slab-max-3"]', '900')
        await page.locator('[data-testid="admin-pricing-save"]').click(); await page.wait_for_timeout(900)
        err = await page.locator('[data-testid="enterprise-admin-error"]').text_content()
        print(f'CHECK: invalid slab error={err}')

        await page.fill('[data-testid="admin-slab-price-0"]', price0)
        await page.fill('[data-testid="admin-slab-max-3"]', max3)
        await page.locator('[data-testid="admin-pricing-save"]').click(); await page.wait_for_timeout(1100)
        print('PASS: restored original pricing baseline')

        await page.locator('[data-testid="admin-tab-resources"]').click(); await page.wait_for_timeout(700)
        add_disabled = await page.locator('[data-testid="admin-resource-add"]').is_disabled()
        print(f'CHECK: resources add disabled={add_disabled}')

        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_targeted/automation_output/20261025_074744_fdc9d75fbcb2/landing_390x844.jpeg', type="jpeg", quality=40, full_page=False)
        await page.locator('[data-testid="nav-hamburger"]').click()
        await page.wait_for_selector('[data-testid="mobile-menu-overlay"]', timeout=10000)
        print('PASS: landing mobile menu opens at 390x844')

        for width in [320, 768, 1024, 1440]:
            await page.set_viewport_size({"width": width, "height": 844})
            await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise', wait_until='domcontentloaded')
            await page.wait_for_timeout(500)
            over1 = await page.evaluate("""() => {
                const w = window.innerWidth; let bad = 0;
                document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width>0 && (r.right-w>1 || r.left<-1)) bad++; });
                return bad;
            }""")
            print(f'OVERFLOW enterprise width={width} count={over1}')

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
        print(f"FAIL: targeted UI run failed: {str(e)}")

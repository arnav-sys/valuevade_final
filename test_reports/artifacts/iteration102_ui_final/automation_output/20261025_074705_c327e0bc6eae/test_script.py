async def run_test(page, output_dir, page_url):
    page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))

    async def check_overflow(label):
        overflow = await page.evaluate("""() => {
          const w = window.innerWidth;
          const offenders = [];
          document.querySelectorAll('body *').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right - w > 1 || r.left < -1)) offenders.push(el.getAttribute('data-testid') || el.tagName);
          });
          return offenders.slice(0, 10);
        }""")
        print(f"{label} overflow_count={len(overflow)} sample={overflow}")

    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.evaluate("""() => { localStorage.removeItem('valuevade-audience'); }""")
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="audience-gateway"]', timeout=15000)
        print('PASS: gateway shown on first / visit')
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_ui_final/automation_output/20261025_074705_c327e0bc6eae/landing_1920x800.jpeg', type="jpeg", quality=40, full_page=False)

        await page.locator('[data-testid="choose-student"]').click()
        await page.wait_for_timeout(700)
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.wait_for_timeout(1200)
        print(f'CHECK: student /courses url={page.url}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="student-nav-switch-enterprise"]', timeout=10000)
        await page.locator('[data-testid="student-nav-switch-enterprise"]').click()
        await page.wait_for_timeout(1100)
        print(f'PASS: switched to enterprise; url={page.url}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.wait_for_timeout(900)
        print(f'CHECK: enterprise redirect from /courses -> {page.url}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="enterprise-page"]', timeout=15000)
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_ui_final/automation_output/20261025_074705_c327e0bc6eae/enterprise_1920x800.jpeg', type="jpeg", quality=40, full_page=False)
        print('PASS: enterprise page loaded')

        await page.locator('[data-testid="enterprise-scene-pause"]').click()
        await page.wait_for_timeout(300)
        await page.locator('[data-testid="enterprise-scene-reset"]').click()
        print('PASS: scene controls clickable')

        c1 = await page.locator('[data-testid="workflow-case-study"] blockquote').first.text_content()
        await page.locator('[data-testid="workflow-tab-1"]').click()
        await page.wait_for_timeout(400)
        c2 = await page.locator('[data-testid="workflow-case-study"] blockquote').first.text_content()
        print(f'CHECK: workflow tab content changes={c1 != c2}')

        await page.locator('[data-testid="agents-training-tab"]').click()
        await page.wait_for_timeout(300)
        mode_text = await page.locator('[data-testid="agents-mode-description"]').text_content()
        print(f'PASS: training copy visible: {mode_text[:90]}')

        seat_input = page.locator('[data-testid="enterprise-seat-number"]')
        for n in [1, 10, 11, 50, 51, 200, 201, 1000]:
            await seat_input.fill(str(n))
            await page.wait_for_timeout(220)
            unit = await page.locator('[data-testid="enterprise-unit-price"]').text_content()
            print(f'SEAT {n}: {unit}')

        await seat_input.fill('0')
        await seat_input.blur()
        await page.wait_for_timeout(250)
        low_clamp = await seat_input.input_value()
        await seat_input.fill('2001')
        await seat_input.blur()
        await page.wait_for_timeout(250)
        high_clamp = await seat_input.input_value()
        submit_disabled = await page.locator('[data-testid="enquiry-submit"]').is_disabled()
        print(f'CHECK: clamp_low={low_clamp} clamp_high={high_clamp} submit_disabled={submit_disabled}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="resources-catalog"]', timeout=12000)
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_ui_final/automation_output/20261025_074705_c327e0bc6eae/resources_1920x800.jpeg', type="jpeg", quality=40, full_page=False)
        status_text = await page.locator('[data-testid="resources-status"]').text_content()
        print(f'PASS: resources status banner: {status_text[:110]}')

        await page.fill('[data-testid="resources-search"]', 'zzzz-no-match')
        await page.wait_for_timeout(400)
        empty = await page.locator('[data-testid="resources-empty"]').count() > 0
        print(f'CHECK: resources empty state={empty}')

        await page.fill('[data-testid="resources-search"]', 'dcf')
        await page.wait_for_timeout(400)
        await page.select_option('[data-testid="resources-category"]', 'Excel financial models')
        await page.wait_for_timeout(400)

        await page.locator('[data-testid="resource-open-sample-0"]').click()
        await page.wait_for_timeout(800)
        has_notice = await page.locator('[data-testid="resource-sample-notice"]').count() > 0
        has_buy = await page.locator('[data-testid="resource-purchase-button"]').count() > 0
        print(f'CHECK: sample detail notice={has_notice} purchase_button={has_buy} url={page.url}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.locator('[data-testid="resources-my-downloads"]').click()
        await page.wait_for_timeout(900)
        print(f'CHECK: my downloads logged-out url={page.url}')

        await page.fill('[data-testid="login-email-input"]', 'testagent2026@gmail.com')
        await page.fill('[data-testid="login-password-input"]', 'TestPass123!')
        await page.locator('[data-testid="login-submit-button"]').click()
        await page.wait_for_timeout(3200)
        print(f'PASS: student login result url={page.url}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/login', wait_until='domcontentloaded')
        await page.fill('[data-testid="login-email-input"]', 'info@valuevade.com')
        await page.fill('[data-testid="login-password-input"]', 'VV-Admin#2026-Sec')
        await page.locator('[data-testid="login-submit-button"]').click()
        await page.wait_for_timeout(2600)

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/admin-panel?tab=enterprise', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="enterprise-admin-tab"]', timeout=15000)
        print('PASS: admin enterprise tab loaded')

        orig_price0 = await page.locator('[data-testid="admin-slab-price-0"]').input_value()
        last_max = await page.locator('[data-testid="admin-slab-max-3"]').input_value()
        await page.fill('[data-testid="admin-slab-price-0"]', str(int(orig_price0) + 1))
        await page.locator('[data-testid="admin-pricing-save"]').click()
        await page.wait_for_timeout(1400)

        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="admin-slab-price-0"]', timeout=10000)
        persisted = await page.locator('[data-testid="admin-slab-price-0"]').input_value()
        print(f'CHECK: persisted temporary price={persisted}')

        await page.fill('[data-testid="admin-slab-max-3"]', '900')
        await page.locator('[data-testid="admin-pricing-save"]').click()
        await page.wait_for_timeout(900)
        err = await page.locator('[data-testid="enterprise-admin-error"]').text_content()
        print(f'CHECK: invalid slab error={err}')

        await page.fill('[data-testid="admin-slab-price-0"]', orig_price0)
        await page.fill('[data-testid="admin-slab-max-3"]', last_max)
        await page.locator('[data-testid="admin-pricing-save"]').click()
        await page.wait_for_timeout(1200)
        print('PASS: restored pricing baseline')

        await page.locator('[data-testid="admin-tab-resources"]').click()
        await page.wait_for_selector('[data-testid="resources-admin-tab"]', timeout=10000)
        add_disabled = await page.locator('[data-testid="admin-resource-add"]').is_disabled()
        print(f'CHECK: resources add disabled={add_disabled}')

        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.wait_for_timeout(900)
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_ui_final/automation_output/20261025_074705_c327e0bc6eae/landing_390x844.jpeg', type="jpeg", quality=40, full_page=False)
        await page.locator('[data-testid="nav-hamburger"]').click()
        await page.wait_for_selector('[data-testid="mobile-menu-overlay"]', timeout=9000)
        print('PASS: mobile menu opens at 390x844')

        for width in [320, 768, 1024, 1440]:
            await page.set_viewport_size({"width": width, "height": 844})
            await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise', wait_until='domcontentloaded')
            await page.wait_for_timeout(700)
            await check_overflow(f'enterprise@{width}')
            await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
            await page.wait_for_timeout(700)
            await check_overflow(f'resources@{width}')

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

    except Exception as e:
        print(f"FAIL: UI run failed: {str(e)}")

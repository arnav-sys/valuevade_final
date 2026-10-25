async def run_test(page, output_dir, page_url):
    page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))

    async def overflow_count():
        return await page.evaluate("""() => {
          const w = window.innerWidth; let bad = 0;
          document.querySelectorAll('body *').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right - w > 1 || r.left < -1)) bad += 1;
          });
          return bad;
        }""")

    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.evaluate("""() => { localStorage.removeItem('valuevade-audience'); }""")
        await page.reload(wait_until='domcontentloaded')

        await page.wait_for_selector('[data-testid="audience-gateway"]', timeout=15000)
        print('PASS: gateway shown on / first visit')
        await page.locator('[data-testid="choose-enterprise"]').click()
        await page.wait_for_timeout(1000)
        print(f'CHECK: choose enterprise landed at {page.url}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.wait_for_timeout(800)
        print(f'CHECK: enterprise choice redirects courses to {page.url}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.wait_for_timeout(700)
        print(f'CHECK: enterprise preference persisted on reload to {page.url}')

        await page.locator('[data-testid="business-switch-student"]').click()
        await page.wait_for_timeout(900)
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.wait_for_timeout(900)
        print(f'CHECK: switched back student and /courses url={page.url}')

        # dashboard regression with paid student
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/login', wait_until='domcontentloaded')
        await page.fill('[data-testid="login-email-input"]', 'testagent2026@gmail.com')
        await page.fill('[data-testid="login-password-input"]', 'TestPass123!')
        await page.locator('[data-testid="login-submit-button"]').click()
        await page.wait_for_timeout(2600)
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/dashboard', wait_until='domcontentloaded')
        await page.wait_for_timeout(2000)
        print(f'PASS: paid user dashboard route check url={page.url}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.wait_for_timeout(900)
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_audience_responsive/automation_output/20261025_074905_6ec41924b42a/landing_1920x800.jpeg', type="jpeg", quality=40, full_page=False)

        await page.set_viewport_size({"width": 390, "height": 844})
        await page.wait_for_timeout(500)
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_audience_responsive/automation_output/20261025_074905_6ec41924b42a/landing_390x844.jpeg', type="jpeg", quality=40, full_page=False)
        await page.locator('[data-testid="nav-hamburger"]').click()
        await page.wait_for_selector('[data-testid="mobile-menu-overlay"]', timeout=9000)
        print('PASS: mobile menu opens at 390x844')

        for w in [320, 768, 1024, 1440]:
            await page.set_viewport_size({"width": w, "height": 844})
            await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise', wait_until='domcontentloaded')
            await page.wait_for_timeout(650)
            c1 = await overflow_count()
            await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
            await page.wait_for_timeout(650)
            c2 = await overflow_count()
            print(f'OVERFLOW width={w} enterprise={c1} resources={c2}')

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
        print(f"FAIL: audience/responsive script failed: {str(e)}")

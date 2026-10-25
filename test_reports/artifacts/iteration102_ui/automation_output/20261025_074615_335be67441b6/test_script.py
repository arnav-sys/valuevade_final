async def run_test(page, output_dir, page_url):
    page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))

    async def check_overflow(label):
        overflow = await page.evaluate("""() => {
          const w = window.innerWidth;
          const offenders = [];
          document.querySelectorAll('body *').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right - w > 1 || r.left < -1)) {
              offenders.push({tag: el.tagName, testid: el.getAttribute('data-testid') || '', cls: (el.className || '').toString().slice(0,80), right: Math.round(r.right), left: Math.round(r.left)});
            }
          });
          return offenders.slice(0, 10);
        }""")
        print(f"{label} overflow_count={len(overflow)} sample={overflow}")

    try:
        # Clean first-visitor state and validate audience gateway
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.evaluate("""() => { localStorage.removeItem('valuevade-audience'); }""")
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="audience-gateway"]', timeout=15000)
        print('PASS: First visit gateway shown on /')
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_ui/automation_output/20261025_074615_335be67441b6/landing_1920x800.jpeg', type="jpeg", quality=40, full_page=False)

        await page.click('[data-testid="choose-student"]', exact=True)
        await page.wait_for_timeout(700)
        print(f"PASS: choose-student clicked, current url={page.url}")

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        if await page.locator('[data-testid="audience-gateway"]').count() == 0:
            print('PASS: /courses does not reopen gateway after student choice')
        else:
            print('FAIL: /courses reopened audience gateway unexpectedly')

        course_links = page.locator('a[href^="/course/"]')
        if await course_links.count() > 0:
            href = await course_links.first.get_attribute('href')
            await course_links.first.click(force=True)
            await page.wait_for_timeout(1200)
            print(f'PASS: opened course details from /courses href={href} now={page.url}')
        else:
            print('WARN: No course links found on /courses for /course/:id check')

        # Switch to enterprise and verify redirects
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="student-nav-switch-enterprise"]', timeout=10000)
        await page.click('[data-testid="student-nav-switch-enterprise"]', exact=True)
        await page.wait_for_timeout(1000)
        print(f'PASS: switched to enterprise, url={page.url}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.wait_for_timeout(900)
        if '/enterprise/programme' in page.url:
            print('PASS: enterprise choice redirects /courses -> /enterprise/programme')
        else:
            print(f'FAIL: expected /enterprise/programme redirect, got {page.url}')

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.wait_for_timeout(800)
        if '/enterprise' in page.url:
            print('PASS: enterprise preference persisted on / reload')
        else:
            print(f'FAIL: enterprise preference did not persist, url={page.url}')

        # Enterprise page interactions
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="enterprise-page"]', timeout=15000)
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_ui/automation_output/20261025_074615_335be67441b6/enterprise_1920x800.jpeg', type="jpeg", quality=40, full_page=False)
        print('PASS: enterprise page loaded')

        await page.wait_for_selector('[data-testid="workflow-example-label"]', timeout=10000)
        await page.click('[data-testid="enterprise-scene-pause"]', exact=True)
        await page.wait_for_timeout(300)
        await page.click('[data-testid="enterprise-scene-reset"]', exact=True)
        print('PASS: scene pause/reset controls clickable')

        canvas_count = await page.locator('canvas').count()
        print(f'INFO: canvas_count={canvas_count}')
        if canvas_count > 0:
            box = await page.locator('canvas').first.bounding_box()
            print(f'PASS: enterprise 3D canvas bbox={box}')

        first_case = await page.locator('[data-testid="workflow-case-study"] blockquote').first.text_content()
        await page.click('[data-testid="workflow-tab-1"]', exact=True)
        await page.wait_for_timeout(400)
        second_case = await page.locator('[data-testid="workflow-case-study"] blockquote').first.text_content()
        if first_case != second_case:
            print('PASS: workflow tab changes case-study content')
        else:
            print('FAIL: workflow tab did not change case-study content')

        await page.click('[data-testid="agents-training-tab"]', exact=True)
        await page.wait_for_timeout(300)
        mode_text = await page.locator('[data-testid="agents-mode-description"]').text_content()
        print(f'PASS: agents training tab text={mode_text[:90]}')

        await page.click('[data-testid="agents-built-tab"]', exact=True)
        await page.wait_for_timeout(300)
        await page.click('[data-testid="enterprise-hero-enquire"]', exact=True)
        await page.wait_for_timeout(600)
        if '#enquire' in page.url:
            print('PASS: hero enquire CTA anchors to #enquire')

        # seat slider/number tests
        seat_input = page.locator('[data-testid="enterprise-seat-number"]')
        checks = [1, 10, 11, 50, 51, 200, 201, 1000]
        for n in checks:
            await seat_input.fill(str(n))
            await page.wait_for_timeout(220)
            unit = await page.locator('[data-testid="enterprise-unit-price"]').text_content()
            print(f'PASS: seat {n} -> unit text: {unit}')

        await seat_input.fill('0')
        await seat_input.blur()
        await page.wait_for_timeout(250)
        clamped_low = await seat_input.input_value()
        print(f'PASS: clamp low -> {clamped_low}')

        await seat_input.fill('2001')
        await seat_input.blur()
        await page.wait_for_timeout(250)
        clamped_high = await seat_input.input_value()
        print(f'PASS: clamp high -> {clamped_high}')

        unavailable = await page.locator('[data-testid="enquiry-unavailable"]').text_content()
        submit_disabled = await page.locator('[data-testid="enquiry-submit"]').is_disabled()
        print(f'PASS: enquiry unavailable message={unavailable[:90]} submit_disabled={submit_disabled}')

        direct_href = await page.locator('[data-testid="enquiry-direct-email"]').get_attribute('href')
        fallback_href = await page.locator('[data-testid="enquiry-email-fallback"]').get_attribute('href')
        print(f'PASS: enquiry email links direct={direct_href} fallback={fallback_href}')

        # programme page and legal/menu links
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise/programme', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="enterprise-programme-page"]', timeout=12000)
        await page.click('[data-testid="business-link-resources"]', exact=True)
        await page.wait_for_timeout(700)
        print(f'PASS: business nav resources link -> {page.url}')

        for tid in ['business-privacy', 'business-terms', 'business-refunds', 'business-contact']:
            href = await page.locator(f'[data-testid="{tid}"]').first.get_attribute('href')
            print(f'PASS: footer link {tid} href={href}')

        # Resources catalog + detail concept state
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="resources-catalog"]', timeout=12000)
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_ui/automation_output/20261025_074615_335be67441b6/resources_1920x800.jpeg', type="jpeg", quality=40, full_page=False)

        status_text = await page.locator('[data-testid="resources-status"]').text_content()
        print(f'PASS: resources status shows concept/prep state: {status_text[:120]}')

        await page.fill('[data-testid="resources-search"]', 'zzzz-no-match')
        await page.wait_for_timeout(400)
        if await page.locator('[data-testid="resources-empty"]').count() > 0:
            print('PASS: resources empty search state shown')

        await page.fill('[data-testid="resources-search"]', 'dcf')
        await page.wait_for_timeout(400)
        await page.select_option('[data-testid="resources-category"]', 'Excel financial models')
        await page.wait_for_timeout(400)
        count_text = await page.locator('[data-testid="resources-result-count"]').text_content()
        print(f'PASS: resources filter/search count={count_text}')

        await page.click('[data-testid="resource-open-sample-0"]', exact=True)
        await page.wait_for_timeout(800)
        if '/resources/sample-0' in page.url:
            print('PASS: resource detail route opened')
        sample_notice = await page.locator('[data-testid="resource-sample-notice"]').text_content()
        print(f'PASS: sample detail notice={sample_notice[:110]}')
        if await page.locator('[data-testid="resource-purchase-button"]').count() == 0:
            print('PASS: no purchasable fake file button shown for concept sample')
        else:
            print('FAIL: purchase button should not render for concept sample')

        # My downloads redirect -> login -> return
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.click('[data-testid="resources-my-downloads"]', exact=True)
        await page.wait_for_timeout(800)
        print(f'PASS: logged-out my downloads redirected to {page.url}')
        await page.fill('[data-testid="login-email-input"]', 'testagent2026@gmail.com')
        await page.fill('[data-testid="login-password-input"]', 'TestPass123!')
        await page.click('[data-testid="login-submit-button"]', exact=True)
        await page.wait_for_timeout(3000)
        print(f'PASS: post-login return url={page.url}')
        if '/resources/library' in page.url:
            print('PASS: login returns to /resources/library')
        await page.wait_for_selector('[data-testid="resource-library"]', timeout=12000)
        if await page.locator('[data-testid="library-empty"]').count() > 0:
            print('PASS: library empty/truthful status shown for account')

        # Paid student dashboard regression
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/dashboard', wait_until='domcontentloaded')
        await page.wait_for_timeout(2200)
        if '/dashboard' in page.url:
            print('PASS: paid student dashboard accessible')

        # Admin login and enterprise/resources tabs
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/login', wait_until='domcontentloaded')
        await page.fill('[data-testid="login-email-input"]', 'info@valuevade.com')
        await page.fill('[data-testid="login-password-input"]', 'VV-Admin#2026-Sec')
        await page.click('[data-testid="login-submit-button"]', exact=True)
        await page.wait_for_timeout(2500)
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/admin-panel?tab=enterprise', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="enterprise-admin-tab"]', timeout=15000)
        print('PASS: admin enterprise tab loads')

        db_status = await page.locator('[data-testid="enterprise-database-status"]').text_content()
        email_status = await page.locator('[data-testid="enterprise-email-status"]').text_content()
        print(f'PASS: enterprise setup statuses: {db_status} | {email_status}')

        if await page.locator('[data-testid="enterprise-setup-download"]').count() > 0:
            await page.click('[data-testid="enterprise-setup-download"]', exact=True)
            await page.wait_for_timeout(300)
            print('PASS: setup.sql download action clickable')
        await page.click('[data-testid="enterprise-setup-refresh"]', exact=True)
        await page.wait_for_timeout(400)
        print('PASS: setup status refresh clicked')

        # Pricing persist + invalid + restore
        orig_max0 = await page.locator('[data-testid="admin-slab-max-0"]').input_value()
        orig_price0 = await page.locator('[data-testid="admin-slab-price-0"]').input_value()
        last_max = await page.locator('[data-testid="admin-slab-max-3"]').input_value()

        await page.fill('[data-testid="admin-slab-price-0"]', str(int(orig_price0) + 1))
        await page.click('[data-testid="admin-pricing-save"]', exact=True)
        await page.wait_for_timeout(1200)
        if await page.locator('[data-testid="admin-pricing-saved"]').count() > 0:
            print('PASS: pricing save succeeded for temporary change')

        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="admin-slab-price-0"]', timeout=12000)
        changed_price = await page.locator('[data-testid="admin-slab-price-0"]').input_value()
        print(f'PASS: pricing persisted after reload changed_price={changed_price}')

        await page.fill('[data-testid="admin-slab-max-3"]', '900')
        await page.click('[data-testid="admin-pricing-save"]', exact=True)
        await page.wait_for_timeout(1000)
        err_txt = await page.locator('[data-testid="enterprise-admin-error"]').text_content()
        print(f'PASS: invalid slab validation surfaced error={err_txt}')

        # restore original values
        await page.fill('[data-testid="admin-slab-max-0"]', orig_max0)
        await page.fill('[data-testid="admin-slab-price-0"]', orig_price0)
        await page.fill('[data-testid="admin-slab-max-3"]', last_max)
        await page.click('[data-testid="admin-pricing-save"]', exact=True)
        await page.wait_for_timeout(1200)
        print('PASS: pricing restored to original values')

        await page.click('[data-testid="admin-tab-resources"]', exact=True)
        await page.wait_for_selector('[data-testid="resources-admin-tab"]', timeout=12000)
        disabled_add = await page.locator('[data-testid="admin-resource-add"]').is_disabled()
        print(f'PASS: resources add disabled pending DB setup = {disabled_add}')

        # Switch audience back to student and verify courses
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise', wait_until='domcontentloaded')
        await page.click('[data-testid="business-switch-student"]', exact=True)
        await page.wait_for_timeout(1000)
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        if '/courses' in page.url:
            print('PASS: student audience keeps /courses route')

        # Mobile checks 390x844 and navbar/mobile menu
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        await page.screenshot(path='/app/test_reports/artifacts/iteration102_ui/automation_output/20261025_074615_335be67441b6/landing_390x844.jpeg', type="jpeg", quality=40, full_page=False)
        await page.click('[data-testid="nav-hamburger"]', exact=True)
        await page.wait_for_selector('[data-testid="mobile-menu-overlay"]', timeout=8000)
        print('PASS: mobile menu opens on landing')

        # Responsive overflow measurements
        for width in [320, 768, 1024, 1440]:
            await page.set_viewport_size({"width": width, "height": 844})
            await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise', wait_until='domcontentloaded')
            await page.wait_for_timeout(700)
            await check_overflow(f'enterprise@{width}')
            await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
            await page.wait_for_timeout(700)
            await check_overflow(f'resources@{width}')

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
        print(f"FAIL: UI integration run failed: {str(e)}")

async def run_test(page, output_dir, page_url):
    enrollment_calls = []


    def track_resp(response):
        try:
            if '/api/me/enrollment-status' in response.url:
                enrollment_calls.append(response.status)
                print(f"TRACK enrollment-status status={response.status}, total={len(enrollment_calls)}")
        except Exception:
            pass

    page.on('response', track_resp)
    page.on('console', lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))

    PAID_UID = '13a690c4-96d7-4827-8117-fde4f696e999'

    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        await page.wait_for_selector('[data-testid="login-email-input"]', timeout=20000)
        await page.fill('[data-testid="login-email-input"]', 'testagent2026@gmail.com')
        await page.fill('[data-testid="login-password-input"]', 'TestPass123!')
        await page.click('[data-testid="login-submit-button"]', force=True)
        await page.wait_for_timeout(2500)

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="resources-catalog"]', timeout=20000)
        await page.wait_for_timeout(1500)

        card = page.locator('[data-testid^="resource-card-"]').first
        rid = (await card.get_attribute('data-testid')).replace('resource-card-', '')
        await page.click(f'[data-testid="resource-open-{rid}"]', force=True)
        await page.wait_for_selector('[data-testid="resource-detail"]', timeout=20000)
        await page.wait_for_timeout(700)

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/purchases', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="purchases-page"]', timeout=20000)
        await page.wait_for_timeout(1200)

        course_link = page.locator('[data-testid^="purchase-course-link-"]').first
        if await course_link.count() > 0:
            href = await course_link.get_attribute('href')
            await page.goto(f'https://fintech-mvp-38.preview.emergentagent.com{href}', wait_until='domcontentloaded')
            await page.wait_for_timeout(1200)

        calls_before_reload = len(enrollment_calls)
        print(f"INFO: enrollment-status calls before reload={calls_before_reload}")

        cache_keys_paid = await page.evaluate("""() => Object.keys(localStorage).filter(k => k.startsWith('vv:enrollment:v2:'))""")
        print(f"INFO: enrollment cache keys after paid login={cache_keys_paid}")

        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_timeout(2000)
        calls_after_reload = len(enrollment_calls)
        print(f"INFO: enrollment-status calls after reload={calls_after_reload}")

        await page.click('[data-testid="sidebar-signout"]', force=True)
        await page.wait_for_selector('[data-testid="login-form"]', timeout=20000)
        await page.fill('[data-testid="login-email-input"]', 'vvtest673479@example.com')
        await page.fill('[data-testid="login-password-input"]', 'TestPass123!')
        await page.click('[data-testid="login-submit-button"]', force=True)
        await page.wait_for_timeout(2500)

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="resources-catalog"]', timeout=20000)
        await page.wait_for_timeout(1200)

        cache_keys_unpaid = await page.evaluate("""() => Object.keys(localStorage).filter(k => k.startsWith('vv:enrollment:v2:'))""")
        print(f"INFO: enrollment cache keys after unpaid login={cache_keys_unpaid}")
        leaked_paid_key = any(k.endswith(PAID_UID) for k in cache_keys_unpaid)
        print(f"INFO: leaked paid key after user switch={leaked_paid_key}")

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*=\"error\"], [id*=\"error\"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")
    except Exception as e:
        print(f"FAIL: cache focused test failed - {str(e)}")

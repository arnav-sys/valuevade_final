async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/courses', wait_until='domcontentloaded')
        await page.evaluate("""() => { localStorage.removeItem('valuevade-audience'); }""")
        await page.reload(wait_until='domcontentloaded')
        if await page.locator('[data-testid="audience-gateway"]').count() > 0:
            print('PASS: gateway appears on /courses first visit')
            await page.locator('[data-testid="choose-student"]').click()
            await page.wait_for_timeout(800)
        else:
            print('FAIL: gateway missing on /courses first visit')

        links = page.locator('a[href^="/course/"]')
        if await links.count() > 0:
            href = await links.first.get_attribute('href')
            print(f'INFO: first course href={href}')
            await page.evaluate("""() => { localStorage.removeItem('valuevade-audience'); }""")
            await page.goto(f'https://fintech-mvp-38.preview.emergentagent.com{href}', wait_until='domcontentloaded')
            await page.wait_for_timeout(900)
            show = await page.locator('[data-testid="audience-gateway"]').count() > 0
            print(f'CHECK: gateway on /course/:id first visit={show}')
        else:
            print('WARN: no /course/:id links found')

        # Get error messages using specific selectors
        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

    except Exception as e:
        print(f"FAIL: course gate script failed: {str(e)}")

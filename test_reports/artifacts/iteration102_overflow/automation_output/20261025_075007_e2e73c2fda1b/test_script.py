async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.wait_for_timeout(900)
        await page.locator('[data-testid="mobile-menu-toggle"]').click()
        await page.wait_for_selector('[data-testid="mobile-menu-overlay"]', timeout=9000)
        print('PASS: landing mobile menu opens with LandingNav selector')

        for w in [320, 768, 1024, 1440]:
            await page.set_viewport_size({"width": w, "height": 844})
            await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise', wait_until='domcontentloaded')
            await page.wait_for_timeout(650)
            e = await page.evaluate("""() => {
              const vw = window.innerWidth; let count = 0;
              document.querySelectorAll('body *').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && (r.right - vw > 1 || r.left < -1)) count += 1;
              });
              return count;
            }""")

            await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
            await page.wait_for_timeout(650)
            r = await page.evaluate("""() => {
              const vw = window.innerWidth; let count = 0;
              document.querySelectorAll('body *').forEach(el => {
                const b = el.getBoundingClientRect();
                if (b.width > 0 && (b.right - vw > 1 || b.left < -1)) count += 1;
              });
              return count;
            }""")
            print(f'OVERFLOW width={w}: enterprise={e}, resources={r}')

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
        print(f"FAIL: overflow script failed: {str(e)}")

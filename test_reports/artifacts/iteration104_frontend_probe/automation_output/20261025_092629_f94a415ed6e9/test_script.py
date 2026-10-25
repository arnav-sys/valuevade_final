async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.wait_for_timeout(1200)
        ids = await page.evaluate("""() => Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid'))""")
        mobile_ids = [i for i in ids if 'mobile' in i or 'menu' in i or 'landing' in i or 'nav' in i][:200]
        print(f"Found {len(ids)} testids total")
        print("Sample relevant testids:")
        for i in mobile_ids:
            print(i)
    except Exception as e:
        print(f"Probe failed: {str(e)}")

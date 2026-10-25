async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.wait_for_selector('[data-testid="enterprise-page"]', timeout=15000)
        await page.wait_for_timeout(1000)

        print("C1: precise animated signature check on hero canvas")
        async def signature(tid):
          return await page.evaluate("""(tid) => {
            const c = document.querySelector(`[data-testid="${tid}"]`);
            if (!c) return {ok:false, reason:'missing'};
            const w = c.width || 0, h = c.height || 0;
            if (!w || !h) return {ok:false, reason:'zero-size', w, h};
            const t = document.createElement('canvas');
            t.width = w; t.height = h;
            const ctx = t.getContext('2d', {willReadFrequently:true});
            if (!ctx) return {ok:false, reason:'no-2d'};
            ctx.drawImage(c, 0, 0);
            const data = ctx.getImageData(0,0,w,h).data;
            const pts = [];
            for (let i=0; i<200; i++) {
              const x = (i * 97) % w;
              const y = (i * 57) % h;
              const idx = (y * w + x) * 4;
              pts.push(data[idx], data[idx+1], data[idx+2], data[idx+3]);
            }
            return {ok:true, w, h, sig: pts.join('-')};
          }""", tid)

        s1 = await signature('enterprise-hero-3d-canvas')
        await page.wait_for_timeout(900)
        s2 = await signature('enterprise-hero-3d-canvas')
        print(f"Hero signature changed: {s1.get('sig') != s2.get('sig')}")

        await page.click('[data-testid="enterprise-hero-3d-pause"]', force=True)
        await page.wait_for_timeout(500)
        p1 = await signature('enterprise-hero-3d-canvas')
        await page.wait_for_timeout(900)
        p2 = await signature('enterprise-hero-3d-canvas')
        print(f"Hero signature changed while paused: {p1.get('sig') != p2.get('sig')}")

        print("C2: precise animated signature check on agent workbench canvas")
        a1 = await signature('agent-workbench-3d-canvas')
        await page.wait_for_timeout(900)
        a2 = await signature('agent-workbench-3d-canvas')
        print(f"Workbench signature changed: {a1.get('sig') != a2.get('sig')}")

        print("C3: WebGL blocked fallback diagnostics")
        browser = page.context.browser
        c2 = await browser.new_context(viewport={"width": 1280, "height": 800})
        p2 = await c2.new_page()
        await p2.add_init_script("""() => {
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, attrs){
            if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
              throw new Error('webgl blocked for test');
            }
            return original.call(this, type, attrs);
          };
        }""")
        await p2.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise?view=agents', wait_until='domcontentloaded')
        await p2.wait_for_timeout(1500)
        fallback = await p2.locator('[data-testid="enterprise-hero-3d-fallback"]').count()
        hero_canvas = await p2.locator('[data-testid="enterprise-hero-3d-canvas"]').count()
        img_src = await p2.get_attribute('[data-testid="enterprise-hero-3d-fallback"]', 'src') if fallback else None
        print(f"Blocked-webgl fallback_count={fallback}, canvas_count={hero_canvas}, fallback_src={img_src}")
        await c2.close()

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
        print(f"TEST FAILURE: {str(e)}")

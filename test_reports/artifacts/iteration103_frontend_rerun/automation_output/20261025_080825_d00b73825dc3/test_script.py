async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        console_errors = []
        page.on("console", lambda msg: console_errors.append(f"{msg.type}: {msg.text}") if msg.type in ["error", "warning"] else None)

        print("R1 STEP 1: verify hero/CTA and panel state on direct agents URL")
        await page.wait_for_selector('[data-testid="enterprise-page"]', timeout=15000)
        await page.wait_for_selector('[data-testid="enterprise-agents-panel"]', timeout=10000)
        hero_cta = await page.text_content('[data-testid="enterprise-hero-enquire"]')
        print(f"Agents direct hero CTA: {hero_cta}")

        print("R1 STEP 2: verify in-house CTA scrolls to top tabs")
        await page.click('[data-testid="agents-switch-to-course"]', force=True)
        await page.wait_for_timeout(2200)
        tabs_box = await page.locator('[data-testid="enterprise-offering-tabs"]').bounding_box()
        print(f"Tabs Y after switch + wait: {tabs_box['y'] if tabs_box else None}")

        print("R1 STEP 3: verify course workflow 3D testid exists")
        finance_count = await page.locator('[data-testid="finance-three-canvas"]').count()
        print(f"finance-three-canvas count on course tab: {finance_count}")

        print("R1 STEP 4: verify agents FAQ expand on text")
        await page.click('[data-testid="enterprise-tab-agents"]', force=True)
        await page.wait_for_timeout(400)
        await page.click('[data-testid="agents-faq-question-0"]', force=True)
        await page.wait_for_timeout(400)
        faq_text = await page.text_content('[data-testid="agents-faq-answer-0"]')
        print(f"Agents faq answer 0 length: {len(faq_text or '')}")

        print("R1 STEP 5: robust canvas nonblank + motion checks")
        async def sample_canvas(tid):
          return await page.evaluate("""(tid) => {
            const c = document.querySelector(`[data-testid="${tid}"]`);
            if (!c) return {exists:false};
            const w = c.width || 0, h = c.height || 0;
            if (!w || !h) return {exists:true, width:w, height:h, sum:0, opaque:0, uniq:0};
            const temp = document.createElement('canvas');
            temp.width = w; temp.height = h;
            const ctx2d = temp.getContext('2d', {willReadFrequently:true});
            if (!ctx2d) return {exists:true, width:w, height:h, sum:-1, opaque:-1, uniq:-1};
            try { ctx2d.drawImage(c, 0, 0); } catch (e) { return {exists:true, width:w, height:h, drawError:String(e)}; }
            const d = ctx2d.getImageData(0,0,w,h).data;
            let sum = 0, opaque = 0;
            const colors = new Set();
            const step = Math.max(4, Math.floor(d.length / 12000));
            for (let i=0; i<d.length; i+=step) {
              const r=d[i], g=d[i+1], b=d[i+2], a=d[i+3];
              sum += r+g+b+a;
              if (a>0) opaque++;
              colors.add(`${r},${g},${b},${a}`);
            }
            return {exists:true, width:w, height:h, sum, opaque, uniq:colors.size};
          }""", tid)

        hero_1 = await sample_canvas('enterprise-hero-3d-canvas')
        await page.wait_for_timeout(700)
        hero_2 = await sample_canvas('enterprise-hero-3d-canvas')
        print(f"Hero canvas stats 1={hero_1}")
        print(f"Hero canvas stats 2={hero_2}")
        print(f"Hero frame diff sum={hero_2.get('sum',0)-hero_1.get('sum',0)}")

        await page.click('[data-testid="enterprise-hero-3d-pause"]', force=True)
        await page.wait_for_timeout(600)
        hp_1 = await sample_canvas('enterprise-hero-3d-canvas')
        await page.wait_for_timeout(600)
        hp_2 = await sample_canvas('enterprise-hero-3d-canvas')
        print(f"Paused hero diff sum={hp_2.get('sum',0)-hp_1.get('sum',0)}")

        await page.click('[data-testid="enterprise-tab-agents"]', force=True)
        await page.wait_for_timeout(500)
        aw_1 = await sample_canvas('agent-workbench-3d-canvas')
        await page.wait_for_timeout(700)
        aw_2 = await sample_canvas('agent-workbench-3d-canvas')
        print(f"Agent workbench stats={aw_1}")
        print(f"Agent workbench frame diff sum={aw_2.get('sum',0)-aw_1.get('sum',0)}")

        print("R1 STEP 6: pointer drag + reset")
        box = await page.locator('[data-testid="enterprise-hero-3d-canvas"]').bounding_box()
        if box:
          await page.mouse.move(box['x'] + box['width']*0.35, box['y'] + box['height']*0.5)
          await page.mouse.down()
          await page.mouse.move(box['x'] + box['width']*0.65, box['y'] + box['height']*0.5)
          await page.mouse.up()
          print("Pointer drag done")
        await page.click('[data-testid="enterprise-hero-3d-reset"]', force=True)
        await page.wait_for_timeout(300)
        f1 = await page.get_attribute('[data-testid="enterprise-hero-3d-focus-1"]', 'aria-pressed')
        print(f"After reset focus-1={f1}")

        print("R1 STEP 7: agents pricing no totals + draft semantics")
        total_count = await page.locator('[data-testid="enterprise-total"]').count()
        unit_count = await page.locator('[data-testid="enterprise-unit-price"]').count()
        print(f"Agents tab totals count: {total_count}, unit: {unit_count}")

        await page.fill('[data-testid="enquiry-name"]', 'QA Contact')
        await page.fill('[data-testid="enquiry-email"]', 'qa.contact@example.com')
        await page.fill('[data-testid="enquiry-company"]', 'QA Ventures')
        await page.fill('[data-testid="enquiry-requirements"]', 'Agent workflow scoping for reconciliations and approval checks.')
        await page.check('[data-testid="enquiry-consent"]', force=True)
        await page.click('[data-testid="enquiry-submit"]', force=True)
        await page.wait_for_timeout(800)
        draft_count = await page.locator('[data-testid="enquiry-draft-ready"]').count()
        print(f"Agents draft visible: {draft_count}")
        draft_href = await page.get_attribute('[data-testid="enquiry-send-draft"]', 'href')
        print(f"Draft has scope-based text={ 'scope-based' in (draft_href or '').lower() }")
        print(f"Draft has training estimate text={ 'training%20estimate' in (draft_href or '').lower() }")

        await page.click('[data-testid="enterprise-tab-course"]', force=True)
        await page.wait_for_timeout(400)
        interest_course = await page.input_value('[data-testid="enquiry-interest"]')
        total_course = await page.locator('[data-testid="enterprise-total"]').count()
        print(f"Course interest value={interest_course}, total count={total_course}")

        await page.click('[data-testid="enterprise-tab-agents"]', force=True)
        await page.wait_for_timeout(400)
        contact_retained = {
          "name": await page.input_value('[data-testid="enquiry-name"]'),
          "email": await page.input_value('[data-testid="enquiry-email"]'),
          "company": await page.input_value('[data-testid="enquiry-company"]')
        }
        draft_after_switch = await page.locator('[data-testid="enquiry-draft-ready"]').count()
        print(f"Contact retained={contact_retained}; draft after switch={draft_after_switch}")

        print("R1 STEP 8: canvas cleanup on switches")
        async def canvas_counts():
          return await page.evaluate("""() => ({
            hero: document.querySelectorAll('[data-testid="enterprise-hero-3d-canvas"]').length,
            workbench: document.querySelectorAll('[data-testid="agent-workbench-3d-canvas"]').length,
            finance: document.querySelectorAll('[data-testid="finance-three-canvas"]').length,
            all: document.querySelectorAll('canvas').length
          })""")
        c_before = await canvas_counts()
        for _ in range(4):
          await page.click('[data-testid="enterprise-tab-course"]', force=True)
          await page.wait_for_timeout(180)
          await page.click('[data-testid="enterprise-tab-agents"]', force=True)
          await page.wait_for_timeout(180)
        c_after = await canvas_counts()
        print(f"Canvas counts before={c_before}, after={c_after}")

        print("R1 STEP 9: responsive overflow checks + mobile screenshot")
        widths = [320,390,768,1024,1440,1920]
        over = []
        for w in widths:
          await page.set_viewport_size({"width": w, "height": 844 if w <= 390 else 900})
          await page.wait_for_timeout(300)
          rep = await page.evaluate("""() => {
            const doc = document.documentElement.scrollWidth > window.innerWidth + 1;
            const offenders = Array.from(document.querySelectorAll('[data-testid], section, form'))
              .map(el => ({el, r: el.getBoundingClientRect()}))
              .filter(x => x.r.width > window.innerWidth + 1)
              .slice(0, 6)
              .map(x => ({testid: x.el.getAttribute('data-testid') || '', width: Math.round(x.r.width)}));
            return {doc, offenders};
          }""")
          over.append({"w":w, "doc":rep['doc'], "off":rep['offenders']})
        print(f"Overflow summary={over}")

        await page.set_viewport_size({"width": 390, "height": 844})
        await page.wait_for_timeout(500)
        await page.screenshot(path="/app/test_reports/artifacts/iteration103_frontend_rerun/automation_output/20261025_080825_d00b73825dc3/enterprise_mobile_390x844.jpeg", type="jpeg", quality=40, full_page=False)
        print("Mobile screenshot saved")

        print("R1 STEP 10: reduced motion static check")
        await page.emulate_media(reduced_motion='reduce')
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise?view=agents', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="enterprise-page"]', timeout=12000)
        await page.wait_for_timeout(800)
        rm1 = await sample_canvas('enterprise-hero-3d-canvas')
        await page.wait_for_timeout(800)
        rm2 = await sample_canvas('enterprise-hero-3d-canvas')
        print(f"Reduced motion frame diff sum={rm2.get('sum',0)-rm1.get('sum',0)}")

        print("R1 STEP 11: WebGL fallback in isolated page")
        browser = page.context.browser
        c2 = await browser.new_context(viewport={"width":1280,"height":800})
        p2 = await c2.new_page()
        await p2.add_init_script("""() => {
          const orig = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, attrs){
            if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
            return orig.call(this, type, attrs);
          }
        }""")
        await p2.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise?view=agents', wait_until='domcontentloaded')
        await p2.wait_for_timeout(1200)
        fb = await p2.locator('[data-testid="enterprise-hero-3d-fallback"]').count()
        print(f"Fallback count with webgl blocked={fb}")
        await c2.close()

        print("R1 STEP 12: regression routes")
        await page.emulate_media(reduced_motion='no-preference')
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise/programme', wait_until='domcontentloaded')
        await page.wait_for_timeout(700)
        print(f"Programme url={page.url}")
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.wait_for_timeout(700)
        print(f"Resources url={page.url}")
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.wait_for_timeout(700)
        print(f"Home url={page.url}")

        print("R1 STEP 13: console + error text probe")
        severe = [x for x in console_errors if x.startswith('error') or 'TypeError' in x]
        print(f"Console warnings/errors count={len(console_errors)} severe={len(severe)}")
        if severe:
          print(f"Severe sample={severe[:5]}")

        # Get error messages using specific selectors
        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
          print(f"Found error message: {error_text}")
        else:
          print("No error messages found on the page")

        print("RERUN SCRIPT COMPLETE")

    except Exception as e:
        print(f"TEST FAILURE: {str(e)}")

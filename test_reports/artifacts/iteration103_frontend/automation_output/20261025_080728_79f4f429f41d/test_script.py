async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        console_errors = []
        page.on("console", lambda msg: console_errors.append(f"{msg.type}: {msg.text}") if msg.type in ["error", "warning"] else None)

        print("STEP 1: Load enterprise page")
        await page.wait_for_selector('[data-testid="enterprise-page"]', timeout=15000)
        await page.wait_for_selector('[data-testid="enterprise-offering-tabs"]', timeout=8000)
        await page.wait_for_timeout(800)
        await page.screenshot(path="/app/test_reports/artifacts/iteration103_frontend/automation_output/20261025_080728_79f4f429f41d/enterprise_desktop_1920x800.jpeg", type="jpeg", quality=40, full_page=False)
        print("PASS: Enterprise page loaded and desktop screenshot captured")

        print("STEP 2: Verify lavender background")
        bg = await page.evaluate("""() => {
          const el = document.querySelector('.business-landing');
          return el ? getComputedStyle(el).backgroundColor : null;
        }""")
        print(f"Background color: {bg}")

        print("STEP 3: Tab mouse + keyboard + URL persistence")
        await page.click('[data-testid="enterprise-tab-course"]', force=True)
        await page.wait_for_timeout(300)
        await page.click('[data-testid="enterprise-tab-agents"]', force=True)
        await page.wait_for_timeout(400)
        current_url = page.url
        print(f"After agents click URL: {current_url}")

        await page.reload()
        await page.wait_for_selector('[data-testid="enterprise-agents-panel"]', timeout=10000)
        print(f"After reload URL: {page.url}")

        await page.click('[data-testid="enterprise-tab-course"]', force=True)
        await page.wait_for_timeout(300)
        await page.go_back()
        await page.wait_for_timeout(600)
        print(f"After back URL: {page.url}")

        await page.focus('[data-testid="enterprise-tab-course"]')
        await page.keyboard.press('ArrowRight')
        await page.wait_for_timeout(300)
        print(f"After ArrowRight URL: {page.url}")

        print("STEP 4: Ensure panel exclusivity")
        await page.click('[data-testid="enterprise-tab-course"]', force=True)
        await page.wait_for_timeout(300)
        course_visible = await page.is_visible('[data-testid="enterprise-course-panel"]')
        agents_visible_course = await page.is_visible('[data-testid="enterprise-agents-panel"]')
        print(f"Course visible={course_visible}, Agents panel visible on course tab={agents_visible_course}")

        await page.click('[data-testid="enterprise-tab-agents"]', force=True)
        await page.wait_for_timeout(300)
        agents_visible = await page.is_visible('[data-testid="enterprise-agents-panel"]')
        print(f"Agents panel visible={agents_visible}")

        print("STEP 5: Hero copy + CTA checks")
        intro_text = await page.text_content('[data-testid="enterprise-offering-intro"]')
        print(f"Agents intro snippet: {intro_text[:160]}")
        cta_text = await page.text_content('[data-testid="enterprise-hero-enquire"]')
        print(f"Agents CTA: {cta_text}")

        print("STEP 6: Agents selector updates exact details/case")
        expected_titles = ['Deep FP&A', 'Bookkeeping', 'Excel-native governance']
        for idx, title in enumerate(expected_titles):
          await page.click(f'[data-testid="agent-product-{idx}"]', force=True)
          await page.wait_for_timeout(350)
          selected = await page.text_content('[data-testid="selected-agent-title"]')
          case_text = await page.text_content('[data-testid="selected-agent-case"]')
          print(f"Agent {idx}: selected={selected}; case={case_text[:90]}")

        print("STEP 7: In-house CTA switches to course and top")
        await page.click('[data-testid="agents-switch-to-course"]', force=True)
        await page.wait_for_timeout(700)
        print(f"After switch CTA URL: {page.url}")
        top_tabs_box = await page.locator('[data-testid="enterprise-offering-tabs"]').bounding_box()
        print(f"Top tabs Y after switch: {top_tabs_box['y'] if top_tabs_box else 'missing'}")

        print("STEP 8: Course anchor not hidden under header")
        await page.click('[data-testid="enterprise-hero-explore"]', force=True)
        await page.wait_for_timeout(900)
        curriculum_top = await page.evaluate("""() => {
          const el = document.querySelector('[data-testid="course-curriculum"]');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {top: r.top, bottom: r.bottom};
        }""")
        print(f"Curriculum rect after anchor scroll: {curriculum_top}")

        print("STEP 9: FAQ accordion interactions")
        await page.click('[data-testid="course-faq-question-0"]', force=True)
        await page.wait_for_timeout(250)
        answer_course = await page.text_content('[data-testid="course-faq-answer-0"]')
        print(f"Course FAQ opened: {answer_course[:100]}")

        await page.click('[data-testid="enterprise-tab-agents"]', force=True)
        await page.wait_for_timeout(300)
        await page.click('[data-testid="agents-faq-question-0"]', force=True)
        await page.wait_for_timeout(250)
        answer_agents = await page.text_content('[data-testid="agents-faq-answer-0"]')
        print(f"Agents FAQ opened: {answer_agents[:110]}")

        print("STEP 10: 3D canvas nonblank and frame motion checks")
        async def canvas_stats(testid):
          return await page.evaluate("""(tid) => {
            const canvas = document.querySelector(`[data-testid="${tid}"]`);
            if (!canvas) return {exists:false};
            const w = canvas.width || 0, h = canvas.height || 0;
            if (!w || !h) return {exists:true, width:w, height:h, opaque:0, unique:0, sum:0};
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const data = ctx.getImageData(0,0,w,h).data;
            let opaque = 0, sum = 0;
            const colors = new Set();
            const step = Math.max(4, Math.floor(data.length / 15000));
            for (let i=0; i<data.length; i+=step) {
              const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3];
              if (a > 0) opaque++;
              sum += r+g+b+a;
              colors.add(`${r},${g},${b},${a}`);
            }
            return {exists:true, width:w, height:h, opaque, unique:colors.size, sum};
          }""", testid)

        hero_before = await canvas_stats('enterprise-hero-3d-canvas')
        await page.wait_for_timeout(800)
        hero_after = await canvas_stats('enterprise-hero-3d-canvas')
        print(f"Hero canvas stats before={hero_before}; after={hero_after}; diff={hero_after.get('sum',0)-hero_before.get('sum',0)}")

        await page.click('[data-testid="enterprise-hero-3d-pause"]', force=True)
        await page.wait_for_timeout(700)
        paused_1 = await canvas_stats('enterprise-hero-3d-canvas')
        await page.wait_for_timeout(700)
        paused_2 = await canvas_stats('enterprise-hero-3d-canvas')
        print(f"Paused canvas diff={paused_2.get('sum',0)-paused_1.get('sum',0)}")

        canvas_loc = page.locator('[data-testid="enterprise-hero-3d-canvas"]')
        box = await canvas_loc.bounding_box()
        if box:
          await page.mouse.move(box['x'] + box['width'] * 0.4, box['y'] + box['height'] * 0.5)
          await page.mouse.down()
          await page.mouse.move(box['x'] + box['width'] * 0.65, box['y'] + box['height'] * 0.5)
          await page.mouse.up()
          await page.wait_for_timeout(300)
          print("Performed pointer drag on hero canvas")

        await page.click('[data-testid="enterprise-hero-3d-reset"]', force=True)
        await page.wait_for_timeout(350)
        focus_pressed = await page.get_attribute('[data-testid="enterprise-hero-3d-focus-1"]', 'aria-pressed')
        print(f"After reset, focus-1 aria-pressed={focus_pressed}")

        await page.click('[data-testid="enterprise-tab-agents"]', force=True)
        await page.wait_for_timeout(500)
        agent_canvas_1 = await canvas_stats('agent-workbench-3d-canvas')
        await page.wait_for_timeout(700)
        agent_canvas_2 = await canvas_stats('agent-workbench-3d-canvas')
        print(f"Agent workbench canvas stats={agent_canvas_1}; diff={agent_canvas_2.get('sum',0)-agent_canvas_1.get('sum',0)}")

        finance_canvas_exists = await page.locator('[data-testid="finance-three-canvas"]').count()
        print(f"Course workflow finance-three-canvas count (agents tab): {finance_canvas_exists}")

        print("STEP 11: Pricing/form behavior by tab")
        # Agents tab should not show training total
        total_on_agents = await page.locator('[data-testid="enterprise-total"]').count()
        unit_on_agents = await page.locator('[data-testid="enterprise-unit-price"]').count()
        print(f"Agents tab totals count: total={total_on_agents}, unit={unit_on_agents}")

        await page.fill('[data-testid="enquiry-name"]', 'QA Enterprise')
        await page.fill('[data-testid="enquiry-email"]', 'qa.enterprise@example.com')
        await page.fill('[data-testid="enquiry-company"]', 'Valuevade QA')
        await page.select_option('[data-testid="enquiry-interest"]', 'agents')
        await page.fill('[data-testid="enquiry-requirements"]', 'We need workflow scoping for monthly variance analysis and review queues.')
        await page.check('[data-testid="enquiry-consent"]', force=True)
        interest_value_agents = await page.input_value('[data-testid="enquiry-interest"]')
        print(f"Agents tab interest value before submit: {interest_value_agents}")

        await page.click('[data-testid="enquiry-submit"]', force=True)
        await page.wait_for_timeout(700)
        draft_visible = await page.locator('[data-testid="enquiry-draft-ready"]').count()
        print(f"Draft visible after agents submit: {draft_visible}")

        draft_href = await page.get_attribute('[data-testid="enquiry-send-draft"]', 'href')
        print(f"Draft href contains interest agents: {'Interest%3A%20agents' in (draft_href or '')}")
        print(f"Draft href contains training estimate text: {'Training%20estimate' in (draft_href or '')}")

        await page.fill('[data-testid="enquiry-requirements"]', 'Updated requirement text to clear draft state.')
        await page.wait_for_timeout(300)
        draft_after_edit = await page.locator('[data-testid="enquiry-draft-ready"]').count()
        print(f"Draft visible after editing form: {draft_after_edit}")

        await page.click('[data-testid="enterprise-tab-course"]', force=True)
        await page.wait_for_timeout(500)
        interest_on_course = await page.input_value('[data-testid="enquiry-interest"]')
        print(f"Interest auto on course tab: {interest_on_course}")
        total_on_course = await page.locator('[data-testid="enterprise-total"]').count()
        print(f"Course tab training total count: {total_on_course}")

        await page.click('[data-testid="enterprise-tab-agents"]', force=True)
        await page.wait_for_timeout(500)
        name_retained = await page.input_value('[data-testid="enquiry-name"]')
        email_retained = await page.input_value('[data-testid="enquiry-email"]')
        company_retained = await page.input_value('[data-testid="enquiry-company"]')
        draft_after_tab_switch = await page.locator('[data-testid="enquiry-draft-ready"]').count()
        print(f"Retained contact fields: {name_retained}, {email_retained}, {company_retained}; draft visible={draft_after_tab_switch}")

        print("STEP 12: Canvas resource cleanup under repeated tab switching")
        async def count_canvases():
          return await page.evaluate("""() => ({
            hero: document.querySelectorAll('[data-testid="enterprise-hero-3d-canvas"]').length,
            workbench: document.querySelectorAll('[data-testid="agent-workbench-3d-canvas"]').length,
            finance: document.querySelectorAll('[data-testid="finance-three-canvas"]').length,
            allCanvas: document.querySelectorAll('canvas').length
          })""")

        before_switch = await count_canvases()
        for _ in range(3):
          await page.click('[data-testid="enterprise-tab-course"]', force=True)
          await page.wait_for_timeout(250)
          await page.click('[data-testid="enterprise-tab-agents"]', force=True)
          await page.wait_for_timeout(250)
        after_switch = await count_canvases()
        print(f"Canvas counts before={before_switch} after={after_switch}")

        print("STEP 13: Responsive overflow checks 320/390/768/1024/1440/1920")
        widths = [320, 390, 768, 1024, 1440, 1920]
        overflow_report = []
        for w in widths:
          h = 844 if w <= 390 else 900
          await page.set_viewport_size({"width": w, "height": h})
          await page.wait_for_timeout(350)
          report = await page.evaluate("""() => {
            const overflow = [];
            if (document.documentElement.scrollWidth > window.innerWidth + 1) {
              overflow.push({type:'doc', scrollWidth:document.documentElement.scrollWidth, innerWidth:window.innerWidth});
            }
            const candidates = Array.from(document.querySelectorAll('section,div,article,main,form')).filter(el => {
              const r = el.getBoundingClientRect();
              return r.width > window.innerWidth + 1;
            }).slice(0,8).map(el => ({
              tag: el.tagName,
              testid: el.getAttribute('data-testid') || '',
              width: Math.round(el.getBoundingClientRect().width)
            }));
            return {docOverflow: document.documentElement.scrollWidth > window.innerWidth + 1, offenders: candidates};
          }""")
          overflow_report.append({"width": w, "report": report})
        print(f"Overflow report: {overflow_report}")

        await page.set_viewport_size({"width": 390, "height": 844})
        await page.wait_for_timeout(600)
        await page.screenshot(path="/app/test_reports/artifacts/iteration103_frontend/automation_output/20261025_080728_79f4f429f41d/enterprise_mobile_390x844.jpeg", type="jpeg", quality=40, full_page=False)
        print("PASS: Mobile screenshot captured")

        print("STEP 14: Reduced motion static rendering check")
        await page.emulate_media(reduced_motion="reduce")
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise?view=agents', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="enterprise-page"]', timeout=12000)
        await page.wait_for_timeout(900)
        reduced_1 = await page.evaluate("""() => {
          const canvas = document.querySelector('[data-testid="enterprise-hero-3d-canvas"]');
          if (!canvas) return null;
          const ctx = canvas.getContext('2d', {willReadFrequently:true});
          const d = ctx.getImageData(0,0,canvas.width,canvas.height).data;
          let s=0; for (let i=0;i<d.length;i+=64){ s += d[i]+d[i+1]+d[i+2]+d[i+3]; }
          return s;
        }""")
        await page.wait_for_timeout(900)
        reduced_2 = await page.evaluate("""() => {
          const canvas = document.querySelector('[data-testid="enterprise-hero-3d-canvas"]');
          if (!canvas) return null;
          const ctx = canvas.getContext('2d', {willReadFrequently:true});
          const d = ctx.getImageData(0,0,canvas.width,canvas.height).data;
          let s=0; for (let i=0;i<d.length;i+=64){ s += d[i]+d[i+1]+d[i+2]+d[i+3]; }
          return s;
        }""")
        print(f"Reduced motion frame sums: {reduced_1} vs {reduced_2}; diff={None if reduced_1 is None or reduced_2 is None else reduced_2-reduced_1}")

        print("STEP 15: WebGL unavailable fallback check (new page context)")
        context2 = await page.context.browser.new_context(viewport={"width": 1280, "height": 800})
        p2 = await context2.new_page()
        await p2.add_init_script("""() => {
          const originalGetContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, attrs) {
            if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
              return null;
            }
            return originalGetContext.call(this, type, attrs);
          };
        }""")
        await p2.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise?view=agents', wait_until='domcontentloaded')
        await p2.wait_for_timeout(1200)
        fallback_count = await p2.locator('[data-testid="enterprise-hero-3d-fallback"]').count()
        print(f"Fallback image count with blocked WebGL: {fallback_count}")
        await context2.close()

        print("STEP 16: Route regressions /enterprise/programme, /resources, /")
        await page.emulate_media(reduced_motion="no-preference")
        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/enterprise/programme', wait_until='domcontentloaded')
        await page.wait_for_timeout(800)
        programme_ok = '/enterprise/programme' in page.url
        print(f"Programme route ok: {programme_ok}, url={page.url}")

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/resources', wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        resources_url_ok = '/resources' in page.url
        print(f"Resources route url ok: {resources_url_ok}, url={page.url}")

        await page.goto('https://fintech-mvp-38.preview.emergentagent.com/', wait_until='domcontentloaded')
        await page.wait_for_timeout(900)
        home_url_ok = page.url.endswith('/') or page.url.endswith('/enterprise') or '/?' in page.url
        print(f"Home route reachable: {home_url_ok}, url={page.url}")

        print("STEP 17: Console issues summary")
        severe = [x for x in console_errors if x.startswith('error') or 'TypeError' in x or 'WebGL' in x]
        print(f"Console warnings/errors captured: {len(console_errors)}")
        print(f"Severe subset count: {len(severe)}")
        if severe:
          print(f"Severe sample: {severe[:5]}")

        # Get error messages using specific selectors
        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
          print(f"Found error message: {error_text}")
        else:
          print("No error messages found on the page")

        print("FRONTEND TEST SCRIPT COMPLETED")

    except Exception as e:
        print(f"TEST FAILURE: {str(e)}")

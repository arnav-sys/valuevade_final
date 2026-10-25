async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.wait_for_selector('[data-testid="enterprise-page"]', timeout=12000)
        await page.wait_for_timeout(600)

        print("M1: agents explore anchor offset")
        await page.click('[data-testid="enterprise-hero-explore"]', force=True)
        await page.wait_for_timeout(900)
        anchor_rect = await page.evaluate("""() => {
          const el = document.querySelector('#agent-products');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {top:r.top, bottom:r.bottom};
        }""")
        print(f"Agent products anchor rect after click: {anchor_rect}")

        print("M2: workbench animation after scrolling into viewport")
        await page.locator('[data-testid="agent-workbench"]').scroll_into_view_if_needed()
        await page.wait_for_timeout(700)
        async def sig():
          return await page.evaluate("""() => {
            const c = document.querySelector('[data-testid="agent-workbench-3d-canvas"]');
            if (!c) return null;
            const w=c.width||0,h=c.height||0;
            const t=document.createElement('canvas'); t.width=w; t.height=h;
            const ctx=t.getContext('2d',{willReadFrequently:true}); if(!ctx) return null;
            ctx.drawImage(c,0,0);
            const d=ctx.getImageData(0,0,w,h).data;
            const out=[];
            for(let i=0;i<180;i++){const x=(i*43)%w,y=(i*71)%h,idx=(y*w+x)*4;out.push(d[idx],d[idx+1],d[idx+2],d[idx+3]);}
            return out.join('-');
          }""")
        s1 = await sig()
        await page.wait_for_timeout(1000)
        s2 = await sig()
        print(f"Workbench signature changed in-view: {s1 != s2}")

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

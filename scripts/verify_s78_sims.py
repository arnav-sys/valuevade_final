#!/usr/bin/env python3
"""Verify S7 and S8 document simulations."""
import json, urllib.request

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

def get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SR, "Authorization": f"Bearer {SR}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def verify(session_id, label):
    print(f"\n{'='*70}\n{label}\n{'='*70}")
    sims = get(f"master_simulations?session_id=eq.{session_id}&select=*")
    assert len(sims) == 1, f"Expected 1, got {len(sims)}"
    sim = sims[0]
    cfg = sim["config"]
    doc = cfg["document_data"]
    print(f"Title: {sim['title']}")
    print(f"sim_type: {sim['sim_type']}")
    print(f"document.company_name: {doc['company_name']}")

    print(f"\nSections ({len(doc['sections'])}):")
    all_line_ids = set()
    for s in doc["sections"]:
        items = s.get("line_items", [])
        ids = [it["id"] for it in items]
        all_line_ids.update(ids)
        has_total = bool(s.get("section_total"))
        print(f"  · {s['title']:50s} | {len(items)} lines | total={has_total}")
        for it in items:
            for k in ("id", "label", "current_year", "previous_year"):
                assert k in it, f"line item missing {k}: {it}"

    print(f"\nHighlights ({len(cfg['interactive_highlights'])}):")
    for h in cfg["interactive_highlights"]:
        ok = h["id"] in all_line_ids
        print(f"  · {h['id']:25s} match={ok}")
        assert ok, f"highlight id {h['id']} not in line ids"

    print(f"\nTasks ({len(cfg['tasks'])}):")
    for t in cfg["tasks"]:
        at = t.get("answer_type")
        if at == "number":
            ev = f"{t['expected_value']} ± {t['tolerance']} {t.get('unit','')}"
        elif at == "text":
            ev = f"keywords={t.get('expected_keywords')}"
        else:
            ev = "(free text)"
        has_expl = bool(t.get("explanation") or t.get("sample_answer"))
        print(f"  · {t['id']:32s} | {at:10s} | {ev}  expl={has_expl}")
        assert has_expl

    print("\nALL CHECKS PASSED ✓")


# S7
verify("9559a9ba-a909-4f8c-9346-4219bf23852a", "S7 — Balance Sheet (TitanWorks)")
# Manual numerical cross-check S7
print("\n--- S7 numeric self-checks ---")
print(f"  CR 14089/7500 = {14089/7500:.4f} (expect ≈1.88)")
print(f"  QR (14089-9200)/7500 = {(14089-9200)/7500:.4f} (expect ≈0.65)")
print(f"  D/E 1600/11489 = {1600/11489:.4f} (expect ≈0.14)")
print(f"  Net Debt 1600-(1800+500) = {1600-(1800+500)} (expect -700)")
print(f"  NWC 14089-7500 = {14089-7500} (expect 6589)")
print(f"  BVPS 11489/89 = {11489/89:.2f} (expect ≈129.1)")
print(f"  Inv days (9200/17000)*365 = {(9200/17000)*365:.1f} (expect ≈197)")
print(f"  Cap Employed 22089-7500 = {22089-7500} (expect 14589)")

# S8
verify("4af45899-19ee-4ab1-bb85-92b29c995557", "S8 — Cash Flow (RangoorPaints)")
print("\n--- S8 numeric self-checks ---")
print(f"  Op profit before WC 4200+1200+180+1420-350 = {4200+1200+180+1420-350} (expect 6650)")
print(f"  Cash from ops 6650-800-250+600-120+200 = {6650-800-250+600-120+200} (expect 6280)")
print(f"  Net CFO 6280-1500 = {6280-1500} (expect 4780)")
print(f"  CFI -1800+50-2500+1800-400+220+50 = {-1800+50-2500+1800-400+220+50} (expect -2580)")
print(f"  CFF 500-800-200-200-1400-350 = {500-800-200-200-1400-350} (expect -2450)")
print(f"  Net change 4780+(-2580)+(-2450) = {4780-2580-2450} (expect -250)")
print(f"  Closing cash 2050+(-250) = {2050-250} (expect 1800)")
print(f"  CFO/PAT 4780/4200 = {4780/4200:.4f} (expect ≈1.14)")
print(f"  FCF 4780-1800 = {4780-1800} (expect 2980)")
print(f"  Net WC -800-250+600-120+200 = {-800-250+600-120+200} (expect -370)")
print(f"  FCF Yield 2980/70000 = {(2980/70000)*100:.4f}% (expect ≈4.3)")

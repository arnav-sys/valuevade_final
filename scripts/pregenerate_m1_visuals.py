#!/usr/bin/env python3
"""
Pre-generate visual card images for all sessions in Module 1 and persist them
into Supabase (master_notes_cards.content.image_url) so the user never sees a
"Generating visual..." spinner.

Mirrors the client-side prompt-building logic in NotesPage.jsx (VisualCard):
  - title:        master_notes_cards.title (top-level)
  - description:  walks content tree, picks up to 4 strings >20 chars, joins
                  and truncates to 600 chars.

Idempotent: skips cards that already have content.image_url or content.svg_content.

Usage:
  python3 scripts/pregenerate_m1_visuals.py
  python3 scripts/pregenerate_m1_visuals.py --module-order 1
  python3 scripts/pregenerate_m1_visuals.py --force          # re-generate even if cached
  python3 scripts/pregenerate_m1_visuals.py --card <card_id> # single card
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SUP = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"
BACKEND = os.environ.get("BACKEND_URL") or "http://localhost:8001"


def sb(method, path, body=None):
    url = f"{SUP}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data, headers={
        "apikey": SR,
        "Authorization": f"Bearer {SR}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        text = resp.read().decode()
        return json.loads(text) if text else None


def harvest_description(content):
    """Mirror NotesPage.jsx VisualCard promptDescription logic."""
    if not isinstance(content, dict):
        return ""
    desc = content.get("description")
    if isinstance(desc, str) and desc.strip():
        return desc.strip()[:600]
    parts = []

    def walk(v, depth=0):
        if depth > 3 or len(parts) > 8:
            return
        if isinstance(v, str):
            if len(v.strip()) > 20:
                parts.append(v.strip())
        elif isinstance(v, list):
            for item in v:
                walk(item, depth + 1)
        elif isinstance(v, dict):
            for val in v.values():
                walk(val, depth + 1)

    walk(content)
    return " ".join(parts[:4])[:600]


def generate_visual(card_id, title, description):
    """Call backend /api/visual/generate. Returns data URL (base64)."""
    url = f"{BACKEND}/api/visual/generate"
    body = json.dumps({
        "card_id": card_id,
        "title": title or "",
        "description": description or "",
    }).encode()
    req = urllib.request.Request(url, method="POST", data=body, headers={
        "Content-Type": "application/json",
    })
    # Image generation can take 30-60s.
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())
        return data["image_url"]


def find_module(order_index):
    mods = sb("GET", f"master_modules?select=id,title,order_index&order_index=eq.{order_index}")
    if not mods:
        raise SystemExit(f"No module with order_index={order_index}")
    return mods[0]


def list_visual_cards_for_module(module_id):
    sessions = sb("GET", f"master_sessions?select=id,order_index,title&module_id=eq.{module_id}&order=order_index")
    if not sessions:
        return []
    sid_csv = ",".join(s["id"] for s in sessions)
    cards = sb("GET",
        "master_notes_cards"
        "?select=id,session_id,card_type,content,title,order_index"
        f"&card_type=eq.visual&session_id=in.({sid_csv})"
    )
    sess_meta = {s["id"]: s for s in sessions}
    for c in cards:
        c["_session"] = sess_meta.get(c["session_id"])
    return cards


def update_card_image(card_id, content, image_url):
    new_content = dict(content or {})
    new_content["image_url"] = image_url
    sb("PATCH", f"master_notes_cards?id=eq.{card_id}", body={"content": new_content})


def process_card(card, force=False):
    cid = card["id"]
    content = card.get("content") or {}
    title = card.get("title") or content.get("title") or "Finance concept"
    sess = card.get("_session") or {}
    label = f"S{sess.get('order_index','?')} '{sess.get('title','?')}' / card {cid[:8]}"

    if not force:
        if content.get("image_url"):
            print(f"  [skip] {label} — already has image_url")
            return "skipped"
        if content.get("svg_content"):
            print(f"  [skip] {label} — has svg_content")
            return "skipped"

    description = harvest_description(content)
    print(f"  [gen ] {label}")
    print(f"          title: {title[:80]}")
    print(f"          desc : {description[:80]}{'...' if len(description) > 80 else ''}")

    t0 = time.time()
    try:
        image_url = generate_visual(cid, title, description)
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:300]
        print(f"  [FAIL] {label} — HTTP {e.code}: {body}")
        return "failed"
    except Exception as e:
        print(f"  [FAIL] {label} — {e}")
        return "failed"

    elapsed = time.time() - t0
    size_kb = len(image_url) / 1024
    print(f"          generated in {elapsed:.1f}s, {size_kb:.0f} KB data URL")

    try:
        update_card_image(cid, content, image_url)
        print(f"          [saved] image_url persisted to master_notes_cards")
        return "ok"
    except Exception as e:
        print(f"  [FAIL] {label} — DB update failed: {e}")
        return "failed"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--module-order", type=int, default=1, help="module order_index (default: 1)")
    ap.add_argument("--card", type=str, default=None, help="single card_id to (re)generate")
    ap.add_argument("--force", action="store_true", help="regenerate even if image_url exists")
    args = ap.parse_args()

    if args.card:
        card_rows = sb("GET", f"master_notes_cards?select=*&id=eq.{args.card}")
        if not card_rows:
            raise SystemExit(f"Card {args.card} not found")
        cards = card_rows
        cards[0]["_session"] = {}
    else:
        mod = find_module(args.module_order)
        print(f"Module: {mod['title']} ({mod['id']})")
        cards = list_visual_cards_for_module(mod["id"])
        cards.sort(key=lambda c: ((c.get("_session") or {}).get("order_index", 0), c.get("order_index", 0)))
        print(f"Visual cards found: {len(cards)}")

    counts = {"ok": 0, "skipped": 0, "failed": 0}
    for i, c in enumerate(cards, 1):
        print(f"\n[{i}/{len(cards)}]")
        result = process_card(c, force=args.force)
        counts[result] = counts.get(result, 0) + 1
        # Small delay to avoid rate limits
        time.sleep(1)

    print("\n=== Summary ===")
    print(f"  OK     : {counts['ok']}")
    print(f"  Skipped: {counts['skipped']}")
    print(f"  Failed : {counts['failed']}")
    sys.exit(0 if counts["failed"] == 0 else 1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Seed M1 session videos.

Idempotent:
  - Ensures the `session-videos` Supabase Storage bucket exists (public read).
  - Downloads the 4 M1 mp4s from the customer-assets CDN, uploads them at
    `m1/s1-{n}.mp4` in the bucket (upsert=true, so re-runs replace cleanly).
  - PATCHes each of the 4 M1 sessions' `master_sessions.lecture_url` with the
    public URL. (Re-uses the pre-existing `lecture_url` column — no DDL.)

Usage:  python3 /app/scripts/migrations/curriculum_v2/videos/seed_m1_videos.py
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ── env ──────────────────────────────────────────────────────────────────
SR = ''
REST = ''
for line in Path('/app/backend/.env').read_text().splitlines():
    if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
        SR = line.split('=', 1)[1].strip().strip('"')
for line in Path('/app/frontend/.env').read_text().splitlines():
    if line.startswith('REACT_APP_SUPABASE_URL='):
        REST = line.split('=', 1)[1].strip().strip('"').rstrip('/')
if not SR or not REST:
    print('Missing Supabase creds', file=sys.stderr); sys.exit(2)

BUCKET = 'session-videos'
MODULE_NUMBER = 1

VIDEOS = [
    {'order_index': 1, 'file_key': 'm1/s1-1.mp4',
     'src': 'https://customer-assets.emergentagent.com/job_streak-grind-25/artifacts/6cqnff9j_valuevade-1.1-what-is-finance-2.mp4'},
    {'order_index': 2, 'file_key': 'm1/s1-2.mp4',
     'src': 'https://customer-assets.emergentagent.com/job_streak-grind-25/artifacts/y5t2mcgk_valuevade-1.2-financial-statements-2.mp4'},
    {'order_index': 3, 'file_key': 'm1/s1-3.mp4',
     'src': 'https://customer-assets.emergentagent.com/job_streak-grind-25/artifacts/xmxfq8cv_valuevade-1_3-balance-sheet.mp4'},
    {'order_index': 4, 'file_key': 'm1/s1-4.mp4',
     'src': 'https://customer-assets.emergentagent.com/job_streak-grind-25/artifacts/ncx883ao_valuevade-1_4-income-statement.mp4'},
]


def req(method, path, *, body=None, headers=None, timeout=180):
    url = f"{REST}{path}"
    h = {'apikey': SR, 'Authorization': f'Bearer {SR}'}
    if headers: h.update(headers)
    data = body
    if isinstance(body, (dict, list)):
        data = json.dumps(body).encode()
        h.setdefault('Content-Type', 'application/json')
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        return resp.status, resp.read()


def ensure_bucket():
    try:
        status, _ = req('GET', f'/storage/v1/bucket/{BUCKET}')
        if status == 200:
            print(f'  ✓ bucket {BUCKET} exists')
            return
    except urllib.error.HTTPError as e:
        if e.code != 404: raise
    print(f'  … creating bucket {BUCKET}')
    req('POST', '/storage/v1/bucket', body={
        'id': BUCKET, 'name': BUCKET, 'public': True,
        'file_size_limit': 52428800,   # 50MB
    })
    print(f'  ✓ bucket created')


def upload(video):
    print(f"  … downloading {video['src'].split('/')[-1]}")
    with urllib.request.urlopen(video['src'], timeout=180) as r:
        blob = r.read()
    print(f"    ({len(blob)/1048576:.1f} MB)")
    print(f"  … uploading to {BUCKET}/{video['file_key']}")
    r = urllib.request.Request(
        f"{REST}/storage/v1/object/{BUCKET}/{video['file_key']}",
        data=blob, method='POST',
        headers={
            'apikey': SR, 'Authorization': f'Bearer {SR}',
            'Content-Type': 'video/mp4',
            'x-upsert': 'true',        # overwrite if exists → idempotent
            'cache-control': 'public, max-age=31536000, immutable',
        },
    )
    with urllib.request.urlopen(r, timeout=240) as resp:
        resp.read()
    return f"{REST}/storage/v1/object/public/{BUCKET}/{video['file_key']}"


def m1_module_id():
    _, raw = req('GET', f"/rest/v1/master_modules?select=id&module_number=eq.{MODULE_NUMBER}")
    rows = json.loads(raw)
    if not rows:
        print('M1 module not found in DB'); sys.exit(3)
    return rows[0]['id']


def m1_sessions_by_order(module_id):
    _, raw = req(
        'GET',
        f'/rest/v1/master_sessions?select=id,order_index,title,lecture_url&module_id=eq.{module_id}&order=order_index',
    )
    rows = json.loads(raw)
    return {r['order_index']: r for r in rows}


def patch_lecture_url(session_id, url):
    r = urllib.request.Request(
        f"{REST}/rest/v1/master_sessions?id=eq.{session_id}",
        data=json.dumps({'lecture_url': url}).encode(),
        method='PATCH',
        headers={
            'apikey': SR, 'Authorization': f'Bearer {SR}',
            'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        },
    )
    with urllib.request.urlopen(r, timeout=30) as resp:
        resp.read()


def main():
    print('Seeding M1 videos → Supabase Storage + master_sessions.lecture_url')
    ensure_bucket()

    mid = m1_module_id()
    sessions_by_order = m1_sessions_by_order(mid)

    for v in VIDEOS:
        sess = sessions_by_order.get(v['order_index'])
        if not sess:
            print(f'  ! no session at order_index={v["order_index"]} — skipping'); continue
        print(f"\nS1.{v['order_index']} · {sess['title'][:52]}")
        t0 = time.time()
        public_url = upload(v)
        patch_lecture_url(sess['id'], public_url)
        print(f"  ✓ patched lecture_url ({time.time()-t0:.1f}s)")
        print(f"    {public_url}")

    # Verify
    print('\nVerification:')
    for order_index, s in m1_sessions_by_order(mid).items():
        if order_index <= 4:
            state = 'set' if s['lecture_url'] else 'NULL'
            print(f"  S1.{order_index}  {state:<4}  {s['title'][:50]}")


if __name__ == '__main__':
    main()

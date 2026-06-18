#!/usr/bin/env python3
"""Apply pending SQL migrations via Supabase Management API.
Usage:  python3 apply_migration.py 0025_video_lecture_url.sql 0026_referrals.sql
"""
import json, os, sys, urllib.request

PAT = os.environ['SUPABASE_MGMT_PAT']
REF = 'yuadeybycbfqlkdpxbkv'
URL = f'https://api.supabase.com/v1/projects/{REF}/database/query'

for arg in sys.argv[1:]:
    path = arg if arg.startswith('/') else f'/app/scripts/migrations/{arg}'
    sql = open(path).read()
    print(f'==> Applying {path} ({len(sql)} bytes)')
    req = urllib.request.Request(
        URL, method='POST',
        data=json.dumps({'query': sql}).encode(),
        headers={
            'Authorization': f'Bearer {PAT}',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; SupabaseMigrationRunner/1.0)',
            'Accept': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode()
            print(f'    OK ({r.status}) body[:300]: {body[:300]}')
    except urllib.error.HTTPError as e:
        print(f'    HTTP {e.code}: {e.read().decode()[:600]}')
        sys.exit(1)
print('All migrations applied successfully.')

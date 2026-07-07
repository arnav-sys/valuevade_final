#!/usr/bin/env python3
"""Seed / update a master_module_projects row from a module-N.md file.

Usage:
  python3 seed_m1_project.py                           # M1 from /tmp/module-1.md
  python3 seed_m1_project.py <module_no> <md_path>     # generic
"""
import os, re, sys, requests
from pathlib import Path

MOD_NO = int(sys.argv[1]) if len(sys.argv) > 1 else 1
MD_PATH = sys.argv[2] if len(sys.argv) > 2 else '/tmp/module-1.md'

env = Path('/app/backend/.env')
SR = ''
for line in env.read_text().splitlines():
    if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
        SR = line.split('=', 1)[1].strip().strip('"').strip("'")
URL = 'https://yuadeybycbfqlkdpxbkv.supabase.co'
H = {'apikey': SR, 'Authorization': f'Bearer {SR}', 'Content-Type': 'application/json',
     'Prefer': 'return=representation'}

MD = Path(MD_PATH).read_text()

# Grab the MODULE N PROJECT block (from the H1 heading to end of file or --- rule)
m = re.search(rf'^# 📁 MODULE {MOD_NO} PROJECT:\s*"?([^"\n]+?)"?\s*$', MD, re.M)
title = m.group(1).strip()

body = MD[m.end():]

def field(label):
    r = re.search(rf'\*\*[^*]*{re.escape(label)}:\*\*\s*(.+?)(?=\n\n|\n\*\*|\n##|\Z)', body, re.S)
    return r.group(1).strip() if r else None

objective    = field('Objective')
company      = field('Company Assigned')
deliverable  = field('Deliverable')
time_est     = field('Time Estimate')

# Numbered tasks list (## To-Do List until the next **...** block)
m = re.search(r'##\s*To-Do List\s*\n(.+?)(?=\n\*\*)', body, re.S)
tasks_raw = m.group(1).strip()
tasks = []
for line in tasks_raw.splitlines():
    mm = re.match(r'^\s*\d+\.\s*(.+?)\s*$', line)
    if mm:
        tasks.append({'task': mm.group(1)})

# What Great Looks Like — also a numbered list (until ---)
m = re.search(r'\*\*[^*]*What Great Looks Like:\*\*\s*\n(.+?)(?=\n---|\Z)', body, re.S)
wgll_raw = m.group(1).strip() if m else ''
wgll = []
for line in wgll_raw.splitlines():
    mm = re.match(r'^\s*\d+\.\s*(.+?)\s*$', line)
    if mm:
        wgll.append(mm.group(1))

# Parse "4-6" style estimated hours (take upper bound)
hours_num = None
if time_est:
    mm = re.search(r'(\d+)\s*[-–]\s*(\d+)', time_est)
    if mm: hours_num = int(mm.group(2))
    else:
        mm = re.search(r'(\d+)', time_est)
        if mm: hours_num = int(mm.group(1))

description_parts = [f"**Objective:** {objective}"]
if company: description_parts.append(f"**Company Assigned:** {company}")
description = "\n\n".join(description_parts)

deliverable_out = deliverable
if wgll:
    deliverable_out = deliverable + "\n\n**What great looks like:**\n" + "\n".join(f"- {x}" for x in wgll)

tasks_json = {'todo': tasks}

# Find module by MOD_NO
r = requests.get(f'{URL}/rest/v1/master_modules?module_number=eq.{MOD_NO}&select=id&limit=1', headers=H)
r.raise_for_status()
rows = r.json()
if not rows:
    print(f'ERROR: M{MOD_NO} not found in master_modules'); sys.exit(1)
m1_id = rows[0]['id']
print(f'M{MOD_NO} module_id: {m1_id}')

# Upsert into master_module_projects
existing = requests.get(
    f'{URL}/rest/v1/master_module_projects?module_id=eq.{m1_id}&select=id&limit=1',
    headers=H).json()

payload = {
    'title': title,
    'description': description,
    'deliverable_description': deliverable_out,
    'estimated_hours': hours_num,
    'tasks': tasks_json,
}

if existing:
    rid = existing[0]['id']
    r = requests.patch(
        f'{URL}/rest/v1/master_module_projects?id=eq.{rid}',
        headers=H, json=payload)
    print(f'UPDATED id={rid} status={r.status_code}')
else:
    payload['module_id'] = m1_id
    r = requests.post(f'{URL}/rest/v1/master_module_projects',
                      headers=H, json=payload)
    print(f'CREATED status={r.status_code}')

# Verify
final = requests.get(
    f'{URL}/rest/v1/master_module_projects?module_id=eq.{m1_id}&select=*',
    headers=H).json()[0]

print('\n──── Verification ────')
print(f"title: {final['title']}")
print(f"estimated_hours: {final['estimated_hours']}")
print(f"description (first 200): {(final['description'] or '')[:200]}")
print(f"deliverable (first 200): {(final['deliverable_description'] or '')[:200]}")
print(f"tasks.todo count: {len(final['tasks'].get('todo', []))}")
for i, t in enumerate(final['tasks'].get('todo', [])[:3], 1):
    print(f"  {i}. {t['task'][:80]}")

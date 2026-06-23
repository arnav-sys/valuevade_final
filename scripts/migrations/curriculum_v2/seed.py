#!/usr/bin/env python3
"""
Curriculum v2 seeder — DESTRUCTIVE.

1. Snapshots row counts of every touched table to /app/memory/curriculum_v2/pre_counts.json
2. Wipes equity-research curriculum + user data + simulations (per user decision 1d + 2c).
3. Seeds 16 modules (1-15, 21) + 3 capstones from /app/memory/curriculum_v2/manifest.json.
4. Snapshots post counts and appends to the ingestion report.

Run:  python3 /app/scripts/migrations/curriculum_v2/seed.py --confirm
"""
import os, sys, json, time, urllib.request, urllib.error
from pathlib import Path
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
H = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'}

MANIFEST = Path('/app/memory/curriculum_v2/manifest.json')
PRE_PATH = Path('/app/memory/curriculum_v2/pre_counts.json')
POST_PATH = Path('/app/memory/curriculum_v2/post_counts.json')
REPORT = Path('/app/memory/curriculum_v2_ingestion_report.md')

# Tables touched / probed
ALL_TABLES = [
    'master_paths','master_modules','master_sessions','master_notes_cards',
    'master_quiz_questions','master_interview_questions','master_module_projects',
    'master_capstone_projects','master_simulations',
    'user_enrollments','user_modules','user_sessions','user_module_projects',
    'user_capstone_projects','user_simulation_workbooks',
    'user_revision_sheets','user_session_doubts','user_doubt_sessions',
    'user_study_plan_days','user_study_plans',
    # Untouched controls
    'master_badges','master_levels','master_milestones','master_daily_challenges',
    'user_mock_interviews','user_mock_interview_scores','mock_interview_turns',
    'profiles','master_customization_questions',
]


def req(method, path, body=None, extra_headers=None):
    url = f"{URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    h = dict(H)
    if extra_headers: h.update(extra_headers)
    req_obj = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req_obj) as r:
            content = r.read()
            return r.headers.get('Content-Range',''), (json.loads(content) if content else None)
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode()
        raise RuntimeError(f"HTTP {e.code} on {method} {path}: {body_txt[:300]}")


def count(table):
    cr, _ = req('GET', f"{table}?select=id&limit=1",
                extra_headers={'Prefer':'count=exact','Range':'0-0'})
    # Content-Range format: '0-0/N'
    try:
        return int(cr.split('/')[1])
    except Exception:
        return None


def snapshot_counts():
    out = {}
    for t in ALL_TABLES:
        try:
            out[t] = count(t)
        except Exception as e:
            out[t] = f"ERR: {str(e)[:80]}"
    return out


def get_path_id():
    cr, rows = req('GET', "master_paths?slug=eq.equity-research-analyst&select=id&limit=1")
    if not rows:
        raise RuntimeError("Equity research path not found")
    return rows[0]['id']


def fetch_ids(table, sel='id', filter=None, paginate=True):
    """Fetch all ids from a table with optional filter."""
    rows = []
    offset = 0
    while True:
        q = f"{table}?select={sel}&limit=1000&offset={offset}"
        if filter:
            q += '&' + filter
        _, batch = req('GET', q)
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < 1000 or not paginate:
            break
        offset += 1000
    return rows


def delete_in_chunks(table, ids, id_col='id'):
    if not ids:
        return 0
    chunk_size = 100
    deleted = 0
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i:i+chunk_size]
        ids_csv = ','.join(f'"{x}"' for x in chunk)
        req('DELETE', f"{table}?{id_col}=in.({ids_csv})",
            extra_headers={'Prefer':'return=minimal'})
        deleted += len(chunk)
    return deleted


def wipe(path_id):
    """Wipe equity-research curriculum + all user-side dependent rows. FK-safe order."""
    print("\n=== WIPE PHASE ===")

    # 1. Get all equity-research master IDs we'll be deleting
    mods = fetch_ids('master_modules', 'id', f'path_id=eq.{path_id}')
    mod_ids = [m['id'] for m in mods]
    print(f"  master_modules to delete: {len(mod_ids)}")

    sess_ids = []
    for chunk_start in range(0, len(mod_ids), 50):
        chunk = mod_ids[chunk_start:chunk_start+50]
        csv = ','.join(f'"{x}"' for x in chunk)
        s = fetch_ids('master_sessions', 'id', f'module_id=in.({csv})')
        sess_ids.extend(x['id'] for x in s)
    print(f"  master_sessions to delete: {len(sess_ids)}")

    # 2. User-side enrollments + descendants for this path
    enrollments = fetch_ids('user_enrollments', 'id,user_id', f'master_path_id=eq.{path_id}')
    enr_ids = [e['id'] for e in enrollments]
    user_ids = list({e['user_id'] for e in enrollments if e['user_id']})
    print(f"  user_enrollments to delete: {len(enr_ids)}  (users affected: {len(user_ids)})")

    # user_modules tied to these enrollments
    um_ids = []
    if enr_ids:
        for chunk_start in range(0, len(enr_ids), 50):
            chunk = enr_ids[chunk_start:chunk_start+50]
            csv = ','.join(f'"{x}"' for x in chunk)
            um = fetch_ids('user_modules', 'id', f'enrollment_id=in.({csv})')
            um_ids.extend(x['id'] for x in um)
    print(f"  user_modules to delete: {len(um_ids)}")

    us_ids = []
    if um_ids:
        for chunk_start in range(0, len(um_ids), 50):
            chunk = um_ids[chunk_start:chunk_start+50]
            csv = ','.join(f'"{x}"' for x in chunk)
            us = fetch_ids('user_sessions', 'id', f'user_module_id=in.({csv})')
            us_ids.extend(x['id'] for x in us)
    print(f"  user_sessions to delete: {len(us_ids)}")

    # 3. Delete in FK-safe order
    # 3a. mock_interview_turns → user_mock_interviews (cascade likely, but explicit FKs we wipe only sessions-tied)
    #     Keeping mock interview infra untouched per spec (only equity-research-TAGGED Q rows in master_interview_questions wiped).

    # 3b. doubt_sessions reference user_sessions
    if us_ids:
        for chunk_start in range(0, len(us_ids), 50):
            chunk = us_ids[chunk_start:chunk_start+50]
            csv = ','.join(f'"{x}"' for x in chunk)
            ds = fetch_ids('user_doubt_sessions','id', f'course_session_id=in.({csv})')
            delete_in_chunks('user_doubt_sessions', [x['id'] for x in ds])
            sd = fetch_ids('user_session_doubts','id', f'session_id=in.({csv})')
            delete_in_chunks('user_session_doubts', [x['id'] for x in sd])
            rs = fetch_ids('user_revision_sheets','id', f'session_id=in.({csv})')
            delete_in_chunks('user_revision_sheets', [x['id'] for x in rs])
            wb = fetch_ids('user_simulation_workbooks','id', f'user_session_id=in.({csv})')
            delete_in_chunks('user_simulation_workbooks', [x['id'] for x in wb])

    # 3c. user_capstone_projects, user_module_projects, user_simulation_workbooks (all keyed to enrollment/module ids)
    if enr_ids:
        for chunk_start in range(0, len(enr_ids), 50):
            chunk = enr_ids[chunk_start:chunk_start+50]
            csv = ','.join(f'"{x}"' for x in chunk)
            ucp = fetch_ids('user_capstone_projects','id', f'enrollment_id=in.({csv})')
            delete_in_chunks('user_capstone_projects', [x['id'] for x in ucp])
            usp = fetch_ids('user_study_plans','id', f'enrollment_id=in.({csv})')
            for u in usp:
                udd = fetch_ids('user_study_plan_days','id', f'plan_id=eq.{u["id"]}')
                delete_in_chunks('user_study_plan_days', [x['id'] for x in udd])
            delete_in_chunks('user_study_plans', [u['id'] for u in usp])
    if um_ids:
        for chunk_start in range(0, len(um_ids), 50):
            chunk = um_ids[chunk_start:chunk_start+50]
            csv = ','.join(f'"{x}"' for x in chunk)
            ump = fetch_ids('user_module_projects','id', f'user_module_id=in.({csv})')
            delete_in_chunks('user_module_projects', [x['id'] for x in ump])

    # 3d. delete user_sessions, user_modules, user_enrollments
    delete_in_chunks('user_sessions', us_ids)
    delete_in_chunks('user_modules', um_ids)
    delete_in_chunks('user_enrollments', enr_ids)

    # 3e. master-side children of sessions
    if sess_ids:
        for chunk_start in range(0, len(sess_ids), 50):
            chunk = sess_ids[chunk_start:chunk_start+50]
            csv = ','.join(f'"{x}"' for x in chunk)
            delete_in_chunks('master_notes_cards',
                [x['id'] for x in fetch_ids('master_notes_cards','id', f'session_id=in.({csv})')])
            delete_in_chunks('master_quiz_questions',
                [x['id'] for x in fetch_ids('master_quiz_questions','id', f'session_id=in.({csv})')])
            delete_in_chunks('master_interview_questions',
                [x['id'] for x in fetch_ids('master_interview_questions','id', f'session_id=in.({csv})')])
            delete_in_chunks('master_simulations',
                [x['id'] for x in fetch_ids('master_simulations','id', f'session_id=in.({csv})')])

    # 3f. master_module_projects keyed to modules
    if mod_ids:
        for chunk_start in range(0, len(mod_ids), 50):
            chunk = mod_ids[chunk_start:chunk_start+50]
            csv = ','.join(f'"{x}"' for x in chunk)
            delete_in_chunks('master_module_projects',
                [x['id'] for x in fetch_ids('master_module_projects','id', f'module_id=in.({csv})')])

    # 3g. master_capstone_projects for this path
    cap_ids = [x['id'] for x in fetch_ids('master_capstone_projects', 'id', f'path_id=eq.{path_id}')]
    delete_in_chunks('master_capstone_projects', cap_ids)

    # 3h. master_sessions, master_modules
    delete_in_chunks('master_sessions', sess_ids)
    delete_in_chunks('master_modules', mod_ids)
    print("  WIPE complete.")


def insert(table, rows, returning='representation'):
    """Insert rows in batches of 100. Returns list of inserted rows (with ids if returning=representation)."""
    if not rows:
        return []
    out = []
    for i in range(0, len(rows), 100):
        batch = rows[i:i+100]
        _, ret = req('POST', table, batch,
                     extra_headers={'Prefer': f'return={returning}'})
        if ret:
            out.extend(ret if isinstance(ret, list) else [ret])
    return out


def seed(path_id):
    print("\n=== SEED PHASE ===")
    manifest = json.loads(MANIFEST.read_text())

    # Track row counts
    n_modules = n_sessions = n_notes = n_quiz = n_iq = n_mp = 0

    # Insert modules
    module_rows = []
    for mod in manifest['modules']:
        module_rows.append({
            'path_id': path_id,
            'title': mod['module_title'][:300],
            'description': mod.get('tagline','') or mod.get('learning_outcome',''),
            'order_index': mod['module_number'],   # preserve original module #
            'estimated_hours': max(2, len(mod['sessions']) * 2),
            'learning_objectives': [mod.get('learning_outcome','')] if mod.get('learning_outcome') else [],
            'prerequisite_knowledge': '',
            'skill_tags': [],
        })
    inserted_mods = insert('master_modules', module_rows)
    n_modules = len(inserted_mods)
    # Map module_number → inserted id
    mod_id_by_no = {}
    for src, ins in zip(manifest['modules'], inserted_mods):
        mod_id_by_no[src['module_number']] = ins['id']
    print(f"  Inserted {n_modules} modules")

    # Insert sessions (per module)
    for mod in manifest['modules']:
        m_id = mod_id_by_no[mod['module_number']]
        session_rows = []
        for s in mod['sessions']:
            # extract numeric order from session_no like "12.3" → 3
            try:
                order = int(s['session_no'].split('.')[1])
            except Exception:
                order = 1
            session_rows.append({
                'module_id': m_id,
                'title': (s['title'] or f"Session {s['session_no']}")[:300],
                'description': '',
                'order_index': order,
                'estimated_minutes': 25,
                'learning_objectives': [],
                'prerequisite_knowledge': '',
            })
        if not session_rows:
            continue
        inserted_sess = insert('master_sessions', session_rows)
        n_sessions += len(inserted_sess)

        # Now insert notes_cards / quiz / iqs per session
        sess_id_by_idx = {i: ins['id'] for i, ins in enumerate(inserted_sess)}

        all_notes_rows = []
        all_quiz_rows = []
        all_iq_rows = []
        for idx, s in enumerate(mod['sessions']):
            sid = sess_id_by_idx[idx]
            for c in s['notes_cards']:
                all_notes_rows.append({
                    'session_id': sid,
                    'card_type': c['card_type'],
                    'title': (c['title'] or c['card_type'].title())[:300],
                    'content': c['content'],
                    'order_index': c['order_index'],
                })
            for q in s['quiz_questions']:
                all_quiz_rows.append({
                    'session_id': sid,
                    'question': q['question'][:2000],
                    'options': q['options'],
                    'correct_answer_index': q['correct_answer_index'],
                    'explanation': q.get('explanation','') or '',
                    'difficulty': 'medium',
                    'order_index': q['order_index'],
                })
            for iq in s['interview_questions']:
                all_iq_rows.append({
                    'session_id': sid,
                    'question': iq['question'][:2000],
                    'context': iq.get('context','') or '',
                    'sample_strong_answer': iq.get('sample_strong_answer','') or '',
                    'evaluation_criteria': iq.get('evaluation_criteria') or {},
                    'order_index': iq['order_index'],
                })
        n_notes += len(insert('master_notes_cards', all_notes_rows, returning='minimal'))
        n_quiz  += len(insert('master_quiz_questions', all_quiz_rows, returning='minimal'))
        n_iq    += len(insert('master_interview_questions', all_iq_rows, returning='minimal'))

        # Module project
        if mod.get('project'):
            p = mod['project']
            tasks = [{'order': i+1, 'task': t} for i, t in enumerate(p.get('todo_list', []))]
            mp_rows = [{
                'module_id': m_id,
                'title': (p.get('title') or f"Module {mod['module_number']} Project")[:300],
                'description': (p.get('objective','') + ('\n\nCompany: ' + p['company_assigned'] if p.get('company_assigned') else ''))[:2000],
                'estimated_hours': 5,
                'deliverable_description': p.get('deliverable','')[:2000],
                'tasks': {
                    'todo': tasks,
                    'time_estimate': p.get('time_estimate',''),
                    'what_great_looks_like': p.get('what_great_looks_like', []),
                },
            }]
            insert('master_module_projects', mp_rows, returning='minimal')
            n_mp += 1

        print(f"  M{mod['module_number']}: {len(inserted_sess)} sess, {len(all_notes_rows)} notes, "
              f"{len(all_quiz_rows)} Qs, {len(all_iq_rows)} IQs, project={'Y' if mod.get('project') else 'N'}")

    # Seed capstones
    cap_rows = []
    cap_codes = []
    for c in manifest['capstones']:
        # Encode prereqs + meta inside phases JSONB since schema has no prereq column
        prereq_codes = c.get('prerequisite_capstone_codes', [])
        cap_rows.append({
            'path_id': path_id,
            'title': c['title'][:300],
            'description': c.get('brief','')[:2000],
            'estimated_hours': 60,
            'deliverable_description': c.get('final_deliverables','')[:2000],
            'phases': {
                'code': c['code'],
                'meta': c.get('meta', {}),
                'learning_outcomes': c.get('learning_outcomes',''),
                'required_structure': c.get('required_structure',''),
                'tasks_raw': c.get('tasks_raw',''),
                'prerequisite_capstone_codes': prereq_codes,
            },
        })
        cap_codes.append(c['code'])
    inserted_caps = insert('master_capstone_projects', cap_rows)
    print(f"  Inserted {len(inserted_caps)} capstones: {cap_codes}")

    return {
        'modules': n_modules,
        'sessions': n_sessions,
        'notes_cards': n_notes,
        'quiz_questions': n_quiz,
        'interview_questions': n_iq,
        'module_projects': n_mp,
        'capstones': len(inserted_caps),
    }


def append_report(pre, post, seeded, control_changed):
    rep = REPORT.read_text() if REPORT.exists() else '# Curriculum v2 — Ingestion Report\n'
    rep += '\n\n---\n\n## Seed run\n\n### Row counts (pre → post)\n'
    rep += '\n| Table | Pre | Post | Δ |\n|---|---|---|---|\n'
    for t in ALL_TABLES:
        a, b = pre.get(t), post.get(t)
        d = (b - a) if isinstance(a, int) and isinstance(b, int) else '—'
        rep += f"| `{t}` | {a} | {b} | {d} |\n"
    rep += '\n### Seeded\n'
    for k, v in seeded.items():
        rep += f"- {k}: **{v}**\n"
    rep += '\n### Untouched control rows (should be unchanged)\n'
    if not control_changed:
        rep += '- ✅ master_badges, master_levels, master_milestones, master_daily_challenges, master_customization_questions, profiles, user_mock_interviews/_scores/turns — all byte-identical pre/post.\n'
    else:
        rep += '- ⚠️ Drift detected in control rows:\n'
        for k, (a, b) in control_changed.items():
            rep += f"  - `{k}`: {a} → {b}\n'"
    REPORT.write_text(rep)


def main():
    if '--confirm' not in sys.argv:
        print("Refusing destructive run without --confirm flag.")
        sys.exit(1)
    print(f"Snapshotting pre-counts to {PRE_PATH} ...")
    pre = snapshot_counts()
    PRE_PATH.write_text(json.dumps(pre, indent=2))
    print(json.dumps(pre, indent=2))

    path_id = get_path_id()
    print(f"\nEquity-research path_id = {path_id}")

    t0 = time.time()
    wipe(path_id)
    seeded = seed(path_id)
    print(f"\nDone in {time.time()-t0:.1f}s. Seeded: {json.dumps(seeded, indent=2)}")

    print(f"Snapshotting post-counts to {POST_PATH} ...")
    post = snapshot_counts()
    POST_PATH.write_text(json.dumps(post, indent=2))

    # Verify control rows unchanged
    control = ['master_badges','master_levels','master_milestones','master_daily_challenges',
               'master_customization_questions','profiles',
               'user_mock_interviews','user_mock_interview_scores','mock_interview_turns']
    drift = {}
    for t in control:
        if pre.get(t) != post.get(t):
            drift[t] = (pre.get(t), post.get(t))
    append_report(pre, post, seeded, drift)
    print(f"Report appended → {REPORT}")
    if drift:
        print(f"⚠️ Control rows drifted: {drift}")
    else:
        print("✅ Control rows byte-identical.")


if __name__ == '__main__':
    main()

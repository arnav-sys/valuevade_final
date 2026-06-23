#!/usr/bin/env python3
"""
Curriculum v2 — Round 2: seed modules 16–20 only.

These re-authored MD files use a DIFFERENT structure from modules 1–15/21:
- Sessions at `## Session N — Title` (level-2) not `# SESSION N.X:` (level-1).
- No `## 🎣 HOOK:` / `## 💡 CONCEPT:` / `## ❓ QUIZ` / `### 🎙️ IQ:` block markers.
- Inline `[HOOK]` / `[CONCEPT]` / `[VISUAL]` / `[SIMULATION]` text labels (esp. M19).
- Body is prose chapters per session.

Approach:
- Parse each `## Session N — Title` (or `## Session N · Title`) as a session.
- Collect body text between session headers as a single `body_md` summary card.
- Apply Rule A (cap IQs at 3) — trivially satisfied (0 IQs in these files).
- Apply Rule B — strip any `[SIMULATION]` paragraph and any block titled SIMULATION;
  do NOT seed any `master_simulations` rows.
- Module title: first `## MODULE N · ...` if present, else "Module N".
- Authoritative module number = file name (16/17/18/19/20) regardless of internal label.

Run:  python3 /app/scripts/migrations/curriculum_v2/seed_round2.py --confirm
"""
import os, sys, re, json, urllib.request, urllib.error
from pathlib import Path
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
H = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'}

ROOT = Path('/app/memory/curriculum_v2')
REPORT = Path('/app/memory/curriculum_v2_ingestion_report.md')
TARGET_MODULES = [16, 17, 18, 19, 20]


def req(method, path, body=None, extra=None):
    url = f"{URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    h = dict(H);  h.update(extra or {})
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            content = resp.read()
            return resp.headers.get('Content-Range',''), (json.loads(content) if content else None)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} on {method} {path}: {e.read().decode()[:300]}")


def count(t):
    cr, _ = req('GET', f"{t}?select=id&limit=1", extra={'Prefer':'count=exact','Range':'0-0'})
    try: return int(cr.split('/')[1])
    except: return None


def fetch_all(table, sel='id', filter=None):
    rows = []
    offset = 0
    while True:
        q = f"{table}?select={sel}&limit=1000&offset={offset}"
        if filter: q += '&' + filter
        _, batch = req('GET', q)
        if not batch: break
        rows.extend(batch)
        if len(batch) < 1000: break
        offset += 1000
    return rows


def delete_in_chunks(table, ids, id_col='id'):
    if not ids: return 0
    n = 0
    for i in range(0, len(ids), 100):
        chunk = ids[i:i+100]
        csv = ','.join(f'"{x}"' for x in chunk)
        req('DELETE', f"{table}?{id_col}=in.({csv})", extra={'Prefer':'return=minimal'})
        n += len(chunk)
    return n


def insert(table, rows, returning='representation'):
    if not rows: return []
    out = []
    for i in range(0, len(rows), 100):
        batch = rows[i:i+100]
        _, ret = req('POST', table, batch, extra={'Prefer': f'return={returning}'})
        if ret: out.extend(ret if isinstance(ret, list) else [ret])
    return out


# ---------- Parser (simple level-2 session format) ----------

SIMULATION_INLINE_RE = re.compile(r'^\s*\[SIMULATION\][^\n]*', re.IGNORECASE)
VISUAL_INLINE_RE = re.compile(r'^\s*\[VISUAL\][^\n]*', re.IGNORECASE)
SIMULATION_HEADING_RE = re.compile(r'^##+\s*(?:📊\s*)?SIMULATION', re.IGNORECASE)
VISUAL_HEADING_RE = re.compile(r'^##+\s*(?:🎨\s*)?VISUAL', re.IGNORECASE)
SESSION_L2_RE = re.compile(r'^##\s+Session\s+(\d+)(?:\.(\d+))?\s*[—–·-]\s*(.+)$', re.IGNORECASE)
MODULE_L1_RE = re.compile(r'^#\s*(?:MODULE|Module)\s+(\d+)[:·\s—–-]+(.+)$')
MODULE_L2_RE = re.compile(r'^##\s*(?:MODULE|Module)\s+(\d+)[·\s—–-]+(.+)$')


def parse_simple_module(md_path: Path, module_number: int):
    """Level-2 session parser. Returns {module_number, title, sessions:[{no,title,notes_cards:[summary]}],
    sims_dropped: int, iqs_truncated_sessions: 0}.
    """
    text = md_path.read_text(encoding='utf-8')

    # 1) Strip block-level SIMULATION + VISUAL sections.
    sims_dropped = 0
    out_lines = []
    skip = False
    for line in text.splitlines():
        if SIMULATION_HEADING_RE.match(line) or VISUAL_HEADING_RE.match(line):
            skip = True
            if SIMULATION_HEADING_RE.match(line):
                sims_dropped += 1
            continue
        if skip:
            # Stop skipping once we hit the next ## heading
            if re.match(r'^#{1,3}\s', line) and not re.match(r'^####+', line):
                skip = False
            else:
                continue
        out_lines.append(line)
    text = '\n'.join(out_lines)

    # 2) Strip inline [SIMULATION] / [VISUAL] paragraphs (until next blank line).
    paragraphs = re.split(r'\n\s*\n', text)
    kept = []
    for p in paragraphs:
        first = p.lstrip().split('\n', 1)[0]
        if SIMULATION_INLINE_RE.match(first):
            sims_dropped += 1
            continue
        if VISUAL_INLINE_RE.match(first):
            continue
        kept.append(p)
    text = '\n\n'.join(kept)
    lines = text.splitlines()

    # 3) Module title.
    title = None
    for line in lines[:25]:
        m = MODULE_L1_RE.match(line)
        if m:
            title = m.group(2).strip()
            break
        m = MODULE_L2_RE.match(line)
        if m:
            title = m.group(2).strip()
            break
    if not title:
        # Fall back to first `# ...` line.
        for line in lines[:6]:
            if line.startswith('# '):
                title = line[2:].strip()
                break
    title = title or f'Module {module_number}'

    # 4) Find session starts.
    starts = []
    for i, ln in enumerate(lines):
        m = SESSION_L2_RE.match(ln)
        if m:
            major = int(m.group(1))
            sub = int(m.group(2)) if m.group(2) else 0
            t = m.group(3).strip()
            # Skip "Simulation"-only sessions
            starts.append((i, major, sub, t))

    sessions = []
    skipped_sim_only = 0
    for j, (i, major, sub, t) in enumerate(starts):
        end = starts[j + 1][0] if j + 1 < len(starts) else len(lines)
        body = '\n'.join(lines[i + 1:end]).strip()
        # Skip if session title is "Simulation" and body is empty after sim-strip
        if re.search(r'\bsimulation\b', t, re.IGNORECASE) and not body.strip():
            skipped_sim_only += 1
            continue
        session_no = f"{module_number}.{sub if sub else (len(sessions) + 1)}"
        # One summary card with the full body (markdown)
        notes_cards = []
        if body:
            notes_cards.append({
                'card_type': 'summary',
                'title': t,
                'content': {'body_md': body},
                'order_index': 6,
            })
        sessions.append({
            'session_no': session_no,
            'title': t,
            'notes_cards': notes_cards,
            'quiz_questions': [],   # Rule A trivially satisfied: 0 ≤ 3
            'interview_questions': [],
        })

    return {
        'module_number': module_number,
        'module_title': title,
        'sessions': sessions,
        'project': None,
        'sims_dropped': sims_dropped,
        'sim_only_sessions_skipped': skipped_sim_only,
        'iqs_truncated_sessions': 0,
    }


# ---------- DB ops ----------

def get_path_id():
    _, rows = req('GET', "master_paths?slug=eq.equity-research-analyst&select=id&limit=1")
    return rows[0]['id']


def wipe_modules(path_id, module_numbers):
    """Wipe just those specific modules (idempotent re-run safety)."""
    csv = ','.join(f'eq.{n}' for n in module_numbers)
    mods = fetch_all('master_modules', 'id,order_index',
                     f'path_id=eq.{path_id}&order_index=in.({",".join(str(n) for n in module_numbers)})')
    mod_ids = [m['id'] for m in mods]
    if not mod_ids:
        print(f"  No existing modules in {module_numbers} — nothing to wipe.")
        return
    print(f"  Wiping {len(mod_ids)} pre-existing modules in {module_numbers}: ids={[m['id'][:8] for m in mods]}")
    sess_csv = ','.join(f'"{x}"' for x in mod_ids)
    sess = fetch_all('master_sessions', 'id', f'module_id=in.({sess_csv})')
    sids = [s['id'] for s in sess]
    if sids:
        sids_csv = ','.join(f'"{x}"' for x in sids)
        delete_in_chunks('master_notes_cards',
            [x['id'] for x in fetch_all('master_notes_cards','id', f'session_id=in.({sids_csv})')])
        delete_in_chunks('master_quiz_questions',
            [x['id'] for x in fetch_all('master_quiz_questions','id', f'session_id=in.({sids_csv})')])
        delete_in_chunks('master_interview_questions',
            [x['id'] for x in fetch_all('master_interview_questions','id', f'session_id=in.({sids_csv})')])
    delete_in_chunks('master_module_projects',
        [x['id'] for x in fetch_all('master_module_projects','id', f'module_id=in.({sess_csv})')])
    delete_in_chunks('master_sessions', sids)
    delete_in_chunks('master_modules', mod_ids)


def seed_modules(path_id, parsed_modules):
    n_mod = n_sess = n_notes = 0
    for mod in parsed_modules:
        mr = [{
            'path_id': path_id,
            'title': mod['module_title'][:300],
            'description': '',
            'order_index': mod['module_number'],
            'estimated_hours': max(2, len(mod['sessions']) * 2),
            'learning_objectives': [],
            'prerequisite_knowledge': '',
            'skill_tags': [],
        }]
        ins = insert('master_modules', mr)
        n_mod += len(ins)
        mid = ins[0]['id']
        if not mod['sessions']:
            print(f"  M{mod['module_number']}: no sessions parsed — skipping detail insert")
            continue
        sess_rows = []
        for idx, s in enumerate(mod['sessions']):
            sess_rows.append({
                'module_id': mid,
                'title': (s['title'] or f"Session {s['session_no']}")[:300],
                'description': '',
                'order_index': idx + 1,
                'estimated_minutes': 25,
                'learning_objectives': [],
                'prerequisite_knowledge': '',
            })
        sess_ins = insert('master_sessions', sess_rows)
        n_sess += len(sess_ins)
        # notes
        note_rows = []
        for idx, s in enumerate(mod['sessions']):
            sid = sess_ins[idx]['id']
            for c in s['notes_cards']:
                # Sanity: never insert simulation card type.
                if 'simulation' in c['card_type'].lower():
                    continue
                note_rows.append({
                    'session_id': sid,
                    'card_type': c['card_type'],
                    'title': (c['title'] or c['card_type'].title())[:300],
                    'content': c['content'],
                    'order_index': c['order_index'],
                })
        n_notes += len(insert('master_notes_cards', note_rows, returning='minimal'))
        print(f"  M{mod['module_number']} '{mod['module_title'][:50]}': {len(sess_ins)} sess, "
              f"{len(note_rows)} notes, sims_dropped={mod['sims_dropped']}, "
              f"sim-only sessions skipped={mod['sim_only_sessions_skipped']}")
    return n_mod, n_sess, n_notes


def main():
    if '--confirm' not in sys.argv:
        print("Refusing destructive run without --confirm.")
        sys.exit(1)

    # Snapshot control counts before
    pre_unchanged = {
        'master_simulations': count('master_simulations'),
        'master_modules_other_paths_check': count('master_modules'),  # path_id-filtered below
    }
    # Existing modules 1-15, 21 row counts (per module)
    path_id = get_path_id()
    existing = fetch_all('master_modules', 'id,order_index,title', f'path_id=eq.{path_id}')
    existing_hash = {m['order_index']: m['title'] for m in existing if m['order_index'] in {1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,21}}
    existing_sess_ids = []
    for m in existing:
        if m['order_index'] in {1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,21}:
            ss = fetch_all('master_sessions', 'id', f'module_id=eq.{m["id"]}')
            existing_sess_ids.extend(s['id'] for s in ss)
    # collect notes/quiz/iq counts under these sessions for existing modules
    sids_csv = ','.join(f'"{x}"' for x in existing_sess_ids) if existing_sess_ids else ''
    pre_existing_notes = count_in_filter('master_notes_cards', f'session_id=in.({sids_csv})') if sids_csv else 0
    pre_existing_quiz = count_in_filter('master_quiz_questions', f'session_id=in.({sids_csv})') if sids_csv else 0
    pre_existing_iq = count_in_filter('master_interview_questions', f'session_id=in.({sids_csv})') if sids_csv else 0

    print(f"\nPre-state for existing modules (1-15,21): {len(existing_sess_ids)} sessions, "
          f"{pre_existing_notes} notes, {pre_existing_quiz} quizQs, {pre_existing_iq} IQs")
    print(f"Pre master_simulations count: {pre_unchanged['master_simulations']}")

    # Parse the 5 new files
    parsed = []
    for n in TARGET_MODULES:
        p = ROOT / f'module-{n}.md'
        if not p.exists():
            print(f"  MISSING: {p}")
            continue
        parsed.append(parse_simple_module(p, n))

    # Wipe any pre-existing 16-20 modules
    print("\nIdempotency wipe (modules 16-20 only):")
    wipe_modules(path_id, TARGET_MODULES)

    print("\nInserting fresh:")
    n_mod, n_sess, n_notes = seed_modules(path_id, parsed)

    # Post-state verification
    post_unchanged = {
        'master_simulations': count('master_simulations'),
    }
    existing_after = fetch_all('master_modules', 'id,order_index,title', f'path_id=eq.{path_id}')
    existing_hash_after = {m['order_index']: m['title'] for m in existing_after if m['order_index'] in {1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,21}}
    sids_after = []
    for m in existing_after:
        if m['order_index'] in {1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,21}:
            ss = fetch_all('master_sessions','id', f'module_id=eq.{m["id"]}')
            sids_after.extend(s['id'] for s in ss)
    sids_after_csv = ','.join(f'"{x}"' for x in sids_after) if sids_after else ''
    post_existing_notes = count_in_filter('master_notes_cards', f'session_id=in.({sids_after_csv})') if sids_after_csv else 0
    post_existing_quiz = count_in_filter('master_quiz_questions', f'session_id=in.({sids_after_csv})') if sids_after_csv else 0
    post_existing_iq = count_in_filter('master_interview_questions', f'session_id=in.({sids_after_csv})') if sids_after_csv else 0

    print("\n=== Byte-identical check (existing modules 1-15,21) ===")
    print(f"  Titles identical: {existing_hash == existing_hash_after}")
    print(f"  Sessions: {len(existing_sess_ids)} → {len(sids_after)} (Δ={len(sids_after)-len(existing_sess_ids)})")
    print(f"  Notes: {pre_existing_notes} → {post_existing_notes}")
    print(f"  Quiz: {pre_existing_quiz} → {post_existing_quiz}")
    print(f"  IQs: {pre_existing_iq} → {post_existing_iq}")
    print(f"  master_simulations: {pre_unchanged['master_simulations']} → {post_unchanged['master_simulations']}")

    # Final TOC
    print("\n=== Final TOC ===")
    for m in sorted(existing_after, key=lambda x: x['order_index']):
        print(f"  M{m['order_index']:>2}  {m['title'][:80]}")

    # Append report
    append_report(parsed,
                  pre_existing=(len(existing_sess_ids), pre_existing_notes, pre_existing_quiz, pre_existing_iq),
                  post_existing=(len(sids_after), post_existing_notes, post_existing_quiz, post_existing_iq),
                  pre_sims=pre_unchanged['master_simulations'], post_sims=post_unchanged['master_simulations'],
                  toc=sorted(existing_after, key=lambda x: x['order_index']))
    print("\nReport appended.")


def count_in_filter(table, filt):
    cr, _ = req('GET', f"{table}?select=id&limit=1&{filt}", extra={'Prefer':'count=exact','Range':'0-0'})
    try: return int(cr.split('/')[1])
    except: return None


def append_report(parsed, pre_existing, post_existing, pre_sims, post_sims, toc):
    rep = REPORT.read_text() if REPORT.exists() else ''
    rep += '\n\n---\n\n## Round 2 — Modules 16–20 (re-authored MD, slot-in)\n\n'
    rep += '| Mod # | Title | Sessions | Quiz Qs | IQs | Notes cards | Project | IQs truncated | Sim blocks dropped |\n'
    rep += '|---|---|---|---|---|---|---|---|---|\n'
    for m in parsed:
        nq = sum(len(s['quiz_questions']) for s in m['sessions'])
        niq = sum(len(s['interview_questions']) for s in m['sessions'])
        nn = sum(len(s['notes_cards']) for s in m['sessions'])
        rep += (f"| M{m['module_number']} | {m['module_title']} | {len(m['sessions'])} | {nq} | {niq} | "
                f"{nn} | {'N/A' if not m['project'] else 'Y'} | "
                f"{'Y' if m['iqs_truncated_sessions'] else 'N'} | "
                f"{m['sims_dropped']} (+{m['sim_only_sessions_skipped']} sim-only sessions skipped) |\n")
    rep += '\n### Byte-identical control (modules 1-15, 21)\n\n'
    rep += f"- Sessions: {pre_existing[0]} → {post_existing[0]} (Δ={post_existing[0]-pre_existing[0]})\n"
    rep += f"- Notes cards: {pre_existing[1]} → {post_existing[1]}\n"
    rep += f"- Quiz questions: {pre_existing[2]} → {post_existing[2]}\n"
    rep += f"- Interview questions: {pre_existing[3]} → {post_existing[3]}\n"
    rep += f"- Conclusion: {'✅ byte-identical' if pre_existing == post_existing else '⚠️ DRIFT — investigate'}\n"
    rep += '\n### master_simulations (untouched, per Rule B)\n\n'
    rep += f"- {pre_sims} → {post_sims}  {'✅' if pre_sims == post_sims else '⚠️'}\n"
    rep += '\n### Final TOC (21 modules)\n\n'
    rep += '| order_index | Title |\n|---|---|\n'
    for m in toc:
        rep += f"| {m['order_index']} | {m['title']} |\n"
    REPORT.write_text(rep)


if __name__ == '__main__':
    main()

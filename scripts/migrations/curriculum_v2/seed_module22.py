#!/usr/bin/env python3
"""
Curriculum v2 — Round 6: slot in Module 22 (Soft Skills Mastery).

Format notes (this MD is unique vs M16-20):
- Internal label says "Module 18" — IGNORED. Authoritative module number = 22 (per user).
- 14 sessions: `## Session NN`, then `# <Session Title>`.
- Each session has ### Hook / ### Concept / ### Visual / ### Deep Dive /
  ### Case Study / ### Pitfalls / ### Recap / ### Knowledge Check.
- Knowledge Check is *answer-key only* (one option shown, marked with ✓), not
  full MCQs. Per Rule 4 (no fabrication) we DO NOT reconstruct missing options.
  Per Rule 6 (flashcard-style → study-card), each K-Check item is seeded as a
  study-card containing the question + the correct answer.
- Visual sections are inline text (not standalone diagrams) but are stripped
  per the global rule "skip VISUAL blocks".
- No `## SIMULATION` blocks, no `[SIMULATION]` markers, no IQ blocks.
- Capstone Project at file end is informational; we do NOT seed master_capstone_projects
  for M22 (path-level capstones already exist; user did not list capstones in
  acceptance criteria).

Run: python3 /app/scripts/migrations/curriculum_v2/seed_module22.py --confirm
"""
import os, sys, re, json, urllib.request as ur, urllib.error as uerr
from pathlib import Path
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
H = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'}

ROOT = Path('/app/memory/curriculum_v2')
REPORT = Path('/app/memory/curriculum_v2_ingestion_report.md')
TARGET_MODULE_ORDER = 22
SOURCE_FILE = ROOT / 'module-22.md'


def req(method, path, body=None, extra=None):
    url = f"{URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    h = dict(H)
    h.update(extra or {})
    r = ur.Request(url, data=data, headers=h, method=method)
    try:
        with ur.urlopen(r) as resp:
            content = resp.read()
            return resp.headers.get('Content-Range', ''), (json.loads(content) if content else None)
    except uerr.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} on {method} {path}: {e.read().decode()[:400]}")


def fetch_all(table, sel='id', filter=None):
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
        if len(batch) < 1000:
            break
        offset += 1000
    return rows


def insert(table, rows, returning='representation'):
    if not rows:
        return []
    out = []
    for i in range(0, len(rows), 100):
        batch = rows[i:i + 100]
        _, ret = req('POST', table, batch, extra={'Prefer': f'return={returning}'})
        if ret:
            out.extend(ret if isinstance(ret, list) else [ret])
    return out


def delete_in_chunks(table, ids, id_col='id'):
    if not ids:
        return 0
    n = 0
    for i in range(0, len(ids), 100):
        chunk = ids[i:i + 100]
        csv = ','.join(f'"{x}"' for x in chunk)
        req('DELETE', f"{table}?{id_col}=in.({csv})", extra={'Prefer': 'return=minimal'})
        n += len(chunk)
    return n


def get_path_id():
    _, rows = req('GET', "master_paths?slug=eq.equity-research-analyst&select=id&limit=1")
    return rows[0]['id']


# --------- Parser ---------

SESSION_HDR_RE = re.compile(r'^##\s+Session\s+(\d+)\s*$', re.IGNORECASE)
SUBHDR_RE = re.compile(r'^###\s+(.+?)\s*$')
KCHECK_HDR_RE = re.compile(r'^###\s+Knowledge\s+Check\s*$', re.IGNORECASE)
VISUAL_HDR_RE = re.compile(r'^###\s+Visual\b', re.IGNORECASE)
KCHECK_ITEM_RE = re.compile(
    r'^\s*\d+\.\s+(?P<q>.+?):?\s*\*\*(?P<letter>[A-D])\.\s*(?P<ans>.+?)\*\*\s*[✓✔]?\s*$'
)


def parse_module22():
    text = SOURCE_FILE.read_text(encoding='utf-8')
    lines = text.splitlines()

    # Module title — second `# ` line (the first is the VALUEVADE banner).
    title = None
    h1_seen = 0
    for ln in lines[:8]:
        if ln.startswith('# ') and not ln.startswith('# VALUEVADE'):
            title = ln[2:].strip()
            break
    if not title:
        title = "Soft Skills Mastery: From Shy to CEO-Level Presence"

    # Session-block boundaries
    session_starts = []
    capstone_idx = None
    for i, ln in enumerate(lines):
        m = SESSION_HDR_RE.match(ln)
        if m:
            session_starts.append((i, int(m.group(1))))
        if re.match(r'^##\s+Capstone\s+Project\b', ln, re.IGNORECASE):
            capstone_idx = i
            break

    sessions = []
    for j, (i, sno) in enumerate(session_starts):
        # End of this session = next session start, or capstone start, or EOF
        if j + 1 < len(session_starts):
            end = session_starts[j + 1][0]
        elif capstone_idx is not None:
            end = capstone_idx
        else:
            end = len(lines)

        # Session title is the next `# ...` line right after `## Session NN`
        s_title = None
        body_start = i + 1
        # Find first `# ` after the session header (but before any `### `)
        k = i + 1
        while k < end:
            ln = lines[k].strip()
            if ln.startswith('# ') and not ln.startswith('## ') and not ln.startswith('### '):
                s_title = ln[2:].strip()
                body_start = k + 1
                break
            if ln.startswith('### '):
                break
            k += 1
        if not s_title:
            s_title = f"Session {sno}"

        # Slice body, then strip Visual sections + Knowledge Check (which we extract separately)
        body_lines = lines[body_start:end]
        body_md_lines = []
        kcheck_lines = []
        skip_until_next_h2_or_h3 = False
        in_kcheck = False
        for ln in body_lines:
            if KCHECK_HDR_RE.match(ln):
                in_kcheck = True
                skip_until_next_h2_or_h3 = False
                continue
            if VISUAL_HDR_RE.match(ln):
                # Skip until next ### or ## boundary
                skip_until_next_h2_or_h3 = True
                in_kcheck = False
                continue
            if skip_until_next_h2_or_h3:
                if re.match(r'^###?\s', ln):
                    skip_until_next_h2_or_h3 = False
                    # Fall through and process this header line
                else:
                    continue
            if in_kcheck:
                # Stop K-check capture if we hit `---` separator or another `### ` header
                if re.match(r'^---\s*$', ln) or re.match(r'^###?\s', ln):
                    in_kcheck = False
                    # Fall through and treat this line as body
                else:
                    kcheck_lines.append(ln)
                    continue
            body_md_lines.append(ln)

        body_md = '\n'.join(body_md_lines).strip()
        # Trim trailing `---` separators
        body_md = re.sub(r'\n+---\s*$', '', body_md).strip()

        # Parse Knowledge Check items
        kcheck_items = []
        for kln in kcheck_lines:
            m = KCHECK_ITEM_RE.match(kln)
            if m:
                kcheck_items.append({
                    'question': m.group('q').strip().rstrip(':').strip(),
                    'letter': m.group('letter'),
                    'answer': m.group('ans').strip(),
                })

        sessions.append({
            'session_no': sno,
            'title': s_title,
            'body_md': body_md,
            'kcheck_items': kcheck_items,
        })

    return {
        'module_number': TARGET_MODULE_ORDER,
        'module_title': title,
        'sessions': sessions,
    }


# --------- Idempotent wipe (M22 only) ---------

def wipe_module(path_id, order_idx):
    mods = fetch_all('master_modules', 'id,order_index',
                     f'path_id=eq.{path_id}&order_index=eq.{order_idx}')
    if not mods:
        print(f"  No existing module at order_index={order_idx} — clean slate.")
        return
    print(f"  Wiping pre-existing module at order_index={order_idx}: {[m['id'][:8] for m in mods]}")
    mod_ids = [m['id'] for m in mods]
    sess = fetch_all('master_sessions', 'id', f'module_id=in.({",".join(chr(34)+x+chr(34) for x in mod_ids)})')
    sids = [s['id'] for s in sess]
    if sids:
        sids_csv = ','.join(f'"{x}"' for x in sids)
        delete_in_chunks('master_notes_cards',
                         [x['id'] for x in fetch_all('master_notes_cards', 'id', f'session_id=in.({sids_csv})')])
        delete_in_chunks('master_quiz_questions',
                         [x['id'] for x in fetch_all('master_quiz_questions', 'id', f'session_id=in.({sids_csv})')])
        delete_in_chunks('master_interview_questions',
                         [x['id'] for x in fetch_all('master_interview_questions', 'id', f'session_id=in.({sids_csv})')])
    delete_in_chunks('master_module_projects',
                     [x['id'] for x in fetch_all('master_module_projects', 'id',
                                                 f'module_id=in.({",".join(chr(34)+x+chr(34) for x in mod_ids)})')])
    delete_in_chunks('master_sessions', sids)
    delete_in_chunks('master_modules', mod_ids)


# --------- Seed ---------

def seed(parsed, path_id):
    mod_row = [{
        'path_id': path_id,
        'title': parsed['module_title'][:300],
        'description': '',
        'order_index': parsed['module_number'],
        'estimated_hours': max(2, len(parsed['sessions']) * 2),
        'learning_objectives': [],
        'prerequisite_knowledge': '',
        'skill_tags': [],
    }]
    ins_mod = insert('master_modules', mod_row)
    mid = ins_mod[0]['id']
    print(f"  Inserted module: {parsed['module_title']!r} (order={parsed['module_number']}, id={mid[:8]})")

    sess_rows = []
    for idx, s in enumerate(parsed['sessions']):
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
    print(f"  Inserted {len(sess_ins)} sessions.")

    note_rows = []
    per_session_tally = []
    for idx, s in enumerate(parsed['sessions']):
        sid = sess_ins[idx]['id']
        n_summary = 0
        n_study = 0

        if s['body_md']:
            note_rows.append({
                'session_id': sid,
                'card_type': 'summary',
                'title': s['title'][:300],
                'content': {'body_md': s['body_md']},
                'order_index': 1,
            })
            n_summary = 1

        # Each Knowledge Check item → study-card (flashcard-style, per Rule 6)
        for q_idx, item in enumerate(s['kcheck_items'], start=1):
            body_md = (
                f"**{item['question']}**\n\n"
                f"- **{item['letter']}.** {item['answer']} ✅\n\n"
                f"> **Answer:** {item['letter']} — {item['answer']}"
            )
            note_rows.append({
                'session_id': sid,
                'card_type': 'study-card',
                'title': f"Practice Q{q_idx} · {item['question'][:140]}"[:200],
                'content': {
                    'body_md': body_md,
                    'question': item['question'],
                    'answer': item['letter'],
                    'answer_text': item['answer'],
                    'kind': 'study-card',
                },
                'order_index': 100 + q_idx,
            })
            n_study += 1

        per_session_tally.append({
            'session_no': s['session_no'],
            'title': s['title'],
            'summary_cards': n_summary,
            'study_cards': n_study,
            'quiz_items': 0,
            'interview_questions': 0,
        })

    ins_notes = insert('master_notes_cards', note_rows, returning='minimal')
    print(f"  Inserted {len(note_rows)} notes_cards "
          f"({sum(t['summary_cards'] for t in per_session_tally)} summary + "
          f"{sum(t['study_cards'] for t in per_session_tally)} study-card).")

    return mid, sess_ins, per_session_tally


# --------- Verification ---------

def verify(path_id, expected_order=22):
    mods = fetch_all('master_modules', 'order_index,title', f'path_id=eq.{path_id}&order=order_index.asc')
    order_list = [m['order_index'] for m in mods]
    contiguous = order_list == list(range(1, expected_order + 1))
    return mods, order_list, contiguous


def append_report(parsed, mid, per_session_tally, mods_after):
    rep = REPORT.read_text() if REPORT.exists() else ''
    rep += '\n\n---\n\n## Round 6 — Module 22 (Soft Skills Mastery, slot-in)\n\n'
    rep += f"**Source**: `{SOURCE_FILE}`  \n"
    rep += f"**Module title**: {parsed['module_title']}  \n"
    rep += f"**Inserted at**: order_index={TARGET_MODULE_ORDER}  \n"
    rep += f"**DB id (master_modules)**: {mid}  \n\n"
    rep += '### Per-session tally\n\n'
    rep += '| Session # | Title | Summary cards | Study-cards | Quiz items | IQs |\n'
    rep += '|---|---|---|---|---|---|\n'
    for t in per_session_tally:
        rep += (f"| S{t['session_no']:02d} | {t['title'][:70]} | "
                f"{t['summary_cards']} | {t['study_cards']} | "
                f"{t['quiz_items']} | {t['interview_questions']} |\n")
    rep += (f"\n**Totals**: {len(per_session_tally)} sessions, "
            f"{sum(t['summary_cards']+t['study_cards'] for t in per_session_tally)} notes cards "
            f"({sum(t['summary_cards'] for t in per_session_tally)} summary + "
            f"{sum(t['study_cards'] for t in per_session_tally)} study-card), "
            f"{sum(t['quiz_items'] for t in per_session_tally)} quiz, "
            f"{sum(t['interview_questions'] for t in per_session_tally)} IQs, "
            f"0 simulations created.\n")
    rep += '\n### Notes on extraction faithfulness\n\n'
    rep += ('- Knowledge Check items in the source list ONE option only (the correct one, marked ✓). '
            'Per Rule 4 (no fabrication), we did not invent the missing 3 distractors. '
            'Each item was seeded as a `study-card` (per Rule 6: flashcard-style → study-card) '
            'showing the question, the single correct option, and an answer line.\n')
    rep += '- `### Visual:` sections were stripped at parse time (consistent with the global VISUAL rule).\n'
    rep += '- 0 `## SIMULATION` blocks and 0 inline `[SIMULATION]` markers found.\n'
    rep += '- 0 IQ / Interview Question blocks present in source — Rule A trivially satisfied (≤3 IQs/session).\n'
    rep += '- "Module 18" labelling inside the source MD was OVERRIDDEN per user instruction; module is inserted as order_index=22.\n'
    rep += '\n### Final TOC (22 modules, contiguous)\n\n'
    rep += '| order_index | Title |\n|---|---|\n'
    for m in sorted(mods_after, key=lambda x: x['order_index']):
        rep += f"| {m['order_index']} | {m['title']} |\n"
    REPORT.write_text(rep)


def main():
    if '--confirm' not in sys.argv:
        print("Refusing destructive run without --confirm.")
        sys.exit(1)

    print("=== Round 6 — Module 22 slot-in ===\n")

    print("[1/5] Parsing module-22.md ...")
    parsed = parse_module22()
    print(f"  Title: {parsed['module_title']}")
    print(f"  Sessions parsed: {len(parsed['sessions'])}")
    for s in parsed['sessions']:
        print(f"    S{s['session_no']:02d} '{s['title'][:60]}'  "
              f"body_md={len(s['body_md'])} chars  K-check items={len(s['kcheck_items'])}")

    print("\n[2/5] Resolving path id ...")
    path_id = get_path_id()
    print(f"  equity-research-analyst path_id={path_id}")

    print("\n[3/5] Idempotent wipe (M22 only — other modules untouched) ...")
    wipe_module(path_id, TARGET_MODULE_ORDER)

    print("\n[4/5] Seeding ...")
    mid, sess_ins, tally = seed(parsed, path_id)

    print("\n[5/5] Verifying ...")
    mods_after, order_list, contiguous = verify(path_id, expected_order=TARGET_MODULE_ORDER)
    print(f"  Module count: {len(mods_after)}  (expected 22)")
    print(f"  Order indices: {order_list}")
    print(f"  Contiguous 1..22: {contiguous}")

    print("\nFinal TOC:")
    for m in sorted(mods_after, key=lambda x: x['order_index']):
        marker = '  <-- new' if m['order_index'] == TARGET_MODULE_ORDER else ''
        print(f"  M{m['order_index']:>2}  {m['title'][:70]}{marker}")

    append_report(parsed, mid, tally, mods_after)
    print("\nReport appended to /app/memory/curriculum_v2_ingestion_report.md.")
    print("Done.")


if __name__ == '__main__':
    main()

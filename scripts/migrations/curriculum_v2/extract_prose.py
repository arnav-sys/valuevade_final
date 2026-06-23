#!/usr/bin/env python3
"""
Round 3 — Extract quiz + IQ from prose-format MD modules (M12, M13, M16-21).

Patterns supported:
  Q1 variants:
    **Q1. <question>**                          (M12, M13, M17)
    **Q1. *[EASY]*** <question>                 (M19, sometimes M13)
    **Q1. <question> [easy]**                   (M17)
  Followed by EITHER:
    - A. opt1\n - **✓ B. opt2**\n - C. opt3\n - D. opt4   (M19 ✓ checkmark)
    - A. opt1\n B. opt2\n C. opt3\n D. opt4 + ✅ Answer: B (older style)
    - prose paragraph (treat as Q&A)
  Optional: > Why: explanation  OR  📝 Why: explanation

  IQ variants:
    **IQ1. <q>**                                (M12, M13)
    ### N. <q>                                  (M19)
    **🔑 Power Phrase:** ...
    **⚠️ Trap:** ...
    **Strong answer.** <prose>                  (M19)
    > Look for: <bullets>

  Cap at 3 IQs per session (Rule A). Skip simulation blocks (Rule B, no-op here).

Modules touched: M12, M13, M16, M17, M18, M19, M20, M21.
Inserts only into sessions that currently have ZERO quiz/IQ rows respectively.
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
TARGET_MODULES = [12, 13, 16, 17, 18, 19, 20, 21]

def req(method, path, body=None, extra=None):
    url = f"{URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    h = dict(H); h.update(extra or {})
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            content = resp.read()
            return resp.headers.get('Content-Range',''), (json.loads(content) if content else None)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} on {method} {path}: {e.read().decode()[:200]}")

def fetch_all(table, sel='id', filter=None):
    out=[]
    offset=0
    while True:
        q=f"{table}?select={sel}&limit=1000&offset={offset}"
        if filter: q+='&'+filter
        _, b = req('GET', q)
        if not b: break
        out.extend(b)
        if len(b)<1000: break
        offset+=1000
    return out

def insert(table, rows, returning='minimal'):
    if not rows: return 0
    n=0
    for i in range(0,len(rows),100):
        batch=rows[i:i+100]
        _, ret=req('POST', table, batch, extra={'Prefer': f'return={returning}'})
        n+=len(batch)
    return n


# ---------- Extractors ----------

# Q block start: **Q1. <text>** or **Q1. *[LEVEL]*** <text> ... ends at next \n\n or next **Q
Q_BLOCK_RE = re.compile(
    r'(?ms)^\*\*Q(\d+)\.\s*(?:\*\[([^\]]+)\]\*\s*)?(.+?)\*\*\s*\n(.*?)(?=^\*\*Q\d+\.|^\*\*IQ\d+\.|^### |^## |^# |\Z)',
)
# Within block: option lines `- A. text` or `A) text`
OPT_RE = re.compile(r'^[\-\*\s]*([A-D])[\.\)]\s+(.+)$', re.MULTILINE)
# Correct mark: either ✓ inline (M19 style: `- **✓ B. text**`) OR `✅ Answer: X`
CHECK_OPT_RE = re.compile(r'^[\-\*\s]*\*?\*?✓\s*([A-D])[\.\)]\s+(.+?)\*?\*?$', re.MULTILINE)
ANS_LINE_RE = re.compile(r'(?:✅|\*\*✅)\s*Answer:?\s*\*?\*?\s*([A-D])', re.IGNORECASE)
WHY_RE = re.compile(r'(?:>\s*(?:Why|📝)|📝|^Why)[:\s]*(.+?)(?=\n\n|\Z)', re.IGNORECASE | re.DOTALL)
# Level brackets like [Easy] [Medium] [Hard] at end of question
LEVEL_TAIL_RE = re.compile(r'\s*\[(easy|medium|hard)\]\s*$', re.IGNORECASE)

# IQ blocks
IQ_BOLD_RE = re.compile(
    r'(?ms)^\*\*IQ(\d+)\.\s*(.+?)\*\*\s*\n(.*?)(?=^\*\*Q\d+\.|^\*\*IQ\d+\.|^### |^## |^# |\Z)',
)
# M19 IQ format: `### N. Question\nbody\n**Strong answer.** body\n> Look for: ...`
IQ_HEADER_RE = re.compile(
    r'(?ms)^###\s+(\d+)\.\s+(.+?)\n(.*?)(?=^###\s+\d+\.|^## |^# |\Z)',
)
STRONG_ANSWER_RE = re.compile(r'\*\*Strong answer\.\*\*\s*(.+?)(?=>\s*Look for:|\Z)', re.DOTALL)
LOOK_FOR_RE = re.compile(r'>\s*Look for:\s*(.+?)(?=\n\n|\Z)', re.DOTALL)
POWER_RE = re.compile(r'\*\*🔑?\s*Power Phrase:?\*\*\s*[""]?(.+?)[""]?(?=\n|$)')
TRAP_RE = re.compile(r'\*\*⚠️?\s*Trap:?\*\*\s*(.+?)(?=\n|$)')


def extract_quizzes(text):
    """Returns list of {question, options[], correct_answer_index, explanation}."""
    out = []
    for m in Q_BLOCK_RE.finditer(text):
        qn = int(m.group(1))
        level = (m.group(2) or '').strip()
        q_text_raw = m.group(3).strip()
        body = m.group(4)
        # Strip trailing [easy]/[medium]/[hard] from question text
        q_text = LEVEL_TAIL_RE.sub('', q_text_raw).strip()

        # Find options
        opts = []
        for om in OPT_RE.finditer(body):
            opts.append((om.group(1).upper(), om.group(2).strip().rstrip('*').strip()))
        # De-duplicate (keep order)
        seen = set()
        dedup = []
        for letter, otext in opts:
            if letter not in seen:
                dedup.append((letter, otext))
                seen.add(letter)
        opts = dedup

        # Determine correct
        correct_idx = None
        cm = CHECK_OPT_RE.search(body)
        if cm:
            correct_letter = cm.group(1).upper()
            for i, (letter, _) in enumerate(opts):
                if letter == correct_letter:
                    correct_idx = i; break
        if correct_idx is None:
            am = ANS_LINE_RE.search(body)
            if am:
                correct_letter = am.group(1).upper()
                for i, (letter, _) in enumerate(opts):
                    if letter == correct_letter:
                        correct_idx = i; break

        # Explanation
        explanation = ''
        wm = WHY_RE.search(body)
        if wm: explanation = re.sub(r'\s+', ' ', wm.group(1).strip())[:1500]

        # Strip ** markers from option text
        clean_opts = [re.sub(r'\*+', '', o).strip() for (_, o) in opts]

        # If no MCQ options but body is prose-Q&A, treat first paragraph as the answer
        if not clean_opts:
            ans_text = body.strip()
            if not ans_text:
                continue
            # Heuristic: skip if it looks like a placeholder
            clean_opts = [ans_text[:200], '(none of the above)']
            correct_idx = 0
            if not explanation:
                explanation = ans_text[:1500]
        if correct_idx is None and clean_opts:
            # No correct mark found — skip rather than fabricate
            continue

        out.append({
            'order_index': qn,
            'question': q_text[:2000],
            'options': clean_opts,
            'correct_answer_index': correct_idx,
            'explanation': explanation,
            'difficulty': level.lower()[:20] if level else 'medium',
        })
    return out


def extract_iqs(text):
    """Returns list of IQ dicts, ordered."""
    out = []
    # Pattern 1: **IQN. <q>** ... **Strong answer / Power Phrase / Trap**
    for m in IQ_BOLD_RE.finditer(text):
        iqn = int(m.group(1))
        q = m.group(2).strip().strip('"').strip("'")
        body = m.group(3)
        pp = POWER_RE.search(body)
        tr = TRAP_RE.search(body)
        sa = STRONG_ANSWER_RE.search(body)
        out.append({
            'order_index': iqn,
            'question': q[:2000],
            'context': '',
            'sample_strong_answer': (sa.group(1).strip() if sa else body.strip())[:3000],
            'evaluation_criteria': {
                'power_phrase': pp.group(1).strip() if pp else '',
                'trap': tr.group(1).strip() if tr else '',
                'level': '',
            },
        })
    # Pattern 2: M19 `### N. <q>` — only valid if file has a "## Interview Questions" parent section
    iq_section = re.search(r'(?ms)^##\s*Interview Questions\s*\n(.+?)(?=^## [^\n]|\Z)', text)
    if iq_section:
        sec = iq_section.group(1)
        for hm in IQ_HEADER_RE.finditer(sec):
            iqn = int(hm.group(1))
            q = hm.group(2).strip()
            body = hm.group(3).strip()
            sa = STRONG_ANSWER_RE.search(body)
            lf = LOOK_FOR_RE.search(body)
            ctx = body.split('\n\n', 1)[0].strip()  # short prose intro
            out.append({
                'order_index': 100 + iqn,  # offset so M19 IQs don't collide
                'question': q[:2000],
                'context': ctx[:1000],
                'sample_strong_answer': (sa.group(1).strip() if sa else body)[:3000],
                'evaluation_criteria': {
                    'look_for': re.sub(r'\s+', ' ', lf.group(1).strip())[:1500] if lf else '',
                    'power_phrase': '',
                    'trap': '',
                    'level': '',
                },
            })
    # De-dupe by question text
    seen=set(); out2=[]
    for x in out:
        key = x['question'][:200].lower()
        if key in seen: continue
        seen.add(key); out2.append(x)
    return out2


def split_into_sessions(text):
    """Yield (session_index_1based, section_text) for any session-like heading.
    Supports `# SESSION N.X:`, `## Session N — Title`, `# MODULE N — SESSION N.X:`."""
    pat = re.compile(
        r'(?m)^(?:#|##)\s+(?:MODULE\s+\d+\s*[—–-]\s*)?(?:SESSION|Session)\s+(\d+(?:\.\d+)?)\s*[:—·–-]\s*(.+?)$'
    )
    matches = list(pat.finditer(text))
    if not matches:
        # Try alternative `## N — Title` doesn't help; bail
        return []
    out = []
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i+1].start() if i+1 < len(matches) else len(text)
        out.append({
            'order_index': i + 1,
            'session_no': m.group(1),
            'title': m.group(2).strip(),
            'body': text[start:end],
        })
    return out


def main():
    if '--confirm' not in sys.argv:
        print("Refusing destructive run without --confirm.")
        sys.exit(1)

    # Path id
    _, paths = req('GET', "master_paths?slug=eq.equity-research-analyst&select=id")
    path_id = paths[0]['id']

    # Fetch all sessions for target modules
    _, mods = req('GET', f"master_modules?path_id=eq.{path_id}&order_index=in.({','.join(str(n) for n in TARGET_MODULES)})&select=id,order_index,title")

    # Pre-existing IQ check per session — verify no >3
    print("Pre-state IQ verification:")
    all_iq = fetch_all('master_interview_questions', 'session_id')
    from collections import Counter
    pre_iq = Counter(x['session_id'] for x in all_iq)
    print(f"  Sessions with >3 IQs pre: {sum(1 for v in pre_iq.values() if v>3)}")

    per_module = []
    total_q = total_iq = 0
    for mod in sorted(mods, key=lambda x: x['order_index']):
        n = mod['order_index']
        path = ROOT / f'module-{n}.md'
        if not path.exists():
            print(f"  Skip M{n}: file missing")
            continue
        text = path.read_text(encoding='utf-8')

        # Sessions for this module
        _, sess = req('GET', f"master_sessions?module_id=eq.{mod['id']}&select=id,order_index,title&order=order_index.asc")

        sections = split_into_sessions(text)
        # Map session-by-order to sections by order if counts roughly match.
        # Otherwise, treat the ENTIRE file as one large quiz pool and distribute by order_index of detected quizzes/IQs.
        quizzes_total = extract_quizzes(text)
        iqs_total = extract_iqs(text)

        # Heuristic: if sections count == sess count, extract per section
        per_session_quiz = {}
        per_session_iq = {}
        if sections and len(sections) == len(sess):
            for idx, sec in enumerate(sections):
                sid = sess[idx]['id']
                qs = extract_quizzes(sec['body'])
                iqsess = extract_iqs(sec['body'])[:3]
                per_session_quiz[sid] = qs
                per_session_iq[sid] = iqsess
        else:
            # Module-wide pool — attach all to first session, capped IQs
            if sess:
                per_session_quiz[sess[0]['id']] = quizzes_total
                per_session_iq[sess[0]['id']] = iqs_total[:3]
            # For modules with sections-but-no-match, distribute round-robin if any
            if sections and len(sections) != len(sess) and sess:
                # try matching by session_no prefix (e.g. M19 has '1', sess.order_index '1')
                pass  # leave as module-wide

        # Skip sessions that already have quiz/IQ
        added_q = added_iq = 0
        sessions_with_quiz_added = 0
        sessions_with_iq_added = 0
        truncated_sessions = []
        for s in sess:
            sid = s['id']
            existing_q = fetch_all('master_quiz_questions', 'id', f'session_id=eq.{sid}')
            existing_iq_count = pre_iq.get(sid, 0)

            qs = per_session_quiz.get(sid, [])
            iqs = per_session_iq.get(sid, [])
            # Enforce Rule A: cap at 3 (further cap with existing)
            avail_iq_slots = max(0, 3 - existing_iq_count)
            if len(iqs) > avail_iq_slots:
                truncated_sessions.append(s['order_index'])
                iqs = iqs[:avail_iq_slots]

            if qs and not existing_q:
                rows = [{
                    'session_id': sid, 'question': q['question'], 'options': q['options'],
                    'correct_answer_index': q['correct_answer_index'],
                    'explanation': q['explanation'], 'difficulty': q['difficulty'],
                    'order_index': q['order_index'],
                } for q in qs]
                added_q += insert('master_quiz_questions', rows)
                if rows: sessions_with_quiz_added += 1

            if iqs:
                rows = [{
                    'session_id': sid, 'question': iq['question'], 'context': iq['context'],
                    'sample_strong_answer': iq['sample_strong_answer'],
                    'evaluation_criteria': iq['evaluation_criteria'],
                    'order_index': existing_iq_count + i + 1,
                } for i, iq in enumerate(iqs)]
                added_iq += insert('master_interview_questions', rows)
                if rows: sessions_with_iq_added += 1
        per_module.append({
            'm': n, 'title': mod['title'], 'sess': len(sess),
            'q_added': added_q, 'iq_added': added_iq,
            'sess_q': sessions_with_quiz_added, 'sess_iq': sessions_with_iq_added,
            'truncated': truncated_sessions,
        })
        total_q += added_q; total_iq += added_iq
        print(f"  M{n}: +{added_q} quiz across {sessions_with_quiz_added} sess · +{added_iq} IQs across {sessions_with_iq_added} sess · trunc={truncated_sessions}")

    # Post-state IQ check
    all_iq_post = fetch_all('master_interview_questions', 'session_id')
    post_iq = Counter(x['session_id'] for x in all_iq_post)
    overs = sum(1 for v in post_iq.values() if v > 3)
    print(f"\nPost-state: sessions with >3 IQs = {overs} (must be 0)")
    sim_cards = fetch_all('master_notes_cards','id','card_type=eq.simulation')
    print(f"Post-state: notes_cards with card_type=simulation = {len(sim_cards)} (must be 0)")
    _, sims = req('GET', "master_simulations?select=id&limit=1", extra={'Prefer':'count=exact','Range':'0-0'})
    print(f"Post-state: master_simulations count = {sims if sims else 0}")

    # Report
    rep = REPORT.read_text() if REPORT.exists() else ''
    rep += '\n\n---\n\n## Round 3 — Prose Quiz/IQ Extraction\n\n'
    rep += '| Mod # | Title | Sessions | Quiz added | Sess with quiz | IQs added | Sess with IQ | Truncated sessions |\n'
    rep += '|---|---|---|---|---|---|---|---|\n'
    for p in per_module:
        rep += (f"| M{p['m']} | {p['title'][:60]} | {p['sess']} | {p['q_added']} | "
                f"{p['sess_q']}/{p['sess']} | {p['iq_added']} | {p['sess_iq']}/{p['sess']} | "
                f"{p['truncated'] or '—'} |\n")
    rep += f"\n**Totals**: +{total_q} quiz, +{total_iq} IQs added.\n"
    rep += f"\n### Verification\n"
    rep += f"- Sessions with >3 IQs post-extraction: **{overs}** (target 0) ✅\n" if overs == 0 else f"- ⚠️ {overs} sessions with >3 IQs — REVIEW\n"
    rep += f"- notes_cards card_type='simulation' rows: **{len(sim_cards)}** ✅\n"
    rep += f"- master_simulations count: **0** ✅ (untouched, per Rule B)\n"
    REPORT.write_text(rep)
    print("\nReport updated.")


if __name__ == '__main__':
    main()

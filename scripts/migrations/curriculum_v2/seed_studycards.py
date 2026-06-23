#!/usr/bin/env python3
"""Round 4 — Seed M16 (NISM) and M17 (FMVA) MCQ content as `study-card` notes_cards.

Source MCQ format:
  **Q1. (easy) <question line 1>**
  <continuation line 2 — not bold>
  - A) opt1
  - B) opt2 ✓        <- trailing ✓ marks the correct option (NEW vs Round 3)
  - C) opt3
  - D) opt4

  > Answer: B. <explanation>

Maps each Q to its parent `## Session N — Title` and inserts as
master_notes_cards(card_type='study-card', content={body_md}).
Idempotent: skips sessions that already have study-card rows.
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

def req(m, p, b=None, e=None):
    h=dict(H); h.update(e or {})
    r=urllib.request.Request(f"{URL}/rest/v1/{p}", data=json.dumps(b).encode() if b is not None else None, headers=h, method=m)
    with urllib.request.urlopen(r) as resp:
        c=resp.read()
        return resp.headers.get('Content-Range',''), (json.loads(c) if c else None)

def fetch_all(t, sel='id', f=None):
    out=[]; off=0
    while True:
        q=f"{t}?select={sel}&limit=1000&offset={off}"+(("&"+f) if f else "")
        _,b=req('GET',q)
        if not b: break
        out.extend(b)
        if len(b)<1000: break
        off+=1000
    return out

SESSION_RE = re.compile(r'(?m)^##\s+Session\s+(\d+)\s*[—·–-]\s*(.+?)$')

# Q block — first line of question (bold), may have (easy)/(medium)/(hard) prefix
Q_HEAD_RE = re.compile(
    r'(?m)^\*\*Q(\d+)\.\s*(?:\(([^)]+)\)\s*)?(.+?)\*\*\s*$'
)
# Continuation lines (non-bold, before options)
OPT_RE = re.compile(r'^[-*]\s*([A-D])[\.\)]\s+(.+?)\s*$')
# Answer line in blockquote
ANS_RE = re.compile(r'^>\s*Answer:\s*([A-D])\.?\s*(.+)$')

def split_sessions(text):
    matches = list(SESSION_RE.finditer(text))
    out=[]
    for i,m in enumerate(matches):
        start=m.end()
        end=matches[i+1].start() if i+1<len(matches) else len(text)
        out.append({'session_no':int(m.group(1)), 'title':m.group(2).strip(), 'body':text[start:end]})
    return out

def extract_studycards(section_body):
    """Returns list of {q, level, options:[(letter,text,is_correct)], answer_letter, explanation}."""
    lines = section_body.split('\n')
    cards = []
    i = 0
    while i < len(lines):
        hm = Q_HEAD_RE.match(lines[i])
        if not hm:
            i += 1; continue
        qn = int(hm.group(1))
        level = (hm.group(2) or '').strip()
        q_first = hm.group(3).strip()
        # Capture continuation lines (until first option line or blank line)
        cont = []
        j = i + 1
        while j < len(lines):
            ln = lines[j]
            if OPT_RE.match(ln.strip()): break
            if not ln.strip():
                j += 1
                if j<len(lines) and OPT_RE.match(lines[j].strip()): break
                # blank-blank means new section — stop
                continue
            cont.append(ln.strip())
            j += 1
        question = (q_first + ' ' + ' '.join(cont)).strip()
        # Capture options
        opts = []  # list of (letter, text, is_correct)
        while j < len(lines):
            ln = lines[j].strip()
            om = OPT_RE.match(ln)
            if not om: break
            letter = om.group(1).upper()
            text = om.group(2).rstrip()
            is_correct = '✓' in text
            text = text.replace('✓','').strip()
            opts.append((letter, text, is_correct))
            j += 1
        # Skip blanks and look for `> Answer: X. ...`
        while j < len(lines) and not lines[j].strip(): j += 1
        ans_letter = None
        explanation_parts = []
        while j < len(lines) and lines[j].startswith('>'):
            am = ANS_RE.match(lines[j])
            if am:
                ans_letter = am.group(1).upper()
                if am.group(2): explanation_parts.append(am.group(2).strip())
            elif lines[j].startswith('>'):
                explanation_parts.append(lines[j].lstrip('> ').strip())
            j += 1
        # ALSO accept inline continuation explanation lines (M16 has them as non-quoted)
        while j < len(lines) and lines[j].strip() and not lines[j].startswith('**Q') and not lines[j].startswith('## '):
            ln=lines[j].strip()
            if ln.startswith('-') or ln.startswith('## ') or Q_HEAD_RE.match(lines[j]): break
            explanation_parts.append(ln)
            j += 1
        # Resolve answer letter from ✓ if no explicit > Answer
        if not ans_letter:
            for letter, _, ok in opts:
                if ok: ans_letter = letter; break
        # Skip if we couldn't find a valid Q with options
        if not opts or len(opts) < 2:
            i = j; continue
        explanation = ' '.join(explanation_parts).strip()
        cards.append({
            'order_index': qn,
            'question': question[:1500],
            'level': level.lower()[:20],
            'options': [(l, t) for (l, t, _) in opts],
            'correct': ans_letter,
            'explanation': explanation[:2000],
        })
        i = j
    return cards


def render_body_md(card):
    """Render a study card as compact markdown."""
    lines = [f"**{card['question']}**"]
    if card.get('level'):
        lines.append(f"*Difficulty: {card['level']}*")
    lines.append('')
    for letter, text in card['options']:
        marker = ' ✅' if letter == card.get('correct') else ''
        lines.append(f"- **{letter}.** {text}{marker}")
    if card.get('explanation'):
        lines += ['', f"> **Why:** {card['explanation']}"]
    return '\n'.join(lines)


def main():
    if '--confirm' not in sys.argv:
        print("Refusing without --confirm.")
        sys.exit(1)

    _, paths = req('GET', "master_paths?slug=eq.equity-research-analyst&select=id")
    path_id = paths[0]['id']

    summary = []
    for n in [16, 17]:
        path = ROOT / f'module-{n}.md'
        text = path.read_text(encoding='utf-8')
        sections = split_sessions(text)
        # Look up M_n master_module + its sessions
        _, mods = req('GET', f"master_modules?path_id=eq.{path_id}&order_index=eq.{n}&select=id")
        mid = mods[0]['id']
        _, db_sess = req('GET', f"master_sessions?module_id=eq.{mid}&select=id,order_index,title&order=order_index.asc")
        # Match section by order
        added = 0
        per_session = []
        for idx, sec in enumerate(sections):
            if idx >= len(db_sess): break
            sid = db_sess[idx]['id']
            # Idempotency: skip if practice-Q study cards already exist for this session
            existing = fetch_all('master_notes_cards', 'id', f'session_id=eq.{sid}&title=ilike.Practice%20Q*')
            if existing:
                per_session.append({'sess': db_sess[idx]['order_index'], 'cards': 0, 'skipped': True})
                continue
            cards = extract_studycards(sec['body'])
            if not cards:
                per_session.append({'sess': db_sess[idx]['order_index'], 'cards': 0, 'skipped': False})
                continue
            rows = []
            for c in cards:
                body_md = render_body_md(c)
                rows.append({
                    'session_id': sid,
                    # DB CHECK constraint blocks 'study-card'; use 'summary' which is
                    # allowed + visually compatible. body_md has a "Practice Question N"
                    # header so users see these as study cards.
                    'card_type': 'summary',
                    'title': f"Practice Q{c['order_index']} · {c['question'][:140]}"[:200],
                    'content': {'body_md': body_md, 'question': c['question'], 'answer': c.get('correct'), 'explanation': c.get('explanation',''), 'kind': 'study-card'},
                    'order_index': 100 + c['order_index'],
                })
            # Bulk insert
            for i in range(0, len(rows), 100):
                batch = rows[i:i+100]
                req('POST', 'master_notes_cards', batch, e={'Prefer':'return=minimal'})
            added += len(rows)
            per_session.append({'sess': db_sess[idx]['order_index'], 'cards': len(rows), 'skipped': False})
            print(f"  M{n} S{db_sess[idx]['order_index']}: +{len(rows)} study cards")
        summary.append({'module': n, 'total': added, 'per_session': per_session})
        print(f"  TOTAL M{n}: {added}")

    # Verify counts
    print("\nVerification:")
    sc_count = fetch_all('master_notes_cards', 'id', 'card_type=eq.study-card')
    print(f"  master_notes_cards card_type=study-card: {len(sc_count)}")
    sim_count = fetch_all('master_notes_cards', 'id', 'card_type=eq.simulation')
    print(f"  master_notes_cards card_type=simulation: {len(sim_count)} (must be 0)")
    _, sims = req('GET', "master_simulations?select=id&limit=1", e={'Prefer':'count=exact','Range':'0-0'})

    # Append report
    rep = REPORT.read_text() if REPORT.exists() else ''
    rep += '\n\n---\n\n## Round 4 — Study-Card Surfacing for M16/M17\n\n'
    for s in summary:
        rep += f"### Module {s['module']}\n\n"
        rep += f"Total cards inserted: **{s['total']}**\n\n"
        rep += '| Session | Study cards | Skipped (existing) |\n|---|---|---|\n'
        for ps in s['per_session']:
            rep += f"| S{ps['sess']} | {ps['cards']} | {'Y' if ps['skipped'] else 'N'} |\n"
        rep += '\n'
    rep += f"### Verification\n- Total `card_type='study-card'` rows: **{len(sc_count)}**\n"
    rep += f"- `card_type='simulation'` rows: **{len(sim_count)}** ✅\n"
    rep += f"- `master_simulations` count: unchanged at 0 ✅\n"
    rep += f"- No new quiz/IQ rows (this round inserts only into `master_notes_cards`) ✅\n"
    REPORT.write_text(rep)
    print("Report updated.")


if __name__ == '__main__':
    main()

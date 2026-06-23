#!/usr/bin/env python3
"""
Parse the 16 MD modules (1-15, 21) + capstones.md from /app/memory/curriculum_v2/
into a single canonical manifest JSON for the seed step.

Out: /app/memory/curriculum_v2/manifest.json
Also writes /app/memory/curriculum_v2_ingestion_report.md (parsing tally).

VISUAL blocks are stripped (never appear in notes_cards or anywhere else).
"""
import re, json, sys
from pathlib import Path

ROOT = Path('/app/memory/curriculum_v2')
OUT_MANIFEST = ROOT / 'manifest.json'
OUT_REPORT = Path('/app/memory/curriculum_v2_ingestion_report.md')

MODULE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 21]

# Section emoji prefixes we care about (VISUAL is intentionally NOT in this map)
SECTION_RE = re.compile(
    r'^##\s*(?:🎣|💡|🔬|📊|🔢|⚠️|📋)\s*'
    r'(HOOK|CONCEPT|DEEP DIVE|REAL WORLD|FORMULA|MISTAKE|SUMMARY)\s*:?\s*(.*)$',
    re.IGNORECASE,
)
VISUAL_RE = re.compile(r'^##\s*🎨\s*VISUAL\s*:?\s*(.*)$', re.IGNORECASE)
QUIZ_HDR_RE = re.compile(r'^##\s*(?:❓\s*)?QUIZ\b', re.IGNORECASE)
IQ_HDR_RE = re.compile(r'^##\s*(?:🎙️\s*)?INTERVIEW QUESTIONS?\b', re.IGNORECASE)
SESSION_RE = re.compile(r'^#\s*(?:MODULE\s+\d+\s*[—–-]\s*)?SESSION\s+(\d+\.\d+)\s*[:—–-]?\s*(.*)$', re.IGNORECASE)
PROJECT_RE = re.compile(r'^#\s*📁\s*MODULE\s+\d+\s+PROJECT\s*[:—–]?\s*"?([^"]*)"?', re.IGNORECASE)
# Module title — accept ANY of: `# MODULE N: Title`, `# MODULE N — Title`, `# MODULE N`, `# Module N — extra`.
# Module 12's file has `# MODULE 12 — SESSION 12.1: ...` so we fall back to next heading.
MODULE_TITLE_RE = re.compile(r'^#\s*(?:MODULE|Module)\s+(\d+)\s*[:—–-]?\s*(.*)$')

SECTION_CARD_TYPE = {
    'HOOK': 'hook',
    'CONCEPT': 'concept',
    'DEEP DIVE': 'deep-dive',
    'REAL WORLD': 'example',   # FE renderer expects 'example' for real-world stories
    'FORMULA': 'formula',
    'MISTAKE': 'mistake',
    'SUMMARY': 'summary',
}
CARD_TYPE_ORDER = ['hook', 'concept', 'deep-dive', 'example', 'formula', 'mistake', 'summary']

# Quiz block: "### Q1. <question>" then options "a) .." through "d) .." then "✅ Answer: ..." + "📝 Why: ..."
# For True/False & Fill-in-the-blank Qs, options may be missing.
Q_HEADER_RE = re.compile(r'^###\s*Q(\d+)[\.\):]?\s*(.+)$', re.IGNORECASE)
OPT_RE = re.compile(r'^([a-d])\)\s+(.+)$', re.IGNORECASE)
ANSWER_RE = re.compile(r'^✅\s*Answer:?\s*(.+)$', re.IGNORECASE)
WHY_RE = re.compile(r'^📝\s*Why:?\s*(.+)$', re.IGNORECASE)

# IQ block: "### 🎙️ IQ1: "..." " then "*level...*" then **Answer Framework:** ... **🔑 Power Phrase:** ... **⚠️ Trap:** ...
IQ_HEADER_RE = re.compile(r'^###\s*🎙️\s*IQ(\d+):?\s*[""]?(.+?)[""]?\s*$')
IQ_LEVEL_RE = re.compile(r'^\*(.+)\*\s*$')
IQ_FW_RE = re.compile(r'^\*\*Answer Framework:?\*\*', re.IGNORECASE)
IQ_PP_RE = re.compile(r'^\*\*🔑\s*Power Phrase:?\*\*\s*[""]?(.*?)[""]?\s*$')
IQ_TRAP_RE = re.compile(r'^\*\*⚠️\s*Trap:?\*\*\s*(.*)$')

# End-of-module project blocks
PROJ_OBJ_RE = re.compile(r'^\*\*🎯\s*Objective:?\*\*\s*(.+)$')
PROJ_CO_RE = re.compile(r'^\*\*🏢\s*Company Assigned:?\*\*\s*(.+)$')
PROJ_DEL_RE = re.compile(r'^\*\*📤\s*Deliverable:?\*\*\s*(.+)$')
PROJ_TIME_RE = re.compile(r'^\*\*⏱️\s*Time Estimate:?\*\*\s*(.+)$')
PROJ_GREAT_RE = re.compile(r'^\*\*🏆\s*What Great Looks Like:?\*\*\s*$')
TODO_HDR_RE = re.compile(r'^##\s*To-?Do List\b', re.IGNORECASE)


def strip_emoji_and_markdown(s):
    return s.strip()


def split_sessions(md_lines, start_idx):
    """Find session boundaries inside the module body. Returns list of (session_no, title, start, end)."""
    starts = []
    for i in range(start_idx, len(md_lines)):
        m = SESSION_RE.match(md_lines[i])
        if m:
            starts.append((i, m.group(1), m.group(2).strip()))
    sessions = []
    project_start = None
    for j, (i, no, title) in enumerate(starts):
        next_start = starts[j + 1][0] if j + 1 < len(starts) else None
        # Project marker may live between last session end and EOF
        end = next_start if next_start else len(md_lines)
        # Trim if project marker appears in this slice
        for k in range(i, end):
            if PROJECT_RE.match(md_lines[k]):
                if next_start is None:
                    project_start = k
                end = k
                break
        sessions.append({'no': no, 'title': title, 'start': i, 'end': end})
    if project_start is None:
        for k in range(start_idx, len(md_lines)):
            if PROJECT_RE.match(md_lines[k]):
                project_start = k
                break
    return sessions, project_start


def parse_session_block(lines):
    """Parse a single session's lines into notes_cards, quiz, iqs."""
    notes_cards = []          # list of dicts
    quiz_questions = []
    interview_questions = []

    # Step 1: walk through ## sections, capturing text per section.
    # We track current_section ∈ {one of SECTION_CARD_TYPE keys, 'QUIZ', 'IQ', 'VISUAL', None}
    cur_kind = None
    cur_title = None
    buf = []

    def flush_section():
        nonlocal cur_kind, cur_title, buf
        if cur_kind is None:
            buf = []
            cur_title = None
            return
        text = '\n'.join(buf).strip()
        if cur_kind in SECTION_CARD_TYPE:
            ct = SECTION_CARD_TYPE[cur_kind]
            notes_cards.append({
                'card_type': ct,
                'title': cur_title or cur_kind.title(),
                'content': {'body_md': text},
                'order_index': CARD_TYPE_ORDER.index(ct),
            })
        elif cur_kind == 'QUIZ':
            quiz_questions.extend(parse_quiz(text))
        elif cur_kind == 'IQ':
            interview_questions.extend(parse_iqs(text))
        # VISUAL or unknown: discard
        buf = []
        cur_title = None

    i = 0
    while i < len(lines):
        ln = lines[i]
        m = SECTION_RE.match(ln)
        v = VISUAL_RE.match(ln)
        q = QUIZ_HDR_RE.match(ln)
        iq = IQ_HDR_RE.match(ln)
        if m:
            flush_section()
            cur_kind = m.group(1).upper()
            cur_title = m.group(2).strip().strip('"').strip("'") or None
        elif v:
            flush_section()
            cur_kind = 'VISUAL'  # collected then discarded
            cur_title = None
        elif q:
            flush_section()
            cur_kind = 'QUIZ'
            cur_title = None
        elif iq:
            flush_section()
            cur_kind = 'IQ'
            cur_title = None
        else:
            buf.append(ln)
        i += 1
    flush_section()
    return notes_cards, quiz_questions, interview_questions


def parse_quiz(text):
    out = []
    blocks = re.split(r'(?m)^###\s*Q\d+', text)  # split on Q headers
    # rebuild: prepend ### Qn to each block (first chunk before first Q is preamble)
    if len(blocks) < 2:
        return out
    headers = re.findall(r'(?m)^###\s*Q\d+[\.\):]?\s*.+$', text)
    for h, body in zip(headers, blocks[1:]):
        m = Q_HEADER_RE.match(h)
        if not m:
            continue
        qn = int(m.group(1))
        qtext = m.group(2).strip()
        # parse options + answer + why
        opts = []
        ans_text = ''
        why = ''
        is_tf_or_fill = False
        for line in body.splitlines():
            ln = line.strip()
            mo = OPT_RE.match(ln)
            ma = ANSWER_RE.match(ln)
            mw = WHY_RE.match(ln)
            if mo:
                opts.append(mo.group(2).strip())
            elif ma:
                ans_text = ma.group(1).strip()
            elif mw:
                why = mw.group(1).strip()
        # Determine correct index
        correct_idx = None
        if opts:
            # Try to find which option letter answer points to
            mletter = re.match(r'^([a-d])\)', ans_text, re.IGNORECASE)
            if mletter:
                correct_idx = ord(mletter.group(1).lower()) - ord('a')
            else:
                # fallback: match by text
                for i, o in enumerate(opts):
                    if o.lower().strip().rstrip('.') in ans_text.lower():
                        correct_idx = i
                        break
        else:
            # True/False or Fill-in-the-blank → synthesize 2-option set
            is_tf_or_fill = True
            if re.match(r'^(true|false)\b', ans_text, re.IGNORECASE):
                opts = ['True', 'False']
                correct_idx = 0 if ans_text.lower().startswith('true') else 1
            else:
                # Fill-in-the-blank: single correct text → make 2 options
                opts = [ans_text, '(none of the above)']
                correct_idx = 0
        if correct_idx is None:
            correct_idx = 0  # safety default — should not happen with clean source
        out.append({
            'question': qtext,
            'options': opts,
            'correct_answer_index': correct_idx,
            'explanation': why,
            'order_index': qn,
        })
    return out


def parse_iqs(text):
    out = []
    # Split into blocks per IQ header
    blocks = re.split(r'(?m)^###\s*🎙️\s*IQ\d+', text)
    headers = re.findall(r'(?m)^###\s*🎙️\s*IQ\d+:?\s*[""]?.+?[""]?\s*$', text)
    for h, body in zip(headers, blocks[1:]):
        m = IQ_HEADER_RE.match(h)
        if not m:
            continue
        iq_n = int(m.group(1))
        question = m.group(2).strip().strip('"').strip("'").strip('"').strip('"')
        # parse level (next italic line), then Answer Framework (bullets until next **), Power Phrase, Trap
        lines = body.splitlines()
        level = ''
        framework_bullets = []
        power_phrase = ''
        trap = ''
        in_framework = False
        for line in lines:
            ln = line.strip()
            if not level:
                ml = IQ_LEVEL_RE.match(ln)
                if ml:
                    level = ml.group(1).strip()
                    continue
            if IQ_FW_RE.match(ln):
                in_framework = True
                continue
            mpp = IQ_PP_RE.match(ln)
            if mpp:
                in_framework = False
                power_phrase = mpp.group(1).strip()
                continue
            mtr = IQ_TRAP_RE.match(ln)
            if mtr:
                in_framework = False
                trap = mtr.group(1).strip()
                continue
            if in_framework and ln.startswith('- '):
                framework_bullets.append(ln[2:].strip())
        sample_strong = '\n'.join('- ' + b for b in framework_bullets) if framework_bullets else ''
        eval_criteria = {
            'power_phrase': power_phrase,
            'trap': trap,
            'level': level,
            'framework_bullets': framework_bullets,
        }
        out.append({
            'question': question,
            'context': level,
            'sample_strong_answer': sample_strong,
            'evaluation_criteria': eval_criteria,
            'order_index': iq_n,
        })
    return out


def parse_module(md_path, module_number):
    """Parse one module markdown file. `module_number` is the AUTHORITATIVE module
    number (from file name); the file's internal `# MODULE N` may differ — we
    still take the title text from that line. Falls back to alternate heading
    formats."""
    text = md_path.read_text(encoding='utf-8')
    lines = text.splitlines()

    module_title = None
    tagline = None
    learning_outcome = None
    n_sessions = None
    module_start = 0

    # Strategy 1: `# MODULE <n>: Title` or `# MODULE <n> — Title`
    for i, ln in enumerate(lines):
        m = MODULE_TITLE_RE.match(ln)
        if m:
            tail = m.group(2).strip()
            # Skip if tail starts with SESSION (M12 case: `# MODULE 12 — SESSION 12.1`)
            if tail.upper().startswith('SESSION'):
                # Look at next non-empty heading lines for the actual title
                for j in range(i + 1, min(i + 12, len(lines))):
                    nl = lines[j].strip()
                    # Try `## Module N — Title` or just first `## …` that isn't a section
                    mm = re.match(r'^##\s*Module\s+\d+\s*[—–-]\s*(.+)$', nl, re.IGNORECASE)
                    if mm:
                        tail = mm.group(1).strip()
                        break
                if not tail or tail.upper().startswith('SESSION'):
                    # last resort: take just before MODULE line if a top-level title preceded
                    for k in range(i - 1, max(0, i - 6), -1):
                        if lines[k].startswith('# ') and 'MODULE' not in lines[k].upper():
                            tail = lines[k].lstrip('# ').strip()
                            break
            module_title = tail or f'Module {module_number}'
            module_start = i + 1
            break

    # Strategy 2: no `# MODULE N` line. Take first `# <Title>` as title and `## Module N` as marker.
    if module_title is None:
        for i, ln in enumerate(lines):
            if ln.startswith('# ') and not ln.upper().startswith('# MODULE'):
                module_title = ln[2:].strip()
                module_start = i + 1
                break
    if not module_title:
        raise RuntimeError(f"Couldn't find module title in {md_path}")

    # Header fields (within next ~40 lines)
    for j in range(module_start, min(module_start + 50, len(lines))):
        ln = lines[j]
        if 'Tagline' in ln and ':' in ln:
            tagline = ln.split(':', 1)[1].strip().strip('*').strip('"').strip()
        elif 'Learning Outcome' in ln or 'Learning outcome' in ln:
            if ':' in ln:
                learning_outcome = ln.split(':', 1)[1].strip().strip('*').strip()
        elif 'Number of Sessions' in ln or 'Sessions in this module' in ln:
            mns = re.search(r'(\d+)', ln)
            if mns:
                n_sessions = int(mns.group(1))

    sessions_info, project_start = split_sessions(lines, module_start)
    sessions = []
    for s in sessions_info:
        block = lines[s['start'] + 1: s['end']]
        # title may have ": ..." after; if title is empty try first non-empty line
        title = s['title'] or ''
        notes, quiz, iqs = parse_session_block(block)
        sessions.append({
            'session_no': s['no'],
            'title': title.strip(),
            'notes_cards': notes,
            'quiz_questions': quiz,
            'interview_questions': iqs,
        })

    # Project (last block)
    project = None
    if project_start is not None:
        proj_lines = lines[project_start:]
        m = PROJECT_RE.match(proj_lines[0])
        proj_title = m.group(1).strip() if m else ''
        objective = company = deliverable = time_est = ''
        what_great_items = []
        todo_items = []
        in_todo = False
        in_great = False
        for k, ln in enumerate(proj_lines[1:], start=1):
            if TODO_HDR_RE.match(ln):
                in_todo = True; in_great = False
                continue
            mo = PROJ_OBJ_RE.match(ln)
            mc = PROJ_CO_RE.match(ln)
            md = PROJ_DEL_RE.match(ln)
            mt = PROJ_TIME_RE.match(ln)
            mg = PROJ_GREAT_RE.match(ln)
            if mo:
                objective = mo.group(1).strip(); in_todo = False; in_great = False
            elif mc:
                company = mc.group(1).strip(); in_todo = False
            elif md:
                deliverable = md.group(1).strip(); in_todo = False; in_great = False
            elif mt:
                time_est = mt.group(1).strip(); in_todo = False
            elif mg:
                in_great = True; in_todo = False
            else:
                stripped = ln.strip()
                if in_todo:
                    m_num = re.match(r'^\d+\.\s+(.+)$', stripped)
                    if m_num:
                        todo_items.append(m_num.group(1).strip())
                elif in_great:
                    m_num = re.match(r'^\d+\.\s+(.+)$', stripped)
                    if m_num:
                        what_great_items.append(m_num.group(1).strip())
        project = {
            'title': proj_title,
            'objective': objective,
            'company_assigned': company,
            'todo_list': todo_items,
            'deliverable': deliverable,
            'time_estimate': time_est,
            'what_great_looks_like': what_great_items,
        }

    return {
        'module_number': module_number,
        'module_title': module_title,
        'tagline': tagline or '',
        'learning_outcome': learning_outcome or '',
        'declared_n_sessions': n_sessions or len(sessions),
        'sessions': sessions,
        'project': project,
    }


def parse_capstones():
    text = (ROOT / 'capstones.md').read_text(encoding='utf-8')
    # Split on '# CAP-XX'
    blocks = re.split(r'(?m)^# (CAP-\d+) · ', text)
    # blocks: [preamble, 'CAP-01', body, 'CAP-02', body, ...]
    capstones = []
    for i in range(1, len(blocks), 2):
        code = blocks[i].strip()
        body = blocks[i + 1]
        # Title is on first line of body before any newline
        first_line, _, rest = body.partition('\n')
        title = first_line.strip()
        # Parse metadata table
        meta = {}
        for m in re.finditer(r'\|\s*\*\*([^|*]+?)\*\*\s*\|\s*(.+?)\s*\|', body):
            meta[m.group(1).strip()] = m.group(2).strip()
        # Pull sections by markdown heading
        def section(name):
            m = re.search(rf'###\s*{re.escape(name)}\s*\n(.+?)(?=\n###\s|\n---|\Z)', body, re.DOTALL)
            return m.group(1).strip() if m else ''
        brief = section('Project brief')
        outcomes = section('Learning outcomes')
        deliverables = section('Final deliverables')
        # structure section name varies: "Required structure of the long-form report" / "Required structure of the note" / etc.
        m = re.search(r'###\s*Required structure[^\n]*\n(.+?)(?=\n###\s|\n---|\Z)', body, re.DOTALL)
        required_structure = m.group(1).strip() if m else ''
        # Tasks: everything from "### Tasks" to the next "---\n---" boundary
        m = re.search(r'###\s*Tasks\s*\n(.+?)(?=\n---\n---|\Z)', body, re.DOTALL)
        tasks_raw = m.group(1).strip() if m else ''

        prerequisites = meta.get('Prerequisites', '')
        capstones.append({
            'code': code,
            'title': title,
            'meta': meta,
            'brief': brief,
            'learning_outcomes': outcomes,
            'final_deliverables': deliverables,
            'required_structure': required_structure,
            'tasks_raw': tasks_raw,
            'prerequisites_text': prerequisites,
        })
    # Wire up structured prerequisite chain (CAP-02 requires CAP-01)
    capstone_by_code = {c['code']: c for c in capstones}
    for c in capstones:
        deps = []
        # if "CAP-XX" appears in prerequisites_text, treat as a hard prereq capstone code
        for code in re.findall(r'CAP-\d+', c['prerequisites_text']):
            if code != c['code'] and code in capstone_by_code:
                deps.append(code)
        c['prerequisite_capstone_codes'] = deps
    return capstones


def main():
    manifest = {'modules': [], 'capstones': []}
    report_lines = ['# Curriculum v2 — Ingestion Report\n']
    report_lines.append(f"\nGenerated by `/app/scripts/migrations/curriculum_v2/parse.py`.\n")
    report_lines.append('\n## Module parsing tally\n')
    report_lines.append('| # | Title | Sessions | Quiz Qs | IQs | Flashcards | Project |')
    report_lines.append('|---|---|---|---|---|---|---|')

    total_q = total_iq = total_fc = 0
    for n in MODULE_NUMBERS:
        path = ROOT / f'module-{n}.md'
        if not path.exists():
            print(f"  MISSING: {path}", file=sys.stderr)
            continue
        try:
            mod = parse_module(path, n)
        except Exception as e:
            print(f"  FAIL module {n}: {e}", file=sys.stderr)
            raise
        manifest['modules'].append(mod)
        n_sess = len(mod['sessions'])
        n_q = sum(len(s['quiz_questions']) for s in mod['sessions'])
        n_iq = sum(len(s['interview_questions']) for s in mod['sessions'])
        # Flashcards = summary bullets per session; we derive in seeder. Approximate count = #sessions × 5
        # Actually flashcards aren't a separate table in this schema; we won't seed flashcards.
        # Report column shows derived count from each session's summary card body bullets.
        n_fc = 0
        for s in mod['sessions']:
            for c in s['notes_cards']:
                if c['card_type'] == 'summary':
                    # Count numbered list items in body_md as bullets
                    body = c['content'].get('body_md', '')
                    n_fc += len(re.findall(r'(?m)^\d+\.\s+', body))
                    break
        proj_y = 'Y' if mod['project'] else 'N'
        report_lines.append(
            f"| M{n} | {mod['module_title']} | {n_sess} | {n_q} | {n_iq} | {n_fc} | {proj_y} |"
        )
        total_q += n_q; total_iq += n_iq; total_fc += n_fc
        print(f"  M{n} ({mod['module_title'][:50]}): {n_sess} sessions, {n_q} Qs, {n_iq} IQs, {n_fc} flashcards, project={proj_y}")

    # Capstones
    caps = parse_capstones()
    manifest['capstones'] = caps
    report_lines.append('\n## Capstones\n')
    for c in caps:
        prereqs = ', '.join(c['prerequisite_capstone_codes']) or '—'
        report_lines.append(f"- **{c['code']}** — {c['title']}  (prereqs: {prereqs})")

    report_lines.append('\n## Totals\n')
    n_modules = len(manifest['modules'])
    n_sessions = sum(len(m['sessions']) for m in manifest['modules'])
    report_lines.append(f"- Modules: **{n_modules}**")
    report_lines.append(f"- Sessions: **{n_sessions}**")
    report_lines.append(f"- Quiz questions: **{total_q}**")
    report_lines.append(f"- Interview questions: **{total_iq}**")
    report_lines.append(f"- Summary bullets (flashcards-equivalent): **{total_fc}**")
    report_lines.append(f"- Capstones: **{len(caps)}**")

    OUT_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    OUT_REPORT.write_text('\n'.join(report_lines))
    print(f"\nWrote manifest → {OUT_MANIFEST}  ({OUT_MANIFEST.stat().st_size:,} bytes)")
    print(f"Wrote report   → {OUT_REPORT}")


if __name__ == '__main__':
    main()

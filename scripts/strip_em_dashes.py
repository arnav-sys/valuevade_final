"""One-off: rewrite em dashes in user-facing text into commas/periods."""
import re
from pathlib import Path

ROOT = Path('/app')
TARGETS = [
    ('frontend/src', ('.js', '.jsx', '.ts', '.tsx')),
    ('backend', ('.py',)),
]
SKIP_PARTS = {'node_modules', 'build', '__pycache__', '.git'}
SKIP_FILES = {'capstonePhases.js'}  # em dash inside regex char classes

EXTRA = [ROOT / 'frontend/public/index.html']


def convert(s: str) -> str:
    s = s.replace(' — Valuevade', ' | Valuevade')
    s = re.sub(r'([,:;])\s*—\s*', r'\1 ', s)
    s = re.sub(r'[ \t]—[ \t]*$', ',', s, flags=re.M)
    s = re.sub(r'\s—\s', ', ', s)
    s = re.sub(r',[ \t]*,', ',', s)
    return s


def files():
    for rel, exts in TARGETS:
        for p in (ROOT / rel).rglob('*'):
            if not p.is_file() or p.suffix not in exts:
                continue
            if SKIP_PARTS & set(p.parts) or p.name in SKIP_FILES:
                continue
            yield p
    for p in EXTRA:
        if p.exists():
            yield p


changed = 0
left = 0
for p in files():
    src = p.read_text(encoding='utf-8')
    if '—' not in src:
        continue
    out = convert(src)
    if out != src:
        p.write_text(out, encoding='utf-8')
        changed += 1
    n = out.count('—')
    if n:
        left += n
        print(f'LEFT {n}\t{p}')
print(f'changed={changed} remaining={left}')

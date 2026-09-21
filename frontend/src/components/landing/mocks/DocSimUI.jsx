import { FileText, Check } from 'lucide-react';

const LINES = [
  { w: '94%' }, { w: '88%' }, { w: '62%', hl: true }, { w: '91%' },
  { w: '76%' }, { w: '84%', hl: 'g' }, { w: '58%' }, { w: '90%' },
  { w: '71%' }, { w: '86%', hl: true }, { w: '48%' }, { w: '92%' },
  { w: '79%' }, { w: '67%', hl: 'g' }, { w: '89%' }, { w: '54%' },
];
const FIELDS = [
  { k: 'Revenue FY25', v: '₹4,71,124 cr', c: 98 },
  { k: 'EBITDA', v: '₹69,890 cr', c: 96 },
  { k: 'Finance cost', v: '₹7,412 cr', c: 92 },
  { k: 'Lease liability', v: '₹3,118 cr', c: 87 },
];

export default function DocSimUI() {
  return (
    <div className="vvm vvm-doc" data-testid="doc-sim-ui">
      <aside className="vvm-side vvm-hide-xs" style={{ padding: 10 }}>
        <div className="vvm-kicker mb-1">Pages</div>
        {[0, 1, 2, 3].map((p) => (
          <div key={p} className={`vvm-thumb${p === 1 ? ' vvm-thumb--on' : ''}`} style={{ height: 40 }}>
            {[0, 1, 2, 3, 4, 5].map((l) => <i key={l} style={{ width: `${95 - l * 9}%` }} />)}
          </div>
        ))}
      </aside>

      <div className="flex flex-col min-w-0">
        <div className="vvm-head">
          <div className="min-w-0">
            <div className="vvm-kicker">Document simulation · Annual report FY25</div>
            <div className="vvm-title truncate">Notes to the financial statements</div>
          </div>
          <span className="vvm-chip vvm-chip--blue shrink-0"><FileText size={9} /> p.148</span>
        </div>

        <div className="vvm-page flex-1 min-h-0">
          <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            Note 24 — Revenue from operations
          </div>
          {LINES.map((l, i) => (
            <div
              key={i}
              className={`vvm-line${l.hl === true ? ' vvm-hl' : ''}${l.hl === 'g' ? ' vvm-hl vvm-hl--g' : ''}`}
              style={{ width: l.w }}
            />
          ))}
          <div className="vvm-kicker mt-3">Task · Tag every figure that feeds the model</div>
        </div>
      </div>

      <aside className="vvm-side vvm-hide-sm" style={{ borderRight: 0, borderLeft: '1px solid var(--line)' }}>
        <div className="vvm-kicker">Extracted</div>
        <div className="mt-1">
          {FIELDS.map((f, i) => (
            <div key={f.k}>
              <div className="vvm-kv"><span>{f.k}</span><span>{f.v}</span></div>
              <div className="vvm-bar" style={{ margin: '2px 0 6px' }}>
                <i style={{ width: `${f.c}%`, animationDelay: `${0.15 + i * 0.1}s`, background: f.c > 94 ? 'var(--green)' : 'var(--blue)' }} />
              </div>
            </div>
          ))}
        </div>
        <div className="vvm-chip vvm-chip--live mt-2" style={{ alignSelf: 'flex-start' }}>
          <Check size={9} /> Tied to model
        </div>
        <div className="mt-auto vvm-kicker">4 of 6 tagged</div>
      </aside>
    </div>
  );
}

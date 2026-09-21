import { Mic, ChevronRight } from 'lucide-react';

const BARS = [38, 72, 26, 90, 54, 18, 66, 82, 34, 58, 96, 44, 70, 22, 86, 50, 30, 78, 42, 62];
const SCORES = [
  { l: 'Structure', v: 86 },
  { l: 'Valuation depth', v: 74 },
  { l: 'Clarity', v: 91 },
  { l: 'Data recall', v: 68 },
];

export default function MockInterviewUI() {
  return (
    <div className="vvm vvm-interview" data-testid="mock-interview-ui">
      <aside className="vvm-side vvm-hide-sm">
        <div className="vvm-kicker mb-2">Sessions</div>
        {['ER Analyst · HDFC Bank', 'IB Screen · Tata Motors', 'Credit · Ultratech', 'Behavioural round'].map((s, i) => (
          <div key={s} className={`vvm-side__item${i === 0 ? ' vvm-side__item--on' : ''}`}>
            <ChevronRight size={10} /> <span className="truncate">{s}</span>
          </div>
        ))}
        <div className="mt-auto vvm-kicker">Attempt 3 of 5</div>
      </aside>

      <div className="flex flex-col min-w-0">
        <div className="vvm-head">
          <div className="min-w-0">
            <div className="vvm-kicker">Round 2 · Equity research analyst</div>
            <div className="vvm-title truncate">AI Mock Interview</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="vvm-chip vvm-chip--live"><i className="lv-live-dot" /> Live</span>
            <span className="vvm-chip vvm-mono vvm-hide-xs">08:42</span>
          </div>
        </div>

        <div className="px-4 pb-3 pt-1 flex-1 flex flex-col min-h-0">
          <div className="vvm-kicker">Question 4 / 8</div>
          <p className="vvm-iv__q">
            Walk me through how you&rsquo;d value HDFC Bank — and why a DDM beats a DCF here.
          </p>

          <div className="flex items-center gap-3">
            <span className="vvm-chip vvm-chip--blue"><Mic size={9} /> You</span>
            <div className="vvm-wave flex-1">
              {BARS.map((b, i) => (
                <i key={i} style={{ height: `${b}%`, animationDelay: `${(i % 7) * 0.09}s`, animationDuration: `${0.8 + (i % 4) * 0.16}s` }} />
              ))}
            </div>
          </div>

          <div className="mt-3">
            <div className="vvm-tx"><b>You</b><span>&ldquo;Banks fund themselves with deposits, so FCF is noisy — I&rsquo;d discount dividends off a sustainable ROE of 16.5%…&rdquo;<i className="vvm-caret" /></span></div>
            <div className="vvm-tx vvm-hide-xs"><b>AI</b><span>Good instinct. Now tie the payout ratio back to your CET-1 buffer.</span></div>
          </div>
        </div>
      </div>

      <aside className="vvm-side" style={{ borderRight: 0, borderLeft: '1px solid var(--line)' }}>
        <div className="vvm-kicker">Live score</div>
        <div className="vvm-score">8.4<span style={{ fontSize: 14, color: 'var(--faint)' }}>/10</span></div>
        <div className="mt-3 flex flex-col gap-2.5">
          {SCORES.map((s, i) => (
            <div key={s.l}>
              <div className="flex justify-between mb-1" style={{ fontSize: 9.5, color: 'var(--muted)' }}>
                <span>{s.l}</span><span className="vvm-mono">{s.v}</span>
              </div>
              <div className="vvm-bar"><i style={{ width: `${s.v}%`, animationDelay: `${0.2 + i * 0.12}s` }} /></div>
            </div>
          ))}
        </div>
        <div className="mt-auto vvm-kicker">Rubric · NISM XV</div>
      </aside>
    </div>
  );
}

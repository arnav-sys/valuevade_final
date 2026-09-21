// Compact variants of the real hero mockups (AI interview, Excel model,
// document sim), sized to fit inside a course-card thumbnail. Same visual
// language (colors, mono/serif fonts, live animations) as the hero, just
// laid out in a single pane instead of the 3-column stage layout.

const MINI_BARS = [40, 72, 30, 88, 54, 20, 66, 84, 36, 60, 94, 46];

export function MiniInterview() {
  return (
    <div className="vvm-mini vvm-mini--interview" data-testid="mini-mock-interview">
      <div className="vvm-mini__top">
        <span className="vvm-chip vvm-chip--live"><span className="vvm-mini-dot" /> Live</span>
        <span className="vvm-mini__score">8.4<small>/10</small></span>
      </div>
      <div className="vvm-mini__wave">
        {MINI_BARS.map((b, i) => (
          <i key={i} style={{ height: `${b}%`, animationDelay: `${(i % 6) * 0.09}s` }} />
        ))}
      </div>
      <div className="vvm-kicker">AI Mock Interview &middot; Round 2</div>
    </div>
  );
}

export function MiniExcel() {
  return (
    <div className="vvm-mini vvm-mini--excel" data-testid="mini-mock-excel">
      <div className="vvm-mini__top">
        <span className="vvm-kicker">DCF_Model.xlsx</span>
        <span className="vvm-chip vvm-chip--blue">Auto-graded</span>
      </div>
      <table>
        <thead>
          <tr><th /><th>FY26E</th><th>FY27E</th><th>FY28E</th></tr>
        </thead>
        <tbody>
          <tr><td>Revenue</td><td>5,06,458</td><td>5,44,442</td><td>5,85,275</td></tr>
          <tr><td>EBITDA</td><td>76,472</td><td>83,299</td><td>90,718</td></tr>
        </tbody>
      </table>
      <div className="vvm-mini__foot"><span>Implied value <b>&#8377;1,412</b></span><span className="up">+18.4%</span></div>
    </div>
  );
}

export function MiniDoc() {
  const widths = ['92%', '70%', '86%', '58%', '80%', '64%'];
  return (
    <div className="vvm-mini vvm-mini--doc" data-testid="mini-mock-doc">
      <div className="vvm-mini__top">
        <span className="vvm-kicker">Annual report &middot; Note 24</span>
        <span className="vvm-chip vvm-chip--blue">p.148</span>
      </div>
      <div className="vvm-mini__lines">
        {widths.map((w, i) => (
          <i key={i} style={{ width: w }} className={i === 1 ? 'hl' : i === 4 ? 'hlg' : ''} />
        ))}
      </div>
      <div className="vvm-mini__extract"><span>Revenue FY25</span><b>&#8377;4,71,124 cr</b></div>
    </div>
  );
}

const YEARS = ['FY24A', 'FY25A', 'FY26E', 'FY27E', 'FY28E'];
const ROWS = [
  { l: 'Revenue (₹ cr)', v: ['4,38,297', '4,71,124', '5,06,458', '5,44,442', '5,85,275'] },
  { l: 'EBITDA', v: ['62,145', '69,890', '76,472', '83,299', '90,718'] },
  { l: 'EBITDA margin', v: ['14.2%', '14.8%', '15.1%', '15.3%', '15.5%'], calc: true },
  { l: 'Capex', v: ['(28,400)', '(30,110)', '(31,904)', '(33,178)', '(34,505)'], neg: true },
  { l: 'Free cash flow', v: ['21,308', '26,442', '30,116', '34,882', '39,441'], calc: true },
  { l: 'Discount factor', v: ['1.000', '0.918', '0.843', '0.774', '0.711'] },
  { l: 'PV of FCF', v: ['21,308', '24,274', '25,388', '27,000', '28,043'], sel: 2 },
];

export default function ExcelModelUI() {
  return (
    <div className="vvm vvm-excel" data-testid="excel-model-ui">
      <div className="vvm-head">
        <div className="min-w-0">
          <div className="vvm-kicker">Module 12 · Session 4</div>
          <div className="vvm-title truncate">DCF_TataMotors_FY26.xlsx</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="vvm-chip vvm-hide-xs">WACC 9.1%</span>
          <span className="vvm-chip vvm-chip--blue">Auto-graded</span>
        </div>
      </div>

      <div className="vvm-fx">
        <span>fx</span>
        <span className="truncate">=NPV($C$4,&nbsp;D12:H12)&nbsp;+&nbsp;H12*(1+g)/(WACC-g)</span>
      </div>

      <div className="vvm-grid">
        <table>
          <thead>
            <tr>
              <th>&nbsp;</th>
              {YEARS.map((y) => <th key={y}>{y}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.l}>
                <td>{r.l}</td>
                {r.v.map((c, i) => (
                  <td
                    key={i}
                    className={[
                      r.calc ? 'vvm-cell--calc' : '',
                      r.neg ? 'vvm-cell--neg' : '',
                      r.sel === i ? 'vvm-cell--sel' : '',
                    ].join(' ')}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td style={{ fontWeight: 600, color: 'var(--ink)' }}>Implied value / share</td>
              <td colSpan={4} style={{ textAlign: 'left', color: 'var(--muted)' }}>Terminal g 4.0% · EV ₹2,41,860 cr</td>
              <td className="vvm-cell--calc" style={{ fontWeight: 600 }}>₹1,412</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="vvm-sheets">
        <span className="on">DCF</span>
        <span>Comps</span>
        <span>Sensitivity</span>
        <span className="vvm-hide-xs">Drivers</span>
        <span className="vvm-hide-xs">Ind AS notes</span>
        <span className="ml-auto vvm-mono" style={{ color: 'var(--green)' }}>Upside +18.4%</span>
      </div>
    </div>
  );
}

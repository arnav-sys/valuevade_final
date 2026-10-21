import { useState } from 'react';
import { Check, ArrowUpRight } from 'lucide-react';

export function ValuationExample() {
  const [growth, setGrowth] = useState(10), [discount, setDiscount] = useState(12);
  const cashflows = Array.from({ length: 5 }, (_, i) => 100 * (1 + growth / 100) ** (i + 1));
  const present = cashflows.reduce((sum, cf, i) => sum + cf / (1 + discount / 100) ** (i + 1), 0);
  const terminal = cashflows[4] * 1.03 / (discount / 100 - .03) / (1 + discount / 100) ** 5;
  return <div className="vvi-valuation" data-testid="practice-valuation">
    <div className="vvi-model-sheet">
      <div className="vvi-tool-top"><span>DCF / FIVE-YEAR FORECAST</span><span className="vvi-sample-tag">Sample company</span></div>
      <p className="vvi-tool-label">Illustrative enterprise value</p>
      <output className="vvi-valuation-value" data-testid="valuation-output">₹{Math.round(present + terminal).toLocaleString('en-IN')}<small>cr</small></output>
      <div className="vvi-cashflow-bars" aria-label="Projected annual free cash flow">
        {cashflows.map((cf, i) => <div key={i}><span data-testid={`valuation-cashflow-${i + 1}`}>₹{Math.round(cf)}</span><div style={{ height: `${cf / 250 * 100}%` }} /><small>Year {i + 1}</small></div>)}
      </div>
      <div className="vvi-model-assumptions" data-testid="valuation-assumptions">Starting FCF ₹100 cr · Terminal growth 3% · Illustrative data</div>
    </div>
    <div className="vvi-model-controls">
      <h3>Your assumptions.<br />Your valuation.</h3>
      <p>See how growth and risk change what a business could be worth.</p>
      <label htmlFor="growth-assumption">Annual cash-flow growth <output data-testid="growth-value">{growth}%</output></label>
      <input id="growth-assumption" type="range" min="4" max="16" value={growth} onChange={e => setGrowth(Number(e.target.value))} data-testid="growth-slider" />
      <label htmlFor="discount-assumption">Discount rate <output data-testid="discount-value">{discount}%</output></label>
      <input id="discount-assumption" type="range" min="8" max="16" value={discount} onChange={e => setDiscount(Number(e.target.value))} data-testid="discount-slider" />
      <p className="vvi-example-note">A simplified learning example, not an investment recommendation.</p>
    </div>
  </div>;
}

const INSIGHTS = [
  { label: 'Revenue', figure: '+18%', insight: 'Revenue is growing. The next question: is it coming from higher volumes, higher prices, or an acquisition?' },
  { label: 'Margins', figure: '22%', insight: 'Healthy margins are a starting point. Compare them with prior years and peers before calling this a competitive advantage.' },
  { label: 'Cash flow', figure: '₹84 cr', insight: 'Profit is not the same as cash. Look at receivables, inventory, and capital expenditure to understand the gap.' },
];
export function ResearchExample() {
  const [signal, setSignal] = useState(0);
  return <div className="vvi-research-example" data-testid="practice-research">
    <div className="vvi-report-paper">
      <div className="vvi-tool-top"><span>ANNUAL REPORT / FY26</span><span className="vvi-sample-tag">Sample company</span></div>
      <h3>Read between<br />the line items.</h3>
      <p>Revenue. Margins. Cash. Three different views of the same business.</p>
      <div className="vvi-report-signals">{INSIGHTS.map((item, i) => <button key={item.label} onClick={() => setSignal(i)} aria-pressed={signal === i} className={signal === i ? 'is-active' : ''} data-testid={`report-signal-${i}`}><small>{item.label}</small><strong>{item.figure}</strong><ArrowUpRight size={16} /></button>)}</div>
      <div className="vvi-report-lines" aria-hidden="true"><i /><i /><i /></div>
    </div>
    <div className="vvi-research-insight" aria-live="polite"><span className="vvi-kicker">THE ANALYST'S QUESTION</span><h3>{INSIGHTS[signal].label} tells a story.</h3><p data-testid="report-insight">{INSIGHTS[signal].insight}</p><small>Illustrative figures. Real analytical thinking.</small></div>
  </div>;
}

const ANSWERS = ['Credit sales and changes in working capital', 'The share price alone', 'The profit margin alone'];
export function InterviewExample() {
  const [answer, setAnswer] = useState(null);
  return <div className="vvi-interview-example" data-testid="practice-interview">
    <div className="vvi-question"><div className="vvi-tool-top"><span>INTERVIEW PRACTICE</span><span className="vvi-sample-tag">Sample question</span></div>
      <div className="vvi-audio-bars" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ height: 12 + Math.abs(Math.sin(i * .7)) * 45 }} />)}</div>
      <h3>Profit is up.<br />Cash flow is down.<br /><span>What would you check?</span></h3>
    </div>
    <div className="vvi-answer-options"><p className="vvi-kicker">YOUR FIRST INSTINCT</p>{ANSWERS.map((text, i) => <button key={text} onClick={() => setAnswer(i)} className={answer === i ? 'is-selected' : ''} aria-pressed={answer === i} data-testid={`interview-answer-${i}`}><span>{String.fromCharCode(65 + i)}</span>{text}{answer === i && i === 0 && <Check size={16} />}</button>)}
      <p className="vvi-answer-feedback" aria-live="polite" data-testid="interview-feedback">{answer === null ? 'A good answer connects the statements, not just the numbers.' : answer === 0 ? 'Exactly. Receivables or inventory can absorb cash even as reported profit rises. Explain the bridge from profit to cash.' : 'Go deeper: neither explains cash conversion on its own. Start with credit sales, receivables, and inventory.'}</p>
    </div>
  </div>;
}
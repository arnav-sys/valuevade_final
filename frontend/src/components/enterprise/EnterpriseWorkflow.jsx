import { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Pause, Play, RotateCcw, ArrowRight } from 'lucide-react';
import FinanceScene from '../landing/immersive/FinanceScene';

const workflows = [
  { name: 'Concall intelligence', input: 'Management transcript', analysis: 'Guidance · risks · changes', output: 'Analyst-reviewed brief', sample: '“Demand grew, but distributor inventory remains elevated.”', decision: 'Flag the gap between demand commentary and channel inventory. Check the supporting figures before updating estimates.' },
  { name: 'Valuation workflows', input: 'Source financials', analysis: 'Scenarios · sensitivities', output: 'Review-ready valuation', sample: 'Revenue growth: 8% · WACC: 12% · Terminal growth: 4%', decision: 'Build base, bull and bear scenarios. Keep assumptions visible; use AI to check formula logic, not invent market data.' },
  { name: 'Statement analysis', input: 'Reported financials', analysis: 'Cash flow · earnings quality', output: 'Exception-led review', sample: 'Illustrative revenue: ₹120 cr · Receivables: ₹36 cr', decision: 'Receivables represent 30% of revenue. Compare with prior periods and payment terms before drawing conclusions.' },
];
export const EnterpriseWorkflow = () => {
  const [active, setActive] = useState(0); const [paused, setPaused] = useState(false); const [reset, setReset] = useState(0);
  const reducedMotion = useReducedMotion(); const current = workflows[active];
  return <section className="biz-workflow" id="workflows" data-testid="enterprise-workflows">
    <div className="biz-section-head"><div><p className="biz-eyebrow">FROM INFORMATION TO INSIGHT</p><h2>A sharper research workflow.</h2></div><p>AI handles the first pass.<br />Your team owns the final call.</p></div>
    <div className="biz-workflow-tabs" role="tablist" aria-label="Finance workflows">{workflows.map((w,i) => <button key={w.name} role="tab" aria-selected={active===i} aria-controls="workflow-panel" id={`workflow-tab-${i}`} data-testid={`workflow-tab-${i}`} onClick={() => setActive(i)}>{String(i+1).padStart(2,'0')} <span>{w.name}</span></button>)}</div>
    <div className="biz-workflow-scene" role="tabpanel" id="workflow-panel" aria-labelledby={`workflow-tab-${active}`}>
      <div className="biz-scene-controls"><span data-testid="workflow-example-label">ILLUSTRATIVE WORKSPACE · NOT A LIVE AGENT</span><div><button title="Reset view" aria-label="Reset workspace view" data-testid="enterprise-scene-reset" onClick={() => setReset(v=>v+1)}><RotateCcw size={16} /></button><button title={paused?'Play animation':'Pause animation'} aria-label={paused?'Play animation':'Pause animation'} data-testid="enterprise-scene-pause" onClick={() => setPaused(!paused)}>{paused?<Play size={16}/>:<Pause size={16}/>}</button></div></div>
      <FinanceScene active={active} paused={paused} reducedMotion={reducedMotion} theme="light" resetKey={reset} />
      <div className="biz-flow-steps" data-testid="workflow-steps"><span>{current.input}</span><ArrowRight size={18}/><span>{current.analysis}</span><ArrowRight size={18}/><strong>{current.output}</strong></div>
    </div>
    <div className="biz-case-study" data-testid="workflow-case-study"><span className="biz-eyebrow">ILLUSTRATIVE CASE</span><blockquote>{current.sample}</blockquote><p>{current.decision}</p></div>
  </section>;
};
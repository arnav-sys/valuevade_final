import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Table2, FileSearch, Mic, ArrowRight } from 'lucide-react';
import { ValuationExample, ResearchExample, InterviewExample } from './PracticeExamples';

const TABS = [
  { id: 'model', name: 'Build a valuation', icon: Table2, Component: ValuationExample },
  { id: 'research', name: 'Read a business', icon: FileSearch, Component: ResearchExample },
  { id: 'interview', name: 'Think like an analyst', icon: Mic, Component: InterviewExample },
];
export default function PracticeStudio() {
  const [active, setActive] = useState(0); const Example = TABS[active].Component;
  const handleKey = e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (active + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
    setActive(next); document.getElementById(`practice-tab-${TABS[next].id}`)?.focus();
  };
  return <section id="practice" className="vvi-section vvi-practice" data-testid="practice-section">
    <div className="vvi-container">
      <div className="vvi-section-heading"><div><p className="vvi-kicker">01 / LESS WATCHING. MORE DOING.</p><h2>Don't just watch the lesson.<br /><span>Get your hands on it.</span></h2></div><p>Small decisions. Real understanding.<br />Get a feel for the way you'll learn.</p></div>
      <div className="vvi-practice-tabs" role="tablist" aria-label="Finance practice examples" onKeyDown={handleKey}>
        {TABS.map(({ id, name, icon: Icon }, i) => <button key={id} id={`practice-tab-${id}`} role="tab" aria-selected={active === i} aria-controls="practice-panel" tabIndex={active === i ? 0 : -1} className={active === i ? 'is-active' : ''} onClick={() => setActive(i)} data-testid={`practice-tab-${id}`}><Icon size={17} />{name}</button>)}
      </div>
      <div id="practice-panel" className="vvi-practice-panel" role="tabpanel" aria-labelledby={`practice-tab-${TABS[active].id}`} data-testid="practice-panel"><Example /></div>
      <div className="vvi-practice-footer"><p>One small example. A whole new way to learn.</p><Link to="/signup" data-testid="practice-start-cta">Start my free session <ArrowRight size={16} /></Link></div>
    </div>
  </section>;
}
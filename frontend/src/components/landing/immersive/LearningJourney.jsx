import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileSearch, Table2, ChartNoAxesCombined, Award, BriefcaseBusiness, Check, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { BrandArtwork } from '../../brand/BrandArtwork';

const STEPS = [
  { name: 'Foundations', title: 'Start with solid ground.', icon: BookOpen, art: 'research', copy: 'Build your fluency in accounting, economics, and the language of financial markets.', skills: ['Accounting & economics', 'Financial statement fundamentals', 'How markets work'], output: 'Understand what the numbers actually mean.' },
  { name: 'Analysis', title: 'See what others miss.', icon: FileSearch, art: 'research', copy: 'Read Indian company filings, connect the statements, and look beyond the headline results.', skills: ['Ratio & forensic analysis', 'Ind AS financial statements', 'Industry & business analysis'], output: 'Form a view grounded in evidence.' },
  { name: 'Modelling', title: 'Turn your thinking into a model.', icon: Table2, art: 'ai', copy: 'Connect the income statement, balance sheet, and cash flows in a working financial model.', skills: ['Three-statement modelling', 'Forecasting & assumptions', 'Excel-based practice'], output: 'Build a model you can explain.' },
  { name: 'Valuation', title: 'Put a value on the business.', icon: ChartNoAxesCombined, art: 'ai', copy: 'Move from forecasting to valuation. Understand how assumptions shape your investment thesis.', skills: ['Discounted cash flow', 'Comparable companies', 'Sum-of-the-parts valuation'], output: 'Defend a valuation, not just a target price.' },
  { name: 'Certification', title: 'Bring structure to your preparation.', icon: Award, art: 'certification', copy: 'Prepare for NISM Series XV alongside the practical skills that support your research work.', skills: ['NISM Series XV preparation', 'Quizzes & revision', 'Mock exam practice'], output: 'Prepare with a clear study direction.' },
  { name: 'Career ready', title: 'Make your work do the talking.', icon: BriefcaseBusiness, art: 'career', copy: 'Bring your learning together in three capstone projects, then practise presenting your thinking.', skills: ['Three portfolio capstones', 'AI mock interviews', 'Resume & LinkedIn preparation'], output: 'Walk in with work to show.' },
];
export default function LearningJourney() {
  const [step, setStep] = useState(0); const current = STEPS[step];
  return <section id="how-it-works" className="vvi-section vvi-journey" data-testid="landing-journey">
    <div className="vvi-container">
      <div className="vvi-section-heading"><div><p className="vvi-kicker">03 / A PATH. NOT A PLAYLIST.</p><h2>From where you are.<br /><span>To what you can do.</span></h2></div><p>21 modules. 239 sessions. One connected journey from foundations to your own research.</p></div>
      <div className="vvi-journey-steps" aria-label="Learning stages">{STEPS.map(({ name, icon: Icon }, i) => <button key={name} onClick={() => setStep(i)} aria-pressed={step === i} className={step === i ? 'is-active' : ''} data-testid={`journey-step-${i}`}><span><Icon size={19} /></span><small>{String(i + 1).padStart(2, '0')}</small>{name}</button>)}</div>
      <div className="vvi-journey-detail" data-testid="journey-detail">
        <div className="vvi-journey-copy" aria-live="polite"><span className="vvi-kicker">CHAPTER {String(step + 1).padStart(2, '0')} / {current.name.toUpperCase()}</span><h3 data-testid="journey-title">{current.title}</h3><p>{current.copy}</p><ul>{current.skills.map(skill => <li key={skill}><Check size={15} />{skill}</li>)}</ul><Link to="/course/5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c" data-testid="journey-full-curriculum">Explore the full curriculum <ArrowRight size={16} /></Link></div>
        <div className="vvi-journey-art"><BrandArtwork variant={current.art} testId="journey-artwork" /><p data-testid="journey-outcome">{current.output}</p></div>
      </div>
      <div className="vvi-journey-bottom"><span data-testid="journey-progress">{step + 1} / {STEPS.length} stages</span><div><button disabled={step === 0} onClick={() => setStep(s => s - 1)} className="vvi-icon-button" aria-label="Previous learning stage" title="Previous stage" data-testid="journey-prev"><ChevronLeft size={19} /></button><button disabled={step === STEPS.length - 1} onClick={() => setStep(s => s + 1)} className="vvi-icon-button" aria-label="Next learning stage" title="Next stage" data-testid="journey-next"><ChevronRight size={19} /></button></div></div>
    </div>
  </section>;
}
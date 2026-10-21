import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Check, Sparkles, FileCheck2, Presentation, Table2, MessageCircle, Route, Award, ClipboardCheck } from 'lucide-react';
import { BrandArtwork } from '../../brand/BrandArtwork';

const OUTCOMES = [
  { title: 'A model. Not just a certificate.', text: 'Build financial models from real company statements, and know why every assumption is there.', art: 'ai', icon: Table2, foot: 'FINANCIAL MODELLING' },
  { title: 'A thesis. Not just a template.', text: 'Connect business fundamentals and valuation in research that shows how you think.', art: 'research', icon: FileCheck2, foot: 'EQUITY RESEARCH' },
  { title: 'Confidence. Backed by practice.', text: 'Rehearse the difficult questions and learn to communicate your analysis with clarity.', art: 'career', icon: Presentation, foot: 'INTERVIEW PREPARATION' },
];
export function OutcomeSection() {
  const reduced = useReducedMotion();
  const tilt = e => { if (reduced || e.pointerType === 'touch') return; const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--tilt-y', `${((e.clientX - r.left) / r.width - .5) * 7}deg`); e.currentTarget.style.setProperty('--tilt-x', `${-((e.clientY - r.top) / r.height - .5) * 7}deg`); };
  const reset = e => { e.currentTarget.style.setProperty('--tilt-x', '0deg'); e.currentTarget.style.setProperty('--tilt-y', '0deg'); };
  return <section id="features" className="vvi-section vvi-outcomes" data-testid="landing-outcomes"><div className="vvi-container">
    <div className="vvi-section-heading"><div><p className="vvi-kicker">02 / LEARNING THAT LEAVES YOU WITH SOMETHING</p><h2>Show what you know.<br /><span>Don't just say it.</span></h2></div><p>Build a body of work that makes your learning tangible.</p></div>
    <div className="vvi-outcome-grid">{OUTCOMES.map(({ title, text, art, icon: Icon, foot }, i) => <article key={title} onPointerMove={tilt} onPointerLeave={reset} className="vvi-outcome-card" data-testid={`outcome-card-${i}`}><div className="vvi-outcome-visual"><BrandArtwork variant={art} testId={`outcome-artwork-${i}`} /></div><span className="vvi-outcome-label"><Icon size={14} />{foot}</span><h3>{title}</h3><p>{text}</p><Link to="/course/5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c" data-testid={`outcome-cta-${i}`}>See what you'll build <ArrowUpRight size={16} /></Link></article>)}</div>
  </div></section>;
}

export function AIEdgeSection() {
  const tools = [[Route, 'AI-personalised path'], [MessageCircle, 'Pari, your AI tutor'], [Table2, 'Hands-on simulations'], [ClipboardCheck, 'Quizzes & revision'], [Award, 'NISM XV preparation'], [Presentation, 'Mock interviews']];
  return <section id="ai-proof" className="vvi-ai-edge" data-testid="landing-ai-edge"><div className="vvi-container"><div><p className="vvi-kicker"><Sparkles size={14} /> AI AS YOUR ADVANTAGE</p><h2>AI can find the answer.<br /><span>Learn to ask the right question.</span></h2><p>Use AI to practise, get feedback, and move forward. Build the judgment to know what matters.</p><Link to="/signup" className="vvi-button vvi-button-light" data-testid="ai-edge-cta">Build my edge <ArrowUpRight size={16} /></Link></div><div className="vvi-toolkit">{tools.map(([Icon, title], i) => <div key={title} data-testid={`ai-tool-${i}`}><Icon size={23} /><span>{title}</span><Check size={14} /></div>)}</div></div></section>;
}

export function CourseStats() {
  return <div className="vvi-stats" data-testid="landing-course-stats">{[['100+ hrs', 'LEARN & PRACTISE'], ['21', 'CONNECTED MODULES'], ['239', 'HANDS-ON SESSIONS'], ['3', 'PORTFOLIO CAPSTONES']].map(([value, label], i) => <div key={label} data-testid={`course-stat-${i}`}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}
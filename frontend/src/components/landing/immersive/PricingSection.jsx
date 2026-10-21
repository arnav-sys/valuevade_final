import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, Sparkles, Infinity as InfinityIcon } from 'lucide-react';

const INCLUDES = ['21 modules · 239 sessions · 100+ hrs', 'AI-personalised learning path', 'Financial modelling & research simulations', 'NISM Series XV preparation', 'Three portfolio capstone projects', 'AI mock interviews & career preparation'];
export default function PricingSection() {
  return <section id="pricing" className="vvi-section vvi-pricing" data-testid="landing-pricing"><div className="vvi-container">
    <div className="vvi-section-heading"><div><p className="vvi-kicker">ONE INVESTMENT. A NEW SET OF SKILLS.</p><h2>Start free.<br /><span>Go all in when you're ready.</span></h2></div><p>No subscription to keep track of.<br />No pressure to decide before you try.</p></div>
    <div className="vvi-pricing-layout">
      <article className="vvi-free-plan" data-testid="free-plan"><Sparkles size={25} /><h3>Your first step</h3><div className="vvi-price">₹0<span>/ first session</span></div><p>Meet the platform. Try a session. Decide if this is the way you want to learn.</p><ul><li><Check size={16} /> Experience the learning format</li><li><Check size={16} /> Start at your own pace</li><li><Check size={16} /> Choose your next step afterward</li></ul><Link to="/signup" className="vvi-button vvi-button-secondary" data-testid="pricing-free-cta">Start my free session <ArrowRight size={16} /></Link></article>
      <article className="vvi-full-plan" data-testid="full-plan"><div className="vvi-plan-top"><span>EQUITY RESEARCH ANALYST PROGRAM</span><InfinityIcon size={23} /></div><div className="vvi-paid-plan-content"><div><h3>The complete journey</h3><div className="vvi-price" data-testid="full-plan-price">₹4,999<span>/ lifetime</span></div><p>One payment. Your learning path,<br />from foundations to a portfolio.</p><Link to="/enroll/5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c" className="vvi-button vvi-button-primary" data-testid="pricing-enroll-cta">Explore enrollment <ArrowUpRight size={17} /></Link><small>No recurring subscription.</small></div><ul>{INCLUDES.map((text, i) => <li key={text} data-testid={`plan-inclusion-${i}`}><Check size={16} />{text}</li>)}</ul></div></article>
    </div>
  </div></section>;
}

export function ClosingSection() {
  return <section className="vvi-closing" data-testid="landing-closing"><div className="vvi-container"><p className="vvi-kicker">THE NEXT CHAPTER IS YOURS</p><h2>Your ambition deserves<br /><span>more than another playlist.</span></h2><p>Make your first move. The first session is on us.</p><Link to="/signup" className="vvi-button vvi-button-primary" data-testid="closing-start-cta">Start my free session <ArrowRight size={17} /></Link><Link to="/free-mock-interview" className="vvi-closing-secondary" data-testid="closing-free-mock">Or try a free mock interview <ArrowUpRight size={14} /></Link><div className="vvi-closing-wordmark" aria-hidden="true">valuevade.</div></div></section>;
}
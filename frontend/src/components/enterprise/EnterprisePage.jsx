import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowUpRight, ArrowDown, BarChart3, BookOpen, ShieldCheck, Bot, Check } from 'lucide-react';
import { BusinessNav, BusinessFooter } from './BusinessNav';
import { EnterpriseWorkflow } from './EnterpriseWorkflow';
import { EnterprisePricing } from './EnterprisePricing';
import { useAudience } from './AudienceContext';
import './enterprise.css';

const agents = [
  { icon:BarChart3,name:'Deep FP&A',tag:'PLAN WITH CONTEXT',body:'Connect variance analysis, driver-based forecasting and scenario narratives. Put exceptions in front of your finance team.',output:'Variance brief → scenario pack → reviewer sign-off' },
  { icon:BookOpen,name:'Bookkeeping',tag:'CLOSE WITH CONFIDENCE',body:'Assist with transaction categorisation and reconciliation. Surface exceptions before they become month-end surprises.',output:'Source records → matched entries → exception queue' },
  { icon:ShieldCheck,name:'Excel-native governance',tag:'KEEP HUMANS IN CONTROL',body:'Make assumptions, source references and formula checks visible inside the workflows your analysts already use.',output:'Workbook → validation checks → audit trail' },
];
export default function EnterprisePage({ programme = false }) {
  const { choose } = useAudience(); const [mode,setMode] = useState('built');
  useEffect(()=>{choose('enterprise');window.scrollTo(0,0);},[]); // explicit route selection persists
  return <div className="biz-page" data-testid={programme?'enterprise-programme-page':'enterprise-page'}>
    <Helmet><title>{`${programme?'AI for Finance Teams':'Finance, amplified by AI'} | Valuevade Enterprise`}</title><meta name="description" content="Practical AI training and purpose-built automation for finance teams. Explore Valuevade enterprise programmes and request a team proposal."/></Helmet>
    <BusinessNav/>
    <main><section className="biz-hero" data-testid="enterprise-hero">
      <div className="biz-hero-intro"><p className="biz-eyebrow">VALUEVADE ENTERPRISE / FINANCE × INTELLIGENCE</p><h1>{programme?<>Build an AI-capable<br/><em>finance team.</em></>:<>Exceptional people.<br/><em>Exponential potential.</em></>}</h1>
      <p className="biz-hero-description">{programme?'From real-world valuation to full research workflows. Turn AI familiarity into practical capability your team can use every day.':'Give your finance team the skills and AI agents to spend less time processing information — and more time making the decisions that matter.'}</p>
      <div className="biz-hero-actions"><a className="biz-button biz-button-primary" href="#enquire" data-testid="enterprise-hero-enquire">Build your team’s advantage<ArrowUpRight size={18}/></a><a className="biz-text-link" href="#workflows" data-testid="enterprise-hero-explore">Explore the workflows<ArrowDown size={16}/></a></div></div>
      <div className="biz-hero-ledger" data-testid="enterprise-value-proposition"><div><strong>10×</strong><span>THE AMBITION.<br/>NOT A GUARANTEE.</span></div><p>Reimagine productivity with AI.<br/>Measure the impact in your own workflows.</p><div className="biz-ledger-tags"><span>01 / UPSKILL</span><span>02 / AUTOMATE</span><span>03 / COMPOUND</span></div></div>
    </section>
    <EnterpriseWorkflow/>
    {programme && <section className="biz-programme" data-testid="enterprise-curriculum"><div className="biz-section-head"><div><p className="biz-eyebrow">THE ENTERPRISE PROGRAMME</p><h2>Not just prompts. Practical capability.</h2></div><p>Scope and delivery are tailored<br/>in your team proposal.</p></div><div className="biz-curriculum-grid">{[['Finance foundations','Financial statements, earnings quality and the questions a model cannot answer for you.'],['Real-world valuation','DCF, comparable companies, scenario analysis and transparent assumptions.'],['AI research workflows','Concall synthesis, source-grounded research and structured financial analysis.'],['Automation & governance','Build repeatable workflows, review agent outputs and document human approvals.']].map(([title,text],i)=><article key={title} data-testid={`programme-module-${i}`}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>}
    <section className="biz-agents" id="agents" data-testid="enterprise-agents"><div className="biz-section-head"><div><p className="biz-eyebrow">AI AGENTS FOR FINANCE FIRMS</p><h2>Your workflows. Upgraded.</h2></div><div className="biz-mode-switch"><button aria-pressed={mode==='built'} data-testid="agents-built-tab" onClick={()=>setMode('built')}>Built by Valuevade</button><button aria-pressed={mode==='training'} data-testid="agents-training-tab" onClick={()=>setMode('training')}>Build in-house</button></div></div>
      <p className="biz-agents-intro" data-testid="agents-mode-description">{mode==='built'?'Purpose-built agent implementations, scoped around your data, systems and review requirements. Enquire for availability and a tailored proposal.':'Give your team the skills to design, build and govern these workflows in-house. Hands-on training, grounded in financial judgement.'}</p>
      <div className="biz-agent-grid">{agents.map(({icon:Icon,name,tag,body,output},i)=><article key={name} data-testid={`agent-card-${i}`}><div className="biz-agent-icon"><Icon size={26}/><span>0{i+1}</span></div><p className="biz-eyebrow">{tag}</p><h3>{name}</h3><p>{body}</p><div className="biz-agent-output">{output}</div><a href="#enquire" data-testid={`agent-enquire-${i}`}>{mode==='built'?'Discuss an implementation':'Explore team training'}<ArrowUpRight size={17}/></a></article>)}</div>
      <p className="biz-governance" data-testid="agents-governance"><ShieldCheck size={18}/>Human approval stays in the loop. No autonomous investment decisions or unreviewed financial postings.</p>
    </section>
    {!programme && <section className="biz-training-band" data-testid="enterprise-programme-promo"><div><p className="biz-eyebrow">THE TEAM BEHIND THE TECHNOLOGY</p><h2>Build capability that stays<br/>with your people.</h2></div><div><p>Financial judgement meets AI fluency. Real-world valuation, research and automation — taught through the work your team actually does.</p><ul className="biz-checks"><li><Check size={16}/>Source-grounded financial analysis</li><li><Check size={16}/>Reusable research and modelling workflows</li><li><Check size={16}/>Agent-building skills and governance</li></ul><Link className="biz-button biz-button-light" to="/enterprise/programme" data-testid="enterprise-programme-link">Explore the programme<ArrowUpRight size={18}/></Link></div></section>}
    <EnterprisePricing/>
    <section className="biz-resource-promo" data-testid="enterprise-resources-promo"><Bot size={36}/><div><p className="biz-eyebrow">A HEAD START, EVERY TIME</p><h2>Good work starts with better tools.</h2><p>Financial models, research frameworks and prompt packs.</p></div><Link to="/resources" className="biz-button biz-button-outline" data-testid="enterprise-resources-link">Explore resources<ArrowUpRight size={18}/></Link></section>
    </main><BusinessFooter/>
  </div>;
}
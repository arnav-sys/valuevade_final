import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { BusinessNav, BusinessFooter } from './BusinessNav';
import { BusinessAgentsContent } from './BusinessAgentsContent';
import { BusinessFAQ } from './BusinessFAQ';
import { EnterprisePricing } from './EnterprisePricing';
import { useAudience } from './AudienceContext';
import './business-landing.css';
import '../courses/courses.css';

export default function AIAgentsPage({ enterprise = false }) {
  const { choose } = useAudience(); const navigate = useNavigate();
  useEffect(() => { if (enterprise) choose('enterprise'); }, [enterprise, choose]);
  return <div className="biz-page business-landing cc-page" data-testid={enterprise ? 'enterprise-ai-agents-page' : 'student-ai-agents-page'}>
    <Helmet><title>{`AI Agents for Finance | Valuevade${enterprise ? ' Enterprise' : ''}`}</title><meta name="description" content="Explore Valuevade AI agent workflows for FP&A, bookkeeping and Excel governance, with human review at every decision point."/></Helmet>
    <BusinessNav student={!enterprise}/>
    <main><section className="cc-heading" data-testid="ai-agents-hero"><p className="biz-eyebrow">VALUEVADE / AI AGENTS</p><h1 data-testid="ai-agents-title">AI does the first pass.<br/><em>People make the call.</em></h1><p data-testid="ai-agents-intro">{enterprise ? 'Purpose-built finance workflows for FP&A, bookkeeping and Excel governance. Start with one task, define the checks, and scope an implementation around your team.' : 'Explore how AI agents support financial analysis and operations—from variance explanations to workbook checks. These are business implementation offerings, separate from student course access.'}</p><div className="be-hero-actions"><a className="biz-button biz-button-primary" href="#agent-products" data-testid="ai-agents-explore">Explore the agents<ArrowDown size={17}/></a>{enterprise ? <a className="biz-text-link" href="#enquire" data-testid="ai-agents-enquire">Discuss your workflow<ArrowUpRight size={17}/></a> : <Link className="biz-text-link" to="/courses" data-testid="ai-agents-student-courses">Explore finance courses<ArrowUpRight size={17}/></Link>}</div></section>
      <div id="agent-products" className="be-anchor"/>
      <BusinessAgentsContent student={!enterprise} onCourse={() => navigate(enterprise ? '/enterprise/courses' : '/courses')}/>
      <BusinessFAQ offering="agents"/>
      {enterprise ? <EnterprisePricing offering="agents"/> : <section id="enquire" className="cc-bottom-band" data-testid="student-agents-business-enquiry"><div><p className="biz-eyebrow">FOR YOUR BUSINESS</p><h2>Have a workflow in mind?</h2><p>Agent implementation availability, capabilities and pricing are agreed in a team proposal.</p></div><Link to="/enterprise/ai-agents#enquire" className="biz-button biz-button-primary" data-testid="student-agents-enterprise-link">Discuss a business workflow<ArrowUpRight size={17}/></Link></section>}
    </main>{enterprise && <BusinessFooter/>}
  </div>;
}
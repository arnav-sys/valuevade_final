import { useEffect } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { GraduationCap,Bot,ArrowUpRight,ArrowDown,Check } from 'lucide-react';
import { Tabs,TabsList,TabsTrigger,TabsContent } from '../ui/tabs';
import { BusinessNav,BusinessFooter } from './BusinessNav';
import { BusinessScene } from './BusinessScene';
import { BusinessCourseContent } from './BusinessCourseContent';
import { BusinessAgentsContent } from './BusinessAgentsContent';
import { BusinessFAQ } from './BusinessFAQ';
import { EnterprisePricing } from './EnterprisePricing';
import { useAudience } from './AudienceContext';
import './business-landing.css';

export default function EnterpriseLanding(){
  const [params,setParams]=useSearchParams();const offering=params.get('view')==='agents'?'agents':'course';
  const {choose}=useAudience();
  useEffect(()=>{choose('enterprise');},[]);
  const changeOffering=value=>{setParams(prev=>{const next=new URLSearchParams(prev);next.set('view',value);return next;});};
  const showCourse=()=>{changeOffering('course');document.getElementById('enterprise-offerings')?.scrollIntoView({behavior:'smooth',block:'start'});};
  const course=offering==='course';
  return <div className="biz-page business-landing" data-testid="enterprise-page" data-offering={offering}>
    <Helmet><title>{course?'AI Finance Course for Teams | Valuevade Enterprise':'AI Agents for Finance Firms | Valuevade Enterprise'}</title><meta name="description" content="Two ways to build your finance advantage: train your team with Valuevade’s AI finance course, or scope purpose-built finance automation agents."/></Helmet>
    <BusinessNav/>
    <main><Tabs value={offering} onValueChange={changeOffering}>
      <section className="be-hero" data-testid="enterprise-hero">
        <div className="be-offering-picker" id="enterprise-offerings"><p className="biz-eyebrow">VALUEVADE FOR BUSINESS · TWO WAYS TO MOVE FORWARD</p><TabsList className="be-offering-tabs" aria-label="Enterprise offerings" data-testid="enterprise-offering-tabs"><TabsTrigger value="course" data-testid="enterprise-tab-course"><GraduationCap size={20}/><span>Course<small>Upskill your team</small></span></TabsTrigger><TabsTrigger value="agents" data-testid="enterprise-tab-agents"><Bot size={20}/><span>AI Agents<small>Automate your workflows</small></span></TabsTrigger></TabsList></div>
        <div className="be-hero-copy" key={offering} data-testid="enterprise-offering-intro"><div><p className="be-offering-label">{course?'THE ENTERPRISE FINANCE COURSE':'VALUEVADE-BUILT AI AGENTS'}</p><h1>{course?<>Better finance minds.<br/><em>A bigger AI advantage.</em></>:<>Put AI to work.<br/><em>Keep people in control.</em></>}</h1></div><div><p>{course?'Build a team that can analyse the business, defend the valuation and use AI with judgement. Practical finance training—not just another collection of prompts.':'Move repetitive financial work into a reviewable process. Purpose-built agent implementations for FP&A, bookkeeping and Excel-native governance.'}</p><div className="be-hero-actions"><a className="biz-button biz-button-primary" href="#enquire" data-testid="enterprise-hero-enquire">{course?'Plan your team’s learning':'Discuss an agent workflow'}<ArrowUpRight size={17}/></a><a className="biz-text-link" href={course?'#course-curriculum':'#agent-products'} data-testid="enterprise-hero-explore">{course?'Explore the course':'Explore the agents'}<ArrowDown size={16}/></a></div></div></div>
        <BusinessScene mode={offering}/>
      </section>
      <div className="be-promise-strip" data-testid="offering-summary">{(course?['Financial judgement','Practical AI fluency','Repeatable team workflows']:['Source-grounded work','Exception-led review','Human approval']).map(text=><span key={text}><Check size={15}/>{text}</span>)}</div>
      <TabsContent value="course" className="be-tab-content" data-testid="enterprise-course-panel"><BusinessCourseContent/></TabsContent>
      <TabsContent value="agents" className="be-tab-content" data-testid="enterprise-agents-panel"><div id="agent-products" className="be-anchor"/><BusinessAgentsContent onCourse={showCourse}/></TabsContent>
      <section className="be-section be-impact" data-testid="enterprise-impact"><div><strong>10×</strong><p className="biz-eyebrow">THE AMBITION. NOT A GUARANTEE.</p></div><div><h2>Think bigger.<br/>Measure what actually improves.</h2><p>Productivity depends on the task, the team and the quality bar. Set a baseline, then evaluate the work—not just how quickly AI generates a response.</p><ul><li>Time to a useful first draft</li><li>Source accuracy and traceability</li><li>Reviewer effort and exceptions</li><li>Consistency across repeated tasks</li></ul></div></section>
      <BusinessFAQ offering={offering}/>
      <EnterprisePricing offering={offering}/>
      <section className="be-section be-resource-close" data-testid="enterprise-resources-promo"><div><p className="biz-eyebrow">BUILT FOR THE WORK AHEAD</p><h2>Better starting points.<br/>Stronger financial thinking.</h2><p>Explore financial model concepts, research frameworks, prompt packs and interview-preparation templates.</p></div><Link to="/resources" className="biz-button biz-button-outline" data-testid="enterprise-resources-link">Explore resources<ArrowUpRight size={17}/></Link></section>
    </Tabs></main><BusinessFooter/>
  </div>;
}
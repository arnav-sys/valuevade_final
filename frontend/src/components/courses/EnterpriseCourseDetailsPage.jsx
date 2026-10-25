import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ArrowUpRight, Check, Users, Layers, BookOpen, ShieldCheck } from 'lucide-react';
import { useAudience } from '../enterprise/AudienceContext';
import { BusinessNav, BusinessFooter } from '../enterprise/BusinessNav';
import { EnterprisePricing } from '../enterprise/EnterprisePricing';
import { useCourseCatalog } from './useCourseCatalog';
import { courseProfile } from './courseContent';
import { EnterpriseCurriculum } from './EnterpriseCurriculum';
import { IncludedResources, ResourceInclusionHighlight } from './IncludedResources';
import './courses.css';
import './enterprise-course.css';

export default function EnterpriseCourseDetailsPage() {
  const { courseId } = useParams(); const { choose } = useAudience();
  const { paths, module_counts, session_counts, loading, error, retry } = useCourseCatalog();
  useEffect(() => { choose('enterprise'); }, [choose]);
  const course = paths.find(c => c.id === courseId);
  const profile = course && courseProfile(course); const soon = !!course?.is_coming_soon;
  return <div className="biz-page cc-page ec-page" data-testid="enterprise-course-details-page">
    <Helmet><title>{`${course ? `${course.title} for Teams` : 'Team Course Details'} | Valuevade Enterprise`}</title><meta name="description" content={profile?.summary || 'Explore practical finance training for your team.'}/></Helmet>
    <BusinessNav/>
    <main>
      <nav className="ec-breadcrumb" aria-label="Breadcrumb"><Link className="biz-text-link" to="/enterprise/courses" data-testid="enterprise-course-back"><ArrowLeft size={16}/>All Courses</Link><span aria-current="page" data-testid="enterprise-course-breadcrumb-title">{course?.title || 'Course details'}</span></nav>
      {loading && <p className="ec-section" role="status" data-testid="enterprise-course-loading">Loading course details…</p>}
      {error && <div className="ec-section" role="alert" data-testid="enterprise-course-error"><p>{error}</p><button className="biz-button biz-button-outline" onClick={retry} data-testid="enterprise-course-retry">Try again</button></div>}
      {!loading && !error && !course && <section className="ec-section" data-testid="enterprise-course-not-found"><h1>Course not found.</h1><p>This course is not currently in the published catalogue.</p><Link className="biz-button biz-button-primary" to="/enterprise/courses" data-testid="enterprise-course-not-found-back">Browse all courses<ArrowUpRight size={17}/></Link></section>}
      {!loading && !error && course && <>
        <section className="ec-hero" data-testid="enterprise-course-hero"><p className="biz-eyebrow" data-testid="enterprise-course-eyebrow">VALUEVADE FOR BUSINESS / {course.category || 'FINANCE'}</p><p className="ec-availability" data-testid="enterprise-course-status">{soon ? 'Coming soon · Proposed team learning path' : 'Team training · Scope agreed in your proposal'}</p><h1 data-testid="enterprise-course-title">{course.title}<br/><em>Built around your team.</em></h1><p className="ec-summary" data-testid="enterprise-course-summary">{profile.summary}</p><div className="ec-hero-actions"><a className="biz-button biz-button-primary" href="#enquire" data-testid="enterprise-course-enquire">{soon ? 'Discuss future team interest' : 'Request a team proposal'}<ArrowUpRight size={17}/></a>{!soon && <a className="biz-text-link" href="#enterprise-course-curriculum" data-testid="enterprise-course-view-curriculum">View curriculum<ArrowUpRight size={17}/></a>}</div>
          <ResourceInclusionHighlight id="enterprise-course-hero" target="enterprise-included-resources" enterprise upcoming={soon}/>
          <div className="ec-hero-foot"><div className="ec-audience" data-testid="enterprise-course-audience"><Users size={22}/><div><span>DESIGNED FOR</span><p>{profile.audience}</p></div></div>{!soon && <div className="ec-counts" data-testid="enterprise-course-stats"><span><Layers size={16}/>{module_counts[course.id] || 0} modules</span><span><BookOpen size={16}/>{session_counts[course.id] || 0} sessions</span></div>}</div>
        </section>
        {soon && <div className="ec-section ec-coming-note" role="status" data-testid="enterprise-course-coming-soon">This course is not open for enrolment. The areas below are proposed team outcomes, not a confirmed syllabus. Launch date, curriculum, delivery and commercial terms are yet to be announced.</div>}
        <section className="ec-section" data-testid="enterprise-course-outcomes"><div className="ec-section-heading"><p className="biz-eyebrow">{soon ? 'PROPOSED BUSINESS FOCUS' : 'CAPABILITY THAT COMPOUNDS'}</p><h2>{soon ? 'What your team could work towards.' : 'From individual knowledge to a shared standard.'}</h2></div><div className="ec-outcomes">{profile.outcomes.map((text,i) => <article key={text} data-testid={`enterprise-course-outcome-${i}`}><span>0{i + 1}</span><h3>{text}</h3></article>)}</div></section>
        <section className="ec-application-band" data-testid="enterprise-course-application"><div className="ec-application"><img src={course.image_url || profile.art} onError={e => { if (!e.currentTarget.src.endsWith(profile.art)) e.currentTarget.src = profile.art; }} alt={`${course.category || 'Finance'} learning illustration`} data-testid="enterprise-course-art"/><div><p className="biz-eyebrow">ILLUSTRATIVE TEAM ASSIGNMENT</p><h2>Work your team can review.<br/>Thinking your business can use.</h2><p data-testid="enterprise-course-deliverable">{profile.application}</p><p className="ec-fine-print">Example only. Final assignments and delivery format are confirmed in your proposal.</p></div></div></section>
        {profile.topics.length > 0 && <section className="ec-section" data-testid="enterprise-course-focus"><div className="ec-section-heading"><p className="biz-eyebrow">{soon ? 'PROPOSED FOCUS AREAS' : 'BUSINESS APPLICATION'}</p><h2>Connect the learning to the work.</h2></div><ul className="ec-focus-list">{profile.topics.map((topic,i) => <li key={topic} data-testid={`enterprise-course-topic-${i}`}><Check size={18}/>{topic}</li>)}</ul></section>}
        <IncludedResources id="enterprise-included-resources" enterprise upcoming={soon}/>
        {!soon && <EnterpriseCurriculum key={`curriculum-${course.id}`} course={course}/>}
        <section className="ec-section" data-testid="enterprise-course-rollout"><div className="ec-section-heading"><p className="biz-eyebrow">A TEAM PLAN, NOT AN INDIVIDUAL CHECKOUT</p><h2>Agree the outcome before the rollout.</h2></div><div className="ec-rollout">{[['Align on the work','Identify roles, baseline skills and the business tasks your team needs to improve.'],['Shape the learning','Agree modules, exercises, team size and delivery arrangements before committing.'],['Review the results','Define how outputs will be reviewed and how learning will transfer into day-to-day work.']].map(([title,text],i) => <article key={title} data-testid={`enterprise-course-rollout-${i}`}><span>0{i + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div><p className="ec-review-note" data-testid="enterprise-course-governance"><ShieldCheck size={20}/>AI supports the analysis. Your team remains responsible for evidence, judgement and final approval.</p></section>
        <EnterprisePricing key={`pricing-${course.id}`} offering="course" enquiryContext={`Course: ${course.title}${soon ? ' (coming soon — future team interest)' : ''}`} hideEstimate={soon} resourcesTarget="enterprise-included-resources"/>
        <section className="cc-bottom-band"><div><p className="biz-eyebrow">ANOTHER WAY TO BUILD CAPACITY</p><h2>Need the workflow built for you?</h2><p>Agent implementations are scoped separately from team training.</p></div><Link className="biz-button biz-button-outline" to="/enterprise/ai-agents" data-testid="enterprise-course-agents-link">Explore AI Agents<ArrowUpRight size={17}/></Link></section>
      </>}
    </main><BusinessFooter/>
  </div>;
}
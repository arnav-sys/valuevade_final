import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Search, X, ArrowUpRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAudience } from './enterprise/AudienceContext';
import { BusinessNav, BusinessFooter } from './enterprise/BusinessNav';
import { useCourseCatalog } from './courses/useCourseCatalog';
import { CourseCatalogCard } from './courses/CourseCatalogCard';
import './courses/courses.css';

export default function CoursesPage({ enterprise = false }) {
  const { enrollmentStatus } = useAuth(); const { choose } = useAudience();
  const { paths, module_counts, session_counts, loading, error, retry } = useCourseCatalog();
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('all');
  const enrollments = enterprise ? [] : enrollmentStatus?.enrollments || [];
  useEffect(() => { if (enterprise) choose('enterprise'); }, [enterprise, choose]);
  const categories = [...new Set(paths.map(c => c.category).filter(Boolean))];
  const filtered = useMemo(() => paths.filter(c => (category === 'all' || c.category === category) && `${c.title} ${c.category || ''}`.toLowerCase().includes(query.trim().toLowerCase())), [paths, category, query]);
  const clear = () => { setQuery(''); setCategory('all'); };
  return <div className={`biz-page cc-page ${enterprise ? 'cc-enterprise' : 'cc-student'}`} data-testid={enterprise ? 'enterprise-courses-page' : 'student-courses-page'}>
    <Helmet><title>{`${enterprise ? 'All Courses for Finance Teams' : 'All Finance Courses'} | Valuevade`}</title><meta name="description" content={enterprise ? 'Explore finance courses for teams. Research, modelling, valuation and practical AI capability with a scoped team proposal.' : 'Explore Valuevade’s finance courses, curriculum and practical learning paths for students.'}/></Helmet>
    <BusinessNav student={!enterprise}/>
    <main>
      <section className="cc-heading" data-testid="courses-hero"><p className="biz-eyebrow" data-testid="courses-eyebrow">VALUEVADE / {enterprise ? 'LEARNING FOR BUSINESS' : 'YOUR NEXT CHAPTER'}</p><h1 data-testid="courses-heading">All courses.<br/><em>{enterprise ? 'One stronger team.' : 'Your next advantage.'}</em></h1><p data-testid="courses-hero-description">{enterprise ? 'Build the financial judgement, research discipline and AI fluency your business needs. Start with the course. Shape it around your team.' : 'Go from understanding finance to doing the work. Explore every learning path and find your next step.'}</p></section>
      <section className="cc-catalog" aria-label="All courses" data-testid="courses-catalog">
        <div className="cc-filters"><label className="cc-search"><Search size={18}/><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search courses…" aria-label="Search courses" data-testid="courses-search"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" data-testid="courses-search-clear"><X size={17}/></button>}</label><label className="cc-category-filter">Category<select value={category} onChange={e => setCategory(e.target.value)} data-testid="courses-category-filter"><option value="all">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></label></div>
        {loading && <p role="status" data-testid="courses-loading">Loading courses…</p>}
        {error && <div role="alert" className="biz-alert" data-testid="courses-error"><p>{error}</p><button onClick={retry} className="biz-text-link" data-testid="courses-retry-button"><RefreshCw size={16}/>Try again</button></div>}
        {!loading && !error && <><p className="cc-count" aria-live="polite" data-testid="courses-result-count">{filtered.length} {filtered.length === 1 ? 'course' : 'courses'}{enterprise ? ' · Team learning catalogue' : ' · Find your learning path'}</p><div className="cc-grid" data-testid="courses-grid">{filtered.map(course => <CourseCatalogCard key={course.id} course={course} enterprise={enterprise} modules={module_counts[course.id] || 0} sessions={session_counts[course.id] || 0} enrollment={enrollments.find(e => e.master_path_id === course.id)}/>)}</div>{!filtered.length && <div className="cc-empty" data-testid="courses-empty"><h2>{paths.length ? 'No courses match your search.' : 'New courses are on their way.'}</h2>{paths.length > 0 && <button className="biz-button biz-button-outline" onClick={clear} data-testid="courses-clear-filters">Clear filters</button>}</div>}</>}
      </section>
      <section className="cc-bottom-band" data-testid="courses-agents-promo"><div><p className="biz-eyebrow">FINANCE × INTELLIGENCE</p><h2>{enterprise ? 'Looking to automate the work?' : 'Curious about AI in finance?'}</h2><p>{enterprise ? 'Explore purpose-built agent workflows for your finance function.' : 'Explore the AI workflows shaping research, modelling and financial operations.'}</p></div><Link className="biz-button biz-button-outline" to={enterprise ? '/enterprise/ai-agents' : '/ai-agents'} data-testid="courses-ai-agents-link">Explore AI Agents<ArrowUpRight size={17}/></Link></section>
    </main>{enterprise && <BusinessFooter/>}
  </div>;
}
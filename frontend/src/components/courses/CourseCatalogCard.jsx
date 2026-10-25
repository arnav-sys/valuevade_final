import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Layers, CheckCircle2 } from 'lucide-react';
import { courseProfile } from './courseContent';

export const CourseCatalogCard = ({ course, enterprise, modules, sessions, enrollment }) => {
  const content = courseProfile(course);
  const soon = !!course.is_coming_soon;
  const detail = `${enterprise ? '/enterprise' : ''}/course/${course.id}`;
  return <article className="cc-card" data-testid={`course-card-${course.id}`}>
    <Link to={detail} className="cc-art" aria-label={`View ${course.title}`} data-testid={`course-card-image-link-${course.id}`}>
      <img src={course.image_url || content.art} alt={course.title} loading="lazy" data-testid={`course-card-image-${course.id}`} onError={e => { if (!e.currentTarget.src.endsWith(content.art)) e.currentTarget.src = content.art; }}/>
      <span className={`cc-status ${soon ? 'cc-soon' : ''}`} data-testid={`course-card-status-${course.id}`}>{soon ? 'Coming soon' : enterprise ? 'Available for team enquiries' : 'Available now'}</span>
    </Link>
    <div className="cc-card-body">
      <p className="cc-category" data-testid={`course-card-category-${course.id}`}>{course.category || 'Finance'}{enterprise && ' · FOR TEAMS'}</p>
      <h2><Link to={detail} data-testid={`course-card-title-${course.id}`}>{course.title}</Link></h2>
      <p className="cc-description" data-testid={`course-card-description-${course.id}`}>{enterprise ? content.summary : soon ? `Explore ${course.title.toLowerCase()}. Curriculum and launch details will be announced when available.` : course.description}</p>
      {!soon && <div className="cc-meta" data-testid={`course-card-meta-${course.id}`}><span><Layers size={14}/>{modules} modules</span><span><BookOpen size={14}/>{sessions} sessions</span></div>}
      <div className="cc-card-bottom"><span data-testid={`course-card-price-${course.id}`}>{soon ? 'Launch date to be announced' : enterprise ? 'Team proposal · seat-based pricing' : '₹4,999 · lifetime access'}</span><Link to={detail} data-testid={`course-card-cta-${course.id}`}>View details<ArrowUpRight size={17}/></Link></div>
      {!enterprise && enrollment && <div className="cc-enrolled" data-testid={`course-enrollment-${course.id}`}>{enrollment.status === 'completed' ? <span><CheckCircle2 size={14}/>Completed</span> : <Link to="/dashboard" data-testid={`course-continue-${course.id}`}>Continue learning<ArrowUpRight size={14}/></Link>}</div>}
    </div>
  </article>;
};
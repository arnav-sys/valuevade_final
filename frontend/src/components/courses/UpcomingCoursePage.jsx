import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Clock } from 'lucide-react';
import { BusinessNav } from '../enterprise/BusinessNav';
import { courseProfile } from './courseContent';
import { IncludedResources, ResourceInclusionHighlight } from './IncludedResources';
import { PersonalisationSection } from './PersonalisationSection';
import './courses.css';

export const UpcomingCoursePage = ({ course }) => <div className="biz-page cc-page cc-student" data-testid="upcoming-course-page">
  <Helmet><title>{`${course.title} — Coming Soon | Valuevade`}</title><meta name="description" content={`${course.title} is coming soon. Explore available Valuevade finance courses.`}/></Helmet>
  <BusinessNav student/>
  <main className="cc-upcoming"><Link className="biz-text-link" to="/courses" data-testid="upcoming-back-courses"><ArrowLeft size={16}/>All Courses</Link>
    <p className="cc-upcoming-status" data-testid="upcoming-course-status"><Clock size={16}/>Coming soon</p>
    <h1 data-testid="upcoming-course-title">{course.title}</h1>
    <p data-testid="upcoming-course-description">{course.long_description || `A new learning path in ${course.category || 'finance'}. Detailed curriculum, pricing and a launch date have not been announced yet.`}</p>
    <img className="cc-upcoming-art" src={courseProfile(course).art} alt={`${course.category || 'Finance'} learning illustration`} data-testid="upcoming-course-art"/>
    <p data-testid="upcoming-course-notice">Enrolment is not open for this course.</p>
    <ResourceInclusionHighlight id="upcoming-course" upcoming/>
    <PersonalisationSection id="upcoming-personalisation" upcoming/>
    <IncludedResources upcoming/>
    <Link className="biz-button biz-button-primary" to="/courses" data-testid="upcoming-browse-courses">Explore all courses<ArrowUpRight size={17}/></Link>
  </main>
</div>;
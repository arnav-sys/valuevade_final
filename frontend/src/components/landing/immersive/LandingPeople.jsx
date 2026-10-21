import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus, Minus, Quote } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
/** Only display published API content: no invented people, reviews, or credentials. */
export default function LandingPeople() {
  const [faculty, setFaculty] = useState([]), [reviews, setReviews] = useState([]), [expanded, setExpanded] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const read = async (path, key, setter) => { try { const response = await fetch(`${API}/api/${path}`, { signal: controller.signal }); if (!response.ok) return; const data = await response.json(); if (Array.isArray(data[key])) setter(data[key]); } catch { /* Other sections remain available if published content is unavailable. */ } };
    read('faculty', 'faculty', setFaculty); read('testimonials', 'testimonials', setReviews);
    return () => controller.abort();
  }, []);
  return <>
    <section id="faculty" className="vvi-section vvi-people" data-testid="faculty-section"><div className="vvi-container"><div className="vvi-section-heading"><div><p className="vvi-kicker">THE PEOPLE BEHIND THE LEARNING</p><h2>Learn the thinking.<br /><span>Not just the technique.</span></h2></div><Link to="/course/5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c" data-testid="faculty-course-link">Meet the course <ArrowUpRight size={16} /></Link></div>
      <div className="vvi-faculty-grid">{faculty.map((person, i) => <article key={person.id} className="vvi-faculty-card" data-testid={`faculty-card-${i}`}>
        <div className="vvi-faculty-photo">{person.photo_url ? <img src={person.photo_url} alt={person.name} loading="lazy" /> : <span>{person.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</span>}</div>
        <div><h3>{person.name}</h3><p className="vvi-faculty-title">{person.title}</p><p className={expanded === person.id ? '' : 'vvi-bio-clamped'} data-testid={`faculty-bio-${i}`}>{person.bio}</p><button aria-expanded={expanded === person.id} onClick={() => setExpanded(expanded === person.id ? null : person.id)} data-testid={`faculty-bio-toggle-${i}`}>{expanded === person.id ? 'Less about me' : 'More about me'}{expanded === person.id ? <Minus size={14} /> : <Plus size={14} />}</button></div>
      </article>)}</div>
    </div></section>
    {reviews.length > 0 && <section className="vvi-section vvi-reviews" data-testid="testimonials-section"><div className="vvi-container"><div className="vvi-section-heading"><div><p className="vvi-kicker">LEARNER VOICES</p><h2>A different way to learn.<br /><span>In their own words.</span></h2></div></div><div className="vvi-review-grid">{reviews.map(review => <figure key={review.id} data-testid={`testimonial-card-${review.id}`}><Quote size={24} /><blockquote>{review.quote}</blockquote><figcaption><strong>{review.name}</strong><span>{review.role}</span></figcaption></figure>)}</div></div></section>}
  </>;
}
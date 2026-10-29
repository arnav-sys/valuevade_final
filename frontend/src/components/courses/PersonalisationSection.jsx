import { Link } from 'react-router-dom';
import { BrainCircuit, Target, Route, ArrowUpRight, Check } from 'lucide-react';
import { BrandArtwork } from '../brand/BrandArtwork';
import './personalisation.css';

const STEPS = [
  { key: 'profile', icon: Target, title: 'Your starting point matters',
    body: 'Your finance background, Excel skills and career goals are the starting point. A beginner and an experienced analyst should not have to follow the same path.' },
  { key: 'tailor', icon: BrainCircuit, title: 'AI shapes your learning path',
    body: 'Your answers help AI tailor the modules and sessions in your course, reducing topics you already know and focusing on the skills you want to build.' },
  { key: 'review', icon: Route, title: 'A course that makes sense for you',
    body: 'Review your personalised path before you begin. Keep the foundations you need and move towards your goals, with a clearer focus on what comes next.' },
];

export const PersonalisationSection = ({ id = 'course-personalisation', landing = false, upcoming = false }) => (
  <section id={id} className={`vv-personalisation${landing ? ' vv-personalisation--landing' : ''}`}
    aria-labelledby={`${id}-heading`} data-testid={id}>
    <div className="vv-personalisation-inner">
      <div className="vv-personalisation-intro">
        <div>
          <p className="vv-personalisation-eyebrow" data-testid={`${id}-eyebrow`}>
            <BrainCircuit size={17} aria-hidden="true" /> {upcoming ? 'THE PERSONALISED APPROACH' : 'BUILT AROUND YOU · POWERED BY AI'}
          </p>
          <h2 id={`${id}-heading`} data-testid={`${id}-heading`}>
            Not a generic course. <span>A course tailored to you.</span>
          </h2>
          <p className="vv-personalisation-description" data-testid={`${id}-description`}>
            {upcoming
              ? 'Our approach starts with the learner, not a one-size-fits-all playlist. AI personalisation for this upcoming course is planned; details will be confirmed at launch.'
              : 'Your ambitions are personal. Your learning should be too. We use AI to create a personalised learning path from the course curriculum, shaped around your background, current skills and career goals.'}
          </p>
        </div>
        <div className="vv-personalisation-visual">
          <BrandArtwork variant="ai" testId={`${id}-artwork`} />
          <p data-testid={`${id}-visual-caption`}>Your background <span aria-hidden="true">+</span> Your goals <span aria-hidden="true">→</span> Your path</p>
        </div>
      </div>
      {!upcoming && <ol className="vv-personalisation-steps" data-testid={`${id}-steps`}>
        {STEPS.map(({ key, icon: Icon, title, body }, index) => (
          <li key={key} data-testid={`${id}-step-${key}`}>
            <div className="vv-personalisation-step-top"><Icon size={23} aria-hidden="true" /><span aria-hidden="true">0{index + 1}</span></div>
            <h3 data-testid={`${id}-${key}-title`}>{title}</h3>
            <p data-testid={`${id}-${key}-description`}>{body}</p>
          </li>
        ))}
      </ol>}
      <div className="vv-personalisation-footer">
        <p data-testid={`${id}-note`}><Check size={18} aria-hidden="true" />
          {upcoming ? 'Coming soon. Enrolment is not open yet.' : 'The course curriculum is the foundation. Your answers make the path your own.'}
        </p>
        {landing && <Link to="/courses" data-testid={`${id}-explore`}>
          Find your course <ArrowUpRight size={17} aria-hidden="true" />
        </Link>}
      </div>
    </div>
  </section>
);
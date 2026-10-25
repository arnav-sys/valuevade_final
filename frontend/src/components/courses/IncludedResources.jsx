import { ArrowDownRight, Bot, BriefcaseBusiness, ChartNoAxesCombined, ClipboardList, FileSpreadsheet, FileText, LibraryBig, MessagesSquare, Search, Sparkles } from 'lucide-react';
import './included-resources.css';

const resources = [
  { id: 'hr-database', icon: BriefcaseBusiness, title: 'HR & recruiter database', student: 'Research finance employers and plan relevant outreach with an HR and recruitment directory.', enterprise: 'An HR and recruitment directory to support professional networking and talent research.' },
  { id: 'financial-modelling', icon: FileSpreadsheet, title: 'Financial modelling templates', student: 'Excel starting points for financial statements, forecasts, assumptions and scenario analysis.', enterprise: 'Reusable Excel structures for consistent forecasting, model building and team review.' },
  { id: 'equity-research', icon: FileText, title: 'Equity research templates', student: 'Structure company analysis, investment theses and evidence-led research reports.', enterprise: 'Bring a shared structure to company coverage, investment theses and research reviews.' },
  { id: 'ai-agent-workflows', icon: Bot, title: 'AI agents workflows', student: 'Workflow templates for AI-assisted research, financial analysis and human review.', enterprise: 'Reference workflows for research, financial operations, source checks and approval steps.' },
  { id: 'prompts-library', icon: Sparkles, title: 'Prompts library', student: 'Finance-focused prompts for research, modelling, analysis and interview practice.', enterprise: 'Reusable finance prompts for structured analysis, research briefs and reviewable outputs.' },
  { id: 'finance-projects', icon: ClipboardList, title: 'Finance projects templates', student: 'Project frameworks to turn your analysis into clear, portfolio-ready deliverables.', enterprise: 'Assignment frameworks for applied team learning and consistent project documentation.' },
  { id: 'interview-prep', icon: MessagesSquare, title: 'Interview prep templates', student: 'Organise technical preparation, behavioural examples, stock pitches and mock-interview reviews.', enterprise: 'Structured preparation and practice frameworks for analyst development and professional conversations.' },
  { id: 'sector-study', icon: Search, title: 'Sector study frameworks', student: 'Map an industry’s value chain, competitive landscape, business drivers and key risks.', enterprise: 'Standardise industry analysis around value chains, competitive dynamics and operating risks.' },
  { id: 'valuation', icon: ChartNoAxesCombined, title: 'Valuation & stock pitch templates', student: 'Build a clearer valuation story with comparable-company analysis, scenarios and a concise stock pitch.', enterprise: 'Connect valuation assumptions, scenario comparisons and investment recommendations in a consistent format.' },
];

export const ResourceInclusionHighlight = ({ id, target = 'student-included-resources', enterprise = false, upcoming = false, compact = false }) => (
  <a href={`#${target}`} className={`resource-inclusion-highlight ${enterprise ? 'resource-inclusion-highlight--enterprise' : ''} ${compact ? 'resource-inclusion-highlight--compact' : ''}`} data-testid={`${id}-resource-highlight`}>
    <LibraryBig size={compact ? 14 : 19} aria-hidden="true"/>
    <span data-testid={`${id}-resource-highlight-text`}>{upcoming ? 'Complete resource library planned with enrolment' : enterprise ? 'All resources included for enrolled team members' : 'All resources included with your course'}{!compact && <small>Templates, HR database, AI workflows, prompts & more <ArrowDownRight size={13} aria-hidden="true"/></small>}</span>
  </a>
);

export const IncludedResources = ({ id = 'student-included-resources', enterprise = false, upcoming = false }) => (
  <section id={id} className={`course-resources ${enterprise ? 'course-resources--enterprise' : ''}`} aria-labelledby={`${id}-heading`} data-testid={id}>
    <div className="course-resources-intro">
      <p className="course-resources-eyebrow" data-testid={`${id}-eyebrow`}>{upcoming ? 'PLANNED COURSE INCLUSIONS' : 'INCLUDED WITH YOUR COURSE'}</p>
      <h2 id={`${id}-heading`} data-testid={`${id}-heading`}>{enterprise ? 'A complete resource library for your team.' : 'Your complete finance resource library.'}</h2>
      <p data-testid={`${id}-description`}>{upcoming ? 'Planned with course enrolment at launch: access to all resources, from practical finance templates to AI workflows and career preparation.' : enterprise ? 'Every enrolled team member gets access to all resources—reusable templates, research frameworks, AI workflows and preparation tools that support learning and day-to-day financial work.' : 'Get access to all resources with your course enrolment. Go beyond the lessons with practical templates, an HR database, AI workflows, prompts and tools for your next finance opportunity.'}</p>
    </div>
    <ul className="course-resources-grid" data-testid={`${id}-list`}>
      {resources.map(({ id: resourceId, icon: Icon, title, student, enterprise: business }) => <li key={resourceId} data-testid={`${id}-${resourceId}`}>
        <Icon className="course-resource-icon" size={22} aria-hidden="true"/>
        <h3 data-testid={`${id}-${resourceId}-title`}>{title}</h3>
        <p data-testid={`${id}-${resourceId}-description`}>{enterprise ? business : student}</p>
      </li>)}
    </ul>
    <div className="course-resources-note" data-testid={`${id}-note`}><LibraryBig size={19} aria-hidden="true"/><div><strong data-testid={`${id}-more`}>And more from the Valuevade resource library.</strong><p data-testid={`${id}-agent-scope`}>AI workflow templates support learning and practice. Custom AI agent implementation is a separate service.</p>{upcoming && <p data-testid={`${id}-upcoming-notice`}>This course is coming soon. Enrolment and resource access are not open yet.</p>}</div></div>
  </section>
);
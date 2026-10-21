import { BookOpen, BriefcaseBusiness, Award, Route, Mic, ArrowUpRight, FolderCheck } from 'lucide-react';

const BENEFITS = {
  left: {
    label: 'BUILT AROUND YOU', value: '100+', unit: 'hrs', icon: BookOpen,
    title: 'Learn by doing.',
    description: 'Financial models, company research, and hands-on practice.',
    details: [[Route, 'AI-personalised path'], [Award, 'NISM XV preparation']],
    href: '#practice', link: 'Explore the experience',
  },
  right: {
    label: 'WORK YOU CAN SHOW', value: '3', unit: 'capstones', icon: FolderCheck,
    title: 'Leave with a portfolio.',
    description: 'Build research you can explain. Then practise defending it.',
    details: [[Mic, 'AI mock interviews'], [BriefcaseBusiness, 'Career preparation']],
    href: '#how-it-works', link: 'See your learning path',
  },
};

export const HeroBenefits = ({ side }) => {
  const benefit = BENEFITS[side];
  const Icon = benefit.icon;
  return <aside className={`vvi-hero-benefits vvi-hero-benefits--${side}`} aria-label={side === 'left' ? 'Course benefits' : 'Course outcomes'} data-testid={`hero-benefits-${side}`}>
    <div className="vvi-benefit-header"><Icon size={19} /><span data-testid={`hero-benefit-label-${side}`}>{benefit.label}</span></div>
    <div className="vvi-benefit-metric" data-testid={`hero-benefit-metric-${side}`}>{benefit.value}<span>{benefit.unit}</span></div>
    <h2 data-testid={`hero-benefit-title-${side}`}>{benefit.title}</h2>
    <p data-testid={`hero-benefit-description-${side}`}>{benefit.description}</p>
    <ul>{benefit.details.map(([DetailIcon, text], i) => <li key={text} data-testid={`hero-benefit-detail-${side}-${i}`}><DetailIcon size={14} />{text}</li>)}</ul>
    <a href={benefit.href} data-testid={`hero-benefit-link-${side}`}>{benefit.link}<ArrowUpRight size={14} /></a>
  </aside>;
};
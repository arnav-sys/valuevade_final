import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { BrandArtwork } from './brand/BrandArtwork';
import HeroProductShowcase from './landing/HeroProductShowcase';

const STATS = [
  { n: '21', l: 'Modules' }, { n: '239', l: 'Sessions' },
  { n: '100+ hrs', l: 'Learning' }, { n: '3', l: 'Capstones' },
  { n: 'XV', l: 'NISM prep' }, { n: '₹4,999', l: 'Lifetime' },
];

export default function HeroSection() {
  const reduced = useReducedMotion();
  const rise = (delay) => ({ initial: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 14 },
    animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: reduced ? 0 : delay } });

  return (
    <section id="hero" className="vv-reference-hero" data-testid="hero-section">
      <div className="vv-hero-cover">
        <div className="vv-hero-copy">
          <motion.p {...rise(0)} className="vv-eyebrow" data-testid="hero-eyebrow">VALUEVADE · FINANCE, FORWARD</motion.p>
          <motion.h1 {...rise(0.08)} data-testid="hero-h1">
            A new way of mastering<br className="hidden sm:block" /> finance in the <span>age of AI.</span>
          </motion.h1>
          <motion.p {...rise(0.16)} className="vv-hero-description" data-testid="hero-paragraph">
            Your ambition. An AI-personalised path. Master equity research and financial modelling
            through real Indian companies, hands-on simulations, and work you can call your own.
          </motion.p>
          <motion.div {...rise(0.24)} className="vv-hero-actions">
            <Link to="/signup" className="lv-cta" data-testid="hero-primary-cta">Start Free Session <ArrowRight size={17} /></Link>
            <Link to="/course/5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c" className="lv-cta lv-cta-ghost" data-testid="hero-secondary-cta">Explore the curriculum <ArrowUpRight size={17} /></Link>
          </motion.div>
          <p className="vv-hero-note" data-testid="hero-access-note">₹4,999 lifetime access. First session free. No subscription.</p>
        </div>
        <motion.div {...rise(0.32)} className="vv-hero-illustration">
          <BrandArtwork variant="ai" testId="hero-finance-artwork" eager />
        </motion.div>
        <div className="vv-cover-folio" data-testid="hero-masthead"><span>LEARN WITH AI. THINK FOR YOURSELF.</span><span>YOUR NEXT CHAPTER ↓</span></div>
      </div>
      <div className="vv-hero-ledger" data-testid="hero-markers">
        {STATS.map(s => <div key={s.l} data-testid={`hero-marker-${s.l.toLowerCase().replace(/\s/g, '-')}`}>
          <strong>{s.n}</strong><span>{s.l}</span>
        </div>)}
      </div>
      <div className="vv-product-section">
        <div className="vv-product-heading">
          <div><p className="vv-eyebrow">NOT JUST THEORY · REAL PRACTICE</p><h2>Your future desk.<br /><span>Your practice ground.</span></h2></div>
          <p>Build the model. Defend your thinking. Find the story behind the numbers.</p>
        </div>
        <HeroProductShowcase />
      </div>
    </section>
  );
}
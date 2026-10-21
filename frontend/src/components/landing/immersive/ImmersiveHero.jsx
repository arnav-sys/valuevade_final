import { lazy, Suspense, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowDown, FileSearch, Table2, Mic, Pause, Play, RotateCcw, Check } from 'lucide-react';
import { BrandArtwork } from '../../brand/BrandArtwork';
import { HeroBenefits } from './HeroBenefits';

const FinanceScene = lazy(() => import('./FinanceScene'));
const MODES = [{ name: 'Research', icon: FileSearch }, { name: 'Model', icon: Table2 }, { name: 'Pitch', icon: Mic }];

export default function ImmersiveHero({ theme }) {
  const [active, setActive] = useState(1), [paused, setPaused] = useState(false), [resetKey, setResetKey] = useState(0);
  const reducedMotion = useReducedMotion();
  return <section id="hero" className="vvi-hero" data-testid="hero-section">
    <div className="vvi-hero-intro" data-testid="hero-intro-layout">
    <motion.div className="vvi-hero-copy" initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
      <p className="vvi-kicker" data-testid="hero-eyebrow"><span /> VALUEVADE · FINANCE, FORWARD</p>
      <h1 data-testid="hero-h1">Master finance.<br /><span>Build your edge.</span></h1>
      <p className="vvi-hero-description" data-testid="hero-paragraph">Your AI-powered path from learning to doing.<br />{' '}Build real models. Research real companies. Back yourself in interviews.</p>
      <div className="vvi-actions">
        <Link to="/signup" className="vvi-button vvi-button-primary" data-testid="hero-primary-cta">Start my free session <ArrowRight size={17} /></Link>
        <a href="#practice" className="vvi-button vvi-button-secondary" data-testid="hero-secondary-cta">Take a look inside <ArrowDown size={16} /></a>
      </div>
      <p className="vvi-hero-access" data-testid="hero-access-note"><Check size={13} /> First session free <span>·</span> ₹4,999 lifetime <span>·</span> No subscription</p>
    </motion.div>
      <HeroBenefits side="left" />
      <HeroBenefits side="right" />
    </div>
    <Suspense fallback={<div className="vvi-finance-scene"><BrandArtwork variant="ai" className="vvi-scene-fallback" testId="finance-scene-loading" /></div>}>
      <FinanceScene active={active} paused={paused} resetKey={resetKey} reducedMotion={reducedMotion} theme={theme} />
    </Suspense>
    <div className="vvi-scene-toolbar" data-testid="hero-scene-controls">
      <div className="vvi-scene-modes" aria-label="Finance workspace view">
        {MODES.map(({ name, icon: Icon }, i) => <button key={name} onClick={() => setActive(i)} aria-pressed={active === i}
          className={active === i ? 'is-active' : ''} data-testid={`hero-scene-${name.toLowerCase()}`}><Icon size={14} />{name}</button>)}
      </div>
      <button className="vvi-icon-button" onClick={() => setPaused(!paused)} disabled={!!reducedMotion} title={reducedMotion ? 'Animation paused for reduced motion' : paused ? 'Play animation' : 'Pause animation'} aria-label={reducedMotion ? 'Animation paused for reduced motion' : paused ? 'Play animation' : 'Pause animation'} data-testid="hero-scene-pause">{paused || reducedMotion ? <Play size={15} /> : <Pause size={15} />}</button>
      <button className="vvi-icon-button" onClick={() => setResetKey(key => key + 1)} title="Reset view" aria-label="Reset view" data-testid="hero-scene-reset"><RotateCcw size={15} /></button>
    </div>
    <p className="vvi-scene-caption" data-testid="hero-scene-caption">YOUR FUTURE WORKSPACE. YOUR FIRST MOVE.</p>
  </section>;
}
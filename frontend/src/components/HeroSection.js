import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import HeroProductShowcase from '@/components/landing/HeroProductShowcase';
import HeroParticles from '@/components/landing/HeroParticles';

/* Hero, Jun 2026: centered editorial masthead on paper, with the product
 * itself (AI interview / Excel model / document sim) floating on a dark
 * grained stage beneath the fold line. */

const STATS = [
  { n: '21', l: 'Modules' },
  { n: '239', l: 'Sessions' },
  { n: '42h', l: 'Lectures' },
  { n: '3', l: 'Capstones' },
  { n: 'XV', l: 'NISM prep' },
  { n: '₹4999', l: 'Lifetime' },
];

export default function HeroSection() {
  const reduceMotion = useReducedMotion();

  const rise = (delay = 0) => ({
    initial: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  });

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <section id="hero" className="relative overflow-hidden" data-testid="hero-section">
      {/* dark masthead band, deliberately hardcoded dark (independent of the
          light/dark theme toggle) so the headline always reads bold/white */}
      <div className="hero-on-dark relative overflow-hidden pt-28 lg:pt-32 pb-14 lg:pb-16" data-testid="hero-dark-band">
        <HeroParticles />
        <div className="hero-on-dark__glow" aria-hidden="true" />
        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
          {/* masthead line */}
          <motion.div {...rise(0.05)} className="lv-rule-double pt-3 flex items-center justify-between gap-4 lv-folio" data-testid="hero-masthead">
            <span className="truncate">Equity research &amp; financial modelling</span>
            <span className="hidden sm:inline">{today}</span>
            <span className="hidden md:inline">NSE · BSE · Ind AS</span>
          </motion.div>

          {/* centered masthead copy */}
          <div className="text-center max-w-[900px] mx-auto pt-14 lg:pt-20">
            <motion.p {...rise(0.15)} className="lv-chapter mb-7" data-testid="hero-eyebrow">
              Your AI finance mentor
            </motion.p>

            <motion.h1
              {...rise(0.25)}
              className="text-white"
              style={{ fontSize: 'clamp(38px, 5.6vw, 84px)', lineHeight: 0.98, letterSpacing: '-0.035em' }}
              data-testid="hero-h1"
            >
              <span className="block" style={{ fontWeight: 700 }}>
                A new way of mastering
              </span>
              <span className="block" style={{ fontWeight: 700 }}>
                finance in the <span className="lv-italic">age of AI</span>
              </span>
            </motion.h1>

            <motion.p
              {...rise(0.4)}
              className="mt-8 text-[15px] sm:text-[15.5px] leading-[1.7] max-w-[620px] mx-auto"
              style={{ color: 'rgba(228, 233, 245, 0.78)' }}
              data-testid="hero-paragraph"
            >
              Tell Valuevade where you are and where you want to land. You get an AI-personalised
              equity research and financial modelling path: 21 modules, 239 hands-on sessions on real
              Indian companies, NISM Series XV prep, and three portfolio-grade capstones. One-time
              ₹4999 for lifetime access, and your first session is free.
            </motion.p>

            <motion.div {...rise(0.52)} className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/signup" className="lv-cta" data-testid="hero-primary-cta">
                Start Free Session
                <ArrowRight size={16} strokeWidth={2.5} />
              </Link>
              <Link
                to="/course/5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c"
                className="lv-cta lv-cta-ghost"
                data-testid="hero-secondary-cta"
              >
                See the full curriculum
                <ArrowUpRight size={16} strokeWidth={2.4} />
              </Link>
            </motion.div>

            <motion.p {...rise(0.62)} className="mt-6 text-[13px]" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              Already enrolled?{' '}
              <Link to="/login" className="font-semibold hover:underline" style={{ color: '#fff' }} data-testid="hero-signup-link">
                Log in &rarr;
              </Link>
            </motion.p>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 pb-14 lg:pb-20">
        {/* product stage */}
        <motion.div
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14 lg:mt-20"
        >
          <HeroProductShowcase />
        </motion.div>

        <motion.div {...rise(0.9)} className="mt-6 mb-14 flex justify-center">
          <span className="vv-scrollcue" data-testid="hero-scroll-cue">
            Scroll to explore <ChevronDown size={13} />
          </span>
        </motion.div>

        {/* stat ledger */}
        <motion.div {...rise(0.7)} className="lv-ledger" data-testid="hero-markers">
          {STATS.map((s) => (
            <div key={s.l} data-testid={`hero-marker-${s.l.toLowerCase().replace(/\s/g, '-')}`}>
              <div className="lv-ledger__n">{s.n}</div>
              <div className="lv-folio mt-2">{s.l}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

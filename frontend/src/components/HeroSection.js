import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import CandlestickParticleField from '@/components/landing/CandlestickParticleField';
import { useTheme } from '@/contexts/ThemeContext';

/* Hero, Sep 2026: minimal near-black canvas, a particle candlestick chart as
 * the centre visual, vertical brand rail on the left, and the tagline carried
 * as the headline on the right. */

// Scattered around the particle chart on desktop, compact row on mobile.
const MARKERS = [
  { n: '21', l: 'Modules', top: '14%', left: '31%' },
  { n: '239', l: 'Sessions', top: '27%', left: '7%' },
  { n: '42h', l: 'Lectures', top: '70%', left: '7%' },
  { n: '3', l: 'Capstones', top: '80%', left: '27%' },
  { n: 'XV', l: 'NISM prep', top: '86%', left: '46%' },
  { n: '₹4999', l: 'Lifetime', top: '70%', left: '44%' },
];

export default function HeroSection() {
  const reduceMotion = useReducedMotion();
  const { theme } = useTheme();
  const light = theme === 'light';

  const rise = (delay = 0) => ({
    initial: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  });

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden"
      style={{ background: light ? 'var(--bg-primary)' : '#05070F' }}
      data-testid="hero-section"
    >
      {/* particle candlestick field */}
      <div className="absolute inset-0 lg:right-[34%] pointer-events-none" aria-hidden="true">
        <CandlestickParticleField
          accent={light ? '#1B4FD8' : '#246BFD'}
          light={light}
          className="w-full h-full"
          style={{ opacity: 0.9 }}
        />
      </div>

      {/* vignette so type stays legible over the field */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: light
            ? 'linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 14%, rgba(255,255,255,0) 52%, rgba(255,255,255,0.92) 74%)'
            : 'linear-gradient(90deg, rgba(5,7,15,0.7) 0%, rgba(5,7,15,0) 14%, rgba(5,7,15,0) 52%, rgba(5,7,15,0.94) 74%)',
        }}
      />

      {/* vertical brand rail */}
      <div
        className="hidden lg:flex absolute left-3 bottom-10 z-20 select-none items-end"
        aria-hidden="true"
        data-testid="hero-brand-rail"
      >
        <span
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontFamily: '"Space Grotesk", Inter, sans-serif',
            fontSize: 'clamp(30px, 3.4vw, 56px)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            opacity: 0.9,
          }}
        >
          Valuevade
        </span>
      </div>

      {/* eyebrow floating over the field */}
      <motion.p
        {...rise(0.15)}
        className="hidden lg:block absolute z-20 text-[11.5px] uppercase leading-[1.9]"
        style={{
          top: '20%',
          left: '13%',
          letterSpacing: '0.2em',
          color: 'var(--color-primary)',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        }}
        data-testid="hero-chapter"
      >
        Equity research, financial modelling,
        <br />
        taught the way analysts actually work
      </motion.p>

      {/* scattered markers */}
      <div className="hidden lg:block absolute inset-0 z-10 pointer-events-none" data-testid="hero-markers">
        {MARKERS.map((m, i) => (
          <motion.div
            key={m.l}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 + i * 0.09, duration: 0.8 }}
            className="absolute text-center"
            style={{ top: m.top, left: m.left }}
            data-testid={`hero-marker-${m.l.toLowerCase().replace(/\s/g, '-')}`}
          >
            <div
              className="text-[15px]"
              style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                color: 'var(--color-text-secondary)',
              }}
            >
              {m.n}
            </div>
            <div
              className="text-[9.5px] uppercase mt-0.5"
              style={{ letterSpacing: '0.18em', color: 'var(--color-text-faint)' }}
            >
              {m.l}
            </div>
          </motion.div>
        ))}
      </div>

      {/* right column */}
      <div className="relative z-20 min-h-screen flex items-center">
        <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-12 pt-32 pb-20 lg:pt-24">
          <div className="lg:ml-auto lg:w-[46%] lg:max-w-[680px]">
            <motion.p
              {...rise(0.2)}
              className="mb-5 text-[11px] uppercase"
              style={{
                letterSpacing: '0.24em',
                color: 'var(--color-text-faint)',
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              }}
              data-testid="hero-eyebrow"
            >
              Your AI finance mentor
            </motion.p>

            <motion.h1
              {...rise(0.28)}
              className="text-[var(--color-text)]"
              style={{
                fontFamily: '"Space Grotesk", Inter, sans-serif',
                fontSize: 'clamp(40px, 5.4vw, 82px)',
                fontWeight: 500,
                lineHeight: 0.98,
                letterSpacing: '-0.035em',
              }}
              data-testid="hero-h1"
            >
              A new way of mastering{' '}
              <span style={{ fontWeight: 700 }}>finance</span>
              <br className="hidden sm:block" /> in the{' '}
              <span
                style={{
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  color: 'var(--color-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                age of AI
              </span>
            </motion.h1>

            <motion.p
              {...rise(0.42)}
              className="mt-8 text-[14.5px] leading-relaxed max-w-md"
              style={{ color: 'var(--color-text-muted)' }}
              data-testid="hero-paragraph"
            >
              Tell Valuevade where you are and where you want to land. You get an AI-personalised
              equity research and financial modelling path: 21 modules, 239 hands-on sessions on real
              Indian companies, NISM Series XV prep, and three portfolio-grade capstones. One-time
              ₹4999 for lifetime access, and your first session is free.
            </motion.p>

            <motion.div {...rise(0.52)} className="mt-9 flex flex-col sm:flex-row items-start gap-4">
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

            <motion.p
              {...rise(0.62)}
              className="mt-7 text-[13px]"
              style={{ color: 'var(--color-text-faint)' }}
            >
              Already enrolled?{' '}
              <Link
                to="/login"
                className="text-[var(--color-primary)] hover:underline font-semibold"
                data-testid="hero-signup-link"
              >
                Log in &rarr;
              </Link>
            </motion.p>

            {/* mobile marker row */}
            <motion.div
              {...rise(0.7)}
              className="lg:hidden mt-10 grid grid-cols-3 gap-y-6 border-t border-[var(--color-border)] pt-6"
              data-testid="hero-markers-mobile"
            >
              {MARKERS.map((m) => (
                <div key={m.l}>
                  <div
                    className="text-[17px] text-[var(--color-text)]"
                    style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                  >
                    {m.n}
                  </div>
                  <div
                    className="text-[9.5px] uppercase mt-0.5"
                    style={{ letterSpacing: '0.16em', color: 'var(--color-text-faint)' }}
                  >
                    {m.l}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

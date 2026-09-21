import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import MarketDeskPanel from '@/components/landing/MarketDeskPanel';
import { useTheme } from '@/contexts/ThemeContext';

/* Hero, Jun 2026 editorial-finance rebuild: paper canvas, masthead line,
 * serif headline on the left, live market desk on the right, stat ledger
 * running the full width beneath. */

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
  const { theme } = useTheme();
  const light = theme === 'light';

  const rise = (delay = 0) => ({
    initial: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  });

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <section id="hero" className="relative overflow-hidden" data-testid="hero-section">
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-10 pt-28 lg:pt-32 pb-14 lg:pb-20">
        {/* masthead line */}
        <motion.div {...rise(0.05)} className="lv-rule-double pt-3 flex items-center justify-between gap-4 lv-folio" data-testid="hero-masthead">
          <span className="truncate">Equity research &amp; financial modelling</span>
          <span className="hidden sm:inline">{today}</span>
          <span className="hidden md:inline">NSE · BSE · Ind AS</span>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-10 items-center pt-12 lg:pt-16 pb-14 lg:pb-20">
          {/* copy */}
          <div className="lg:col-span-7">
            <motion.p {...rise(0.15)} className="lv-chapter mb-6" data-testid="hero-eyebrow">
              Your AI finance mentor
            </motion.p>

            <motion.h1
              {...rise(0.25)}
              className="text-[var(--color-text)]"
              style={{
                fontSize: 'clamp(42px, 6vw, 92px)',
                lineHeight: 0.98,
                letterSpacing: '-0.03em',
                fontWeight: 600,
              }}
              data-testid="hero-h1"
            >
              A new way of mastering finance in the{' '}
              <span className="lv-italic">age of AI</span>
            </motion.h1>

            <motion.p
              {...rise(0.4)}
              className="lv-dropcap mt-9 text-[15.5px] leading-[1.7] max-w-[560px]"
              style={{ color: 'var(--color-text-secondary)' }}
              data-testid="hero-paragraph"
            >
              Tell Valuevade where you are and where you want to land. You get an AI-personalised
              equity research and financial modelling path: 21 modules, 239 hands-on sessions on real
              Indian companies, NISM Series XV prep, and three portfolio-grade capstones. One-time
              ₹4999 for lifetime access, and your first session is free.
            </motion.p>

            <motion.div {...rise(0.52)} className="mt-9 flex flex-col sm:flex-row items-start gap-3">
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

            <motion.p {...rise(0.62)} className="mt-6 text-[13px]" style={{ color: 'var(--color-text-faint)' }}>
              Already enrolled?{' '}
              <Link to="/login" className="font-semibold hover:underline" style={{ color: 'var(--color-text)' }} data-testid="hero-signup-link">
                Log in &rarr;
              </Link>
            </motion.p>
          </div>

          {/* market desk */}
          <motion.div
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5 lg:pl-4 pr-3"
          >
            <MarketDeskPanel light={light} />
          </motion.div>
        </div>

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

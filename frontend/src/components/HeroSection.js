import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

/* Editorial-finance Hero (QuintEdge-inspired redesign, Jun 2026).
 * - Confident centered headline: bold geometric sans with an italic-serif
 *   accent word ("Financial") tinted mint-emerald.
 * - Pill CTAs, calm navy canvas, and a full-width stat band beneath.
 * - Terminal gimmicks (roadmap panel, mono ticker, CRT scan) retired for a
 *   warmer, human editorial feel.
 * All copy is verbatim from the previous version. */

const H1_LINES = [
  { weight: 500, words: ['The', 'Equity', 'Research', '&'] },
  { weight: 800, words: ['Financial', 'Modelling', 'Course'], serif: 'Financial' },
  { weight: 500, words: ['Built', 'for', 'Real'] },
  { weight: 800, words: ['Finance', 'Students'] },
];

// Stat band — drawn entirely from facts already stated in the hero copy.
const STATS = [
  { n: '239', l: 'Hands-on sessions' },
  { n: '21', l: 'Modules' },
  { n: '₹4999', l: 'One-time · lifetime' },
  { n: 'NISM XV', l: 'Exam prep' },
  { n: '3', l: 'Capstone projects' },
  { n: 'Free', l: 'First session' },
];

export default function HeroSection() {
  const reduceMotion = useReducedMotion();

  const lineVariants = {
    hidden: {},
    visible: (i = 0) => ({ transition: { staggerChildren: 0.045, delayChildren: 0.08 + i * 0.04 } }),
  };
  const wordVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]"
      data-testid="hero-section"
    >
      {/* Subtle grid texture + soft mint sparkline — calm, low opacity */}
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-40" aria-hidden="true" />
      <svg
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 w-full h-[42%] pointer-events-none z-[1]"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        style={{ opacity: 0.14 }}
      >
        <path
          d="M0,320 L160,300 L300,318 L440,268 L600,286 L760,224 L920,250 L1080,190 L1240,214 L1440,168"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.5"
        />
      </svg>

      <div className="relative z-10 flex-1 flex items-center">
        <div className="w-full max-w-5xl mx-auto px-6 pt-28 pb-16 text-center flex flex-col items-center">
          {/* Eyebrow */}
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="lv-chapter mb-8"
            data-testid="hero-chapter"
          >
            EQUITY RESEARCH · IND-AS · NISM XV
          </motion.span>

          {/* Headline */}
          <h1
            className="text-[var(--color-text)]"
            style={{
              fontSize: 'clamp(38px, 5.4vw, 68px)',
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              marginBottom: '28px',
            }}
            data-testid="hero-h1"
          >
            {H1_LINES.map((line, lineIdx) => (
              <motion.span
                key={lineIdx}
                className="block"
                style={{ fontWeight: line.weight }}
                variants={lineVariants}
                initial={reduceMotion ? 'visible' : 'hidden'}
                animate="visible"
                custom={lineIdx}
              >
                {line.words.map((w, wi) => (
                  <span key={wi}>
                    <motion.span
                      variants={wordVariants}
                      className="inline-block mr-[0.2em]"
                      style={
                        line.serif && w === line.serif
                          ? {
                              fontFamily: '"Fraunces", Georgia, serif',
                              fontStyle: 'italic',
                              fontWeight: 500,
                              color: 'var(--color-primary)',
                              letterSpacing: '-0.01em',
                            }
                          : {}
                      }
                    >
                      {w}
                    </motion.span>{' '}
                  </span>
                ))}{' '}
              </motion.span>
            ))}
          </h1>

          {/* Subhead */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="text-[var(--color-text)] text-lg lg:text-xl font-semibold mb-4"
            data-testid="hero-subhead"
          >
            Stop guessing. Start building your finance career.
          </motion.p>

          {/* Paragraph */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.64, duration: 0.5 }}
            className="text-[15px] lg:text-base text-[var(--color-text-muted)] max-w-2xl mb-9 font-bricolage leading-relaxed"
            data-testid="hero-paragraph"
          >
            Valuevade is an AI-personalised equity research and financial modelling course for Indian
            finance students and early-career switchers. The Equity Research Analyst Program covers 21
            modules and 239 hands-on sessions built on real Indian companies and Ind AS conventions,
            prepares you for the NISM Series XV exam, and ends with three portfolio-grade capstone
            projects. Lifetime access is a one-time ₹4999 — no subscription, and your first session is
            free.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.72, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6"
          >
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

          {/* Trust strip */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.5 }}
            className="text-[13px] text-[var(--color-text-faint)] font-bricolage mb-3"
            data-testid="hero-trust-strip"
          >
            NISM Series XV prep
            <span className="mx-2 opacity-50">·</span>
            One-time ₹4999
            <span className="mx-2 opacity-50">·</span>
            Lifetime access
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.92, duration: 0.45 }}
            className="text-sm text-[var(--color-text-muted)] font-bricolage"
          >
            Already enrolled?{' '}
            <Link to="/login" className="text-[var(--color-primary)] hover:underline font-semibold" data-testid="hero-signup-link">
              Log in &rarr;
            </Link>
          </motion.p>
        </div>
      </div>

      {/* Full-width stat band */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.55 }}
        className="relative z-10 border-t border-[var(--color-border)] bg-[color-mix(in_oklab,var(--bg-secondary)_80%,transparent)]"
        data-testid="hero-stats-band"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-[var(--color-border)]">
            {STATS.map((s) => (
              <div key={s.l} className="px-4 py-6 text-center" data-testid={`hero-stat-${s.l.split(' ')[0].toLowerCase()}`}>
                <div className="text-2xl lg:text-[28px] font-bold text-[var(--color-primary)]" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif', letterSpacing: '-0.02em' }}>
                  {s.n}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-bricolage">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

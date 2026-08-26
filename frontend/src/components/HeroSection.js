import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

/* Editorial-finance Hero (Feb 2026 redesign).
 * - 12-col grid: 7 cols headline stack (left), 5 cols terminal roadmap (right).
 * - Clamped magazine H1 (no more page-eating scale).
 * - Bloomberg-inspired mono meta rails, ticker, sparkline chart backdrop.
 * - Sharp CTAs (2px radius) with mono uppercase labels.
 * - Motion restraint: staggered word fade-in only. No blob/orbital/stars/cursor.
 * Content copy is verbatim from the previous version. */

const H1_LINES = [
  { weight: 500, words: ['The', 'Equity', 'Research', '&'] },
  { weight: 900, words: ['Financial', 'Modelling', 'Course'], serif: 'Financial' },
  { weight: 500, words: ['Built', 'for', 'Real'] },
  { weight: 900, words: ['Finance', 'Students'] },
];

// Bottom marquee ticker items — static equity samples.
const TICKER = [
  { s: 'RELIANCE', p: '2,932.15', c: '+1.24%', d: 'up' },
  { s: 'HDFCBANK', p: '1,678.40', c: '+0.62%', d: 'up' },
  { s: 'INFY', p: '1,842.05', c: '−0.34%', d: 'down' },
  { s: 'TCS', p: '4,128.90', c: '+0.51%', d: 'up' },
  { s: 'ICICIBANK', p: '1,142.25', c: '+0.88%', d: 'up' },
  { s: 'BAJFINANCE', p: '7,215.60', c: '−0.14%', d: 'down' },
  { s: 'LT', p: '3,684.20', c: '+1.02%', d: 'up' },
  { s: 'ITC', p: '432.85', c: '+0.28%', d: 'up' },
  { s: 'MARUTI', p: '12,410.00', c: '+0.71%', d: 'up' },
  { s: 'SBIN', p: '812.35', c: '−0.22%', d: 'down' },
];

// Compact roadmap panel content — same info as before, terminal styling.
const ROADMAP = {
  from: 'B.COM · FINAL YEAR',
  chips: ['VALUATION', 'DCF MODELLING', 'FRM L1', 'PYTHON FOR FINANCE'],
  to: 'AM ANALYST · TOP INDIAN AMC',
  progress: 68,
};

export default function HeroSection() {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const lineVariants = {
    hidden: {},
    visible: (i = 0) => ({ transition: { staggerChildren: 0.05, delayChildren: 0.1 + i * 0.04 } }),
  };
  const wordVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-stretch overflow-hidden bg-[var(--bg-primary)]"
      data-testid="hero-section"
    >
      {/* Dot-matrix grid backdrop — threads sections together */}
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-60" aria-hidden="true" />
      {/* CRT scanline overlay */}
      <div className="absolute inset-0 lv-crt-scan pointer-events-none" aria-hidden="true" />

      {/* Faint editorial finance chart line behind headline */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        style={{ opacity: 0.18 }}
      >
        <defs>
          <linearGradient id="hero-chart-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0" />
            <stop offset="35%" stopColor="var(--color-primary)" stopOpacity="0.6" />
            <stop offset="70%" stopColor="var(--color-accent-purple)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--color-accent-pink)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="lv-sparkline-path"
          d="M0,620 L120,540 L220,590 L320,470 L440,510 L560,410 L680,450 L820,340 L960,380 L1080,300 L1200,340 L1320,260 L1440,290"
          fill="none"
          stroke="url(#hero-chart-grad)"
          strokeWidth="1.5"
        />
      </svg>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-24 md:pt-28 pb-24 flex flex-col">
        {/* Chapter label */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 mb-8 md:mb-10"
        >
          <span className="lv-chapter" data-testid="hero-chapter">§01 // PROGRAM</span>
          <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
          <span className="lv-chapter">EQUITY RESEARCH · IND-AS · NISM XV</span>
        </motion.div>

        {/* Full-width H1 — occupies the entire container so the headline
            gets the visual weight it deserves (Feb 2026 tweak). */}
        <h1
          className="font-clash text-[var(--color-text)] text-center"
          style={{
            fontSize: 'clamp(38px, 6vw, 92px)',
            lineHeight: 1.02,
            letterSpacing: '-0.028em',
            marginBottom: '40px',
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
                    className="inline-block mr-[0.22em]"
                    style={
                      line.serif && w === line.serif
                        ? {
                            fontFamily: '"Fraunces", Georgia, serif',
                            fontStyle: 'italic',
                            fontWeight: 500,
                            color: 'var(--color-primary)',
                            letterSpacing: '-0.01em',
                            position: 'relative',
                          }
                        : {}
                    }
                  >
                    {w}
                    {line.serif && w === line.serif && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: '2%',
                          right: '10%',
                          bottom: '0.02em',
                          height: '2px',
                          background: 'var(--color-primary)',
                          opacity: 0.55,
                        }}
                      />
                    )}
                  </motion.span>
                  {' '}
                </span>
              ))}
              {' '}
            </motion.span>
          ))}
        </h1>

        {/* Below-H1 12-col grid — left content stack + right-aligned terminal panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 lg:items-start flex-1">
          {/* LEFT — 7 cols content stack (starts under H1 on lg) */}
          <div className="lg:col-span-7 text-center lg:text-left">
            {/* Hairline + subhead */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.55 }}
              className="h-px w-24 origin-center lg:origin-left mx-auto lg:mx-0 mb-6 bg-[var(--color-primary)]/60"
              aria-hidden="true"
            />

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="font-clash text-[var(--color-text)] text-lg lg:text-xl font-semibold mb-4"
              data-testid="hero-subhead"
            >
              Stop guessing. Start building your finance career.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.78, duration: 0.5 }}
              className="text-[15px] lg:text-base text-[var(--color-text-muted)] max-w-xl mx-auto lg:mx-0 mb-8 font-bricolage leading-relaxed"
              data-testid="hero-paragraph"
            >
              Valuevade is an AI-personalised equity research and financial modelling course for Indian
              finance students and early-career switchers. The Equity Research Analyst Program covers 21
              modules and 239 hands-on sessions built on real Indian companies and Ind AS conventions,
              prepares you for the NISM Series XV exam, and ends with three portfolio-grade capstone
              projects. Lifetime access is a one-time ₹1,500 — no subscription, and your first session is
              free.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.86, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center lg:items-center justify-center lg:justify-start gap-4 mb-7"
            >
              <Link to="/signup" className="lv-cta" data-testid="hero-primary-cta">
                Start Free Session
                <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
              <Link
                to="/course/5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors font-bricolage font-medium"
                data-testid="hero-secondary-cta"
              >
                <ArrowUpRight size={14} strokeWidth={2.4} />
                See the full curriculum
                <span className="h-px w-6 bg-[var(--color-text-muted)]" aria-hidden="true" />
              </Link>
            </motion.div>

            {/* Trust strip — mono uppercase with pipe dividers */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.5 }}
              className="font-jetbrains text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-faint)] mb-6"
              data-testid="hero-trust-strip"
            >
              NISM SERIES XV PREP
              <span className="mx-2.5 opacity-40">|</span>
              ONE-TIME ₹1,500
              <span className="mx-2.5 opacity-40">|</span>
              LIFETIME ACCESS
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.08, duration: 0.45 }}
              className="text-sm text-[var(--color-text-muted)] font-bricolage"
            >
              Already enrolled?{' '}
              <Link to="/login" className="text-[var(--color-primary)] hover:underline font-semibold" data-testid="hero-signup-link">
                Log in &rarr;
              </Link>
            </motion.p>
          </div>

          {/* RIGHT — 5 cols terminal roadmap panel, right-aligned within its column */}
          <motion.aside
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5 mt-4 lg:mt-0 lg:ml-auto w-full lg:max-w-[440px]"
          >
            <div className="lv-panel p-6" data-testid="hero-roadmap-card">
              {/* Panel header */}
              <header className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 mb-5">
                <div className="flex items-center gap-2">
                  <span className="lv-live-dot" aria-hidden="true" />
                  <span className="font-jetbrains text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    ROADMAP // STUDENT PATH
                  </span>
                </div>
                <span className="font-jetbrains text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-faint)]">
                  VV.PATH · 001
                </span>
              </header>

              {/* From */}
              <div className="mb-4">
                <div className="font-jetbrains text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-faint)] mb-1.5">
                  FROM
                </div>
                <div className="font-jetbrains text-sm text-[var(--color-text)] tracking-wide">
                  {ROADMAP.from}
                </div>
              </div>

              {/* Skills */}
              <div className="mb-4">
                <div className="font-jetbrains text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-faint)] mb-2">
                  BUILD
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ROADMAP.chips.map((s) => (
                    <span
                      key={s}
                      className="font-jetbrains text-[10.5px] uppercase tracking-[0.14em] px-2 py-1 border border-[var(--color-primary)]/40 text-[var(--color-primary)] bg-[var(--color-primary)]/8"
                      style={{ borderRadius: 2 }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Small sparkline mid-panel */}
              <svg viewBox="0 0 300 40" className="w-full h-8 mb-4" aria-hidden="true">
                <path
                  d="M0,30 L30,25 L60,28 L90,18 L120,22 L150,14 L180,17 L210,10 L240,13 L270,6 L300,9"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="1.25"
                  strokeOpacity="0.75"
                />
                <path
                  d="M0,30 L30,25 L60,28 L90,18 L120,22 L150,14 L180,17 L210,10 L240,13 L270,6 L300,9 L300,40 L0,40 Z"
                  fill="var(--color-primary)"
                  fillOpacity="0.08"
                />
              </svg>

              {/* To */}
              <div className="mb-5">
                <div className="font-jetbrains text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-faint)] mb-1.5">
                  TARGET
                </div>
                <div className="font-jetbrains text-sm text-[var(--color-accent-pink)] tracking-wide">
                  {ROADMAP.to}
                </div>
              </div>

              {/* Progress readout */}
              <div className="border-t border-[var(--color-border)] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="lv-progress-readout">PROGRESS</span>
                  <span className="lv-progress-readout text-[var(--color-text)]">
                    {ROADMAP.progress}% · 143/210
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-surface)] overflow-hidden" style={{ borderRadius: 1 }}>
                  <div
                    className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)]"
                    style={{ width: `${ROADMAP.progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Sub-caption under panel */}
            <p className="mt-3 font-jetbrains text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-faint)] text-center lg:text-right">
              Sample cohort · {mounted ? 'personalised on signup' : ''}
            </p>
          </motion.aside>
        </div>

        {/* Bottom ticker marquee */}
        <div
          className="mt-14 border-y border-[var(--color-border)] overflow-hidden lv-ticker-wrap"
          data-testid="hero-ticker"
        >
          <div className="max-w-7xl mx-auto py-2.5 whitespace-nowrap">
            <div className="lv-ticker-track font-jetbrains text-[11px] uppercase tracking-[0.14em]">
              {[...TICKER, ...TICKER].map((t, i) => (
                <span key={i} className="inline-flex items-center gap-2">
                  <span className="text-[var(--color-text-muted)]">{t.s}</span>
                  <span className="text-[var(--color-text)]">{t.p}</span>
                  <span className={t.d === 'up' ? 'text-[#22c55e]' : 'text-[#ef4444]'}>{t.c}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

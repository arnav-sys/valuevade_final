import { useMemo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

/* Premium hero — minimalist polish on the existing light aesthetic */

const H1_LINES = [
  { weight: 500, words: ['Stop', 'Guessing.'] },
  { weight: 900, words: ['Start', 'Building', 'Your'] },
  { weight: 900, words: ['Finance', 'Career.'], serif: 'Finance' },
];

export default function HeroSection({ onJoinWaitlist }) {
  const reduceMotion = useReducedMotion();
  const stars = useMemo(
    () =>
      Array.from({ length: 80 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: `${1 + Math.random() * 2}px`,
        delay: `${Math.random() * 5}s`,
        duration: `${2 + Math.random() * 3}s`,
      })),
    []
  );

  // Gentle scroll parallax on the right card (max 10px)
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    if (reduceMotion) return;
    const onScroll = () => setScrollY(Math.min(window.scrollY, 200));
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reduceMotion]);
  const parallaxY = (scrollY / 200) * 10;

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  // Word-by-word stagger — 60ms between words, 400ms duration
  const lineVariants = {
    hidden: {},
    visible: (i = 0) => ({ transition: { staggerChildren: 0.06, delayChildren: 0.15 + i * 0.05 } }),
  };
  const wordVariants = {
    hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)',
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center overflow-hidden bg-[var(--bg-primary)]"
      data-testid="hero-section"
    >
      {/* Subtle SVG grain overlay — 1.5% opacity, premium tactile feel */}
      <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none z-[1]" style={{ opacity: 0.06, mixBlendMode: 'multiply' }}>
        <filter id="hero-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-grain)" />
      </svg>

      {/* Star particles */}
      {stars.map((star, i) => (
        <div key={i} className="star-particle"
          style={{ left: star.left, top: star.top, width: star.size, height: star.size,
                   animation: `twinkle ${star.duration} ease-in-out ${star.delay} infinite` }} />
      ))}

      {/* Orbital ellipses — kept from original */}
      <div className="orbital border-[var(--color-primary)]/20" style={{ width: '700px', height: '300px', animation: 'orbit 25s linear infinite' }} />
      <div className="orbital border-[var(--color-accent-purple)]/[0.15]" style={{ width: '900px', height: '400px', animation: 'orbit-reverse 40s linear infinite' }} />
      <div className="orbital border-[var(--color-accent-pink)]/10" style={{ width: '1100px', height: '480px', animation: 'orbit 60s linear infinite' }} />

      {/* Glow blobs */}
      <div className="absolute top-[10%] right-[10%] w-[300px] h-[300px] lg:w-[400px] lg:h-[400px] bg-[var(--color-primary)]/20 rounded-full animate-blob" style={{ filter: 'blur(120px)' }} />
      <div className="absolute bottom-[10%] left-[10%] w-[300px] h-[300px] lg:w-[400px] lg:h-[400px] bg-[var(--color-accent-purple)]/20 rounded-full animate-blob" style={{ filter: 'blur(120px)', animationDelay: '-4s' }} />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full flex flex-col lg:flex-row items-center gap-12 lg:gap-20 pt-32 pb-20 lg:pt-36 lg:pb-24">
        {/* Left content */}
        <div className="flex-1 text-center lg:text-left">
          {/* Eyebrow with live pulse dot */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-[var(--color-accent-pink)]/40 text-[var(--color-accent-pink)] text-[11px] font-jetbrains font-semibold mb-10 uppercase tracking-[0.12em]"
            style={{ boxShadow: '0 0 22px rgba(255, 106, 193, 0.10)' }}
            data-testid="hero-badge"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent-pink)] opacity-70 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent-pink)]" />
            </span>
            Now in Beta · Limited Early Access
          </motion.div>

          {/* H1 — word-by-word stagger + mixed weights + serif accent */}
          <h1
            className="font-clash text-[44px] sm:text-6xl lg:text-[88px] xl:text-[96px] text-[var(--color-text)] mb-8"
            style={{ lineHeight: 0.97, letterSpacing: '-0.035em' }}
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
                  <motion.span
                    key={wi}
                    variants={wordVariants}
                    className="inline-block mr-[0.24em]"
                    style={
                      line.serif && w === line.serif
                        ? { fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 500,
                            color: 'var(--color-primary)', letterSpacing: '-0.01em' }
                        : {}
                    }
                  >
                    {w}
                  </motion.span>
                ))}
                {/* Blinking cursor only at end of last line */}
                {lineIdx === H1_LINES.length - 1 && !reduceMotion && (
                  <motion.span
                    aria-hidden="true"
                    className="inline-block align-baseline ml-1"
                    style={{ color: 'var(--color-accent-pink)', fontWeight: 300 }}
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  >
                    |
                  </motion.span>
                )}
              </motion.span>
            ))}
          </h1>

          {/* Hairline gradient divider under H1 — editorial polish */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.9, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="h-px w-32 origin-left mb-7 mx-auto lg:mx-0"
            style={{ background: 'linear-gradient(90deg, rgba(36,107,253,0.55), transparent)' }}
            aria-hidden="true"
          />

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-base lg:text-lg text-[var(--color-text-muted)] max-w-xl mb-10 font-bricolage leading-relaxed mx-auto lg:mx-0"
          >
            Valuevade is the AI copilot that analyses your skills, maps your dream role, and builds your
            personalised learning path &mdash; with interactive notes, real simulations, and interview
            prep that actually works.
          </motion.p>

          {/* CTAs — sheen sweep on primary, hairline ghost */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row gap-3.5 mb-7 justify-center lg:justify-start"
          >
            <button
              onClick={onJoinWaitlist}
              className="hero-cta-primary group relative overflow-hidden inline-flex items-center justify-center gap-2 px-7 py-4 text-base font-semibold text-white rounded-full"
              style={{
                background: 'var(--color-primary)',
                boxShadow: '0 8px 24px -8px rgba(36,107,253,0.55), 0 0 0 1px rgba(36,107,253,0.18) inset',
                transition: 'transform 220ms ease, box-shadow 220ms ease',
              }}
              data-testid="hero-join-waitlist-btn"
            >
              <span className="relative z-10">Join the Waitlist Free</span>
              <ArrowRight size={18} className="relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
              {/* Sheen sweep */}
              <span aria-hidden="true" className="hero-sheen" />
            </button>
            <button
              onClick={() => scrollTo('how-it-works')}
              className="inline-flex items-center justify-center gap-2 px-6 py-4 text-base font-medium text-[var(--color-text)] rounded-full transition-colors"
              style={{ border: '1px solid var(--color-border)', background: 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              data-testid="hero-how-it-works-btn"
            >
              See How It Works
              <ArrowRight size={16} className="opacity-70" />
            </button>
          </motion.div>

          {/* Trust strip — small editorial credibility line */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.6 }}
            className="text-[11px] font-jetbrains uppercase tracking-[0.14em] text-[var(--color-text-faint)] mb-8 text-center lg:text-left"
            data-testid="hero-trust-strip"
          >
            CFA Institute aligned <span className="opacity-50 mx-1">·</span> NISM Series-VIII compatible
            <span className="opacity-50 mx-1">·</span> CFI partnered
            <span className="opacity-50 mx-1">·</span> Built in India
          </motion.p>

          {/* Secondary signup CTA */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className="text-sm text-[var(--color-text-muted)] mb-7 font-bricolage text-center lg:text-left"
          >
            Already eligible?{' '}
            <Link to="/signup" className="text-[var(--color-primary)] hover:underline font-semibold" data-testid="hero-signup-link">
              Sign up now &rarr;
            </Link>
          </motion.p>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.5 }}
            className="flex items-center gap-3 justify-center lg:justify-start"
          >
            <div className="flex -space-x-2.5">
              {[
                'linear-gradient(135deg, #246BFD, #6A5CFF)',
                'linear-gradient(135deg, #6A5CFF, #FF6AC1)',
                'linear-gradient(135deg, #FF6AC1, #246BFD)',
                'linear-gradient(135deg, #246BFD, #FF6AC1)',
                'linear-gradient(135deg, #6A5CFF, #246BFD)',
              ].map((bg, i) => (
                <div key={i} className="w-9 h-9 rounded-full border-2 border-[var(--bg-primary)]" style={{ background: bg }} />
              ))}
            </div>
            <p className="text-[var(--color-text-muted)] text-sm font-bricolage" data-testid="social-proof-text">
              Join 500+ finance students already on the waitlist
            </p>
          </motion.div>
        </div>

        {/* Right: Floating roadmap card with premium frame */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex-shrink-0 animate-hero-float"
          style={{ transform: `translateY(${parallaxY}px)`, transition: 'transform 600ms cubic-bezier(0.22,1,0.36,1)' }}
        >
          <div
            className="w-[320px] sm:w-[360px] p-6 rounded-2xl glass-card relative"
            style={{
              borderColor: 'rgba(106, 92, 255, 0.25)',
              boxShadow:
                '0 0 0 1px rgba(106, 92, 255, 0.08), 0 24px 48px -16px rgba(36, 107, 253, 0.18), 0 0 40px rgba(106, 92, 255, 0.12)',
            }}
            data-testid="hero-roadmap-card"
          >
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="text-[var(--color-accent-pink)]" size={18} />
              <span className="text-[var(--color-text)] font-clash text-lg">Your Roadmap</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="px-4 py-2 bg-[var(--color-surface)] rounded-full text-[var(--color-text-muted)] text-sm font-jetbrains">
                B.Com Final Year
              </div>
              <div className="w-px h-5 bg-gradient-to-b from-[var(--color-border)] to-[var(--color-primary)]/40" />
              <div className="flex flex-wrap justify-center gap-2">
                {['Valuation', 'DCF Modelling', 'FRM L1', 'Python for Finance'].map((skill) => (
                  <span key={skill} className="px-3 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs rounded-full font-jetbrains border border-[var(--color-primary)]/20">
                    {skill}
                  </span>
                ))}
              </div>
              <div className="w-px h-5 bg-gradient-to-b from-[var(--color-primary)]/40 to-[var(--color-accent-pink)]/40" />
              <div className="px-4 py-2 bg-[var(--color-accent-pink)]/10 text-[var(--color-accent-pink)] text-sm rounded-full font-jetbrains border border-[var(--color-accent-pink)]/30"
                   style={{ boxShadow: '0 0 16px rgba(255, 106, 193, 0.15)' }}>
                AM Analyst @ DSP Blackrock
              </div>
            </div>
            <div className="mt-6">
              <div className="flex justify-between text-xs text-[var(--color-text-faint)] mb-2 font-jetbrains">
                <span>Progress</span>
                <span>68% complete</span>
              </div>
              <div className="h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
                <div className="h-full w-[68%] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] rounded-full" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Local styles for the sheen + reduced-motion guard */}
      <style>{`
        .hero-cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 32px -10px rgba(36,107,253,0.65), 0 0 0 1px rgba(36,107,253,0.22) inset;
        }
        .hero-sheen {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(120deg, transparent 0%, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%, transparent 100%);
          transform: translateX(-120%);
          transition: transform 700ms ease;
        }
        .hero-cta-primary:hover .hero-sheen { transform: translateX(120%); }
        @media (prefers-reduced-motion: reduce) {
          .hero-cta-primary, .hero-cta-primary:hover { transform: none !important; transition: none !important; }
          .hero-sheen { display: none !important; }
        }
      `}</style>
    </section>
  );
}

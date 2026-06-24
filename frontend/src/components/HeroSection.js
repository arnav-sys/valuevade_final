/* Cinematic typography hero — v4.
 *
 * Concept: the headline IS the centerpiece. Massive Space Grotesk
 * letterforms with layered text-shadows that emulate extruded depth +
 * fresnel-style highlights. Each word reveals on a unique micro-physics
 * curve, then the whole headline settles into a slow breathing state.
 *
 * Cursor moves the camera (CSS perspective rotation on the container),
 * click anywhere in the hero triggers a left→right specular sweep across
 * the letters. "Finance" is the brand-marked word — violet gradient fill
 * + a continuously pulsing inner glow.
 *
 * Subtitle + CTAs sit in a small floating glassmorphic bar at the bottom
 * of the viewport so they don't compete with the typography. The old
 * roadmap card no longer renders in the hero.
 *
 * Light mode mirrors the choreography in deep-indigo on cream.
 */

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

// One word = one unit. `accent: 'violet'` marks "Finance" as the brand word.
// `delay` is in ms from the section mount; `kind` picks the entry physics.
const WORDS = [
  { text: 'Stop',      delay:   80, kind: 'impact' },
  { text: 'Guessing.', delay:  360, kind: 'impact' },
  { text: 'Start',     delay:  960, kind: 'draw-in' },
  { text: 'Building',  delay: 1220, kind: 'settle' },
  { text: 'Your',      delay: 1500, kind: 'settle', small: true },
  { text: 'Finance',   delay: 1780, kind: 'glow',   accent: 'violet' },
  { text: 'Career.',   delay: 2080, kind: 'final' },
];

const SUB =
  'Valuevade is the AI copilot that analyses your skills, maps your dream role, and builds your personalised learning path \u2014 with interactive notes, real simulations, and interview prep that actually works.';

export default function HeroSection({ onJoinWaitlist }) {
  const reduce = useReducedMotion();
  // Mouse → CSS perspective rotation on the headline container. Lerp toward
  // target each frame for buttery feel; capped at ±5° per spec.
  const stageRef = useRef(null);
  const rotRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  // Click ripple sweep state — bumps a key on each click to re-trigger the
  // CSS keyframes via `animation-name` toggle.
  const [rippleKey, setRippleKey] = useState(0);
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    if (reduce) return undefined;
    const onMove = (e) => {
      const w = window.innerWidth, h = window.innerHeight;
      const nx = (e.clientX / w) * 2 - 1;     // -1..1
      const ny = (e.clientY / h) * 2 - 1;
      targetRef.current = { x: ny * 4, y: nx * 5 };  // rotateX / rotateY in deg
    };
    const onClick = () => setRippleKey((k) => k + 1);
    window.addEventListener('mousemove', onMove, { passive: true });
    const sec = stageRef.current?.closest('#hero');
    sec?.addEventListener('click', onClick);
    let raf;
    const loop = () => {
      const c = rotRef.current, t = targetRef.current;
      c.x += (t.x - c.x) * 0.06;
      c.y += (t.y - c.y) * 0.06;
      if (stageRef.current) {
        stageRef.current.style.transform =
          `rotateX(${c.x.toFixed(2)}deg) rotateY(${c.y.toFixed(2)}deg)`;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      window.removeEventListener('mousemove', onMove);
      sec?.removeEventListener('click', onClick);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  return (
    <section
      id="hero"
      data-testid="hero-section"
      className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)] flex flex-col items-stretch"
    >
      {/* Ambient violet light — dark mode only; light mode uses cream glow */}
      <div aria-hidden="true" className="hero-ambient pointer-events-none absolute inset-0 z-[1]" />
      <div aria-hidden="true" className="hero-vignette pointer-events-none absolute inset-0 z-[2]" />

      {/* Stage — full-bleed typography centered vertically */}
      <div
        className="relative z-[3] flex-1 flex items-center justify-center px-4 sm:px-8"
        style={{ perspective: '1400px' }}
      >
        <div
          ref={stageRef}
          className="hero-stage w-full max-w-[1400px] text-center"
          style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
          <h1
            className="hero-headline font-clash font-extrabold tracking-[-0.02em] leading-[0.92]"
            style={{
              fontSize: 'clamp(60px, 12vw, 184px)',
              color: 'var(--color-text)',
            }}
            data-testid="hero-headline"
          >
            {WORDS.map((w) => (
              <span
                key={w.text}
                className={`hero-word hero-word-${w.kind} ${w.small ? 'hero-word-small' : ''} ${w.accent === 'violet' ? 'hero-word-violet' : ''}`}
                style={{
                  animationDelay: `${reduce ? 0 : w.delay}ms`,
                  '--word-delay': `${reduce ? 0 : w.delay}ms`,
                }}
                data-testid={`hero-word-${w.text.replace(/[^a-z]/gi, '').toLowerCase()}`}
              >
                {w.text}{' '}
              </span>
            ))}
            {/* Specular sweep — re-runs on each in-hero click */}
            <span
              key={`ripple-${rippleKey}`}
              aria-hidden="true"
              className={`hero-ripple ${rippleKey > 0 ? 'hero-ripple-active' : ''}`}
            />
          </h1>
        </div>
      </div>

      {/* Floating glass bar with subtitle + CTAs + trust strip */}
      <div className="relative z-[4] pb-8 sm:pb-12 px-4 sm:px-8" data-testid="hero-floating-bar-wrap">
        <div
          className="hero-floating-bar mx-auto max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-xl px-5 sm:px-7 py-5 sm:py-6"
          data-testid="hero-floating-bar"
          style={{ animation: reduce ? 'none' : 'hero-bar-in 700ms cubic-bezier(.22,1,.36,1) 2400ms both' }}
        >
          <p className="text-[13px] sm:text-sm text-[var(--color-text-muted)] font-bricolage leading-relaxed mb-4 text-center" data-testid="hero-subhead">
            {SUB}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center" data-testid="hero-cta-row">
            <button
              onClick={onJoinWaitlist}
              data-testid="hero-join-waitlist-btn"
              className="hero-cta-primary group relative overflow-hidden inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold text-white rounded-full"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                boxShadow: '0 10px 32px -10px rgba(139,92,246,0.65), 0 0 0 1px rgba(167,139,250,0.35) inset',
              }}
            >
              <span className="relative z-10">Join the Waitlist Free</span>
              <ArrowRight size={16} className="relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
              <span aria-hidden="true" className="hero-sheen" />
            </button>
            <button
              onClick={() => scrollTo('how-it-works')}
              data-testid="hero-how-it-works-btn"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-medium text-[var(--color-text)] rounded-full transition-colors"
              style={{ border: '1px solid var(--color-border)', background: 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              See How It Works
              <ArrowRight size={14} className="opacity-70" />
            </button>
          </div>
          <p className="mt-4 text-[10px] font-jetbrains font-black uppercase tracking-[0.18em] text-[var(--color-text-faint)] text-center" data-testid="hero-trust-strip">
            CFA Institute aligned <span className="opacity-50 mx-1">·</span> NISM Series-VIII compatible <span className="opacity-50 mx-1">·</span> CFI partnered
          </p>
        </div>
      </div>

      <style>{`
        /* --- AMBIENT LIGHTING --- */
        .hero-ambient {
          background:
            radial-gradient(60% 50% at 78% 18%, rgba(139,92,246,0.32), transparent 70%),
            radial-gradient(50% 40% at 18% 82%, rgba(196,181,253,0.20), transparent 65%),
            radial-gradient(80% 60% at 50% 50%, rgba(8,8,15,0) 0%, rgba(8,8,15,0.55) 100%);
        }
        .hero-vignette {
          background: radial-gradient(80% 80% at 50% 50%, transparent 55%, rgba(8,8,15,0.65) 100%);
        }
        /* Light-mode swap — cream + indigo */
        :root:not(.dark) .hero-ambient {
          background:
            radial-gradient(60% 50% at 78% 18%, rgba(106,92,255,0.18), transparent 70%),
            radial-gradient(50% 40% at 18% 82%, rgba(36,107,253,0.14), transparent 65%);
        }
        :root:not(.dark) .hero-vignette { background: none; }

        /* --- HEADLINE WORDS --- */
        .hero-headline {
          position: relative;
          /* Extruded depth via stacked text-shadows. Eight layers of
             gradually-deepening violet make each glyph read as a thick
             slab of glass. */
          text-shadow:
            0 1px 0 rgba(167,139,250,0.18),
            0 2px 0 rgba(139,92,246,0.16),
            0 4px 0 rgba(139,92,246,0.13),
            0 7px 18px rgba(8,8,15,0.45),
            0 14px 40px rgba(139,92,246,0.20);
        }
        :root:not(.dark) .hero-headline {
          text-shadow:
            0 1px 0 rgba(36,107,253,0.10),
            0 2px 0 rgba(106,92,255,0.08),
            0 4px 0 rgba(106,92,255,0.06),
            0 7px 18px rgba(36,107,253,0.10);
        }
        .hero-word {
          display: inline-block;
          opacity: 0;
          will-change: transform, opacity, filter;
          animation-fill-mode: both;
          animation-duration: 900ms;
          animation-timing-function: cubic-bezier(.22,1,.36,1);
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-word { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
          .hero-ripple, .hero-bar-in { animation: none !important; }
          .hero-stage { transform: none !important; }
        }
        /* Word-kind physics: bespoke entrance per word ---------------- */
        .hero-word-impact   { animation-name: hero-impact;   transform-origin: center; }
        .hero-word-draw-in  { animation-name: hero-draw-in;  }
        .hero-word-settle   { animation-name: hero-settle;   }
        .hero-word-glow     { animation-name: hero-glow-in;  }
        .hero-word-final    { animation-name: hero-final;    }
        .hero-word-small    { font-size: 0.78em; opacity: 0.86; }
        /* Brand-marked violet word — gradient fill + persistent pulse  */
        .hero-word-violet {
          background: linear-gradient(180deg, #c4b5fd 0%, #8b5cf6 55%, #7c4ddb 100%);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 24px rgba(139,92,246,0.65));
          animation-name: hero-glow-in, hero-violet-pulse;
          animation-duration: 900ms, 3.6s;
          animation-delay: var(--word-delay, 0ms), calc(var(--word-delay, 0ms) + 900ms);
          animation-iteration-count: 1, infinite;
          animation-timing-function: cubic-bezier(.22,1,.36,1), ease-in-out;
        }
        @keyframes hero-impact {
          0%   { opacity: 0; transform: translateY(-32px) scale(1.18) skewY(-3deg); filter: blur(10px); }
          60%  { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1) skewY(0); filter: blur(0); }
        }
        @keyframes hero-draw-in {
          0%   { opacity: 0; transform: translateY(18px) scale(0.96); filter: blur(8px); }
          100% { opacity: 1; transform: translateY(0)   scale(1);    filter: blur(0); }
        }
        @keyframes hero-settle {
          0%   { opacity: 0; transform: translateY(20px); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes hero-glow-in {
          0%   { opacity: 0; transform: translateY(14px) scale(0.92); filter: blur(12px) drop-shadow(0 0 0 rgba(139,92,246,0)); }
          80%  { opacity: 1; filter: blur(0) drop-shadow(0 0 36px rgba(139,92,246,0.85)); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0) drop-shadow(0 0 24px rgba(139,92,246,0.65)); }
        }
        @keyframes hero-final {
          0%   { opacity: 0; transform: translateY(8px) scale(1.05); letter-spacing: 0.15em; }
          70%  { opacity: 1; letter-spacing: -0.02em; }
          100% { opacity: 1; transform: translateY(0) scale(1); letter-spacing: -0.02em; }
        }
        @keyframes hero-violet-pulse {
          0%, 100% { filter: drop-shadow(0 0 16px rgba(139,92,246,0.45)); }
          50%      { filter: drop-shadow(0 0 36px rgba(139,92,246,0.85)); }
        }

        /* --- BREATHING (whole headline) after all words land --- */
        .hero-headline {
          animation: hero-breathe 4.4s ease-in-out infinite;
          animation-delay: 2700ms;
        }
        @keyframes hero-breathe {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.012); }
        }
        @media (prefers-reduced-motion: reduce) { .hero-headline { animation: none !important; } }

        /* --- CLICK RIPPLE: specular sweep --- */
        .hero-ripple {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%);
          mix-blend-mode: screen;
          mask-image: linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent);
          opacity: 0;
        }
        .hero-ripple-active { animation: hero-ripple-sweep 700ms ease-out both; }
        @keyframes hero-ripple-sweep {
          0%   { opacity: 0; transform: translateX(-110%); }
          30%  { opacity: 0.85; }
          100% { opacity: 0; transform: translateX(110%); }
        }

        /* --- FLOATING BAR ENTRANCE --- */
        @keyframes hero-bar-in {
          0%   { opacity: 0; transform: translateY(20px); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }

        /* --- PRIMARY CTA SHEEN (carryover idiom) --- */
        .hero-sheen {
          position: absolute; inset: 0;
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%);
          transform: translateX(-100%);
          mix-blend-mode: screen;
        }
        .hero-cta-primary:hover .hero-sheen { animation: hero-cta-sheen 900ms ease-out both; }
        @keyframes hero-cta-sheen {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(110%); }
        }
      `}</style>
    </section>
  );
}

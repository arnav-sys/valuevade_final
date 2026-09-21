// LandingIntroSequence, full-viewport overlay that plays on first visit per
// browser session. Particles converge into the Valuevade wordmark for ~1.4s,
// hold for 300ms, then the whole overlay fades out and unmounts. After it
// plays once we set `valuevade_intro_played` in localStorage so subsequent
// visits skip it. Reduced-motion users skip entirely.
//
// Implementation note: this is intentionally CSS-only (no three.js). The
// hero's three.js is the expensive scene; the intro is a cheap, brand-only
// title sequence. Letters fly in from random offsets (transform translate
// + rotate) with staggered delays, then settle.

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'valuevade_intro_played';
const TOTAL_MS = 2100;    // includes settle + fade-out
const FADE_OUT_DELAY = 1600;

const LETTERS = 'VALUEVADE'.split('');

function shouldSkip() {
  if (typeof window === 'undefined') return true;
  try {
    if (window.location.search.includes('nointro=1')) return true;
    if (window.localStorage.getItem(STORAGE_KEY) === '1') return true;
  } catch { /* ignore */ }
  const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  return !!(mq && mq.matches);
}

export default function LandingIntroSequence() {
  const [phase, setPhase] = useState(() => (shouldSkip() ? 'done' : 'in'));

  useEffect(() => {
    if (phase === 'done') return undefined;
    const fadeTimer = setTimeout(() => setPhase('out'), FADE_OUT_DELAY);
    const doneTimer = setTimeout(() => {
      setPhase('done');
      try { window.localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    }, TOTAL_MS);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      data-testid="landing-intro-sequence"
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: '#0A0F1C',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 480ms ease-out',
      }}
    >
      {/* Radial spotlight behind the wordmark */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(40% 30% at 50% 50%, rgba(36,107,253,0.28), transparent 70%)',
          opacity: phase === 'out' ? 0 : 1,
          transition: 'opacity 480ms ease-out',
        }}
      />
      <div
        className="intro-wordmark"
        style={{
          fontFamily: '"Clash Display", "Space Grotesk", system-ui, sans-serif',
          fontSize: 'clamp(48px, 10vw, 128px)',
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: '#ffffff',
          display: 'flex',
          gap: '0.04em',
          textShadow: '0 0 38px rgba(36,107,253,0.45)',
        }}
      >
        {LETTERS.map((ch, i) => (
          <span
            key={i}
            className="intro-letter"
            style={{
              display: 'inline-block',
              animation: `intro-letter-in 900ms cubic-bezier(.22,1,.36,1) ${i * 65}ms both`,
            }}
          >
            {ch}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes intro-letter-in {
          0%   { opacity: 0; transform: translateY(40px) translateX(var(--ix, -8px)) rotate(-6deg) scale(0.6); filter: blur(10px); }
          60%  { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) translateX(0) rotate(0) scale(1); filter: blur(0); }
        }
        .intro-letter:nth-child(2n) { --ix: 12px; }
        .intro-letter:nth-child(3n) { --ix: -14px; }
        .intro-letter:nth-child(5n) { --ix: 18px; }
      `}</style>
    </div>
  );
}

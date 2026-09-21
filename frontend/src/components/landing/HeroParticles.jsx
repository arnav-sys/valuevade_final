import { useMemo } from 'react';

/* Sparse white "twinkle" particles for the dark hero band, pure CSS
 * animation, brand-blue glow only (no purple) so it doesn't read as
 * generic "AI gradient" noise. */

function makeParticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 1.5 + Math.random() * 2.2,
    duration: 3 + Math.random() * 5,
    delay: Math.random() * 6,
    peak: 0.25 + Math.random() * 0.55,
  }));
}

export default function HeroParticles({ count = 46 }) {
  const particles = useMemo(() => makeParticles(count), [count]);
  return (
    <div className="hero-particles" aria-hidden="true" data-testid="hero-particles">
      {particles.map((p) => (
        <i
          key={p.id}
          className="hero-particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            '--op': p.peak,
          }}
        />
      ))}
    </div>
  );
}

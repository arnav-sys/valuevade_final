// Cinematic-redesign primitives: animated counter, magnetic-tilt card,
// letter-stagger headline. Used by /courses and Course Details.

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/* ---------- useCountUp: simple rAF ease-out counter ---------- */
export function useCountUp(target, { duration = 1200, start = 0, run = true } = {}) {
  // Initial state is the REAL target value — so the first render (used by
  // SSR / edge prerender snapshots) shows the real number to crawlers.
  // When the effect fires in the browser (after IO intersect), we reset to
  // `start` and animate up to `target`.
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    // Reset to start, then animate up.
    setValue(start);
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const loop = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      setValue(Math.round(start + (target - start) * ease(p)));
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start, run]);
  return value;
}

/* ---------- AnimatedStat: counter that runs when scrolled into view ---------- */
export function AnimatedStat({ value, label, icon, suffix = '', testid }) {
  const ref = useRef(null);
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (!ref.current) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setRun(true),
      { threshold: 0.3 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  const v = useCountUp(value, { run, duration: 1400 });
  return (
    <motion.div
      ref={ref}
      data-testid={testid}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-xl p-5 sm:p-6 overflow-hidden group"
    >
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-[var(--color-accent-purple)]/0 via-transparent to-[var(--color-accent-purple)]/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="text-[var(--color-accent-purple)] mb-3">{icon}</div>
      <div className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] leading-none tabular-nums">
        {v}{suffix}
      </div>
      <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </div>
    </motion.div>
  );
}

/* ---------- MagneticCard: cursor-following tilt ---------- */
export function MagneticCard({ children, className = '', maxTilt = 8, testid }) {
  const ref = useRef(null);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  const [transform, setTransform] = useState('rotateX(-2deg) rotateY(1deg)');
  const onMove = (e) => {
    if (reducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const ry = Math.max(-1, Math.min(1, dx)) * maxTilt;
    const rx = -Math.max(-1, Math.min(1, dy)) * maxTilt;
    setTransform(`rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-8px)`);
  };
  const onLeave = () => setTransform('rotateX(-2deg) rotateY(1deg)');
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      data-testid={testid}
      style={{
        transform,
        transformStyle: 'preserve-3d',
        transition: 'transform 320ms cubic-bezier(.22,1,.36,1)',
        willChange: 'transform',
      }}
      className={className}
    >
      {children}
    </div>
  );
}

/* ---------- LetterStaggerHeadline: letter-by-letter scroll reveal ---------- */
export function LetterStaggerHeadline({ text, className = '', testid }) {
  const letters = text.split('');
  return (
    <h1
      data-testid={testid}
      className={className}
      aria-label={text}
      style={{ display: 'inline-block' }}
    >
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.55, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
          aria-hidden="true"
        >
          {ch}
        </motion.span>
      ))}
    </h1>
  );
}

/* ---------- BreathingGlow wrapper for primary CTAs ---------- */
export function BreathingGlow({ children, className = '', testid }) {
  return (
    <div className={`relative inline-block ${className}`} data-testid={testid}>
      <div
        aria-hidden="true"
        className="absolute -inset-2 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(closest-side, rgba(139,92,246,0.55), transparent 70%)',
          filter: 'blur(14px)',
          animation: 'breathing-glow 3.6s ease-in-out infinite',
        }}
      />
      <div className="relative z-10">{children}</div>
      <style>{`
        @keyframes breathing-glow {
          0%,100% { opacity: 0.45; transform: scale(0.96); }
          50%     { opacity: 0.85; transform: scale(1.04); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid] [aria-hidden="true"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ---------- ScrollProgressBar: thin violet bar at top ---------- */
export function ScrollProgressBar() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setPct(max > 0 ? (h.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      aria-hidden="true"
      data-testid="scroll-progress-bar"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #8b5cf6, #c4b5fd)',
          boxShadow: '0 0 10px rgba(139,92,246,0.55)',
          transition: 'width 80ms linear',
        }}
      />
    </div>
  );
}

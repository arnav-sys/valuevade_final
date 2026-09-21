import { useEffect, useRef } from 'react';

/* Canvas particle field whose particles settle into the silhouette of a
 * rising candlestick chart. Pointer acts as a soft repeller. No deps. */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCandles(count, rand) {
  const candles = [];
  let price = 0.10;
  for (let i = 0; i < count; i += 1) {
    const drift = 0.03 + rand() * 0.014;
    const shock = (rand() - 0.5) * 0.12;
    const open = price;
    let close = Math.min(0.92, Math.max(0.08, open + drift + shock));
    // guarantee a readable body
    if (Math.abs(close - open) < 0.055) close = open + (close >= open ? 0.055 : -0.055);
    const top = Math.max(open, close);
    const bottom = Math.min(open, close);
    const high = Math.min(1, top + 0.02 + rand() * 0.05);
    const low = Math.max(0, bottom - 0.02 - rand() * 0.05);
    candles.push({ open, close, high, low, x: (i + 0.5) / count });
    price = close;
  }
  return candles;
}

// Returns normalized target points (0..1 space, y already inverted for screen).
function buildTargets(rand) {
  const N = 13;
  const candles = buildCandles(N, rand);
  const halfW = (0.5 / N) * 0.84;
  const pts = [];
  const push = (x, y, weight) => pts.push({ nx: x, ny: 1 - y, w: weight });

  candles.forEach((c) => {
    const top = Math.max(c.open, c.close);
    const bottom = Math.min(c.open, c.close);

    // upper + lower wick
    for (let k = 0; k < 13; k += 1) {
      const t = k / 12;
      push(c.x + (rand() - 0.5) * 0.004, top + (c.high - top) * t, 0.55);
      push(c.x + (rand() - 0.5) * 0.004, bottom - (bottom - c.low) * t, 0.55);
    }
    // body outline (dense) + sparse interior
    const steps = 30;
    for (let k = 0; k <= steps; k += 1) {
      const t = k / steps;
      push(c.x - halfW, bottom + (top - bottom) * t, 1);
      push(c.x + halfW, bottom + (top - bottom) * t, 1);
    }
    for (let k = 0; k <= 14; k += 1) {
      const t = k / 14;
      push(c.x - halfW + halfW * 2 * t, top, 1);
      push(c.x - halfW + halfW * 2 * t, bottom, 1);
    }
    for (let k = 0; k < 26; k += 1) {
      push(c.x - halfW + rand() * halfW * 2, bottom + rand() * (top - bottom), 0.4);
    }
  });

  // trend line riding the closes, plus a soft halo of drifting motes
  for (let i = 0; i < candles.length - 1; i += 1) {
    const a = candles[i];
    const b = candles[i + 1];
    for (let k = 0; k < 10; k += 1) {
      const t = k / 10;
      push(a.x + (b.x - a.x) * t, a.close + (b.close - a.close) * t, 0.75);
    }
  }
  for (let i = 0; i < 160; i += 1) {
    push(rand(), rand(), 0.16);
  }
  return pts;
}

export const CandlestickParticleField = ({ accent = '#246BFD', light = false, className = '', style }) => {
  const canvasRef = useRef(null);
  const pointer = useRef({ x: -9999, y: -9999, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rand = mulberry32(20260622);
    const targets = buildTargets(rand);

    let w = 0;
    let h = 0;
    let dpr = 1;
    let particles = [];

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const padX = w * 0.06;
      const padY = h * 0.14;
      const iw = w - padX * 2;
      const ih = h - padY * 2;
      const density = w < 720 ? 0.45 : 1;

      particles = targets
        .filter((t) => (t.w > 0.5 ? true : rand() < 0.85))
        .filter(() => rand() < density)
        .map((t) => {
          const tx = padX + t.nx * iw;
          const ty = padY + t.ny * ih;
          return {
            tx,
            ty,
            x: tx + (rand() - 0.5) * 150,
            y: ty + (rand() - 0.5) * 150,
            vx: 0,
            vy: 0,
            w: t.w,
            size: t.w > 0.7 ? 1.8 + rand() * 1.9 : 1.1 + rand() * 1.2,
            bright: rand() < 0.09,
            ph: rand() * Math.PI * 2,
            sp: 0.4 + rand() * 0.9,
          };
        });
    };

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(canvas);

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
    };
    const onLeave = () => { pointer.current.active = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);

    let raf;
    let t0 = performance.now();
    const draw = (now) => {
      const dt = Math.min(48, now - t0) / 16.67;
      t0 = now;
      ctx.clearRect(0, 0, w, h);

      const p = pointer.current;
      const rep = 132;
      for (let i = 0; i < particles.length; i += 1) {
        const q = particles[i];
        if (reduce) {
          q.x = q.tx;
          q.y = q.ty;
        } else {
          const wob = Math.sin(now * 0.0004 * q.sp + q.ph) * 3.2;
          const ax = (q.tx + wob - q.x) * 0.04;
          const ay = (q.ty + Math.cos(now * 0.00035 * q.sp + q.ph) * 3.2 - q.y) * 0.04;
          q.vx = (q.vx + ax * dt) * 0.9;
          q.vy = (q.vy + ay * dt) * 0.9;
          if (p.active) {
            const dx = q.x - p.x;
            const dy = q.y - p.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < rep * rep && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const f = (1 - d / rep) * 3.4;
              q.vx += (dx / d) * f * dt;
              q.vy += (dy / d) * f * dt;
            }
          }
          q.x += q.vx * dt;
          q.y += q.vy * dt;
        }

        const a = (light ? 0.78 : 0.9) * q.w + (q.bright ? 0.1 : 0);
        ctx.globalAlpha = Math.min(1, a);
        ctx.fillStyle = accent;
        const s = q.bright ? q.size * 1.7 : q.size;
        ctx.fillRect(q.x, q.y, s, s);
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [accent, light]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={style}
      aria-hidden="true"
      data-testid="hero-particle-canvas"
    />
  );
};

export default CandlestickParticleField;

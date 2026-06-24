// CinematicSections — shared cinematic decorations for the four remaining
// landing sections (Comparison split-3D, How-It-Works timeline, AI-Proof
// neural net bg, Testimonials carousel). Bundled here so the four section
// files stay readable and the bespoke visuals share one set of keyframes.
//
// Performance notes:
//   • Comparison + Testimonials use CSS/SVG (cheaper than per-section
//     WebGL contexts — browsers cap around 16).
//   • Neural net is the only new Three.js scene; mounts lazily via
//     IntersectionObserver inside its host section.
//   • All visuals respect prefers-reduced-motion via CSS or runtime checks.

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/* =====================================================================
 * 1. ComparisonSplitDecor — split 3D-feeling header for Comparison
 *    LEFT  (chaotic): tilted dim shards, slow drift.
 *    RIGHT (ordered): tight grid of violet nodes with connecting lines.
 *    Pure SVG + CSS — no Three.js context spent here.
 * ===================================================================== */
export function ComparisonSplitDecor() {
  return (
    <div
      className="relative grid grid-cols-2 rounded-2xl overflow-hidden mb-10 border border-[var(--color-border)] backdrop-blur-sm"
      style={{ height: 'clamp(180px, 22vw, 280px)' }}
      data-testid="comparison-split-3d"
    >
      {/* LEFT — chaotic */}
      <div className="relative" style={{ background: '#06060a' }} data-testid="comparison-split-left">
        <svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          {Array.from({ length: 22 }).map((_, i) => {
            const x = 30 + (i * 71) % 340;
            const y = 30 + (i * 53) % 220;
            const r = ((i * 17) % 18) - 9;
            const w = 24 + (i % 4) * 8;
            return (
              <rect key={i} x={x} y={y} width={w} height="3" rx="1.5" fill="#3a3a48" opacity={0.55 - (i % 5) * 0.06}
                transform={`rotate(${r} ${x + w / 2} ${y + 1.5})`}
                style={{ animation: `cmp-drift ${10 + (i % 5)}s ease-in-out infinite alternate`, animationDelay: `${(i % 7) * 0.4}s` }} />
            );
          })}
          {/* a few "broken" line segments */}
          {Array.from({ length: 8 }).map((_, i) => {
            const x1 = 40 + (i * 47) % 320; const y1 = 60 + (i * 31) % 180;
            const x2 = x1 + 35 + (i * 13) % 30; const y2 = y1 + (i % 2 === 0 ? -20 : 18);
            return <line key={`l-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#4a4a5c" strokeWidth="0.8" strokeDasharray="2 3" opacity={0.5} />;
          })}
        </svg>
        <div className="absolute bottom-3 left-4 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-faint)]">The old way</div>
      </div>

      {/* RIGHT — ordered */}
      <div className="relative" style={{ background: '#0a0a14' }} data-testid="comparison-split-right">
        <svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          {/* Grid of nodes 6x4 */}
          {Array.from({ length: 24 }).map((_, i) => {
            const col = i % 6, row = Math.floor(i / 6);
            const cx = 50 + col * 60, cy = 50 + row * 60;
            return <circle key={i} cx={cx} cy={cy} r="3.6" fill="#c4b5fd"
              style={{ animation: `cmp-twinkle ${2 + (i % 4) * 0.3}s ease-in-out infinite alternate`, animationDelay: `${(i % 6) * 0.18}s`, transformOrigin: `${cx}px ${cy}px`, filter: 'drop-shadow(0 0 4px rgba(167,139,250,0.6))' }} />;
          })}
          {/* Connecting lines along rows + columns */}
          {Array.from({ length: 4 }).map((_, r) => (
            <line key={`h-${r}`} x1={50} y1={50 + r * 60} x2={350} y2={50 + r * 60} stroke="#8b5cf6" strokeOpacity="0.4" strokeWidth="0.8" />
          ))}
          {Array.from({ length: 6 }).map((_, c) => (
            <line key={`v-${c}`} x1={50 + c * 60} y1={50} x2={50 + c * 60} y2={230} stroke="#8b5cf6" strokeOpacity="0.25" strokeWidth="0.6" />
          ))}
        </svg>
        <div className="absolute bottom-3 right-4 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent-purple)]">Valuevade</div>
      </div>

      {/* Center seam — animated violet glow */}
      <div aria-hidden="true" className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px"
           style={{ background: 'linear-gradient(180deg, transparent, #a78bfa, transparent)', boxShadow: '0 0 16px rgba(167,139,250,0.65)' }} />
      {/* "Escaped particle" — sneaks from left to right slowly */}
      <div aria-hidden="true" className="absolute top-1/2 left-0 w-1.5 h-1.5 rounded-full bg-[#c4b5fd]"
           style={{ filter: 'drop-shadow(0 0 8px #c4b5fd)', animation: 'cmp-escape 8s linear infinite' }} />

      <style>{`
        @keyframes cmp-drift  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes cmp-twinkle { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes cmp-escape { 0% { left: -8px; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { left: calc(100% + 8px); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="comparison-split-3d"] [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* =====================================================================
 * 2. TimelinePath — scroll-drawn vertical violet path for How-It-Works.
 *    Renders an SVG bezier curve; `progress` (0..1) controls its
 *    stroke-dashoffset. Caller wires scroll-progress measurement.
 * ===================================================================== */
export function TimelinePath({ progress = 0, stepCount = 4 }) {
  // Curved bezier path with 4 anchor points stretched vertically.
  // Caller's grid card positions roughly map: step 1 at y=80, step 2 at y=280, etc.
  const total = 720; // SVG height units
  const dash = 1800; // overestimate; CSS dashoffset percentage hides the rest
  const offset = dash * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <svg
      className="absolute left-1/2 -translate-x-1/2 top-0 h-full pointer-events-none"
      viewBox="0 0 100 720" preserveAspectRatio="none"
      style={{ width: '120px', zIndex: 1 }}
      data-testid="timeline-path-svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tlGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
      <path
        d="M 50 20 C 80 120, 20 240, 50 360 C 80 480, 20 600, 50 700"
        stroke="url(#tlGrad)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={dash}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 80ms linear', filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.5))' }}
      />
      {/* Step nodes — 4 spheres positioned along the curve. */}
      {Array.from({ length: stepCount }).map((_, i) => {
        const t = (i + 0.5) / stepCount;
        const y = 40 + t * 640;
        const x = 50 + Math.sin(t * Math.PI * 2) * 28;
        const reached = progress >= t - 0.05;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={reached ? 9 : 6}
              fill={reached ? '#c4b5fd' : '#3a3a48'}
              opacity={reached ? 0.95 : 0.5}
              style={{ filter: reached ? 'drop-shadow(0 0 10px rgba(167,139,250,0.85))' : 'none', transition: 'all 320ms ease-out' }} />
            {reached && (
              <circle cx={x} cy={y} r="14" fill="none" stroke="#a78bfa" strokeOpacity="0.4" strokeWidth="1"
                style={{ animation: 'tl-halo 2.2s ease-in-out infinite' }} />
            )}
          </g>
        );
      })}
      <style>{`
        @keyframes tl-halo { 0%,100% { opacity: 0.4; r: 14; } 50% { opacity: 0.15; r: 22; } }
      `}</style>
    </svg>
  );
}

/* =====================================================================
 * 3. NeuralNetBg — Three.js neural-network style 3D graph for AI-Proof.
 *    ~40 nodes + nearest-neighbour edges; very slow rotation; per-edge
 *    pulse on a random timer to suggest "computation".
 * ===================================================================== */
function detectWebGL() {
  if (typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch { return false; }
}

export function NeuralNetBg({ mobile = false }) {
  const mountRef = useRef(null);
  const [useStatic, setUseStatic] = useState(() => !detectWebGL());

  useEffect(() => {
    if (useStatic) return undefined;
    const mount = mountRef.current;
    if (!mount) return undefined;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer, scene, camera, group, nodeMats = [], edgeMat, edgeGeom, edges, raf = 0, running = true, active = false;

    try {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.4 : 2));
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(new THREE.Color('#08080f'), 10, 26);
      camera = new THREE.PerspectiveCamera(58, w / h, 0.1, 100);
      camera.position.set(0, 0, 13);

      const COUNT = mobile ? 22 : 40;
      const positions = [];
      group = new THREE.Group();
      for (let i = 0; i < COUNT; i++) {
        const x = (Math.random() - 0.5) * 14;
        const y = (Math.random() - 0.5) * 8;
        const z = (Math.random() - 0.5) * 6;
        positions.push([x, y, z]);
        const g = new THREE.SphereGeometry(0.08 + Math.random() * 0.04, 10, 10);
        const m = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#c4b5fd'),
          transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        nodeMats.push({ mat: m, geom: g });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(x, y, z);
        group.add(mesh);
      }
      // Edges: each node → 2 nearest neighbours, dedup'd.
      const edgePos = [];
      for (let i = 0; i < COUNT; i++) {
        const ai = positions[i];
        const dists = positions
          .map((p, j) => ({ j, d: (p[0]-ai[0])**2 + (p[1]-ai[1])**2 + (p[2]-ai[2])**2 }))
          .filter((x) => x.j !== i).sort((a, b) => a.d - b.d).slice(0, 2);
        dists.forEach(({ j }) => { if (j > i) edgePos.push(ai[0], ai[1], ai[2], positions[j][0], positions[j][1], positions[j][2]); });
      }
      edgeGeom = new THREE.BufferGeometry();
      edgeGeom.setAttribute('position', new THREE.Float32BufferAttribute(edgePos, 3));
      edgeMat = new THREE.LineBasicMaterial({
        color: new THREE.Color('#8b5cf6'),
        transparent: true, opacity: 0.30, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      edges = new THREE.LineSegments(edgeGeom, edgeMat);
      group.add(edges);
      scene.add(group);

      const io = new IntersectionObserver(([e]) => { active = e.isIntersecting; }, { threshold: 0.05 });
      io.observe(mount);
      const onResize = () => {
        const nw = mount.clientWidth, nh = mount.clientHeight;
        renderer.setSize(nw, nh, false);
        camera.aspect = nw / nh; camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);

      const t0 = performance.now();
      const loop = () => {
        if (!running) return;
        raf = requestAnimationFrame(loop);
        if (!active && !reduced) { renderer.render(scene, camera); return; }
        const t = (performance.now() - t0) / 1000;
        if (!reduced) {
          group.rotation.y = t * 0.04;
          group.rotation.x = Math.sin(t * 0.05) * 0.12;
          // Edge pulse: opacity oscillation suggesting "computation".
          edgeMat.opacity = 0.22 + 0.18 * (0.5 + 0.5 * Math.sin(t * 0.8));
          // Random node twinkle by phase-mod
          for (let i = 0; i < nodeMats.length; i++) {
            nodeMats[i].mat.opacity = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 0.7));
          }
        }
        renderer.render(scene, camera);
      };
      loop();

      return () => {
        running = false;
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener('resize', onResize);
        try {
          if (renderer) {
            if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
            renderer.dispose();
          }
          nodeMats.forEach(({ mat, geom }) => { mat.dispose(); geom.dispose(); });
          if (edgeGeom) edgeGeom.dispose();
          if (edgeMat) edgeMat.dispose();
        } catch { /* ignore */ }
      };
    } catch {
      setUseStatic(true);
      return undefined;
    }
  }, [useStatic, mobile]);

  if (useStatic) {
    return (
      <div aria-hidden="true" data-testid="neural-net-static" style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(60% 50% at 50% 50%, rgba(139,92,246,0.18), transparent 70%)',
      }} />
    );
  }
  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      data-testid="neural-net-canvas"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  );
}

/* =====================================================================
 * 4. TestimonialsCarousel3D — 3-card CSS-3D rotating carousel.
 *    Auto-rotates every 6s. Pauses on hover. Arrow controls. Cards
 *    arranged front / left-back / right-back via translateX + rotateY.
 *    Authors get a subtle violet ring around their initial avatar.
 * ===================================================================== */
export function TestimonialsCarousel3D({ items }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  const n = items.length;

  useEffect(() => {
    if (reduced || paused || n < 2) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 6000);
    return () => clearInterval(t);
  }, [paused, n, reduced]);

  const slotFor = (i) => {
    // 0 = front, -1 = left-back, +1 = right-back (mod n)
    const d = ((i - idx) + n) % n;
    return d === 0 ? 0 : d <= n / 2 ? 1 : -1;
  };

  if (reduced) {
    // Reduced-motion: static row of all cards, no transforms.
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" data-testid="testimonials-static">
        {items.map((t) => <CarouselCard key={t.name} t={t} variant="front" />)}
      </div>
    );
  }

  return (
    <div
      className="relative min-h-[340px] sm:min-h-[400px]"
      style={{ perspective: '1400px' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      data-testid="testimonials-carousel-3d"
    >
      {items.map((t, i) => {
        const slot = slotFor(i);
        const tx = slot * 280, rotY = slot * -28, tz = slot === 0 ? 0 : -160, sc = slot === 0 ? 1 : 0.85, op = slot === 0 ? 1 : 0.55;
        return (
          <div
            key={t.name}
            data-testid={`testimonial-slot-${slot}`}
            style={{
              position: 'absolute', top: 0, left: '50%',
              transform: `translateX(calc(-50% + ${tx}px)) translateZ(${tz}px) rotateY(${rotY}deg) scale(${sc})`,
              transformStyle: 'preserve-3d',
              transition: 'transform 720ms cubic-bezier(.22,1,.36,1), opacity 720ms cubic-bezier(.22,1,.36,1)',
              opacity: op,
              width: 'min(420px, 92vw)',
              zIndex: slot === 0 ? 3 : 1,
            }}
          >
            <CarouselCard t={t} variant={slot === 0 ? 'front' : 'back'} />
          </div>
        );
      })}
      {/* Controls */}
      <button
        type="button"
        onClick={() => setIdx((i) => (i - 1 + n) % n)}
        className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all"
        aria-label="Previous testimonial"
        data-testid="testimonial-prev"
      >‹</button>
      <button
        type="button"
        onClick={() => setIdx((i) => (i + 1) % n)}
        className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all"
        aria-label="Next testimonial"
        data-testid="testimonial-next"
      >›</button>
    </div>
  );
}

function CarouselCard({ t, variant = 'front' }) {
  const initial = t.name?.[0] || '?';
  return (
    <div
      className={`glass-card rounded-2xl p-6 sm:p-8 ${variant === 'front' ? 'shadow-[0_30px_80px_-20px_rgba(139,92,246,0.55)]' : ''}`}
      style={{
        borderColor: variant === 'front' ? 'rgba(167,139,250,0.45)' : 'var(--color-border)',
        background: variant === 'front'
          ? 'linear-gradient(180deg, rgba(139,92,246,0.08), rgba(8,8,15,0.6))'
          : 'var(--color-surface)',
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="relative w-10 h-10 rounded-full flex items-center justify-center font-clash text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #c4b5fd)' }}
        >
          {initial}
          {variant === 'front' && (
            <span
              aria-hidden="true"
              className="absolute -inset-1.5 rounded-full"
              style={{ border: '1px solid rgba(167,139,250,0.7)', animation: 'tc-ring-pulse 3.2s ease-in-out infinite' }}
            />
          )}
        </div>
        <div className="flex gap-1">
          {[...Array(5)].map((_, j) => (
            <svg key={j} width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 .587l3.668 7.568L24 9.75l-6 5.851 1.417 8.265L12 19.771l-7.417 4.095L6 15.601 0 9.75l8.332-1.595z" /></svg>
          ))}
        </div>
      </div>
      <p className="text-[var(--color-text-secondary)] font-bricolage leading-relaxed text-sm mb-5 italic">"{t.quote}"</p>
      <div>
        <p className="text-[var(--color-text)] font-clash text-sm">{t.name}</p>
        <p className="text-[var(--color-text-faint)] text-xs font-jetbrains">{t.role}</p>
      </div>
      <style>{`
        @keyframes tc-ring-pulse {
          0%,100% { opacity: 0.85; transform: scale(1); }
          50%     { opacity: 0.4;  transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}

// FinalCTAConvergence, particles scattered across the canvas converge
// toward a single anchor point (the CTA button center) when the section
// enters the viewport. After convergence, particles orbit gently around
// the anchor + slowly disperse and re-converge on a 6s loop, giving the
// CTA a continuous "gravity well" feel.
//
// Implementation:
//   • One THREE.Points cloud with ~280 (desktop) / 160 (mobile) particles.
//   • Each particle has a chaos origin + animated phase. World position
//     each frame is lerped between chaos and anchor, modulated by a slow
//     pulse so the "wave" of convergence repeats.
//   • Anchor is the centre-bottom of the canvas (where the CTA button sits).
//   • Click ripple is handled by the existing CustomCursor component on
//     the landing, no extra wiring needed for the burst-on-click effect.

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

function detectWebGL() {
  if (typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch { return false; }
}

export default function FinalCTAConvergence({ mobile = false }) {
  const mountRef = useRef(null);
  const [useStatic, setUseStatic] = useState(() => !detectWebGL());

  useEffect(() => {
    if (useStatic) return undefined;
    const mount = mountRef.current;
    if (!mount) return undefined;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer, scene, camera, points, geom, mat, raf = 0, running = true;
    let active = false;
    try {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.4 : 2));
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
      camera.position.set(0, 0, 8);

      const COUNT = mobile ? 160 : 280;
      // Anchor in world space, slightly below centre so it sits behind/under
      // the CTA button location.
      const anchor = new THREE.Vector3(0, -0.6, 0);
      const positions = new Float32Array(COUNT * 3);
      const chaos = new Float32Array(COUNT * 3);
      const phases = new Float32Array(COUNT);
      for (let i = 0; i < COUNT; i++) {
        // Chaos origin: wide ellipse across the viewport.
        chaos[i * 3]     = (Math.random() - 0.5) * 12;
        chaos[i * 3 + 1] = (Math.random() - 0.5) * 6;
        chaos[i * 3 + 2] = (Math.random() - 0.5) * 4;
        positions[i * 3]     = chaos[i * 3];
        positions[i * 3 + 1] = chaos[i * 3 + 1];
        positions[i * 3 + 2] = chaos[i * 3 + 2];
        phases[i] = Math.random() * Math.PI * 2;
      }
      geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      mat = new THREE.PointsMaterial({
        size: 0.055,
        sizeAttenuation: true,
        color: new THREE.Color('#c4b5fd'),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      points = new THREE.Points(geom, mat);
      scene.add(points);

      // IntersectionObserver: only animate when the section is visible.
      const io = new IntersectionObserver(
        ([entry]) => { active = entry.isIntersecting; },
        { threshold: 0.1 }
      );
      io.observe(mount);

      const onResize = () => {
        const nw = mount.clientWidth;
        const nh = mount.clientHeight;
        renderer.setSize(nw, nh, false);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);

      const startTime = performance.now();
      const loop = () => {
        if (!running) return;
        raf = requestAnimationFrame(loop);
        if (!active && !reduced) {
          renderer.render(scene, camera);
          return;
        }
        const t = (performance.now() - startTime) / 1000;
        // Convergence wave: each particle lerps toward the anchor over a 6s
        // cycle, holds, then disperses. With per-particle phase offset the
        // wave reads as a continuous gravitational pull, not synchronized.
        const arr = geom.attributes.position.array;
        for (let i = 0; i < COUNT; i++) {
          // 0..1 sinusoid; biased so the particle spends more time near the
          // anchor than dispersed.
          const cyclePhase = (t * 0.18 + phases[i] / (Math.PI * 2)) % 1;
          // smoothstep + bias toward the convergence half of the cycle
          const x = cyclePhase < 0.5
            ? Math.pow(cyclePhase * 2, 1.4)              // dispersed→anchor
            : 1 - Math.pow((cyclePhase - 0.5) * 2, 1.8); // anchor→dispersed
          const k = reduced ? 1 : x;
          const cx = chaos[i * 3], cy = chaos[i * 3 + 1], cz = chaos[i * 3 + 2];
          arr[i * 3]     = cx + (anchor.x - cx) * k;
          arr[i * 3 + 1] = cy + (anchor.y - cy) * k;
          arr[i * 3 + 2] = cz + (anchor.z - cz) * k;
        }
        geom.attributes.position.needsUpdate = true;
        // Anchor glow ring brightens as more particles converge.
        mat.opacity = 0.55 + 0.30 * Math.sin(t * 0.6);
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
          if (geom) geom.dispose();
          if (mat) mat.dispose();
        } catch { /* ignore */ }
      };
    } catch {
      setUseStatic(true);
      return undefined;
    }
  }, [useStatic, mobile]);

  if (useStatic) {
    return (
      <div
        aria-hidden="true"
        data-testid="cta-convergence-static"
        style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(40% 35% at 50% 60%, rgba(139,92,246,0.32), transparent 70%)',
        }}
      />
    );
  }
  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      data-testid="cta-convergence-canvas"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  );
}

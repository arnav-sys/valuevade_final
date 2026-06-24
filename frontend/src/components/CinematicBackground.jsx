// Reusable cinematic Three.js background — extracted from LandingHero3D so
// auth-gated pages (Courses, Course Details, etc.) can share the same near-
// black + violet particle field without re-implementing the WebGL plumbing.
//
// Differences from LandingHero3D:
//   • No wireframe grid floor (cleaner, less busy for deep pages).
//   • Configurable particle density via `density` prop.
//   • Always dark palette (light-mode pages keep their cream backdrop).
//   • Same WebGL pre-flight + static gradient fallback as the landing.

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

function detectWebGL() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

const PALETTE = {
  bg:           '#08080f',
  particle:     '#c4b5fd',
  particleOp:   0.78,
  particleSize: 0.045,
  fogNear:      12,
  fogFar:       38,
  fallbackCss:
    'radial-gradient(60% 50% at 50% -10%, rgba(139,92,246,0.20), transparent 60%),' +
    'radial-gradient(40% 30% at 80% 110%, rgba(167,139,250,0.14), transparent 60%),' +
    'radial-gradient(35% 25% at 15% 80%, rgba(196,181,253,0.10), transparent 60%),' +
    '#08080f',
  fallbackVignette:
    'linear-gradient(180deg, rgba(8,8,15,0.4) 0%, transparent 25%, transparent 70%, rgba(8,8,15,0.95) 100%)',
};

function StaticFallback() {
  return (
    <div
      aria-hidden="true"
      data-testid="cinematic-static-fallback"
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: PALETTE.fallbackCss,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: PALETTE.fallbackVignette,
      }} />
    </div>
  );
}

/**
 * @param {object} props
 * @param {'sparse'|'medium'|'dense'} [props.density] — particle count band.
 *   sparse → ~400 desktop / ~200 mobile (course list)
 *   medium → ~600 desktop / ~300 mobile (course details, default)
 *   dense  → ~900 desktop / ~450 mobile (heroes / capstone)
 */
export default function CinematicBackground({ density = 'medium' }) {
  const mountRef = useRef(null);
  const [useStaticFallback, setUseStaticFallback] = useState(() => !detectWebGL());
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 768px)').matches
      : false
  );
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (useStaticFallback) return;
    const mount = mountRef.current;
    if (!mount) return;
    const COUNTS = { sparse: [400, 200], medium: [600, 300], dense: [900, 450] };
    const [deskCount, mobCount] = COUNTS[density] || COUNTS.medium;
    const count = mobile ? mobCount : deskCount;

    let renderer, scene, camera, points, particleGeom, particleMat;
    let raf = 0;
    let running = true;
    let onMouseMove, onResize, onVis, onContextLost;

    try {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer = new THREE.WebGLRenderer({
        antialias: true, alpha: true, powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.4 : 2));
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      onContextLost = (e) => { e.preventDefault(); setUseStaticFallback(true); };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(new THREE.Color(PALETTE.bg), PALETTE.fogNear, PALETTE.fogFar);

      camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
      camera.position.set(0, 0, 8);

      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = 8 + Math.random() * 18;
        const ang = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3]     = r * Math.sin(phi) * Math.cos(ang);
        positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(ang) - 8;
      }
      particleGeom = new THREE.BufferGeometry();
      particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particleMat = new THREE.PointsMaterial({
        size: PALETTE.particleSize,
        sizeAttenuation: true,
        color: new THREE.Color(PALETTE.particle),
        transparent: true,
        opacity: PALETTE.particleOp,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      points = new THREE.Points(particleGeom, particleMat);
      scene.add(points);

      const mouse = { x: 0, y: 0 };
      onMouseMove = (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
      };
      if (!reducedMotion) window.addEventListener('mousemove', onMouseMove, { passive: true });

      onResize = () => {
        const nw = mount.clientWidth;
        const nh = mount.clientHeight;
        renderer.setSize(nw, nh, false);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);

      onVis = () => { running = !document.hidden; if (running) loop(); };
      document.addEventListener('visibilitychange', onVis);

      const start = performance.now();
      const loop = () => {
        if (!running) return;
        raf = requestAnimationFrame(loop);
        try {
          const t = (performance.now() - start) / 1000;
          // Slower orbital drift than landing's hero — feels ambient, not busy.
          points.rotation.y = Math.sin(t * 0.035) * 0.06;
          points.rotation.x = Math.cos(t * 0.022) * 0.03;
          if (!reducedMotion) {
            points.position.x += (mouse.x * 0.4 - points.position.x) * 0.035;
            points.position.y += (mouse.y * 0.25 - points.position.y) * 0.035;
          }
          points.rotation.z = t * 0.008;
          renderer.render(scene, camera);
        } catch {
          running = false;
          cancelAnimationFrame(raf);
          setUseStaticFallback(true);
        }
      };
      loop();
    } catch {
      setUseStaticFallback(true);
      return;
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      if (onMouseMove) window.removeEventListener('mousemove', onMouseMove);
      if (onResize) window.removeEventListener('resize', onResize);
      if (onVis) document.removeEventListener('visibilitychange', onVis);
      try {
        if (renderer) {
          if (onContextLost) renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
          if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
          renderer.dispose();
        }
        if (particleGeom) particleGeom.dispose();
        if (particleMat) particleMat.dispose();
      } catch { /* swallow */ }
    };
  }, [mobile, useStaticFallback, density, reducedMotion]);

  if (useStaticFallback) return <StaticFallback />;

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      data-testid="cinematic-bg-canvas"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background:
          'linear-gradient(180deg, rgba(8,8,15,0.4) 0%, transparent 25%, transparent 70%, rgba(8,8,15,0.95) 100%)',
        zIndex: 1,
      }} />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/* ---------- WebGL pre-flight ---------- */
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

/* ---------- Theme palettes ---------- */
const PALETTES = {
  dark: {
    bg:           '#08080f',
    particle:     '#c4b5fd',  // soft violet
    particleOp:   0.78,
    particleSize: 0.045,
    blending:     THREE.AdditiveBlending,
    gridA:        '#8b5cf6',
    gridB:        '#6d28d9',
    gridOp:       0.22,
    fog:          '#08080f',
    fallbackCss:
      'radial-gradient(60% 50% at 50% -10%, rgba(139,92,246,0.20), transparent 60%),' +
      'radial-gradient(40% 30% at 80% 110%, rgba(167,139,250,0.14), transparent 60%),' +
      'radial-gradient(35% 25% at 15% 80%, rgba(196,181,253,0.10), transparent 60%),' +
      '#08080f',
    fallbackVignette:
      'linear-gradient(180deg, rgba(8,8,15,0.4) 0%, transparent 25%, transparent 70%, rgba(8,8,15,0.95) 100%)',
    canvasVignette:
      'linear-gradient(180deg, rgba(8,8,15,0.4) 0%, transparent 25%, transparent 70%, rgba(8,8,15,0.95) 100%)',
  },
  light: {
    bg:           '#F2E6EE',
    particle:     '#246BFD',  // original primary blue
    particleOp:   0.55,
    particleSize: 0.06,
    blending:     THREE.NormalBlending,
    gridA:        '#246BFD',
    gridB:        '#6A5CFF',
    gridOp:       0.22,
    fog:          '#F2E6EE',
    fallbackCss:
      'radial-gradient(60% 50% at 50% -10%, rgba(36,107,253,0.10), transparent 60%),' +
      'radial-gradient(40% 30% at 80% 110%, rgba(106,92,255,0.10), transparent 60%),' +
      'radial-gradient(35% 25% at 15% 80%, rgba(255,106,193,0.08), transparent 60%),' +
      '#F2E6EE',
    fallbackVignette:
      'linear-gradient(180deg, rgba(242,230,238,0.4) 0%, transparent 25%, transparent 70%, rgba(242,230,238,0.95) 100%)',
    canvasVignette:
      'linear-gradient(180deg, rgba(242,230,238,0.4) 0%, transparent 25%, transparent 70%, rgba(242,230,238,0.85) 100%)',
  },
};

/* ---------- Static fallback (no WebGL) ---------- */
function StaticFallback({ theme }) {
  const p = PALETTES[theme] || PALETTES.dark;
  return (
    <div
      className="landing-three-bg"
      aria-hidden="true"
      data-testid="hero-static-fallback"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: p.fallbackCss,
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: p.fallbackVignette,
        }}
      />
    </div>
  );
}

/* ---------- Cinematic hero (vanilla three.js) ---------- */
export default function LandingHero3D({ mobile = false, theme = 'dark' }) {
  const mountRef = useRef(null);
  const [useStaticFallback, setUseStaticFallback] = useState(() => !detectWebGL());

  useEffect(() => {
    if (useStaticFallback) return;
    const mount = mountRef.current;
    if (!mount) return;
    const palette = PALETTES[theme] || PALETTES.dark;

    let renderer, scene, camera, root, points, grid;
    let particleGeom, particleMat, gridMats = [];
    let raf = 0;
    let running = true;
    let onMouseMove, onResize, onVis, onContextLost;

    try {
      const w = mount.clientWidth;
      const h = mount.clientHeight;

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.4 : 2));
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      onContextLost = (e) => {
        e.preventDefault();
        // eslint-disable-next-line no-console
        console.warn('[LandingHero3D] WebGL context lost — falling back to static.');
        setUseStaticFallback(true);
      };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(new THREE.Color(palette.fog), 12, 38);

      camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
      camera.position.set(0, 0, 8);

      scene.add(new THREE.AmbientLight(0xffffff, 0.4));

      /* particle field */
      const count = mobile ? 600 : 1300;
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
        size: palette.particleSize,
        sizeAttenuation: true,
        color: new THREE.Color(palette.particle),
        transparent: true,
        opacity: palette.particleOp,
        depthWrite: false,
        blending: palette.blending,
      });
      points = new THREE.Points(particleGeom, particleMat);

      /* wireframe grid floor */
      grid = new THREE.GridHelper(60, 30, new THREE.Color(palette.gridA), new THREE.Color(palette.gridB));
      gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMats.forEach((m) => { m.transparent = true; m.opacity = palette.gridOp; });
      grid.position.set(0, -4, -2);
      grid.rotation.x = -Math.PI / 2.1;

      root = new THREE.Group();
      root.add(points);
      root.add(grid);
      scene.add(root);

      const mouse = { x: 0, y: 0 };
      onMouseMove = (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
      };
      window.addEventListener('mousemove', onMouseMove, { passive: true });

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
          root.rotation.y = Math.sin(t * 0.05) * 0.08;
          root.rotation.x = Math.cos(t * 0.03) * 0.04;
          root.position.x += (mouse.x * 0.6 - root.position.x) * 0.04;
          root.position.y += (mouse.y * 0.4 - root.position.y) * 0.04;
          points.rotation.z = t * 0.012;
          grid.position.z = (t * 0.4) % 4 - 2;
          renderer.render(scene, camera);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[LandingHero3D] render loop failed — falling back.', err);
          running = false;
          cancelAnimationFrame(raf);
          setUseStaticFallback(true);
        }
      };
      loop();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[LandingHero3D] init failed — falling back to static.', err);
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
        gridMats.forEach((m) => m && m.dispose());
        if (grid && grid.geometry) grid.geometry.dispose();
      } catch {
        /* swallow cleanup errors — already unmounting */
      }
    };
  }, [mobile, useStaticFallback, theme]);

  if (useStaticFallback) return <StaticFallback theme={theme} />;

  const palette = PALETTES[theme] || PALETTES.dark;
  return (
    <div
      ref={mountRef}
      className="landing-three-bg"
      aria-hidden="true"
      data-testid="hero-three-canvas"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: palette.canvasVignette,
        zIndex: 1,
      }} />
    </div>
  );
}

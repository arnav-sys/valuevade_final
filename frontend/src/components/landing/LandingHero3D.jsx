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
    /* Deep indigo ink dots on cream. We render on an OPAQUE cream canvas
     * with NormalBlending, simple, reliable, every dot reads as solid
     * indigo (≈ rgb(15, 29, 82) on rgb(242, 230, 238) cream). */
    particle:     '#0f1d52',
    particleOp:   0.92,
    /* With sizeAttenuation:false this is in pixels, 2.6px per dot reads
     * unmistakably on cream regardless of camera distance. */
    particleSize: 2.6,
    blending:     THREE.NormalBlending,
    /* Darker indigo grid, much higher opacity, reads as a faint blueprint
     * floor that recedes into the fog. */
    gridA:        '#1e2d6b',
    gridB:        '#2a3a8a',
    gridOp:       0.55,
    fog:          '#F2E6EE',
    /* Closer near plane so distant particles dissolve into the cream bg,
     * giving more atmospheric depth than dark mode (which can carry a
     * starfield further). */
    fogNear:      4,
    fogFar:       30,
    fallbackCss:
      'radial-gradient(ellipse at center, #F2E6EE 0%, #F2E6EE 50%, #d9c2cf 100%),' +
      'radial-gradient(60% 50% at 50% -10%, rgba(15,29,82,0.06), transparent 60%),' +
      '#F2E6EE',
    fallbackVignette:
      'radial-gradient(ellipse at center, transparent 40%, rgba(200,168,183,0.45) 100%),' +
      'linear-gradient(180deg, transparent 0%, transparent 70%, rgba(217,194,207,0.55) 100%)',
    canvasVignette:
      'radial-gradient(ellipse at center, transparent 35%, rgba(200,168,183,0.55) 100%),' +
      'linear-gradient(180deg, transparent 0%, transparent 65%, rgba(217,194,207,0.6) 100%)',
  },
};

/* Backfill dark palette with default fog distances */
PALETTES.dark.fogNear = 12;
PALETTES.dark.fogFar = 38;

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
    // Cinematic focal element (dark mode only): a 3D cluster of 22 violet
    // "module star" nodes connected by faint lines, gently rotating + each
    // node twinkling on a phase-offset opacity loop. Curriculum-as-art.
    let focal;                                    // THREE.Group
    let focalNodes = [];                          // Array of {mesh, geom, mat, phase}
    let focalLines, focalLinesGeom, focalLinesMat;
    let raf = 0;
    let running = true;
    let onMouseMove, onResize, onVis, onContextLost;

    try {
      const w = mount.clientWidth;
      const h = mount.clientHeight;

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        // Light mode multiplies against the cream bg → needs an opaque
        // canvas with that bg colour as the cleared destination, otherwise
        // multiply runs against transparent black and the particles vanish.
        // Dark mode stays transparent so the body radial-glows shine through.
        alpha: theme !== 'light',
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.4 : 2));
      renderer.setSize(w, h, false);
      if (theme === 'light') {
        renderer.setClearColor(new THREE.Color(palette.bg), 1.0);
      } else {
        renderer.setClearColor(0x000000, 0);
      }
      mount.appendChild(renderer.domElement);

      onContextLost = (e) => {
        e.preventDefault();
        // eslint-disable-next-line no-console
        console.warn('[LandingHero3D] WebGL context lost, falling back to static.');
        setUseStaticFallback(true);
      };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(
        new THREE.Color(palette.fog),
        palette.fogNear,
        palette.fogFar
      );

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
        // Light mode disables size-attenuation so each particle is a fixed
        // pixel size and reads cleanly on the cream bg; dark mode keeps
        // distance attenuation so the field has depth via additive bloom.
        sizeAttenuation: theme !== 'light',
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

      /* Cinematic focal element, DARK MODE ONLY. A cluster of 22 violet
         "module star" nodes connected by faint lines. Position is a noisy
         sphere of radius ~1.8 (slight Z bias so the cluster reads volumetric
         instead of flat). Each node twinkles via a per-node phase offset on
         an opacity oscillation (0.55 ↔ 1.0). Cluster slowly rotates as a
         single group; mouse-parallax inherits from root. */
      if (theme !== 'light') {
        focal = new THREE.Group();
        focal.position.set(0, 0.4, -1.6);
        const nodeCount = 22;
        const positions = [];
        for (let i = 0; i < nodeCount; i++) {
          // Pseudo-uniform sphere sample biased toward visible front.
          const u = Math.random();
          const v = Math.random();
          const phi = Math.acos(2 * u - 1);
          const theta = 2 * Math.PI * v;
          const r = 1.55 + Math.random() * 0.45;
          const x = r * Math.sin(phi) * Math.cos(theta);
          const y = r * Math.cos(phi) * 0.6;          // flatten on Y a touch
          const z = r * Math.sin(phi) * Math.sin(theta) * 0.85;
          positions.push([x, y, z]);
          const nodeGeom = new THREE.SphereGeometry(0.06 + Math.random() * 0.025, 12, 12);
          const nodeMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color('#c4b5fd'),
            transparent: true,
            opacity: 0.92,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(nodeGeom, nodeMat);
          mesh.position.set(x, y, z);
          focal.add(mesh);
          focalNodes.push({ mesh, geom: nodeGeom, mat: nodeMat, phase: Math.random() * Math.PI * 2 });
        }
        // Connect each node to its 2-3 nearest neighbours, produces a
        // proximity graph that reads like a curriculum dependency map.
        const linePositions = [];
        for (let i = 0; i < nodeCount; i++) {
          const ai = positions[i];
          const dists = positions
            .map((p, j) => ({ j, d: (p[0]-ai[0])**2 + (p[1]-ai[1])**2 + (p[2]-ai[2])**2 }))
            .filter((x) => x.j !== i)
            .sort((a, b) => a.d - b.d)
            .slice(0, 3);
          dists.forEach(({ j }) => {
            // Dedup by ordered pair to avoid double-rendering each segment.
            if (j > i) {
              linePositions.push(ai[0], ai[1], ai[2], positions[j][0], positions[j][1], positions[j][2]);
            }
          });
        }
        focalLinesGeom = new THREE.BufferGeometry();
        focalLinesGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        focalLinesMat = new THREE.LineBasicMaterial({
          color: new THREE.Color('#8b5cf6'),
          transparent: true,
          opacity: 0.30,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        focalLines = new THREE.LineSegments(focalLinesGeom, focalLinesMat);
        focal.add(focalLines);
        root.add(focal);
      }

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
          // Focal cluster: slow rotation as a single group + per-node twinkle.
          if (focal) {
            focal.rotation.x = Math.sin(t * 0.12) * 0.18;
            focal.rotation.y = t * 0.09;
            for (let i = 0; i < focalNodes.length; i++) {
              const n = focalNodes[i];
              n.mat.opacity = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6 + n.phase));
            }
            // Lines breathe gently in sympathy with the nodes.
            if (focalLinesMat) {
              focalLinesMat.opacity = 0.22 + 0.10 * (0.5 + 0.5 * Math.sin(t * 0.6));
            }
          }
          renderer.render(scene, camera);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[LandingHero3D] render loop failed, falling back.', err);
          running = false;
          cancelAnimationFrame(raf);
          setUseStaticFallback(true);
        }
      };
      loop();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[LandingHero3D] init failed, falling back to static.', err);
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
        if (focalLinesGeom) focalLinesGeom.dispose();
        if (focalLinesMat) focalLinesMat.dispose();
        focalNodes.forEach((n) => { try { n.geom.dispose(); n.mat.dispose(); } catch { /* ignore */ } });
        gridMats.forEach((m) => m && m.dispose());
        if (grid && grid.geometry) grid.geometry.dispose();
      } catch {
        /* swallow cleanup errors, already unmounting */
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

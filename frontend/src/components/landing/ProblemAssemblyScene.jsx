// ProblemAssemblyScene, bespoke Three.js visualization for the Problem
// section. Behind the existing copy, a chaotic field of 24 "broken chart
// fragments" sits scattered + tilted. As the user scrolls through the
// sticky-locked container, the fragments lerp to their target positions
// along a clean, smooth line chart formed by connecting them as a polyline.
//
// Inputs:
//   • progress, number in [0, 1]; 0 = full chaos, 1 = full assembly.
//
// Implementation details:
//   • Each "fragment" is a small flat quad (PlaneGeometry) with violet
//     additive glow. Chaos state: random world position in a 12-wide cube
//     + random rotation. Assembled state: positions x = lerp(-5, 5, i/n),
//     y = noise-shaped curve, rotation 0.
//   • An assembled polyline (LineSegments) fades in from opacity 0→0.95
//     as progress crosses 0.4.
//   • WebGL-off + reduced-motion → render nothing (parent shows static
//     gradient fallback).

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

function detectWebGL() {
  if (typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch { return false; }
}

const FRAG_COUNT = 24;

export default function ProblemAssemblyScene({ progress = 0 }) {
  const mountRef = useRef(null);
  const progRef = useRef(progress);
  const [useStatic, setUseStatic] = useState(() => !detectWebGL());

  useEffect(() => { progRef.current = progress; }, [progress]);

  useEffect(() => {
    if (useStatic) return undefined;
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer, scene, camera, raf = 0, running = true;
    const fragments = [];
    let line, lineGeom, lineMat;

    try {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(new THREE.Color('#08080f'), 8, 18);
      camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
      camera.position.set(0, 0, 9);

      // Pre-compute assembled positions: a smooth wave across X.
      const targets = [];
      for (let i = 0; i < FRAG_COUNT; i++) {
        const t = i / (FRAG_COUNT - 1);
        const x = -5 + t * 10;
        // Curve: rising slope + gentle sinusoidal noise, reads as a "growth
        // line", which thematically lands the section.
        const y = -1.4 + t * 2.4 + Math.sin(t * Math.PI * 3) * 0.32;
        targets.push({ x, y, z: 0 });
      }
      // Build fragments with random chaos seeds.
      for (let i = 0; i < FRAG_COUNT; i++) {
        const geom = new THREE.PlaneGeometry(0.45, 0.10);
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#a78bfa'),
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const m = new THREE.Mesh(geom, mat);
        m.userData.chaos = {
          x: (Math.random() - 0.5) * 11,
          y: (Math.random() - 0.5) * 5,
          z: (Math.random() - 0.5) * 3.2,
          rx: (Math.random() - 0.5) * Math.PI,
          ry: (Math.random() - 0.5) * Math.PI,
          rz: (Math.random() - 0.5) * Math.PI,
        };
        m.userData.target = targets[i];
        scene.add(m);
        fragments.push({ mesh: m, geom, mat });
      }
      // Assembled polyline, bright violet, fades in past progress 0.4.
      const linePts = new Float32Array(FRAG_COUNT * 3);
      lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute('position', new THREE.BufferAttribute(linePts, 3));
      lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color('#c4b5fd'),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      line = new THREE.Line(lineGeom, lineMat);
      scene.add(line);

      const onResize = () => {
        const nw = mount.clientWidth;
        const nh = mount.clientHeight;
        renderer.setSize(nw, nh, false);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);

      const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      const loop = () => {
        if (!running) return;
        raf = requestAnimationFrame(loop);
        const p = easeInOut(Math.max(0, Math.min(1, progRef.current)));
        // Animate each fragment from chaos → target by interpolating world
        // pos + rotation. Lines update from current world positions.
        const arr = lineGeom.attributes.position.array;
        for (let i = 0; i < fragments.length; i++) {
          const f = fragments[i].mesh;
          const c = f.userData.chaos;
          const tg = f.userData.target;
          f.position.set(
            c.x + (tg.x - c.x) * p,
            c.y + (tg.y - c.y) * p,
            c.z + (tg.z - c.z) * p
          );
          f.rotation.set(c.rx * (1 - p), c.ry * (1 - p), c.rz * (1 - p));
          // Quad scale grows along x as it locks in, reads as "snapping
          // into a chart bar".
          f.scale.x = 0.55 + 0.55 * p;
          fragments[i].mat.opacity = 0.55 + 0.40 * p;
          arr[i * 3]     = f.position.x;
          arr[i * 3 + 1] = f.position.y;
          arr[i * 3 + 2] = f.position.z;
        }
        lineGeom.attributes.position.needsUpdate = true;
        lineMat.opacity = Math.max(0, (p - 0.35) / 0.55) * 0.95;
        // Gentle camera drift so the scene feels alive at full assembly.
        camera.position.x = Math.sin(performance.now() * 0.00015) * 0.4;
        renderer.render(scene, camera);
      };
      loop();

      return () => {
        running = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        try {
          if (renderer) {
            if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
            renderer.dispose();
          }
          fragments.forEach((f) => { f.geom.dispose(); f.mat.dispose(); });
          if (lineGeom) lineGeom.dispose();
          if (lineMat) lineMat.dispose();
        } catch { /* ignore */ }
      };
    } catch {
      setUseStatic(true);
      return undefined;
    }
  }, [useStatic]);

  if (useStatic) {
    return (
      <div
        aria-hidden="true"
        data-testid="problem-assembly-static"
        style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(60% 50% at 50% 50%, rgba(139,92,246,0.18), transparent 70%), #08080f',
        }}
      />
    );
  }
  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      data-testid="problem-assembly-canvas"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  );
}

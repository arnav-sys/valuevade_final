import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* Cinematic dark hero — vanilla three.js (no R3F).
 * Dense floating particle field + subtle wireframe grid floor.
 * Slow drift + mouse parallax + fog. Pointer-events: none. */
export default function LandingHero3D({ mobile = false }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    /* renderer */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.4 : 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    /* scene + camera */
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(new THREE.Color('#08080f'), 12, 38);

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    camera.position.set(0, 0, 8);

    /* lights */
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    /* particle field */
    const count = mobile ? 600 : 1300;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 8 + Math.random() * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 8;
    }
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.045,
      sizeAttenuation: true,
      color: new THREE.Color('#c4b5fd'),
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(particleGeom, particleMat);

    /* wireframe grid floor */
    const grid = new THREE.GridHelper(60, 30, new THREE.Color('#8b5cf6'), new THREE.Color('#6d28d9'));
    const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMats.forEach((m) => { m.transparent = true; m.opacity = 0.22; });
    grid.position.set(0, -4, -2);
    grid.rotation.x = -Math.PI / 2.1;

    /* mount everything in a group for global drift */
    const root = new THREE.Group();
    root.add(points);
    root.add(grid);
    scene.add(root);

    /* mouse parallax */
    const mouse = { x: 0, y: 0 };
    const onMouseMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    /* resize */
    const onResize = () => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      renderer.setSize(nw, nh, false);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    /* animation loop */
    const start = performance.now();
    let raf = 0;
    let running = true;
    const onVis = () => { running = !document.hidden; if (running) loop(); };
    document.addEventListener('visibilitychange', onVis);

    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const t = (performance.now() - start) / 1000;
      root.rotation.y = Math.sin(t * 0.05) * 0.08;
      root.rotation.x = Math.cos(t * 0.03) * 0.04;
      root.position.x += (mouse.x * 0.6 - root.position.x) * 0.04;
      root.position.y += (mouse.y * 0.4 - root.position.y) * 0.04;
      points.rotation.z = t * 0.012;
      grid.position.z = (t * 0.4) % 4 - 2;
      renderer.render(scene, camera);
    };
    loop();

    /* cleanup */
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      particleGeom.dispose();
      particleMat.dispose();
      gridMats.forEach((m) => m.dispose());
      grid.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [mobile]);

  return (
    <div
      ref={mountRef}
      className="landing-three-bg"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(8,8,15,0.4) 0%, transparent 25%, transparent 70%, rgba(8,8,15,0.95) 100%)',
        zIndex: 1,
      }} />
    </div>
  );
}

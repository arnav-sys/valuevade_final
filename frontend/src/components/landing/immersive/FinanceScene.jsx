import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildFinanceDesk, disposeScene } from './financeObjects';
import { BrandArtwork } from '../../brand/BrandArtwork';

export default function FinanceScene({ active, paused, reducedMotion, theme, resetKey }) {
  const host = useRef(null);
  const latest = useRef({ active, paused, reducedMotion, resetKey });
  latest.current = { active, paused, reducedMotion, resetKey };
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const element = host.current; if (!element) return;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true }); }
    catch { setFallback(true); return; }
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-7, 7, 3, -3, .1, 80);
    camera.position.set(0, 2.5, 13); camera.lookAt(0, 0, 0);
    renderer.setClearColor(0, 0); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
    renderer.domElement.dataset.testid = 'finance-three-canvas'; renderer.domElement.setAttribute('aria-hidden', 'true');
    element.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight('#FFFFFF', theme === 'dark' ? '#847AC0' : '#B4A5ED', 2.7));
    const key = new THREE.DirectionalLight('#FFFFFF', 3.5); key.position.set(-4, 7, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    key.shadow.bias = -.001; scene.add(key);
    const fill = new THREE.DirectionalLight('#CBD2FF', 2); fill.position.set(5, 2, 3); scene.add(fill);
    const { root, groups } = buildFinanceDesk(scene);
    let mobile = false, frame = 0, visible = true, dragging = false, pointerX = 0, pointerY = 0, angle = 0, lastX = 0;
    let lastReset = latest.current.resetKey;
    const resize = () => {
      const { width, height } = element.getBoundingClientRect(); if (!width || !height) return;
      mobile = width < 900; const halfHeight = mobile ? 1.96 : 2.02;
      camera.left = -halfHeight * width / height; camera.right = -camera.left; camera.top = halfHeight; camera.bottom = -halfHeight;
      camera.updateProjectionMatrix(); renderer.setSize(width, height, false); renderer.shadowMap.enabled = !mobile;
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const render = time => {
      frame = requestAnimationFrame(render); if (!visible || document.hidden) return;
      const settings = latest.current;
      if (settings.resetKey !== lastReset) { angle = 0; pointerX = 0; pointerY = 0; lastReset = settings.resetKey; }
      const animate = !settings.paused && !settings.reducedMotion;
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, angle + pointerX * .07, .065);
      root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, pointerY * .025, .065);
      groups.forEach((g, i) => {
        g.visible = !mobile || i === settings.active;
        const x = mobile ? 0 : [-3.65, 0, 3.65][i];
        g.position.x = THREE.MathUtils.lerp(g.position.x, x, .12);
        const bob = animate ? Math.sin(time * .00075 + i * 1.8) * .065 : 0;
        g.position.y = (i === 1 ? -.04 : .12) + bob;
        const scale = mobile ? (i === 1 ? .88 : 1.12) : (settings.active === i ? 1.05 : .92);
        g.scale.lerp(new THREE.Vector3(scale, scale, scale), .08);
        g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, mobile ? -.08 : [.23, -.06, -.23][i], .06);
        g.rotation.z = mobile ? 0 : [settings.active === 0 ? .03 : .06, 0, -.06][i];
      });
      renderer.render(scene, camera);
    };
    const move = e => {
      const rect = element.getBoundingClientRect(); pointerX = (e.clientX - rect.left) / rect.width - .5; pointerY = (e.clientY - rect.top) / rect.height - .5;
      if (dragging) { angle = THREE.MathUtils.clamp(angle + (e.clientX - lastX) * .003, -.4, .4); lastX = e.clientX; }
    };
    const down = e => { dragging = true; lastX = e.clientX; element.setPointerCapture?.(e.pointerId); };
    const up = () => { dragging = false; pointerX = 0; pointerY = 0; };
    const lost = e => { e.preventDefault(); setFallback(true); };
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }); intersection.observe(element);
    element.addEventListener('pointermove', move); element.addEventListener('pointerdown', down); element.addEventListener('pointerup', up); element.addEventListener('pointercancel', up); element.addEventListener('pointerleave', up);
    renderer.domElement.addEventListener('webglcontextlost', lost); frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect();
      element.removeEventListener('pointermove', move); element.removeEventListener('pointerdown', down); element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up); element.removeEventListener('pointerleave', up);
      renderer.domElement.removeEventListener('webglcontextlost', lost); disposeScene(scene); renderer.dispose(); renderer.domElement.remove();
    };
  }, [theme]);

  return <div className="vvi-finance-scene" data-testid="finance-scene" data-active={active} data-paused={paused || reducedMotion}>
    <div ref={host} className="vvi-canvas-mount" style={{ display: fallback ? 'none' : undefined }} />
    {fallback && <BrandArtwork variant={['research', 'ai', 'career'][active]} className="vvi-scene-fallback" testId="finance-scene-fallback" />}
  </div>;
}
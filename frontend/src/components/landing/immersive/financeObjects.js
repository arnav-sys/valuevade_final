import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeFinanceTexture } from './sceneTextures';

const material = (color, metalness = .05) => new THREE.MeshStandardMaterial({ color, metalness, roughness: .3 });
function solid(w, h, d, color, radius = .08) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material(color));
  mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
function screen(kind, w, h) {
  const group = new THREE.Group();
  const body = solid(w, h, .13, kind === 'model' ? '#246BFD' : '#D8D0F2'); group.add(body);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(w - .13, h - .13), new THREE.MeshBasicMaterial({ map: makeFinanceTexture(kind), toneMapped: false }));
  display.position.z = .071; group.add(display); return group;
}
export function buildFinanceDesk(scene) {
  const root = new THREE.Group(); scene.add(root);
  const model = new THREE.Group();
  const display = screen('model', 3.7, 2.56); display.position.set(0, .73, 0); display.rotation.x = -.1; model.add(display);
  const base = solid(3.96, .15, 1.66, '#D4D0EE'); base.position.set(0, -.65, .62); model.add(base);
  const keys = solid(3.22, .035, .64, '#EEEAF9', .025); keys.position.set(0, -.55, .53); model.add(keys);
  const pad = solid(.9, .025, .45, '#BEB9DA', .025); pad.position.set(0, -.55, 1.09); model.add(pad);

  const research = new THREE.Group();
  const back = solid(2.68, 2.4, .1, '#C7BAF7'); back.rotation.z = -.09; back.position.set(-.13, .07, -.14); research.add(back);
  research.add(screen('research', 2.7, 2.37));
  const badge = solid(.72, .72, .22, '#246BFD', .14); badge.position.set(1.16, -.9, .35); badge.rotation.z = -.12; research.add(badge);
  const strokeA = solid(.26, .065, .04, '#FFFFFF', .01); strokeA.position.set(1.03, -.92, .49); strokeA.rotation.z = -.7;
  const strokeB = solid(.43, .065, .04, '#FFFFFF', .01); strokeB.position.set(1.23, -.83, .49); strokeB.rotation.z = .8; research.add(strokeA, strokeB);

  const pitch = new THREE.Group(); pitch.add(screen('pitch', 2.7, 2.37));
  const bars = new THREE.Group();
  [0.32, .54, .75, 1.02, 1.3].forEach((h, i) => { const bar = solid(.28, h, .4, i === 4 ? '#FF6AC1' : '#6A5CFF', .05); bar.position.set(-.72 + i * .36, h / 2, 0); bars.add(bar); });
  bars.position.set(.8, -1.32, .8); pitch.add(bars);
  const groups = [research, model, pitch]; groups.forEach(g => root.add(g));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.ShadowMaterial({ color: '#7468AE', opacity: .15 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.27; floor.receiveShadow = true; scene.add(floor);
  return { root, groups };
}

export function disposeScene(scene) {
  const disposed = new Set();
  scene.traverse(object => {
    if (object.geometry) object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach(m => { if (disposed.has(m)) return; disposed.add(m); if (m.map) m.map.dispose(); m.dispose(); });
  });
}
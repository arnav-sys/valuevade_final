import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';

function Scene({ mobile }) {
  const particlesRef = useRef();
  const gridRef = useRef();
  const groupRef = useRef();
  const count = mobile ? 600 : 1300;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 8 + Math.random() * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 8;
    }
    return arr;
  }, [count]);

  useFrame(({ clock, mouse }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.05) * 0.08;
      groupRef.current.rotation.x = Math.cos(t * 0.03) * 0.04;
      groupRef.current.position.x = mouse.x * 0.6;
      groupRef.current.position.y = mouse.y * 0.4;
    }
    if (particlesRef.current) particlesRef.current.rotation.z = t * 0.012;
    if (gridRef.current) gridRef.current.position.z = (t * 0.4) % 4 - 2;
  });

  return (
    <group ref={groupRef}>
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={0.045} sizeAttenuation
          color={new THREE.Color('#c4b5fd')}
          transparent opacity={0.78}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <group ref={gridRef} position={[0, -4, -2]} rotation={[-Math.PI / 2.1, 0, 0]}>
        <gridHelper args={[60, 30, '#8b5cf6', '#6d28d9']} />
      </group>
      <fog attach="fog" args={['#08080f', 12, 38]} />
    </group>
  );
}

export default function LandingHero3D({ mobile = false }) {
  return (
    <div className="landing-three-bg" aria-hidden="true">
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={mobile ? [1, 1.4] : [1, 2]}
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.4} />
        <Scene mobile={mobile} />
      </Canvas>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(8,8,15,0.4) 0%, transparent 25%, transparent 70%, rgba(8,8,15,0.9) 100%)',
      }} />
    </div>
  );
}

import { useEffect } from 'react';
import { useXP } from '../../contexts/XPContext';

/**
 * A floating "+50 XP" particle that spawns at (x,y), floats up ~80px,
 * fades out over 1.2s. Mounted globally via XPRoot.
 */
export default function XPGainParticle() {
  const { xpParticle, clearParticle } = useXP();

  useEffect(() => {
    if (!xpParticle) return undefined;
    const t = setTimeout(() => clearParticle(), 1200);
    return () => clearTimeout(t);
  }, [xpParticle, clearParticle]);

  if (!xpParticle) return null;

  const { amount, x, y, key } = xpParticle;

  return (
    <div
      key={key}
      className="pointer-events-none fixed z-[60]"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
      data-testid="xp-particle"
      aria-hidden="true"
    >
      <span
        className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-clash font-bold text-white shadow-[0_8px_24px_rgba(106,92,255,0.4)]"
        style={{
          background: 'linear-gradient(135deg, #246BFD, #6A5CFF, #FF6AC1)',
          animation: 'vvXpParticleFloat 1.2s cubic-bezier(.2,.7,.3,1) forwards',
        }}
      >
        +{amount} XP
      </span>
      <style>{`
        @keyframes vvXpParticleFloat {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
          15%  { transform: translate(-50%, -55%) scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, -130%) scale(1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="xp-particle"] span { animation: vvXpParticleFade 1s ease-out forwards !important; }
          @keyframes vvXpParticleFade {
            0% { opacity: 0; }
            20% { opacity: 1; }
            100% { opacity: 0; }
          }
        }
      `}</style>
    </div>
  );
}

import { useEffect } from 'react';
import { useXP } from '../../contexts/XPContext';

/**
 * Floating "+N XP" particle stack. Spawns at (x,y) supplied by the caller
 * (typically the centre of the button that earned the XP), floats up and
 * fades out over 2s. Consumes a queue from XPContext (`xpParticles`) so a
 * burst of 5 quiz corrects in quick succession produces up to 3 staggered
 * tags on screen — newer entries replace the oldest at the cap of 3.
 */
export default function XPGainParticle() {
  const { xpParticles, dismissXpParticle } = useXP();

  // Auto-dismiss each particle 2s after it appears. Per-particle timers so
  // the queue self-drains in FIFO order.
  useEffect(() => {
    if (!xpParticles?.length) return undefined;
    const timers = xpParticles.map((p) =>
      setTimeout(() => dismissXpParticle(p.key), 2000),
    );
    return () => timers.forEach(clearTimeout);
  }, [xpParticles, dismissXpParticle]);

  if (!xpParticles?.length) return null;

  return (
    <>
      {xpParticles.map((p, i) => {
        const { amount, x, y, key } = p;
        // Stagger horizontally + vertically so simultaneous spawns don't
        // overlap into a single illegible blob.
        const offsetX = (i - (xpParticles.length - 1) / 2) * 18;
        const offsetY = i * -10;
        return (
          <div
            key={key}
            className="pointer-events-none fixed z-[60]"
            style={{
              left: x + offsetX,
              top: y + offsetY,
              transform: 'translate(-50%, -50%)',
            }}
            data-testid="xp-particle"
            aria-hidden="true"
          >
            <span
              className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-clash font-bold text-white shadow-[0_8px_24px_rgba(106,92,255,0.4)]"
              style={{
                background: 'linear-gradient(135deg, #246BFD, #6A5CFF, #FF6AC1)',
                animation: 'vvXpParticleFloat 2s cubic-bezier(.2,.7,.3,1) forwards',
              }}
            >
              +{amount} XP
            </span>
          </div>
        );
      })}
      <style>{`
        @keyframes vvXpParticleFloat {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
          12%  { transform: translate(-50%, -55%) scale(1.1); opacity: 1; }
          70%  { transform: translate(-50%, -110%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -150%) scale(1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="xp-particle"] span {
            animation: vvXpParticleFade 1.6s ease-out forwards !important;
          }
          @keyframes vvXpParticleFade {
            0% { opacity: 0; }
            15% { opacity: 1; }
            100% { opacity: 0; }
          }
        }
      `}</style>
    </>
  );
}

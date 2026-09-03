import { useEffect, useRef } from 'react';
import { Trophy, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useDailyChallenges } from '../../contexts/DailyChallengesContext';

// Full-screen celebratory overlay fired exactly once per IST day when the
// 3rd challenge completes. Mounted at App-root so route navigation doesn't
// dismiss it mid-celebration. Auto-dismisses after 5s.
//
// `prefers-reduced-motion`: confetti + scale animation skipped; only the
// fade-in remains.

const AUTO_DISMISS_MS = 5000;

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function fireConfetti() {
  if (prefersReducedMotion()) return;
  const colors = ['#fbbf24', '#f59e0b', '#fde68a', '#ffffff'];
  confetti({
    particleCount: 140,
    spread: 100,
    startVelocity: 45,
    origin: { y: 0.4 },
    colors,
    scalar: 1.1,
  });
  setTimeout(() => {
    confetti({ particleCount: 60, spread: 70, origin: { x: 0.2, y: 0.5 }, colors });
    confetti({ particleCount: 60, spread: 70, origin: { x: 0.8, y: 0.5 }, colors });
  }, 250);
}

export default function DailyChampionOverlay() {
  const { activeChampion, dismissChampion } = useDailyChallenges();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!activeChampion) { firedRef.current = false; return undefined; }
    if (firedRef.current) return undefined;
    firedRef.current = true;
    fireConfetti();
    const t = setTimeout(() => dismissChampion(), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [activeChampion, dismissChampion]);

  if (!activeChampion) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Daily Champion"
      data-testid="daily-champion-overlay"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 daily-champion-backdrop"
    >
      <div className="relative max-w-md w-full daily-champion-card">
        <button
          onClick={dismissChampion}
          className="absolute top-3 right-3 rounded-full p-1.5 text-amber-100 hover:bg-white/10"
          aria-label="Dismiss"
          data-testid="daily-champion-dismiss"
        >
          <X size={18} />
        </button>
        <div className="flex flex-col items-center text-center px-6 py-10">
          <div className="daily-champion-trophy">
            <Trophy size={64} strokeWidth={1.4} className="text-amber-200" />
          </div>
          <h2 className="mt-5 font-clash text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-br from-amber-200 via-yellow-200 to-orange-200 bg-clip-text text-transparent">
            DAILY CHAMPION
          </h2>
          <p className="mt-3 text-sm sm:text-base text-amber-100/90 max-w-xs">
            Three challenges crushed. <span className="font-bold text-amber-200">+75 XP</span> bonus locked in. 24-hour glow active.
          </p>
          <button
            onClick={dismissChampion}
            data-testid="daily-champion-continue"
            className="mt-7 inline-flex items-center justify-center rounded-full bg-amber-300 text-amber-950 font-bold px-6 py-2.5 text-sm hover:bg-amber-200 transition-colors"
          >
            Keep going →
          </button>
        </div>
      </div>
      <style>{`
        @keyframes dc-backdrop-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dc-card-in { from { opacity: 0; transform: scale(.92) } to { opacity: 1; transform: scale(1) } }
        @keyframes dc-trophy-spin { 0% { transform: rotate(-12deg) scale(.85) } 60% { transform: rotate(8deg) scale(1.08) } 100% { transform: rotate(0deg) scale(1) } }
        @keyframes dc-glow { 0%,100% { box-shadow: 0 0 12px rgba(251,191,36,.25) } 50% { box-shadow: 0 0 20px rgba(251,191,36,.40) } }
        .daily-champion-backdrop {
          background: radial-gradient(ellipse at center, rgba(120,53,15,.55) 0%, rgba(0,0,0,.85) 70%);
          backdrop-filter: blur(8px);
          animation: dc-backdrop-in 220ms ease-out;
        }
        .daily-champion-card {
          background: linear-gradient(135deg, rgba(120,53,15,.7) 0%, rgba(146,64,14,.6) 50%, rgba(180,83,9,.55) 100%);
          border: 1px solid rgba(251,191,36,.35);
          border-radius: 28px;
          animation: dc-card-in 320ms cubic-bezier(.34,1.56,.64,1), dc-glow 2.4s ease-in-out infinite;
        }
        .daily-champion-trophy {
          width: 96px; height: 96px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(254,243,199,.35), rgba(180,83,9,.15));
          border: 1px solid rgba(251,191,36,.5);
          animation: dc-trophy-spin 600ms cubic-bezier(.34,1.56,.64,1);
        }
        @media (prefers-reduced-motion: reduce) {
          .daily-champion-card { animation: dc-backdrop-in 200ms ease-out; }
          .daily-champion-trophy { animation: none; }
        }
      `}</style>
    </div>
  );
}

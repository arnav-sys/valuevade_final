import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Compass, Rocket } from 'lucide-react';

/**
 * Cosmic-themed 404 not-found page.
 * Works for both authenticated and unauthenticated users (no Sidebar dependency).
 */
export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center px-4"
      style={{
        background:
          'radial-gradient(ellipse at top, rgba(255,106,193,0.1) 0%, transparent 50%), radial-gradient(ellipse at bottom, rgba(106,92,255,0.1) 0%, transparent 50%), var(--bg-primary)',
      }}
      data-testid="not-found-page"
    >
      {/* Twinkling stars */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => {
          const left = (i * 37) % 100;
          const top = (i * 23) % 100;
          const size = 1 + ((i * 7) % 3);
          const delay = (i * 0.17) % 4;
          const dur = 3 + ((i * 3) % 4);
          return (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: `${top}%`,
                width: size,
                height: size,
                background: 'white',
                borderRadius: '50%',
                opacity: 0,
                boxShadow: '0 0 8px rgba(255,255,255,0.5)',
                animation: `vv404Twinkle ${dur}s ease-in-out ${delay}s infinite`,
              }}
            />
          );
        })}
      </div>

      {/* Orbital lines */}
      <div
        className="absolute left-1/2 top-1/2 w-[600px] h-[600px] rounded-full border border-[var(--color-accent-pink)]/10 pointer-events-none"
        style={{ transform: 'translate(-50%, -50%)', animation: 'vv404Orbit 30s linear infinite' }}
      />
      <div
        className="absolute left-1/2 top-1/2 w-[900px] h-[900px] rounded-full border border-[var(--color-accent-purple)]/8 pointer-events-none"
        style={{ transform: 'translate(-50%, -50%)', animation: 'vv404Orbit 50s linear infinite reverse' }}
      />

      <style>{`
        @keyframes vv404Twinkle {
          0%, 100% { opacity: 0; transform: scale(0.8); }
          50% { opacity: 0.95; transform: scale(1.3); }
        }
        @keyframes vv404Orbit {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes vv404Float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      <div className="relative z-10 text-center max-w-lg" data-testid="not-found-content">
        <div
          className="inline-flex w-20 h-20 rounded-2xl items-center justify-center mb-6 border border-[var(--color-accent-pink)]/30"
          style={{
            background: 'linear-gradient(135deg, rgba(255,106,193,0.18), rgba(106,92,255,0.18))',
            boxShadow: '0 0 40px rgba(255,106,193,0.35)',
            animation: 'vv404Float 3.5s ease-in-out infinite',
          }}
        >
          <Compass size={36} className="text-[var(--color-accent-pink)]" />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-xs font-mono uppercase tracking-[0.2em] mb-5">
          <Rocket size={11} /> Lost in space
        </div>

        <h1
          className="font-clash text-7xl sm:text-9xl font-bold mb-2 leading-none"
          style={{
            background:
              'linear-gradient(135deg, var(--color-accent-pink), var(--color-accent-purple), var(--color-primary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
          data-testid="not-found-title"
        >
          404
        </h1>
        <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-3">
          This page drifted off.
        </h2>
        <p className="text-[var(--color-text-muted)] font-bricolage mb-8 leading-relaxed max-w-md mx-auto">
          The link may be broken or the page may have moved. Let's get you back to somewhere useful.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-all"
            data-testid="not-found-back"
          >
            <ArrowLeft size={15} />
            Go back
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[var(--color-accent-pink)] via-[var(--color-accent-purple)] to-[var(--color-primary)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(255,106,193,0.4)] hover:brightness-110 transition-all"
            data-testid="not-found-home"
          >
            <Home size={15} />
            Take me home
          </Link>
        </div>
      </div>
    </div>
  );
}

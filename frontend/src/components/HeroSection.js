import { useMemo } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function HeroSection({ onJoinWaitlist }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: `${1 + Math.random() * 2}px`,
        delay: `${Math.random() * 5}s`,
        duration: `${2 + Math.random() * 3}s`,
      })),
    []
  );

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center overflow-hidden bg-[var(--bg-primary)]"
      data-testid="hero-section"
    >
      {/* Star particles */}
      {stars.map((star, i) => (
        <div
          key={i}
          className="star-particle"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            animation: `twinkle ${star.duration} ease-in-out ${star.delay} infinite`,
          }}
        />
      ))}

      {/* Orbital ellipses */}
      <div
        className="orbital border-[var(--color-primary)]/20"
        style={{
          width: '700px',
          height: '300px',
          animation: 'orbit 25s linear infinite',
        }}
      />
      <div
        className="orbital border-[var(--color-accent-purple)]/[0.15]"
        style={{
          width: '900px',
          height: '400px',
          animation: 'orbit-reverse 40s linear infinite',
        }}
      />
      <div
        className="orbital border-[var(--color-accent-pink)]/10"
        style={{
          width: '1100px',
          height: '480px',
          animation: 'orbit 60s linear infinite',
        }}
      />

      {/* Glow blobs */}
      <div
        className="absolute top-[10%] right-[10%] w-[300px] h-[300px] lg:w-[400px] lg:h-[400px] bg-[var(--color-primary)]/20 rounded-full animate-blob"
        style={{ filter: 'blur(120px)' }}
      />
      <div
        className="absolute bottom-[10%] left-[10%] w-[300px] h-[300px] lg:w-[400px] lg:h-[400px] bg-[var(--color-accent-purple)]/20 rounded-full animate-blob"
        style={{ filter: 'blur(120px)', animationDelay: '-4s' }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full flex flex-col lg:flex-row items-center gap-12 lg:gap-16 pt-24 pb-16">
        {/* Left content */}
        <div className="flex-1 text-center lg:text-left">
          {/* Badge */}
          <div
            className="inline-flex items-center px-4 py-2 rounded-full border border-[var(--color-accent-pink)]/40 text-[var(--color-accent-pink)] text-sm font-jetbrains mb-8"
            style={{ boxShadow: '0 0 20px rgba(255, 106, 193, 0.15)' }}
            data-testid="hero-badge"
          >
            Now in Beta — Limited Early Access
          </div>

          {/* H1 */}
          <h1 className="font-clash text-4xl sm:text-5xl lg:text-[72px] leading-[1.08] tracking-tight text-[var(--color-text)] mb-6">
            Stop Guessing.
            <br />
            Start Building Your
            <br />
            <span className="gradient-underline">Finance Career.</span>
          </h1>

          {/* Subheading */}
          <p className="text-base lg:text-lg text-[var(--color-text-muted)] max-w-xl mb-8 font-bricolage leading-relaxed mx-auto lg:mx-0">
            Valuevade is the AI copilot that analyses your skills, maps your
            dream role, and builds your personalised learning path — with
            interactive notes, real simulations, and interview prep that
            actually works.
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-center lg:justify-start">
            <button
              onClick={onJoinWaitlist}
              className="px-8 py-4 bg-[var(--color-primary)] text-white font-semibold rounded-full text-lg animate-glow-pulse hover:brightness-110 transition-all"
              data-testid="hero-join-waitlist-btn"
            >
              Join the Waitlist Free →
            </button>
            <button
              onClick={() => scrollTo('how-it-works')}
              className="px-8 py-4 border border-[var(--color-border)] text-[var(--color-text)] font-semibold rounded-full text-lg hover:bg-[var(--color-surface)] transition-all flex items-center gap-2 justify-center"
              data-testid="hero-how-it-works-btn"
            >
              See How It Works <ArrowRight size={18} />
            </button>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-3 justify-center lg:justify-start">
            <div className="flex -space-x-2.5">
              {[
                'linear-gradient(135deg, #246BFD, #6A5CFF)',
                'linear-gradient(135deg, #6A5CFF, #FF6AC1)',
                'linear-gradient(135deg, #FF6AC1, #246BFD)',
                'linear-gradient(135deg, #246BFD, #FF6AC1)',
                'linear-gradient(135deg, #6A5CFF, #246BFD)',
              ].map((bg, i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-full border-2 border-[var(--bg-primary)]"
                  style={{ background: bg }}
                />
              ))}
            </div>
            <p className="text-[var(--color-text-muted)] text-sm font-bricolage" data-testid="social-proof-text">
              Join 500+ finance students already on the waitlist
            </p>
          </div>
        </div>

        {/* Right: Floating card */}
        <div className="flex-shrink-0 animate-hero-float">
          <div
            className="w-[320px] sm:w-[360px] p-6 rounded-2xl glass-card"
            style={{
              borderColor: 'rgba(106, 92, 255, 0.25)',
              boxShadow: '0 0 40px rgba(106, 92, 255, 0.12)',
            }}
            data-testid="hero-roadmap-card"
          >
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="text-[var(--color-accent-pink)]" size={18} />
              <span className="text-[var(--color-text)] font-clash text-lg">
                Your Roadmap
              </span>
            </div>

            {/* Path visualization */}
            <div className="flex flex-col items-center gap-3">
              <div className="px-4 py-2 bg-[var(--color-surface)] rounded-full text-[var(--color-text-muted)] text-sm font-jetbrains">
                B.Com Final Year
              </div>
              <div className="w-px h-5 bg-gradient-to-b from-[var(--color-border)] to-[var(--color-primary)]/40" />
              <div className="flex flex-wrap justify-center gap-2">
                {['Valuation', 'DCF Modelling', 'FRM L1', 'Python for Finance'].map(
                  (skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs rounded-full font-jetbrains border border-[var(--color-primary)]/20"
                    >
                      {skill}
                    </span>
                  )
                )}
              </div>
              <div className="w-px h-5 bg-gradient-to-b from-[var(--color-primary)]/40 to-[var(--color-accent-pink)]/40" />
              <div
                className="px-4 py-2 bg-[var(--color-accent-pink)]/10 text-[var(--color-accent-pink)] text-sm rounded-full font-jetbrains border border-[var(--color-accent-pink)]/30"
                style={{ boxShadow: '0 0 16px rgba(255, 106, 193, 0.15)' }}
              >
                AM Analyst @ DSP Blackrock
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs text-[var(--color-text-faint)] mb-2 font-jetbrains">
                <span>Progress</span>
                <span>68% complete</span>
              </div>
              <div className="h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
                <div className="h-full w-[68%] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { Copy, Instagram, Check } from 'lucide-react';

export default function WaitlistConfirmation({ data }) {
  const [copied, setCopied] = useState(false);

  const confetti = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        color: ['#246BFD', '#6A5CFF', '#FF6AC1', '#F5ECFF'][i % 4],
        delay: `${Math.random() * 0.5}s`,
        duration: `${1.5 + Math.random() * 2}s`,
        width: `${4 + Math.random() * 8}px`,
        height: `${4 + Math.random() * 8}px`,
      })),
    []
  );

  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: `${1 + Math.random() * 2}px`,
        delay: `${Math.random() * 5}s`,
        duration: `${2 + Math.random() * 3}s`,
      })),
    []
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#02073D' }}
      data-testid="waitlist-confirmation"
    >
      {/* Stars */}
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

      {/* Orbitals */}
      <div
        className="orbital border-vblue/15"
        style={{ width: '600px', height: '250px', animation: 'orbit 25s linear infinite' }}
      />
      <div
        className="orbital border-vpurple/10"
        style={{ width: '800px', height: '350px', animation: 'orbit-reverse 40s linear infinite' }}
      />

      {/* Confetti burst */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map((piece, i) => (
          <div
            key={i}
            className="confetti-piece"
            style={{
              left: piece.left,
              width: piece.width,
              height: piece.height,
              background: piece.color,
              animationDelay: piece.delay,
              animation: `confetti-fall ${piece.duration} ease-out ${piece.delay} forwards`,
              borderRadius: i % 2 === 0 ? '50%' : '2px',
            }}
          />
        ))}
      </div>

      {/* Main card */}
      <div
        className="relative z-10 glass-card rounded-3xl p-8 sm:p-12 max-w-lg w-full mx-6 text-center"
        style={{
          borderColor: 'rgba(106, 92, 255, 0.2)',
          boxShadow: '0 0 60px rgba(106, 92, 255, 0.1)',
        }}
        data-testid="confirmation-card"
      >
        {/* Animated checkmark */}
        <div className="flex justify-center mb-6">
          <svg className="w-20 h-20" viewBox="0 0 52 52">
            <circle
              cx="26"
              cy="26"
              r="24"
              fill="none"
              stroke="#FF6AC1"
              strokeWidth="1.5"
              opacity="0.3"
            />
            <path
              d="M15 27l7 7 15-15"
              fill="none"
              stroke="#FF6AC1"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 50,
                strokeDashoffset: 0,
                animation: 'draw-check 0.8s ease-out forwards',
              }}
            />
          </svg>
        </div>

        <h2 className="font-clash text-3xl sm:text-4xl text-white mb-3" data-testid="confirmation-heading">
          You're on the list.
        </h2>

        <p className="text-white/60 font-bricolage mb-4">
          Welcome to Valuevade. You're one of the first finance students to
          claim early access.
        </p>

        <p className="text-white/50 font-bricolage text-sm mb-6">
          We'll reach out before launch with your personalised early access
          link. In the meantime — follow us on Instagram for daily finance
          career content.
        </p>

        {/* Position */}
        <div
          className="inline-block px-6 py-3 rounded-full mb-8"
          style={{
            background: 'rgba(36, 107, 253, 0.1)',
            border: '1px solid rgba(36, 107, 253, 0.25)',
          }}
          data-testid="waitlist-position"
        >
          <span className="font-jetbrains text-vblue">
            You are #{data?.position || 247} on the waitlist
          </span>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <a
            href="#"
            className="flex-1 px-6 py-3 bg-vblue text-white font-semibold rounded-full text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
            data-testid="follow-instagram-btn"
          >
            <Instagram size={16} />
            Follow on Instagram
          </a>
          <button
            onClick={handleCopy}
            className="flex-1 px-6 py-3 border border-white/20 text-white font-semibold rounded-full text-sm hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            data-testid="share-with-friend-btn"
          >
            {copied ? (
              <>
                <Check size={16} /> Copied!
              </>
            ) : (
              <>
                <Copy size={16} /> Share with a friend
              </>
            )}
          </button>
        </div>

        <p className="text-vpink text-sm font-bricolage mb-4" data-testid="referral-nudge">
          Share Valuevade with a friend and move up the waitlist
        </p>

        <p className="text-white/25 text-xs font-bricolage">
          We'll never spam you. Unsubscribe anytime.
        </p>
      </div>
    </div>
  );
}

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Copy, Instagram, Check, Trophy, ArrowUp, Users } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function Leaderboard({ leaderboard, userCode }) {
  if (!leaderboard.length) return null;

  return (
    <div
      className="mt-8 w-full glass-card rounded-2xl p-6 text-left"
      style={{ borderColor: 'rgba(106, 92, 255, 0.15)' }}
      data-testid="referral-leaderboard"
    >
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={18} className="text-vpink" />
        <h3 className="font-clash text-lg text-white">Referral Leaderboard</h3>
      </div>

      <div className="space-y-2">
        {leaderboard.map((entry, i) => {
          const isUser = entry.referral_code === userCode;
          const medals = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
          return (
            <div
              key={entry.referral_code}
              className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-all ${
                isUser
                  ? 'bg-vblue/10 border border-vblue/20'
                  : 'hover:bg-white/[0.02]'
              }`}
              data-testid={`leaderboard-entry-${i}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`font-jetbrains text-sm w-6 text-center ${
                    i < 3 ? medals[i] : 'text-white/30'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="text-white font-bricolage text-sm">
                  {entry.first_name}
                  {isUser && (
                    <span className="text-vblue text-xs ml-1.5 font-jetbrains">
                      (you)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white/40 text-xs font-jetbrains">
                  #{entry.position}
                </span>
                <span className="text-vpink font-jetbrains text-sm font-medium">
                  {entry.referral_count} referral{entry.referral_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WaitlistConfirmation({ data }) {
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  const referralLink = useMemo(() => {
    const base = window.location.origin;
    return data?.referral_code ? `${base}?ref=${data.referral_code}` : base;
  }, [data?.referral_code]);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, lbRes] = await Promise.all([
        data?.referral_code
          ? axios.get(`${API}/waitlist/stats/${data.referral_code}`)
          : null,
        axios.get(`${API}/waitlist/leaderboard`),
      ]);
      if (statsRes) setStats(statsRes.data);
      setLeaderboard(lbRes.data);
    } catch {
      /* ignore */
    }
  }, [data?.referral_code]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = referralLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentPosition = stats?.position ?? data?.position ?? 247;
  const referralCount = stats?.referral_count ?? data?.referral_count ?? 0;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden py-16"
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
            <circle cx="26" cy="26" r="24" fill="none" stroke="#FF6AC1" strokeWidth="1.5" opacity="0.3" />
            <path
              d="M15 27l7 7 15-15"
              fill="none"
              stroke="#FF6AC1"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: 50, strokeDashoffset: 0, animation: 'draw-check 0.8s ease-out forwards' }}
            />
          </svg>
        </div>

        <h2 className="font-clash text-3xl sm:text-4xl text-white mb-3" data-testid="confirmation-heading">
          You're on the list.
        </h2>

        <p className="text-white/60 font-bricolage mb-4">
          Welcome to Valuevade. You're one of the first finance students to claim early access.
        </p>

        <p className="text-white/50 font-bricolage text-sm mb-6">
          We'll reach out before launch with your personalised early access link. In the meantime — follow us on Instagram for daily finance career content.
        </p>

        {/* Position + Referral Stats */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 justify-center">
          <div
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full"
            style={{ background: 'rgba(36, 107, 253, 0.1)', border: '1px solid rgba(36, 107, 253, 0.25)' }}
            data-testid="waitlist-position"
          >
            <ArrowUp size={16} className="text-vblue" />
            <span className="font-jetbrains text-vblue text-sm">
              #{currentPosition} on waitlist
            </span>
          </div>
          <div
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full"
            style={{ background: 'rgba(255, 106, 193, 0.1)', border: '1px solid rgba(255, 106, 193, 0.25)' }}
            data-testid="referral-count"
          >
            <Users size={16} className="text-vpink" />
            <span className="font-jetbrains text-vpink text-sm">
              {referralCount} referral{referralCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Referral link box */}
        <div
          className="mb-6 rounded-xl p-4"
          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
          data-testid="referral-link-box"
        >
          <p className="text-white/40 text-xs font-jetbrains uppercase tracking-wider mb-2">
            Your referral link
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-white/70 font-jetbrains truncate bg-white/[0.03] px-3 py-2 rounded-lg">
              {referralLink}
            </code>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 p-2 rounded-lg bg-vblue/20 hover:bg-vblue/30 transition-colors"
              data-testid="copy-referral-btn"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-vblue" />}
            </button>
          </div>
          <p className="text-vpink text-xs font-bricolage mt-2">
            Each friend who joins moves you 5 spots up
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <a
            href="https://www.instagram.com/valuevade/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-6 py-3 bg-vblue text-white font-semibold rounded-full text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
            data-testid="follow-instagram-btn"
          >
            <Instagram size={16} />
            Follow on Instagram
          </a>
          <button
            onClick={handleCopy}
            className="flex-1 px-6 py-3 font-semibold rounded-full text-sm transition-all flex items-center justify-center gap-2 text-white"
            style={{ background: 'linear-gradient(135deg, #FF6AC1, #6A5CFF)' }}
            data-testid="share-with-friend-btn"
          >
            {copied ? (
              <><Check size={16} /> Link Copied!</>
            ) : (
              <><Copy size={16} /> Share &amp; Move Up</>
            )}
          </button>
        </div>

        <p className="text-white/25 text-xs font-bricolage">
          We'll never spam you. Unsubscribe anytime.
        </p>
      </div>

      {/* Leaderboard */}
      <div className="relative z-10 max-w-lg w-full mx-6">
        <Leaderboard leaderboard={leaderboard} userCode={data?.referral_code} />
      </div>
    </div>
  );
}

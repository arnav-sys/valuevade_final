import { useState } from 'react';
import { Lock, Check, Star } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

export default function FinalCTASection({ onSubmit }) {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sectionRef, isVisible] = useScrollAnimation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !email.trim()) {
      setError('Please fill in both fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onSubmit(firstName.trim(), email.trim());
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <section
      id="waitlist"
      className="relative py-24 lg:py-32 overflow-hidden light-rays"
      style={{ background: '#02073D' }}
      data-testid="final-cta-section"
    >
      <div ref={sectionRef} className="max-w-3xl mx-auto px-6 relative z-10 text-center">
        <h2
          className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-white leading-tight mb-6 ${
            isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
          }`}
        >
          Your finance career doesn't
          <br />
          start at placement season.
        </h2>

        <p
          className={`text-white/60 font-bricolage text-base lg:text-lg mb-12 ${
            isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
          }`}
          style={{ animationDelay: '0.1s' }}
        >
          It starts the day you decide to stop being generic.
        </p>

        {/* Waitlist form */}
        <form
          onSubmit={handleSubmit}
          className={`flex flex-col sm:flex-row gap-3 mb-6 max-w-xl mx-auto ${
            isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
          }`}
          style={{ animationDelay: '0.2s' }}
          data-testid="waitlist-form"
        >
          <input
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="flex-1 px-5 py-4 rounded-full bg-white/5 border border-white/10 text-white placeholder-white/30 font-bricolage text-sm focus:outline-none focus:border-vblue/50 focus:ring-1 focus:ring-vblue/30 transition-all"
            data-testid="waitlist-first-name-input"
          />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-5 py-4 rounded-full bg-white/5 border border-white/10 text-white placeholder-white/30 font-bricolage text-sm focus:outline-none focus:border-vblue/50 focus:ring-1 focus:ring-vblue/30 transition-all"
            data-testid="waitlist-email-input"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-4 rounded-full font-semibold text-white text-sm whitespace-nowrap transition-all disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #FF6AC1, #6A5CFF)',
              boxShadow: '0 0 24px rgba(255, 106, 193, 0.3)',
            }}
            data-testid="waitlist-submit-btn"
          >
            {loading ? 'Joining...' : 'Claim My Spot →'}
          </button>
        </form>

        {error && (
          <p className="text-red-400 text-sm mb-4 font-bricolage" data-testid="waitlist-error">
            {error}
          </p>
        )}

        <p
          className={`text-white/30 text-sm font-bricolage mb-6 ${
            isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
          }`}
          style={{ animationDelay: '0.3s' }}
        >
          No spam. Early access. Free forever for founding members.
        </p>

        {/* Trust row */}
        <div
          className={`flex items-center justify-center gap-6 text-white/30 text-xs font-jetbrains ${
            isVisible ? 'animate-fade-up visible' : 'animate-fade-up'
          }`}
          style={{ animationDelay: '0.35s' }}
          data-testid="trust-row"
        >
          <span className="flex items-center gap-1.5">
            <Lock size={12} /> Private
          </span>
          <span className="flex items-center gap-1.5">
            <Check size={12} /> Free to Join
          </span>
          <span className="flex items-center gap-1.5">
            <Star size={12} /> Early Access Perks
          </span>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, ArrowRight, RotateCcw, BookOpen, Clock, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getNextPhaseRoute } from '../utils/progress';

function formatTime(seconds) {
  if (!seconds || seconds < 1) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

// Simple confetti using CSS
function Confetti() {
  const pieces = Array.from({ length: 32 });
  const colors = ['#246BFD', '#6A5CFF', '#FF6AC1', '#10B981', '#F59E0B'];
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2.4 + Math.random() * 1.6;
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 6;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: '-10px',
              width: size,
              height: size * 1.4,
              background: color,
              borderRadius: 2,
              opacity: 0.9,
              animation: `vvConfettiFall ${duration}s cubic-bezier(.2,.7,.3,1) ${delay}s forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes vvConfettiFall {
          0%   { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

export default function NotesCompletePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { cardsReviewed = 0, timeSpentSeconds = 0 } = location.state || {};
  const [showConfetti, setShowConfetti] = useState(true);
  const [nextRoute, setNextRoute] = useState({ phase: 'quiz', route: 'quiz/start', label: 'Quiz' });

  useEffect(() => {
    let mounted = true;
    async function loadNext() {
      const { data: sess } = await supabase
        .from('user_sessions')
        .select('notes_completed, quiz_completed, interview_completed, simulation_completed')
        .eq('id', sessionId)
        .maybeSingle();
      if (mounted && sess) {
        setNextRoute(getNextPhaseRoute(sess, 'notes'));
      }
    }
    loadNext();
    return () => { mounted = false; };
  }, [sessionId]);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 3500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden flex items-center justify-center px-4 py-12">
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.06] blur-[140px] pointer-events-none" />

      {showConfetti && <Confetti />}

      <div className="relative z-10 w-full max-w-xl text-center" data-testid="notes-complete-content">
        {/* Checkmark */}
        <div className="relative mx-auto mb-8 w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-[var(--color-success)]/20 animate-ping" />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-success)] to-emerald-500 flex items-center justify-center shadow-[0_0_48px_rgba(16,185,129,0.4)]">
            <CheckCircle2 size={44} className="text-white" strokeWidth={2.5} />
          </div>
        </div>

        {/* Title */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)] text-xs font-mono uppercase tracking-[0.2em] mb-4">
          <Sparkles size={12} /> Phase 1 of 3 done
        </div>
        <h1 className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="notes-complete-title">
          Notes complete!
        </h1>
        <p className="text-[var(--color-text-muted)] font-bricolage mb-8">
          You've reviewed the core concepts. Time to prove you've got it.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-8" data-testid="notes-complete-stats">
          <div className="glass-card rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center mb-3 mx-auto">
              <BookOpen size={18} />
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">
              Cards reviewed
            </div>
            <div className="font-clash text-2xl font-bold text-[var(--color-text)]" data-testid="stat-cards-reviewed">
              {cardsReviewed}
            </div>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] flex items-center justify-center mb-3 mx-auto">
              <Clock size={18} />
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">
              Time spent
            </div>
            <div className="font-clash text-2xl font-bold text-[var(--color-text)]" data-testid="stat-time-spent">
              {formatTime(timeSpentSeconds)}
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(`/session/${sessionId}/quiz/start`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
            data-testid="continue-to-quiz"
          >
            Continue to Quiz <ArrowRight size={16} />
          </button>
          <Link
            to={`/session/${sessionId}/notes`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bricolage font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
            data-testid="review-notes-again"
          >
            <RotateCcw size={15} /> Review Notes Again
          </Link>
        </div>

        {/* Dashboard link */}
        <Link
          to="/dashboard"
          className="inline-block mt-6 text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] font-mono"
          data-testid="back-to-dashboard"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

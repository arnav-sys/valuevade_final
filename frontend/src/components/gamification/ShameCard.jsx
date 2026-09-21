import { HeartCrack, ArrowRight, Snowflake, X } from 'lucide-react';
import { useStreak } from '../../contexts/StreakContext';
import { useNavigate } from 'react-router-dom';

/**
 * Surfaced when update_streak_on_activity reports was_broken=true (no auto
 * freeze applied).  Loss aversion explicit, dollar value, not just days.
 */
export default function ShameCard() {
  const { pendingShame, clearShame, consumeFreeze, freezeTokens } = useStreak();
  const navigate = useNavigate();

  if (!pendingShame) return null;
  const { lost_days, lost_xp_value } = pendingShame;
  const canFreeze = freezeTokens > 0;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Streak broken"
      data-testid="shame-card"
    >
      <button
        type="button"
        onClick={clearShame}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-label="Dismiss"
      />
      <div
        className="relative w-full max-w-md glass-card rounded-3xl p-6 sm:p-8 border-2"
        style={{
          borderColor: 'rgba(255,106,193,0.35)',
          boxShadow: '0 0 40px rgba(255,106,193,0.18)',
          animation: 'vvShameSlideIn 0.45s cubic-bezier(.2,.7,.3,1)',
        }}
      >
        <button
          type="button"
          onClick={clearShame}
          className="absolute top-3 right-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF6AC1, #6A5CFF)' }}
          >
            <HeartCrack size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent-pink)] mb-0.5">
              Streak broken
            </div>
            <div className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)]">
              You lost {lost_days}-day streak
            </div>
          </div>
        </div>
        <p className="text-sm font-bricolage text-[var(--color-text-muted)] mb-2">
          That's roughly{' '}
          <span className="font-mono font-semibold text-[var(--color-text)]">
            {(lost_xp_value || 0).toLocaleString()} XP
          </span>{' '}
          of daily-login bonus gone.
        </p>
        <p className="text-xs font-bricolage text-[var(--color-text-faint)] mb-5">
          Tip: Earn a freeze every 10 days. They auto-spend by default, you can also use one now to restore today.
        </p>

        {canFreeze && (
          <button
            type="button"
            onClick={async () => { await consumeFreeze(); }}
            className="w-full mb-2 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all"
            data-testid="shame-use-freeze"
          >
            <Snowflake size={14} /> Use Streak Freeze ({freezeTokens} left)
          </button>
        )}
        <button
          type="button"
          onClick={() => { clearShame(); navigate('/dashboard'); }}
          className={
            canFreeze
              ? 'w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-[var(--color-accent-pink)]/40 text-[var(--color-accent-pink)] text-sm font-semibold font-bricolage hover:bg-[var(--color-accent-pink)]/8 transition-all'
              : 'w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-accent-pink)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all'
          }
          data-testid="shame-rebuild"
        >
          Rebuild from today <ArrowRight size={16} />
        </button>
      </div>
      <style>{`
        @keyframes vvShameSlideIn {
          0%   { transform: translateY(24px) scale(0.98); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="shame-card"] > div:nth-child(2) {
            animation: vvShameFade 0.3s ease-out !important;
          }
          @keyframes vvShameFade { from { opacity: 0; } to { opacity: 1; } }
        }
      `}</style>
    </div>
  );
}

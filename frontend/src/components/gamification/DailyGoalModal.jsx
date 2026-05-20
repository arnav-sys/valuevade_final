import { useEffect, useState } from 'react';
import { Clock, Sparkles, Target, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useXP } from '../../contexts/XPContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

/**
 * Shown ONCE per user, the first time they ever hit the Dashboard
 * authenticated and don't yet have a daily_goal_minutes set.
 *
 * Loads its own state from user_stats (the XPContext.stats already covers this
 * but we re-read here so the modal can render outside the parent's render
 * cycle). Idempotent via daily_goal_modal_dismissed flag.
 */
const GOAL_OPTIONS = [
  { value: 5,  label: '5 min',  sub: 'Quick',       Icon: Clock },
  { value: 10, label: '10 min', sub: 'Standard',    Icon: Target, recommended: true },
  { value: 15, label: '15 min', sub: 'Serious',     Icon: Sparkles },
];

export default function DailyGoalModal() {
  const { user } = useAuth();
  const { stats, refresh } = useXP();
  const [shown, setShown] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (shown) return;
    if (!user?.id || !stats) return;
    const needsModal = (stats.daily_goal_minutes ?? null) === null && !stats.daily_goal_modal_dismissed;
    if (needsModal) setShown(true);
  }, [user?.id, stats, shown]);

  if (!shown) return null;

  const persistChoice = async (minutes, dismissed = false) => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      const payload = { daily_goal_minutes: minutes };
      if (dismissed) payload.daily_goal_modal_dismissed = true;
      await supabase.from('user_stats').update(payload).eq('user_id', user.id);
      await refresh();
      setShown(false);
      if (!dismissed) {
        toast.success(`Goal set: ${minutes} min/day`, {
          description: 'Track today\u2019s progress on the dashboard.',
          duration: 2400,
        });
      }
    } catch (err) {
      console.warn('[daily-goal] update failed:', err?.message || err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Set your daily goal"
      data-testid="daily-goal-modal"
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-md" />
      <div
        className="relative w-full max-w-lg glass-card rounded-3xl p-6 sm:p-8"
        style={{ animation: 'vvGoalPop 0.5s cubic-bezier(.2,.7,.3,1)' }}
      >
        <button
          type="button"
          onClick={() => persistChoice(10, true)}
          className="absolute top-3 right-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          aria-label="Dismiss"
          disabled={submitting}
        >
          <X size={18} />
        </button>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent-purple)] mb-2">
          Commit to a habit
        </div>
        <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-2">
          How much time per day?
        </h2>
        <p className="text-sm font-bricolage text-[var(--color-text-muted)] mb-6">
          Pick a daily goal. Small and consistent beats big and inconsistent.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-5" data-testid="daily-goal-options">
          {GOAL_OPTIONS.map((opt) => {
            const isSel = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={`relative glass-card rounded-2xl p-4 text-center transition-all ${
                  isSel
                    ? 'border-[var(--color-primary)] shadow-[0_0_24px_rgba(36,107,253,0.25)]'
                    : 'hover:border-[var(--color-primary)]/40'
                }`}
                data-testid={`daily-goal-${opt.value}`}
                aria-pressed={isSel}
              >
                {opt.recommended && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-[var(--color-accent-purple)] text-white">
                    Recommended
                  </span>
                )}
                <opt.Icon size={20} className="mx-auto mb-2 text-[var(--color-primary)]" />
                <div className="font-clash text-base font-bold text-[var(--color-text)]">{opt.label}</div>
                <div className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] tracking-wider mt-0.5">{opt.sub}</div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => persistChoice(selected || 10)}
            disabled={!selected || submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            data-testid="daily-goal-confirm"
          >
            Set my goal
          </button>
          <button
            type="button"
            onClick={() => persistChoice(10, true)}
            disabled={submitting}
            className="text-sm font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors px-3 py-2"
            data-testid="daily-goal-later"
          >
            Maybe later
          </button>
        </div>
      </div>
      <style>{`
        @keyframes vvGoalPop {
          0%   { transform: translateY(24px) scale(0.96); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="daily-goal-modal"] > div:nth-child(2) { animation: vvGoalFade 0.3s ease-out !important; }
          @keyframes vvGoalFade { from { opacity: 0; } to { opacity: 1; } }
        }
      `}</style>
    </div>
  );
}

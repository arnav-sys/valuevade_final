import { useState } from 'react';
import { toast } from 'sonner';
import { X, RefreshCcw, Loader2, ArrowRight, CalendarDays } from 'lucide-react';
import { rebalanceStudyPlan } from '../../utils/studyPlanner';

// Phase D2, "Reset plan?" modal.
//
// Three exits: keep current / rebalance with same targets / change plan
// style (opens the D1 wizard pre-filled with the current plan via the
// parent's onOpenWizard callback).

export default function PlanResetModal({
  open, onClose, behindPercent, currentMode, onRebalanced, onOpenWizard,
}) {
  const [pending, setPending] = useState(false);

  if (!open) return null;

  const sameTargets = async () => {
    setPending(true);
    try {
      const { ok, data } = await rebalanceStudyPlan();
      if (!ok) {
        toast.error(typeof data?.detail === 'string' ? data.detail : 'Rebalance failed');
      } else {
        toast.success('Plan rebalanced, fresh start from today');
        onRebalanced?.(data);
        onClose?.();
      }
    } catch (e) {
      toast.error(e?.message || 'Network error');
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rebalance your plan"
      data-testid="plan-reset-modal"
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(8,12,24,.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 px-6 pt-6 pb-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0">
              <RefreshCcw size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="font-clash text-lg font-bold text-[var(--color-text)] leading-tight">
                You're {behindPercent}% behind. Rebalance?
              </h2>
              <p className="text-xs font-bricolage text-[var(--color-text-muted)] mt-1">
                We can spread the remaining sessions over your remaining days. Your past work stays as-is.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] shrink-0" data-testid="plan-reset-close">
            <X size={18} />
          </button>
        </header>

        <div className="px-6 pt-3 pb-6 space-y-2">
          <button
            type="button"
            onClick={sameTargets}
            disabled={pending}
            className="w-full text-left px-4 py-3 rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/15 transition-all disabled:opacity-50"
            data-testid="plan-reset-rebalance-same"
          >
            <div className="flex items-center gap-3">
              <div className="text-[var(--color-primary)]">
                {pending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-clash text-sm font-semibold text-[var(--color-text)]">
                  Rebalance with same targets
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-muted)] mt-0.5">
                  keep {currentMode || 'current'} · recompute from today
                </div>
              </div>
              <ArrowRight size={14} className="text-[var(--color-primary)]" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => { onClose?.(); onOpenWizard?.(); }}
            className="w-full text-left px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface)] transition-all"
            data-testid="plan-reset-change-style"
          >
            <div className="flex items-center gap-3">
              <div className="text-[var(--color-text-muted)]">
                <CalendarDays size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-clash text-sm font-semibold text-[var(--color-text)]">
                  Change plan style
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-muted)] mt-0.5">
                  pick a new deadline, hours/day, or hours/week
                </div>
              </div>
              <ArrowRight size={14} className="text-[var(--color-text-muted)]" />
            </div>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-left px-4 py-3 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50 transition-all"
            data-testid="plan-reset-keep"
          >
            <div className="font-bricolage text-sm">
              Keep current plan
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-faint)] mt-0.5">
              we'll keep nudging when you get further behind
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

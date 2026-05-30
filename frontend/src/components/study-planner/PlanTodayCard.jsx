import { useMemo } from 'react';
import { CalendarCheck, Flame, Loader2, AlertTriangle, RefreshCcw, CheckCircle2 } from 'lucide-react';

// Phase D2 — Today vs Plan card.
//
// Compact dashboard card. Reads from /api/study-plan/dashboard-summary
// (the parent owns the fetch; this is a pure presentation component).
//
// Status colour:
//   complete    → green
//   today       → primary blue (in progress)
//   rest        → grey
//   upcoming    → grey
//   <50% past 12:00 IST → amber "Behind"

function statusLabel(today) {
  if (!today) return { label: 'No plan today', color: 'var(--color-text-muted)' };
  if (today.status === 'rest') return { label: 'Rest Day', color: 'var(--color-text-muted)' };
  if (today.status === 'complete') return { label: 'On Track', color: 'var(--color-success)' };
  // Heuristic for "Behind": only fire after 12:00 IST when <50%.
  const now = new Date();
  const istHours = (now.getUTCHours() + 5.5 + 24) % 24;
  if (istHours >= 12 && (today.percent_complete ?? 0) < 50) {
    return { label: 'Behind', color: 'var(--color-warning, #F59E0B)' };
  }
  return { label: 'In Progress', color: 'var(--color-primary)' };
}

function MeterBar({ pct, color }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  );
}

export default function PlanTodayCard({ data, loading, onOpenRebalance, onOpenWizard }) {
  const status = useMemo(() => statusLabel(data?.today), [data]);
  const today = data?.today;
  const cum = data?.cumulative;
  const streak = data?.adherence?.on_schedule_streak_days || 0;

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 px-5 py-4 flex items-center gap-3 text-sm text-[var(--color-text-muted)]" data-testid="plan-today-loading">
        <Loader2 size={14} className="animate-spin" /> Loading today's plan…
      </div>
    );
  }

  if (!data?.active_plan) {
    // Empty state — caller's CTA card handles the "set up plan" surface.
    return null;
  }

  const minPct = today?.required_minutes > 0
    ? Math.round(((today.actual_minutes || 0) / today.required_minutes) * 100)
    : 100;
  const sessionsDone = today?.completed_session_codes?.length || 0;
  const sessionsTotal = today?.required_session_codes?.length || 0;
  const sessionPct = sessionsTotal > 0 ? Math.round((sessionsDone / sessionsTotal) * 100) : 100;
  const needsReset = !!cum?.needs_reset_warning;
  const behindPct = cum?.is_behind_percent || 0;

  return (
    <div
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-4 sm:py-5"
      data-testid="plan-today-card"
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center shrink-0">
            <CalendarCheck size={16} />
          </div>
          <div className="min-w-0">
            <div className="font-clash text-sm sm:text-base font-bold text-[var(--color-text)]">Today's Plan</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
              {today?.day_date ? new Date(today.day_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'IST'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {streak >= 3 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[10px] font-mono uppercase tracking-[0.12em]" data-testid="plan-streak-chip">
              <Flame size={11} /> {streak}d
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.18em]"
            style={{
              color: status.color,
              background: `color-mix(in srgb, ${status.color} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${status.color} 35%, transparent)`,
            }}
            data-testid="plan-status-pill"
          >
            {today?.status === 'complete' && <CheckCircle2 size={11} />}
            {status.label}
          </span>
        </div>
      </header>

      {today?.status === 'rest' ? (
        <p className="text-sm font-bricolage text-[var(--color-text-muted)]">
          No required work today. Recharge — your streak holds.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5">
              <span>Minutes</span>
              <span className="text-[var(--color-text)] font-bold" data-testid="plan-today-minutes">
                {(today?.actual_minutes || 0)} / {today?.required_minutes || 0}
              </span>
            </div>
            <MeterBar pct={minPct} color="var(--color-primary)" />
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5">
              <span>Sessions</span>
              <span className="text-[var(--color-text)] font-bold" data-testid="plan-today-sessions">
                {sessionsDone} / {sessionsTotal}
              </span>
            </div>
            <MeterBar pct={sessionPct} color="var(--color-accent-purple)" />
          </div>
        </div>
      )}

      {needsReset && (
        <div
          className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2.5 flex items-start gap-2"
          data-testid="plan-reset-warning"
        >
          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-300 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bricolage text-amber-900 dark:text-amber-100 leading-relaxed">
              You're <span className="font-bold">{behindPct}%</span> behind your plan.
            </div>
            <button
              type="button"
              onClick={onOpenRebalance}
              className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 underline font-bold"
              data-testid="plan-rebalance-cta"
            >
              <RefreshCcw size={10} /> Rebalance
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

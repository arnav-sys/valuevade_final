import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  X, ArrowLeft, ArrowRight, Loader2, AlertCircle, Calendar, Clock,
  CalendarDays, Sparkles, CheckCircle2,
} from 'lucide-react';
import { previewStudyPlan, commitStudyPlan } from '../../utils/studyPlanner';

// Phase D1 — Study planner wizard.
//
// Three modes, three steps, one commit. The wizard never mutates anything
// until step 3's Confirm. Step 2's "rest days" picker is Sun-first (S M T
// W T F S) so it aligns with the backend's `non_study_weekdays` int[]
// where 0=Sun ... 6=Sat.

const MODES = [
  {
    key: 'deadline',
    label: 'I have a deadline',
    hint: 'Pick a date you need to finish by — we\'ll spread the work backwards.',
    icon: Calendar,
  },
  {
    key: 'hours_per_day',
    label: "I'll study N hours per day",
    hint: 'Tell us how many hours/day; we\'ll figure out when you finish.',
    icon: Clock,
  },
  {
    key: 'hours_per_week',
    label: "I'll study N hours per week",
    hint: 'Pick a weekly cap; we\'ll distribute it across your active days.',
    icon: CalendarDays,
  },
];

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // Sun..Sat

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isoPlusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function StepDots({ step, total = 3 }) {
  return (
    <div className="flex items-center gap-1.5" data-testid="study-plan-step-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i + 1 === step ? 'w-8 bg-[var(--color-primary)]' : i + 1 < step ? 'w-3 bg-[var(--color-primary)]/60' : 'w-3 bg-[var(--color-border)]'
          }`}
        />
      ))}
    </div>
  );
}

function ModeCard({ mode, selected, onSelect, children }) {
  const Icon = mode.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(mode.key)}
      className={`w-full text-left rounded-2xl p-4 sm:p-5 border-2 transition-all ${
        selected
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/8'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]/40 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface)]/70'
      }`}
      data-testid={`study-plan-mode-${mode.key}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)]'}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-clash text-sm sm:text-base font-semibold ${selected ? 'text-[var(--color-text)]' : 'text-[var(--color-text)]'}`}>{mode.label}</div>
          <div className="text-xs font-bricolage text-[var(--color-text-muted)] mt-0.5">{mode.hint}</div>
          {selected && children}
        </div>
      </div>
    </button>
  );
}

export default function StudyPlanWizard({ open, onClose, enrollmentId, onCommit }) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState('hours_per_day');
  const [deadline, setDeadline] = useState(isoPlusDays(60));
  const [hoursPerDay, setHoursPerDay] = useState('1.0');
  const [hoursPerWeek, setHoursPerWeek] = useState('7.0');
  const [restDays, setRestDays] = useState([0, 6]);  // Sun + Sat = Weekend off (default)
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [committing, setCommitting] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setMode('hours_per_day');
    setDeadline(isoPlusDays(60));
    setHoursPerDay('1.0');
    setHoursPerWeek('7.0');
    setRestDays([0, 6]);
    setPreviewData(null);
    setPreviewError(null);
  }, []);

  useEffect(() => { if (!open) reset(); }, [open, reset]);

  const toggleRestDay = (i) => {
    setRestDays((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort());
  };

  const payload = useMemo(() => {
    const base = { enrollment_id: enrollmentId, target_mode: mode, non_study_weekdays: restDays };
    if (mode === 'deadline')        return { ...base, target_deadline: deadline };
    if (mode === 'hours_per_day')   return { ...base, target_hours_per_day: parseFloat(hoursPerDay) };
    if (mode === 'hours_per_week')  return { ...base, target_hours_per_week: parseFloat(hoursPerWeek) };
    return base;
  }, [enrollmentId, mode, restDays, deadline, hoursPerDay, hoursPerWeek]);

  const stepInputValid = useMemo(() => {
    if (mode === 'deadline')        return deadline && deadline > todayISO();
    if (mode === 'hours_per_day')   { const n = parseFloat(hoursPerDay); return n >= 0.25 && n <= 10; }
    if (mode === 'hours_per_week')  { const n = parseFloat(hoursPerWeek); return n >= 1 && n <= 70; }
    return false;
  }, [mode, deadline, hoursPerDay, hoursPerWeek]);

  const restValid = restDays.length < 7;

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    try {
      const { ok, status, data } = await previewStudyPlan(payload);
      if (!ok) {
        const msg = typeof data?.detail === 'string' ? data.detail : `preview failed (HTTP ${status})`;
        setPreviewError(msg);
      } else {
        setPreviewData(data);
      }
    } catch (e) {
      setPreviewError(e?.message || 'Network error');
    } finally {
      setPreviewLoading(false);
    }
  }, [payload]);

  // Auto-fetch preview when entering step 3.
  useEffect(() => {
    if (open && step === 3) fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const handleConfirm = async () => {
    setCommitting(true);
    try {
      const { ok, data } = await commitStudyPlan(payload);
      if (!ok) {
        toast.error(typeof data?.detail === 'string' ? data.detail : 'Plan commit failed');
      } else {
        toast.success('Plan set ✓ Check your dashboard');
        onCommit?.(data);
        onClose?.();
      }
    } catch (e) {
      toast.error(e?.message || 'Network error');
    } finally {
      setCommitting(false);
    }
  };

  if (!open) return null;

  const totalLoadHrs = previewData ? (previewData.total_load_minutes / 60).toFixed(1) : '—';
  const avgMins = previewData && previewData.total_active_days > 0
    ? Math.round(previewData.total_load_minutes / previewData.total_active_days)
    : 0;
  const next14 = previewData ? (previewData.days || []).slice(0, 14) : [];
  const max14 = Math.max(1, ...next14.map((d) => d.required_minutes || 0));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set up your study plan"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(8,12,24,.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      data-testid="study-plan-wizard"
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 sm:px-7 pt-5 pb-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center shrink-0">
              <CalendarDays size={14} />
            </div>
            <div className="min-w-0">
              <div className="font-clash text-sm sm:text-base font-bold text-[var(--color-text)] truncate">
                Set up your study plan
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Step {step} of 3 · {step === 1 ? 'pick a style' : step === 2 ? 'rest days' : 'preview'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StepDots step={step} />
            <button onClick={onClose} className="rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]" data-testid="study-plan-close">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="px-5 sm:px-7 py-6 max-h-[68vh] overflow-y-auto">
          {step === 1 && (
            <div className="space-y-3" data-testid="study-plan-step-1">
              <p className="text-sm font-bricolage text-[var(--color-text-muted)] mb-3">
                How do you want to pace yourself? Pick one, then enter your target.
              </p>

              <ModeCard mode={MODES[0]} selected={mode === 'deadline'} onSelect={setMode}>
                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Finish by</label>
                  <input
                    type="date"
                    value={deadline}
                    min={isoPlusDays(1)}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm font-bricolage text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]/60"
                    data-testid="study-plan-deadline-input"
                  />
                </div>
              </ModeCard>

              <ModeCard mode={MODES[1]} selected={mode === 'hours_per_day'} onSelect={setMode}>
                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Hours per day (0.25 to 10)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="10"
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm font-bricolage text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]/60"
                    data-testid="study-plan-hpd-input"
                  />
                </div>
              </ModeCard>

              <ModeCard mode={MODES[2]} selected={mode === 'hours_per_week'} onSelect={setMode}>
                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Hours per week (1 to 70)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="70"
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm font-bricolage text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]/60"
                    data-testid="study-plan-hpw-input"
                  />
                </div>
              </ModeCard>
            </div>
          )}

          {step === 2 && (
            <div data-testid="study-plan-step-2">
              <p className="text-sm font-bricolage text-[var(--color-text-muted)] mb-4">
                Mark the days you want off. Selected days get zero load and don't break your streak.
              </p>

              <div className="flex items-center gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => setRestDays([])}
                  className="px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50"
                  data-testid="study-plan-preset-none"
                >
                  No days off
                </button>
                <button
                  type="button"
                  onClick={() => setRestDays([0, 6])}
                  className="px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50"
                  data-testid="study-plan-preset-weekend"
                >
                  Weekend off (Sat + Sun)
                </button>
              </div>

              <div className="flex items-center justify-between gap-1.5 mb-3">
                {WEEKDAY_LABELS.map((lbl, i) => {
                  const active = restDays.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleRestDay(i)}
                      className={`flex-1 h-14 rounded-xl border-2 font-clash text-base font-bold transition-all ${
                        active
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)]/40 text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40'
                      }`}
                      data-testid={`study-plan-restday-${i}`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-faint)] text-center">
                {restDays.length === 0 ? 'studying 7 days/week' : `${7 - restDays.length} study days · ${restDays.length} rest`}
              </div>
              {!restValid && (
                <div className="mt-3 rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle size={12} /> You can't mark all 7 days as rest.
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div data-testid="study-plan-step-3">
              {previewLoading && (
                <div className="flex items-center justify-center py-10 text-[var(--color-text-muted)]">
                  <Loader2 size={18} className="animate-spin mr-2" /> Generating your plan…
                </div>
              )}
              {previewError && !previewLoading && (
                <div className="rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200 flex items-start gap-2" data-testid="study-plan-preview-error">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold mb-1">Couldn't build a plan with these settings.</div>
                    <div className="text-red-200/80">{previewError}</div>
                  </div>
                  <button onClick={fetchPreview} className="text-xs underline shrink-0">Retry</button>
                </div>
              )}

              {previewData && !previewLoading && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="study-plan-preview-summary">
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-3">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Start</div>
                      <div className="font-clash text-sm font-bold text-[var(--color-text)]">{formatDate(previewData.plan_start_date)}</div>
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-3">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Finish</div>
                      <div className="font-clash text-sm font-bold text-[var(--color-text)]" data-testid="study-plan-preview-end-date">{formatDate(previewData.plan_end_date)}</div>
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-3">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Total load</div>
                      <div className="font-clash text-sm font-bold text-[var(--color-text)]">~{totalLoadHrs} hr</div>
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-3">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Active days</div>
                      <div className="font-clash text-sm font-bold text-[var(--color-text)]">{previewData.total_active_days}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/30 px-4 py-3 text-xs sm:text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                    {previewData.total_sessions} sessions and {previewData.total_projects} module projects scheduled across {previewData.total_active_days} active days. Average <span className="text-[var(--color-text)] font-semibold">{avgMins} min/day</span>.
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Next 14 days</div>
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)]">
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[var(--color-primary)]"/> study</span>
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[var(--color-border)]"/> rest</span>
                      </div>
                    </div>
                    <div className="flex items-end justify-between gap-1 h-24" data-testid="study-plan-preview-bars">
                      {next14.map((d, i) => {
                        const h = d.required_minutes > 0 ? Math.max(8, (d.required_minutes / max14) * 92) : 6;
                        const isRest = d.status === 'rest';
                        const dt = new Date(d.day_date);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                            <div
                              className={`w-full rounded-t-md ${isRest ? 'bg-[var(--color-border)]/60' : 'bg-gradient-to-t from-[var(--color-primary)]/60 to-[var(--color-primary)]'}`}
                              style={{ height: `${h}px` }}
                              title={isRest ? 'Rest' : `${d.required_minutes} min`}
                            />
                            <div className="text-[9px] font-mono text-[var(--color-text-faint)] truncate w-full text-center">{WEEKDAY_LABELS[(dt.getDay()) % 7]}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)]/30">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
              data-testid="study-plan-back"
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xs sm:text-sm font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline"
              data-testid="study-plan-skip"
            >
              Skip for now
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 ? !stepInputValid : !restValid}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold font-bricolage bg-[var(--color-primary)] text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="study-plan-next"
            >
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={committing || previewLoading || !!previewError || !previewData}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold font-bricolage bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="study-plan-confirm"
            >
              {committing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Commit plan
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

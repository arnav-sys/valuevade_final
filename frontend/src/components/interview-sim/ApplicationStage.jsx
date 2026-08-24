import { useState } from 'react';
import { Send, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SimpleMarkdown } from './simShared';
import { buildAuthSimApi } from './simApi';
import { toast } from 'sonner';

const FIELDS = [
  { key: 'why_firm', label: 'Why do you want to join this firm?', ph: 'Be specific — their research franchise, coverage style, culture…', required: true },
  { key: 'why_er', label: 'Why equity research as a career?', ph: 'What draws you to the analyst seat? Show genuine motivation.', required: true },
  { key: 'achievement', label: 'Your proudest achievement (quantify it)', ph: 'A project, competition, model you built — with numbers and outcomes.', required: true },
  { key: 'cover_note', label: 'Short cover note (optional)', ph: 'Anything else the recruiter should know — 2-3 lines.', required: false },
];

export default function ApplicationStage({ attempt, sim, onAdvance, simApi }) {
  const api = simApi || buildAuthSimApi(attempt.id);
  const existing = attempt.stage_data?.application;
  const [form, setForm] = useState({ why_firm: '', why_er: '', achievement: '', cover_note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(existing || null);

  const canSubmit = FIELDS.filter((f) => f.required).every((f) => form[f.key].trim().length >= 30);

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await api.fetch(api.endpoints.application, {
        method: 'POST',
        body: JSON.stringify({ responses: form }),
      });
      setResult(r.application);
      await api.onStageComplete('application', r.application, 'aptitude');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="glass-card rounded-2xl p-6 sm:p-8" data-testid="application-result">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)] text-[10px] font-mono uppercase tracking-[0.2em] mb-4">
          <CheckCircle2 size={12} /> Application shortlisted
        </div>
        <h2 className="font-clash text-2xl font-bold text-[var(--color-text)] mb-2">
          You've been shortlisted for the online assessment
        </h2>
        <p className="text-xs font-mono text-[var(--color-text-muted)] mb-4" data-testid="application-score">
          Recruiter score: {Math.round(result.score)}/100 · "{result.screening_note}"
        </p>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4 mb-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-accent-purple)] mb-2">Recruiter feedback on your application</p>
          <SimpleMarkdown text={result.feedback_md} />
        </div>
        <button
          onClick={onAdvance}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all"
          data-testid="application-continue-btn"
        >
          Continue to Online Aptitude Test <ArrowRight size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="application-stage">
      {/* Job posting */}
      <div className="glass-card rounded-2xl p-6 sm:p-7">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2">About the team</p>
        <p className="text-sm font-bricolage text-[var(--color-text)] leading-relaxed">{sim.about_md}</p>
      </div>

      {/* Application form */}
      <div className="glass-card rounded-2xl p-6 sm:p-7">
        <h2 className="font-clash text-xl font-bold text-[var(--color-text)] mb-1">Application form</h2>
        <p className="text-xs text-[var(--color-text-muted)] font-bricolage mb-5">
          A recruiter (AI) will screen your application and give you personalised feedback. Minimum ~30 characters per required answer.
        </p>
        <div className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
                {f.label}{f.required && <span className="text-[var(--color-error)]"> *</span>}
              </label>
              <textarea
                value={form[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.ph}
                rows={f.key === 'cover_note' ? 2 : 3}
                maxLength={2500}
                className="w-full p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-bricolage text-[var(--color-text)] focus:border-[var(--color-primary)] outline-none resize-y"
                data-testid={`application-field-${f.key}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-5">
          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all disabled:opacity-40"
            data-testid="application-submit-btn"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {submitting ? 'Screening your application…' : 'Submit application'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Send, Loader2, ArrowRight, BarChart3, CheckCircle2 } from 'lucide-react';
import UniverSpreadsheet from '../simulations/UniverSpreadsheet';
import { SimpleMarkdown } from './simShared';
import { buildAuthSimApi } from './simApi';
import { toast } from 'sonner';

export default function CaseStage({ attempt, sim, onAdvance, simApi }) {
  const api = simApi || buildAuthSimApi(attempt.id);
  const caseCfg = sim.case_config || {};
  const existing = attempt.stage_data?.case_study;
  const [excelScore, setExcelScore] = useState(null);
  const [recommendation, setRecommendation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(existing?.completed_at ? existing : null);

  const wordCount = recommendation.trim() ? recommendation.trim().split(/\s+/).length : 0;
  const canSubmit = excelScore != null && recommendation.trim().length >= 120;

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await api.fetch(api.endpoints.caseSubmit, {
        method: 'POST',
        // Guest mode is stateless, pass the full stage_data so the server
        // can compute the final verdict. Auth mode ignores stage_data (it
        // reads from the attempt row instead).
        body: JSON.stringify({
          excel_score: excelScore,
          recommendation: recommendation.trim(),
          stage_data: attempt.stage_data || {},
        }),
      });
      setResult(r.case_study);
      await api.onStageComplete('case_study', r.case_study, 'decision', {
        decision: r.decision,
        final_score: r.final_score,
        verdict: r.verdict,
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="glass-card rounded-2xl p-6 sm:p-8" data-testid="case-result">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)] text-[10px] font-mono uppercase tracking-[0.2em] mb-4">
          <CheckCircle2 size={12} /> Case round submitted
        </div>
        <h2 className="font-clash text-2xl font-bold text-[var(--color-text)] mb-4" data-testid="case-score">
          Case score: {Math.round(result.score)}/100
          <span className="block text-sm font-bricolage font-normal text-[var(--color-text-muted)] mt-1">
            Model accuracy {Math.round(result.excel_score?.total ?? 0)}/100 · Written recommendation {Math.round(result.written_score)}/100
          </span>
        </h2>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4 mb-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-accent-purple)] mb-2">Senior analyst feedback</p>
          <SimpleMarkdown text={result.feedback_md} />
        </div>
        <button
          onClick={onAdvance}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all"
          data-testid="case-continue-btn"
        >
          See the hiring committee's decision <ArrowRight size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="case-stage">
      <div className="glass-card rounded-2xl p-6 sm:p-7">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)] text-[10px] font-mono uppercase tracking-[0.2em] mb-4">
          <BarChart3 size={12} /> Case study + live modelling round
        </div>
        <SimpleMarkdown text={caseCfg.brief_md} />
      </div>

      {/* Step 1, Excel model */}
      <div className="glass-card rounded-2xl p-4 sm:p-5">
        <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
          Step 1 · Build the model, then hit "Submit &amp; grade" inside the sheet
        </p>
        {caseCfg.workbook ? (
          <UniverSpreadsheet
            workbook={caseCfg.workbook}
            onAutoSave={async () => {}}
            onSubmit={async (_state, score) => {
              setExcelScore(score || { total: 0, per_cell: {} });
              toast.success(`Model graded: ${score?.total ?? 0}/100. Now write your recommendation below.`);
            }}
          />
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Case workbook unavailable.</p>
        )}
        {excelScore != null && (
          <p className="text-xs font-mono text-[var(--color-success)] mt-3" data-testid="case-excel-score">
            ✓ Model graded: {Math.round(excelScore.total)}/100
          </p>
        )}
      </div>

      {/* Step 2, Written recommendation */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
          Step 2 · Your investment recommendation (150-300 words)
        </p>
        <textarea
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value)}
          placeholder="BUY / HOLD / SELL with your target price, thesis anchored in your model's numbers, key drivers and one risk…"
          rows={8}
          maxLength={6000}
          className="w-full p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-bricolage text-[var(--color-text)] focus:border-[var(--color-primary)] outline-none resize-y"
          data-testid="case-recommendation-input"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] font-mono text-[var(--color-text-faint)]" data-testid="case-word-count">
            {wordCount} words {excelScore == null && '· grade your model first (Step 1)'}
          </span>
          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all disabled:opacity-40"
            data-testid="case-submit-btn"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Evaluating your case…' : 'Submit case round'}
          </button>
        </div>
      </div>
    </div>
  );
}

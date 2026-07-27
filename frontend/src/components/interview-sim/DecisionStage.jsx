import { useNavigate } from 'react-router-dom';
import { Trophy, XCircle, ArrowRight, RotateCcw } from 'lucide-react';
import { SimpleMarkdown, StageScorePill } from './simShared';

export default function DecisionStage({ attempt, sim }) {
  const navigate = useNavigate();
  const decision = attempt.stage_data?.decision || {};
  const isOffer = (attempt.verdict || decision.verdict) === 'offer';
  const scores = decision.stage_scores || {};
  const attemptsLeft = attempt.attempt_number < 2;

  return (
    <div className="space-y-5" data-testid="decision-stage">
      {/* Verdict banner */}
      <div
        className={`glass-card rounded-2xl p-6 sm:p-8 text-center ${isOffer
          ? 'border-[var(--color-success)]/40 bg-gradient-to-br from-[var(--color-success)]/10 to-transparent'
          : 'border-red-500/30 bg-gradient-to-br from-red-500/8 to-transparent'}`}
        data-testid="decision-banner"
      >
        <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center ${isOffer ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : 'bg-red-500/15 text-red-400'}`}>
          {isOffer ? <Trophy size={28} /> : <XCircle size={28} />}
        </div>
        <h2 className="font-clash text-3xl font-bold text-[var(--color-text)] mb-1" data-testid="decision-verdict">
          {isOffer ? 'Offer Extended! 🎉' : 'Not Selected'}
        </h2>
        <p className="text-sm font-bricolage text-[var(--color-text-muted)]">
          {sim.firm_name} · Final weighted score{' '}
          <strong className="text-[var(--color-text)]" data-testid="decision-final-score">
            {decision.final_score ?? attempt.final_score}/100
          </strong>
          {decision.rejected_at === 'aptitude' && ' · process ended at the online aptitude test'}
        </p>
      </div>

      {/* Stage scores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="decision-stage-scores">
        <StageScorePill label="Aptitude" score={scores.aptitude} />
        <StageScorePill label="HR round" score={scores.behavioural} />
        <StageScorePill label="Technical" score={scores.technical} />
        <StageScorePill label="Case study" score={scores.case_study} />
      </div>

      {/* Letter */}
      <div className={`glass-card rounded-2xl p-6 sm:p-7 ${isOffer ? 'border-[var(--color-success)]/25' : ''}`} data-testid="decision-letter">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
          {isOffer ? 'Offer letter' : 'Outcome letter'} · {sim.firm_name} Talent Acquisition
        </p>
        <SimpleMarkdown text={decision.letter_md} />
      </div>

      {/* Hiring committee debrief */}
      <div className="glass-card rounded-2xl p-6 sm:p-7" data-testid="decision-report">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent-purple)] mb-3">
          Hiring committee debrief — your personalised feedback
        </p>
        <SimpleMarkdown text={decision.report_md} />
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={() => navigate('/interview-sims')}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all"
          data-testid="decision-back-hub-btn"
        >
          Back to all openings <ArrowRight size={15} />
        </button>
        {!isOffer && attemptsLeft && (
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--color-text-muted)]" data-testid="decision-retry-hint">
            <RotateCcw size={12} /> You have 1 more attempt at {sim.firm_name} — re-apply from the openings list.
          </span>
        )}
      </div>
    </div>
  );
}

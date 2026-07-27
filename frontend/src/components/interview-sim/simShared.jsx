import { FileText, Timer, Users, Brain, BarChart3, Award, CheckCircle2, XCircle } from 'lucide-react';
import { STAGE_ORDER } from '../../utils/interviewSim';

export function SimpleMarkdown({ text, className = '' }) {
  if (!text) return null;
  const html = String(text)
    .split(/\n\n+/)
    .map((block) => {
      const b = block.trim();
      if (/^#{1,4}\s/.test(b)) {
        const level = b.match(/^(#{1,4})\s/)[1].length;
        return `<h${level + 2} class="font-clash font-bold text-[var(--color-text)] mt-2">${b.replace(/^#{1,4}\s/, '')}</h${level + 2}>`;
      }
      if (/^[-*]\s/m.test(b)) {
        const items = b.split('\n').filter((l) => /^[-*]\s/.test(l.trim()))
          .map((l) => `<li>${inline(l.replace(/^\s*[-*]\s/, ''))}</li>`).join('');
        return `<ul class="list-disc pl-5 space-y-1">${items}</ul>`;
      }
      return `<p>${inline(b).replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');
  function inline(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }
  return (
    <div
      className={`text-sm font-bricolage text-[var(--color-text)] leading-relaxed space-y-3 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const STAGE_META = {
  application: { label: 'Application', icon: FileText },
  aptitude: { label: 'Aptitude Test', icon: Timer },
  behavioural: { label: 'HR Interview', icon: Users },
  technical: { label: 'Technical', icon: Brain },
  case_study: { label: 'Case Study', icon: BarChart3 },
  decision: { label: 'Decision', icon: Award },
};

export function FirmLogo({ brand, size = 48 }) {
  const accent = brand?.accent || '#246BFD';
  return (
    <div
      className="rounded-xl flex items-center justify-center font-clash font-bold text-white shrink-0"
      style={{ width: size, height: size, background: accent, fontSize: size * 0.32 }}
      data-testid="firm-logo"
    >
      {brand?.initials || '—'}
    </div>
  );
}

export function StageTracker({ currentStage, stageData, verdict }) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  const rejectedAt = stageData?.decision?.rejected_at;
  return (
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1" data-testid="stage-tracker">
      {STAGE_ORDER.map((st, i) => {
        const meta = STAGE_META[st];
        const Icon = meta.icon;
        const done = i < currentIdx || (currentStage === 'decision' && st === 'decision');
        const isCurrent = i === currentIdx && currentStage !== 'decision';
        const skipped = rejectedAt && ['behavioural', 'technical', 'case_study'].includes(st);
        const isDecisionRejected = st === 'decision' && verdict === 'rejected';
        return (
          <div key={st} className="flex items-center gap-1 sm:gap-2 shrink-0">
            {i > 0 && <div className={`w-4 sm:w-8 h-px ${done || isCurrent ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`} />}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${
                skipped
                  ? 'border-[var(--color-border)] text-[var(--color-text-faint)] line-through'
                  : done
                    ? (isDecisionRejected
                        ? 'border-red-400/40 bg-red-500/10 text-red-400'
                        : 'border-[var(--color-success)]/40 bg-[var(--color-success)]/10 text-[var(--color-success)]')
                    : isCurrent
                      ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-faint)]'
              }`}
              data-testid={`stage-chip-${st}`}
            >
              {done && !skipped ? (
                isDecisionRejected ? <XCircle size={11} /> : <CheckCircle2 size={11} />
              ) : (
                <Icon size={11} />
              )}
              <span className="hidden md:inline">{meta.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StageScorePill({ label, score }) {
  return (
    <div className="glass-card rounded-xl px-4 py-3 text-center">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">{label}</div>
      <div className="font-clash text-xl font-bold text-[var(--color-text)]">
        {score != null ? `${Math.round(score)}` : '—'}
        <span className="text-xs text-[var(--color-text-muted)] font-bricolage font-normal">/100</span>
      </div>
    </div>
  );
}

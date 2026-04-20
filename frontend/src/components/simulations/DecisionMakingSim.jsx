import { useMemo, useState } from 'react';
import {
  GitBranch, Sparkles, ArrowRight, ChevronDown, ChevronUp, Target,
  CheckCircle2, Eye, History,
} from 'lucide-react';

function accumulateScores(history, scoring) {
  const scores = {};
  history.forEach((h) => {
    const impact = h.option?.score_impact || {};
    Object.entries(impact).forEach(([dim, val]) => {
      scores[dim] = (scores[dim] || 0) + (typeof val === 'number' ? val : 0);
    });
  });
  return scores;
}

function computeOverallQuality(scores, mapping) {
  if (!mapping || !mapping.length) return null;
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const sorted = [...mapping].sort((a, b) => (a.min_total ?? 0) - (b.min_total ?? 0));
  let match = sorted[0];
  for (const m of sorted) {
    if (total >= (m.min_total ?? 0)) match = m;
  }
  return { total, ...match };
}

export default function DecisionMakingSim({ config, onComplete }) {
  const scenarioContext = config?.scenario_context || '';
  const initialData = config?.initial_data || {};
  const decisionPoints = config?.decision_points || [];
  const scoring = config?.scoring || {};

  const decisionsById = useMemo(() => {
    const m = {};
    decisionPoints.forEach((d) => { m[d.id] = d; });
    return m;
  }, [decisionPoints]);

  const [currentId, setCurrentId] = useState(decisionPoints[0]?.id || null);
  const [history, setHistory] = useState([]); // [{decision, option}]
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showOptimal, setShowOptimal] = useState(false);
  const [revealed, setRevealed] = useState(false); // consequence revealed

  const current = currentId ? decisionsById[currentId] : null;
  const lastEntry = history[history.length - 1];
  const isTerminal = lastEntry?.option?.is_terminal;

  const scores = useMemo(() => accumulateScores(history, scoring), [history, scoring]);
  const outcome = isTerminal ? computeOverallQuality(scores, scoring.outcome_mapping) : null;

  const handleSelect = (option) => {
    const entry = { decision: current, option };
    setHistory([...history, entry]);
    setRevealed(true);
  };

  const handleContinue = () => {
    if (!lastEntry) return;
    if (lastEntry.option.is_terminal) return;
    const next = lastEntry.option.next_decision;
    if (next && decisionsById[next]) {
      setCurrentId(next);
      setRevealed(false);
    }
  };

  // Build "optimal path" — pick highest total score per decision
  const optimalPathIds = useMemo(() => {
    if (!showOptimal) return new Set();
    const ids = new Set();
    decisionPoints.forEach((d) => {
      let best = null;
      let bestScore = -Infinity;
      (d.options || []).forEach((o) => {
        const s = Object.values(o.score_impact || {}).reduce((a, b) => a + b, 0);
        if (s > bestScore) { bestScore = s; best = o; }
      });
      if (best) ids.add(`${d.id}:${best.id}`);
    });
    return ids;
  }, [decisionPoints, showOptimal]);

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="decision-sim">
      {/* Scenario context + initial data */}
      {!history.length && scenarioContext && (
        <div className="glass-card rounded-2xl p-5 sm:p-7 animate-vv-fade-up" data-testid="decision-context">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-[10px] font-mono uppercase tracking-[0.2em] mb-4">
            <GitBranch size={11} /> Scenario
          </div>
          <p className="text-base sm:text-lg font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
            {scenarioContext}
          </p>
        </div>
      )}

      {!history.length && Object.keys(initialData).length > 0 && (
        <div className="glass-card rounded-2xl p-5 animate-vv-fade-up" data-testid="decision-initial-data">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
            Starting position
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(initialData).map(([k, v]) => (
              <div key={k} className="rounded-xl p-3 bg-[var(--color-surface)]/50 border border-[var(--color-border)]" data-testid={`decision-data-${k}`}>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">{k.replace(/_/g, ' ')}</div>
                <div className="font-clash text-sm font-semibold text-[var(--color-text)]">{String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History (timeline) */}
      {history.length > 1 && (
        <div className="glass-card rounded-2xl overflow-hidden" data-testid="decision-history">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-[var(--color-surface)]/40 transition-colors"
            data-testid="decision-history-toggle"
          >
            <div className="flex items-center gap-2">
              <History size={14} className="text-[var(--color-text-muted)]" />
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text)]">
                Decisions so far ({history.length - (isTerminal ? 0 : 1)})
              </span>
            </div>
            {historyOpen ? <ChevronUp size={14} className="text-[var(--color-text-muted)]" /> : <ChevronDown size={14} className="text-[var(--color-text-muted)]" />}
          </button>
          {historyOpen && (
            <div className="px-5 pb-4 space-y-3 border-t border-[var(--color-border)] pt-3">
              {history.slice(0, isTerminal ? undefined : -1).map((h, i) => (
                <div key={i} className="flex items-start gap-3" data-testid={`decision-history-item-${i}`}>
                  <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">{h.decision?.title || h.decision?.id}</div>
                    <div className="text-sm font-bricolage text-[var(--color-text)] truncate">→ {h.option?.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Terminal outcome */}
      {isTerminal && outcome && (
        <div className="space-y-5 animate-vv-fade-up" data-testid="decision-outcome">
          <div className="rounded-2xl p-6 sm:p-7 bg-gradient-to-br from-[var(--color-primary)]/10 via-[var(--color-accent-purple)]/10 to-transparent border border-[var(--color-primary)]/30">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-surface)]/80 border border-[var(--color-border)] text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text)] mb-4">
              <Target size={11} /> Final outcome
            </div>
            <h3 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-3" data-testid="decision-outcome-label">
              {outcome.label || 'Outcome'}
            </h3>
            {outcome.narrative && (
              <p className="text-sm sm:text-base font-bricolage text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap" data-testid="decision-outcome-narrative">
                {outcome.narrative}
              </p>
            )}
          </div>

          {Object.keys(scores).length > 0 && (
            <div className="glass-card rounded-2xl p-5" data-testid="decision-scores">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">Score breakdown</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(scores).map(([dim, val]) => (
                  <div key={dim} className="rounded-xl p-3 bg-[var(--color-surface)]/60 border border-[var(--color-border)]" data-testid={`decision-score-${dim}`}>
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">{dim.replace(/_/g, ' ')}</div>
                    <div className={`font-clash text-lg font-bold ${val >= 0 ? 'text-[var(--color-success)]' : 'text-[#EF4444]'}`}>
                      {val > 0 ? '+' : ''}{val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={() => setShowOptimal((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition-all"
              data-testid="decision-toggle-optimal"
            >
              <Eye size={13} /> {showOptimal ? 'Hide' : 'See'} optimal path
            </button>
            <button
              onClick={() => onComplete({
                tasks_completed: history.length,
                tasks_total: decisionPoints.length,
                accuracy: Math.max(0, Math.min(1, (outcome.total ?? 0) / Math.max(1, (scoring.max_total || decisionPoints.length * 2)))),
              })}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
              data-testid="decision-complete"
            >
              Complete Simulation <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Active decision */}
      {!isTerminal && current && (
        <div className="space-y-4 animate-vv-fade-up" key={current.id} data-testid="decision-current">
          <div className="glass-card rounded-2xl p-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)] text-[10px] font-mono uppercase tracking-[0.2em] mb-4">
              <GitBranch size={11} /> {current.title || `Decision ${history.length + 1}`}
            </div>
            <p className="text-base sm:text-lg font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap" data-testid="decision-narrative">
              {current.narrative}
            </p>
          </div>

          {!revealed && (
            <div className="space-y-3">
              {(current.options || []).map((opt) => {
                const isOptimal = optimalPathIds.has(`${current.id}:${opt.id}`);
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-left glass-card rounded-2xl p-5 hover:border-[var(--color-primary)]/40 hover:shadow-[0_0_24px_rgba(36,107,253,0.15)] hover:-translate-y-0.5 transition-all group ${
                      isOptimal ? 'ring-2 ring-[var(--color-success)]/50' : ''
                    }`}
                    data-testid={`decision-option-${opt.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-sm font-bold text-[var(--color-text-muted)] group-hover:bg-[var(--color-primary)] group-hover:text-white group-hover:border-[var(--color-primary)] transition-all shrink-0">
                        {opt.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-clash text-base font-semibold text-[var(--color-text)] mb-1 flex items-center gap-2">
                          {opt.label}
                          {isOptimal && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-[0.15em] text-[var(--color-success)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 rounded-full px-2 py-0.5">
                              <CheckCircle2 size={9} /> Optimal
                            </span>
                          )}
                        </div>
                        {opt.description && (
                          <p className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                            {opt.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {revealed && lastEntry && !isTerminal && (
            <div className="space-y-4 animate-vv-slide-in">
              <div className="rounded-2xl p-5 bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/30" data-testid="decision-consequence">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-[var(--color-accent-purple)]" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent-purple)]">Consequence</span>
                </div>
                <p className="text-sm sm:text-base font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
                  {lastEntry.option.consequence || 'The story unfolds…'}
                </p>
                {lastEntry.option.score_impact && Object.keys(lastEntry.option.score_impact).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-accent-purple)]/20 flex flex-wrap gap-2">
                    {Object.entries(lastEntry.option.score_impact).map(([dim, val]) => (
                      <span
                        key={dim}
                        className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.12em] rounded-full px-2.5 py-1 border ${
                          val >= 0
                            ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]/25 text-[var(--color-success)]'
                            : 'bg-[#EF4444]/10 border-[#EF4444]/25 text-[#EF4444]'
                        }`}
                        data-testid={`decision-impact-${dim}`}
                      >
                        {dim.replace(/_/g, ' ')} {val > 0 ? '+' : ''}{val}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleContinue}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
                  data-testid="decision-continue"
                >
                  Continue <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

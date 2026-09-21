/**
 * MockExamResultPage, shows score, pass/fail, and per-question review.
 * Route: /module/:moduleId/mock-exam/result
 * Receives result + exam via location.state from MockExamPage submit.
 */
import { useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import {
  CheckCircle2, XCircle, ClipboardList, RotateCcw, ChevronDown, ChevronUp,
  Home, Target, Trophy, ArrowRight,
} from 'lucide-react';

function pad(n) { return String(n).padStart(2, '0'); }
function fmtSecs(s) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${pad(sec)}s`;
  return `${m}m ${pad(sec)}s`;
}

function ScoreRing({ score, passed }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = circ * (score / 100);
  const color = passed ? 'var(--color-success)' : '#ef4444';
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="rotate-[-90deg]">
      <circle cx="70" cy="70" r={r} fill="none" strokeWidth="10" stroke="var(--color-border)" />
      <circle
        cx="70" cy="70" r={r}
        fill="none" strokeWidth="10"
        stroke={color}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
    </svg>
  );
}

export default function MockExamResultPage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const result = location.state?.result;
  const exam = location.state?.exam;

  const [expandedQs, setExpandedQs] = useState({});

  if (!result) {
    return (
      <div className="flex min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center pt-16 lg:pt-0">
          <div className="text-center">
            <p className="text-sm text-[var(--color-text-muted)] mb-4">No result data found.</p>
            <Link to={`/module/${moduleId}/mock-exam/start`} className="text-[var(--color-primary)] text-sm hover:underline">
              Go back to exam start
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { score, correct_count, total_questions, passed, pass_percentage, review = [] } = result;

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative">
      <div className={`absolute inset-0 ${passed ? 'bg-[var(--color-success)]' : 'bg-red-500'} opacity-[0.02] pointer-events-none`} />
      <Sidebar />

      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12">

          {/* Result hero */}
          <div className="text-center mb-10" data-testid="mock-exam-result-hero">
            <div className="relative inline-flex items-center justify-center mb-4">
              <ScoreRing score={score} passed={passed} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-clash text-3xl font-bold text-[var(--color-text)]" data-testid="mock-exam-result-score">
                  {score}%
                </span>
                <span className="text-[9px] font-mono uppercase text-[var(--color-text-muted)]">Score</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mb-3">
              {passed ? (
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 text-[var(--color-success)] text-sm font-semibold" data-testid="mock-exam-result-badge">
                  <CheckCircle2 size={16} /> Passed
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold" data-testid="mock-exam-result-badge">
                  <XCircle size={16} /> Not yet
                </span>
              )}
            </div>
            <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-2">
              {passed ? 'Well done!' : 'Keep practising'}
            </h1>
            <p className="text-[var(--color-text-muted)] text-sm">
              {passed
                ? `You scored ${score}% and cleared the ${pass_percentage}% pass mark.`
                : `You scored ${score}%. You need ${pass_percentage}% to pass. You can retake anytime.`}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-8" data-testid="mock-exam-result-stats">
            {[
              { label: 'Correct', value: correct_count, color: 'text-[var(--color-success)]' },
              { label: 'Incorrect', value: total_questions - correct_count, color: 'text-red-400' },
              { label: 'Total', value: total_questions, color: 'text-[var(--color-text)]' },
              { label: 'Pass mark', value: `${pass_percentage}%`, color: 'text-[var(--color-text-muted)]' },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-xl p-4 text-center">
                <p className={`font-clash text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Module Complete banner, only on pass */}
          {passed && (
            <div
              className="rounded-2xl p-5 mb-8 bg-gradient-to-r from-[#F59E0B]/15 via-[var(--color-success)]/10 to-[#F59E0B]/15 border border-[#F59E0B]/30 flex flex-col sm:flex-row items-center gap-4"
              data-testid="module-complete-banner"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#F59E0B]/20 flex items-center justify-center">
                <Trophy size={22} className="text-[#F59E0B]" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-clash text-base font-bold text-[var(--color-text)]">Module Complete!</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Your module has been marked complete and the next module is now unlocked on your dashboard.
                </p>
              </div>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F59E0B] text-white text-sm font-semibold hover:brightness-110 transition-all flex-shrink-0"
                data-testid="module-complete-dashboard-btn"
              >
                Continue <ArrowRight size={14} />
              </Link>
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex items-center gap-3 mb-10 flex-wrap">
            <button
              onClick={() => navigate(`/module/${moduleId}/mock-exam/start`)}
              data-testid="mock-exam-retake-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/40 transition-all"
            >
              <RotateCcw size={14} /> Retake exam
            </button>
            {!passed && (
              <Link
                to="/dashboard"
                data-testid="mock-exam-dashboard-btn"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold hover:brightness-110 transition-all"
              >
                <Home size={14} /> Dashboard
              </Link>
            )}
          </div>

          {/* Question review */}
          {review.length > 0 && (
            <div data-testid="mock-exam-review">
              <h2 className="font-clash text-xl font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
                <ClipboardList size={18} /> Question Review
              </h2>
              <div className="space-y-2">
                {review.map((item, i) => {
                  const open = expandedQs[i];
                  return (
                    <div
                      key={item.question_id}
                      className={`border rounded-xl overflow-hidden transition-all ${
                        item.is_correct
                          ? 'border-[var(--color-success)]/30'
                          : 'border-red-500/30'
                      }`}
                      data-testid={`review-q-${i + 1}`}
                    >
                      <button
                        onClick={() => setExpandedQs((p) => ({ ...p, [i]: !p[i] }))}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface)]/50 transition-colors"
                      >
                        <span className="flex-shrink-0">
                          {item.is_correct
                            ? <CheckCircle2 size={15} className="text-[var(--color-success)]" />
                            : <XCircle size={15} className="text-red-400" />}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--color-text-muted)] w-8 flex-shrink-0">Q{i + 1}</span>
                        {item.topic_tag && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-accent-purple)]/15 text-[var(--color-accent-purple)] flex-shrink-0">
                            {item.topic_tag}
                          </span>
                        )}
                        <span className="flex-1 text-xs text-[var(--color-text)] line-clamp-1 min-w-0">{item.question}</span>
                        {open ? <ChevronUp size={13} className="text-[var(--color-text-muted)]" /> : <ChevronDown size={13} className="text-[var(--color-text-muted)]" />}
                      </button>

                      {open && (
                        <div className="border-t border-[var(--color-border)] p-4 space-y-3">
                          <p className="text-sm text-[var(--color-text)] font-bricolage">{item.question}</p>
                          <div className="space-y-1.5">
                            {(item.options || []).map((opt, oi) => {
                              const isSelected = item.selected === oi;
                              const isCorrect = item.correct_answer_index === oi;
                              return (
                                <div
                                  key={oi}
                                  className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
                                    isCorrect
                                      ? 'bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 text-[var(--color-text)]'
                                      : isSelected
                                      ? 'bg-red-500/10 border border-red-500/30 text-[var(--color-text)]'
                                      : 'text-[var(--color-text-muted)]'
                                  }`}
                                >
                                  <span className="font-mono font-bold w-4">{String.fromCharCode(65 + oi)}.</span>
                                  <span className="flex-1">{opt}</span>
                                  {isCorrect && <CheckCircle2 size={12} className="text-[var(--color-success)] flex-shrink-0" />}
                                  {isSelected && !isCorrect && <XCircle size={12} className="text-red-400 flex-shrink-0" />}
                                </div>
                              );
                            })}
                          </div>
                          {item.explanation && (
                            <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2">
                              <p className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] mb-1">Explanation</p>
                              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{item.explanation}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

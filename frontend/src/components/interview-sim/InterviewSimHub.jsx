import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Briefcase, Lock, Loader2, MapPin, Banknote,
  CheckCircle2, XCircle, PlayCircle, AlertCircle, Trophy,
} from 'lucide-react';
import Sidebar from '../Sidebar';
import { interviewSimFetch } from '../../utils/interviewSim';
import { FirmLogo } from './simShared';
import { toast } from 'sonner';

function StatusChip({ firm }) {
  if (firm.in_progress_attempt_id) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 text-[var(--color-primary)]" data-testid={`firm-status-${firm.firm_slug}`}>
        <PlayCircle size={11} /> In progress
      </span>
    );
  }
  if (firm.best_verdict === 'offer') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 text-[var(--color-success)]" data-testid={`firm-status-${firm.firm_slug}`}>
        <Trophy size={11} /> Offer received
      </span>
    );
  }
  if (firm.best_verdict === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-red-500/10 border border-red-500/30 text-red-400" data-testid={`firm-status-${firm.firm_slug}`}>
        <XCircle size={11} /> Not selected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]" data-testid={`firm-status-${firm.firm_slug}`}>
      Not applied
    </span>
  );
}

export default function InterviewSimHub() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(null);

  useEffect(() => {
    let alive = true;
    interviewSimFetch('/api/interview-sim/overview')
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  const startOrResume = async (firm) => {
    if (firm.in_progress_attempt_id) {
      navigate(`/interview-sim/${firm.in_progress_attempt_id}`);
      return;
    }
    setStarting(firm.id);
    try {
      const r = await interviewSimFetch('/api/interview-sim/start', {
        method: 'POST',
        body: JSON.stringify({ sim_id: firm.id }),
      });
      navigate(`/interview-sim/${r.attempt_id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStarting(null);
    }
  };

  const viewResult = (firm) => {
    const last = [...(firm.my_attempts || [])].reverse().find((a) => a.status === 'completed');
    if (last) navigate(`/interview-sim/${last.id}`);
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative">
      <div className="absolute top-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.05] blur-[140px] pointer-events-none" />
      <Sidebar />
      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group font-bricolage" data-testid="hub-back-dashboard">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Dashboard
          </Link>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-[10px] font-mono uppercase tracking-[0.2em] mb-4">
              <Briefcase size={12} /> Module 20 · Final Round
            </div>
            <h1 className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="hub-title">
              Interview Simulations
            </h1>
            <p className="text-[var(--color-text-muted)] font-bricolage max-w-2xl">
              Five real hiring processes, end to end — application, online aptitude test, HR &amp; technical
              interviews (answer by voice), and a live case-modelling round. AI evaluates you at every step,
              exactly like a top-firm recruiting committee would.
            </p>
          </div>

          {!data && !error && (
            <div className="flex items-center gap-3 text-[var(--color-text-muted)] py-16 justify-center" data-testid="hub-loading">
              <Loader2 size={18} className="animate-spin" /> Loading careers portal…
            </div>
          )}
          {error && (
            <div className="glass-card rounded-2xl p-6 flex items-center gap-3 text-sm text-[var(--color-error)]" data-testid="hub-error">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {data && (
            <>
              {!data.unlocked && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/8 px-5 py-4 mb-6 flex items-start gap-3" data-testid="hub-locked-banner">
                  <Lock size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bricolage font-semibold text-[var(--color-text)]">
                      Finish all Module 20 video lectures to unlock the simulations
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      {data.videos_done}/{data.videos_total} sessions completed
                    </p>
                    <div className="h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden mt-2 max-w-xs">
                      <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${data.videos_total ? Math.round((data.videos_done / data.videos_total) * 100) : 0}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {data.unlocked && (
                <div className="glass-card rounded-2xl px-5 py-4 mb-6 flex items-center justify-between gap-3" data-testid="hub-progress-banner">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${data.sims_completed === data.sims_total ? 'bg-[var(--color-success)]/15 border-[var(--color-success)]/30 text-[var(--color-success)]' : 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/30 text-[var(--color-primary)]'}`}>
                      {data.sims_completed === data.sims_total ? <CheckCircle2 size={18} /> : <Briefcase size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-bricolage font-semibold text-[var(--color-text)]">
                        {data.sims_completed === data.sims_total
                          ? 'All 5 processes complete — Module 20 finished!'
                          : `${data.sims_completed}/${data.sims_total} interview processes completed`}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Complete all 5 to finish Module 20. Each firm allows a maximum of 2 attempts.
                      </p>
                    </div>
                  </div>
                  <span className="font-clash text-2xl font-bold text-[var(--color-text)] shrink-0" data-testid="hub-sims-count">
                    {data.sims_completed}<span className="text-sm text-[var(--color-text-muted)]">/{data.sims_total}</span>
                  </span>
                </div>
              )}

              <div className="space-y-3" data-testid="hub-firm-list">
                {data.firms.map((firm) => {
                  const canApply = data.unlocked && (firm.in_progress_attempt_id || firm.attempts_left > 0);
                  const hasResult = (firm.my_attempts || []).some((a) => a.status === 'completed');
                  return (
                    <div
                      key={firm.id}
                      className={`glass-card rounded-2xl p-5 sm:p-6 transition-all ${!data.unlocked ? 'opacity-60' : ''}`}
                      style={{ borderLeft: `3px solid ${firm.brand?.accent || 'var(--color-border)'}` }}
                      data-testid={`firm-card-${firm.firm_slug}`}
                    >
                      <div className="flex items-start gap-4">
                        <FirmLogo brand={firm.brand} size={52} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-clash text-lg font-semibold text-[var(--color-text)]">{firm.firm_name}</h3>
                            <StatusChip firm={firm} />
                          </div>
                          <p className="text-sm font-bricolage text-[var(--color-text)] mb-1.5">{firm.role_title}</p>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[var(--color-text-muted)]">
                            <span className="inline-flex items-center gap-1"><MapPin size={11} /> {firm.location}</span>
                            <span className="inline-flex items-center gap-1"><Banknote size={11} /> {firm.salary_band}</span>
                            <span>{firm.brand?.tagline}</span>
                          </div>
                          {firm.attempts_used > 0 && (
                            <p className="text-[10px] font-mono text-[var(--color-text-faint)] mt-2">
                              Attempts used: {firm.attempts_used}/2
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {!data.unlocked ? (
                            <Lock size={16} className="text-[var(--color-text-faint)] mt-2" />
                          ) : (
                            <>
                              {canApply && (
                                <button
                                  onClick={() => startOrResume(firm)}
                                  disabled={starting === firm.id}
                                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all disabled:opacity-50"
                                  style={{ background: firm.brand?.accent || 'var(--color-primary)' }}
                                  data-testid={`firm-apply-${firm.firm_slug}`}
                                >
                                  {starting === firm.id ? <Loader2 size={14} className="animate-spin" /> : null}
                                  {firm.in_progress_attempt_id ? 'Resume process' : firm.attempts_used > 0 ? 'Re-apply' : 'Apply now'}
                                  <ArrowRight size={14} />
                                </button>
                              )}
                              {hasResult && (
                                <button
                                  onClick={() => viewResult(firm)}
                                  className="text-[11px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                                  data-testid={`firm-view-result-${firm.firm_slug}`}
                                >
                                  View last result →
                                </button>
                              )}
                              {!canApply && !firm.in_progress_attempt_id && firm.attempts_left === 0 && (
                                <span className="text-[10px] font-mono text-[var(--color-text-faint)]">No attempts left</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

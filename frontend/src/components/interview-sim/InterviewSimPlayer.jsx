import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, MapPin, Banknote } from 'lucide-react';
import Sidebar from '../Sidebar';
import { interviewSimFetch } from '../../utils/interviewSim';
import { FirmLogo, StageTracker } from './simShared';
import ApplicationStage from './ApplicationStage';
import AptitudeStage from './AptitudeStage';
import InterviewStage from './InterviewStage';
import CaseStage from './CaseStage';
import DecisionStage from './DecisionStage';

export default function InterviewSimPlayer() {
  const { attemptId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const d = await interviewSimFetch(`/api/interview-sim/attempt/${attemptId}`);
      setData(d);
    } catch (e) {
      setError(e.message);
    }
  }, [attemptId]);

  useEffect(() => { refresh(); }, [refresh]);

  const attempt = data?.attempt;
  const sim = data?.sim;
  const stage = attempt?.current_stage;

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative">
      <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[140px] pointer-events-none" />
      <Sidebar />
      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <Link to="/interview-sims" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 group font-bricolage" data-testid="player-back-hub">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> All openings
          </Link>

          {!data && !error && (
            <div className="flex items-center gap-3 text-[var(--color-text-muted)] py-16 justify-center" data-testid="player-loading">
              <Loader2 size={18} className="animate-spin" /> Loading your process…
            </div>
          )}
          {error && (
            <div className="glass-card rounded-2xl p-6 flex items-center gap-3 text-sm text-[var(--color-error)]" data-testid="player-error">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {data && (
            <>
              {/* Firm header */}
              <div className="glass-card rounded-2xl p-5 sm:p-6 mb-5" style={{ borderLeft: `3px solid ${sim.brand?.accent || 'var(--color-border)'}` }} data-testid="player-firm-header">
                <div className="flex items-center gap-4 mb-4">
                  <FirmLogo brand={sim.brand} size={48} />
                  <div className="min-w-0 flex-1">
                    <h1 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)]" data-testid="player-firm-name">
                      {sim.firm_name}
                    </h1>
                    <p className="text-sm font-bricolage text-[var(--color-text-muted)]">{sim.role_title}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-[var(--color-text-faint)] mt-0.5">
                      <span className="inline-flex items-center gap-1"><MapPin size={10} /> {sim.location}</span>
                      <span className="inline-flex items-center gap-1"><Banknote size={10} /> {sim.salary_band}</span>
                      <span>Attempt {attempt.attempt_number}/2</span>
                    </div>
                  </div>
                </div>
                <StageTracker currentStage={stage} stageData={attempt.stage_data} verdict={attempt.verdict} />
              </div>

              {/* Active stage */}
              {stage === 'application' && <ApplicationStage attempt={attempt} sim={sim} onAdvance={refresh} />}
              {stage === 'aptitude' && <AptitudeStage attempt={attempt} sim={sim} onAdvance={refresh} />}
              {(stage === 'behavioural' || stage === 'technical') && (
                <InterviewStage key={stage} stage={stage} attempt={attempt} sim={sim} onAdvance={refresh} />
              )}
              {stage === 'case_study' && <CaseStage attempt={attempt} sim={sim} onAdvance={refresh} />}
              {stage === 'decision' && <DecisionStage attempt={attempt} sim={sim} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

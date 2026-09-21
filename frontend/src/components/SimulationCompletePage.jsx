import { useMemo, useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowRight, Trophy, Sparkles, Target, CheckCircle2, TrendingUp, Wrench,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getNextPhaseRoute } from '../utils/progress';

function CircularScore({ accuracy, passed }) {
  const pct = Math.round((accuracy || 0) * 100);
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = passed ? 'var(--color-success)' : 'var(--color-primary)';

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-clash text-4xl font-bold text-[var(--color-text)]" data-testid="simulation-score-pct">{pct}%</div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mt-1">
          Accuracy
        </div>
      </div>
    </div>
  );
}

function overallFeedback(accuracy) {
  if (accuracy >= 0.85) {
    return {
      title: 'Analyst-grade work.',
      body: 'You executed this scenario with real precision. Translate this into your next deal prep.',
      tone: 'success',
    };
  }
  if (accuracy >= 0.6) {
    return {
      title: 'Solid effort.',
      body: 'You\'ve got the instincts. Tighten the edges and this becomes interview-ready.',
      tone: 'primary',
    };
  }
  return {
    title: 'Every rep compounds.',
    body: 'The best analysts iterate. Review the concepts and run this one again, you\'ll feel the difference.',
    tone: 'amber',
  };
}

export default function SimulationCompletePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { tasks_completed = 0, tasks_total = 0, accuracy = 0, sim_type, title } = location.state || {};
  const hasState = !!location.state;

  // If user lands here by refresh/direct-nav with no state, bounce to session complete
  useEffect(() => {
    if (!hasState) {
      navigate(`/session/${sessionId}/complete`, { replace: true });
    }
  }, [hasState, navigate, sessionId]);

  const passed = accuracy >= 0.7;
  const feedback = useMemo(() => overallFeedback(accuracy), [accuracy]);
  const [nextRoute, setNextRoute] = useState({ phase: null, route: 'complete', label: 'Session' });

  useEffect(() => {
    if (!hasState) return;
    let mounted = true;
    async function loadNext() {
      const { data: sess } = await supabase
        .from('user_sessions')
        .select('notes_completed, quiz_completed, interview_completed, simulation_completed')
        .eq('id', sessionId)
        .maybeSingle();
      if (mounted && sess) {
        setNextRoute(getNextPhaseRoute(sess, 'simulation'));
      }
    }
    loadNext();
    return () => { mounted = false; };
  }, [hasState, sessionId]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden px-4 py-10 sm:py-14">
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.06] blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto" data-testid="simulation-complete-content">
        <div className="text-center mb-10">
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-[0.2em] mb-5 ${
              passed
                ? 'bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)]'
                : 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)]'
            }`}
            data-testid="simulation-complete-badge"
          >
            {passed ? <Trophy size={12} /> : <Sparkles size={12} />}
            Simulation complete
          </div>

          <h1 className="font-clash text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-3" data-testid="simulation-complete-title">
            {feedback.title}
          </h1>
          {title && (
            <p className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-3" data-testid="simulation-complete-sim-title">
              {title}
            </p>
          )}
          <p className="text-[var(--color-text-muted)] font-bricolage mb-8 max-w-md mx-auto leading-relaxed" data-testid="simulation-complete-subtitle">
            {feedback.body}
          </p>

          <CircularScore accuracy={accuracy} passed={passed} />

          {tasks_total > 0 && (
            <div className="mt-5 text-sm text-[var(--color-text-muted)] font-bricolage" data-testid="simulation-score-summary">
              <span className="font-semibold text-[var(--color-text)]">{tasks_completed} / {tasks_total}</span> correct
            </div>
          )}
        </div>

        {/* Performance summary */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 mb-8" data-testid="simulation-summary">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--color-border)]">
            <TrendingUp size={14} className="text-[var(--color-primary)]" />
            <h3 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
              Performance summary
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl p-3 bg-[var(--color-surface)]/60 border border-[var(--color-border)]">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Completed</div>
              <div className="font-clash text-xl font-bold text-[var(--color-text)]" data-testid="simulation-summary-completed">{tasks_completed}</div>
            </div>
            <div className="rounded-xl p-3 bg-[var(--color-surface)]/60 border border-[var(--color-border)]">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Total</div>
              <div className="font-clash text-xl font-bold text-[var(--color-text)]" data-testid="simulation-summary-total">{tasks_total}</div>
            </div>
            <div className="rounded-xl p-3 bg-[var(--color-surface)]/60 border border-[var(--color-border)] col-span-2 sm:col-span-1">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Accuracy</div>
              <div className="font-clash text-xl font-bold text-[var(--color-text)]" data-testid="simulation-summary-accuracy">
                {Math.round((accuracy || 0) * 100)}%
              </div>
            </div>
          </div>
          {sim_type && (
            <div className="mt-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]" data-testid="simulation-summary-type">
              <Target size={11} />
              Simulation type: {sim_type.replace(/_/g, ' ')}
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3" data-testid="simulation-complete-ctas">
          <button
            onClick={() => navigate(`/session/${sessionId}/${nextRoute.route}`)}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all"
            data-testid="simulation-continue-session"
          >
            {nextRoute.phase ? `Continue to ${nextRoute.label}` : 'Complete Session'} <ArrowRight size={16} />
          </button>
          <button
            onClick={() => navigate(`/session/${sessionId}/simulation`)}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
            data-testid="simulation-retry"
          >
            <Wrench size={15} /> Run Simulation Again
          </button>
          <Link
            to="/dashboard"
            className="text-center text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] font-mono mt-1"
            data-testid="simulation-back-dashboard"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

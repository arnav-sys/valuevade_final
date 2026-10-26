import { useEffect, useState } from 'react';
import { Navigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import useSessionTimer from '../utils/useSessionTimer';

/**
 * Guards individual phase routes inside a session.
 * If an earlier phase in PHASE_ORDER is incomplete, redirects to that phase
 * instead of letting the user skip ahead via direct URL.
 *
 * Ordering: quiz requires notes completed first.
 * Simulation has no prerequisite — users can access it at any time.
 * This matches the product spec: notes completion marks a session done;
 * quiz and simulation are optional bonus activities accessible any time.
 */
const PREV_PHASE = {
  notes: null,
  quiz: 'notes',
  interview: 'quiz',
  simulation: null,  // simulation is always accessible — no notes/quiz prerequisite
};

const PHASE_ROUTE = {
  notes: 'notes',
  quiz: 'quiz/start',
  interview: 'simulation/start',
  simulation: 'simulation/start',
};

export default function SessionPhaseGuard({ phase, children }) {
  const { sessionId } = useParams();
  const location = useLocation();
  const [state, setState] = useState({ checking: true, redirectTo: null });

  // Batch 2 (Item 1): mount the hidden wall-clock timer for this phase.
  // It accumulates real active time into sessionStorage so the
  // SessionCompletePage can read the true minutes spent.
  useSessionTimer(sessionId, phase);

  useEffect(() => {
    let mounted = true;
    async function check() {
      if (!sessionId || !phase) {
        if (mounted) setState({ checking: false, redirectTo: null });
        return;
      }
      const prev = PREV_PHASE[phase];
      if (!prev) {
        if (mounted) setState({ checking: false, redirectTo: null });
        return;
      }
      try {
        const { data } = await supabase
          .from('user_sessions')
          .select('notes_completed, quiz_completed, interview_completed, simulation_completed')
          .eq('id', sessionId)
          .maybeSingle();
        if (!mounted) return;
        const prevDone = data?.[`${prev}_completed`];
        if (!prevDone) {
          setState({ checking: false, redirectTo: `/session/${sessionId}/${PHASE_ROUTE[prev]}` });
          return;
        }
        setState({ checking: false, redirectTo: null });
      } catch {
        if (mounted) setState({ checking: false, redirectTo: null });
      }
    }
    check();
    return () => { mounted = false; };
  }, [sessionId, phase]);

  if (state.checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]" data-testid="phase-guard-loading">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] animate-spin" />
      </div>
    );
  }

  if (state.redirectTo && state.redirectTo !== location.pathname) {
    return <Navigate to={state.redirectTo} replace />;
  }

  return children;
}

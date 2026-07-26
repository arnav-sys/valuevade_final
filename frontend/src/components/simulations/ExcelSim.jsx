import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { adaptSimToWorkbook } from './excelSimAdapter';
import SpreadsheetSim from './UniverSpreadsheet';
import AskPariButton from '../tutor/AskPariButton';
import { supabase } from '../../lib/supabase';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

// Batch 5 — Thin entry point that adapts the master_simulations.config into
// the canonical workbook shape and mounts the new mini-spreadsheet.
//
// Props (unchanged contract with SimulationPage):
//   config      — master_simulations.config (any of the 3 known shapes)
//   title       — sim.title
//   sim         — the full master_simulations row (we need id for persistence)
//   onProgress  — incremental progress callback (kept for compatibility)
//   onComplete  — called on submit; receives { tasks_completed, tasks_total, accuracy }

export default function ExcelSim({ config, title, sim, onProgress, onComplete }) {
  const { sessionId } = useParams();
  const [workbook, setWorkbook] = useState(null);
  const [restored, setRestored] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pariFocus, setPariFocus] = useState(null);

  const simId = sim?.id || null;

  // Adapt the master config → canonical workbook shape on mount.
  useEffect(() => {
    try {
      const wb = adaptSimToWorkbook({ ...sim, config, title });
      // Override the header.category if the parent already passes a richer title.
      if (title && !wb.header.category) wb.header.category = title;
      setWorkbook(wb);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ExcelSim] adapter failed:', e);
      setError('Could not load this simulation. The data shape is malformed.');
    }
  }, [config, title, sim]);

  // Restore any persisted workbook for this user + sim.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!simId) { setLoading(false); return; }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) { setLoading(false); return; }
        const url = `${BACKEND}/api/simulations/workbook?master_simulation_id=${encodeURIComponent(simId)}`
          + (sessionId ? `&user_session_id=${encodeURIComponent(sessionId)}` : '');
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const j = await res.json();
          if (alive && j.found && j.workbook_state) setRestored(j.workbook_state);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [simId, sessionId]);

  const handleAutoSave = useCallback(async (workbookState) => {
    if (!simId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      await fetch(`${BACKEND}/api/simulations/workbook/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          master_simulation_id: simId,
          user_session_id: sessionId || null,
          workbook_state: workbookState,
          status: 'in_progress',
        }),
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[ExcelSim] autosave failed:', e);
    }
  }, [simId, sessionId]);

  const handleSubmit = useCallback(async (workbookState, score) => {
    // Persist as submitted.
    if (simId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          await fetch(`${BACKEND}/api/simulations/workbook/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              master_simulation_id: simId,
              user_session_id: sessionId || null,
              workbook_state: workbookState,
              status: 'submitted',
              last_score: score,
            }),
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ExcelSim] submit save failed:', e);
      }
    }
    // Bridge to the existing handleComplete contract.
    let tasksCompleted = 0;
    let tasksTotal = 0;
    let accuracy = 1.0; // free-form: full credit on submit
    if (score) {
      const cells = Object.values(score.per_cell || {});
      tasksCompleted = cells.filter((v) => v === 'pass').length;
      tasksTotal = cells.length;
      accuracy = tasksTotal > 0 ? (tasksCompleted / tasksTotal) : 1.0;
    }
    if (onProgress) onProgress({ tasks_completed: tasksCompleted, tasks_total: tasksTotal, accuracy });
    if (onComplete) await onComplete({ tasks_completed: tasksCompleted, tasks_total: tasksTotal, accuracy });
  }, [simId, sessionId, onProgress, onComplete]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-6 flex items-center gap-3 text-sm text-[var(--color-text-muted)]" data-testid="excel-sim-loading">
        <Loader2 size={14} className="animate-spin" /> Loading simulation…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 px-5 py-4 text-sm text-[var(--color-error)] font-bricolage" data-testid="excel-sim-error">
        {error}
      </div>
    );
  }
  if (!workbook) return null;

  return (
    <div className="space-y-3" data-testid="excel-sim-root">
      <SpreadsheetSim
        workbook={workbook}
        restoredState={restored}
        onAutoSave={handleAutoSave}
        onSubmit={handleSubmit}
        onFocusChange={setPariFocus}
      />
      {/* Pari with cell-level current_focus (Batch 3 Item 2 + Batch 5). */}
      <div className="pt-2" data-testid="excel-sim-pari">
        <AskPariButton
          phase="simulation"
          courseSessionId={sessionId}
          variant="card"
          getCurrentFocus={() => {
            if (!pariFocus) return null;
            return {
              surface: 'simulation',
              session_id: sessionId,
              anchor: pariFocus,
            };
          }}
        />
      </div>
    </div>
  );
}

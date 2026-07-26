/**
 * Dev-only preview route for rendering any Simulation config directly by sim id.
 * Route: /_dev/sim/:simId  (or /_dev/sim/session/:sessionId to look up by session)
 * Public — no auth or phase gating. Used for QA smoke tests.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import HyperFormulaSpreadsheet from './simulations/UniverSpreadsheet';
import DecisionMakingSim from './simulations/DecisionMakingSim';
import BookSim from './simulations/BookSim';
import DocumentSim from './simulations/DocumentSim';

export default function DevSimPreview() {
  const params = useParams();
  const [sim, setSim] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        let q;
        if (params.simId) {
          q = supabase.from('master_simulations').select('*').eq('id', params.simId).maybeSingle();
        } else if (params.sessionId) {
          q = supabase.from('master_simulations').select('*').eq('session_id', params.sessionId).limit(1).maybeSingle();
        } else {
          throw new Error('missing simId or sessionId in URL');
        }
        const { data, error } = await q;
        if (error) throw error;
        if (!data) throw new Error('no simulation found');
        setSim(data);
      } catch (e) {
        setErr(e.message || String(e));
      }
    })();
  }, [params.simId, params.sessionId]);

  if (err) return <div className="p-10 text-red-500 font-mono text-sm">Error: {err}</div>;
  if (!sim) return <div className="p-10 text-[var(--color-text-muted)] font-mono text-sm">Loading…</div>;

  const config = sim.config || {};
  const noop = () => Promise.resolve();

  // Excel workbook → wire into HyperFormulaSpreadsheet via a lightweight adapter
  // (mirrors excelSimAdapter shape but simpler).
  function buildWorkbook(cfg, title) {
    const src = cfg.multi_tab_excel_workbook || { sheets: [] };
    const expected = cfg.expected_answers || {};
    const sheets = (src.sheets || []).map((s) => {
      const cells = { ...(s.cells || {}) };
      // Attach expected metadata to editable cells
      Object.entries(expected).forEach(([addr, spec]) => {
        const [sheetName, cellAddr] = addr.split('!');
        if (sheetName !== s.name) return;
        const existing = cells[cellAddr] || {};
        cells[cellAddr] = {
          ...existing,
          expected: spec.expected_value,
          type: spec.type,
          tolerance: spec.tolerance,
          points: spec.points,
          readOnly: false,
          label: existing.label || spec.formula_pattern,
        };
      });
      return { name: s.name, cells, rowCount: 100, colCount: 26 };
    });
    return {
      header: {
        firm: cfg.firm || '',
        role: cfg.role || '',
        category: cfg.category || '',
        instructions: cfg.instructions || sim.instructions || '',
      },
      sheets,
      scoring: { mode: 'auto' },
      _title: title,
    };
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
          Dev sim preview · type: {sim.sim_type}{config?.format ? ` (format: ${config.format})` : ''}
        </div>
        <h1 className="font-clash text-2xl text-[var(--color-text)] font-bold" data-testid="dev-sim-title">
          {sim.title}
        </h1>
        {sim.sim_type === 'excel' && (
          <HyperFormulaSpreadsheet
            workbook={buildWorkbook(config, sim.title)}
            onAutoSave={noop}
            onSubmit={noop}
          />
        )}
        {sim.sim_type === 'decision_making' && (
          <DecisionMakingSim config={config} title={sim.title} onProgress={noop} onComplete={noop} />
        )}
        {sim.sim_type === 'document' && config?.format === 'book' && (
          <BookSim config={config} title={sim.title} onProgress={noop} onComplete={noop} />
        )}
        {sim.sim_type === 'document' && config?.format !== 'book' && (
          <DocumentSim config={config} title={sim.title} onProgress={noop} onComplete={noop} />
        )}
      </div>
    </div>
  );
}

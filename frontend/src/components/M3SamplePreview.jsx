// M3 Sample Preview Page, Step 4 review gate (NOT a production route).
// Reads the 3 generated samples and renders them through the same
// SpreadsheetSim component the live simulation phase uses.
//
// Url:  /m3-sample-preview          → tab through all 3
//       /m3-sample-preview?s=3.3   → directly open one
//
// This bypasses auth/enrollment because the goal is purely visual review
// before deciding whether to bulk-seed all 17 M3 sims.

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adaptSimToWorkbook } from '@/components/simulations/excelSimAdapter';
import SpreadsheetSim from '@/components/simulations/SpreadsheetSim';

// Static imports, webpack bundles the JSON at build time so this works
// even without backend.
import s33 from '@/data/m3-samples/s3-3.json';
import s35 from '@/data/m3-samples/s3-5.json';
import s36 from '@/data/m3-samples/s3-6.json';

const ALL = [
  { key: '3.3', label: '3.3 · early', tag: 'foundational',
    accent: '#3B82F6', icon: '📐', sample: s33 },
  { key: '3.5', label: '3.5 · mid',   tag: 'synthesis',
    accent: '#A855F7', icon: '🧠', sample: s35 },
  { key: '3.6', label: '3.6 · late',  tag: 'applied',
    accent: '#10B981', icon: '🔗', sample: s36 },
];

function workbookFromSample(sample) {
  // The sample JSON has the same shape as `master_simulations.config`,
  // the adapter consumes it directly.
  return adaptSimToWorkbook({
    title: sample.session_title,
    config: {
      multi_tab_excel_workbook: sample.multi_tab_excel_workbook,
      expected_answers: sample.expected_answers,
      instructions: `M3 sample, session ${sample.session}, slot: ${sample.slot}. ${sample.tagline}`,
    },
  });
}

export default function M3SamplePreview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = ALL.findIndex((x) => x.key === searchParams.get('s'));
  const [tab, setTab] = useState(initial >= 0 ? initial : 0);
  const current = ALL[tab];
  const workbook = useMemo(() => workbookFromSample(current.sample), [current]);

  useEffect(() => {
    setSearchParams({ s: current.key });
  }, [current.key, setSearchParams]);

  const ea = current.sample.expected_answers;
  const totalPoints = Object.values(ea).reduce((s, v) => s + (v.points || 0), 0);
  const corrections = current.sample.engine_corrections || [];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white p-4 sm:p-8" data-testid="m3-sample-preview">
      {/* Tabbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap" data-testid="sample-tabs">
        <h1 className="font-clash text-2xl font-semibold mr-4">M3 Sample Sims, Step 4 Review</h1>
        {ALL.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setTab(i)}
            data-testid={`tab-${s.key.replace('.', '-')}`}
            className={`px-4 py-2 rounded-xl font-mono text-xs border transition-all ${
              i === tab
                ? 'border-transparent text-black shadow-lg'
                : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white'
            }`}
            style={i === tab ? { backgroundColor: s.accent } : undefined}
          >
            <span className="mr-2">{s.icon}</span>{s.label} · {s.tag}
          </button>
        ))}
      </div>

      {/* Header card */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 mb-6" data-testid="sample-header">
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.2em] text-white/40">Session {current.sample.session} · {current.sample.slot}</div>
            <div className="font-clash text-xl font-semibold mt-1">{current.sample.session_title.split(': ').slice(1).join(': ')}</div>
            <div className="text-sm text-white/60 mt-1">{current.sample.tagline}</div>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/10">
              <span className="text-white/40">Points </span>
              <span className="text-white font-semibold">{totalPoints}</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/10">
              <span className="text-white/40">Questions </span>
              <span className="text-white font-semibold">{Object.keys(ea).length}</span>
            </span>
            <span className={`px-3 py-1 rounded-full border ${corrections.length === 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
              {corrections.length === 0 ? '✓ engine clean' : `↻ ${corrections.length} eng-fix`}
            </span>
          </div>
        </div>
      </div>

      {/* SpreadsheetSim, the actual student-facing renderer */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 mb-6" data-testid="sample-workspace">
        <SpreadsheetSim
          workbook={workbook}
          onAutoSave={async () => {}}
          onSubmit={async () => {}}
        />
      </div>

      {/* Expected answers table, for reviewer scrutiny */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6" data-testid="sample-answers">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-white/40 mb-4">
          Expected answers, what the auto-grader will accept
        </div>
        <div className="space-y-2">
          {Object.entries(ea).map(([key, spec], i) => (
            <div key={key} className="flex items-start gap-4 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
              <div className="font-mono text-xs text-white/40 w-12 shrink-0">Q{i + 1}</div>
              <div className="flex-1 min-w-0">
                <code className="text-xs text-emerald-300 font-mono break-all">{spec.formula_pattern}</code>
                <div className="text-xs text-white/50 mt-1">
                  → <span className="text-white font-semibold">{JSON.stringify(spec.expected_value)}</span>
                  <span className="text-white/30 ml-3">tol={spec.tolerance} · type={spec.type} · {spec.points}pt</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {corrections.length > 0 && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/80 mb-3">
              Engine validator overrode {corrections.length} LLM expected_value(s)
            </div>
            <div className="space-y-2 text-xs font-mono">
              {corrections.map((c, i) => (
                <div key={i} className="p-2 rounded bg-amber-500/[0.05] border border-amber-500/20">
                  <div className="text-white/60">{c.key}: <code className="text-amber-200">{c.formula}</code></div>
                  <div className="text-white/40 mt-1">
                    LLM said <span className="text-red-300">{JSON.stringify(c.llm_expected)}</span>
                    {' → '} engine computed <span className="text-emerald-300">{JSON.stringify(c.engine_computed ?? c.engine_returned)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

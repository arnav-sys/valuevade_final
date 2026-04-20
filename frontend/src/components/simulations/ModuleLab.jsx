import { useMemo, useState, useEffect } from 'react';
import {
  ArrowRight, ArrowLeft, CheckCircle2, Sliders, Grid3X3, GitBranch, Sparkles,
  TrendingUp, TrendingDown, Layers, BookOpen, Eye,
} from 'lucide-react';

/* =============================================================
   FORMULA REGISTRY — TVM math keyed by module id
   ============================================================= */

const POW = (b, e) => Math.pow(b, e);
const fmt = (n, d = 2) => {
  if (!isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
};
const fmtPct = (n, d = 1) => (isFinite(n) ? `${(n * 100).toFixed(d)}%` : '—');
const fmtInt = (n) => (isFinite(n) ? Math.round(n).toLocaleString() : '—');

const FORMULAS = {
  compound: ({ present_value, annual_rate, years }) => {
    const r = annual_rate / 100;
    const fv = present_value * POW(1 + r, years);
    return {
      future_value: { value: fmtInt(fv), numeric: fv, label: 'Future value (₹)', color: '#10B981', Icon: TrendingUp },
      compound_gain: { value: fmtInt(fv - present_value), numeric: fv - present_value, label: 'Compound gain (₹)', color: '#246BFD', Icon: Sparkles },
      rule_of_72: { value: r > 0 ? `${fmt(72 / (annual_rate), 1)} yrs` : '—', label: 'Rule of 72 (yrs to double)', color: '#FF6AC1', Icon: TrendingUp },
    };
  },
  discount: ({ future_value, discount_rate, years }) => {
    const r = discount_rate / 100;
    const pv = future_value / POW(1 + r, years);
    const melted = future_value > 0 ? 1 - pv / future_value : 0;
    return {
      present_value: { value: fmtInt(pv), numeric: pv, label: 'Present value (₹)', color: '#10B981', Icon: TrendingDown },
      pct_melted: { value: fmtPct(melted, 1), numeric: melted, label: 'Value melted away', color: '#FF6AC1', Icon: TrendingDown },
    };
  },
  bond: ({ face_value, coupon_rate, market_yield, maturity }) => {
    const c = face_value * (coupon_rate / 100);
    const y = market_yield / 100;
    let pv = 0;
    for (let t = 1; t <= maturity; t++) pv += c / POW(1 + y, t);
    pv += face_value / POW(1 + y, maturity);
    const status =
      coupon_rate > market_yield ? 'Premium' :
        coupon_rate < market_yield ? 'Discount' : 'Par';
    const statusColor = status === 'Premium' ? '#10B981' : status === 'Discount' ? '#EF4444' : '#246BFD';
    return {
      intrinsic_value: { value: fmtInt(pv), numeric: pv, label: 'Intrinsic value (₹)', color: '#10B981', Icon: TrendingUp },
      annual_coupon: { value: fmtInt(c), numeric: c, label: 'Annual coupon (₹)', color: '#246BFD', Icon: Sparkles },
      premium_discount_status: { value: status, label: 'Pricing status', color: statusColor, Icon: Layers },
    };
  },
  dcf: ({ year1_fcf, fcf_growth, wacc, projection_years, terminal_growth }) => {
    const g = fcf_growth / 100;
    const w = wacc / 100;
    const tg = terminal_growth / 100;
    let explicitPV = 0;
    let fcfN = year1_fcf;
    for (let t = 1; t <= projection_years; t++) {
      explicitPV += fcfN / POW(1 + w, t);
      fcfN = fcfN * (1 + g);
    }
    // Terminal value based on year N+1 FCF
    const tv = w > tg ? (fcfN / (w - tg)) : NaN;
    const terminalPV = isFinite(tv) ? tv / POW(1 + w, projection_years) : NaN;
    const total = explicitPV + (isFinite(terminalPV) ? terminalPV : 0);
    const terminalPct = total > 0 && isFinite(terminalPV) ? terminalPV / total : 0;
    return {
      explicit_pv: { value: fmtInt(explicitPV), numeric: explicitPV, label: 'Explicit PV (₹)', color: '#246BFD', Icon: TrendingUp },
      terminal_pv: { value: isFinite(terminalPV) ? fmtInt(terminalPV) : 'WACC ≤ g', numeric: terminalPV, label: 'Terminal PV (₹)', color: '#6A5CFF', Icon: Sparkles },
      total_value: { value: fmtInt(total), numeric: total, label: 'Total enterprise value (₹)', color: '#10B981', Icon: Layers },
      terminal_pct: { value: fmtPct(terminalPct, 0), numeric: terminalPct, label: 'Terminal weight', color: '#FF6AC1', Icon: TrendingUp },
    };
  },
};

// Input metadata: default, min, max, step, unit, label
const INPUT_META = {
  present_value: { default: 10000, min: 100, max: 1000000, step: 100, unit: '₹', label: 'Present value' },
  future_value: { default: 100000, min: 100, max: 10000000, step: 100, unit: '₹', label: 'Future value' },
  annual_rate: { default: 8, min: 0, max: 25, step: 0.1, unit: '%', label: 'Annual rate' },
  discount_rate: { default: 10, min: 0, max: 25, step: 0.1, unit: '%', label: 'Discount rate' },
  years: { default: 10, min: 1, max: 30, step: 1, unit: 'yrs', label: 'Years' },
  face_value: { default: 1000, min: 100, max: 100000, step: 100, unit: '₹', label: 'Face value' },
  coupon_rate: { default: 7, min: 0, max: 20, step: 0.1, unit: '%', label: 'Coupon rate' },
  market_yield: { default: 8, min: 0.5, max: 20, step: 0.1, unit: '%', label: 'Market yield' },
  maturity: { default: 5, min: 1, max: 30, step: 1, unit: 'yrs', label: 'Maturity' },
  year1_fcf: { default: 100, min: 10, max: 10000, step: 10, unit: '₹cr', label: 'Year 1 FCF' },
  fcf_growth: { default: 8, min: -10, max: 30, step: 0.5, unit: '%', label: 'FCF growth' },
  wacc: { default: 11, min: 1, max: 25, step: 0.25, unit: '%', label: 'WACC' },
  projection_years: { default: 5, min: 3, max: 10, step: 1, unit: 'yrs', label: 'Projection years' },
  terminal_growth: { default: 3, min: 0, max: 8, step: 0.25, unit: '%', label: 'Terminal growth' },
  next_year_fcf: { default: 120, min: 10, max: 10000, step: 10, unit: '₹cr', label: 'Next-year FCF' },
  base_terminal_growth: { default: 3, min: 0, max: 8, step: 0.25, unit: '%', label: 'Base terminal growth' },
};

function buildDefaults(module) {
  const d = {};
  (module.inputs || []).forEach((k) => {
    d[k] = INPUT_META[k]?.default ?? 0;
  });
  return d;
}

/* =============================================================
   SLIDER INTERACTIVE — sliders + computed outputs card
   ============================================================= */
function SliderModule({ module, onExplored }) {
  const defaults = useMemo(() => buildDefaults(module), [module]);
  const [inputs, setInputs] = useState(defaults);
  const [touched, setTouched] = useState(false);

  useEffect(() => { setInputs(defaults); setTouched(false); }, [defaults, module.id]);

  const outputs = useMemo(() => {
    const fn = FORMULAS[module.id];
    if (!fn) return {};
    try { return fn(inputs); } catch { return {}; }
  }, [inputs, module.id]);

  const handleChange = (key, val) => {
    setInputs((p) => ({ ...p, [key]: parseFloat(val) }));
    if (!touched) { setTouched(true); onExplored?.(); }
  };

  return (
    <div className="space-y-5" data-testid={`module-lab-${module.id}`}>
      {/* Inputs */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sliders size={14} className="text-[var(--color-primary)]" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Inputs — drag to explore</span>
        </div>
        <div className="space-y-4">
          {(module.inputs || []).map((key) => {
            const meta = INPUT_META[key] || { min: 0, max: 100, step: 1, label: key, unit: '' };
            const val = inputs[key] ?? meta.default ?? 0;
            return (
              <div key={key} data-testid={`module-input-${key}`}>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <label className="text-xs font-bricolage text-[var(--color-text)]">{meta.label}</label>
                  <div className="font-mono text-sm font-bold text-[var(--color-primary)]">
                    {meta.unit === '%' ? `${fmt(val, 1)}%` : meta.unit === '₹' || meta.unit === '₹cr' ? `${meta.unit === '₹cr' ? '₹' : '₹'}${fmt(val, 0)}${meta.unit === '₹cr' ? ' cr' : ''}` : `${fmt(val, 0)} ${meta.unit}`}
                  </div>
                </div>
                <input
                  type="range"
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={val}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full accent-[var(--color-primary)] cursor-pointer"
                  data-testid={`module-slider-${key}`}
                />
                <div className="flex justify-between text-[9px] font-mono text-[var(--color-text-faint)] mt-0.5">
                  <span>{meta.min}</span>
                  <span>{meta.max}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Outputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(module.outputs || []).map((outKey) => {
          const out = outputs[outKey];
          if (!out) {
            return (
              <div key={outKey} className="rounded-2xl p-4 bg-[var(--color-surface)]/40 border border-[var(--color-border)] border-dashed">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">
                  {outKey.replace(/_/g, ' ')}
                </div>
                <div className="font-clash text-lg font-bold text-[var(--color-text-faint)]">—</div>
              </div>
            );
          }
          const Icon = out.Icon || Sparkles;
          return (
            <div
              key={outKey}
              className="rounded-2xl p-4 border"
              style={{
                background: `${out.color}10`,
                borderColor: `${out.color}30`,
              }}
              data-testid={`module-output-${outKey}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={13} style={{ color: out.color }} />
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                  {out.label || outKey.replace(/_/g, ' ')}
                </div>
              </div>
              <div className="font-clash text-2xl font-bold" style={{ color: out.color }}>
                {out.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =============================================================
   SENSITIVITY MATRIX — Gordon growth PV grid (5x5)
   ============================================================= */
function SensitivityModule({ module, onExplored }) {
  const defaults = useMemo(() => buildDefaults(module), [module]);
  const [inputs, setInputs] = useState(defaults);
  const [touched, setTouched] = useState(false);

  useEffect(() => { setInputs(defaults); setTouched(false); }, [defaults, module.id]);

  const fcf = inputs.next_year_fcf ?? 120;
  const baseG = inputs.base_terminal_growth ?? 3;

  // WACC rows (5) from 8% to 14%, terminal growth cols (5) from (baseG-2) to (baseG+2)
  const wRates = [8, 10, 11, 12, 14];
  const gRates = [baseG - 2, baseG - 1, baseG, baseG + 1, baseG + 2];

  const cells = wRates.map((w) =>
    gRates.map((g) => {
      const wd = w / 100, gd = g / 100;
      if (wd <= gd) return { v: NaN, g, w };
      return { v: fcf / (wd - gd), g, w };
    })
  );

  const allVals = cells.flat().filter((c) => isFinite(c.v)).map((c) => c.v);
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);

  const colorFor = (v) => {
    if (!isFinite(v)) return 'transparent';
    const t = max > min ? (v - min) / (max - min) : 0.5;
    // Blue → purple → pink gradient
    const r = Math.round(36 + t * (255 - 36));
    const g = Math.round(107 - t * 58);
    const b = Math.round(253 - t * 60);
    return `rgba(${r},${g},${b},${0.15 + t * 0.35})`;
  };

  const handleChange = (k, v) => {
    setInputs((p) => ({ ...p, [k]: parseFloat(v) }));
    if (!touched) { setTouched(true); onExplored?.(); }
  };

  return (
    <div className="space-y-5" data-testid={`module-lab-${module.id}`}>
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Grid3X3 size={14} className="text-[var(--color-primary)]" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Gordon Growth sensitivity inputs</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(module.inputs || []).map((k) => {
            const meta = INPUT_META[k] || { min: 0, max: 100, step: 1, label: k, unit: '' };
            const val = inputs[k] ?? meta.default;
            return (
              <div key={k}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <label className="text-xs font-bricolage text-[var(--color-text)]">{meta.label}</label>
                  <div className="font-mono text-sm font-bold text-[var(--color-primary)]">
                    {meta.unit === '%' ? `${fmt(val, 2)}%` : `₹${fmt(val, 0)}${meta.unit === '₹cr' ? ' cr' : ''}`}
                  </div>
                </div>
                <input
                  type="range" min={meta.min} max={meta.max} step={meta.step} value={val}
                  onChange={(e) => handleChange(k, e.target.value)}
                  className="w-full accent-[var(--color-primary)] cursor-pointer"
                  data-testid={`module-slider-${k}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]/40">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">PV = FCF₁ / (WACC − g)  •  rows: WACC  •  cols: terminal g</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            <thead>
              <tr>
                <th className="px-3 py-2 text-[10px] font-mono text-[var(--color-text-muted)]">WACC ↓ \\ g →</th>
                {gRates.map((g) => (
                  <th key={g} className="px-3 py-2 text-[10px] font-mono text-[var(--color-text-muted)] text-right">{g.toFixed(1)}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wRates.map((w, ri) => (
                <tr key={w}>
                  <td className="px-3 py-2 text-[10px] font-mono text-[var(--color-text)] font-bold">{w}%</td>
                  {cells[ri].map((c, ci) => (
                    <td
                      key={ci}
                      className="px-3 py-2 text-right text-xs tabular-nums"
                      style={{ background: colorFor(c.v), color: 'var(--color-text)' }}
                      data-testid={`sensitivity-cell-${w}-${gRates[ci]}`}
                    >
                      {isFinite(c.v) ? fmtInt(c.v) : '∞'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =============================================================
   SCENARIO REGISTRY — resolve string IDs to full scenario data
   (Seed data sometimes stores scenarios as IDs only.)
   ============================================================= */

const SCENARIO_REGISTRY = {
  uncles_offer_lumpsum_choice: {
    title: "The Uncle's Offer",
    narrative:
      "Your uncle sits you down after dinner and makes you a deal: ₹5,00,000 in your account tomorrow, OR ₹10,00,000 wired in exactly 8 years.\n\nYou have a reliable brokerage account earning ~10% compounded annually. Which do you take?",
    options: [
      {
        id: 'lumpsum_today',
        label: 'Take ₹5,00,000 today',
        is_correct: true,
        rationale:
          '✓ Correct. At 10% compounded annually, ₹5L grows to ₹10.72L in 8 years — more than the ₹10L offered. The PV of ₹10L in 8 years at 10% is only ₹4.67L. Take the money today and compound it yourself.',
      },
      {
        id: 'wait_eight_years',
        label: 'Take ₹10,00,000 in 8 years',
        is_correct: false,
        rationale:
          '✗ You\'re giving up time value. At 10%, ₹5L today compounds to ₹10.72L in 8 years — ₹72K more than the deferred offer. Rule of 72 tells you money doubles in ~7.2 yrs at 10%.',
      },
      {
        id: 'not_enough_info',
        label: "I don't have enough info to decide",
        is_correct: false,
        rationale:
          '✗ You have everything: two cashflows, an expected rate (10%), and a tenor (8 yrs). Compute FV(₹5L, 10%, 8) or PV(₹10L, 10%, 8) — either comparison proves the choice.',
      },
    ],
  },

  bond_buy_or_pass: {
    title: 'The Bond Desk Call',
    narrative:
      "A broker pings you with a hot tip: a ₹1,000 face-value corporate bond paying a 7% annual coupon, 5 years to maturity. Comparable bonds in the market are yielding 8%. The seller is asking ₹1,020.\n\nDo you buy?",
    options: [
      {
        id: 'buy_now',
        label: 'Yes — buy at ₹1,020',
        is_correct: false,
        rationale:
          '✗ Overpaying. At 8% yield, the intrinsic value ≈ ₹960 (coupon 7% < market yield 8% → discount bond). ₹1,020 is above BOTH intrinsic AND face value. You\'d be paying ₹60 extra for a bond the market prices lower.',
      },
      {
        id: 'pass',
        label: 'Pass — asking price is above intrinsic',
        is_correct: true,
        rationale:
          '✓ Correct. Coupon (7%) < market yield (8%) means this is a discount bond — intrinsic ≈ ₹960. A ₹1,020 ask represents a 6%+ premium over fair value. Unless you have private info justifying a lower required yield, walk.',
      },
      {
        id: 'buy_if_yield_drops',
        label: 'Buy only if market yield drops to 7%',
        is_correct: false,
        rationale:
          '✗ Even if yield dropped to 7%, the bond would trade at par (₹1,000) — still below the ₹1,020 ask. You\'d need yields to fall below ~6.5% for this price to be defensible.',
      },
    ],
  },

  discount_rate_judgment: {
    title: 'The Analyst Debate',
    narrative:
      'Two analysts on your team are modelling the same stable FMCG: FCF₁ = ₹120 cr, terminal growth = 3%.\n\n• Analyst A uses WACC = 10%\n• Analyst B uses WACC = 14%\n\nWhose terminal value is more defensible?',
    options: [
      {
        id: 'analyst_a',
        label: 'Analyst A (10% WACC)',
        is_correct: false,
        rationale:
          '✗ At 10% WACC, TV = ₹120 / (0.10 − 0.03) = ₹1,714 cr. Plausible for a defensive FMCG, but 10% might be aggressive depending on the business\'s actual beta, leverage, and country risk.',
      },
      {
        id: 'analyst_b',
        label: 'Analyst B (14% WACC)',
        is_correct: false,
        rationale:
          '✗ 14% is a mid-risk TECH multiple — too high for a stable FMCG. At 14%, TV = ₹120 / (0.14 − 0.03) = ₹1,091 cr, materially understating value. You\'d walk away from a fair deal.',
      },
      {
        id: 'context_dependent',
        label: 'Neither — WACC must be built bottom-up from the business',
        is_correct: true,
        rationale:
          '✓ Correct. A defensible WACC = weighted(cost of equity via CAPM, after-tax cost of debt). It depends on the RISK-FREE rate, equity risk premium, the company\'s beta, and its actual capital structure. Without those, any number is a guess.',
      },
    ],
  },
};

function resolveScenario(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') return SCENARIO_REGISTRY[raw] || { title: raw, narrative: '', options: [] };
  return raw;
}

/* =============================================================
   DECISION SCENARIOS — simple scenario walker
   ============================================================= */
function DecisionModuleInner({ module, onExplored }) {
  const rawScenarios = module.scenarios || [];
  const scenarios = useMemo(() => rawScenarios.map(resolveScenario).filter(Boolean), [rawScenarios]);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState({});
  const [revealed, setRevealed] = useState({});

  const scen = scenarios[idx];

  if (!scenarios.length) {
    return (
      <div className="glass-card rounded-2xl p-6 text-center">
        <GitBranch size={20} className="text-[var(--color-text-muted)] mx-auto mb-3" />
        <p className="text-sm font-bricolage text-[var(--color-text-muted)]">
          Decision scenarios not yet defined for this module.
        </p>
      </div>
    );
  }

  const handlePick = (optId) => {
    setPicks({ ...picks, [idx]: optId });
    setRevealed({ ...revealed, [idx]: true });
    onExplored?.();
  };

  return (
    <div className="space-y-4" data-testid={`module-lab-${module.id}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          Scenario {idx + 1} of {scenarios.length}
        </div>
        <div className="flex items-center gap-1">
          {scenarios.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${revealed[i] ? 'bg-[var(--color-success)]' : i === idx ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}
            />
          ))}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-[10px] font-mono uppercase tracking-[0.2em] mb-3">
          <GitBranch size={11} /> {scen.title || `Scenario ${idx + 1}`}
        </div>
        <p className="text-sm sm:text-base font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
          {scen.narrative || scen.description || scen.question || ''}
        </p>
      </div>

      <div className="space-y-2">
        {(scen.options || scen.choices || []).map((opt, oi) => {
          const optId = opt.id || `opt-${oi}`;
          const picked = picks[idx] === optId;
          const isRight = opt.is_correct || opt.correct;
          const shouldColor = revealed[idx] && picked;
          return (
            <button
              key={optId}
              onClick={() => !revealed[idx] && handlePick(optId)}
              disabled={!!revealed[idx] && !picked}
              className={`w-full text-left glass-card rounded-xl p-4 transition-all ${
                shouldColor
                  ? (isRight ? 'border-[var(--color-success)]/60 bg-[var(--color-success)]/8' : 'border-[#EF4444]/60 bg-[#EF4444]/8')
                  : 'hover:border-[var(--color-primary)]/40 hover:-translate-y-0.5'
              } ${revealed[idx] && !picked ? 'opacity-50' : ''}`}
              data-testid={`decision-option-${idx}-${optId}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-xs font-bold text-[var(--color-text-muted)] shrink-0">
                  {String.fromCharCode(65 + oi)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bricolage text-[var(--color-text)]">{opt.label || opt.text}</div>
                  {shouldColor && opt.rationale && (
                    <p className="text-xs font-mono text-[var(--color-text-muted)] mt-1.5 leading-relaxed animate-vv-slide-in">
                      {opt.rationale}
                    </p>
                  )}
                </div>
                {shouldColor && (isRight ? (
                  <CheckCircle2 size={16} className="text-[var(--color-success)] shrink-0" />
                ) : (
                  <span className="text-[10px] font-mono text-[#EF4444]">Learn</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft size={13} /> Prev
        </button>
        <button
          onClick={() => setIdx(Math.min(scenarios.length - 1, idx + 1))}
          disabled={idx === scenarios.length - 1 || !revealed[idx]}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

/* =============================================================
   GENERIC MODULE — graceful renderer for any unknown module type.
   Shows the description + any rich fields (arrays, objects) as
   readable cards, plus a "Mark as Explored" button.
   ============================================================= */

// Keys we don't want to render as "extra data" sections
const SKIP_KEYS = new Set([
  'id', 'type', 'label', 'scoring', 'max_score', 'scenario_count',
  'completion_requirement', 'description',
]);

function isPrimitive(v) {
  return v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function prettyKey(k) {
  return String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function GenericKeyValue({ data }) {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return null;
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-3 text-xs font-bricolage break-words">
          <span className="text-[var(--color-text-muted)] font-mono text-[10px] uppercase tracking-[0.12em] shrink-0">{prettyKey(k)}</span>
          <span className="text-[var(--color-text)] text-right break-words">
            {isPrimitive(v) ? String(v) : (
              Array.isArray(v)
                ? `${v.length} items`
                : typeof v === 'object' ? `${Object.keys(v).length} fields` : String(v)
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function GenericArray({ items, limit = 6 }) {
  const [expanded, setExpanded] = useState(false);
  if (!Array.isArray(items) || !items.length) return null;
  const visible = expanded ? items : items.slice(0, limit);
  const rest = items.length - visible.length;

  return (
    <div className="space-y-2">
      {visible.map((item, i) => {
        if (isPrimitive(item)) {
          return (
            <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-[var(--color-surface)]/40 border border-[var(--color-border)]">
              <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <span className="text-sm font-bricolage text-[var(--color-text)] break-words">{String(item)}</span>
            </div>
          );
        }
        // Object item: pick a display title + show key fields
        const title = item.label || item.title || item.name || item.question || item.transaction || item.narrative || item.description || `Item ${i + 1}`;
        const subFields = Object.entries(item).filter(([k, v]) => {
          if (['label', 'title', 'name', 'id'].includes(k)) return false;
          return v != null && v !== '';
        });
        return (
          <div key={i} className="rounded-xl p-3 bg-[var(--color-surface)]/40 border border-[var(--color-border)]">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <div className="font-clash text-sm font-semibold text-[var(--color-text)] break-words flex-1 min-w-0">
                {typeof title === 'string' ? title : `Item ${i + 1}`}
              </div>
            </div>
            {subFields.length > 0 && (
              <div className="pl-9 space-y-1">
                {subFields.slice(0, 6).map(([k, v]) => (
                  <div key={k} className="text-xs font-bricolage text-[var(--color-text-muted)] break-words">
                    <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-[var(--color-text-faint)] mr-2">{prettyKey(k)}:</span>
                    <span className="text-[var(--color-text)]">
                      {isPrimitive(v) ? String(v) :
                        Array.isArray(v) ? `${v.length} items` :
                          typeof v === 'object' ? Object.entries(v).map(([kk, vv]) => `${prettyKey(kk)}: ${isPrimitive(vv) ? vv : '…'}`).slice(0, 3).join(' • ') :
                            String(v)
                      }
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {rest > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-xs font-mono text-[var(--color-primary)] hover:text-[var(--color-accent-purple)] py-2 rounded-lg hover:bg-[var(--color-surface)]/40 transition-all"
        >
          Show {rest} more
        </button>
      )}
      {expanded && items.length > limit && (
        <button
          onClick={() => setExpanded(false)}
          className="w-full text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 rounded-lg hover:bg-[var(--color-surface)]/40 transition-all"
        >
          Show less
        </button>
      )}
    </div>
  );
}

function GenericModule({ module, onExplored }) {
  const description = module.description;
  const typeLabel = String(module.type || 'interactive').replace(/_/g, ' ');

  // Find the "primary" content array (transactions, scenarios, errors_to_find, roll_forwards, etc.)
  const extraEntries = Object.entries(module).filter(([k]) => !SKIP_KEYS.has(k));
  const [acknowledged, setAcknowledged] = useState(false);

  const handleAck = () => {
    setAcknowledged(true);
    onExplored?.();
  };

  return (
    <div className="space-y-5" data-testid={`module-lab-${module.id}`}>
      {/* Type indicator */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-[10px] font-mono uppercase tracking-[0.2em]">
        <BookOpen size={11} /> {typeLabel}
      </div>

      {/* Description */}
      {description && (
        <div className="glass-card rounded-2xl p-5 sm:p-6" data-testid="module-description">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-[var(--color-primary)]" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">What you'll do</span>
          </div>
          <p className="text-sm sm:text-base font-bricolage text-[var(--color-text)] leading-relaxed whitespace-pre-wrap break-words">
            {description}
          </p>
        </div>
      )}

      {/* Extra fields — arrays render as lists, objects as key/value, scalars as cards */}
      {extraEntries.map(([k, v]) => {
        if (v == null || v === '' || v === false) return null;

        // Arrays — render as numbered cards with rich content
        if (Array.isArray(v) && v.length > 0) {
          return (
            <div key={k} className="glass-card rounded-2xl p-5" data-testid={`module-field-${k}`}>
              <div className="flex items-center gap-2 mb-4">
                <Layers size={14} className="text-[var(--color-primary)]" />
                <span className="text-xs font-clash font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                  {prettyKey(k)}
                </span>
                <span className="ml-auto text-[10px] font-mono text-[var(--color-text-muted)]">{v.length} items</span>
              </div>
              <GenericArray items={v} />
            </div>
          );
        }

        // Plain object — render as key/value
        if (typeof v === 'object') {
          return (
            <div key={k} className="glass-card rounded-2xl p-5" data-testid={`module-field-${k}`}>
              <div className="flex items-center gap-2 mb-3">
                <Grid3X3 size={14} className="text-[var(--color-primary)]" />
                <span className="text-xs font-clash font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                  {prettyKey(k)}
                </span>
              </div>
              <GenericKeyValue data={v} />
            </div>
          );
        }

        // Primitive
        return (
          <div key={k} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3" data-testid={`module-field-${k}`}>
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">{prettyKey(k)}</span>
            <span className="text-sm font-bricolage font-semibold text-[var(--color-text)]">{String(v)}</span>
          </div>
        );
      })}

      {/* Acknowledgment button */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <span className="text-xs font-mono text-[var(--color-text-muted)]">
          {acknowledged ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--color-success)]">
              <CheckCircle2 size={12} /> Module reviewed
            </span>
          ) : (
            'Review the content above, then mark as explored'
          )}
        </span>
        <button
          onClick={handleAck}
          disabled={acknowledged}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text)] font-bricolage hover:border-[var(--color-primary)]/40 transition-all disabled:opacity-50"
          data-testid="module-acknowledge"
        >
          <Eye size={14} />
          {acknowledged ? 'Explored' : 'Mark as Explored'}
        </button>
      </div>
    </div>
  );
}

/* =============================================================
   MODULE LAB — tabbed container over config.modules
   ============================================================= */
export default function ModuleLab({ config, onComplete }) {
  const modules = config?.modules || [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [explored, setExplored] = useState(() => new Set([0]));

  const m = modules[activeIdx];

  const markExplored = (i) => {
    setExplored((prev) => {
      if (prev.has(i)) return prev;
      const n = new Set(prev);
      n.add(i);
      return n;
    });
  };

  useEffect(() => {
    markExplored(activeIdx);
  }, [activeIdx]);

  const canComplete = explored.size === modules.length;

  const handleComplete = () => {
    const accuracy = modules.length ? explored.size / modules.length : 0;
    onComplete({
      tasks_completed: explored.size,
      tasks_total: modules.length,
      accuracy,
    });
  };

  if (!modules.length) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center" data-testid="module-lab-empty">
        <p className="font-clash text-base text-[var(--color-text)] mb-2">No modules configured</p>
        <button
          onClick={() => onComplete({ tasks_completed: 0, tasks_total: 0, accuracy: 0 })}
          className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text)]"
        >
          Continue <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="module-lab">
      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" data-testid="module-lab-tabs">
        {modules.map((mod, i) => {
          const isActive = i === activeIdx;
          const isExplored = explored.has(i);
          return (
            <button
              key={mod.id || i}
              onClick={() => setActiveIdx(i)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl whitespace-nowrap text-xs font-bricolage font-semibold transition-all shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white shadow-[0_0_20px_rgba(36,107,253,0.35)]'
                  : isExplored
                    ? 'bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 text-[var(--color-success)]'
                    : 'bg-[var(--color-surface)]/60 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
              data-testid={`module-tab-${mod.id || i}`}
            >
              <span className="text-[10px] font-mono opacity-70">{String(i + 1).padStart(2, '0')}</span>
              {mod.label || mod.id}
              {isExplored && !isActive && <CheckCircle2 size={12} />}
            </button>
          );
        })}
      </div>

      {/* Active module body */}
      <div key={m.id || activeIdx} className="animate-vv-fade-up">
        <div className="mb-4">
          <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)]" data-testid="module-lab-title">{m.label}</h2>
        </div>

        {m.type === 'slider_interactive' && FORMULAS[m.id] && (
          <SliderModule module={m} onExplored={() => markExplored(activeIdx)} />
        )}
        {m.type === 'matrix_table' && (
          <SensitivityModule module={m} onExplored={() => markExplored(activeIdx)} />
        )}
        {m.type === 'decision_making' && (
          <DecisionModuleInner module={m} onExplored={() => markExplored(activeIdx)} />
        )}
        {/* Generic fallback — handles any unknown module type
            (interactive_three_panel, fill_in_the_blank_interactive,
             build_from_scratch_interactive, error_detection_interactive, etc.)
            and slider_interactive modules without a known formula. */}
        {!['matrix_table', 'decision_making'].includes(m.type) &&
          !(m.type === 'slider_interactive' && FORMULAS[m.id]) && (
            <GenericModule module={m} onExplored={() => markExplored(activeIdx)} />
          )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-[var(--color-border)]">
        <div className="text-xs font-mono text-[var(--color-text-muted)]" data-testid="module-lab-progress">
          <span className="text-[var(--color-text)] font-semibold">{explored.size}</span> / {modules.length} modules explored
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}
            disabled={activeIdx === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            data-testid="module-lab-prev"
          >
            <ArrowLeft size={13} /> Prev
          </button>
          {activeIdx < modules.length - 1 ? (
            <button
              onClick={() => setActiveIdx(activeIdx + 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold font-bricolage text-[var(--color-text)] hover:border-[var(--color-primary)]/40 transition-all"
              data-testid="module-lab-next"
            >
              Next <ArrowRight size={13} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={!canComplete}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="module-lab-complete"
            >
              Complete Simulation
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes vvFadeUp { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-vv-fade-up { animation: vvFadeUp .28s ease-out both; }
        @keyframes vvSlideIn { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-vv-slide-in { animation: vvSlideIn .2s ease-out both; }
      `}</style>
    </div>
  );
}

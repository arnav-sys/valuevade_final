import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

// Phase D2, Cumulative planned vs actual chart.
//
// Reads from the parent's dashboard-summary. The Y values are cumulative
// minutes; the chart converts to hours for the axis label. A vertical
// reference line marks today.

function fmtDay(iso) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  catch { return iso; }
}

function PlanTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload || {};
  const items = row.items || [];
  return (
    <div
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl px-3 py-2.5"
      style={{ fontFamily: 'Instrument Sans, sans-serif', fontSize: 12, maxWidth: 220 }}
      data-testid="plan-trend-tooltip"
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1">
        {fmtDay(label)}
      </div>
      {payload.map((p) => (
        <div key={p.dataKey} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value} hr
        </div>
      ))}
      {items.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-[var(--color-border)]">
          <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1">
            That day's sessions ({row.dayMinutes}m)
          </div>
          <ul className="space-y-0.5">
            {items.slice(0, 6).map((it, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-[10px] text-[var(--color-text)]">
                <span className="truncate">{it.title}</span>
                <span className="shrink-0 text-[var(--color-text-muted)] font-mono">{it.minutes}m</span>
              </li>
            ))}
          </ul>
          {items.length > 6 && (
            <div className="text-[9px] text-[var(--color-text-faint)] mt-0.5">+{items.length - 6} more</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlanTrendChart({ data }) {
  const series = useMemo(() => {
    const rows = data?.cumulative?.days_so_far || [];
    return rows.map((r) => ({
      day: r.day_date,
      planned: Math.round((r.required_minutes_cum || 0) / 60 * 10) / 10,
      actual:  Math.round((r.actual_minutes_cum   || 0) / 60 * 10) / 10,
      dayMinutes: r.required_minutes || 0,
      items: r.items || [],
    }));
  }, [data]);

  const today = data?.today?.day_date || (series[series.length - 1]?.day);
  const behindPct = data?.cumulative?.is_behind_percent || 0;
  const actualColor = behindPct > 0 ? '#F59E0B' : '#10B981';
  const planned = series[series.length - 1]?.planned || 0;
  const actual  = series[series.length - 1]?.actual  || 0;
  const gap = +(planned - actual).toFixed(1);
  const gapColor = gap > 0 ? '#F59E0B' : '#10B981';

  if (!data?.active_plan) return null;

  if (series.length === 0) {
    return (
      <div
        className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-6 text-center"
        data-testid="plan-trend-empty"
      >
        <div className="mx-auto w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center mb-2">
          <TrendingUp size={16} />
        </div>
        <div className="font-clash text-sm font-semibold text-[var(--color-text)] mb-1">Trend chart starts tomorrow</div>
        <p className="text-xs font-bricolage text-[var(--color-text-muted)]">
          You'll see your planned-vs-actual climb here once you've logged at least one day of work.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 sm:px-5 py-4 sm:py-5"
      data-testid="plan-trend-chart"
    >
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center">
            <TrendingUp size={14} />
          </div>
          <div>
            <div className="font-clash text-sm sm:text-base font-bold text-[var(--color-text)]">Plan vs Actual</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
              cumulative hours
            </div>
          </div>
        </div>
      </header>

      <div className="h-[200px] sm:h-[240px]" data-testid="plan-trend-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fontFamily: 'Spline Sans Mono, monospace', fill: 'var(--color-text-muted)' }}
              tickFormatter={fmtDay}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              minTickGap={30}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: 'Spline Sans Mono, monospace', fill: 'var(--color-text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              width={36}
            />
            <Tooltip
              content={<PlanTooltip />}
              wrapperStyle={{ outline: 'none' }}
            />
            <Legend
              verticalAlign="top"
              height={28}
              wrapperStyle={{ fontSize: 10, fontFamily: 'Spline Sans Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}
            />
            {today && <ReferenceLine x={today} stroke="var(--color-text-muted)" strokeDasharray="4 4" strokeOpacity={0.5} />}
            <Line type="monotone" dataKey="planned" stroke="#246BFD" strokeWidth={2} dot={false} name="Planned" />
            <Line type="monotone" dataKey="actual"  stroke={actualColor} strokeWidth={2} dot={false} name="Actual" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 text-xs sm:text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed" data-testid="plan-trend-caption">
        Planned: <span className="text-[var(--color-text)] font-bold">{planned} hr</span> by today · Actual: <span className="text-[var(--color-text)] font-bold">{actual} hr</span> · Gap: <span className="font-bold" style={{ color: gapColor }}>{gap > 0 ? `+${gap}` : gap} hr</span>
      </div>
    </div>
  );
}

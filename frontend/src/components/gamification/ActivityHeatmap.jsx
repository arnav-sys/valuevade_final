import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

// GitHub-style 90-day activity heatmap.
//
// XP-based bucketing (5 tiers):
//   0           → navy / inactive
//   1–25        → low green
//   26–75       → mid green
//   76–150      → bright green
//   151+        → purple (high-activity bonus tier)
//
// All dates resolved to Asia/Kolkata. Subscribes to user_daily_activity
// realtime so today's cell updates live without reload.

const TIER_COLORS = ['#1a2030', '#1f5733', '#2d9145', '#3ed05b', '#9c6bff'];
const TIER_LABELS = ['No activity', '1–25 XP', '26–75 XP', '76–150 XP', '151+ XP'];

function tierFor(xp) {
  const v = Number(xp) || 0;
  if (v <= 0) return 0;
  if (v <= 25) return 1;
  if (v <= 75) return 2;
  if (v <= 150) return 3;
  return 4;
}

function istDateNDaysAgo(n) {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(ist.getUTCDate() - n);
  return ist.toISOString().slice(0, 10);
}

function istTodayDate() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

function fmtTooltipDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' });
}

const DAYS = 90;
const WEEKS = Math.ceil(DAYS / 7);

export default function ActivityHeatmap() {
  const { user } = useAuth();
  const [activityMap, setActivityMap] = useState({}); // date_iso -> row
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) { setActivityMap({}); setLoading(false); return; }
    const since = istDateNDaysAgo(DAYS - 1);
    const { data, error } = await supabase
      .from('user_daily_activity')
      .select('activity_date,xp_earned,sessions_completed,minutes_spent')
      .eq('user_id', user.id)
      .gte('activity_date', since);
    if (error) {
      console.warn('[heatmap] fetch failed:', error.message);
    }
    const map = {};
    (data || []).forEach((r) => { map[r.activity_date] = r; });
    setActivityMap(map);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: any user_daily_activity change for this user → refresh.
  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase
      .channel(`activity_heatmap:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_daily_activity',
        filter: `user_id=eq.${user.id}`,
      }, refresh)
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch { /* noop */ } };
  }, [user?.id, refresh]);

  // Build a column-major grid of 13 weeks × 7 days, anchored on today.
  const grid = useMemo(() => {
    const today = istTodayDate();
    // Align grid so the last column ends on today's day-of-week row.
    const cells = [];
    for (let col = WEEKS - 1; col >= 0; col--) {
      const week = [];
      for (let row = 6; row >= 0; row--) {
        // Distance from today in days, anchored to last column = today.
        const daysAgo = col * 7 + row;
        if (daysAgo >= DAYS) {
          week.push(null);
          continue;
        }
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - (DAYS - 1 - (WEEKS - 1 - col) * 7 - (6 - row)));
        const iso = d.toISOString().slice(0, 10);
        const r = activityMap[iso] || { activity_date: iso, xp_earned: 0, sessions_completed: 0, minutes_spent: 0 };
        week.push({ ...r, iso });
      }
      cells.push(week);
    }
    return cells;
  }, [activityMap]);

  // Month labels: pick the first column of each new IST month.
  const monthLabels = useMemo(() => {
    const out = [];
    let lastMonth = null;
    grid.forEach((week, ci) => {
      const first = week.find(Boolean);
      if (!first) return;
      const m = new Date(`${first.iso}T00:00:00Z`).toLocaleDateString(undefined, { month:'short', timeZone:'UTC' });
      if (m !== lastMonth) { out.push({ col: ci, label: m }); lastMonth = m; }
    });
    return out;
  }, [grid]);

  const totalXp = useMemo(() => Object.values(activityMap).reduce((s, r) => s + (Number(r.xp_earned) || 0), 0), [activityMap]);
  const activeDays = useMemo(() => Object.values(activityMap).filter((r) => (Number(r.xp_earned) || 0) > 0).length, [activityMap]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 sm:p-6" data-testid="activity-heatmap-loading">
        <div className="text-sm text-[var(--color-text-muted)]">Loading activity…</div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 sm:p-6"
      data-testid="activity-heatmap"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)]">Last {DAYS} days</div>
          <h3 className="font-clash text-lg font-bold text-[var(--color-text)]">Activity over the last 90 days</h3>
        </div>
        <div className="text-right text-xs text-[var(--color-text-muted)]">
          <div><span className="font-bold text-[var(--color-text)]">{activeDays}</span> active days</div>
          <div><span className="font-bold text-[var(--color-text)]">{totalXp}</span> XP earned</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Month labels row */}
          <div className="grid mb-1" style={{ gridTemplateColumns: `auto repeat(${WEEKS}, minmax(0, 14px))`, gap: '3px' }}>
            <div />
            {grid.map((_, ci) => {
              const m = monthLabels.find((x) => x.col === ci);
              return (
                <div key={`m-${ci}`} className="text-[9px] font-mono uppercase tracking-[0.1em] text-[var(--color-text-faint)] h-3">
                  {m ? m.label : ''}
                </div>
              );
            })}
          </div>
          {/* Day rows */}
          {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
            const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
            return (
              <div key={`row-${dayIdx}`}
                   className="grid mb-[3px]"
                   style={{ gridTemplateColumns: `auto repeat(${WEEKS}, minmax(0, 14px))`, gap: '3px' }}>
                <div className="text-[9px] font-mono text-[var(--color-text-faint)] pr-2 w-7 text-right">
                  {dayLabels[dayIdx]}
                </div>
                {grid.map((week, ci) => {
                  const cell = week[dayIdx];
                  if (!cell) return <div key={`c-${ci}-${dayIdx}`} className="w-3 h-3" />;
                  const tier = tierFor(cell.xp_earned);
                  const label = `${fmtTooltipDate(cell.iso)} IST, ${cell.xp_earned || 0} XP, ${cell.sessions_completed || 0} sessions, ${cell.minutes_spent || 0} min`;
                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      tabIndex={0}
                      title={label}
                      aria-label={label}
                      data-testid={`heatmap-cell-${cell.iso}`}
                      className="w-3 h-3 rounded-[3px] border border-black/30 hover:ring-2 hover:ring-white/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                      style={{ background: TIER_COLORS[tier] }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)]">
        <span>Less</span>
        {TIER_COLORS.map((c, i) => (
          <span
            key={c}
            className="w-3 h-3 rounded-[3px] border border-black/30 inline-block"
            style={{ background: c }}
            title={TIER_LABELS[i]}
          />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}

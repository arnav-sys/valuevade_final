import { useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Crown, Flame, ArrowUp, Sparkles } from 'lucide-react';

/**
 * Leaderboard page (Phase 3). Three scopes:
 *   - This Week: sum(user_xp_events.amount) for IST-week-to-date
 *   - All Time: user_stats.total_xp ranking
 *   - By Module: sum(amount) where source_id ∈ master_sessions.id of selected module
 *
 * Reads directly via supabase client (RLS service-side aggregation isn't
 * strictly necessary for top-10 + own-rank; emails are masked client-side
 * to avoid leaking PII).
 */

const RANK_BADGES = {
  1: { color: '#F5C400', label: '1st', tier: 'gold' },
  2: { color: '#C0C9D2', label: '2nd', tier: 'silver' },
  3: { color: '#CD7F32', label: '3rd', tier: 'bronze' },
};

function maskName(profileRow, fallbackEmail) {
  const fn = profileRow?.full_name?.trim();
  if (fn) return fn.split(' ').slice(0, 2).join(' ');
  if (fallbackEmail) return fallbackEmail.split('@')[0];
  return 'Anonymous';
}

function istWeekStartIso() {
  // ISO week starts Monday IST
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffsetMs);
  const dow = ist.getUTCDay() === 0 ? 7 : ist.getUTCDay();
  const monday = new Date(ist.getTime() - (dow - 1) * 86400000);
  monday.setUTCHours(0, 0, 0, 0);
  // Roll back to UTC for the timestamp comparison
  return new Date(monday.getTime() - istOffsetMs).toISOString();
}

function fireConfetti() {
  if (typeof window === 'undefined') return;
  const count = 90;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
  document.body.appendChild(wrap);
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement('div');
    const colors = ['#F5C400', '#FF6AC1', '#246BFD', '#6A5CFF', '#22C55E'];
    p.style.cssText = `position:absolute;left:${50 + (Math.random() - 0.5) * 30}%;top:30%;width:10px;height:10px;background:${colors[i % colors.length]};border-radius:2px;transform:rotate(${Math.random() * 360}deg);animation:vvConf ${2 + Math.random() * 1.5}s ${Math.random() * 0.4}s ease-out forwards`;
    wrap.appendChild(p);
  }
  const style = document.createElement('style');
  style.textContent = `@keyframes vvConf { to { transform: translateY(70vh) rotate(720deg); opacity: 0; } }`;
  wrap.appendChild(style);
  setTimeout(() => wrap.remove(), 4000);
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState('this_week');
  const [moduleId, setModuleId] = useState('');
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [meRow, setMeRow] = useState(null);
  const [confettiFired, setConfettiFired] = useState(false);

  // Load module list once for the By Module dropdown
  useEffect(() => {
    let m = true;
    (async () => {
      const { data } = await supabase
        .from('master_modules')
        .select('id, title, module_number, order_index')
        .order('order_index', { ascending: true });
      if (m && data) {
        setModules(data);
        if (!moduleId && data.length) setModuleId(data[0].id);
      }
    })();
    return () => { m = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load leaderboard rows for the current scope
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      let aggregated = [];
      if (scope === 'all_time') {
        const { data } = await supabase
          .from('user_stats')
          .select('user_id, total_xp, current_level, current_streak_days')
          .order('total_xp', { ascending: false })
          .limit(200);
        // Dedup on user_id (keep highest total_xp)
        const seen = new Map();
        (data || []).forEach((r) => {
          const cur = seen.get(r.user_id);
          if (!cur || (r.total_xp || 0) > (cur.total_xp || 0)) seen.set(r.user_id, r);
        });
        aggregated = [...seen.values()].map((r) => ({
          user_id: r.user_id,
          xp_value: r.total_xp || 0,
          level_index: r.current_level || 1,
          streak: r.current_streak_days || 0,
        }));
      } else if (scope === 'this_week') {
        const since = istWeekStartIso();
        const { data } = await supabase
          .from('user_xp_events')
          .select('user_id, amount, created_at')
          .gte('created_at', since)
          .limit(20000);
        const totals = {};
        (data || []).forEach((e) => { totals[e.user_id] = (totals[e.user_id] || 0) + (e.amount || 0); });
        aggregated = Object.entries(totals).map(([uid, xp]) => ({ user_id: uid, xp_value: xp }));
      } else if (scope === 'by_module' && moduleId) {
        // Sessions of this module → user_xp_events with that source_id
        const { data: sess } = await supabase
          .from('master_sessions')
          .select('id')
          .eq('module_id', moduleId);
        const sids = (sess || []).map((s) => s.id);
        if (!sids.length) { aggregated = []; }
        else {
          const { data } = await supabase
            .from('user_xp_events')
            .select('user_id, amount, source_id')
            .in('source_id', sids)
            .limit(20000);
          const totals = {};
          (data || []).forEach((e) => { totals[e.user_id] = (totals[e.user_id] || 0) + (e.amount || 0); });
          aggregated = Object.entries(totals).map(([uid, xp]) => ({ user_id: uid, xp_value: xp }));
        }
      }

      // Sort desc, take top 200, hydrate level + streak from user_stats for non-all_time
      aggregated.sort((a, b) => (b.xp_value || 0) - (a.xp_value || 0));
      const userIds = aggregated.slice(0, 200).map((r) => r.user_id);
      let statsByUser = {};
      let profilesByUser = {};
      if (userIds.length) {
        const [{ data: stats }, { data: profs }] = await Promise.all([
          supabase.from('user_stats').select('user_id, current_level, current_streak_days, total_xp').in('user_id', userIds).order('total_xp', { ascending: false }),
          supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds),
        ]);
        (stats || []).forEach((s) => {
          if (!statsByUser[s.user_id]) statsByUser[s.user_id] = s;
        });
        (profs || []).forEach((p) => { profilesByUser[p.id] = p; });
      }

      const decorated = aggregated.map((r) => ({
        ...r,
        display_name: maskName(profilesByUser[r.user_id], null),
        avatar_url: profilesByUser[r.user_id]?.avatar_url,
        level_index: r.level_index ?? statsByUser[r.user_id]?.current_level ?? 1,
        streak: r.streak ?? statsByUser[r.user_id]?.current_streak_days ?? 0,
        is_current_user: r.user_id === user?.id,
      }));

      const top = decorated.slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }));
      const myEntry = decorated.find((r) => r.is_current_user);
      const myRank = decorated.findIndex((r) => r.is_current_user);

      if (alive) {
        setRows(top);
        setMeRow(myEntry ? { ...myEntry, rank: myRank + 1 } : null);
        setLoading(false);

        // Confetti when current user is #1 in This Week, on first view per session
        if (!confettiFired && scope === 'this_week' && top[0]?.is_current_user) {
          fireConfetti();
          setConfettiFired(true);
        }
      }
    })();
    return () => { alive = false; };
  }, [scope, moduleId, user?.id, confettiFired]);

  const meInTop10 = useMemo(() => rows.some((r) => r.is_current_user), [rows]);

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] text-[var(--color-text)]">
      <Sidebar />
      <main className="flex-1 lg:ml-[250px] py-8 px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6 flex items-center gap-3">
            <Crown size={26} className="text-[#F5C400]" />
            <h1 className="font-clash text-3xl sm:text-4xl font-bold">Leaderboard</h1>
          </div>

          {/* Scope tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-6" role="tablist" data-testid="leaderboard-tabs">
            {[
              { key: 'this_week', label: 'This Week' },
              { key: 'all_time', label: 'All Time' },
              { key: 'by_module', label: 'By Module' },
            ].map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={scope === t.key}
                onClick={() => setScope(t.key)}
                data-testid={`leaderboard-tab-${t.key}`}
                className={`px-4 py-1.5 rounded-full text-sm font-bricolage font-semibold border transition-all ${
                  scope === t.key
                    ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/60 text-[var(--color-primary)]'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                }`}
              >
                {t.label}
              </button>
            ))}
            {scope === 'by_module' && (
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                data-testid="leaderboard-module-select"
                className="ml-2 px-3 py-1.5 rounded-full text-sm bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] font-bricolage"
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    Module {m.module_number ?? m.order_index}: {m.title.slice(0, 50)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {loading ? (
            <div className="text-[var(--color-text-muted)] font-bricolage py-10 text-center">Loading rankings…</div>
          ) : rows.length === 0 ? (
            <div className="text-[var(--color-text-muted)] font-bricolage py-10 text-center" data-testid="leaderboard-empty">
              No XP earned in this scope yet. Be the first.
            </div>
          ) : (
            <>
              <ol className="space-y-2 mb-8" data-testid="leaderboard-top10">
                {rows.map((r) => {
                  const rb = RANK_BADGES[r.rank];
                  return (
                    <li
                      key={r.user_id}
                      data-testid={`leaderboard-row-${r.rank}`}
                      className={`relative rounded-2xl border p-4 flex items-center gap-4 transition-all ${
                        r.is_current_user
                          ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/50 shadow-[0_0_24px_rgba(36,107,253,0.18)]'
                          : 'bg-[var(--color-surface)] border-[var(--color-border)]'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-clash font-bold text-sm shrink-0"
                        style={{
                          background: rb ? `${rb.color}26` : 'var(--bg-primary)',
                          color: rb ? rb.color : 'var(--color-text-muted)',
                          border: rb ? `1px solid ${rb.color}80` : '1px solid var(--color-border)',
                        }}
                      >
                        {rb ? <Crown size={16} /> : `#${r.rank}`}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bricolage font-semibold text-[var(--color-text)] truncate">
                          {r.display_name}
                          {r.is_current_user && (
                            <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-primary)]">you</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--color-text-muted)] mt-0.5">
                          <span>Lvl {r.level_index}</span>
                          {r.streak > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Flame size={11} className="text-orange-500" /> {r.streak}d
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-clash font-bold text-lg text-[var(--color-text)]">{(r.xp_value || 0).toLocaleString()}</div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)]">XP</div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* Pinned current user rank if outside top 10 */}
              {meRow && !meInTop10 && (
                <div className="border-t border-[var(--color-border)] pt-4">
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-faint)] mb-2">Your rank</div>
                  <div
                    className="rounded-2xl border-2 border-[var(--color-primary)]/50 bg-[var(--color-primary)]/8 p-4 flex items-center gap-4 shadow-[0_0_24px_rgba(36,107,253,0.2)]"
                    data-testid="leaderboard-me"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-clash font-bold text-sm bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/60">
                      #{meRow.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bricolage font-semibold">{meRow.display_name} <span className="text-[10px] font-mono text-[var(--color-primary)] ml-2">YOU</span></div>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--color-text-muted)] mt-0.5">
                        <span>Lvl {meRow.level_index}</span>
                        {meRow.streak > 0 && <span className="inline-flex items-center gap-1"><Flame size={11} /> {meRow.streak}d</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-clash font-bold text-lg">{(meRow.xp_value || 0).toLocaleString()}</div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)]">XP</div>
                    </div>
                  </div>
                  <div className="text-[12px] font-bricolage text-[var(--color-text-muted)] mt-2 inline-flex items-center gap-1.5">
                    <ArrowUp size={12} className="text-[var(--color-accent-purple)]" />
                    Climb {Math.max(1, meRow.rank - 10)} more to crack the top 10
                    <Sparkles size={12} className="text-[var(--color-accent-pink)]" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

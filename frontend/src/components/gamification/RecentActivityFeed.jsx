import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Activity, Zap, Flame, BookOpen, Target, Trophy } from 'lucide-react';

const REASON_META = {
  session_complete: { icon: BookOpen, label: 'Completed session' },
  quiz_correct:     { icon: Target,   label: 'Quiz answered' },
  daily_login:      { icon: Zap,      label: 'Daily login' },
  signup_bonus:     { icon: Zap,      label: 'Welcome bonus' },
  capstone_complete:{ icon: Trophy,   label: 'Capstone complete' },
  simulation_complete:{ icon: Trophy, label: 'Simulation submitted' },
  badge_unlock_bonus:{ icon: Trophy,  label: 'Badge unlocked' },
  daily_challenge_complete:{ icon: Target, label: 'Daily challenge complete' },
  daily_champion_bonus:{ icon: Flame, label: 'Daily Champion!' },
  plan_daily_target:{ icon: Target,   label: 'Hit daily plan target' },
};

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.floor((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

/**
 * Phase-4 vertical timeline of last 10 XP-awarding events on /profile.
 * Joins with master_sessions/master_modules client-side for human-readable
 * labels (e.g. "Completed Session 2.3 · Foundations of Finance · +50 XP").
 */
export default function RecentActivityFeed({ limit = 10 }) {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) return;
      setLoading(true);
      const { data: evts } = await supabase
        .from('user_xp_events')
        .select('id, amount, reason, source_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Hydrate session/module titles for events whose source_id is a session
      const sessionIds = [...new Set((evts || []).filter((e) => ['session_complete', 'quiz_correct'].includes(e.reason) && e.source_id).map((e) => e.source_id))];
      let sessionsByMaster = {};
      let sessionsByUser = {};
      if (sessionIds.length) {
        const [{ data: ms }, { data: us }] = await Promise.all([
          supabase.from('master_sessions').select('id, title, order_index, master_modules(title, module_number)').in('id', sessionIds),
          supabase.from('user_sessions').select('id, title, master_session_id').in('id', sessionIds),
        ]);
        (ms || []).forEach((s) => { sessionsByMaster[s.id] = s; });
        (us || []).forEach((s) => { sessionsByUser[s.id] = s; });
      }
      if (alive) {
        setEvents((evts || []).map((e) => {
          const meta = REASON_META[e.reason] || { icon: Activity, label: e.reason };
          let detail = '';
          const ms = sessionsByMaster[e.source_id];
          const us = sessionsByUser[e.source_id];
          if (ms) detail = `${ms.title} · M${ms.master_modules?.module_number ?? ''}`.replace(' · M', ' · M').replace(/M$/, 'Module');
          else if (us) detail = us.title;
          return { ...e, _meta: meta, _detail: detail };
        }));
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id, limit]);

  return (
    <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 sm:p-6" data-testid="recent-activity-feed">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-clash text-lg font-semibold text-[var(--color-text)]">Recent activity</h3>
        <span className="text-[11px] font-mono text-[var(--color-text-faint)]">last {limit}</span>
      </div>
      {loading ? (
        <div className="text-sm text-[var(--color-text-muted)] font-bricolage py-4">Loading…</div>
      ) : events.length === 0 ? (
        <div className="text-sm text-[var(--color-text-muted)] font-bricolage py-4" data-testid="recent-activity-empty">No XP-earning activity yet, start a session.</div>
      ) : (
        <ol className="relative space-y-3 pl-5 before:content-[''] before:absolute before:left-2 before:top-1 before:bottom-1 before:w-px before:bg-[var(--color-border)]">
          {events.map((e) => {
            const Icon = e._meta.icon;
            return (
              <li key={e.id} className="relative" data-testid={`activity-row-${e.id}`}>
                <span className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/60 flex items-center justify-center">
                  <span className="block w-1 h-1 rounded-full bg-[var(--color-primary)]" />
                </span>
                <div className="flex items-start gap-2">
                  <Icon size={14} className="text-[var(--color-text-muted)] mt-1 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bricolage text-[var(--color-text)]">
                      <span className="font-semibold">{e._meta.label}</span>
                      {e._detail && <span className="text-[var(--color-text-muted)]"> · {e._detail}</span>}
                    </div>
                    <div className="text-[11px] font-mono text-[var(--color-text-faint)] mt-0.5">
                      <span className="text-[var(--color-primary)] font-semibold">+{e.amount} XP</span> · {timeAgo(e.created_at)}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

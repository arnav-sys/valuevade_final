import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Navigate, useSearchParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Search, Users, ListChecks, BookOpen, RefreshCw, Share2, Lock } from 'lucide-react';

const ADMIN_EMAIL = 'info@valuevade.com';
const API = process.env.REACT_APP_BACKEND_URL;

async function authFetch(path) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${session?.access_token || ''}` },
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

function AdminTabs({ tab, setTab }) {
  const tabs = [
    { k: 'waitlist',  label: 'Waitlist Signups',   icon: ListChecks },
    { k: 'users',     label: 'Enrolled Users',     icon: Users },
    { k: 'progress',  label: 'Per-User Progress',  icon: BookOpen },
    { k: 'referrals', label: 'Referrals',          icon: Share2 },
  ];
  return (
    <div className="flex gap-2 mb-6 border-b border-[var(--color-border)]" data-testid="admin-tabs">
      {tabs.map(({k, label, icon: Icon}) => (
        <button key={k}
          data-testid={`admin-tab-${k}`}
          onClick={() => setTab(k)}
          className={`px-4 py-3 flex items-center gap-2 font-medium border-b-2 transition-colors ${tab === k
            ? 'border-[var(--color-accent)] text-[var(--color-text)]'
            : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
          <Icon className="w-4 h-4" /> {label}
        </button>
      ))}
    </div>
  );
}

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function WaitlistTab() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [err, setErr] = useState(null);
  useEffect(() => { authFetch('/api/admin/waitlist').then(setData).catch(e => setErr(e.message)); }, []);
  if (err) return <div className="text-red-500 p-4">{err}</div>;
  if (!data) return <div className="p-4 text-[var(--color-text-muted)]">Loading…</div>;
  const filtered = data.entries.filter(e => !search || (e.email || '').toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="px-3 py-1 rounded-full bg-[var(--color-accent)] text-white text-sm font-medium" data-testid="waitlist-total">
          {data.total} signups
        </span>
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email"
            data-testid="waitlist-search"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="waitlist-table">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Source</th><th className="p-3">Signup Date</th></tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="p-3 font-medium">{e.email || '—'}</td>
                <td className="p-3">{e.phone || '—'}</td>
                <td className="p-3">{e.source || e.referral_code || '—'}</td>
                <td className="p-3">{fmt(e.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-[var(--color-text-muted)]">No matches.</div>}
      </div>
    </div>
  );
}

function UsersTab({ onSelect }) {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [err, setErr] = useState(null);
  useEffect(() => { authFetch('/api/admin/users').then(setData).catch(e => setErr(e.message)); }, []);
  if (err) return <div className="text-red-500 p-4">{err}</div>;
  if (!data) return <div className="p-4 text-[var(--color-text-muted)]">Loading…</div>;
  const filtered = data.users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="px-3 py-1 rounded-full bg-[var(--color-accent)] text-white text-sm font-medium" data-testid="users-total">
          {data.total} users
        </span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email"
          data-testid="users-search"
          className="w-72 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="users-table">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr>
              <th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Country</th>
              <th className="p-3">Enrolled</th><th className="p-3">Last Active</th><th className="p-3">Active Plan</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.user_id} className="border-t border-[var(--color-border)]">
                <td className="p-3 font-medium">{u.full_name || '—'}</td>
                <td className="p-3">{u.email || '—'}</td>
                <td className="p-3">{u.country_code || '—'}</td>
                <td className="p-3">{u.enrolled ? fmt(u.enrollment_at) : '—'}</td>
                <td className="p-3">{fmt(u.last_active)}</td>
                <td className="p-3">{u.active_plan ? <span className="text-green-500">●</span> : <span className="text-[var(--color-text-muted)]">○</span>}</td>
                <td className="p-3"><button data-testid={`view-progress-${u.user_id}`} onClick={() => onSelect(u)} className="text-[var(--color-accent)] hover:underline">View →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProgressModal({ user, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!user) return;
    authFetch(`/api/admin/users/${user.user_id}/progress`).then(setData).catch(() => setData({ error: 'failed' }));
  }, [user]);
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose} data-testid="progress-modal">
      <div className="bg-[var(--color-bg-card)] rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">{user.full_name || user.email}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="close-progress">✕</button>
        </div>
        {!data && <p className="text-[var(--color-text-muted)]">Loading…</p>}
        {data && !data.error && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Stat label="Total XP" value={data.stats.total_xp} />
              <Stat label="Level" value={data.stats.current_level} />
              <Stat label="Streak (days)" value={data.stats.current_streak_days} />
              <Stat label="Modules" value={`${data.modules_done} / ${data.modules_total}`} />
              <Stat label="Sessions" value={`${data.sessions_done} / ${data.sessions_total}`} />
              <Stat label="On-schedule streak" value={data.stats.on_schedule_streak} />
            </div>
            <div className="space-y-2">
              {data.modules.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)]">
                  <div>
                    <div className="font-medium text-[var(--color-text)]">M{m.order_index}: {m.title}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{m.sessions_done}/{m.sessions_total} sessions</div>
                  </div>
                  {m.is_completed ? <span className="text-green-500 text-sm font-medium">Completed</span> : <span className="text-[var(--color-text-muted)] text-sm">In progress</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-bg-card-hover)] border border-[var(--color-border)]">
      <div className="text-xs text-[var(--color-text-muted)] uppercase">{label}</div>
      <div className="text-lg font-semibold text-[var(--color-text)]">{value}</div>
    </div>
  );
}

const fmtINR = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n || 0));

function ReferralsTab() {
  const [overview, setOverview] = useState(null);
  const [recent, setRecent] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    Promise.all([
      authFetch('/api/admin/referrals/overview'),
      authFetch('/api/admin/referrals/recent?limit=20'),
    ]).then(([o, r]) => { setOverview(o); setRecent(r); })
      .catch(e => setErr(e.message));
  }, []);

  if (err) return <div className="text-red-500 p-4">{err}</div>;
  if (!overview || !recent) return <div className="p-4 text-[var(--color-text-muted)]">Loading…</div>;

  const s = overview.stats;
  const paymentsLive = !!overview.payment_processing_live;

  return (
    <div data-testid="admin-referrals-tab">
      {!paymentsLive && (
        <div
          data-testid="referrals-payments-banner"
          className="mb-4 px-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-muted)] inline-flex items-center gap-2"
        >
          <Lock className="w-3.5 h-3.5" />
          Payment processing not live — commissions are tracked as credits only.
        </div>
      )}

      {/* Stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6" data-testid="referrals-stats">
        <Stat label="Total Referrers" value={s.unique_referrers} />
        <Stat label="Total Referrals" value={s.total_referrals} />
        <Stat label="Enrollments" value={s.total_enrollments} />
        <Stat label="Referred Revenue" value={fmtINR(s.lifetime_revenue)} />
        <Stat label="Pending Commission" value={fmtINR(s.pending_commission)} />
        <Stat label="Paid Commission" value={fmtINR(s.paid_commission)} />
      </div>

      {/* Leaderboard */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2 uppercase tracking-wider">
          Top Referrers Leaderboard
        </h3>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="referrals-leaderboard">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
              <tr>
                <th className="p-3 w-10">#</th>
                <th className="p-3">Referrer</th>
                <th className="p-3">Code</th>
                <th className="p-3 text-right">Signups</th>
                <th className="p-3 text-right">Enrolled</th>
                <th className="p-3 text-right">Referred Rev.</th>
                <th className="p-3 text-right">Pending</th>
                <th className="p-3 text-right">Paid</th>
              </tr>
            </thead>
            <tbody>
              {overview.leaderboard.map((row, i) => (
                <tr key={row.referrer_user_id} className="border-t border-[var(--color-border)]">
                  <td className="p-3 text-[var(--color-text-muted)]">{i + 1}</td>
                  <td className="p-3">
                    <div className="font-medium text-[var(--color-text)]">{row.full_name || '—'}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{row.email || '—'}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{row.referral_code || '—'}</td>
                  <td className="p-3 text-right font-semibold">{row.signups}</td>
                  <td className="p-3 text-right">{row.enrollments}</td>
                  <td className="p-3 text-right">{fmtINR(row.lifetime_revenue)}</td>
                  <td className="p-3 text-right text-[var(--color-text-muted)]">{fmtINR(row.pending_commission)}</td>
                  <td className="p-3 text-right">{fmtINR(row.paid_commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {overview.leaderboard.length === 0 && (
            <div className="p-8 text-center text-[var(--color-text-muted)]">No referrals yet.</div>
          )}
        </div>
      </div>

      {/* Recent feed */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2 uppercase tracking-wider">
          Recent Referrals
        </h3>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="referrals-recent">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Referrer</th>
                <th className="p-3">Referred</th>
                <th className="p-3">Stage</th>
                <th className="p-3 text-right">Commission</th>
                <th className="p-3">Payout</th>
              </tr>
            </thead>
            <tbody>
              {recent.events.map((e, i) => (
                <tr key={i} className="border-t border-[var(--color-border)]">
                  <td className="p-3">{fmt(e.created_at)}</td>
                  <td className="p-3">
                    <div className="font-medium">{e.referrer_name || '—'}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{e.referrer_email}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{e.referred_name || '—'}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{e.referred_email}</div>
                  </td>
                  <td className="p-3">
                    {e.enrollment_xp_awarded ? (
                      <span className="text-green-500 text-xs font-medium">Enrolled</span>
                    ) : e.signup_xp_awarded ? (
                      <span className="text-[var(--color-accent)] text-xs font-medium">Signed up</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)] text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right">{fmtINR(e.commission_amount)}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      e.payout_status === 'paid' ? 'bg-green-500/10 text-green-500 border-green-500/30' :
                      e.payout_status === 'approved' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                      'bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                    }`}>
                      {e.payout_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recent.events.length === 0 && (
            <div className="p-8 text-center text-[var(--color-text-muted)]">No referral events yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { user, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'waitlist');
  const [selected, setSelected] = useState(null);

  useEffect(() => { setParams({ tab }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!user) return <Navigate to="/login" replace />;
  const email = (user?.email || profile?.email || '').toLowerCase();
  if (email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" data-testid="admin-denied">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">Admin access required.</h1>
          <p className="text-[var(--color-text-muted)] mb-4">Your account ({email || 'unknown'}) is not authorized for the admin panel.</p>
          <a href="/dashboard" className="text-[var(--color-accent)] hover:underline">← Back to dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-[var(--color-text)] font-bricolage">Admin Panel</h1>
            <button onClick={() => window.location.reload()} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1" data-testid="admin-refresh">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">Logged in as <strong>{email}</strong>.</p>
          <AdminTabs tab={tab} setTab={setTab} />
          {tab === 'waitlist'  && <WaitlistTab />}
          {tab === 'users'     && <UsersTab onSelect={(u) => { setSelected(u); setTab('users'); }} />}
          {tab === 'progress'  && <UsersTab onSelect={setSelected} />}
          {tab === 'referrals' && <ReferralsTab />}
        </div>
        <ProgressModal user={selected} onClose={() => setSelected(null)} />
      </main>
    </div>
  );
}

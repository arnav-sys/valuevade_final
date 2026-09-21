/**
 * Admin, Free Trials + Waitlist tab.
 * Shows two lists side-by-side and lets admins export CSV.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Download, Mail, CheckCircle2, Clock, X as XIcon } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

async function req(path) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${session?.access_token || ''}` },
  });
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch {/* raw */}
  if (!r.ok) throw new Error((j && (j.detail || j.message)) || t || `${r.status}`);
  return j;
}

function toCsv(rows, columns) {
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    columns.map((c) => c.label).join(','),
    ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(',')),
  ].join('\n');
}

function download(name, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function FreeTrialsTab() {
  const [data, setData] = useState({ trials: [], waitlist: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState('trials');
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true); setErr(null);
    try { setData(await req('/api/admin/free-trials')); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  if (err) return <div className="text-red-500 p-4" data-testid="ft-error">{err}</div>;

  const stats = data.counts || {};
  const deviceBlockedCount = (data.waitlist || []).filter((w) => (w.first_name || '').startsWith('[DEVICE-BLOCKED]')).length;
  const filteredWaitlist = showBlockedOnly
    ? (data.waitlist || []).filter((w) => (w.first_name || '').startsWith('[DEVICE-BLOCKED]'))
    : (data.waitlist || []);

  return (
    <div data-testid="admin-free-trials-tab">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] flex items-center gap-2">
            <Mail size={18}/> Free Trials + Waitlist
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Landing-page leads: emails that took the free J.P. Morgan mock, plus your organic waitlist.</p>
        </div>
        <button onClick={reload} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[var(--color-border)] text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-card-hover)]" data-testid="ft-refresh">
          <RefreshCw size={12}/> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <Stat label="Trials started" value={stats.trials_total || 0}/>
        <Stat label="Trials completed" value={stats.trials_completed || 0}/>
        <Stat label="Verdict: Offer" value={stats.trials_offer || 0}/>
        <Stat label="Waitlist signups" value={stats.waitlist_total || 0}/>
        <Stat label="Device-blocked" value={deviceBlockedCount} highlight={deviceBlockedCount > 0}/>
      </div>

      <div className="flex gap-1 border-b border-[var(--color-border)] mb-4">
        {['trials', 'waitlist'].map((t) => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors ${tab === t
              ? 'border-[var(--color-primary)] text-[var(--color-text)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
            data-testid={`ft-tab-${t}`}
          >
            {t === 'trials' ? `Free Trials (${data.trials.length})` : `Waitlist (${data.waitlist.length})`}
          </button>
        ))}
        <button
          onClick={() => {
            if (tab === 'trials') {
              download('free_trials.csv', toCsv(data.trials, [
                { key: 'email', label: 'Email' }, { key: 'firm_slug', label: 'Firm' },
                { key: 'status', label: 'Status' }, { key: 'verdict', label: 'Verdict' },
                { key: 'final_score', label: 'Score' }, { key: 'ref_source', label: 'Source' },
                { key: 'created_at', label: 'Started' }, { key: 'completed_at', label: 'Completed' },
              ]));
            } else {
              download('waitlist.csv', toCsv(data.waitlist, [
                { key: 'email', label: 'Email' }, { key: 'first_name', label: 'First name' },
                { key: 'position', label: 'Position' }, { key: 'referral_count', label: 'Referrals' },
                { key: 'timestamp', label: 'Joined' },
              ]));
            }
          }}
          className="ml-auto inline-flex items-center gap-1 px-3 py-1 text-xs text-[var(--color-primary)] hover:bg-[var(--color-bg-card-hover)] rounded"
          data-testid="ft-export"
        ><Download size={12}/> Export CSV</button>
      </div>

      {loading ? <p className="text-sm text-[var(--color-text-muted)]">Loading…</p> : (
        tab === 'trials' ? <TrialsTable rows={data.trials}/> : (
          <>
            {tab === 'waitlist' && (
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setShowBlockedOnly((v) => !v)}
                  data-testid="ft-blocked-filter"
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-all ${
                    showBlockedOnly
                      ? 'bg-red-500/15 border-red-500/40 text-red-400'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-red-500/40 hover:text-red-400'
                  }`}
                >
                  <XIcon size={9}/> Device-blocked only {deviceBlockedCount > 0 && `(${deviceBlockedCount})`}
                </button>
                {showBlockedOnly && (
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                    Showing {filteredWaitlist.length} of {data.waitlist.length}
                  </span>
                )}
              </div>
            )}
            <WaitlistTable rows={filteredWaitlist}/>
          </>
        )
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-red-500/30 bg-red-500/5' : 'border-[var(--color-border)] bg-[var(--color-bg-card)]'}`}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? 'text-red-400' : 'text-[var(--color-text)]'}`}>{value}</p>
    </div>
  );
}

function TrialsTable({ rows }) {
  if (!rows.length) return <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">No free trials started yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="ft-trials-table">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-bg-card-hover)] text-[10px] uppercase font-mono text-[var(--color-text-muted)]">
          <tr>
            <th className="px-3 py-2 text-left">Email</th>
            <th className="px-3 py-2 text-left">Firm</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Verdict</th>
            <th className="px-3 py-2 text-left">Score</th>
            <th className="px-3 py-2 text-left">Source</th>
            <th className="px-3 py-2 text-left">Started</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t border-[var(--color-border)]" data-testid={`ft-row-${t.email}`}>
              <td className="px-3 py-2 text-[var(--color-text)] font-mono text-[11px] break-all">{t.email}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">{t.firm_slug}</td>
              <td className="px-3 py-2">
                <StatusPill status={t.status}/>
              </td>
              <td className="px-3 py-2">
                {t.verdict === 'offer'
                  ? <span className="text-[var(--color-success)] text-[10px] font-mono uppercase">Offer</span>
                  : t.verdict === 'rejected'
                    ? <span className="text-red-400 text-[10px] font-mono uppercase">Rejected</span>
                    : '—'}
              </td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">{t.final_score ?? '—'}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)] text-[10px] break-all">{t.ref_source || 'landing'}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)] text-[10px]">{new Date(t.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    started: ['Started', 'text-amber-500 bg-amber-500/10', Clock],
    completed: ['Completed', 'text-[var(--color-success)] bg-[var(--color-success)]/10', CheckCircle2],
    abandoned: ['Abandoned', 'text-[var(--color-text-muted)] bg-[var(--color-bg-card-hover)]', XIcon],
  };
  const [label, cls, Icon] = map[status] || ['—', 'text-[var(--color-text-muted)] bg-transparent', Clock];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${cls}`}>
      <Icon size={10}/> {label}
    </span>
  );
}

function WaitlistTable({ rows }) {
  if (!rows.length) return <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">No waitlist signups.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="ft-waitlist-table">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-bg-card-hover)] text-[10px] uppercase font-mono text-[var(--color-text-muted)]">
          <tr>
            <th className="px-3 py-2 text-left">Email</th>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Position</th>
            <th className="px-3 py-2 text-left">Referrals</th>
            <th className="px-3 py-2 text-left">Joined</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.id} className="border-t border-[var(--color-border)]">
              <td className="px-3 py-2 font-mono text-[11px] break-all">{w.email}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">{w.first_name || '—'}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">{w.position ?? '—'}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">{w.referral_count ?? 0}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)] text-[10px]">{w.timestamp ? new Date(w.timestamp).toLocaleString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

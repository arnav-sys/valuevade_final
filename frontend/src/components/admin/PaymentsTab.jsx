import { useState, useEffect } from 'react';
import { Stat, authFetch, fmtINR, fmt, API } from './adminUtils';
import { supabase } from '../../lib/supabase';
import { Lock, Download, Loader2, Check } from 'lucide-react';

export default function PaymentsTab() {
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState(null);
  const [err, setErr] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    Promise.all([
      authFetch('/api/admin/payments/overview'),
      authFetch('/api/admin/payments/recent?limit=20'),
    ]).then(([o, r]) => { setData(o); setRecent(r); })
      .catch(e => setErr(e.message));
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/admin/payments/export`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'valuevade_payments.csv'; a.click();
      URL.revokeObjectURL(url);
      setExported(true);
      setTimeout(() => setExported(false), 8000);
    } catch (e) { alert('Export failed: ' + e.message); }
    finally { setExporting(false); }
  };

  if (err) return <div className="text-red-500 p-4">{err}</div>;
  if (!data || !recent) return <div className="p-4 text-[var(--color-text-muted)]">Loading…</div>;
  const s = data.stats;
  return (
    <div data-testid="admin-payments-tab">
      {data.mock_mode && (
        <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
          <Lock className="w-3.5 h-3.5" /> Razorpay running in mock mode, transactions are simulated until live keys are configured.
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6" data-testid="payments-stats">
        <Stat label="Total Revenue" value={fmtINR(s.total_revenue_inr)} />
        <Stat label="Paid Users" value={s.paid_users} />
        <Stat label="Free Users" value={s.free_users} />
        <Stat label="Avg Transaction" value={fmtINR(s.avg_txn_inr)} />
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider">Paid Users</h3>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={exporting} data-testid="export-payments-csv" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:border-green-500/50 hover:text-green-500 transition-all disabled:opacity-50">
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" data-testid="open-google-sheets" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] transition-all">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
            Open Google Sheets
          </a>
        </div>
      </div>

      {exported && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-400" data-testid="export-success-tip">
          <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>CSV downloaded!</strong> Now go to{' '}
            <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="underline font-semibold">sheets.new</a>
            {' '}→ <strong>File → Import → Upload</strong> → select <code className="px-1 bg-green-500/20 rounded">valuevade_payments.csv</code>.
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] mb-6" data-testid="payments-users-table">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr><th className="p-3">User</th><th className="p-3">Tier</th><th className="p-3 text-right">Amount</th><th className="p-3">Method</th><th className="p-3">Paid at</th></tr>
          </thead>
          <tbody>
            {(data.users || []).map(u => (
              <tr key={u.user_id} className="border-t border-[var(--color-border)]">
                <td className="p-3"><div className="font-medium">{u.full_name || '—'}</div><div className="text-xs text-[var(--color-text-muted)]">{u.email}</div></td>
                <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-card-hover)] border border-[var(--color-border)]">{u.pricing_tier || '—'}</span></td>
                <td className="p-3 text-right font-semibold">{fmtINR(u.amount_inr)}</td>
                <td className="p-3 capitalize">{u.method || '—'}</td>
                <td className="p-3">{fmt(u.paid_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data.users || []).length === 0 && <div className="p-8 text-center text-[var(--color-text-muted)]">No paid users yet.</div>}
      </div>

      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2 uppercase tracking-wider">Recent Transactions</h3>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="payments-recent">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr><th className="p-3">When</th><th className="p-3">User</th><th className="p-3 text-right">Amount</th><th className="p-3">Method</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {recent.payments.map((p, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="p-3">{fmt(p.created_at)}</td>
                <td className="p-3"><div className="font-medium">{p.full_name || '—'}</div><div className="text-xs text-[var(--color-text-muted)]">{p.email}</div></td>
                <td className="p-3 text-right font-semibold">{fmtINR(p.amount_inr)}</td>
                <td className="p-3 capitalize">{p.method || '—'}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${p.status === 'captured' ? 'bg-green-500/10 text-green-500 border-green-500/30' : p.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]'}`}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recent.payments.length === 0 && <div className="p-8 text-center text-[var(--color-text-muted)]">No transactions yet.</div>}
      </div>
    </div>
  );
}

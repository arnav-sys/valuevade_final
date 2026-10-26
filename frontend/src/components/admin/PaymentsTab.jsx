import { useState, useEffect } from 'react';
import { Stat, authFetch, fmtINR, fmt, API } from './adminUtils';
import { supabase } from '../../lib/supabase';
import { Lock, Download, Loader2, Check, AlertCircle, Copy, ExternalLink, Shield, CreditCard, Zap } from 'lucide-react';

function SetupBadge({ mode }) {
  const styles = {
    mock: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    test: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    live: 'bg-green-500/10 text-green-500 border-green-500/30',
  };
  const labels = { mock: 'Mock Mode', test: 'Test Mode', live: 'Live Mode' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-semibold uppercase tracking-wide ${styles[mode] || styles.mock}`}>
      {mode === 'live' ? <Zap className="w-3 h-3" /> : mode === 'test' ? <Shield className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
      {labels[mode] || 'Unknown'}
    </span>
  );
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="mb-2">
      <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-center gap-2 bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] rounded-lg px-3 py-2">
        <code className="text-xs text-[var(--color-text)] flex-1 truncate font-mono">{value}</code>
        <button onClick={copy} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors flex-shrink-0" title="Copy">
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function StatusRow({ label, ok }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-[var(--color-border)]'}`} />
      <span className="text-sm text-[var(--color-text)]">{label}</span>
      <span className={`ml-auto text-xs ${ok ? 'text-green-500' : 'text-[var(--color-text-muted)]'}`}>{ok ? 'Configured' : 'Not set'}</span>
    </div>
  );
}

export default function PaymentsTab() {
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState(null);
  const [setupStatus, setSetupStatus] = useState(null);
  const [err, setErr] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    Promise.all([
      authFetch('/api/admin/payments/overview'),
      authFetch('/api/admin/payments/recent?limit=20'),
      authFetch('/api/admin/payments/setup-status'),
    ]).then(([o, r, s]) => { setData(o); setRecent(r); setSetupStatus(s); })
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

  const courseWebhookUrl = `${API}/api/payments/webhook`;
  const resourceWebhookUrl = `${API}/api/resources/payment/webhook`;
  const s = data.stats;

  return (
    <div data-testid="admin-payments-tab">
      {/* ── Razorpay Configuration Panel ── */}
      <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden" data-testid="razorpay-setup-panel">
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-3 flex-wrap">
          <CreditCard className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text)] flex-1">Razorpay Configuration</h3>
          {setupStatus && <SetupBadge mode={setupStatus.mode} />}
          <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Open Dashboard
          </a>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-[var(--color-text)] mb-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[var(--color-primary)]" /> Webhook URLs
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              Register both in <strong>Razorpay → Webhooks</strong>. Enable <code className="bg-[var(--color-bg-card-hover)] px-1 rounded">payment.captured</code> and <code className="bg-[var(--color-bg-card-hover)] px-1 rounded">payment.failed</code>.
            </p>
            <CopyField label="Course enrolment payments" value={courseWebhookUrl} />
            <CopyField label="Resource standalone purchases" value={resourceWebhookUrl} />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--color-text)] mb-2 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[var(--color-primary)]" /> Status
            </p>
            {setupStatus ? (
              <div className="divide-y divide-[var(--color-border)]">
                <StatusRow label="Razorpay API Keys" ok={setupStatus.keys_configured} />
                <StatusRow label="Webhook Secret" ok={setupStatus.webhook_secret_configured} />
                <div className="flex items-center gap-2 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-border)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Key</span>
                  <code className="ml-auto text-xs text-[var(--color-text-muted)] font-mono">{setupStatus.key_id_display || '—'}</code>
                </div>
              </div>
            ) : <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-muted)]" />}
            {setupStatus && !setupStatus.webhook_secret_configured && (
              <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Set <strong>RAZORPAY_WEBHOOK_SECRET</strong> in Settings → Secrets to enable server-side payment confirmation.</span>
              </div>
            )}
            {setupStatus?.mode === 'live' && setupStatus.webhook_secret_configured && (
              <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/20 text-xs text-green-500">
                <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Live mode fully configured. Real payments are being collected and webhook is active.</span>
              </div>
            )}
          </div>
        </div>
        {setupStatus?.mode === 'test' && (
          <div className="px-4 pb-4 border-t border-[var(--color-border)]">
            <details className="group mt-3">
              <summary className="cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors list-none flex items-center gap-1.5 select-none">
                <ExternalLink className="w-3 h-3" /> How to switch to live keys
              </summary>
              <ol className="mt-2 ml-4 text-xs text-[var(--color-text-muted)] space-y-1 list-decimal">
                <li>Open <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline">Razorpay → Settings → API Keys</a> and generate Live keys</li>
                <li>Update <strong>RAZORPAY_KEY_ID</strong> and <strong>RAZORPAY_KEY_SECRET</strong> in this app's Settings → Secrets</li>
                <li>In <a href="https://dashboard.razorpay.com/app/webhooks" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline">Razorpay → Webhooks</a>, add both URLs above and copy the Webhook Secret</li>
                <li>Update <strong>RAZORPAY_WEBHOOK_SECRET</strong> in Settings → Secrets, then redeploy</li>
              </ol>
            </details>
          </div>
        )}
      </div>
      {/* ── End Configuration Panel ── */}

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

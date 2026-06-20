import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtINR } from '../../utils/razorpay';
import { History } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const fmt = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const STATUS_STYLES = {
  pending:  'bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]',
  approved: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  paid:     'bg-green-500/10 text-green-500 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/30',
};

export default function MyPayoutHistoryBlock({ refreshKey = 0 }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/payouts/my-requests`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (r.ok) {
        const j = await r.json();
        setRows(j.requests || []);
      } else setRows([]);
    })();
  }, [refreshKey]);

  if (rows === null) return null;
  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] mt-4" data-testid="payout-history-block">
      <h4 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider mb-3 flex items-center gap-2">
        <History className="w-4 h-4" /> Payout history
      </h4>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-card-hover)] border border-[var(--color-border)]">
            <div>
              <div className="text-sm font-semibold text-[var(--color-text)]">
                {fmtINR(r.amount_inr)} · {r.payout_method === 'upi' ? 'UPI' : 'Bank Transfer'}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Requested {fmt(r.requested_at)}
                {r.paid_at && ` · Paid ${fmt(r.paid_at)}`}
                {r.rejected_at && ` · Rejected ${fmt(r.rejected_at)}`}
              </div>
              {r.admin_notes && (
                <div className="text-xs text-[var(--color-text-muted)] italic mt-1">Admin: {r.admin_notes}</div>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded-full border font-semibold uppercase tracking-wider ${STATUS_STYLES[r.status] || STATUS_STYLES.pending}`}>
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

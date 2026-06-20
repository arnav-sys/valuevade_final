import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../Sidebar';
import { fmtINR } from '../../utils/razorpay';
import { Receipt } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const fmt = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
};

const STATUS_STYLES = {
  created:   'bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]',
  attempted: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  paid:      'bg-green-500/10 text-green-500 border-green-500/30',
  failed:    'bg-red-500/10 text-red-500 border-red-500/30',
  cancelled: 'bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]',
};

export default function MyOrdersPage() {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/payments/my-history`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (r.ok) setData(await r.json());
    })();
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto" data-testid="my-orders-page">
          <h1 className="text-3xl font-bold text-[var(--color-text)] font-bricolage mb-2 flex items-center gap-2">
            <Receipt className="w-7 h-7" /> My orders
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">All your Valuevade payments &amp; receipts.</p>

          {!data && <div className="text-[var(--color-text-muted)]">Loading…</div>}
          {data && (
            <>
              {data.status?.paid && (
                <div className="rounded-2xl p-5 bg-[var(--color-bg-card)] border border-green-500/30 mb-6">
                  <div className="text-xs uppercase tracking-wider text-green-500 font-semibold mb-1">Lifetime access · Active</div>
                  <div className="text-2xl font-bold text-[var(--color-text)] font-bricolage">
                    {fmtINR(data.status.paid_amount_inr)}
                    <span className="text-sm font-normal text-[var(--color-text-muted)] ml-2">
                      paid on {fmt(data.status.paid_at)} ({data.status.pricing_tier})
                    </span>
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-[var(--color-border)] overflow-x-auto">
                <table className="w-full text-sm" data-testid="orders-table">
                  <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
                    <tr>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Tier</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map(o => (
                      <tr key={o.id} className="border-t border-[var(--color-border)]">
                        <td className="p-3 font-mono text-xs">{o.razorpay_order_id?.slice(0, 18) || '—'}…</td>
                        <td className="p-3 font-semibold">{fmtINR(o.amount_inr)}</td>
                        <td className="p-3">{o.pricing_tier}</td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-1 rounded-full border font-medium ${STATUS_STYLES[o.status] || STATUS_STYLES.created}`}>
                            {o.status}
                            {o.mock_mode && <span className="ml-1 opacity-60">(mock)</span>}
                          </span>
                        </td>
                        <td className="p-3">{fmt(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.orders.length === 0 && (
                  <div className="p-8 text-center text-[var(--color-text-muted)]">No orders yet.</div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

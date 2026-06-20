import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtINR } from '../../utils/razorpay';
import { toast } from 'sonner';
import { X, Lock, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Modal for users to request a payout of their pending referral commission.
 * Props:
 *   pendingAmount: number (₹)
 *   minRedemption: number (₹)
 *   onClose: () => void
 *   onSubmitted: () => void
 */
export default function RedeemCommissionModal({ pendingAmount, minRedemption = 500, onClose, onSubmitted }) {
  const [amount, setAmount] = useState(Math.floor(pendingAmount || 0));
  const [method, setMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const amountValid = amount >= minRedemption && amount <= pendingAmount;
  const detailsValid = method === 'upi'
    ? /^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$/.test(upiId.trim())
    : (accountNo.trim().length >= 6 && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase()) && accountName.trim().length > 0);
  const canSubmit = amountValid && detailsValid && !submitting;

  const submit = async () => {
    setErr('');
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const body = {
        amount_inr: amount,
        payout_method: method,
        details: method === 'upi'
          ? { upi_id: upiId.trim() }
          : { account_no: accountNo.trim(), ifsc: ifsc.trim().toUpperCase(), account_name: accountName.trim() },
      };
      const r = await fetch(`${API}/api/payouts/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const detail = await r.text();
        setErr(`Request failed: ${detail}`);
        return;
      }
      toast.success("Request submitted. You'll hear back within 3–5 business days.");
      onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="redeem-commission-modal" className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--color-bg-card)] rounded-2xl max-w-lg w-full p-6 border border-[var(--color-border)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[var(--color-text)] font-bricolage">Redeem your earnings</h2>
          <button onClick={onClose} data-testid="redeem-close" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Pending commission: <strong className="text-[var(--color-text)]">{fmtINR(pendingAmount)}</strong>.
          Minimum withdrawal: {fmtINR(minRedemption)}.
        </p>

        {/* Amount */}
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Amount (₹)</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
          min={minRedemption}
          max={Math.floor(pendingAmount)}
          data-testid="redeem-amount"
          className="w-full mb-4 px-3 py-2 rounded-lg bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] text-[var(--color-text)] text-base"
        />

        {/* Method radio */}
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Payout method</label>
        <div className="grid grid-cols-2 gap-2 mb-4" data-testid="redeem-method-radio">
          {[
            { v: 'upi', label: 'UPI' },
            { v: 'bank_transfer', label: 'Bank Transfer' },
          ].map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setMethod(v)}
              data-testid={`redeem-method-${v}`}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                method === v
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-[var(--color-bg-card-hover)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {method === 'upi' ? (
          <>
            <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">UPI ID</label>
            <input
              type="text"
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
              placeholder="username@bank"
              data-testid="redeem-upi-id"
              className="w-full mb-4 px-3 py-2 rounded-lg bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] text-[var(--color-text)] text-base font-mono"
            />
          </>
        ) : (
          <>
            <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Account number</label>
            <input
              type="text"
              value={accountNo}
              onChange={e => setAccountNo(e.target.value.replace(/[^0-9]/g, ''))}
              data-testid="redeem-account-no"
              className="w-full mb-3 px-3 py-2 rounded-lg bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] text-[var(--color-text)] text-base font-mono"
            />
            <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">IFSC code</label>
            <input
              type="text"
              value={ifsc}
              onChange={e => setIfsc(e.target.value.toUpperCase())}
              placeholder="HDFC0000123"
              maxLength={11}
              data-testid="redeem-ifsc"
              className="w-full mb-3 px-3 py-2 rounded-lg bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] text-[var(--color-text)] text-base font-mono"
            />
            <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Account holder name</label>
            <input
              type="text"
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              data-testid="redeem-account-name"
              className="w-full mb-4 px-3 py-2 rounded-lg bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] text-[var(--color-text)] text-base"
            />
          </>
        )}

        <div className="rounded-lg p-3 bg-[var(--color-bg-card-hover)] border border-dashed border-[var(--color-border)] mb-4 text-xs text-[var(--color-text-muted)] flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Your bank / UPI details are AES-256 encrypted and only visible to the admin who processes
          your payout. Never shared, never logged.
        </div>

        {err && <div className="text-sm text-red-500 mb-3">{err}</div>}

        <button
          onClick={submit}
          disabled={!canSubmit}
          data-testid="redeem-submit-btn"
          className="w-full px-4 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:opacity-90 disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Submitting…' : `Request Payout of ${fmtINR(amount)}`}
        </button>
      </div>
    </div>
  );
}

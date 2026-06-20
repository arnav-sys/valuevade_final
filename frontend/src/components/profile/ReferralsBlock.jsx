import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Copy, Share2, Users, Lock, Wallet, TrendingUp, ArrowDownToLine } from 'lucide-react';
import RedeemCommissionModal from '../payments/RedeemCommissionModal';
import MyPayoutHistoryBlock from '../payments/MyPayoutHistoryBlock';

const API = process.env.REACT_APP_BACKEND_URL;

const fmtINR = (n) => {
  const v = Number(n || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(v);
};

export default function ReferralsBlock() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState('');
  const [showRedeem, setShowRedeem] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadMe = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(`${API}/api/referrals/me`, {
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    });
    if (r.ok) setData(await r.json());
  };

  useEffect(() => { loadMe(); }, [refreshKey]);

  const copy = async (text, kind) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(''), 1500);
    } catch { /* */ }
  };

  const doShare = async () => {
    if (!data?.share_url) return;
    if (navigator.share) {
      try { await navigator.share({ title: 'Join me on Valuevade', url: data.share_url }); }
      catch { /* user canceled */ }
    } else {
      copy(data.share_url, 'share');
    }
  };

  if (!data) {
    return <div className="rounded-2xl p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-muted)]">Loading referrals…</div>;
  }

  const paymentsLive = !!data.payment_processing_live;
  const minRedemption = data.min_redemption_inr || 500;
  const canRedeem = (data.earnings_pending || 0) >= minRedemption;

  return (
    <>
    <div className="rounded-2xl p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)]" data-testid="referrals-block">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--color-text)] font-bricolage flex items-center gap-2">
          <Users className="w-5 h-5" /> Refer Friends, Earn +500 XP Each
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          {data.next_milestone_at ? `Next badge at ${data.next_milestone_at} referrals` : 'All badges earned!'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat label="Your Code" value={data.code || '—'} mono />
        <Stat label="Signups" value={data.total_signups} />
        <Stat label="Enrolled" value={data.total_enrollments} />
        <Stat label="XP Earned" value={data.total_signups * 500 + data.total_enrollments * 500} suffix=" XP" />
      </div>

      {/* Earnings Cards — live commission with Redeem CTA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4" data-testid="referral-earnings-section">
        <EarningsCard
          icon={<Wallet className="w-4 h-4" />}
          label="Pending Commission"
          value={fmtINR(data.earnings_pending)}
          sublabel={`${data.commission_pct}% per paid referral`}
          locked={!paymentsLive}
          testid="earnings-pending-card"
        />
        <EarningsCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Lifetime Earnings"
          value={fmtINR(data.earnings_paid)}
          sublabel={`On ${fmtINR(data.lifetime_referred_revenue)} referred revenue`}
          locked={!paymentsLive}
          testid="earnings-paid-card"
        />
      </div>

      {/* Redeem CTA */}
      {paymentsLive && (
        <div className="mb-4">
          <button
            onClick={() => canRedeem && setShowRedeem(true)}
            disabled={!canRedeem}
            data-testid="redeem-commission-btn"
            title={canRedeem ? '' : `Minimum ${fmtINR(minRedemption)} to redeem`}
            className={`w-full px-4 py-2.5 rounded-xl font-semibold text-sm transition-all inline-flex items-center justify-center gap-2 ${
              canRedeem
                ? 'bg-[var(--color-primary)] text-white hover:opacity-90'
                : 'bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)] cursor-not-allowed border border-dashed border-[var(--color-border)]'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            {canRedeem
              ? `Redeem ${fmtINR(data.earnings_pending)} to UPI or Bank`
              : `Minimum ${fmtINR(minRedemption)} to redeem`}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] mb-3">
        <code className="flex-1 text-sm text-[var(--color-text)] font-mono break-all" data-testid="referral-share-url">
          {data.share_url}
        </code>
        <button onClick={() => copy(data.share_url, 'url')}
          data-testid="copy-share-url"
          className="px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium hover:opacity-90 inline-flex items-center gap-1">
          <Copy className="w-3 h-3" />{copied === 'url' ? 'Copied!' : 'Copy'}
        </button>
        <button onClick={doShare}
          data-testid="share-referral"
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] text-xs font-medium hover:bg-[var(--color-bg-card-hover)] inline-flex items-center gap-1">
          <Share2 className="w-3 h-3" /> Share
        </button>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Share your link. When a friend signs up and enrolls, you get <strong>+500 XP</strong> twice
        (once on signup, once on enrollment). When they upgrade to lifetime access, you earn
        <strong> {data.commission_pct}% commission</strong> on their payment — redeemable to UPI or
        bank account. Hit milestones (5, 15, 50 signups) to unlock the Networker, Influencer, and
        Talent Scout badges.
        {!paymentsLive && (
          <span className="block mt-1 text-[var(--color-text-muted)] italic">
            Cash payouts at {data.commission_pct}% commission are <strong>coming soon</strong>&mdash;you&apos;ll
            keep earning XP and stockpiling commission credits until then.
          </span>
        )}
      </p>
    </div>
    <MyPayoutHistoryBlock refreshKey={refreshKey} />
    {showRedeem && (
      <RedeemCommissionModal
        pendingAmount={data.earnings_pending || 0}
        minRedemption={minRedemption}
        onClose={() => setShowRedeem(false)}
        onSubmitted={() => {
          setShowRedeem(false);
          setRefreshKey(k => k + 1);
        }}
      />
    )}
    </>
  );
}

function EarningsCard({ icon, label, value, sublabel, locked, testid }) {
  return (
    <div
      data-testid={testid}
      className={`relative p-4 rounded-xl border ${locked
        ? 'bg-[var(--color-bg-card-hover)] border-dashed border-[var(--color-border)]'
        : 'bg-[var(--color-bg-card-hover)] border-[var(--color-border)]'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          {icon}{label}
        </div>
        {locked && (
          <span
            data-testid={`${testid}-lock`}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-text-muted)] px-2 py-0.5 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)]"
            title="Payment processing not live yet"
          >
            <Lock className="w-3 h-3" /> Coming soon
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold font-bricolage ${locked ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
        {value}
      </div>
      <div className="text-xs text-[var(--color-text-muted)] mt-1">{sublabel}</div>
    </div>
  );
}

function Stat({ label, value, mono, suffix = '' }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-bg-card-hover)] border border-[var(--color-border)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
      <div className={`text-base font-semibold text-[var(--color-text)] ${mono ? 'font-mono' : ''}`}>
        {value}{suffix}
      </div>
    </div>
  );
}

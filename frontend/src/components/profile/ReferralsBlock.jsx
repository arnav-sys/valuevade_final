import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Copy, Share2, Users } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ReferralsBlock() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/referrals/me`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (r.ok) setData(await r.json());
    })();
  }, []);

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

  return (
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

      <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] mb-3">
        <code className="flex-1 text-sm text-[var(--color-text)] font-mono break-all" data-testid="referral-share-url">
          {data.share_url}
        </code>
        <button onClick={() => copy(data.share_url, 'url')}
          data-testid="copy-share-url"
          className="px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 inline-flex items-center gap-1">
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
        (once on signup, once on enrollment). Hit milestones (5, 15, 50 signups) to unlock the
        Networker, Influencer, and Talent Scout badges.
      </p>
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

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import RewardCard from './RewardCard';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

// Persistent home for rewards on the Dashboard — RewardCard previously only
// ever rendered on the one-time ModuleProjectCompletePage/CapstoneCompletePage
// celebration screens, so a student who completed a module BEFORE an admin
// configured its reward (or who never revisited that page) had no way to
// ever see or claim it. This surfaces every currently-eligible reward.
export default function MyRewardsSection() {
  const { session } = useAuth();
  const [eligible, setEligible] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const token = session?.access_token;
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/api/rewards/eligible`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { console.warn('[rewards] eligibility check failed', res.status); return; }
        const data = await res.json();
        if (mounted && data.table_ready) {
          setEligible((data.rewards || []).filter((r) => r.eligible));
        }
      } catch (e) { console.warn('[rewards] eligibility check errored', e); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [session?.access_token]);

  if (loading || eligible.length === 0) return null;

  return (
    <section data-testid="dashboard-rewards-section">
      <div className="mb-4">
        <h2 className="font-clash text-lg font-semibold text-[var(--color-text)]">Your Rewards</h2>
        <p className="text-xs text-[var(--color-text-muted)] font-bricolage mt-0.5">
          Free resources you've unlocked by completing modules.
        </p>
      </div>
      {eligible.map((r) => (
        <RewardCard
          key={r.id}
          trigger={r.trigger_type}
          refId={r.trigger_ref_id}
          testidPrefix={`dashboard-reward-${r.id}`}
        />
      ))}
    </section>
  );
}

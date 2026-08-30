import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import RewardCard from './RewardCard';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
const seenKey = (userId, rewardId) => `vv_reward_seen_${userId}_${rewardId}`;

// Persistent home for rewards on the Dashboard — RewardCard previously only
// ever rendered on the one-time ModuleProjectCompletePage/CapstoneCompletePage
// celebration screens, so a student who completed a module BEFORE an admin
// configured its reward (or who never revisited that page) had no way to
// ever see or claim it. This surfaces every currently-eligible reward.
export default function MyRewardsSection() {
  const { session, user } = useAuth();
  const [eligible, setEligible] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newRewardIds, setNewRewardIds] = useState(new Set());

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
          const el = (data.rewards || []).filter((r) => r.eligible);
          setEligible(el);

          // One-time nudge: toast + "New" badge for any reward the user
          // hasn't been shown before (tracked per-user in localStorage so
          // it truly only fires once, ever — not just once per session).
          if (user?.id) {
            const unseen = el.filter((r) => {
              try { return localStorage.getItem(seenKey(user.id, r.id)) !== '1'; }
              catch { return false; }
            });
            if (unseen.length > 0) {
              setNewRewardIds(new Set(unseen.map((r) => r.id)));
              unseen.forEach((r) => {
                toast.success(`New reward unlocked: ${r.title}`, {
                  description: 'Head to your Dashboard\'s "Your Rewards" section to claim it.',
                  icon: <Gift size={16} />,
                  duration: 6000,
                });
                try { localStorage.setItem(seenKey(user.id, r.id), '1'); } catch { /* private mode */ }
              });
            }
          }
        }
      } catch (e) { console.warn('[rewards] eligibility check errored', e); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [session?.access_token, user?.id]);

  if (loading || eligible.length === 0) return null;

  return (
    <section data-testid="dashboard-rewards-section">
      <div className="mb-4 flex items-center gap-2.5">
        <div>
          <h2 className="font-clash text-lg font-semibold text-[var(--color-text)]">Your Rewards</h2>
          <p className="text-xs text-[var(--color-text-muted)] font-bricolage mt-0.5">
            Free resources you've unlocked by completing modules.
          </p>
        </div>
        {newRewardIds.size > 0 && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/40 animate-pulse"
            data-testid="dashboard-rewards-new-badge"
          >
            New
          </span>
        )}
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


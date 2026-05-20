import { useMemo, useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useBadges } from '../../contexts/BadgeContext';
import { iconForSlug, rarityColor } from '../../utils/badgeIcons';
import { todayISTKey } from '../../utils/xp';

function nmKey(today, userId) { return `vv_near_miss_dismissed_${today}_${userId || 'anon'}`; }

/**
 * Show the single highest-progress, non-secret, non-unlocked badge whose
 * progress >= 60%. Dismissible per IST day (persisted in localStorage).
 */
export default function NearMissBanner({ userId }) {
  const { badges } = useBadges();
  const [dismissed, setDismissed] = useState(false);
  const today = todayISTKey();
  const key = nmKey(today, userId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(key) === '1') setDismissed(true);
    } catch { /* private mode */ }
  }, [key]);

  const top = useMemo(() => {
    const candidates = (badges || [])
      .filter((b) => !b.is_unlocked && !b.is_secret && b.progress_target > 1)
      .filter((b) => (b.progress_pct || 0) >= 60)
      .sort((a, b) => (b.progress_pct || 0) - (a.progress_pct || 0));
    return candidates[0] || null;
  }, [badges]);

  if (!top || dismissed) return null;
  const Icon = iconForSlug(top.icon_slug);
  const rc = rarityColor(top.rarity);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(key, '1'); } catch { /* private mode */ }
  };

  return (
    <div
      className="glass-card rounded-2xl p-4 flex items-center gap-4"
      data-testid="near-miss-banner"
    >
      <div
        className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white grayscale opacity-80"
        style={{ background: `linear-gradient(135deg, ${rc.ring}, var(--color-accent-purple))` }}
      >
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-accent-pink)] mb-0.5">
          <Sparkles size={11} /> So close!
        </div>
        <div className="font-clash text-base font-bold text-[var(--color-text)] leading-tight">
          {top.progress_current}/{top.progress_target} \u00b7 {top.name}
        </div>
        <div className="text-xs font-bricolage text-[var(--color-text-muted)] mt-0.5">
          {top.description}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        aria-label="Dismiss"
        data-testid="near-miss-dismiss"
      >
        <X size={18} />
      </button>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { HelpCircle, Lock } from 'lucide-react';
import { useBadges } from '../../contexts/BadgeContext';
import { iconForSlug, rarityColor } from '../../utils/badgeIcons';

const CATEGORIES = [
  { key: 'all',         label: 'All' },
  { key: 'knowledge',   label: 'Knowledge' },
  { key: 'speed',       label: 'Speed' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'social',      label: 'Social' },
  { key: 'secret',      label: 'Secrets' },
];

function formatEarned(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return `Earned ${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  } catch { return null; }
}

export default function BadgeCabinet({ className = '' }) {
  const { badges, unlockedCount, total, bootstrapping } = useBadges();
  const [activeTab, setActiveTab] = useState('all');

  const filtered = useMemo(() => {
    if (activeTab === 'all') return badges;
    return badges.filter((b) => b.category === activeTab);
  }, [badges, activeTab]);

  const secretsUnlockedCount = useMemo(() => (
    badges.filter((b) => b.category === 'secret' && b.is_unlocked).length
  ), [badges]);

  if (bootstrapping) {
    return (
      <section className={`glass-card rounded-2xl p-5 animate-pulse ${className}`}>
        <div className="h-6 w-32 bg-[var(--color-surface)] rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 bg-[var(--color-surface)] rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={`glass-card rounded-2xl p-5 sm:p-6 ${className}`} data-testid="badge-cabinet">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)]">Achievements</h3>
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mt-0.5">
            {unlockedCount} / {total} unlocked
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 mb-5" data-testid="badge-cabinet-tabs">
        {CATEGORIES.map((cat) => {
          const active = activeTab === cat.key;
          const count = cat.key === 'all'
            ? total
            : cat.key === 'secret'
              ? `${secretsUnlockedCount} unlocked`
              : badges.filter((b) => b.category === cat.key).length;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveTab(cat.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider transition-all ${
                active
                  ? 'bg-[var(--color-primary)] text-white shadow-[0_0_16px_rgba(36,107,253,0.35)]'
                  : 'border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-text)]'
              }`}
              data-testid={`badge-cabinet-tab-${cat.key}`}
            >
              {cat.label} <span className="opacity-70 ml-1">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="badge-cabinet-grid">
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-sm font-bricolage text-[var(--color-text-muted)] py-8">
            No badges in this category yet.
          </div>
        )}
        {filtered.map((b) => (
          <BadgeTile key={b.code} badge={b} />
        ))}
      </div>
    </section>
  );
}

function BadgeTile({ badge }) {
  const rc = rarityColor(badge.rarity);
  const Icon = iconForSlug(badge.icon_slug);
  const earnedLabel = formatEarned(badge.earned_at);
  const isSecretLocked = badge.is_secret && !badge.is_unlocked;
  const nearMiss = !badge.is_unlocked && !badge.is_secret
    && badge.progress_target > 1
    && (badge.progress_pct >= 60);

  return (
    <div
      className={`relative rounded-xl p-3 sm:p-4 text-center transition-all ${
        badge.is_unlocked
          ? 'bg-[var(--color-surface)]/40 border'
          : 'bg-[var(--color-surface)]/20 border border-dashed opacity-90'
      }`}
      style={{
        borderColor: badge.is_unlocked ? rc.ring + '55' : 'var(--color-border)',
        boxShadow: badge.is_unlocked ? `0 0 8px ${rc.glow}60` : 'none',
      }}
      data-testid={`badge-tile-${badge.code}`}
      data-unlocked={badge.is_unlocked ? 'true' : 'false'}
      title={isSecretLocked ? 'Hidden achievement' : `${badge.name} \u2014 ${badge.description}`}
    >
      <div
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mx-auto mb-2"
        style={{
          background: badge.is_unlocked
            ? `linear-gradient(135deg, ${rc.ring}, var(--color-accent-purple))`
            : 'var(--color-surface)',
          color: badge.is_unlocked ? '#fff' : 'var(--color-text-faint)',
          filter: badge.is_unlocked ? 'none' : 'grayscale(1)',
        }}
      >
        {isSecretLocked ? <HelpCircle size={26} /> : <Icon size={26} />}
      </div>
      <div className="font-clash text-xs sm:text-sm font-bold text-[var(--color-text)] truncate">
        {isSecretLocked ? '???' : badge.name}
      </div>
      <div className="text-[10px] font-mono uppercase tracking-wider mt-0.5" style={{ color: rc.text }}>
        {isSecretLocked ? 'Hidden' : badge.rarity}
      </div>
      {!isSecretLocked && (
        <div className="text-[10px] font-bricolage text-[var(--color-text-muted)] mt-1 leading-snug line-clamp-2">
          {badge.description}
        </div>
      )}
      {badge.is_unlocked && earnedLabel && (
        <div className="text-[9px] font-mono text-[var(--color-text-faint)] mt-2 truncate">
          {earnedLabel}
        </div>
      )}
      {!badge.is_unlocked && !isSecretLocked && badge.progress_target > 1 && (
        <div className="mt-2">
          <div className="h-1 rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${Math.min(100, badge.progress_pct)}%`,
                background: `linear-gradient(90deg, ${rc.ring}, var(--color-accent-purple))`,
              }}
            />
          </div>
          <div className="text-[9px] font-mono text-[var(--color-text-faint)] mt-1">
            {badge.progress_current} / {badge.progress_target}
          </div>
        </div>
      )}
      {nearMiss && (
        <div
          className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-[var(--color-accent-pink)] text-white"
          data-testid={`badge-near-miss-${badge.code}`}
        >
          Near miss
        </div>
      )}
      {!badge.is_unlocked && !isSecretLocked && badge.progress_target === 1 && (
        <div className="absolute top-2 right-2 text-[var(--color-text-faint)]">
          <Lock size={11} />
        </div>
      )}
    </div>
  );
}

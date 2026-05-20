import { Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Settings, Sparkles, ArrowRight, Mail, Bell, Shield, Volume2, VolumeX } from 'lucide-react';
import { useSound } from '../contexts/SoundContext';

const COMING_SOON = [
  { icon: Bell, label: 'Email notifications', hint: 'Daily streak reminders and session nudges.' },
  { icon: Shield, label: 'Privacy controls', hint: 'Manage your data, exports, and account deletion.' },
  { icon: Mail, label: 'Contact preferences', hint: 'Choose what product updates you receive.' },
];

function SoundToggle() {
  const { enabled, toggleEnabled, playSound } = useSound();
  return (
    <button
      type="button"
      onClick={() => {
        const wasEnabled = enabled;
        toggleEnabled();
        if (!wasEnabled) {
          // Preview the sound on enable so user knows it works.
          // `force: true` bypasses the stale-closure check since the new
          // enabled=true state hasn't flushed into playSound's closure yet.
          setTimeout(() => playSound('xp_gain', { force: true }), 80);
        }
      }}
      className="glass-card rounded-2xl p-5 mb-4 w-full text-left flex items-center gap-4 hover:border-[var(--color-primary)]/40 transition-all"
      data-testid="settings-sound-toggle"
      aria-pressed={enabled}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all"
        style={{
          background: enabled
            ? 'linear-gradient(135deg, var(--color-primary), var(--color-accent-purple))'
            : 'var(--color-surface)',
          color: enabled ? '#fff' : 'var(--color-text-muted)',
        }}
      >
        {enabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-clash text-sm sm:text-base font-semibold text-[var(--color-text)]" data-testid="settings-sound-label">
          Sound effects
        </div>
        <div className="text-xs font-bricolage text-[var(--color-text-muted)] mt-0.5">
          Play subtle pops for XP gains and a celebratory chord on level ups.
        </div>
      </div>
      <span
        className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
        style={{
          background: enabled ? 'var(--color-primary)' : 'var(--color-border)',
        }}
        data-testid="settings-sound-track"
      >
        <span
          className="inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform absolute top-0.5"
          style={{ left: enabled ? '22px' : '2px' }}
          data-testid="settings-sound-thumb"
        />
      </span>
    </button>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative" data-testid="settings-page">
      <div className="absolute top-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.05] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[120px] pointer-events-none" />

      <Sidebar />

      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <div className="mb-8">
            <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)]" data-testid="settings-title">
              Settings
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] font-bricolage mt-1">
              Fine-tune your Valuevade experience.
            </p>
          </div>

          <SoundToggle />

          {/* Coming soon hero */}
          <div
            className="relative rounded-3xl p-[1.5px] mb-6 overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, var(--color-accent-purple) 0%, var(--color-primary) 100%)',
            }}
            data-testid="settings-coming-soon"
          >
            <div className="rounded-[22px] bg-[var(--color-surface)] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-accent-purple)]/20 to-[var(--color-primary)]/20 border border-[var(--color-accent-purple)]/30 flex items-center justify-center shrink-0">
                <Settings size={28} className="text-[var(--color-accent-purple)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-[10px] font-mono uppercase tracking-[0.2em] mb-3">
                  <Sparkles size={10} /> Coming soon
                </div>
                <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-2">
                  We're polishing this page.
                </h2>
                <p className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                  For now, you can change your name and theme from the{' '}
                  <Link to="/profile" className="text-[var(--color-primary)] hover:underline font-medium" data-testid="settings-profile-link">
                    Profile
                  </Link>{' '}
                  page. More controls are landing soon.
                </p>
              </div>
            </div>
          </div>

          {/* What's coming */}
          <div className="glass-card rounded-2xl p-5 sm:p-6" data-testid="settings-roadmap">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[var(--color-border)]">
              <Sparkles size={14} className="text-[var(--color-primary)]" />
              <h3 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                On the roadmap
              </h3>
            </div>
            <ul className="space-y-3">
              {COMING_SOON.map((item, i) => {
                const Icon = item.icon;
                return (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-surface)]/60 border border-[var(--color-border)]"
                    data-testid={`settings-roadmap-item-${i}`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-clash text-sm font-semibold text-[var(--color-text)]">{item.label}</div>
                      <div className="text-xs font-bricolage text-[var(--color-text-muted)] mt-0.5">{item.hint}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-6 flex justify-end">
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold font-bricolage bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-all"
              data-testid="settings-go-profile"
            >
              Go to Profile
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

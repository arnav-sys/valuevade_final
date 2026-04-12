import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, LogOut } from 'lucide-react';

export default function DashboardPage() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Ambient bg */}
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.03] blur-[140px] pointer-events-none" />

      {/* Nav bar */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="dashboard-logo">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8" />
            <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
          </Link>
          <div className="flex items-center gap-4">
            {profile && <span className="text-sm text-[var(--color-text-muted)] font-bricolage hidden sm:block" data-testid="dashboard-user-name">{profile.full_name}</span>}
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all font-bricolage"
              data-testid="dashboard-signout-button"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-20 relative z-10">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/20 flex items-center justify-center mb-6">
            <LayoutDashboard size={36} className="text-[var(--color-accent-purple)]" />
          </div>
          <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-3" data-testid="dashboard-heading">Dashboard</h1>
          <p className="text-[var(--color-text-muted)] font-bricolage max-w-md mb-8">
            Your personalized learning dashboard is under development. Track progress, manage courses, and more — all in one place.
          </p>
          <div className="glass-card rounded-2xl px-8 py-6 inline-flex items-center gap-3" data-testid="dashboard-coming-soon">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent-purple)] animate-pulse" />
            <span className="text-sm font-mono text-[var(--color-text-muted)]">UNDER DEVELOPMENT</span>
          </div>
        </div>
      </main>
    </div>
  );
}

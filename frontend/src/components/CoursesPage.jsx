import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, LogOut } from 'lucide-react';

export default function CoursesPage() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Ambient bg */}
      <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-[var(--color-primary)] opacity-[0.03] blur-[140px] pointer-events-none" />

      {/* Nav bar */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="courses-logo">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8" />
            <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
          </Link>
          <div className="flex items-center gap-4">
            {profile && <span className="text-sm text-[var(--color-text-muted)] font-bricolage hidden sm:block" data-testid="courses-user-name">{profile.full_name}</span>}
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all font-bricolage"
              data-testid="courses-signout-button"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-20 relative z-10">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center mb-6">
            <BookOpen size={36} className="text-[var(--color-primary)]" />
          </div>
          <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-3" data-testid="courses-heading">Courses</h1>
          <p className="text-[var(--color-text-muted)] font-bricolage max-w-md mb-8">
            Premium finance courses are being crafted by industry experts. You&apos;ll be the first to know when they launch.
          </p>
          <div className="glass-card rounded-2xl px-8 py-6 inline-flex items-center gap-3" data-testid="courses-coming-soon">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)] animate-pulse" />
            <span className="text-sm font-mono text-[var(--color-text-muted)]">COMING SOON</span>
          </div>
        </div>
      </main>
    </div>
  );
}

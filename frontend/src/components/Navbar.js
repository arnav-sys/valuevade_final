import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Menu, X, LogOut, Sun, Moon } from 'lucide-react';

const navLinks = [
  { label: 'Features', id: 'features' },
  { label: 'How It Works', id: 'how-it-works' },
  { label: 'AI-Proof', id: 'ai-proof' },
  { label: 'Roadmap', id: 'features' },
];

export default function Navbar({ onJoinWaitlist, landingTheme, onToggleLandingTheme }) {
  const { user, profile, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // When the LandingPage passes its own theme state in, the navbar's toggle
  // controls the landing palette only (not the global app theme).
  const isLandingScoped = typeof onToggleLandingTheme === 'function';
  const activeTheme = isLandingScoped ? landingTheme : theme;
  const onToggleTheme = isLandingScoped ? onToggleLandingTheme : toggleTheme;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const isLoggedIn = !loading && !!user;

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--color-border)]'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2"
          data-testid="navbar-logo"
        >
          <img src="/valuevade-logo.svg" alt="Valuevade Logo" className="w-8 h-8 object-contain" />
          <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
        </button>

        {/* Center links - desktop */}
        <div className="hidden md:flex items-center gap-4 lg:gap-8 md:ml-8 lg:ml-12">
          <Link
            to="/courses"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors font-bricolage whitespace-nowrap"
            data-testid="nav-link-courses"
          >
            Courses
          </Link>
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => scrollTo(link.id)}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors font-bricolage whitespace-nowrap"
              data-testid={`nav-link-${link.id}`}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Right side - desktop */}
        <div className="hidden md:flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all"
            data-testid="theme-toggle"
            aria-label="Toggle theme"
          >
            {activeTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {loading ? (
            <div className="w-20 h-8" />
          ) : isLoggedIn ? (
            <>
              <Link
                to="/dashboard"
                className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors font-bricolage"
                data-testid="nav-dashboard-link"
              >
                Dashboard
              </Link>
              {profile && (
                <span className="text-sm text-[var(--color-text-muted)] font-bricolage px-2" data-testid="nav-user-name">
                  {profile.full_name}
                </span>
              )}
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all font-bricolage"
                data-testid="nav-signout-button"
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 lg:px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors font-bricolage whitespace-nowrap"
                data-testid="nav-login-link"
              >
                Log In
              </Link>
              <Link
                to="/login"
                className="px-4 lg:px-5 py-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-full hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all font-bricolage whitespace-nowrap"
                data-testid="nav-signup-link"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Hamburger - mobile */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-[var(--color-text)]"
          data-testid="nav-hamburger"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile overlay menu */}
      {menuOpen && (
        <div
          className="md:hidden fixed left-0 right-0 bottom-0 z-40 flex flex-col items-center justify-center gap-8 overflow-y-auto py-10"
          style={{
            top: '64px',
            background: 'var(--bg-primary)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
          data-testid="mobile-menu-overlay"
        >
          <Link
            to="/courses"
            onClick={() => setMenuOpen(false)}
            className="text-2xl text-[var(--color-text-secondary)] hover:text-[var(--color-text)] font-clash transition-colors"
            data-testid="mobile-nav-courses"
          >
            Courses
          </Link>
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => scrollTo(link.id)}
              className="text-2xl text-[var(--color-text-secondary)] hover:text-[var(--color-text)] font-clash transition-colors"
              data-testid={`mobile-nav-${link.id}`}
            >
              {link.label}
            </button>
          ))}

          {/* Mobile theme toggle */}
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-2 text-lg text-[var(--color-text-muted)] font-bricolage"
            data-testid="mobile-theme-toggle"
          >
            {activeTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            {activeTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          {loading ? null : isLoggedIn ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="text-2xl text-[var(--color-text-secondary)] hover:text-[var(--color-text)] font-clash transition-colors"
                data-testid="mobile-nav-dashboard"
              >
                Dashboard
              </Link>
              <button
                onClick={() => { setMenuOpen(false); signOut(); }}
                className="px-8 py-3 bg-[var(--color-surface)] text-[var(--color-text)] font-semibold rounded-full text-lg flex items-center gap-2 font-bricolage border border-[var(--color-border)]"
                data-testid="mobile-signout-btn"
              >
                <LogOut size={18} /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="px-8 py-3 bg-[var(--color-surface)] text-[var(--color-text)] font-semibold rounded-full text-lg font-bricolage border border-[var(--color-border)]"
                data-testid="mobile-nav-login"
              >
                Log In
              </Link>
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="px-8 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-full text-lg font-bricolage"
                data-testid="mobile-nav-signup"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}

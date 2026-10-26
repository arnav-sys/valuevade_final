import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Menu, X, LogOut, Sun, Moon, ArrowRight } from 'lucide-react';
import { AudienceSwitch } from './enterprise/AudienceContext';

/* Editorial finance / Bloomberg-terminal Navbar (Feb 2026).
 * - Thin top status bar with mock market widgets (static content).
 * - Mono uppercase primary nav with underline-on-hover.
 * - Sharp signup CTA (2px radius).
 * - Mobile overlay layout untouched, brief kept it out of scope. */

const navLinks = [
  { label: 'Features', id: 'features' },
  { label: 'How It Works', id: 'how-it-works' },
];

export default function Navbar({ landingTheme, onToggleLandingTheme, navOnDark }) {
  const { user, profile, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    else window.location.assign(`/#${id}`);
  };

  const isLoggedIn = !loading && !!user;

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 w-full z-50 transition-[background-color,backdrop-filter,border-color] duration-300 backdrop-blur-md border-b ${
        scrolled ? 'lv-nav-scrolled bg-[var(--bg-primary)]/85 border-[var(--color-border)]' : 'bg-[var(--bg-primary)]/40 border-transparent'
      }${navOnDark && !scrolled ? ' nav-on-dark-hero' : ''}`}
    >
      {isLandingScoped && (
        <div className={`lv-masthead hidden md:block transition-[max-height,opacity] duration-300 overflow-hidden ${scrolled ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100'}`} data-testid="nav-masthead">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-7 flex items-center justify-between">
            <span>Valuevade · Your AI finance mentor</span>
            <span>₹4999 lifetime · Free first session</span>
          </div>
        </div>
      )}
      {/* Main nav row */}
      <nav className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link
          to="/"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2"
          data-testid="navbar-logo"
        >
          <img src="/valuevade-logo.svg" alt="Valuevade Logo" className="w-8 h-8 object-contain" />
          <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
        </Link>

        <div className="hidden xl:flex items-center gap-4">
          <AudienceSwitch id="student-nav" />
          <Link to="/resources" className="lv-nav-link" data-testid="nav-link-resources">Resources</Link>
          {isLoggedIn && <Link to="/purchases" className="lv-nav-link" data-testid="nav-link-purchases">My purchases</Link>}
          <Link to="/courses" className="lv-nav-link" data-testid="nav-link-courses">
            All Courses
          </Link>
          <Link to="/ai-agents" className="lv-nav-link" data-testid="nav-link-ai-agents">AI Agents</Link>
          <Link to="/free-mock-interview" className="lv-nav-link inline-flex items-center gap-1.5"
            style={{ color: 'var(--color-primary)' }} data-testid="nav-link-free-mock">
            Free Mock
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"
              aria-hidden="true"
            />
          </Link>
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => scrollTo(link.id)}
              className="lv-nav-link"
              data-testid={`nav-link-${link.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden xl:flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className="w-9 h-9 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
            data-testid="theme-toggle"
            aria-label="Toggle theme"
          >
            {activeTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {loading ? (
            <div className="w-20 h-8" />
          ) : isLoggedIn ? (
            <>
              <Link
                to="/dashboard"
                className="lv-nav-link"
                data-testid="nav-dashboard-link"
              >
                Dashboard
              </Link>
              {profile && (
                <span className="text-xs text-[var(--color-text-muted)] font-jetbrains uppercase tracking-wider px-2" data-testid="nav-user-name">
                  {profile.full_name}
                </span>
              )}
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
                data-testid="nav-signout-button"
                aria-label="Sign out"
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="lv-nav-link" data-testid="nav-login-link">
                Log In
              </Link>
              <Link
                to="/signup"
                className="lv-cta"
                style={{ padding: '9px 16px', fontSize: '13px' }}
                data-testid="nav-signup-link"
              >
                Sign Up <ArrowRight size={12} strokeWidth={2.5} />
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="xl:hidden text-[var(--color-text)]"
          data-testid="nav-hamburger"
          aria-label="Open menu"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile overlay menu, kept exactly as before per brief scope */}
      {menuOpen && (
        <div
          className="xl:hidden fixed left-0 right-0 z-40 flex flex-col items-center gap-5 overflow-y-auto py-6"
          style={{
            top: '64px',
            height: 'calc(100dvh - 64px)',
            background: 'var(--bg-primary)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
          data-testid="mobile-menu-overlay"
        >
          <AudienceSwitch id="student-mobile" />
          <Link to="/resources" onClick={() => setMenuOpen(false)} className="text-xl" data-testid="mobile-nav-resources">Resources</Link>
          {isLoggedIn && <Link to="/purchases" onClick={() => setMenuOpen(false)} className="text-xl" data-testid="mobile-nav-purchases">My purchases</Link>}
          <Link
            to="/courses"
            onClick={() => setMenuOpen(false)}
            className="text-2xl text-[var(--color-text-secondary)] hover:text-[var(--color-text)] font-clash transition-colors"
            data-testid="mobile-nav-courses"
          >
            All Courses
          </Link>
          <Link to="/ai-agents" onClick={() => setMenuOpen(false)} className="text-xl" data-testid="mobile-nav-ai-agents">AI Agents</Link>
          <Link
            to="/free-mock-interview"
            onClick={() => setMenuOpen(false)}
            className="text-2xl font-semibold text-[var(--color-accent-purple)] font-clash inline-flex items-center gap-2"
            data-testid="mobile-nav-free-mock"
          >
            Free Mock
            <span
              className="w-2 h-2 rounded-full bg-[var(--color-accent-pink)]"
              style={{ boxShadow: '0 0 10px rgba(255,106,193,0.85)' }}
              aria-hidden="true"
            />
          </Link>
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => scrollTo(link.id)}
              className="text-2xl text-[var(--color-text-secondary)] hover:text-[var(--color-text)] font-clash transition-colors"
              data-testid={`mobile-nav-${link.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              {link.label}
            </button>
          ))}

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
                to="/signup"
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

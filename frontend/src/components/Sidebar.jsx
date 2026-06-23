import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  Home, BookOpen, User, Settings, LogOut, Menu, X, ChevronDown, ChevronRight,
  Sun, Moon, ChevronLeft, Trophy, Library, MessageCircleQuestion, Sparkles, Crown,
} from 'lucide-react';
import { useOpenDoubts } from '../contexts/OpenDoubtsContext';

/**
 * Persistent left sidebar for all authenticated pages.
 * - Desktop: fixed 250px, collapsible to 60px icon-only
 * - Mobile: hidden by default, slide-in overlay via hamburger
 */
export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { count: openDoubtsCount } = useOpenDoubts();

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('vv-sidebar-collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [courseExpanded, setCourseExpanded] = useState(true);
  const [enrollment, setEnrollment] = useState(null);

  useEffect(() => {
    localStorage.setItem('vv-sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Fetch active enrollment for "My Course" sub-nav
  useEffect(() => {
    let mounted = true;
    async function fetchEnrollment() {
      if (!user?.id) return;
      try {
        const { data: enr } = await supabase
          .from('user_enrollments')
          .select('id, master_path_id, title, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        if (!mounted || !enr) return;
        setEnrollment(enr);
      } catch {
        // ignore
      }
    }
    fetchEnrollment();
    return () => { mounted = false; };
  }, [user?.id, location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navItems = useMemo(
    () => [
      { label: 'Dashboard', icon: Home, path: '/dashboard', testid: 'nav-dashboard' },
      {
        label: 'My Course',
        icon: BookOpen,
        path: enrollment ? `/course/${enrollment.master_path_id}` : '/courses',
        testid: 'nav-my-course',
        expandable: true,
      },
      { label: 'Profile', icon: User, path: '/profile', testid: 'nav-profile' },
      { label: 'Leaderboard', icon: Crown, path: '/leaderboard', testid: 'nav-leaderboard' },
      { label: 'Portfolio', icon: Trophy, path: '/portfolio', testid: 'nav-portfolio' },
      { label: 'Capstones', icon: Sparkles, path: '/capstones', testid: 'nav-capstones' },
      { label: 'Review Notes', icon: Library, path: '/review', testid: 'nav-review-notes' },
      { label: 'My Doubts', icon: MessageCircleQuestion, path: '/doubts', testid: 'nav-my-doubts', badgeCount: openDoubtsCount },
      { label: 'Settings', icon: Settings, path: '/settings', testid: 'nav-settings' },
    ],
    [enrollment, openDoubtsCount]
  );

  const isActive = (p) => {
    if (p === '/dashboard') return location.pathname === '/dashboard';
    if (p.startsWith('/course')) return location.pathname.startsWith('/course');
    return location.pathname === p;
  };

  const SidebarInner = ({ forMobile = false }) => {
    const showLabels = forMobile ? true : !collapsed;
    const widthCls = forMobile ? 'w-[280px]' : collapsed ? 'w-[60px]' : 'w-[250px]';

    return (
      <aside
        className={`${widthCls} h-screen sticky top-0 flex flex-col bg-[var(--bg-secondary)]/60 backdrop-blur-xl border-r border-[var(--color-border)] transition-[width] duration-300 ease-out`}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--color-border)] shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2 min-w-0" data-testid="sidebar-logo">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8 shrink-0" />
            {showLabels && (
              <span className="font-clash text-lg font-semibold logo-gradient truncate">
                Valuevade
              </span>
            )}
          </Link>
          {forMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
              data-testid="sidebar-close-mobile"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            if (item.expandable && enrollment && showLabels) {
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setCourseExpanded((v) => !v)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bricolage transition-all ${
                      active
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]'
                    }`}
                    data-testid={item.testid}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {courseExpanded ? (
                      <ChevronDown size={14} className="shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="shrink-0" />
                    )}
                  </button>

                  {courseExpanded && (
                    <div className="mt-1 ml-3 pl-3 border-l border-[var(--color-border)]" data-testid="sidebar-enrolled-path">
                      <Link
                        to={`/course/${enrollment.master_path_id}`}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all"
                        data-testid="sidebar-enrolled-path-link"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                        <span className="truncate">{enrollment.title}</span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                to={item.path}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bricolage transition-all ${
                  active
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]'
                } ${!showLabels ? 'justify-center' : ''}`}
                data-testid={item.testid}
                title={!showLabels ? item.label : undefined}
              >
                <Icon size={18} className="shrink-0" />
                {showLabels && <span className="flex-1 truncate">{item.label}</span>}
                {showLabels && item.badgeCount > 0 && (
                  <span
                    className="ml-auto inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-mono font-bold shrink-0"
                    data-testid={`${item.testid}-pill`}
                  >
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                )}
                {!showLabels && item.badgeCount > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--color-primary)]"
                    data-testid={`${item.testid}-dot`}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="border-t border-[var(--color-border)] p-2 space-y-1 shrink-0">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all ${!showLabels ? 'justify-center' : ''}`}
            data-testid="sidebar-theme-toggle"
            title={!showLabels ? 'Toggle theme' : undefined}
          >
            {theme === 'dark' ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
            {showLabels && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          {/* User + logout */}
          {showLabels && profile && (
            <div className="px-3 py-2 text-[11px] text-[var(--color-text-faint)] font-mono truncate" data-testid="sidebar-user-name">
              {profile.full_name || profile.email}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-all ${!showLabels ? 'justify-center' : ''}`}
            data-testid="sidebar-signout"
            title={!showLabels ? 'Sign out' : undefined}
          >
            <LogOut size={18} className="shrink-0" />
            {showLabels && <span>Sign out</span>}
          </button>

          {/* Collapse toggle - desktop only */}
          {!forMobile && (
            <button
              onClick={() => setCollapsed((v) => !v)}
              className={`hidden lg:flex w-full items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-all ${!showLabels ? 'justify-center' : ''}`}
              data-testid="sidebar-collapse-toggle"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Collapse</span></>}
            </button>
          )}
        </div>
      </aside>
    );
  };

  return (
    <>
      {/* Mobile hamburger (only visible below lg) */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--color-border)] text-[var(--color-text)] shadow-lg"
        data-testid="sidebar-hamburger"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        <SidebarInner />
      </div>

      {/* Mobile overlay + drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            data-testid="sidebar-mobile-overlay"
          />
          <div className="lg:hidden fixed top-0 left-0 z-50 h-screen">
            <SidebarInner forMobile />
          </div>
        </>
      )}
    </>
  );
}

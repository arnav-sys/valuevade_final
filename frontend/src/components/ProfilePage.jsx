import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import XPBar from './gamification/XPBar';
import StreakCounter from './gamification/StreakCounter';
import BadgeCabinet from './gamification/BadgeCabinet';
import ActivityHeatmap from './gamification/ActivityHeatmap';
import RecentActivityFeed from './gamification/RecentActivityFeed';
import {
  User, Mail, Pencil, Check, X, Loader2, LogOut, Sun, Moon, Flame, Clock,
  BookOpen, Layers, Trophy, Rocket, Sparkles, Calendar, AlertCircle, RefreshCw,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { getStudyPlanDashboardSummary } from '../utils/studyPlanner';

function initialsFrom(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '·';
}

function StatCard({ icon: Icon, label, value, suffix, accent = 'primary', testid }) {
  const map = {
    primary: 'from-[var(--color-primary)]/15 to-[var(--color-primary)]/5 text-[var(--color-primary)] border-[var(--color-primary)]/20',
    purple: 'from-[var(--color-accent-purple)]/15 to-[var(--color-accent-purple)]/5 text-[var(--color-accent-purple)] border-[var(--color-accent-purple)]/20',
    pink: 'from-[var(--color-accent-pink)]/15 to-[var(--color-accent-pink)]/5 text-[var(--color-accent-pink)] border-[var(--color-accent-pink)]/20',
    success: 'from-[var(--color-success)]/15 to-[var(--color-success)]/5 text-[var(--color-success)] border-[var(--color-success)]/20',
  };
  return (
    <div className="glass-card rounded-2xl p-5" data-testid={testid}>
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${map[accent]} border flex items-center justify-center mb-3`}>
        <Icon size={18} />
      </div>
      <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">{label}</div>
      <div className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)]">
        {value}
        {suffix && <span className="text-sm font-bricolage text-[var(--color-text-muted)] ml-1 font-normal">{suffix}</span>}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, updateProfile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [enrollment, setEnrollment] = useState(null);
  const [modules, setModules] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [capstone, setCapstone] = useState(null);
  // Phase D2 — plan adherence stats (3 numbers — no chart in this block).
  const [planSummary, setPlanSummary] = useState(null);
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      try {
        const { ok, data } = await getStudyPlanDashboardSummary();
        if (alive) setPlanSummary(ok ? data : null);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    if (profile?.full_name) setNameInput(profile.full_name);
  }, [profile?.full_name]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const { data: enr } = await supabase
          .from('user_enrollments')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['active', 'completed']);

        const activeEnr =
          (enr || []).find((e) => e.status === 'active') ||
          (enr || []).find((e) => e.status === 'completed') ||
          null;
        if (!mounted) return;
        setEnrollment(activeEnr);

        if (!activeEnr) {
          setLoading(false);
          return;
        }

        const { data: mods } = await supabase
          .from('user_modules')
          .select('id, title, order_index, is_completed, is_removed')
          .eq('enrollment_id', activeEnr.id)
          .eq('is_removed', false)
          .order('order_index');

        const activeModules = mods || [];
        if (!mounted) return;
        setModules(activeModules);

        const moduleIds = activeModules.map((m) => m.id);

        const [sessRes, statsRes, capRes] = await Promise.all([
          moduleIds.length
            ? supabase
                .from('user_sessions')
                .select('id, is_completed, is_removed')
                .in('user_module_id', moduleIds)
                .eq('is_removed', false)
            : Promise.resolve({ data: [] }),
          supabase.from('user_stats').select('*').eq('enrollment_id', activeEnr.id).maybeSingle().then(
            (r) => r,
            () => ({ data: null })
          ),
          supabase
            .from('user_capstone_projects')
            .select('is_completed, is_unlocked')
            .eq('enrollment_id', activeEnr.id)
            .maybeSingle()
            .then((r) => r, () => ({ data: null })),
        ]);

        if (!mounted) return;
        setSessions(sessRes.data || []);
        setStats(statsRes.data || null);
        setCapstone(capRes.data || null);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load profile');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [user?.id]);

  const progress = useMemo(() => {
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.is_completed).length;
    const totalModules = modules.length;
    const completedModules = modules.filter((m) => m.is_completed).length;
    const pct = totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0;
    const timeMin = stats?.total_time_minutes || 0;
    let timeLabel = `${timeMin}`;
    let timeSuffix = 'min';
    if (timeMin >= 60) {
      const hrs = Math.floor(timeMin / 60);
      const rem = timeMin % 60;
      timeLabel = rem ? `${hrs}h ${rem}m` : `${hrs}`;
      timeSuffix = rem ? '' : 'hrs';
    }
    return {
      totalSessions, completedSessions, totalModules, completedModules, pct,
      streak: stats?.streak || 0,
      timeLabel, timeSuffix,
    };
  }, [sessions, modules, stats]);

  const memberSince = useMemo(() => {
    const dateStr = user?.created_at || profile?.created_at;
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long',
    });
  }, [user?.created_at, profile?.created_at]);

  const handleStartEdit = () => {
    setNameInput(profile?.full_name || '');
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setNameInput(profile?.full_name || '');
    setEditing(false);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty');
      return;
    }
    if (trimmed === profile?.full_name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error: upErr } = await updateProfile({ full_name: trimmed });
    setSaving(false);
    if (upErr) {
      toast.error(upErr.message || 'Could not update name');
      return;
    }
    toast.success('Profile updated');
    setEditing(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate('/');
  };

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'Valuevade Learner';
  const email = profile?.email || user?.email || '—';
  const initials = initialsFrom(profile?.full_name, email);

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] relative" data-testid="profile-page">
      <div className="absolute top-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.05] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[120px] pointer-events-none" />

      <Sidebar />

      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <div className="mb-8">
            <h1 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)]" data-testid="profile-title">
              Profile
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] font-bricolage mt-1">
              Your account, preferences, and learning journey.
            </p>
          </div>

          {/* Identity card */}
          <div className="glass-card rounded-2xl p-6 sm:p-8 mb-6" data-testid="profile-identity">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar */}
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 border border-[var(--color-primary)]/30 shadow-[0_0_24px_rgba(36,107,253,0.2)]"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent-purple) 100%)',
                }}
                data-testid="profile-avatar"
              >
                <span className="font-clash text-2xl font-bold text-white">{initials}</span>
              </div>

              <div className="flex-1 min-w-0 w-full">
                {/* Name (view / edit) */}
                {!editing ? (
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] truncate" data-testid="profile-name">
                      {displayName}
                    </h2>
                    <button
                      onClick={handleStartEdit}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 border border-transparent hover:border-[var(--color-primary)]/20 transition-all"
                      data-testid="profile-edit-name-btn"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1 flex-wrap" data-testid="profile-edit-row">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      maxLength={80}
                      autoFocus
                      disabled={saving}
                      className="flex-1 min-w-[200px] bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-[var(--color-primary)] rounded-lg px-3 py-2 text-[var(--color-text)] font-bricolage outline-none transition-colors"
                      data-testid="profile-name-input"
                      placeholder="Your name"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold font-bricolage hover:brightness-110 transition-all disabled:opacity-60"
                      data-testid="profile-save-name-btn"
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all"
                      data-testid="profile-cancel-name-btn"
                    >
                      <X size={13} /> Cancel
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm font-bricolage text-[var(--color-text-muted)]" data-testid="profile-email">
                  <Mail size={13} />
                  <span className="truncate">{email}</span>
                </div>

                {memberSince && (
                  <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-faint)] mt-1.5" data-testid="profile-member-since">
                    <Calendar size={11} />
                    Member since {memberSince}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 mb-6" data-testid="profile-preferences">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--color-border)]">
              <Sparkles size={14} className="text-[var(--color-accent-purple)]" />
              <h3 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                Preferences
              </h3>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-clash text-sm font-semibold text-[var(--color-text)]">Appearance</div>
                <div className="text-xs font-bricolage text-[var(--color-text-muted)] mt-0.5">
                  {theme === 'dark' ? 'Dark mode — easier on the eyes' : 'Light mode — bright and crisp'}
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-bricolage text-[var(--color-text)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-all"
                data-testid="profile-theme-toggle"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              </button>
            </div>
          </div>

          {/* Learning journey */}
          <div className="mb-6">
            <BadgeCabinet className="mb-6" />
            <div className="mt-6"><ActivityHeatmap /></div>
            <div className="mt-6"><RecentActivityFeed limit={10} /></div>
            <div className="flex items-end justify-between mb-4">
              <div>
                <h3 className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)]">
                  Learning journey
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] font-bricolage mt-0.5">
                  {enrollment ? enrollment.title : 'No active enrollment'}
                </p>
              </div>
              {enrollment?.status === 'completed' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20" data-testid="profile-enrollment-completed">
                  <Trophy size={11} /> Completed
                </span>
              )}
            </div>

            {loading && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="profile-stats-loading">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 rounded-2xl bg-[var(--color-surface)]" />
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="glass-card rounded-2xl p-6 flex flex-col items-center text-center" data-testid="profile-stats-error">
                <AlertCircle size={22} className="text-[var(--color-error)] mb-2" />
                <p className="text-sm text-[var(--color-text)] font-bricolage mb-3">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold font-bricolage"
                >
                  <RefreshCw size={13} /> Retry
                </button>
              </div>
            )}

            {!loading && !error && !enrollment && (
              <div className="glass-card rounded-2xl p-6 flex flex-col items-center text-center" data-testid="profile-no-enrollment">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/20 flex items-center justify-center mb-3">
                  <BookOpen size={22} className="text-[var(--color-accent-purple)]" />
                </div>
                <p className="text-sm text-[var(--color-text)] font-bricolage mb-1">No active enrollment yet</p>
                <p className="text-xs text-[var(--color-text-muted)] font-bricolage mb-4">
                  Pick a career path and start learning.
                </p>
                <button
                  onClick={() => navigate('/courses')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all"
                  data-testid="profile-browse-courses"
                >
                  Browse Courses
                </button>
              </div>
            )}

            {!loading && !error && enrollment && (
              <>
                {/* XP bar */}
                <div className="mb-5 flex items-start gap-3" data-testid="profile-xp-bar-wrap">
                  <div className="flex-1 min-w-0">
                    <XPBar />
                  </div>
                  <div className="hidden sm:block shrink-0 pt-1">
                    <StreakCounter />
                  </div>
                </div>
                <div className="sm:hidden mb-3">
                  <StreakCounter />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5" data-testid="profile-stats-grid">
                  <StatCard
                    icon={BookOpen}
                    label="Sessions"
                    value={progress.completedSessions}
                    suffix={`/ ${progress.totalSessions}`}
                    accent="primary"
                    testid="profile-stat-sessions"
                  />
                  <StatCard
                    icon={Layers}
                    label="Modules"
                    value={progress.completedModules}
                    suffix={`/ ${progress.totalModules}`}
                    accent="purple"
                    testid="profile-stat-modules"
                  />
                  <StatCard
                    icon={Flame}
                    label="Streak"
                    value={progress.streak}
                    suffix={progress.streak === 1 ? 'day' : 'days'}
                    accent="pink"
                    testid="profile-stat-streak"
                  />
                  <StatCard
                    icon={Clock}
                    label="Time spent"
                    value={progress.timeLabel}
                    suffix={progress.timeSuffix}
                    accent="success"
                    testid="profile-stat-time"
                  />
                </div>

                {/* Phase D2 — Plan Adherence (3 stats, no chart) */}
                {planSummary?.active_plan && (
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5" data-testid="profile-plan-adherence">
                    <StatCard
                      icon={Flame}
                      label="On-schedule streak"
                      value={planSummary.adherence?.on_schedule_streak_days || 0}
                      suffix={(planSummary.adherence?.on_schedule_streak_days || 0) === 1 ? 'day' : 'days'}
                      accent="pink"
                      testid="profile-stat-plan-streak"
                    />
                    <StatCard
                      icon={Trophy}
                      label="Longest streak"
                      value={planSummary.adherence?.longest_on_schedule_streak || 0}
                      suffix={(planSummary.adherence?.longest_on_schedule_streak || 0) === 1 ? 'day' : 'days'}
                      accent="purple"
                      testid="profile-stat-plan-longest"
                    />
                    <StatCard
                      icon={Calendar}
                      label="On schedule"
                      value={(() => {
                        const days = planSummary?.cumulative?.days_so_far || [];
                        if (!days.length) return '—';
                        const need = days.reduce((s, d) => s + (d.required_minutes_cum > 0 ? 1 : 0), 0);
                        // approximate "on schedule" = days where cumulative actual >= cumulative required
                        const ok = days.filter((d) => d.actual_minutes_cum >= d.required_minutes_cum).length;
                        return need > 0 ? `${Math.round(ok / days.length * 100)}%` : '—';
                      })()}
                      suffix="of plan"
                      accent="primary"
                      testid="profile-stat-plan-percent"
                    />
                  </div>
                )}

                {/* Overall progress bar */}
                <div className="glass-card rounded-2xl p-5" data-testid="profile-overall-progress-wrap">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Rocket size={14} className="text-[var(--color-primary)]" />
                      <span className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                        Overall progress
                      </span>
                    </div>
                    <span className="text-xs font-mono text-[var(--color-text-muted)]" data-testid="profile-progress-pct">
                      {progress.pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] rounded-full transition-all duration-700"
                      style={{ width: `${progress.pct}%` }}
                    />
                  </div>
                  {capstone?.is_completed && (
                    <div className="mt-4 flex items-center gap-2 text-xs font-mono text-[var(--color-success)]" data-testid="profile-capstone-badge">
                      <Trophy size={12} /> Capstone project completed
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Danger zone */}
          <div className="glass-card rounded-2xl p-5 sm:p-6" data-testid="profile-account-actions">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--color-border)]">
              <User size={14} className="text-[var(--color-text-muted)]" />
              <h3 className="font-clash text-sm font-semibold uppercase tracking-[0.15em] text-[var(--color-text)]">
                Account
              </h3>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="font-clash text-sm font-semibold text-[var(--color-text)]">Sign out</div>
                <div className="text-xs font-bricolage text-[var(--color-text-muted)] mt-0.5">
                  You'll need to log in again to continue learning.
                </div>
              </div>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)] text-sm font-bricolage font-semibold hover:bg-[var(--color-error)]/15 transition-all disabled:opacity-60"
                data-testid="profile-signout-btn"
              >
                {signingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
                Sign out
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

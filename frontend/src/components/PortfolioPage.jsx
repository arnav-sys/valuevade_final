import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Sparkles, Flame, Award, Target, Clock, Activity, Copy,
  Check, ExternalLink, Lock, ChevronRight, BookOpen, Star,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import BadgeCabinet from './gamification/BadgeCabinet';
import ActivityHeatmap from './gamification/ActivityHeatmap';
import ModuleConstellationMap from './gamification/ModuleConstellationMap';
import AvatarPersona from './tutor/AvatarPersona';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

async function authedFetch(path, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('not_authenticated');
  return fetch(`${BACKEND}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

function StatTile({ icon: Icon, label, value, sub, testid }) {
  return (
    <div
      data-testid={testid}
      className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-4 sm:p-5 flex flex-col gap-1.5"
    >
      <div className="flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)] font-mono">
        {Icon && <Icon size={12} />}<span>{label}</span>
      </div>
      <div className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] leading-tight">{value}</div>
      {sub && <div className="text-xs text-[var(--color-text-muted)] font-bricolage">{sub}</div>}
    </div>
  );
}

function SkillPill({ label }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-text)] px-3 py-1.5 text-xs font-bricolage font-semibold">
      <Sparkles size={11} className="text-[var(--color-primary)]" />{label}
    </span>
  );
}

function HeadlineQuote({ value, copy, testid }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    if (navigator?.clipboard) navigator.clipboard.writeText(copy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }, [copy]);
  return (
    <button
      onClick={onCopy}
      data-testid={testid}
      className="group block w-full text-left rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-5 hover:border-[var(--color-primary)]/40 transition-colors"
    >
      <div className="font-clash text-xl sm:text-2xl font-bold text-[var(--color-text)] leading-snug">{value}</div>
      <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] flex items-center gap-1">
        {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
        {copied ? 'Copied!' : 'Tap to copy'}
      </div>
    </button>
  );
}

function InterviewRadar({ technical, communication, structure }) {
  // Normalise to 0–1 (input expected ~0–5 OR 0–100).
  const norm = (v) => {
    const n = Number(v) || 0;
    if (n <= 5) return Math.max(0, Math.min(1, n / 5));
    return Math.max(0, Math.min(1, n / 100));
  };
  const a = norm(technical);
  const b = norm(communication);
  const c = norm(structure);
  // 3 points on an equilateral triangle around origin.
  const cx = 100, cy = 100, r = 80;
  const pts = [
    [cx + r * Math.cos(-Math.PI / 2) * a, cy + r * Math.sin(-Math.PI / 2) * a],
    [cx + r * Math.cos(Math.PI / 6) * b, cy + r * Math.sin(Math.PI / 6) * b],
    [cx + r * Math.cos((5 * Math.PI) / 6) * c, cy + r * Math.sin((5 * Math.PI) / 6) * c],
  ];
  const polygon = pts.map(p => p.join(',')).join(' ');
  const guide = (frac) => `M${cx},${cy - r * frac} L${cx + r * Math.cos(Math.PI / 6) * frac},${cy + r * Math.sin(Math.PI / 6) * frac} L${cx + r * Math.cos((5 * Math.PI) / 6) * frac},${cy + r * Math.sin((5 * Math.PI) / 6) * frac} Z`;
  return (
    <svg viewBox="0 0 200 200" className="w-full h-auto max-w-[260px] mx-auto">
      {[0.33, 0.66, 1].map(f => (
        <path key={f} d={guide(f)} fill="none" stroke="var(--glass-border)" strokeWidth="0.8" />
      ))}
      <polygon points={polygon} fill="rgba(36,107,253,0.2)" stroke="var(--color-primary)" strokeWidth="1.4" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.4" fill="var(--color-primary)" />
      ))}
      <text x={cx} y={cy - r - 8} textAnchor="middle" className="fill-[var(--color-text-muted)] font-mono" fontSize="10">TECHNICAL</text>
      <text x={cx + r * Math.cos(Math.PI / 6) + 14} y={cy + r * Math.sin(Math.PI / 6) + 4} className="fill-[var(--color-text-muted)] font-mono" fontSize="10">COMMS</text>
      <text x={cx + r * Math.cos((5 * Math.PI) / 6) - 14} y={cy + r * Math.sin((5 * Math.PI) / 6) + 4} textAnchor="end" className="fill-[var(--color-text-muted)] font-mono" fontSize="10">STRUCTURE</text>
    </svg>
  );
}

export default function PortfolioPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await authedFetch('/api/portfolio/me');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message || 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.id) fetchPortfolio(); }, [user?.id, fetchPortfolio]);

  const firstName = useMemo(() => (data?.full_name || '').split(' ')[0] || 'Analyst', [data]);

  const memberSinceYM = useMemo(() => {
    if (!data?.member_since) return '';
    try {
      const d = new Date(data.member_since);
      return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch { return ''; }
  }, [data]);

  const totalHours = Math.max(0, Math.round((data?.total_time_minutes || 0) / 60));

  if (loading) {
    return (
      <div className="min-h-screen pl-[60px] lg:pl-[250px] p-6" data-testid="portfolio-loading">
        <div className="max-w-5xl mx-auto animate-pulse space-y-6">
          <div className="h-32 rounded-2xl bg-[var(--glass-bg)]" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-[var(--glass-bg)]" />)}
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen pl-[60px] lg:pl-[250px] p-6" data-testid="portfolio-error">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-red-400/40 bg-red-400/10 p-6 text-red-200">
            <div className="font-clash font-bold mb-2">Couldn't load your portfolio</div>
            <div className="text-sm">{error}</div>
            <button onClick={fetchPortfolio} className="mt-3 rounded-full bg-[var(--color-primary)] text-white px-4 py-2 text-xs font-semibold">Try again</button>
          </div>
        </div>
      </div>
    );
  }

  const recentBadges = data?.recent_badges || [];
  const skills = data?.skills_earned || [];
  const modules = data?.modules || [];

  // Pull interview score components from the avg jsonb-derived numbers. The
  // legacy structure stored {technical, communication, structure} but the
  // aggregate view collapses them to a single avg. As a portfolio summary we
  // render the same average across the 3 axes as a baseline; once the
  // simulation/interview pipeline starts storing per-axis scores we can
  // surface them individually.
  const interviewAvg = data?.avg_interview_score || 0;

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]" data-testid="portfolio-page">
      <Sidebar />
      <main className="flex-1 min-w-0 relative z-10 pt-16 lg:pt-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 space-y-10 sm:space-y-12">

        {/* 1. Hero */}
        <section className="relative" data-testid="portfolio-hero">
          <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-5 sm:p-7 lg:p-9 overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-mono text-[var(--color-text-muted)] mb-2 flex items-center gap-2">
                  <Trophy size={12} className="text-[var(--color-primary)]" /> PORTFOLIO
                </div>
                <h1 className="font-clash text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text)] leading-tight" data-testid="portfolio-name">
                  {data.full_name || 'Valuevade Analyst'}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bricolage text-[var(--color-text-muted)]">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                    style={{ borderColor: `${data.level_color_hex || '#246BFD'}55`, color: data.level_color_hex || 'var(--color-primary)' }}
                    data-testid="portfolio-level-badge"
                  >
                    <Star size={11} /> Level {data.current_level} — {data.level_name || 'Analyst'}
                  </span>
                  {data.current_streak_days > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30 px-2.5 py-1 text-xs font-semibold" data-testid="portfolio-streak-chip">
                      <Flame size={11} /> {data.current_streak_days}-day streak
                    </span>
                  )}
                  {data.daily_champion_days_total > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2.5 py-1 text-xs font-semibold" data-testid="portfolio-champion-chip">
                      <Trophy size={11} /> {data.daily_champion_days_total}× Daily Champion
                    </span>
                  )}
                </div>
                <div className="mt-4 text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage">
                  Finance Analyst in training since <span className="text-[var(--color-text)] font-semibold">{memberSinceYM || '—'}</span>.
                  <span className="block sm:inline mt-1 sm:mt-0 sm:ml-2">
                    <span className="text-[var(--color-text)] font-bold">{(data.total_xp || 0).toLocaleString()} XP</span> earned · <span className="text-[var(--color-text)] font-semibold">{data.modules_completed || 0}</span> of 15 modules mastered.
                  </span>
                </div>
              </div>
              <div className="shrink-0 hidden sm:block">
                <AvatarPersona
                  pose="encouraging"
                  size="md"
                  position="inline"
                  message={`Here's your finance journey so far, ${firstName}.`}
                  showSpeechBubble={true}
                  ariaLabel="Pari — your finance tutor"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 2. Stats grid */}
        <section data-testid="portfolio-stats-grid">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">By the numbers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatTile icon={Sparkles} label="TOTAL XP" value={(data.total_xp || 0).toLocaleString()} sub={`+${data.xp_to_next || 0} to ${data.next_level_name || 'next'}`} testid="stat-xp" />
            <StatTile icon={BookOpen} label="MODULES" value={`${data.modules_completed || 0}/15`} sub={`${data.modules_in_progress || 0} in progress`} testid="stat-modules" />
            <StatTile icon={Target} label="SESSIONS" value={(data.sessions_completed || 0).toString()} sub={`of ${data.sessions_total || 0} enrolled`} testid="stat-sessions" />
            <StatTile icon={Award} label="BADGES" value={`${data.badges_total || 0}/23`} sub={`${data.badges_legendary || 0}L · ${data.badges_epic || 0}E · ${data.badges_rare || 0}R · ${data.badges_common || 0}C`} testid="stat-badges" />
            <StatTile icon={Flame} label="LONGEST STREAK" value={`${data.longest_streak_days || 0}d`} testid="stat-streak" />
            <StatTile icon={Clock} label="TIME INVESTED" value={`${totalHours}h`} sub={`${data.total_time_minutes || 0}m total`} testid="stat-time" />
            <StatTile icon={Activity} label="ACTIVE DAYS / 90" value={(data.active_days_last_90 || 0).toString()} testid="stat-active" />
            <StatTile icon={Trophy} label="DAILY CHAMPION" value={`${data.daily_champion_days_total || 0}×`} testid="stat-champion" />
          </div>
        </section>

        {/* 3. Skills */}
        <section data-testid="portfolio-skills">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">Skills earned</h2>
          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => <SkillPill key={s} label={s} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <AvatarPersona pose="encouraging" size="sm" position="inline" showSpeechBubble={false} ariaLabel="Pari" />
              <div className="text-sm text-[var(--color-text-muted)] font-bricolage">Complete your first module to earn your first skill. Each module unlocks 3–4 finance skills.</div>
            </div>
          )}
        </section>

        {/* 4. Module journey — reuse constellation map */}
        <section data-testid="portfolio-journey">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)]">Module journey</h2>
            <Link to="/journey" className="text-xs text-[var(--color-primary)] font-bricolage flex items-center gap-1 hover:underline">
              See full map <ChevronRight size={12} />
            </Link>
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mb-3 font-mono uppercase tracking-[0.18em]">
            {data.modules_completed || 0} of 15 modules mastered
          </div>
          <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-2 sm:p-4">
            <ModuleConstellationMap fullscreen={false} />
          </div>
        </section>

        {/* 5. Projects */}
        <section data-testid="portfolio-projects">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">Projects portfolio</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Capstone */}
            <div
              className={`rounded-2xl border p-5 ${data.capstone_completed ? 'border-yellow-400/40 bg-gradient-to-br from-yellow-400/10 via-orange-500/5 to-pink-500/5' : 'border-[var(--glass-border)] bg-[var(--glass-bg)]'} backdrop-blur`}
              data-testid="portfolio-capstone-card"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-mono text-[var(--color-text-muted)] mb-2">
                <Trophy size={12} className={data.capstone_completed ? 'text-yellow-400' : ''} /> CAPSTONE
              </div>
              <div className="font-clash text-lg font-bold text-[var(--color-text)]">
                {data.capstone_completed ? 'Capstone Earned' : 'Capstone Pending'}
              </div>
              {data.capstone_completed && data.capstone_completed_at && (
                <div className="text-xs text-[var(--color-text-muted)] mt-1 font-bricolage">
                  Completed {new Date(data.capstone_completed_at).toLocaleDateString()}
                </div>
              )}
              {data.capstone_completed ? (
                <Link to="/capstone/complete" className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-primary)] font-bricolage hover:underline">
                  View Certificate <ExternalLink size={11} />
                </Link>
              ) : (
                <div className="mt-3 text-xs text-[var(--color-text-muted)] flex items-center gap-1.5 font-bricolage">
                  <Lock size={11} /> Complete all modules to unlock your capstone
                </div>
              )}
            </div>
            {/* Module projects */}
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-5" data-testid="portfolio-modproj-card">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-mono text-[var(--color-text-muted)] mb-2">
                <Target size={12} /> MODULE PROJECTS
              </div>
              <div className="font-clash text-3xl font-bold text-[var(--color-text)]">
                {data.module_projects_completed || 0}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1 font-bricolage">
                projects completed{data.last_module_project_at ? ` · last on ${new Date(data.last_module_project_at).toLocaleDateString()}` : ''}
              </div>
            </div>
          </div>
        </section>

        {/* 6. Interview radar */}
        <section data-testid="portfolio-interview">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">Interview performance</h2>
          {interviewAvg > 0 ? (
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-5 flex flex-col sm:flex-row gap-5 items-center">
              <div className="flex-1 max-w-[260px]"><InterviewRadar technical={interviewAvg} communication={interviewAvg} structure={interviewAvg} /></div>
              <div className="text-sm text-[var(--color-text-muted)] font-bricolage">
                Average score: <span className="text-[var(--color-text)] font-bold">{Number(interviewAvg).toFixed(1)}/5</span>
                <div className="mt-1.5">Avg quiz: <span className="text-[var(--color-text)] font-semibold">{data.avg_quiz_score ? `${Number(data.avg_quiz_score).toFixed(0)}%` : '—'}</span></div>
                <div className="mt-1.5">Avg simulation: <span className="text-[var(--color-text)] font-semibold">{data.avg_simulation_score ? `${Number(data.avg_simulation_score).toFixed(0)}%` : '—'}</span></div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-5 text-sm text-[var(--color-text-muted)] font-bricolage">
              Complete an interview to build your skill profile.
            </div>
          )}
        </section>

        {/* 7. Badge cabinet */}
        <section data-testid="portfolio-badges">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">Badge cabinet</h2>
          <BadgeCabinet />
        </section>

        {/* 8. Activity heatmap */}
        <section data-testid="portfolio-heatmap">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">90-day activity</h2>
          <ActivityHeatmap />
        </section>

        {/* 9. Headline stats — share-copy bits */}
        <section data-testid="portfolio-headlines">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">Quotable highlights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <HeadlineQuote
              value={`I've trained ${totalHours} hours of finance.`}
              copy={`I've trained ${totalHours} hours of finance on Valuevade.`}
              testid="headline-hours"
            />
            <HeadlineQuote
              value={`${data.modules_completed || 0} modules mastered.`}
              copy={`${data.modules_completed || 0} of 15 modules mastered on Valuevade.`}
              testid="headline-modules"
            />
            <HeadlineQuote
              value={`${data.current_streak_days || 0}-day streak.`}
              copy={`${data.current_streak_days || 0}-day streak on Valuevade — every day showing up.`}
              testid="headline-streak"
            />
            <HeadlineQuote
              value={`Level ${data.current_level} — ${data.level_name || 'Analyst'}.`}
              copy={`Level ${data.current_level} (${data.level_name || 'Analyst'}) on Valuevade.`}
              testid="headline-level"
            />
          </div>
        </section>

        {/* 10. Share section removed (P53 fix); backend kept for future use. */}

      </div>
      </main>
    </div>
  );
}

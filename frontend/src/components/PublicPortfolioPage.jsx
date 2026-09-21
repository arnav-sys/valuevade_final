import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Trophy, Sparkles, Flame, Award, Target, Clock, Activity, Lock, BookOpen, Star,
} from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const TIER_COLORS = ['#1a2030', '#1f5733', '#2d9145', '#3ed05b', '#9c6bff'];
function tierFor(xp) {
  const v = Number(xp) || 0;
  if (v <= 0) return 0;
  if (v <= 25) return 1;
  if (v <= 75) return 2;
  if (v <= 150) return 3;
  return 4;
}

function PublicHeatmap({ rows = [] }) {
  // Build a dense 13-week × 7-day grid from the rows the API returned.
  const map = new Map(rows.map((r) => [r.date_ist, r]));
  // 91-day window ending today (IST approximation client-side).
  const today = new Date();
  const ist = new Date(today.getTime() + 5.5 * 60 * 60 * 1000);
  const cells = [];
  for (let i = 90; i >= 0; i -= 1) {
    const d = new Date(ist.getTime() - i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const row = map.get(iso);
    cells.push({ iso, xp: row?.xp_earned || 0 });
  }
  // Group into columns of 7.
  const cols = [];
  for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
  return (
    <div className="flex gap-1 overflow-x-auto py-1" data-testid="public-heatmap">
      {cols.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-1">
          {col.map((c) => (
            <div
              key={c.iso}
              title={`${c.iso}: ${c.xp} XP`}
              className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[3px]"
              style={{ background: TIER_COLORS[tierFor(c.xp)] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, testid }) {
  return (
    <div data-testid={testid} className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-4 sm:p-5 flex flex-col gap-1.5">
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

function ModuleNode({ mod }) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 ${mod.is_completed ? 'border-yellow-400 bg-yellow-400/15' : (mod.completion_percent > 0 ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/30')}`}
      title={mod.title}
    >
      <div className="text-xs font-mono text-[var(--color-text)] font-bold">M{mod.order_index}</div>
      {mod.is_completed && <Trophy size={10} className="absolute -top-1 -right-1 text-yellow-400 bg-[var(--bg-primary)] rounded-full p-0.5" />}
    </div>
  );
}

export default function PublicPortfolioPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND}/api/portfolio/public/${encodeURIComponent(slug)}`);
        if (!alive) return;
        if (res.status === 404) { setNotFound(true); return; }
        const json = await res.json();
        if (!res.ok) { setNotFound(true); return; }
        setData(json);
      } catch {
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen p-6" data-testid="public-portfolio-loading">
        <div className="max-w-4xl mx-auto animate-pulse space-y-6">
          <div className="h-32 rounded-2xl bg-[var(--glass-bg)]" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-[var(--glass-bg)]" />)}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" data-testid="public-portfolio-notfound">
        <div className="max-w-md text-center space-y-4">
          <Lock size={32} className="mx-auto text-[var(--color-text-muted)]" />
          <h1 className="font-clash text-2xl font-bold text-[var(--color-text)]">This portfolio is private or doesn't exist.</h1>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage">
            The owner may have turned off public sharing, or the link is mistyped.
          </p>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] hover:brightness-110 text-white px-5 py-2.5 text-sm font-semibold">
            Visit Valuevade
          </Link>
        </div>
      </div>
    );
  }

  const totalHours = Math.max(0, Math.round((data.total_time_minutes || 0) / 60));
  const skills = data.skills_earned || [];
  const modules = data.modules || [];
  const recentBadges = data.recent_badges || [];

  return (
    <div className="min-h-screen" data-testid="public-portfolio-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        {/* Hero */}
        <section data-testid="public-portfolio-hero">
          <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-5 sm:p-7 lg:p-9 overflow-hidden">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-mono text-[var(--color-text-muted)] mb-2 flex items-center gap-2">
              <Trophy size={12} className="text-[var(--color-primary)]" /> PORTFOLIO
            </div>
            <h1 className="font-clash text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text)] leading-tight" data-testid="public-name">
              {data.full_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bricolage text-[var(--color-text-muted)]">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={{ borderColor: `${data.level_color_hex || '#246BFD'}55`, color: data.level_color_hex || 'var(--color-primary)' }}
                data-testid="public-level"
              >
                <Star size={11} /> Level {data.current_level}, {data.level_name || 'Analyst'}
              </span>
              {data.current_streak_days > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30 px-2.5 py-1 text-xs font-semibold">
                  <Flame size={11} /> {data.current_streak_days}-day streak
                </span>
              )}
              {data.daily_champion_days_total > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2.5 py-1 text-xs font-semibold">
                  <Trophy size={11} /> {data.daily_champion_days_total}× Daily Champion
                </span>
              )}
            </div>
            <div className="mt-4 text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage">
              Finance Analyst in training since <span className="text-[var(--color-text)] font-semibold">{data.member_since_ym || '—'}</span>.
              <span className="block sm:inline mt-1 sm:mt-0 sm:ml-2">
                <span className="text-[var(--color-text)] font-bold">{(data.total_xp || 0).toLocaleString()} XP</span> earned · <span className="text-[var(--color-text)] font-semibold">{data.modules_completed || 0}</span> of 15 modules mastered.
              </span>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section data-testid="public-stats-grid">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">By the numbers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatTile icon={Sparkles} label="TOTAL XP" value={(data.total_xp || 0).toLocaleString()} testid="public-stat-xp" />
            <StatTile icon={BookOpen} label="MODULES" value={`${data.modules_completed || 0}/15`} testid="public-stat-modules" />
            <StatTile icon={Target} label="SESSIONS" value={(data.sessions_completed || 0).toString()} testid="public-stat-sessions" />
            <StatTile icon={Award} label="BADGES" value={`${data.badges_total || 0}/23`} sub={`${data.badges_legendary || 0}L · ${data.badges_epic || 0}E · ${data.badges_rare || 0}R · ${data.badges_common || 0}C`} testid="public-stat-badges" />
            <StatTile icon={Flame} label="LONGEST STREAK" value={`${data.longest_streak_days || 0}d`} testid="public-stat-streak" />
            <StatTile icon={Clock} label="TIME INVESTED" value={`${totalHours}h`} testid="public-stat-time" />
            <StatTile icon={Activity} label="ACTIVE DAYS / 90" value={(data.active_days_last_90 || 0).toString()} testid="public-stat-active" />
            <StatTile icon={Trophy} label="DAILY CHAMPION" value={`${data.daily_champion_days_total || 0}×`} testid="public-stat-champion" />
          </div>
        </section>

        {/* Skills */}
        <section data-testid="public-skills">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">Skills earned</h2>
          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">{skills.map((s) => <SkillPill key={s} label={s} />)}</div>
          ) : (
            <div className="text-sm text-[var(--color-text-muted)] font-bricolage">No skills earned yet.</div>
          )}
        </section>

        {/* Module map (visual only) */}
        <section data-testid="public-journey">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">Module journey</h2>
          <div className="text-xs text-[var(--color-text-muted)] mb-3 font-mono uppercase tracking-[0.18em]">
            {data.modules_completed || 0} of {Math.max(15, modules.length)} modules mastered
          </div>
          <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-4 flex flex-wrap gap-3 justify-center">
            {modules.length > 0 ? modules.map((m) => <ModuleNode key={m.order_index} mod={m} />) :
              <div className="text-xs text-[var(--color-text-muted)] font-bricolage py-4">Journey map will appear here once enrolled.</div>}
          </div>
        </section>

        {/* Projects */}
        <section data-testid="public-projects">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">Projects</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`rounded-2xl border p-5 ${data.capstone_completed ? 'border-yellow-400/40 bg-gradient-to-br from-yellow-400/10 via-orange-500/5 to-pink-500/5' : 'border-[var(--glass-border)] bg-[var(--glass-bg)]'} backdrop-blur`}>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-mono text-[var(--color-text-muted)] mb-2">
                <Trophy size={12} className={data.capstone_completed ? 'text-yellow-400' : ''} /> CAPSTONE
              </div>
              <div className="font-clash text-lg font-bold text-[var(--color-text)]">
                {data.capstone_completed ? 'Capstone Earned' : 'In progress'}
              </div>
              {data.capstone_completed && data.capstone_completed_at && (
                <div className="text-xs text-[var(--color-text-muted)] mt-1 font-bricolage">
                  Completed {new Date(data.capstone_completed_at).toLocaleDateString()}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-5">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-mono text-[var(--color-text-muted)] mb-2">
                <Target size={12} /> MODULE PROJECTS
              </div>
              <div className="font-clash text-3xl font-bold text-[var(--color-text)]">{data.module_projects_completed || 0}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1 font-bricolage">projects completed</div>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section data-testid="public-badges">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">Recent badges</h2>
          {recentBadges.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {recentBadges.slice(0, 8).map((b) => (
                <div key={`${b.code}-${b.earned_at}`} className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-3" data-testid={`public-badge-${b.code}`}>
                  <div className="flex items-start gap-2">
                    <Award size={14} className={
                      b.rarity === 'legendary' ? 'text-yellow-400'
                      : b.rarity === 'epic' ? 'text-purple-400'
                      : b.rarity === 'rare' ? 'text-blue-400'
                      : 'text-[var(--color-text-muted)]'
                    } />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--color-text)] font-clash truncate">{b.name}</div>
                      <div className="text-[10px] uppercase tracking-wider font-mono text-[var(--color-text-muted)]">{b.rarity}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[var(--color-text-muted)] font-bricolage">No badges earned yet.</div>
          )}
        </section>

        {/* Heatmap */}
        <section data-testid="public-heatmap-section">
          <h2 className="font-clash text-lg sm:text-xl font-bold text-[var(--color-text)] mb-3">90-day activity</h2>
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur p-4">
            <PublicHeatmap rows={data.heatmap_90 || []} />
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-6 border-t border-[var(--glass-border)] text-center" data-testid="public-footer">
          <Link to="/" className="font-bricolage text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            Powered by <span className="text-[var(--color-primary)] font-bold">Valuevade</span>, Train your finance career
          </Link>
        </footer>
      </div>
    </div>
  );
}

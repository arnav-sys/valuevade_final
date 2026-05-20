import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock, X, Clock, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

// Hand-tuned 15-node organic constellation in a 1000×500 viewBox.
// Pattern: a gentle S-curve from bottom-left to top-right, with intentional
// jitter on the Y axis so the layout reads as constellation, not a chain.
// Index = order_index (0-based). Modules beyond 14 fall back to a circular
// extension off the right edge.
const NODE_POSITIONS = [
  { x:  80, y: 420 },  // M0 / M1
  { x: 170, y: 330 },
  { x: 260, y: 400 },
  { x: 360, y: 250 },
  { x: 450, y: 360 },
  { x: 530, y: 180 },
  { x: 620, y: 290 },
  { x: 700, y: 130 },
  { x: 770, y: 250 },
  { x: 830, y: 90  },
  { x: 880, y: 220 },
  { x: 905, y: 350 },
  { x: 855, y: 440 },
  { x: 720, y: 450 },
  { x: 580, y: 460 },
];

function nodePos(idx) {
  if (idx >= 0 && idx < NODE_POSITIONS.length) return NODE_POSITIONS[idx];
  // Fallback: spiral around if a user has > 15 modules.
  const k = idx - NODE_POSITIONS.length;
  const angle = (k * 137.5 * Math.PI) / 180;
  const r = 60 + 8 * k;
  return { x: 500 + r * Math.cos(angle), y: 250 + r * Math.sin(angle) };
}

function StatusStyle(mod) {
  if (!mod.is_unlocked) {
    return {
      kind: 'locked',
      fill: '#3a4150',
      glow: 'rgba(120,120,140,.15)',
      stroke: '#454c5b',
      labelOpacity: 0.5,
      pulse: false,
    };
  }
  if (mod.is_completed) {
    return {
      kind: 'completed',
      fill: '#fbbf24',
      glow: 'rgba(251,191,36,.55)',
      stroke: '#fde68a',
      labelOpacity: 1,
      pulse: 'slow',
    };
  }
  if ((mod.sessions_completed_n || 0) > 0) {
    return {
      kind: 'in_progress',
      fill: '#246BFD',
      glow: 'rgba(36,107,253,.6)',
      stroke: '#7fa6ff',
      labelOpacity: 1,
      pulse: 'fast',
    };
  }
  return {
    kind: 'unlocked',
    fill: '#e5e9f3',
    glow: 'rgba(229,233,243,.25)',
    stroke: '#cfd6e6',
    labelOpacity: 0.85,
    pulse: false,
  };
}

function ModulePopover({ mod, onClose, onContinue }) {
  if (!mod) return null;
  const style = StatusStyle(mod);
  const showCta = mod.is_unlocked;
  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="constellation-popover"
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 sm:p-8"
      onClick={onClose}
      style={{ background: 'rgba(8,12,24,.55)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 rounded-full p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
          aria-label="Dismiss"
          data-testid="constellation-popover-close"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-clash font-bold"
            style={{
              background: `${style.fill}25`,
              color: style.fill,
              border: `1px solid ${style.fill}55`,
            }}
          >
            {mod.module_code}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)]">
              {style.kind === 'completed' && 'Completed'}
              {style.kind === 'in_progress' && 'In progress'}
              {style.kind === 'unlocked' && 'Unlocked'}
              {style.kind === 'locked' && 'Locked'}
            </div>
            <div className="font-clash font-bold text-base text-[var(--color-text)] leading-tight truncate">
              {mod.module_title}
            </div>
          </div>
        </div>

        {!mod.is_unlocked ? (
          <div className="text-sm text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
            <Lock size={14} />
            <span>Complete M{Math.max(0, mod.order_index - 1)} to unlock this module.</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Stat label="Completion" value={`${mod.completion_percent}%`}
                    sub={`${mod.sessions_completed_n}/${mod.sessions_total} sessions`} />
              <Stat label="XP earned" value={mod.xp_earned_in_module} icon={<Zap size={11} />} />
              <Stat label="Time" value={`${mod.time_spent_minutes} min`} icon={<Clock size={11} />} />
              <Stat label="Last activity"
                    value={mod.last_activity_at
                      ? new Date(mod.last_activity_at).toLocaleDateString(undefined, { day:'numeric', month:'short' })
                      : '—'} />
            </div>
            {showCta && (
              <button
                onClick={() => onContinue(mod)}
                data-testid="constellation-popover-continue"
                className="w-full rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white font-bricolage font-semibold text-sm py-2.5 hover:brightness-110 transition-all"
              >
                {mod.is_completed ? 'Review module' : 'Continue →'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, icon }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)] flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="font-clash font-bold text-base text-[var(--color-text)]">{value}</div>
      {sub && <div className="text-[10px] text-[var(--color-text-muted)]">{sub}</div>}
    </div>
  );
}

export default function ModuleConstellationMap({ fullscreen = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const reducedMotionRef = useRef(
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const refresh = useCallback(async () => {
    if (!user?.id) { setModules([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('v_module_progress_summary')
      .select('*')
      .eq('user_id', user.id)
      .order('order_index');
    if (error) {
      console.warn('[constellation] load failed:', error.message);
    }
    setModules(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Live updates: refresh on user_modules / user_sessions changes.
  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase
      .channel(`constellation:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_modules' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sessions' }, refresh)
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch { /* noop */ } };
  }, [user?.id, refresh]);

  const links = useMemo(() => {
    const arr = [];
    for (let i = 1; i < modules.length; i++) {
      const prev = modules[i - 1];
      const cur = modules[i];
      const pPos = nodePos(prev.order_index);
      const cPos = nodePos(cur.order_index);
      const completedBoth = prev.is_completed && cur.is_completed;
      const anyInProgress = (!prev.is_completed && prev.sessions_completed_n > 0)
                          || (!cur.is_completed && cur.sessions_completed_n > 0);
      const lockedEither = !prev.is_unlocked || !cur.is_unlocked;
      let opacity = 0.18;
      let stroke = '#3a4150';
      if (completedBoth) { opacity = 0.65; stroke = '#fbbf24'; }
      else if (anyInProgress) { opacity = 0.42; stroke = '#246BFD'; }
      else if (lockedEither) { opacity = 0.12; stroke = '#3a4150'; }
      arr.push({ x1: pPos.x, y1: pPos.y, x2: cPos.x, y2: cPos.y, opacity, stroke });
    }
    return arr;
  }, [modules]);

  const handleNodeClick = useCallback((idx) => setSelectedIdx(idx), []);
  const handleContinue = useCallback((mod) => {
    setSelectedIdx(null);
    if (mod?.user_module_id) navigate(`/module/${mod.user_module_id}`);
  }, [navigate]);

  const containerHeight = fullscreen ? 'h-[70vh]' : 'h-[400px] sm:h-[460px]';

  if (loading) {
    return (
      <div className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] ${containerHeight} flex items-center justify-center`} data-testid="constellation-loading">
        <div className="text-sm text-[var(--color-text-muted)]">Plotting constellation…</div>
      </div>
    );
  }
  if (modules.length === 0) {
    return (
      <div className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] ${containerHeight} flex items-center justify-center`} data-testid="constellation-empty">
        <div className="text-sm text-[var(--color-text-muted)]">No modules yet — your learning constellation will appear here once you enroll.</div>
      </div>
    );
  }

  return (
    <section
      className={`relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden ${containerHeight}`}
      data-testid="constellation-map"
    >
      <div className="absolute inset-0 pointer-events-none constellation-bg" aria-hidden="true" />
      <div className="absolute top-4 left-4 sm:top-5 sm:left-6 z-10">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)]">Your journey</div>
        <h3 className="font-clash text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--color-accent)]" />
          Module Constellation
        </h3>
      </div>
      <svg viewBox="0 0 1000 500" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="starGoldGlow"><stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" /><stop offset="50%" stopColor="#fbbf24" stopOpacity="0.45" /><stop offset="100%" stopColor="#fbbf24" stopOpacity="0" /></radialGradient>
          <radialGradient id="starBlueGlow"><stop offset="0%" stopColor="#bfd4ff" stopOpacity="0.9" /><stop offset="50%" stopColor="#246BFD" stopOpacity="0.4" /><stop offset="100%" stopColor="#246BFD" stopOpacity="0" /></radialGradient>
          <radialGradient id="starWhiteGlow"><stop offset="0%" stopColor="#e5e9f3" stopOpacity="0.6" /><stop offset="100%" stopColor="#e5e9f3" stopOpacity="0" /></radialGradient>
        </defs>
        {/* Subtle starfield backdrop */}
        {Array.from({ length: 35 }).map((_, i) => {
          const sx = (i * 137) % 1000;
          const sy = (i * 89) % 500;
          const sr = (i % 3) * 0.4 + 0.6;
          return <circle key={`bg-${i}`} cx={sx} cy={sy} r={sr} fill="rgba(229,233,243,.18)" />;
        })}
        {/* Links */}
        {links.map((l, i) => (
          <line key={`l-${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke={l.stroke} strokeWidth="1.2" strokeDasharray="3 4" opacity={l.opacity} />
        ))}
        {/* Nodes */}
        {modules.map((m, i) => {
          const pos = nodePos(m.order_index);
          const style = StatusStyle(m);
          const glowId = style.kind === 'completed' ? 'url(#starGoldGlow)'
                       : style.kind === 'in_progress' ? 'url(#starBlueGlow)'
                       : 'url(#starWhiteGlow)';
          const pulseClass = !reducedMotionRef.current && style.pulse === 'slow' ? 'constellation-pulse-slow'
                            : !reducedMotionRef.current && style.pulse === 'fast' ? 'constellation-pulse-fast'
                            : '';
          return (
            <g
              key={m.user_module_id}
              style={{ cursor: 'pointer' }}
              onClick={() => handleNodeClick(i)}
              data-testid={`constellation-node-${m.module_code}`}
            >
              {/* Glow halo */}
              {style.kind !== 'locked' && (
                <circle cx={pos.x} cy={pos.y} r={28} fill={glowId} className={pulseClass} />
              )}
              {/* Star core */}
              <circle cx={pos.x} cy={pos.y} r={style.kind === 'completed' ? 8 : style.kind === 'in_progress' ? 7 : 5.5}
                      fill={style.fill} stroke={style.stroke} strokeWidth="1.2" />
              {/* Lock icon overlay for locked nodes */}
              {style.kind === 'locked' && (
                <text x={pos.x} y={pos.y + 3} textAnchor="middle" fontSize="8" fill="#9aa3b8">∅</text>
              )}
              {/* Label */}
              <text x={pos.x} y={pos.y + 22} textAnchor="middle"
                    fontFamily="JetBrains Mono, ui-monospace, monospace"
                    fontSize="9" fill="var(--color-text-muted)"
                    opacity={style.labelOpacity}>
                {m.module_code}
              </text>
            </g>
          );
        })}
      </svg>
      <ModulePopover
        mod={selectedIdx != null ? modules[selectedIdx] : null}
        onClose={() => setSelectedIdx(null)}
        onContinue={handleContinue}
      />
      <style>{`
        .constellation-bg {
          background:
            radial-gradient(ellipse at 20% 30%, rgba(36,107,253,.10), transparent 60%),
            radial-gradient(ellipse at 80% 70%, rgba(106,92,255,.10), transparent 60%);
        }
        @keyframes constellation-pulse-slow-kf {
          0%,100% { opacity: 0.55 } 50% { opacity: 1 }
        }
        @keyframes constellation-pulse-fast-kf {
          0%,100% { opacity: 0.6 } 50% { opacity: 1 }
        }
        .constellation-pulse-slow { animation: constellation-pulse-slow-kf 3s ease-in-out infinite; }
        .constellation-pulse-fast { animation: constellation-pulse-fast-kf 1.6s ease-in-out infinite; }
      `}</style>
    </section>
  );
}

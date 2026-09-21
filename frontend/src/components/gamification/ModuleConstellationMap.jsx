import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock, X, Clock, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

// =============================================================================
// Module Constellation Map (rev 2, serpentine layout).
//
// Previous "S-curve with jitter" produced unreadable criss-cross paths when
// users had removed modules (Batch 4 manual edits). This rev replaces the
// layout with a **horizontal serpentine** (Mario-world-map style):
//
//   row 0: M1 → M2 → M3 → M4 → M5  (left to right)
//                                  ↓
//   row 1: M10 ← M9 ← M8 ← M7 ← M6 (right to left)
//                                  ↓
//   row 2: M11 → M12 → M13 → … (left to right)
//
// Consecutive modules are always grid-neighbors → no diagonal lines, zero
// crossings. Modules that are removed via Batch 4 customization are NOT
// rendered (the view-source `v_module_progress_summary` filters them out).
// What we DO is re-pack the remaining modules into the serpentine using a
// "visual index" (their position in the enrolled-and-not-removed list),
// not their original `order_index`. So a user who removed M2 and M12 sees
// a tight 13-node path instead of two visual gaps.
// =============================================================================

const VIEWBOX_W = 1000;
const ROW_SIZE  = 5;   // 5 nodes per row → grows vertically as enrollment grows.
const X_PADDING = 90;
const Y_PADDING = 90;
const X_STEP    = (VIEWBOX_W - 2 * X_PADDING) / (ROW_SIZE - 1); // ~205
const Y_STEP    = 120;

function viewboxHeight(count) {
  const rows = Math.max(1, Math.ceil(count / ROW_SIZE));
  return Y_PADDING * 2 + (rows - 1) * Y_STEP;
}

function gridPosition(visualIdx) {
  const row = Math.floor(visualIdx / ROW_SIZE);
  const colInRow = visualIdx % ROW_SIZE;
  // Reverse every other row so consecutive nodes are grid-adjacent.
  const col = row % 2 === 0 ? colInRow : (ROW_SIZE - 1 - colInRow);
  return {
    x: X_PADDING + col * X_STEP,
    y: Y_PADDING + row * Y_STEP,
    row,
    col,
  };
}

// Semantic color mapping (per product spec):
//   completed   → gold (steady, no pulse)        , achievement
//   in_progress → blue (pulse)                    , active work
//   next_up     → white (static, dashed ring)     , anticipation
//   unlocked    → white (static, slightly dimmer)
//   locked      → dim gray
function StatusStyle(mod, isNextUp) {
  if (!mod.is_unlocked) {
    return {
      kind: 'locked',
      fill: '#3a4150',
      glow: 'rgba(120,120,140,.15)',
      stroke: '#454c5b',
      labelOpacity: 0.55,
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
      pulse: false, // steady gentle glow, gold = achievement, not motion
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
  if (isNextUp) {
    return {
      kind: 'next_up',
      fill: '#ffffff',
      glow: 'rgba(255,255,255,.55)',
      stroke: '#ffffff',
      labelOpacity: 1,
      pulse: false, // static white, anticipation, not activity
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

// Capstone heuristic: explicit M23 code OR a title that begins with "Capstone".
// Falls back to last-module-in-list to avoid silently mis-styling if curriculum
// ever renumbers.
function isCapstoneModule(mod) {
  if (!mod) return false;
  if (mod.module_code === 'M23') return true;
  const t = (mod.module_title || '').toLowerCase();
  return t.startsWith('capstone');
}

function ModulePopover({ mod, onClose, onContinue }) {
  if (!mod) return null;
  const style = StatusStyle(mod, false);
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
              {style.kind === 'next_up' && 'Next up'}
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
            <span>Complete the previous module to unlock this one.</span>
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
  const [hoverIdx, setHoverIdx] = useState(null);
  const reducedMotionRef = useRef(
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const refresh = useCallback(async () => {
    if (!user?.id) { setModules([]); setLoading(false); return; }
    // Step 1, pick the user's ACTIVE enrollment so we don't accidentally
    // render rows from past/duplicate enrollments (otherwise the user sees
    // 30+ duplicated module nodes).
    const { data: enr, error: enrErr } = await supabase
      .from('user_enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false })
      .limit(1);
    if (enrErr) {
      console.warn('[constellation] enrollment lookup failed:', enrErr.message);
    }
    const activeEnrollmentId = enr?.[0]?.id;
    if (!activeEnrollmentId) { setModules([]); setLoading(false); return; }

    // Step 2, pull module progress for THIS enrollment + the
    // removed-flag from user_modules so Batch 4 manual edits collapse
    // cleanly.
    const [{ data: viewRows, error: viewErr }, { data: umRows, error: umErr }] = await Promise.all([
      supabase
        .from('v_module_progress_summary')
        .select('*')
        .eq('user_id', user.id)
        .eq('enrollment_id', activeEnrollmentId)
        .order('order_index'),
      supabase
        .from('user_modules')
        .select('id, is_removed')
        .eq('enrollment_id', activeEnrollmentId),
    ]);
    if (viewErr) console.warn('[constellation] view load failed:', viewErr.message);
    if (umErr)   console.warn('[constellation] user_modules load failed:', umErr.message);

    const removedSet = new Set((umRows || []).filter((r) => r.is_removed).map((r) => r.id));
    // Defensive dedupe: in some accounts a re-enrollment created duplicate
    // user_modules rows for the same master_module_id under the same
    // enrollment. Keep the row with the most progress (highest
    // sessions_completed_n, then completion_percent).
    const byMaster = new Map();
    (viewRows || [])
      .filter((m) => !removedSet.has(m.user_module_id))
      .forEach((m) => {
        const k = m.master_module_id || m.module_code || m.user_module_id;
        const prev = byMaster.get(k);
        if (!prev) { byMaster.set(k, m); return; }
        const newScore = (m.sessions_completed_n || 0) * 100 + (m.completion_percent || 0);
        const oldScore = (prev.sessions_completed_n || 0) * 100 + (prev.completion_percent || 0);
        if (newScore > oldScore) byMaster.set(k, m);
      });
    const filtered = Array.from(byMaster.values()).sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );
    setModules(filtered);
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

  // Find the first unlocked-and-not-completed module → that's "next up"
  // for the pulsing-blue highlight. If the user has any in_progress
  // module (sessions_completed_n > 0), THAT one is already shown blue.
  const nextUpVisualIdx = useMemo(() => {
    for (let i = 0; i < modules.length; i++) {
      const m = modules[i];
      if (m.is_unlocked && !m.is_completed && (m.sessions_completed_n || 0) === 0) return i;
    }
    return -1;
  }, [modules]);

  const links = useMemo(() => {
    const arr = [];
    for (let i = 1; i < modules.length; i++) {
      const prev = modules[i - 1];
      const cur  = modules[i];
      const pPos = gridPosition(i - 1);
      const cPos = gridPosition(i);
      const completedBoth = prev.is_completed && cur.is_completed;
      const anyInProgress = (!prev.is_completed && prev.sessions_completed_n > 0)
                          || (!cur.is_completed && cur.sessions_completed_n > 0);
      const readyForNext = prev.is_completed && cur.is_unlocked
                          && !cur.is_completed && (cur.sessions_completed_n || 0) === 0;
      const lockedEither = !prev.is_unlocked || !cur.is_unlocked;
      // Color semantics (mirror node states):
      //   both completed → bright gold (achievement chain)
      //   ready-for-next → static white (anticipation, NOT gold)
      //   any in-progress → blue (active work, pulse)
      //   locked         → dim gray
      let opacity = 0.18;
      let stroke = '#3a4150';
      let pulse = false;
      if (completedBoth)      { opacity = 0.65; stroke = '#fbbf24'; }
      else if (readyForNext)  { opacity = 0.55; stroke = '#ffffff'; }
      else if (anyInProgress) { opacity = 0.42; stroke = '#246BFD'; pulse = true; }
      else if (lockedEither)  { opacity = 0.12; stroke = '#3a4150'; }
      arr.push({ x1: pPos.x, y1: pPos.y, x2: cPos.x, y2: cPos.y, opacity, stroke, pulse });
    }
    return arr;
  }, [modules]);

  const handleNodeClick = useCallback((idx) => setSelectedIdx(idx), []);
  const handleContinue = useCallback((mod) => {
    setSelectedIdx(null);
    if (mod?.user_module_id) navigate(`/module/${mod.user_module_id}`);
  }, [navigate]);

  // Dynamically size the SVG so all rows fit regardless of enrollment size.
  // Container height grows with the number of rows; the fullscreen variant
  // caps at 70vh and scrolls if needed.
  const VIEWBOX_H = viewboxHeight(modules.length);
  const rowCount = Math.max(1, Math.ceil(modules.length / ROW_SIZE));
  const dynamicHeightPx = Math.min(820, 220 + rowCount * 110);
  const containerStyle = fullscreen
    ? { height: '70vh', minHeight: `${dynamicHeightPx}px`, overflowY: 'auto' }
    : { height: `${dynamicHeightPx}px` };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] h-[400px] sm:h-[460px] flex items-center justify-center" data-testid="constellation-loading">
        <div className="text-sm text-[var(--color-text-muted)]">Plotting constellation…</div>
      </div>
    );
  }
  if (modules.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] h-[400px] sm:h-[460px] flex items-center justify-center" data-testid="constellation-empty">
        <div className="text-sm text-[var(--color-text-muted)]">No modules yet, your learning constellation will appear here once you enroll.</div>
      </div>
    );
  }

  const hoverMod = hoverIdx != null ? modules[hoverIdx] : null;

  return (
    <section
      className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden"
      style={containerStyle}
      data-testid="constellation-map"
    >
      <div className="absolute inset-0 pointer-events-none constellation-bg" aria-hidden="true" />
      <div className="absolute top-4 left-4 sm:top-5 sm:left-6 z-10">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)]">Your journey</div>
        <h3 className="font-clash text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--color-accent)]" />
          Module Constellation
        </h3>
        <div className="mt-1 text-[10px] font-mono text-[var(--color-text-muted)]" data-testid="constellation-counter">
          {modules.filter((m) => m.is_completed).length}/{modules.length} complete
        </div>
      </div>
      {/* Legend in the previously-empty upper-right area */}
      <div className="absolute top-4 right-4 sm:top-5 sm:right-6 z-10 flex items-center gap-3 text-[10px] font-mono text-[var(--color-text-muted)]" data-testid="constellation-legend">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#fbbf24', boxShadow: '0 0 8px rgba(251,191,36,.6)' }} />done</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#246BFD', boxShadow: '0 0 8px rgba(36,107,253,.6)' }} />doing</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#ffffff', boxShadow: '0 0 8px rgba(255,255,255,.55)' }} />next</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#3a4150' }} />locked</span>
      </div>
      <svg viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="starGoldGlow"><stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" /><stop offset="50%" stopColor="#fbbf24" stopOpacity="0.45" /><stop offset="100%" stopColor="#fbbf24" stopOpacity="0" /></radialGradient>
          <radialGradient id="starBlueGlow"><stop offset="0%" stopColor="#bfd4ff" stopOpacity="0.9" /><stop offset="50%" stopColor="#246BFD" stopOpacity="0.4" /><stop offset="100%" stopColor="#246BFD" stopOpacity="0" /></radialGradient>
          <radialGradient id="starWhiteGlow"><stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" /><stop offset="50%" stopColor="#e5e9f3" stopOpacity="0.35" /><stop offset="100%" stopColor="#e5e9f3" stopOpacity="0" /></radialGradient>
          <radialGradient id="starUnlockedGlow"><stop offset="0%" stopColor="#e5e9f3" stopOpacity="0.45" /><stop offset="100%" stopColor="#e5e9f3" stopOpacity="0" /></radialGradient>
          <radialGradient id="starCapstoneGlow"><stop offset="0%" stopColor="#fff7d4" stopOpacity="1" /><stop offset="40%" stopColor="#fbbf24" stopOpacity="0.65" /><stop offset="100%" stopColor="#fbbf24" stopOpacity="0" /></radialGradient>
        </defs>
        {/* Subtle starfield backdrop */}
        {Array.from({ length: 35 }).map((_, i) => {
          const sx = (i * 137) % VIEWBOX_W;
          const sy = (i * 89) % VIEWBOX_H;
          const sr = (i % 3) * 0.4 + 0.6;
          return <circle key={`bg-${i}`} cx={sx} cy={sy} r={sr} fill="rgba(229,233,243,.18)" />;
        })}
        {/* Links, straight orthogonal segments, never diagonal. Serpentine
            ensures consecutive nodes are either same-row or same-column
            neighbors, so this is always either a horizontal or short
            vertical "U-turn" line. */}
        {links.map((l, i) => (
          <line key={`l-${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke={l.stroke} strokeWidth="1.5" strokeDasharray="4 5"
                strokeLinecap="round" opacity={l.opacity}
                className={l.pulse && !reducedMotionRef.current ? 'constellation-pulse-fast' : ''} />
        ))}
        {/* Nodes */}
        {modules.map((m, i) => {
          const pos = gridPosition(i);
          const style = StatusStyle(m, i === nextUpVisualIdx);
          const isCapstone = isCapstoneModule(m);
          // Capstone gets 1.4x size + premium gold glow (regardless of state,
          // size always reads as "this is the finale"). When unlocked but
          // not yet completed → show a READY pill.
          const capstoneReady = isCapstone && m.is_unlocked && !m.is_completed;
          const glowId = isCapstone && style.kind !== 'locked'
                       ? 'url(#starCapstoneGlow)'
                       : style.kind === 'completed' ? 'url(#starGoldGlow)'
                       : style.kind === 'in_progress' ? 'url(#starBlueGlow)'
                       : style.kind === 'next_up' ? 'url(#starWhiteGlow)'
                       : 'url(#starUnlockedGlow)';
          const pulseClass = !reducedMotionRef.current && style.pulse === 'slow' ? 'constellation-pulse-slow'
                            : !reducedMotionRef.current && style.pulse === 'fast' ? 'constellation-pulse-fast'
                            : '';
          const baseCoreR = style.kind === 'completed' ? 9
                          : style.kind === 'in_progress' ? 8
                          : style.kind === 'next_up' ? 7
                          : 6;
          const coreR = isCapstone ? Math.round(baseCoreR * 1.4 * 10) / 10 : baseCoreR;
          const haloR = isCapstone ? 40 : 28;
          return (
            <g
              key={m.user_module_id}
              style={{ cursor: 'pointer' }}
              onClick={() => handleNodeClick(i)}
              onMouseOver={() => setHoverIdx(i)}
              onMouseOut={() => setHoverIdx((cur) => (cur === i ? null : cur))}
              data-testid={`constellation-node-${m.module_code}`}
            >
              {/* Native SVG tooltip, surfaces immediately on hover with no JS overhead. */}
              <title>{m.module_code}, {m.module_title}{m.is_completed ? ' · Completed' : m.is_unlocked ? ' · Unlocked' : ' · Locked'}</title>
              {/* Glow halo, capstone gets a second, wider outer ring for depth. */}
              {style.kind !== 'locked' && isCapstone && (
                <circle cx={pos.x} cy={pos.y} r={haloR + 14} fill={glowId}
                        className={!reducedMotionRef.current ? 'constellation-pulse-slow' : ''}
                        opacity={0.55} />
              )}
              {style.kind !== 'locked' && (
                <circle cx={pos.x} cy={pos.y} r={haloR} fill={glowId} className={pulseClass} />
              )}
              {/* Next-up dashed ring, white, static (NOT pulsing blue). */}
              {i === nextUpVisualIdx && (
                <circle cx={pos.x} cy={pos.y} r={isCapstone ? 20 : 14} fill="none"
                        stroke="#ffffff" strokeWidth="1.5"
                        strokeDasharray="3 4" opacity={0.85} />
              )}
              {/* Star core */}
              <circle cx={pos.x} cy={pos.y} r={coreR}
                      fill={style.fill} stroke={style.stroke}
                      strokeWidth={isCapstone ? 1.6 : 1.2} />
              {/* Lock icon overlay for locked nodes */}
              {style.kind === 'locked' && (
                <text x={pos.x} y={pos.y + 3} textAnchor="middle" fontSize="8" fill="#9aa3b8">∅</text>
              )}
              {/* READY pill, capstone is unlocked, awaiting completion. */}
              {capstoneReady && (
                <g>
                  <rect x={pos.x - 22} y={pos.y - (coreR + 18)} width={44} height={14} rx={7}
                        fill="#fbbf24" stroke="#fde68a" strokeWidth="0.8" />
                  <text x={pos.x} y={pos.y - (coreR + 8)} textAnchor="middle"
                        fontFamily="JetBrains Mono, ui-monospace, monospace"
                        fontSize="8.5" fontWeight="700" fill="#1a1408" letterSpacing="0.8">
                    READY
                  </text>
                </g>
              )}
              {/* Label: module code + truncated title underneath for readability */}
              <text x={pos.x} y={pos.y + (isCapstone ? 30 : 24)} textAnchor="middle"
                    fontFamily="JetBrains Mono, ui-monospace, monospace"
                    fontSize={isCapstone ? 11 : 10} fill="var(--color-text)"
                    fontWeight={isCapstone ? 700 : 600}
                    opacity={style.labelOpacity}>
                {m.module_code}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Hover tooltip, overlay HTML for richer styling than <title>. */}
      {hoverMod && (
        <div
          className="absolute z-20 pointer-events-none px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-lg text-xs font-bricolage text-[var(--color-text)] max-w-[220px]"
          style={{
            left: `${(gridPosition(hoverIdx).x / VIEWBOX_W) * 100}%`,
            top:  `${(gridPosition(hoverIdx).y / VIEWBOX_H) * 100}%`,
            transform: 'translate(-50%, -130%)',
          }}
          data-testid="constellation-tooltip"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
            {hoverMod.module_code}
            {hoverMod.is_completed   ? ' · done'
              : hoverMod.is_unlocked ? ' · unlocked'
                                     : ' · locked'}
          </div>
          <div className="font-clash font-semibold text-sm text-[var(--color-text)] leading-tight mt-0.5 truncate">
            {hoverMod.module_title}
          </div>
          {hoverMod.is_unlocked && (
            <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
              {hoverMod.sessions_completed_n}/{hoverMod.sessions_total} sessions · {hoverMod.completion_percent}%
            </div>
          )}
        </div>
      )}
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
        /* Pulse uses opacity ONLY (cheap, GPU-friendly, no layout thrash). */
        @keyframes constellation-pulse-slow-kf {
          0%,100% { opacity: 0.5 } 50% { opacity: 0.95 }
        }
        @keyframes constellation-pulse-fast-kf {
          0%,100% { opacity: 0.6 } 50% { opacity: 1 }
        }
        .constellation-pulse-slow {
          animation: constellation-pulse-slow-kf 3.4s ease-in-out infinite;
          will-change: opacity;
        }
        .constellation-pulse-fast {
          animation: constellation-pulse-fast-kf 1.6s ease-in-out infinite;
          will-change: opacity;
        }
        @media (prefers-reduced-motion: reduce) {
          .constellation-pulse-slow,
          .constellation-pulse-fast {
            animation: none !important;
            opacity: 0.85;
          }
        }
      `}</style>
    </section>
  );
}

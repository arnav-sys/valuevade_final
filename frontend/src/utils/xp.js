// Centralised XP client.
//
// Single mutation funnel: every XP award MUST go through awardXP() which
// invokes the `award_xp` Postgres RPC defined in
// /app/scripts/migrations/0001_gamification_foundation.sql.
//
// The RPC is SECURITY DEFINER + search_path-locked and self-guards against
// callers awarding XP to other users, so we don't need additional checks
// here. Returned shape (the RPC returns jsonb):
//   {
//     updated: bool,
//     event_inserted: bool,
//     did_level_up: bool,
//     old_level: int,
//     new_level: int,
//     total_xp: int,
//     user_stats: { ... }
//   }
//
// On the "no user_stats row yet" path (very early in onboarding) the RPC
// returns `{ updated: false, reason: 'no_user_stats_row', event_inserted: true,
// did_level_up: false }` — we surface that to callers so the toast can be
// suppressed cleanly.

import { supabase } from '../lib/supabase';

/**
 * Authoritative list of XP `reason` values. Mirrors the CHECK constraint on
 * `public.user_xp_events.reason` and the validation inside award_xp().
 * NEVER pass a string outside this set — the RPC will raise.
 */
export const XP_REASONS = Object.freeze({
  session_complete: 'session_complete',
  quiz_correct: 'quiz_correct',
  quiz_attempt: 'quiz_attempt',
  simulation_complete: 'simulation_complete',
  daily_login: 'daily_login',
  capstone_complete: 'capstone_complete',
  module_complete: 'module_complete',
  daily_challenge_complete: 'daily_challenge_complete',
  daily_champion_bonus: 'daily_champion_bonus',
  signup_bonus: 'signup_bonus',
  badge_unlock_bonus: 'badge_unlock_bonus',
  streak_milestone: 'streak_milestone',
  manual_adjust: 'manual_adjust',
});

/**
 * Award XP to the currently-authenticated user.
 *
 * @param {Object} opts
 * @param {number} opts.amount    XP to add (can be negative for corrections).
 * @param {string} opts.reason    One of XP_REASONS values.
 * @param {string|null} [opts.source_id]  Optional uuid linking the event to
 *                                        a session/quiz/module/badge.
 * @param {Object} [opts.meta]    Arbitrary structured context for the ledger.
 * @returns {Promise<{
 *   total_xp:number,
 *   current_level:number,
 *   level_name:string|null,
 *   next_threshold:number|null,
 *   xp_to_next:number|null,
 *   did_level_up:boolean,
 *   awarded_amount:number,
 *   ok:boolean,
 *   error?:string
 * }>}
 */
export async function awardXP({ amount, reason, source_id = null, meta = {} } = {}) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return { ok: false, error: 'invalid amount', awarded_amount: 0 };
  }
  if (!reason || !XP_REASONS[reason]) {
    return { ok: false, error: `unknown reason "${reason}"`, awarded_amount: 0 };
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('award_xp', {
      p_user_id: (await supabase.auth.getUser()).data?.user?.id,
      p_amount: Math.round(amount),
      p_reason: reason,
      p_source_id: source_id,
      p_meta: meta || {},
    });

    if (rpcError) {
      console.error('[xp] award_xp RPC error:', rpcError);
      return {
        ok: false,
        error: rpcError.message,
        awarded_amount: 0,
        total_xp: 0,
        current_level: 1,
        level_name: null,
        next_threshold: null,
        xp_to_next: null,
        did_level_up: false,
      };
    }

    // rpcData is jsonb returned as a JS object
    const stats = rpcData?.user_stats || null;
    const total_xp = rpcData?.total_xp ?? stats?.total_xp ?? 0;
    const current_level = rpcData?.new_level ?? stats?.current_level ?? 1;
    const levelInfo = await getLevelInfo(current_level, total_xp);

    return {
      ok: true,
      did_level_up: !!rpcData?.did_level_up,
      awarded_amount: Math.round(amount),
      total_xp,
      current_level,
      level_name: levelInfo.level_name,
      next_threshold: levelInfo.next_threshold,
      xp_to_next: levelInfo.xp_to_next,
    };
  } catch (err) {
    console.error('[xp] awardXP threw:', err);
    return { ok: false, error: err?.message || String(err), awarded_amount: 0 };
  }
}

/**
 * Pull the cached master_levels rows once per page load. RLS already lets any
 * authenticated user SELECT this table, so no service-role tricks needed.
 *
 * Cached in module-scope after the first call. Returns:
 *   [{ level_number, name, xp_threshold, icon_slug, color_hex }, ...]
 */
let _levelsCache = null;
let _levelsPromise = null;
export async function loadLevels() {
  if (_levelsCache) return _levelsCache;
  if (_levelsPromise) return _levelsPromise;
  _levelsPromise = (async () => {
    const { data, error } = await supabase
      .from('master_levels')
      .select('level_number, name, xp_threshold, icon_slug, color_hex')
      .order('level_number');
    if (error) {
      console.warn('[xp] loadLevels failed, using fallback:', error.message);
      // Fallback matches the seed in 0001_gamification_foundation.sql so the UI
      // never breaks if the table query is briefly unavailable.
      _levelsCache = [
        { level_number: 1, name: 'Junior Analyst',     xp_threshold: 0,     color_hex: '#9CA3AF' },
        { level_number: 2, name: 'Research Associate', xp_threshold: 500,   color_hex: '#246BFD' },
        { level_number: 3, name: 'Equity Analyst',     xp_threshold: 1500,  color_hex: '#6A5CFF' },
        { level_number: 4, name: 'Senior Analyst',     xp_threshold: 3500,  color_hex: '#FF6AC1' },
        { level_number: 5, name: 'Portfolio Manager',  xp_threshold: 7000,  color_hex: '#F59E0B' },
        { level_number: 6, name: 'CIO',                xp_threshold: 12000, color_hex: '#10B981' },
      ];
    } else {
      _levelsCache = data || [];
    }
    return _levelsCache;
  })();
  return _levelsPromise;
}

/**
 * Given a level number + total XP, return what the UI needs to render.
 * Pure-derived from master_levels; no side effects.
 *
 * Bulletproof: if `levels` hasn't loaded yet (token race / RLS quirk),
 * fall back to the hard-coded seed defaults so we never throw on `.name`
 * during the hydration window.  XPContext + XPBar both consume this and
 * a null-prop access would surface as a React error overlay.
 */
const HARDCODED_FALLBACK_LEVELS = [
  { level_number: 1, name: 'Junior Analyst',     xp_threshold: 0,     color_hex: '#9CA3AF', icon_slug: 'junior_analyst' },
  { level_number: 2, name: 'Research Associate', xp_threshold: 500,   color_hex: '#246BFD', icon_slug: 'research_associate' },
  { level_number: 3, name: 'Equity Analyst',     xp_threshold: 1500,  color_hex: '#6A5CFF', icon_slug: 'equity_analyst' },
  { level_number: 4, name: 'Senior Analyst',     xp_threshold: 3500,  color_hex: '#FF6AC1', icon_slug: 'senior_analyst' },
  { level_number: 5, name: 'Portfolio Manager',  xp_threshold: 7000,  color_hex: '#F59E0B', icon_slug: 'portfolio_manager' },
  { level_number: 6, name: 'CIO',                xp_threshold: 12000, color_hex: '#10B981', icon_slug: 'cio' },
];

const SAFE_LEVEL_INFO = Object.freeze({
  level_name: 'Junior Analyst',
  level_icon: 'junior_analyst',
  level_color: '#246BFD',
  next_level_name: 'Research Associate',
  next_threshold: 500,
  xp_to_next: 500,
  progress_pct: 0,
  is_max_level: false,
});

export async function getLevelInfo(current_level, total_xp) {
  let levels = [];
  try {
    levels = await loadLevels();
  } catch {
    levels = [];
  }
  // Hardening: if the table query returned an empty array (auth race, RLS
  // hiccup, or the cache hasn't populated yet) use the hard-coded seed.
  // Same six rows the migration inserts via ON CONFLICT, so behaviour is
  // identical to a healthy DB read.
  if (!Array.isArray(levels) || levels.length === 0) {
    levels = HARDCODED_FALLBACK_LEVELS;
  }

  const sorted = [...levels].sort((a, b) => (a.level_number || 0) - (b.level_number || 0));
  // Defensive: if sorting somehow produces nothing, fall back outright.
  if (sorted.length === 0) return { ...SAFE_LEVEL_INFO };

  const max = sorted[sorted.length - 1];
  const safeLevel = Number.isFinite(current_level) ? current_level : 1;
  const safeXp = Number.isFinite(total_xp) ? total_xp : 0;

  const cur = sorted.find((l) => l.level_number === safeLevel) || sorted[0];
  const next = sorted.find((l) => l.level_number === (safeLevel + 1));

  if (!next) {
    return {
      level_name: cur?.name || 'CIO',
      level_icon: cur?.icon_slug || null,
      level_color: cur?.color_hex || '#10B981',
      next_level_name: null,
      next_threshold: max?.xp_threshold ?? 12000,
      xp_to_next: 0,
      progress_pct: 100,
      is_max_level: true,
    };
  }
  const span = Math.max(1, (next.xp_threshold ?? 0) - (cur?.xp_threshold ?? 0));
  const into = Math.max(0, safeXp - (cur?.xp_threshold ?? 0));
  return {
    level_name: cur?.name || 'Junior Analyst',
    level_icon: cur?.icon_slug || null,
    level_color: cur?.color_hex || '#246BFD',
    next_level_name: next?.name || null,
    next_threshold: next.xp_threshold ?? 0,
    xp_to_next: Math.max(0, (next.xp_threshold ?? 0) - safeXp),
    progress_pct: Math.min(100, Math.round((into / span) * 100)),
    is_max_level: false,
  };
}

/**
 * Pure helper used by markPhaseComplete to compute quiz XP.
 *
 * Slot-machine semantics: variance is sampled PER CORRECT QUESTION, not per
 * quiz, so a 5/5 quiz can legitimately award anywhere in [25..75]. Each
 * correct answer rolls 10 ± 5 (integer in [5,15]); each wrong attempt is a
 * flat +2 (no variance — wrongs aren't slot-machine pulls, they're
 * consolation pennies).
 */
export function computeQuizXP({ correct = 0, attempted = 0 } = {}) {
  let total = 0;
  const c = Math.max(0, Number(correct) || 0);
  const w = Math.max(0, Number(attempted) || 0);
  for (let i = 0; i < c; i += 1) {
    // Math.floor(Math.random() * 11) → 0..10  → -5..+5 variance
    total += 10 + Math.floor(Math.random() * 11) - 5;
  }
  total += 2 * w;
  return Math.max(0, total);
}

/** IST helpers — used by XPContext for daily_login + last_login bookkeeping. */
export function todayISTKey(now = new Date()) {
  // IST = UTC + 05:30; format YYYY-MM-DD
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
}

export function isSameISTDay(isoA, isoB) {
  if (!isoA || !isoB) return false;
  return todayISTKey(new Date(isoA)) === todayISTKey(new Date(isoB));
}

import { supabase } from '../lib/supabase';
import { computeQuizXP, XP_REASONS } from './xp';

/**
 * Progress utility functions used across all session screens.
 * All functions are async and return { success, data?, error? }.
 *
 * As of Phase 1 these also compute the XP awards a phase transition should
 * earn and return them as `xp_intents` (a list of { amount, reason,
 * source_id, meta } objects). The caller (a page using useXP()) is expected
 * to loop through `xp_intents` and call `xp.awardXP(intent)` for each so
 * that toasts / sounds / level-up overlay fire in the UI layer.
 *
 * markPhaseComplete itself never calls the award_xp RPC directly — it just
 * tells callers what should be awarded. This keeps the centralised rule
 * logic here while letting the UI layer own all dopamine feedback.
 */

const PHASE_FIELDS = {
  notes: 'notes_completed',
  quiz: 'quiz_completed',
  interview: 'interview_completed',
  simulation: 'simulation_completed',
};

/**
 * Mark a specific phase of a session as complete.
 * If all 4 phases are complete, marks the session as complete and checks module completion.
 * @param {string} userSessionId - user_sessions.id
 * @param {'notes'|'quiz'|'interview'|'simulation'} phase
 * @param {object|null} scoreData - Optional additional fields to set (e.g. { quiz_score: 85 })
 */
export async function markPhaseComplete(userSessionId, phase, scoreData = null) {
  const field = PHASE_FIELDS[phase];
  if (!field) return { success: false, error: `Unknown phase: ${phase}` };

  try {
    const updatePayload = { [field]: true };
    if (scoreData && typeof scoreData === 'object') {
      // strip non-DB fields (xp metadata) before writing
      const { quiz_correct: _qc, quiz_attempted: _qa, ...rest } = scoreData;
      Object.assign(updatePayload, rest);
    }

    // Update the phase flag
    const { data: updated, error: updErr } = await supabase
      .from('user_sessions')
      .update(updatePayload)
      .eq('id', userSessionId)
      .select('*')
      .single();
    if (updErr) throw updErr;

    // Check if all 4 phases now complete
    const allDone =
      updated.notes_completed &&
      updated.quiz_completed &&
      updated.interview_completed &&
      updated.simulation_completed;

    let sessionJustCompleted = false;
    if (allDone && !updated.is_completed) {
      const { data: completed, error: cErr } = await supabase
        .from('user_sessions')
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq('id', userSessionId)
        .select('user_module_id')
        .single();
      if (cErr) throw cErr;

      sessionJustCompleted = true;
      if (completed?.user_module_id) {
        await checkModuleCompletion(completed.user_module_id);
      }
    }

    // ----- XP intents (callers loop and fire via XPContext.awardXP) -----
    const xp_intents = [];
    if (phase === 'quiz') {
      const correct = Number(scoreData?.quiz_correct) || 0;
      const attempted = Number(scoreData?.quiz_attempted) || 0;
      const amount = computeQuizXP({ correct, attempted });
      if (amount > 0) {
        xp_intents.push({
          amount,
          reason: XP_REASONS.quiz_correct,
          source_id: userSessionId,
          meta: { correct, attempted, quiz_score: scoreData?.quiz_score ?? null },
        });
      }
    } else if (phase === 'simulation') {
      xp_intents.push({
        amount: 100,
        reason: XP_REASONS.simulation_complete,
        source_id: userSessionId,
        meta: { simulation_score: scoreData?.simulation_score ?? null },
      });
    }
    if (sessionJustCompleted) {
      xp_intents.push({
        amount: 50,
        reason: XP_REASONS.session_complete,
        source_id: userSessionId,
        meta: {},
      });
    }

    return { success: true, data: updated, xp_intents };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Check if all sessions in a module are complete. If so, mark module complete.
 */
export async function checkModuleCompletion(userModuleId) {
  try {
    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select('id, is_completed, is_removed')
      .eq('user_module_id', userModuleId);
    if (error) throw error;

    const active = (sessions || []).filter((s) => !s.is_removed);
    if (!active.length) return { success: true, data: { completed: false } };

    const allDone = active.every((s) => s.is_completed);
    if (allDone) {
      const { error: modErr } = await supabase
        .from('user_modules')
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq('id', userModuleId)
        .eq('is_completed', false);
      if (modErr) throw modErr;
    }

    return { success: true, data: { completed: allDone } };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Check if all modules + all module projects are complete.
 * If so, unlock capstone on the enrollment.
 */
export async function checkCapstoneUnlock(enrollmentId) {
  try {
    const { data: modules, error: mErr } = await supabase
      .from('user_modules')
      .select('id, is_completed, is_removed')
      .eq('enrollment_id', enrollmentId);
    if (mErr) throw mErr;

    const activeModules = (modules || []).filter((m) => !m.is_removed);
    const allModulesDone = activeModules.length > 0 && activeModules.every((m) => m.is_completed);

    let allProjectsDone = true;
    try {
      const { data: projects } = await supabase
        .from('user_module_projects')
        .select('user_module_id, is_completed')
        .in('user_module_id', activeModules.map((m) => m.id));
      if (projects && projects.length) {
        allProjectsDone = projects.every((p) => p.is_completed);
      }
    } catch {
      // module projects table may not exist yet - ignore
    }

    const unlocked = allModulesDone && allProjectsDone;

    if (unlocked) {
      try {
        await supabase
          .from('user_capstone_projects')
          .upsert(
            { enrollment_id: enrollmentId, is_unlocked: true, unlocked_at: new Date().toISOString() },
            { onConflict: 'enrollment_id' }
          );
      } catch {
        // capstone table may not exist - ignore
      }
    }

    return { success: true, data: { unlocked } };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Update user_stats row after activity. Adds minutes spent and bumps the
 * last_activity_date to today. Streak is NOT stored (no column for it) — it
 * is computed at read time from user_sessions completion history, which is
 * immutable and therefore can never get out of sync or reset accidentally.
 *
 * Safe to call frequently (idempotent for same-day calls when minutes=0).
 */
export async function updateStats(enrollmentId, timeSpentMinutes = 0) {
  if (!enrollmentId) return { success: false, error: 'no enrollment' };
  try {
    const today = new Date().toISOString().slice(0, 10);

    const { data: { user } = { user: null } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    const { data: existing } = await supabase
      .from('user_stats')
      .select('id, total_time_minutes, last_activity_date')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle();

    if (!existing) {
      const insertRow = {
        enrollment_id: enrollmentId,
        sessions_completed: 0,
        total_time_minutes: Math.max(0, Math.round(timeSpentMinutes)),
        last_activity_date: today,
      };
      if (userId) insertRow.user_id = userId;
      const { error: insErr } = await supabase.from('user_stats').insert(insertRow);
      if (insErr) throw insErr;
      return { success: true, data: { last_activity_date: today } };
    }

    const newMinutes = (existing.total_time_minutes || 0) + Math.max(0, Math.round(timeSpentMinutes));
    const update = { total_time_minutes: newMinutes };
    if (existing.last_activity_date !== today) {
      update.last_activity_date = today;
    }
    const { error } = await supabase
      .from('user_stats')
      .update(update)
      .eq('enrollment_id', enrollmentId);
    if (error) throw error;
    return { success: true, data: update };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Compute the user's current daily streak from a list of session completion
 * dates. A streak is the count of consecutive calendar days (ending today or
 * yesterday) on which the user completed at least one session.
 *
 *  - If today has activity → streak grows from today
 *  - If yesterday is the latest activity day → streak grows from yesterday
 *    (so the user doesn't lose their streak by checking the dashboard before
 *    they study today)
 *  - If the latest activity was 2+ days ago → streak is 0
 *
 * @param {string[]} completedAtIsoDates - array of ISO datetime strings (any user_sessions.completed_at values)
 * @param {string} [todayIso] - optional override for "today" (used in tests). Defaults to local current date.
 * @returns {number}
 */
export function computeStreak(completedAtIsoDates, todayIso = null) {
  if (!Array.isArray(completedAtIsoDates) || completedAtIsoDates.length === 0) return 0;
  const dayKey = (d) => {
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  const days = new Set();
  completedAtIsoDates.forEach((iso) => {
    const k = dayKey(iso);
    if (k) days.add(k);
  });
  if (days.size === 0) return 0;

  const today = todayIso ? new Date(todayIso) : new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dayKey(today);

  // Anchor either at today (if active) or yesterday (grace period)
  let cursor = new Date(today);
  if (!days.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Ordered phase sequence. Source of truth for "what's next". */
export const PHASE_ORDER = ['notes', 'quiz', 'interview', 'simulation'];

/**
 * Determine the next phase to work on for a session.
 * Order: notes → quiz → interview → simulation
 * Returns the phase key, or null if all complete.
 */
export function getNextPhase(session) {
  if (!session) return null;
  for (const ph of PHASE_ORDER) {
    if (!session[`${ph}_completed`]) return ph;
  }
  return null;
}

/**
 * After completing a phase, figure out the next UNFINISHED phase that
 * comes AFTER the just-completed one. This prevents routing back to a
 * skipped earlier phase (e.g. if quiz is done but notes is somehow still
 * false, we should still go forward to interview — not loop back to notes).
 */
function getNextForwardPhase(session, justCompleted) {
  if (!session) return null;
  const startIdx = justCompleted ? PHASE_ORDER.indexOf(justCompleted) + 1 : 0;
  for (let i = startIdx; i < PHASE_ORDER.length; i++) {
    if (!session[`${PHASE_ORDER[i]}_completed`]) return PHASE_ORDER[i];
  }
  return null;
}

/** Map a phase key to its route segment (after /session/:id/). */
export const PHASE_ROUTES = {
  notes: 'notes',
  quiz: 'quiz/start',
  interview: 'interview/start',
  simulation: 'simulation/start',
};

/** Map a phase key to its short human-readable label for CTAs. */
export const PHASE_LABELS = {
  notes: 'Notes',
  quiz: 'Quiz',
  interview: 'Interview',
  simulation: 'Simulation',
};

/**
 * After completing a phase, figure out where to go next.
 *
 * When `justCompleted` is provided: routes to the next UNFINISHED phase
 * that is AFTER the just-completed phase (never goes backwards). This
 * prevents cases like "finished quiz but notes flag never flipped" from
 * routing the user back to notes.
 *
 * Returns:
 *   { phase, route, label }   → next unfinished phase (use `/session/:id/${route}`)
 *   { phase: null, route: 'complete', label: 'Session' } → no more forward phases
 */
export function getNextPhaseRoute(session, justCompleted = null) {
  // Apply the just-completed flip locally so callers don't need a re-fetch.
  const s = session ? { ...session } : {};
  if (justCompleted) s[`${justCompleted}_completed`] = true;
  const next = justCompleted ? getNextForwardPhase(s, justCompleted) : getNextPhase(s);
  if (!next) return { phase: null, route: 'complete', label: 'Session' };
  return { phase: next, route: PHASE_ROUTES[next], label: PHASE_LABELS[next] };
}

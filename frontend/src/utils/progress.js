import { supabase } from '../lib/supabase';

/**
 * Progress utility functions used across all session screens.
 * All functions are async and return { success, data?, error? }.
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
      Object.assign(updatePayload, scoreData);
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

    if (allDone && !updated.is_completed) {
      const { data: completed, error: cErr } = await supabase
        .from('user_sessions')
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq('id', userSessionId)
        .select('user_module_id')
        .single();
      if (cErr) throw cErr;

      if (completed?.user_module_id) {
        await checkModuleCompletion(completed.user_module_id);
      }
    }

    return { success: true, data: updated };
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
 * Update user stats after finishing work.
 * Bumps sessions_completed, updates streak (simple: last_active_date = today), adds minutes.
 */
export async function updateStats(enrollmentId, timeSpentMinutes = 0) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Fetch existing stats row (may not exist)
    const { data: existing } = await supabase
      .from('user_stats')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('user_stats').insert({
        enrollment_id: enrollmentId,
        sessions_completed: 0,
        streak: 1,
        total_time_minutes: timeSpentMinutes,
        last_active_date: today,
      });
      return { success: true, data: { streak: 1 } };
    }

    // Compute new streak
    let streak = existing.streak || 0;
    const lastActive = existing.last_active_date;
    if (lastActive) {
      const diffDays = Math.floor(
        (new Date(today) - new Date(lastActive)) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 0) {
        // same day - no change
      } else if (diffDays === 1) {
        streak += 1;
      } else {
        streak = 1;
      }
    } else {
      streak = 1;
    }

    const { error } = await supabase
      .from('user_stats')
      .update({
        total_time_minutes: (existing.total_time_minutes || 0) + timeSpentMinutes,
        streak,
        last_active_date: today,
      })
      .eq('enrollment_id', enrollmentId);
    if (error) throw error;

    return { success: true, data: { streak } };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Determine the next phase to work on for a session.
 * Order: notes → quiz → interview → simulation
 * Returns the phase key, or null if all complete.
 */
export function getNextPhase(session) {
  if (!session) return null;
  if (!session.notes_completed) return 'notes';
  if (!session.quiz_completed) return 'quiz';
  if (!session.interview_completed) return 'interview';
  if (!session.simulation_completed) return 'simulation';
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
 * Skips any already-complete phase. Returns:
 *   { phase, route, label }   → next unfinished phase (use `/session/:id/${route}`)
 *   { phase: null, route: 'complete', label: 'Session' } → all phases done
 */
export function getNextPhaseRoute(session, justCompleted = null) {
  // Apply the just-completed flip locally so callers don't need a re-fetch.
  const s = session ? { ...session } : {};
  if (justCompleted) s[`${justCompleted}_completed`] = true;
  const next = getNextPhase(s);
  if (!next) return { phase: null, route: 'complete', label: 'Session' };
  return { phase: next, route: PHASE_ROUTES[next], label: PHASE_LABELS[next] };
}

/**
 * Shared session timing helpers.
 * Formula: effective_minutes = round(video_duration_minutes || 15) + 10
 *   - video part  : actual video length (or 15 min default when no video)
 *   - fixed part  : 10 min reserved for quiz + simulation
 */

/**
 * Calculate effective session minutes from a session/master_session row.
 * Works for both user_sessions (joined master) and standalone master_sessions.
 * @param {Object} session - any object with optional video_duration_minutes
 * @returns {number}
 */
export function effectiveMinutes(session) {
  const vd = session?.video_duration_minutes;
  const videoPart = vd != null && Number(vd) > 0 ? Math.round(Number(vd)) : 15;
  return videoPart + 10;
}

/**
 * Format minutes as "Xh Ym" or "Ym" string.
 * @param {number} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  if (!minutes || minutes < 1) return '—';
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

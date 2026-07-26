// Feb 2026 — Feature flag: hide session-level interview phase for learners.
//
// Business rationale: session interviews were the only user flow hitting
// Claude Sonnet 4.5 (5× the price of Haiku). Consolidating interview
// practice into the dedicated /mock-interview experience cuts total AI
// cost per user by ~40-45% with no learner disruption (all sessions have
// a quiz + simulation + notes; nothing is stranded).
//
// This flag deliberately does NOT touch the DB schema, the admin panel,
// or the `master_interview_questions` data — flip this constant back to
// `true` to re-enable the phase everywhere.

export const SESSION_INTERVIEW_ENABLED = false;

/** Phase order for a single session — driven by the flag above. */
export const SESSION_PHASE_ORDER = SESSION_INTERVIEW_ENABLED
  ? ['notes', 'quiz', 'interview', 'simulation']
  : ['notes', 'quiz', 'simulation'];

/** The phase that comes immediately AFTER `phase`, or null if last. */
export function nextSessionPhase(phase) {
  const idx = SESSION_PHASE_ORDER.indexOf(phase);
  if (idx < 0 || idx >= SESSION_PHASE_ORDER.length - 1) return null;
  return SESSION_PHASE_ORDER[idx + 1];
}

/** The phase that comes immediately BEFORE `phase`, or null if first. */
export function prevSessionPhase(phase) {
  const idx = SESSION_PHASE_ORDER.indexOf(phase);
  if (idx <= 0) return null;
  return SESSION_PHASE_ORDER[idx - 1];
}

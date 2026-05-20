// Cross-context bus for badge evaluation side effects.
// Mirrors streakBus.js — set on BadgeProvider mount, called from anywhere.

let _evaluator = null;

export function setBadgeEvaluator(fn) { _evaluator = fn; }
export function clearBadgeEvaluator(fn) {
  if (_evaluator === fn) _evaluator = null;
}

export async function triggerBadgeEvaluation(context = {}) {
  if (!_evaluator) return { ok: false, reason: 'no_evaluator' };
  try {
    return await _evaluator(context);
  } catch (err) {
    return { ok: false, reason: 'evaluator_threw', error: err?.message || String(err) };
  }
}

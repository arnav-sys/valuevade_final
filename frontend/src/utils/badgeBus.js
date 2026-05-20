// Cross-context bus for badge evaluation side effects.
//
// Used so XPContext, StreakContext, progress.js, and any page can call into
// the badge evaluator without importing BadgeContext directly. Mirrors
// streakBus.js shape but adds a coalescing debounce (~150ms) so multiple
// triggers from one user action (e.g. progress.js fires after award_xp +
// streak update) collapse into a single evaluate_badges RPC call.
//
// Context merging policy: while the debounce is pending, every additional
// triggerBadgeEvaluation() call merges its context into the queued payload
// — later keys win on conflict. This way progress.js can fire with the rich
// session context and a stale XPContext call coming through 50ms later
// can't blow away the session_id.

let _evaluator = null;
let _pending = null;     // merged context for the next flush
let _timer = null;       // setTimeout handle
let _flushing = null;    // promise outstanding flush returns to all callers
let _resolvers = [];     // callbacks waiting on next flush
const DEBOUNCE_MS = 150;

export function setBadgeEvaluator(fn) { _evaluator = fn; }
export function clearBadgeEvaluator(fn) {
  if (_evaluator === fn) _evaluator = null;
}

function _flush() {
  _timer = null;
  const ctx = _pending || {};
  _pending = null;
  const resolvers = _resolvers;
  _resolvers = [];
  if (!_evaluator) {
    const noop = { ok: false, reason: 'no_evaluator' };
    resolvers.forEach((r) => r(noop));
    _flushing = null;
    return;
  }
  _flushing = (async () => {
    try {
      const out = await _evaluator(ctx);
      resolvers.forEach((r) => r(out));
      return out;
    } catch (err) {
      const out = { ok: false, reason: 'evaluator_threw', error: err?.message || String(err) };
      resolvers.forEach((r) => r(out));
      return out;
    } finally {
      _flushing = null;
    }
  })();
}

/**
 * Schedule a badge evaluation. Coalesces with any other calls within ~150ms.
 * Returns a promise that resolves with the (merged) flush result.
 */
export function triggerBadgeEvaluation(context = {}) {
  _pending = { ..._pending, ...context };
  return new Promise((resolve) => {
    _resolvers.push(resolve);
    if (_timer) return; // already scheduled
    _timer = setTimeout(_flush, DEBOUNCE_MS);
  });
}

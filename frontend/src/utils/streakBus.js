// Cross-context bus for streak side effects.
//
// XPContext can't import from StreakContext (circular).  Pages can
// import either / both, but we want a single ergonomic entry point so a
// call site doesn't have to know whether the user is mid-render or whether
// StreakProvider has mounted yet.  The bus lets StreakProvider attach its
// updateOnActivity() once on mount; everyone else just calls triggerStreakUpdate().

let _updater = null;

export function setStreakUpdater(fn) {
  _updater = fn;
}

export function clearStreakUpdater(fn) {
  if (_updater === fn) _updater = null;
}

export async function triggerStreakUpdate() {
  if (!_updater) return { ok: false, reason: 'no_updater' };
  try {
    return await _updater();
  } catch (err) {
    return { ok: false, reason: 'updater_threw', error: err?.message || String(err) };
  }
}

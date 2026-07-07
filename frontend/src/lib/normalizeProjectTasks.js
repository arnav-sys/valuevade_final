/**
 * Normalize `master_module_projects.tasks` (jsonb) into a flat array of
 * TaskCard-shaped entries: { title, description, hints[], resources[] }.
 *
 * Handles all shapes we've seen in the wild:
 *   - Array<{title,description,...}>          (legacy)
 *   - { todo: [{ task, hint? }, ...] }        (current curriculum seed)
 *   - { tasks: [...] }                         (defensive alt)
 *   - Array<string>                            (defensive)
 * Never throws. Returns `[]` for anything unrecognizable.
 */
export function normalizeProjectTasks(raw) {
  let arr = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && Array.isArray(raw.todo)) arr = raw.todo;
  else if (raw && Array.isArray(raw.tasks)) arr = raw.tasks;
  return arr.map((t, i) => {
    if (t && typeof t === 'object') {
      const title = t.title || t.task || t.name || `Task ${i + 1}`;
      const description = t.description || t.detail || '';
      const hint = t.hint;
      const hints = Array.isArray(t.hints)
        ? t.hints
        : (typeof hint === 'string' && hint.trim() ? [hint] : []);
      return { title, description, hints, resources: t.resources || [] };
    }
    return { title: String(t || `Task ${i + 1}`), description: '', hints: [], resources: [] };
  });
}

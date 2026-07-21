/**
 * Parses the `phases` JSONB blob stored on `master_capstone_projects` into
 * the phase/task array shape the CapstoneTasksPage renderer expects.
 *
 * DB shape (as of Feb 2026):
 *   phases = {
 *     code, meta, learning_outcomes, required_structure,
 *     prerequisite_capstone_codes: [...],
 *     tasks_raw: "**Task 2.1 — Title**\n- **Objective:** ...\n- **Do:**\n  - [ ] step\n**Task 2.2 — ..."
 *   }
 *
 * Frontend shape expected by CapstoneTasksPage + TaskCard:
 *   phases = [
 *     { phase_title: string, phase_description?: string,
 *       tasks: [{ title, description }, ...] }
 *   ]
 *
 * Strategy:
 *   - Every "**Task N.M — Title**" line starts a new task card.
 *   - Everything until the next "**Task " header becomes that task's
 *     description (as markdown-lite text). The renderer already collapses
 *     description behind an expand toggle, so long text is fine.
 *   - We wrap the whole list in a single phase called "Tasks" so the
 *     accordion UI still works (one big collapsible with N tasks).
 *   - If parsing yields zero tasks, we return an empty array so the
 *     "No phases configured" fallback fires (nothing broken).
 */
export function normaliseCapstonePhases(rawPhases) {
  // Already in array form? (Older data or admin-edited)
  if (Array.isArray(rawPhases)) return rawPhases;
  if (!rawPhases || typeof rawPhases !== 'object') return [];

  // Some rows may have `phases: { tasks: [...] }` — pass through.
  if (Array.isArray(rawPhases.tasks) && rawPhases.tasks.length) {
    return [{
      phase_title: 'Tasks',
      phase_description: rawPhases.required_structure || '',
      tasks: rawPhases.tasks,
    }];
  }

  const raw = typeof rawPhases.tasks_raw === 'string' ? rawPhases.tasks_raw : '';
  if (!raw.trim()) return [];

  // Split on the "**Task N.M —" header, keep the delimiter as the start of
  // each chunk. Using a lookahead means the header stays with the block.
  const parts = raw.split(/\n(?=\*\*Task\s+[\d.]+\s*[—-])/g).map((s) => s.trim()).filter(Boolean);

  const tasks = parts
    .filter((chunk) => /^\*\*Task\s+[\d.]+\s*[—-]/i.test(chunk))
    .map((chunk) => {
      // First line is the header. Strip the surrounding `**...**` and the
      // "Task N.M — " prefix so we're left with just the title.
      const firstNewline = chunk.indexOf('\n');
      const headerLine = firstNewline === -1 ? chunk : chunk.slice(0, firstNewline);
      const body = firstNewline === -1 ? '' : chunk.slice(firstNewline + 1);
      const titleMatch = headerLine.match(/^\*\*Task\s+[\d.]+\s*[—-]\s*(.+?)\*\*\s*$/i);
      const title = titleMatch ? titleMatch[1].trim() : headerLine.replace(/\*/g, '').trim();
      return {
        title,
        description: body.trim(),
      };
    });

  if (!tasks.length) return [];
  return [{
    phase_title: 'Tasks',
    phase_description: rawPhases.required_structure || rawPhases.learning_outcomes || '',
    tasks,
  }];
}

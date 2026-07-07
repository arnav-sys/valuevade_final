/**
 * Phase C — Module Project editor modal.
 * PATCH /api/admin/module-projects/{module_id} upserts by module_id.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X as XIcon, Save } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

async function req(path, method = 'GET', body = null) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j = null; try { j = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error((j && (j.detail || j.message)) || text || `${r.status}`);
  return j;
}

export default function ModuleProjectModal({ moduleId, moduleTitle, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [draft, setDraft] = useState(null);
  const [tasksText, setTasksText] = useState('');
  const [tasksErr, setTasksErr] = useState(null);
  const [existed, setExisted] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const j = await req(`/api/admin/module-projects/${moduleId}`);
        if (!mounted) return;
        const p = j.project;
        setExisted(!!p);
        setDraft({
          title: p?.title || '',
          description: p?.description || '',
          deliverable_description: p?.deliverable_description || '',
          estimated_hours: p?.estimated_hours ?? 5,
        });
        setTasksText(JSON.stringify(p?.tasks || { todo: [] }, null, 2));
      } catch (e) {
        if (mounted) setErr(e.message);
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [moduleId]);

  const save = async () => {
    if (!draft) return;
    let tasksObj;
    try {
      tasksObj = tasksText.trim() ? JSON.parse(tasksText) : { todo: [] };
    } catch (e) {
      setTasksErr(`Invalid JSON: ${e.message}`);
      return;
    }
    setSaving(true); setErr(null);
    try {
      await req(`/api/admin/module-projects/${moduleId}`, 'PATCH', {
        title: draft.title,
        description: draft.description,
        deliverable_description: draft.deliverable_description,
        estimated_hours: Number(draft.estimated_hours) || 0,
        tasks: tasksObj,
      });
      onClose(true);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose(false)}
      data-testid="module-project-modal"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">
              Module project {existed ? '' : '(new)'}
            </div>
            <div className="text-sm font-semibold text-[var(--color-text)]" data-testid="module-project-modal-title">{moduleTitle}</div>
          </div>
          <button onClick={() => onClose(false)} data-testid="module-project-modal-close" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            <XIcon size={18} />
          </button>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading…</p>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {err && <p className="text-sm text-red-500" data-testid="module-project-error">{err}</p>}
            <div>
              <label className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Title</label>
              <input
                value={draft?.title || ''}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                data-testid="module-project-title-input"
                className="w-full mt-1 text-sm px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Estimated hours</label>
              <input
                type="number" min="0"
                value={draft?.estimated_hours ?? 0}
                onChange={(e) => setDraft({ ...draft, estimated_hours: e.target.value })}
                data-testid="module-project-hours-input"
                className="w-32 mt-1 text-sm px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Description / objective</label>
              <textarea
                value={draft?.description || ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={5}
                data-testid="module-project-description-textarea"
                className="w-full mt-1 text-sm px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Deliverable</label>
              <textarea
                value={draft?.deliverable_description || ''}
                onChange={(e) => setDraft({ ...draft, deliverable_description: e.target.value })}
                rows={4}
                data-testid="module-project-deliverable-textarea"
                className="w-full mt-1 text-sm px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">
                Tasks (JSON — shape: {"{ todo: [{ task, time_estimate?, hint? }] }"})
              </label>
              <textarea
                value={tasksText}
                onChange={(e) => { setTasksText(e.target.value); setTasksErr(null); }}
                rows={10}
                data-testid="module-project-tasks-textarea"
                className="w-full mt-1 text-xs px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] font-mono resize-y"
              />
              {tasksErr && <p className="text-[10px] text-red-500 mt-1" data-testid="module-project-tasks-error">{tasksErr}</p>}
            </div>
          </div>
        )}

        <div className="px-6 py-3 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
          <button
            onClick={() => onClose(false)}
            data-testid="module-project-cancel-btn"
            className="px-4 py-2 rounded-lg text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface)]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            data-testid="module-project-save-btn"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-accent-purple)] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving…' : existed ? 'Save changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

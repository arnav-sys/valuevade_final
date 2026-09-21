/**
 * Phase C, Capstones editor for the Admin Curriculum tab.
 * Lists CAP-01/02/03 in a left rail; right pane is the inline form.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Save } from 'lucide-react';

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

export default function CapstonesEditor() {
  const [caps, setCaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selCode, setSelCode] = useState('CAP-01');
  const [draft, setDraft] = useState(null);
  const [phasesText, setPhasesText] = useState('');
  const [phasesErr, setPhasesErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const j = await req('/api/admin/capstones');
      setCaps(j.capstones || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const sel = caps.find((c) => c.code === selCode) || null;

  // When selection changes, hydrate draft from row
  useEffect(() => {
    if (!sel) { setDraft(null); return; }
    setDraft({
      title: sel.title || '',
      description: sel.description || '',
      deliverable_description: sel.deliverable_description || '',
      estimated_hours: sel.estimated_hours || 0,
      prereqs: (sel.phases?.prerequisite_capstone_codes || []).join(', '),
    });
    setPhasesText(JSON.stringify(sel.phases || {}, null, 2));
    setPhasesErr(null);
  }, [sel]);

  const save = async () => {
    if (!draft || !sel) return;
    // Parse the phases JSON textarea (advanced admins can tweak deep fields).
    let phasesObj;
    try {
      phasesObj = phasesText.trim() ? JSON.parse(phasesText) : {};
    } catch (e) {
      setPhasesErr(`Invalid JSON: ${e.message}`);
      return;
    }
    // Overlay the prereq list from the convenience input onto phases
    const prereqs = draft.prereqs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    phasesObj.code = sel.code;
    phasesObj.prerequisite_capstone_codes = prereqs;
    setSaving(true); setErr(null);
    try {
      await req(`/api/admin/capstones/${sel.code}`, 'PATCH', {
        title: draft.title,
        description: draft.description,
        deliverable_description: draft.deliverable_description,
        estimated_hours: Number(draft.estimated_hours) || 0,
        phases: phasesObj,
      });
      await reload();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="p-4 text-sm text-[var(--color-text-muted)]">Loading capstones…</p>;
  if (err) return <p className="p-4 text-sm text-red-500" data-testid="capstones-editor-error">{err}</p>;

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px]" data-testid="capstones-editor">
      {/* Left rail, capstone list */}
      <div className="w-64 flex-shrink-0 border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <span className="text-sm font-semibold text-[var(--color-text)]">Capstones ({caps.length})</span>
        </div>
        <ul className="flex-1 overflow-y-auto" data-testid="capstones-list">
          {caps.map((c) => (
            <li
              key={c.code}
              onClick={() => setSelCode(c.code)}
              className={`px-4 py-3 border-b border-[var(--color-border)] cursor-pointer transition-colors ${
                selCode === c.code ? 'bg-[var(--color-primary)]/10' : 'hover:bg-[var(--color-surface)]'
              }`}
              data-testid={`capstone-row-${c.code}`}
            >
              <div className="text-xs font-mono text-[var(--color-text-muted)]">{c.code}</div>
              <div className="text-sm text-[var(--color-text)] leading-snug">{c.title}</div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                {c.estimated_hours}h
                {c.phases?.prerequisite_capstone_codes?.length ? ` · requires ${c.phases.prerequisite_capstone_codes.join(', ')}` : ''}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Right, editor form */}
      <div className="flex-1 border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col">
        {sel && draft ? (
          <>
            <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <div className="text-xs font-mono uppercase text-[var(--color-text-muted)]">{sel.code}</div>
                <div className="text-sm font-semibold text-[var(--color-text)]">Editing capstone</div>
              </div>
              <button
                onClick={save}
                disabled={saving}
                data-testid="capstone-save-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-accent-purple)] text-white text-xs hover:brightness-110 disabled:opacity-50"
              >
                <Save size={12} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Title</label>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  data-testid="capstone-title-input"
                  className="w-full mt-1 text-sm px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Estimated hours</label>
                  <input
                    type="number" min="0"
                    value={draft.estimated_hours}
                    onChange={(e) => setDraft({ ...draft, estimated_hours: e.target.value })}
                    data-testid="capstone-hours-input"
                    className="w-full mt-1 text-sm px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">
                    Prerequisite codes (comma-separated, e.g. CAP-01)
                  </label>
                  <input
                    value={draft.prereqs}
                    onChange={(e) => setDraft({ ...draft, prereqs: e.target.value })}
                    placeholder="CAP-01, CAP-02"
                    data-testid="capstone-prereqs-input"
                    className="w-full mt-1 text-sm px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Brief / description</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={5}
                  data-testid="capstone-description-textarea"
                  className="w-full mt-1 text-sm px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">Deliverables</label>
                <textarea
                  value={draft.deliverable_description}
                  onChange={(e) => setDraft({ ...draft, deliverable_description: e.target.value })}
                  rows={5}
                  data-testid="capstone-deliverables-textarea"
                  className="w-full mt-1 text-sm px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">
                  Advanced: phases (JSON, includes meta, tasks_raw, learning_outcomes, required_structure)
                </label>
                <textarea
                  value={phasesText}
                  onChange={(e) => { setPhasesText(e.target.value); setPhasesErr(null); }}
                  rows={12}
                  data-testid="capstone-phases-textarea"
                  className="w-full mt-1 text-xs px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] font-mono resize-y"
                />
                {phasesErr && <p className="text-[10px] text-red-500 mt-1" data-testid="capstone-phases-error">{phasesErr}</p>}
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  `code` and `prerequisite_capstone_codes` are overwritten from the fields above on save.
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="p-5 text-sm text-[var(--color-text-muted)]">Select a capstone on the left.</p>
        )}
      </div>
    </div>
  );
}

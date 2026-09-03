import { useState, useEffect } from 'react';
import { authFetch } from './adminUtils';
import { supabase } from '../../lib/supabase';
import { Sparkles, Check, Plus, Pencil, Trash2, Loader2, X as XIcon } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

function CustomizationEditModal({ question, onClose, onSaved }) {
  const isNew = !question;
  const [questionText, setQuestionText] = useState(question?.question_text || '');
  const [questionType, setQuestionType] = useState(question?.question_type || 'single_select');
  const [purpose, setPurpose] = useState(question?.purpose || '');
  const [orderIndex, setOrderIndex] = useState(question?.order_index ?? 100);
  const [isRequired, setIsRequired] = useState(question?.is_required ?? true);
  const [pathId, setPathId] = useState(question?.path_id || '');
  const [options, setOptions] = useState(Array.isArray(question?.options) ? question.options : []);
  const [pathOptions, setPathOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('master_paths').select('id, title').order('created_at');
        setPathOptions(data || []);
        if (isNew && !pathId && data && data.length) setPathId(data[0].id);
      } catch {}
    })();
  }, [isNew, pathId]);

  const addOption = () => setOptions([...options, { value: '', label: '', sub: '' }]);
  const updateOption = (idx, key, val) => { const copy = options.slice(); copy[idx] = { ...copy[idx], [key]: val }; setOptions(copy); };
  const removeOption = (idx) => setOptions(options.filter((_, i) => i !== idx));
  const needsOptions = questionType === 'single_select' || questionType === 'multi_select';

  const save = async () => {
    if (!questionText.trim()) { setErr('Question text is required.'); return; }
    if (isNew && !pathId) { setErr('Please pick which course this question applies to.'); return; }
    if (needsOptions) {
      const cleaned = options.filter((o) => (o.value || '').trim() && (o.label || '').trim());
      if (cleaned.length < 2) { setErr('Select-type questions need at least 2 options (both value + label).'); return; }
    }
    setSaving(true); setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const body = { question_text: questionText.trim(), question_type: questionType, options: needsOptions ? options.filter((o) => o.value && o.label) : [], order_index: Number(orderIndex) || 100, is_required: isRequired, purpose: purpose.trim() || null, ...(isNew ? { path_id: pathId } : {}) };
      const url = isNew ? `${API}/api/admin/customization-questions` : `${API}/api/admin/customization-questions/${question.id}`;
      const r = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 py-6" onClick={() => !saving && onClose()} data-testid="customization-edit-modal">
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">{isNew ? 'Add customisation question' : 'Edit question'}</h3>
          <button onClick={() => !saving && onClose()} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="customization-edit-close"><XIcon size={18} /></button>
        </div>
        <div className="space-y-3">
          {isNew && (
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Course</label>
              <select value={pathId} onChange={(e) => setPathId(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" data-testid="customization-edit-path">
                <option value="" disabled>Pick a course…</option>
                {pathOptions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Type</label>
              <select value={questionType} onChange={(e) => setQuestionType(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" data-testid="customization-edit-type">
                <option value="single_select">Single select (radio)</option>
                <option value="multi_select">Multi select (checkboxes)</option>
                <option value="text">Free text</option>
                <option value="number">Number</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Order</label>
              <input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" data-testid="customization-edit-order" />
            </div>
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Question text</label>
            <input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="e.g. What's your finance background?" className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" data-testid="customization-edit-question" />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Purpose (internal note)</label>
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} placeholder="How this answer changes the curriculum" className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs font-bricolage" data-testid="customization-edit-purpose" />
          </div>
          {needsOptions && (
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Options</label>
              <div className="space-y-2 mt-1">
                {options.map((opt, idx) => (
                  <div key={idx} className="grid grid-cols-[100px_1fr_1fr_28px] gap-2 items-center" data-testid={`customization-edit-option-${idx}`}>
                    <input placeholder="value" value={opt.value || ''} onChange={(e) => updateOption(idx, 'value', e.target.value)} className="px-2 py-1.5 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs font-mono" />
                    <input placeholder="Label" value={opt.label || ''} onChange={(e) => updateOption(idx, 'label', e.target.value)} className="px-2 py-1.5 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs" />
                    <input placeholder="Subtext (optional)" value={opt.sub || ''} onChange={(e) => updateOption(idx, 'sub', e.target.value)} className="px-2 py-1.5 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs" />
                    <button type="button" onClick={() => removeOption(idx)} className="text-red-500 hover:bg-red-500/10 rounded p-1" data-testid={`customization-remove-option-${idx}`}><XIcon size={12} /></button>
                  </div>
                ))}
                <button type="button" onClick={addOption} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="customization-add-option-btn"><Plus size={11} /> Add option</button>
              </div>
            </div>
          )}
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text)]">
            <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} className="w-4 h-4" data-testid="customization-edit-required" />
            Required (user must answer to proceed)
          </label>
          {err && <div className="text-sm text-red-500" data-testid="customization-edit-error">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={() => !saving && onClose()} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]" disabled={saving} data-testid="customization-edit-cancel">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:brightness-110 disabled:opacity-60" data-testid="customization-edit-save">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving…' : (isNew ? 'Create question' : 'Save changes')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomizationTab() {
  const [mode, setMode] = useState(null);
  const [modeSaving, setModeSaving] = useState(false);
  const [modeErr, setModeErr] = useState(null);
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dataErr, setDataErr] = useState(null);

  const reloadMode = () =>
    fetch(`${API}/api/app-settings/ai-customization`).then((r) => r.json()).then((j) => setMode(j.mode || 'off')).catch((e) => setModeErr(e.message));

  const reloadQuestions = () => authFetch('/api/admin/customization-questions').then(setData).catch((e) => setDataErr(e.message));

  useEffect(() => { reloadMode(); reloadQuestions(); }, []);

  const changeMode = async (newMode) => {
    setModeSaving(true); setModeErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/admin/app-settings/ai-customization`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ mode: newMode }) });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      setMode(newMode);
    } catch (e) { setModeErr(e.message); }
    finally { setModeSaving(false); }
  };

  const delQ = async (id) => {
    if (!window.confirm('Delete this customisation question permanently?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/admin/customization-questions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      reloadQuestions();
    } catch (e) { alert('Delete failed: ' + e.message); }
  };

  return (
    <div data-testid="customization-tab" className="space-y-6">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5" data-testid="customization-mode-card">
        <div className="flex items-start gap-2 mb-3">
          <Sparkles size={16} className="text-[var(--color-accent-purple)] mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">AI customisation flow</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Controls whether the &quot;Customise with AI&quot; button shows on the enrolment page.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
          {[{ key: 'off', title: 'Off', desc: 'Only standard one-click enrol' }, { key: 'optional', title: 'Optional', desc: 'Both CTAs — user chooses' }, { key: 'mandatory', title: 'Mandatory', desc: 'Every new enrollee must customise' }].map((opt) => (
            <button key={opt.key} type="button" disabled={modeSaving || mode === opt.key} onClick={() => changeMode(opt.key)} data-testid={`customization-mode-${opt.key}`} className={`text-left rounded-xl border px-4 py-3 transition-all ${mode === opt.key ? 'border-[var(--color-accent-purple)] bg-[var(--color-accent-purple)]/10' : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--color-text)]">{opt.title}</span>
                {mode === opt.key && <Check size={14} className="text-[var(--color-accent-purple)]" />}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
        {modeErr && <p className="text-xs text-red-500 mt-2" data-testid="customization-mode-error">{modeErr}</p>}
        {mode === null && <p className="text-xs text-[var(--color-text-muted)] mt-2">Loading…</p>}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5" data-testid="customization-questions-card">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">Customisation questions<span className="px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-mono" data-testid="customization-total">{data ? data.total : '…'}</span></h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">These are asked in order when a user hits the AI customisation wizard.</p>
          </div>
          <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] hover:brightness-110 text-white text-sm font-medium transition-all" data-testid="customization-add-btn"><Plus size={14} /> Add question</button>
        </div>
        {dataErr && <div className="text-red-500 text-sm mb-3" data-testid="customization-questions-error">{dataErr}</div>}
        {!data && !dataErr && <div className="text-[var(--color-text-muted)] text-sm" data-testid="customization-questions-loading">Loading…</div>}
        {data?.table_ready === false && (<div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300" data-testid="customization-table-missing">The <code className="font-mono">master_customization_questions</code> table isn't set up on Supabase yet.</div>)}
        {data && data.questions?.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="customization-questions-table">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg)] text-left text-[var(--color-text-muted)]"><tr><th className="p-3 w-16">#</th><th className="p-3">Question</th><th className="p-3 w-28">Type</th><th className="p-3 w-24">Options</th><th className="p-3 w-24">Required</th><th className="p-3 w-32 text-right">Actions</th></tr></thead>
              <tbody>
                {data.questions.map((q) => (
                  <tr key={q.id} className="border-t border-[var(--color-border)]" data-testid={`customization-q-row-${q.id}`}>
                    <td className="p-3 font-mono text-xs text-[var(--color-text-muted)]">{q.order_index}</td>
                    <td className="p-3"><div className="font-medium text-[var(--color-text)]">{q.question_text}</div>{q.purpose && <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 max-w-lg truncate" title={q.purpose}>{q.purpose}</div>}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-[var(--color-bg)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-accent-purple)]">{q.question_type}</span></td>
                    <td className="p-3 text-xs text-[var(--color-text-muted)]">{Array.isArray(q.options) ? q.options.length : 0}</td>
                    <td className="p-3 text-xs">{q.is_required ? <span className="text-emerald-500">Yes</span> : <span className="text-[var(--color-text-muted)]">No</span>}</td>
                    <td className="p-3 text-right">
                      <button type="button" onClick={() => setEditing(q)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 text-xs mr-1" data-testid={`customization-edit-${q.id}`}><Pencil size={11} /> Edit</button>
                      <button type="button" onClick={() => delQ(q.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-500 hover:bg-red-500/10 text-xs" data-testid={`customization-delete-${q.id}`}><Trash2 size={11} /> Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.questions?.length === 0 && data.table_ready !== false && (<div className="p-6 text-center text-sm text-[var(--color-text-muted)]">No customisation questions yet. Click &quot;Add question&quot; above.</div>)}
      </div>
      {editing && (<CustomizationEditModal question={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reloadQuestions(); }} />)}
    </div>
  );
}

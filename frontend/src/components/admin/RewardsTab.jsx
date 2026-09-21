import { useState, useEffect } from 'react';
import { authFetch, authPost, authFetchJson, API } from './adminUtils';
import { supabase } from '../../lib/supabase';
import JSZip from 'jszip';
import { Plus, Pencil, Trash2, Check, Upload, Loader2, X as XIcon, FolderOpen } from 'lucide-react';

function RewardEditorModal({ reward, triggers, onClose, onSaved }) {
  const isNew = !!reward.isNew;
  const [form, setForm] = useState({
    title: reward.title || '',
    description: reward.description || '',
    linkedin_message: reward.linkedin_message || '',
    trigger_type: reward.trigger_type || 'module_complete',
    trigger_ref_id: reward.trigger_ref_id || '',
    order_index: reward.order_index || 100,
    is_active: reward.is_active !== false,
    resource_file_path: reward.resource_file_path || null,
    resource_file_name: reward.resource_file_name || null,
    resource_mime: reward.resource_mime || null,
    resource_size_bytes: reward.resource_size_bytes || null,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const options = form.trigger_type === 'capstone_complete' ? triggers.capstones : triggers.modules;

  async function uploadFile(file) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('File exceeds 50 MB limit.'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/admin/rewards/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
        body: fd,
      });
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch {}
      if (!r.ok) throw new Error(json?.detail || text || 'Upload failed');
      setForm((f) => ({ ...f, resource_file_path: json.resource_file_path, resource_file_name: json.resource_file_name, resource_mime: json.resource_mime, resource_size_bytes: json.resource_size_bytes }));
    } catch (e) { alert(`Upload failed: ${e.message}`); }
    finally { setUploading(false); }
  }

  async function uploadFolder(fileList) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const zip = new JSZip();
      for (const file of fileList) zip.file(file.webkitRelativePath || file.name, file);
      const folderName = fileList[0].webkitRelativePath?.split('/')[0] || 'folder';
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      if (zipBlob.size > 50 * 1024 * 1024) { alert('Zipped folder exceeds 50 MB limit.'); return; }
      await uploadFile(new File([zipBlob], `${folderName}.zip`, { type: 'application/zip' }));
    } catch (e) { alert(`Folder zip failed: ${e.message}`); }
    finally { setUploading(false); }
  }

  async function save() {
    if (!form.title.trim() || !form.trigger_ref_id) { setError('Title and trigger target are required.'); return; }
    setSaving(true); setError(null);
    try {
      if (isNew) {
        await authPost('/api/admin/rewards', form);
      } else {
        await authFetchJson(`/api/admin/rewards/${reward.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      }
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="admin-reward-editor">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--color-text)] font-bricolage">{isNew ? 'New Reward' : 'Edit Reward'}</h3>
            <button onClick={onClose} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"><XIcon size={20} /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm" placeholder="e.g. Investment Banking Resume Template" data-testid="admin-reward-title-input" />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm" data-testid="admin-reward-desc-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">Trigger *</label>
                <select value={form.trigger_type} onChange={(e) => setForm({ ...form, trigger_type: e.target.value, trigger_ref_id: '' })} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm" data-testid="admin-reward-trigger-type">
                  <option value="module_complete">Module Complete</option>
                  <option value="capstone_complete">Capstone Complete</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">Target *</label>
                <select value={form.trigger_ref_id} onChange={(e) => setForm({ ...form, trigger_ref_id: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm" data-testid="admin-reward-trigger-ref">
                  <option value="">pick one</option>
                  {options.map((o) => (<option key={o.id} value={o.id}>{form.trigger_type === 'module_complete' ? `M${o.module_number}, ${o.title}` : `${o.code || 'CAP'}, ${o.title}`}</option>))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">LinkedIn post text (optional)</label>
              <textarea value={form.linkedin_message} onChange={(e) => setForm({ ...form, linkedin_message: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-bricolage" placeholder="Leave blank to use the default template." data-testid="admin-reward-linkedin-msg" />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">Resource file or folder (≤50 MB)</label>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 cursor-pointer px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors" data-testid="admin-reward-file-label">
                  <Upload size={13} /> Upload File
                  <input type="file" className="sr-only" onChange={(e) => uploadFile(e.target.files?.[0])} accept=".pdf,.docx,.doc,.xlsx,.xls,.zip,.pptx,.ppt,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip" data-testid="admin-reward-file-input" />
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors" data-testid="admin-reward-folder-label">
                  <FolderOpen size={13} /> Upload Folder
                  <input type="file" className="sr-only" webkitdirectory="" mozdirectory="" multiple onChange={(e) => uploadFolder(e.target.files)} data-testid="admin-reward-folder-input" />
                </label>
                {uploading && (<span className="flex items-center gap-1.5 text-xs text-[var(--color-primary)]"><Loader2 size={14} className="animate-spin" /> Uploading…</span>)}
              </div>
              {form.resource_file_name && !uploading && (
                <div className="mt-2 text-xs text-[var(--color-success)] flex items-center gap-1.5" data-testid="admin-reward-file-status">
                  <Check size={14} /> {form.resource_file_name} · {form.resource_size_bytes >= 1024 * 1024 ? `${(form.resource_size_bytes / (1024 * 1024)).toFixed(1)} MB` : `${(form.resource_size_bytes / 1024).toFixed(0)} KB`}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">Order</label>
                <input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value, 10) || 100 })} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm" data-testid="admin-reward-order-input" />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input id="reward-active" type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} data-testid="admin-reward-active-input" />
                <label htmlFor="reward-active" className="text-sm text-[var(--color-text)] font-bricolage">Active</label>
              </div>
            </div>
            {error && <div className="text-red-400 text-sm font-bricolage" data-testid="admin-reward-editor-error">{error}</div>}
            <div className="flex items-center gap-2 pt-2">
              <button onClick={save} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-40" data-testid="admin-reward-save-btn">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Reward'}
              </button>
              <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-sm" data-testid="admin-reward-cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RewardsTab() {
  const [state, setState] = useState({ rewards: [], table_ready: true, hint: null });
  const [triggers, setTriggers] = useState({ modules: [], capstones: [] });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const reload = async () => {
    setLoading(true); setErr(null);
    try {
      const [rewards, trig] = await Promise.all([authFetch('/api/admin/rewards'), authFetch('/api/admin/rewards/triggers')]);
      setState(rewards); setTriggers(trig);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const del = async (r) => {
    if (!window.confirm(`Delete reward "${r.title}"? This also removes the uploaded file.`)) return;
    try { await authFetchJson(`/api/admin/rewards/${r.id}`, { method: 'DELETE' }); reload(); }
    catch (e) { alert(`Delete failed: ${e.message}`); }
  };

  const toggleActive = async (r) => {
    try { await authFetchJson(`/api/admin/rewards/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !r.is_active }) }); reload(); }
    catch (e) { alert(`Toggle failed: ${e.message}`); }
  };

  if (loading) return <div className="p-4 text-[var(--color-text-muted)]">Loading rewards…</div>;
  if (err) return <div className="text-red-500 p-4" data-testid="admin-rewards-error">{err}</div>;

  return (
    <div data-testid="admin-rewards-tab">
      {!state.table_ready && (
        <div className="mb-4 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm font-mono" data-testid="admin-rewards-migration-needed">
          Migration needed: {state.hint || 'Apply /app/scripts/migrations/0037_rewards.sql via Supabase Studio → SQL Editor.'}
        </div>
      )}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text)] font-bricolage">Rewards</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Free resources unlocked when a learner shares a milestone on LinkedIn.</p>
        </div>
        <button onClick={() => setEditing({ isNew: true, trigger_type: 'module_complete', is_active: true, order_index: state.rewards.length + 1 })} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:brightness-110" data-testid="admin-rewards-add-btn">
          <Plus size={16} /> Add Reward
        </button>
      </div>
      {state.rewards.length === 0 && state.table_ready && (
        <div className="p-6 text-center rounded-2xl border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-muted)] font-bricolage">No rewards configured yet. Click <strong>Add Reward</strong> to attach a resource to a module or capstone completion.</div>
      )}
      <div className="space-y-3">
        {state.rewards.map((r) => (
          <div key={r.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4 flex flex-wrap items-start gap-4" data-testid={`admin-reward-row-${r.id}`}>
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)]">{r.trigger_type === 'capstone_complete' ? 'Capstone' : 'Module'} · #{r.order_index}</span>
                {!r.is_active && <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-amber-400">· inactive</span>}
              </div>
              <div className="text-sm font-semibold text-[var(--color-text)] font-bricolage" data-testid={`admin-reward-title-${r.id}`}>{r.title}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{r.trigger_label}</div>
              {r.resource_file_name && (<div className="text-[11px] text-[var(--color-text-faint)] mt-1 truncate">📎 {r.resource_file_name}{r.resource_size_bytes ? ` · ${(r.resource_size_bytes / 1024).toFixed(0)} KB` : ''}</div>)}
              {!r.resource_file_path && (<div className="text-[11px] text-amber-400 mt-1">⚠ No file uploaded, reward won&apos;t unlock until you attach one.</div>)}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(r)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${r.is_active ? 'border-[var(--color-success)]/50 text-[var(--color-success)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'}`} data-testid={`admin-reward-toggle-${r.id}`}>{r.is_active ? 'Active' : 'Inactive'}</button>
              <button onClick={() => setEditing(r)} className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid={`admin-reward-edit-${r.id}`} title="Edit"><Pencil size={14} /></button>
              <button onClick={() => del(r)} className="p-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10" data-testid={`admin-reward-delete-${r.id}`} title="Delete"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && (<RewardEditorModal reward={editing} triggers={triggers} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />)}
    </div>
  );
}

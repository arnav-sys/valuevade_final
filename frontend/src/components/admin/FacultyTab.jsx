import { useState, useEffect } from 'react';
import { authFetch, authPost, authFetchJson, API } from './adminUtils';
import { supabase } from '../../lib/supabase';
import { Plus, Pencil, Trash2, Loader2, X as XIcon, Upload, GripVertical } from 'lucide-react';

function FacultyModal({ item, onClose, onSaved }) {
  const isNew = !item;
  const [name, setName] = useState(item?.name || '');
  const [title, setTitle] = useState(item?.title || '');
  const [bio, setBio] = useState(item?.bio || '');
  const [photoUrl, setPhotoUrl] = useState(item?.photo_url || '');
  const [orderIndex, setOrderIndex] = useState(item?.order_index ?? 100);
  const [isPublished, setIsPublished] = useState(item?.is_published ?? true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploading(true); setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${API}/api/admin/faculty/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || `HTTP ${r.status}`);
      setPhotoUrl(j.photo_url);
    } catch (e) { setErr(e.message); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!name.trim()) { setErr('Name is required.'); return; }
    setSaving(true); setErr(null);
    try {
      const body = { name: name.trim(), title: title.trim(), bio: bio.trim(), photo_url: photoUrl, order_index: Number(orderIndex) || 100, is_published: isPublished };
      if (isNew) await authPost('/api/admin/faculty', body);
      else await authFetchJson(`/api/admin/faculty/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 py-6" onClick={() => !saving && onClose()} data-testid="faculty-edit-modal">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">{isNew ? 'Add faculty' : 'Edit faculty'}</h3>
          <button onClick={() => !saving && onClose()} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="faculty-edit-close"><XIcon size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
              {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-[var(--color-text-faint)] text-xs">No photo</span>}
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text)] hover:border-[var(--color-primary)] cursor-pointer" data-testid="faculty-photo-upload">
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {uploading ? 'Uploading…' : 'Upload photo'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
            </label>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]" data-testid="faculty-name-input" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Title / credentials</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Equity Research Lead · CFA" className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]" data-testid="faculty-title-input" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Bio / details</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]" data-testid="faculty-bio-input" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Order</label>
              <input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]" data-testid="faculty-order-input" />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)] mt-5">
              <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} data-testid="faculty-published-input" />
              Published
            </label>
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => !saving && onClose()} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)]">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white font-semibold inline-flex items-center gap-2 disabled:opacity-60" data-testid="faculty-save-btn">
            {saving && <Loader2 size={15} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FacultyTab() {
  const [data, setData] = useState({ faculty: [], table_ready: true, hint: '' });
  const [editing, setEditing] = useState(undefined);
  const [err, setErr] = useState(null);

  const reload = () => authFetch('/api/admin/faculty').then(setData).catch((e) => setErr(e.message));
  useEffect(() => { reload(); }, []);

  const del = async (id) => {
    if (!window.confirm('Delete this faculty member?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/admin/faculty/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      reload();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div data-testid="faculty-tab">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">Faculty ({data.faculty?.length || 0})</h2>
        <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white font-semibold inline-flex items-center gap-2" data-testid="faculty-add-btn">
          <Plus size={16} /> Add faculty
        </button>
      </div>
      {data.table_ready === false && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-sm" data-testid="faculty-migration-banner">
          {data.hint || 'Run migration 0044_faculty.sql in Supabase to enable this section.'}
        </div>
      )}
      {err && <p className="text-sm text-red-400 mb-3">{err}</p>}
      <div className="space-y-2">
        {(data.faculty || []).map((f) => (
          <div key={f.id} className="flex items-center gap-4 p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]" data-testid={`faculty-row-${f.id}`}>
            <GripVertical size={16} className="text-[var(--color-text-faint)]" />
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
              {f.photo_url ? <img src={f.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-[var(--color-text-faint)]">—</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[var(--color-text)] font-medium truncate">{f.name} {!f.is_published && <span className="text-xs text-[var(--color-text-faint)]">(hidden)</span>}</div>
              <div className="text-[var(--color-text-muted)] text-sm truncate">{f.title}</div>
            </div>
            <button onClick={() => setEditing(f)} className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]" data-testid={`faculty-edit-${f.id}`}><Pencil size={16} /></button>
            <button onClick={() => del(f.id)} className="p-2 text-[var(--color-text-muted)] hover:text-red-400" data-testid={`faculty-delete-${f.id}`}><Trash2 size={16} /></button>
          </div>
        ))}
        {(data.faculty || []).length === 0 && <p className="text-[var(--color-text-muted)] text-sm">No faculty yet.</p>}
      </div>
      {editing !== undefined && <FacultyModal item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />}
    </div>
  );
}

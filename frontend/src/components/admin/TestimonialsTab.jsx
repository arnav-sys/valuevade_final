import { useState, useEffect } from 'react';
import { authFetch, authPost, authFetchJson, API } from './adminUtils';
import { supabase } from '../../lib/supabase';
import { Plus, Pencil, Trash2, Loader2, X as XIcon } from 'lucide-react';

function TestimonialModal({ item, onClose, onSaved }) {
  const isNew = !item;
  const [name, setName] = useState(item?.name || '');
  const [role, setRole] = useState(item?.role || '');
  const [quote, setQuote] = useState(item?.quote || '');
  const [orderIndex, setOrderIndex] = useState(item?.order_index ?? 100);
  const [isPublished, setIsPublished] = useState(item?.is_published ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    if (!name.trim() || !quote.trim()) { setErr('Name and quote are required.'); return; }
    setSaving(true); setErr(null);
    try {
      const body = { name: name.trim(), role: role.trim(), quote: quote.trim(), order_index: Number(orderIndex) || 100, is_published: isPublished };
      if (isNew) await authPost('/api/admin/testimonials', body);
      else await authFetchJson(`/api/admin/testimonials/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 py-6" onClick={() => !saving && onClose()} data-testid="testimonial-edit-modal">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">{isNew ? 'Add testimonial' : 'Edit testimonial'}</h3>
          <button onClick={() => !saving && onClose()} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="testimonial-edit-close"><XIcon size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Student name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]" data-testid="testimonial-name-input" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Role / outcome</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. CFA L1 Candidate, Delhi" className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]" data-testid="testimonial-role-input" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Quote</label>
            <textarea value={quote} onChange={(e) => setQuote(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]" data-testid="testimonial-quote-input" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Order</label>
              <input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]" data-testid="testimonial-order-input" />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)] mt-5">
              <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} data-testid="testimonial-published-input" />
              Published
            </label>
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => !saving && onClose()} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)]">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white font-semibold inline-flex items-center gap-2 disabled:opacity-60" data-testid="testimonial-save-btn">
            {saving && <Loader2 size={15} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TestimonialsTab() {
  const [data, setData] = useState({ testimonials: [], table_ready: true, hint: '' });
  const [editing, setEditing] = useState(undefined);
  const [err, setErr] = useState(null);

  const reload = () => authFetch('/api/admin/testimonials').then(setData).catch((e) => setErr(e.message));
  useEffect(() => { reload(); }, []);

  const del = async (id) => {
    if (!window.confirm('Delete this testimonial?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/admin/testimonials/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      reload();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div data-testid="testimonials-tab">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">Testimonials ({data.testimonials?.length || 0})</h2>
        <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white font-semibold inline-flex items-center gap-2" data-testid="testimonial-add-btn">
          <Plus size={16} /> Add testimonial
        </button>
      </div>
      {data.table_ready === false && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-sm" data-testid="testimonials-migration-banner">
          {data.hint || 'Run migration 0045_testimonials.sql in Supabase to enable this section.'}
        </div>
      )}
      {err && <p className="text-sm text-red-400 mb-3">{err}</p>}
      <div className="space-y-2">
        {(data.testimonials || []).map((t) => (
          <div key={t.id} className="flex items-start gap-4 p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]" data-testid={`testimonial-row-${t.id}`}>
            <div className="min-w-0 flex-1">
              <div className="text-[var(--color-text)] font-medium">{t.name} <span className="text-[var(--color-text-muted)] text-sm font-normal">· {t.role}</span> {!t.is_published && <span className="text-xs text-[var(--color-text-faint)]">(hidden)</span>}</div>
              <div className="text-[var(--color-text-muted)] text-sm mt-1 line-clamp-2">&ldquo;{t.quote}&rdquo;</div>
            </div>
            <button onClick={() => setEditing(t)} className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]" data-testid={`testimonial-edit-${t.id}`}><Pencil size={16} /></button>
            <button onClick={() => del(t.id)} className="p-2 text-[var(--color-text-muted)] hover:text-red-400" data-testid={`testimonial-delete-${t.id}`}><Trash2 size={16} /></button>
          </div>
        ))}
        {(data.testimonials || []).length === 0 && <p className="text-[var(--color-text-muted)] text-sm">No testimonials yet.</p>}
      </div>
      {editing !== undefined && <TestimonialModal item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />}
    </div>
  );
}

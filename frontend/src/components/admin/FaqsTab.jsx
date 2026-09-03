import { useState, useEffect } from 'react';
import { authFetch } from './adminUtils';
import { supabase } from '../../lib/supabase';
import { Search, Plus, Pencil, Trash2, Check, Loader2, X as XIcon } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

function FaqEditModal({ faq, onClose, onSaved }) {
  const isNew = !faq;
  const [category, setCategory] = useState(faq?.category || 'Course');
  const [question, setQuestion] = useState(faq?.question || '');
  const [answer, setAnswer] = useState(faq?.answer || '');
  const [tagsStr, setTagsStr] = useState((faq?.tags || []).join(', '));
  const [orderIndex, setOrderIndex] = useState(faq?.order_index ?? 100);
  const [isPublished, setIsPublished] = useState(faq?.is_published ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    if (!category.trim() || !question.trim() || !answer.trim()) { setErr('Category, question, and answer are all required.'); return; }
    setSaving(true); setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const body = JSON.stringify({ category: category.trim(), question: question.trim(), answer: answer.trim(), tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean), order_index: Number(orderIndex) || 100, is_published: isPublished });
      const url = isNew ? `${API}/api/admin/faqs` : `${API}/api/admin/faqs/${faq.id}`;
      const r = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 py-6" onClick={() => !saving && onClose()} data-testid="faq-edit-modal">
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">{isNew ? 'Add new FAQ' : 'Edit FAQ'}</h3>
          <button onClick={() => !saving && onClose()} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="faq-edit-close"><XIcon size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} list="faq-cat-suggest" className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" data-testid="faq-edit-category" />
              <datalist id="faq-cat-suggest">{['Course', 'Pricing', 'Certificate', 'Simulations', 'Support', 'Careers'].map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Order (lower = higher up)</label>
              <input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" data-testid="faq-edit-order" />
            </div>
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Question</label>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" data-testid="faq-edit-question" />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Answer</label>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={6} className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm font-bricolage" data-testid="faq-edit-answer" />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Tags (comma-separated)</label>
            <input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="e.g. refund, cancel, money back" className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm font-mono" data-testid="faq-edit-tags" />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text)]">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4" data-testid="faq-edit-published" />
            Published (visible on landing page + chatbot)
          </label>
          {err && <div className="text-sm text-red-500" data-testid="faq-edit-error">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={() => !saving && onClose()} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]" disabled={saving} data-testid="faq-edit-cancel">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:brightness-110 disabled:opacity-60" data-testid="faq-edit-save">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving…' : (isNew ? 'Create FAQ' : 'Save changes')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FaqsTab() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');

  const reload = () => authFetch('/api/admin/faqs').then(setData).catch((e) => setErr(e.message));
  useEffect(() => { reload(); }, []);

  const del = async (id) => {
    if (!window.confirm('Delete this FAQ permanently?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${API}/api/admin/faqs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      reload();
    } catch (e) { alert('Delete failed: ' + e.message); }
  };

  if (err) return <div className="text-red-500 p-4" data-testid="faqs-tab-error">{err}</div>;
  if (!data) return <div className="p-4 text-[var(--color-text-muted)]" data-testid="faqs-tab-loading">Loading…</div>;

  const filtered = data.faqs.filter((f) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (f.question || '').toLowerCase().includes(s) || (f.answer || '').toLowerCase().includes(s) || (f.category || '').toLowerCase().includes(s);
  });

  return (
    <div data-testid="faqs-tab">
      {data.table_ready === false && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-300" data-testid="faqs-migration-banner">
          <div className="font-semibold mb-0.5">FAQs database table not created yet</div>
          <div className="text-xs">Run <code className="px-1 py-0.5 rounded bg-black/20 font-mono">/app/scripts/migrations/0033_faqs.sql</code> in Supabase Studio → SQL Editor to enable saving.</div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium" data-testid="faqs-total">{data.total} FAQs</span>
          <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] hover:brightness-110 text-white text-sm font-medium transition-all" data-testid="faqs-add-btn"><Plus size={14} /> Add FAQ</button>
        </div>
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search question, answer, category…" data-testid="faqs-search" className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="faqs-table">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr><th className="p-3 w-24">Order</th><th className="p-3 w-32">Category</th><th className="p-3">Question</th><th className="p-3 w-24">Status</th><th className="p-3 w-32 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} className="border-t border-[var(--color-border)]" data-testid={`faqs-row-${f.id}`}>
                <td className="p-3 font-mono text-xs text-[var(--color-text-muted)]">{f.order_index}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-[var(--color-bg-card)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-primary)]">{f.category}</span></td>
                <td className="p-3 font-medium">{f.question}</td>
                <td className="p-3">{f.is_published ? <span className="text-emerald-500 text-xs font-medium" data-testid={`faqs-status-published-${f.id}`}>Published</span> : <span className="text-amber-500 text-xs font-medium" data-testid={`faqs-status-draft-${f.id}`}>Draft</span>}</td>
                <td className="p-3 text-right">
                  <button type="button" onClick={() => setEditing(f)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 text-xs mr-1" data-testid={`faqs-edit-${f.id}`}><Pencil size={11} /> Edit</button>
                  <button type="button" onClick={() => del(f.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-500 hover:bg-red-500/10 text-xs" data-testid={`faqs-delete-${f.id}`}><Trash2 size={11} /> Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-[var(--color-text-muted)]">No FAQs match.</div>}
      </div>
      {editing && (<FaqEditModal faq={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />)}
    </div>
  );
}

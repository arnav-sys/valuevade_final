import React, { useState, useEffect } from 'react';
import { authFetch, fmt } from './adminUtils';
import { supabase } from '../../lib/supabase';
import { Search, Check, Trash2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const CAT_LABELS = {
  content_issue: { label: 'Content', color: 'text-red-400 bg-red-500/10' },
  quality_issue: { label: 'Video/Audio', color: 'text-amber-400 bg-amber-500/10' },
  other:         { label: 'Other', color: 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' },
};

export default function SessionFeedbackTab() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const reload = () => {
    const params = [];
    if (filterStatus === 'open') params.push('resolved=false');
    if (filterStatus === 'resolved') params.push('resolved=true');
    if (filterCat !== 'all') params.push(`category=${encodeURIComponent(filterCat)}`);
    const qs = params.length ? '?' + params.join('&') : '';
    return authFetch('/api/admin/session-feedback' + qs).then(setData).catch((e) => setErr(e.message));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [filterCat, filterStatus]);

  const patchRow = async (id, patch) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/admin/session-feedback/${id}/resolve`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      reload();
    } catch (e) { alert('Update failed: ' + e.message); }
  };

  const delRow = async (id) => {
    if (!window.confirm('Delete this feedback entry permanently?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API}/api/admin/session-feedback/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      reload();
    } catch (e) { alert('Delete failed: ' + e.message); }
  };

  if (err) return <div className="text-red-500 p-4" data-testid="session-feedback-tab-error">{err}</div>;
  if (!data) return <div className="p-4 text-[var(--color-text-muted)]" data-testid="session-feedback-tab-loading">Loading…</div>;

  const filtered = data.feedback.filter((r) => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (r.message || '').toLowerCase().includes(s) || (r.user_email || '').toLowerCase().includes(s) || (r.session_title || '').toLowerCase().includes(s);
  });

  return (
    <div data-testid="session-feedback-tab">
      {data.table_ready === false && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-300" data-testid="session-feedback-migration-banner">
          <div className="font-semibold mb-0.5">Session feedback table not created yet</div>
          <div className="text-xs">Run <code className="px-1 py-0.5 rounded bg-black/20 font-mono">/app/scripts/migrations/0035_session_feedback.sql</code> in Supabase Studio → SQL Editor to enable this feature.</div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium" data-testid="session-feedback-total">{data.counts?.open || 0} open · {data.counts?.resolved || 0} resolved</span>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs" data-testid="session-feedback-filter-status">
            <option value="open">Open only</option><option value="resolved">Resolved only</option><option value="all">All</option>
          </select>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="px-2 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs" data-testid="session-feedback-filter-category">
            <option value="all">All categories</option><option value="content_issue">Content issue</option><option value="quality_issue">Video / audio</option><option value="other">Other</option>
          </select>
        </div>
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search message, user, session…" data-testid="session-feedback-search" className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="session-feedback-table">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr><th className="p-3 w-28">Category</th><th className="p-3">Session</th><th className="p-3 w-40">User</th><th className="p-3 w-32">Submitted</th><th className="p-3 w-32 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const cat = CAT_LABELS[r.category] || CAT_LABELS.other;
              const isExpanded = expandedId === r.id;
              return (
                <React.Fragment key={r.id}>
                  <tr className={`border-t border-[var(--color-border)] cursor-pointer ${r.resolved ? 'opacity-60' : ''}`} onClick={() => setExpandedId(isExpanded ? null : r.id)} data-testid={`session-feedback-row-${r.id}`}>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${cat.color}`}>{cat.label}</span></td>
                    <td className="p-3">
                      <div className="font-medium text-[var(--color-text)] text-xs">{r.session_title || <span className="text-[var(--color-text-muted)]">(session {r.session_id?.slice(0,8)}…)</span>}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate max-w-md" title={r.message}>{r.message}</div>
                    </td>
                    <td className="p-3 text-xs"><div className="text-[var(--color-text)]">{r.user_full_name || '—'}</div><div className="text-[10px] text-[var(--color-text-muted)]">{r.user_email || ''}</div></td>
                    <td className="p-3 text-xs text-[var(--color-text-muted)]">{fmt(r.created_at)}</td>
                    <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {r.resolved
                        ? <button type="button" onClick={() => patchRow(r.id, { resolved: false })} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card)] text-xs mr-1" data-testid={`session-feedback-reopen-${r.id}`}>Reopen</button>
                        : <button type="button" onClick={() => patchRow(r.id, { resolved: true })} className="inline-flex items-center gap-1 px-2 py-1 rounded text-emerald-500 hover:bg-emerald-500/10 text-xs mr-1" data-testid={`session-feedback-resolve-${r.id}`}><Check size={11} /> Resolve</button>
                      }
                      <button type="button" onClick={() => delRow(r.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-500 hover:bg-red-500/10 text-xs" data-testid={`session-feedback-delete-${r.id}`}><Trash2 size={11} /></button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-t border-[var(--color-border)] bg-[var(--color-bg-card)]/50" data-testid={`session-feedback-expanded-${r.id}`}>
                      <td className="p-4" colSpan={5}>
                        <div className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-1">Full message</div>
                        <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap font-bricolage">{r.message}</p>
                        {r.admin_notes && (<><div className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-wider mt-3 mb-1">Admin notes</div><p className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap font-bricolage">{r.admin_notes}</p></>)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-[var(--color-text-muted)]" data-testid="session-feedback-empty">
            {data.total === 0 ? 'No feedback yet — students will land here when they submit.' : 'No matches for your filters.'}
          </div>
        )}
      </div>
    </div>
  );
}

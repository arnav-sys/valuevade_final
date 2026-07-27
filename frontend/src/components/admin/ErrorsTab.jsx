/**
 * Admin > Errors tab.
 * Lists grouped errors from /api/admin/errors, filterable by status.
 * Row click opens a drawer with full stack + Resolve/Silence/Reopen actions.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { X as XIcon, RefreshCw } from 'lucide-react';

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

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function statusOf(row) {
  if (row.is_silenced) return 'silenced';
  if (row.regressed_at && !row.resolved_at) return 'regressed';
  if (row.resolved_at) return 'resolved';
  return 'new';
}

const BADGE = {
  new:       'bg-red-500/15 text-red-500',
  regressed: 'bg-orange-500/15 text-orange-500',
  resolved:  'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  silenced:  'bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)]',
};

const STATUSES = ['new', 'regressed', 'resolved', 'silenced', 'all'];

export default function ErrorsTab() {
  const [status, setStatus] = useState('new');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [sel, setSel] = useState(null);      // row currently opened in drawer
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const j = await req(`/api/admin/errors?status=${status}`);
      setRows(j.errors || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        (r.error_message || '').toLowerCase().includes(needle) ||
        (r.signature || '').toLowerCase().includes(needle) ||
        (r.url || '').toLowerCase().includes(needle) ||
        (r.user_description || '').toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const openDrawer = (r) => {
    setSel(r);
    setNotes(r.resolution_notes || '');
  };
  const closeDrawer = () => { setSel(null); setNotes(''); };

  const doAction = async (action) => {
    if (!sel) return;
    setBusy(true);
    try {
      await req(`/api/admin/errors/${sel.id}`, 'PATCH', { action, resolution_notes: notes || null });
      closeDrawer();
      await reload();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="errors-tab">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1 p-1 rounded-lg bg-[var(--color-surface)]" data-testid="errors-status-filter">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              data-testid={`errors-status-${s}`}
              className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                status === s ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search message / signature / url"
          data-testid="errors-search"
          className="flex-1 min-w-[200px] max-w-sm text-sm px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
        />
        <button onClick={reload} data-testid="errors-refresh" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs border border-[var(--color-border)] hover:bg-[var(--color-surface)]">
          <RefreshCw size={12} /> Refresh
        </button>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">{filtered.length} rows</span>
      </div>

      {err && <p className="text-sm text-red-500" data-testid="errors-tab-error">{err}</p>}

      {/* Table */}
      <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm" data-testid="errors-table">
          <thead className="bg-[var(--color-surface)]">
            <tr className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider">
              <th className="text-left px-3 py-2 w-24">Status</th>
              <th className="text-left px-3 py-2">Message</th>
              <th className="text-left px-3 py-2 w-16">Type</th>
              <th className="text-right px-3 py-2 w-20">Count</th>
              <th className="text-right px-3 py-2 w-28">First seen</th>
              <th className="text-right px-3 py-2 w-28">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-[var(--color-text-muted)]">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-[var(--color-text-muted)]">No errors in this bucket.</td></tr>
            ) : (
              filtered.map((r) => {
                const s = statusOf(r);
                return (
                  <tr
                    key={r.id}
                    onClick={() => openDrawer(r)}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface)]/60 cursor-pointer"
                    data-testid={`error-row-${r.id}`}
                  >
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase ${BADGE[s]}`}>{s}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-[var(--color-text)] truncate max-w-lg flex items-center gap-1.5" title={r.error_message}>
                        {r.error_type === 'user_report' && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-[#a78bfa]/20 text-[9px] font-mono uppercase text-[#a78bfa] shrink-0">user</span>
                        )}
                        <span className="truncate">{r.error_message || '(no message)'}</span>
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)] font-mono truncate max-w-lg">{r.signature}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{r.error_type}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold">{r.occurrence_count}</td>
                    <td className="px-3 py-2 text-right text-[10px] text-[var(--color-text-muted)]">{fmtDate(r.first_seen_at)}</td>
                    <td className="px-3 py-2 text-right text-[10px] text-[var(--color-text-muted)]">{fmtDate(r.last_seen_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {sel && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeDrawer()}
          data-testid="error-drawer"
        >
          <div className="w-full max-w-xl h-full bg-[var(--color-bg-card)] border-l border-[var(--color-border)] flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="min-w-0">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase mr-2 ${BADGE[statusOf(sel)]}`}>{statusOf(sel)}</span>
                <span className="text-xs font-mono text-[var(--color-text-muted)]">{sel.error_type}</span>
                <div className="text-sm font-semibold text-[var(--color-text)] mt-1 truncate" data-testid="error-drawer-message" title={sel.error_message}>{sel.error_message}</div>
              </div>
              <button onClick={closeDrawer} data-testid="error-drawer-close" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <XIcon size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">Signature</p>
                <p className="text-xs font-mono break-all">{sel.signature}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">Occurrences</p>
                  <p className="text-sm font-semibold">{sel.occurrence_count}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">Unique users</p>
                  <p className="text-sm font-semibold">{sel.unique_users || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">First seen</p>
                  <p className="text-xs">{fmtDate(sel.first_seen_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">Last seen</p>
                  <p className="text-xs">{fmtDate(sel.last_seen_at)}</p>
                </div>
              </div>
              {sel.regressed_at && (
                <div>
                  <p className="text-[10px] uppercase font-mono text-orange-500">Regressed at</p>
                  <p className="text-xs">{fmtDate(sel.regressed_at)}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">Sample URL</p>
                <p className="text-xs font-mono break-all">{sel.url || '—'}</p>
              </div>
              {sel.user_description && (
                <div data-testid="error-drawer-user-description">
                  <p className="text-[10px] uppercase font-mono" style={{ color: '#a78bfa' }}>
                    User description
                    {sel.error_type === 'user_report' && <span className="ml-2 px-1.5 py-0.5 rounded bg-[#a78bfa]/15 text-[10px]">user report</span>}
                  </p>
                  <pre className="text-xs font-bricolage bg-[#a78bfa]/8 rounded p-2 mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words" style={{ border: '1px solid rgba(167,139,250,0.20)' }}>
                    {sel.user_description}
                  </pre>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">User agent</p>
                <p className="text-xs text-[var(--color-text-muted)] break-all">{sel.user_agent || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">Stack (from first occurrence)</p>
                <pre
                  data-testid="error-drawer-stack"
                  className="text-[10px] font-mono bg-[var(--color-surface)] rounded p-2 max-h-64 overflow-auto whitespace-pre-wrap break-all"
                >{sel.error_stack || '(no stack captured)'}</pre>
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">Resolution notes</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional — describe the fix or why it's silenced"
                  data-testid="error-drawer-notes"
                  className="w-full mt-1 text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-y"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-[var(--color-border)] flex items-center gap-2 flex-wrap">
              {statusOf(sel) !== 'resolved' && (
                <button
                  onClick={() => doAction('resolve')}
                  disabled={busy}
                  data-testid="error-action-resolve"
                  className="px-3 py-1.5 rounded-md bg-[var(--color-success)] text-white text-xs font-semibold hover:brightness-110 disabled:opacity-50"
                >
                  Mark Resolved
                </button>
              )}
              {!sel.is_silenced && (
                <button
                  onClick={() => doAction('silence')}
                  disabled={busy}
                  data-testid="error-action-silence"
                  className="px-3 py-1.5 rounded-md border border-[var(--color-border)] text-xs font-semibold hover:bg-[var(--color-surface)] disabled:opacity-50"
                >
                  Silence
                </button>
              )}
              {(sel.is_silenced || sel.resolved_at) && (
                <button
                  onClick={() => doAction('reopen')}
                  disabled={busy}
                  data-testid="error-action-reopen"
                  className="px-3 py-1.5 rounded-md border border-orange-500/40 text-orange-500 text-xs font-semibold hover:bg-orange-500/10 disabled:opacity-50"
                >
                  Reopen
                </button>
              )}
              <button
                onClick={closeDrawer}
                className="ml-auto px-3 py-1.5 rounded-md text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

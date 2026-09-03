import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle2, XCircle, ExternalLink, RefreshCw, Filter, Loader2, Link2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

async function authFetch(path) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${session?.access_token || ''}` },
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

async function authPatch(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) {
    const msg = (json && (json.detail || json.message)) || text || `${r.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return json;
}

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

export default function LinkedInClaimsTab() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableReady, setTableReady] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [processing, setProcessing] = useState({});
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = showAll ? '' : '?verified=false';
      const res = await authFetch(`/api/admin/linkedin-claims${qs}`);
      setTableReady(res.table_ready !== false);
      setClaims(res.claims || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (claimId, action) => {
    setProcessing(p => ({ ...p, [claimId]: true }));
    try {
      await authPatch(`/api/admin/linkedin-claims/${claimId}`, { action });
      showToast(action === 'verify' ? 'Claim verified.' : 'Claim rejected and removed.');
      setClaims(prev => action === 'reject'
        ? prev.filter(c => c.id !== claimId)
        : prev.map(c => c.id === claimId ? { ...c, linkedin_post_verified: true } : c)
      );
    } catch (e) {
      showToast(`Error: ${e.message}`);
    } finally {
      setProcessing(p => ({ ...p, [claimId]: false }));
    }
  };

  const unverifiedCount = claims.filter(c => !c.linkedin_post_verified).length;

  return (
    <div className="space-y-4" data-testid="linkedin-claims-tab">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm px-4 py-2.5 rounded-lg shadow-lg" data-testid="claims-toast">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] flex items-center gap-2">
            <Link2 size={18} className="text-[var(--color-primary)]" />
            LinkedIn Claims
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Spot-check reward claims where the LinkedIn post couldn't be auto-verified.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="claims-filter-toggle"
            onClick={() => setShowAll(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
              showAll
                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <Filter size={14} /> {showAll ? 'All claims' : 'Unverified only'}
          </button>
          <button
            data-testid="claims-refresh-btn"
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      {!loading && tableReady && (
        <div className="flex gap-4 text-sm">
          <span className="text-[var(--color-text-muted)]">
            Total: <strong className="text-[var(--color-text)]">{claims.length}</strong>
          </span>
          {!showAll && (
            <span className="text-[var(--color-text-muted)]">
              Pending review: <strong className="text-amber-500">{unverifiedCount}</strong>
            </span>
          )}
        </div>
      )}

      {/* Not ready */}
      {!tableReady && (
        <div className="px-4 py-6 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm" data-testid="claims-table-not-ready">
          Rewards migration not applied yet. Run <code>0037_rewards.sql</code> in Supabase Studio to enable this tab.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm" data-testid="claims-error">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] py-8" data-testid="claims-loading">
          <Loader2 size={16} className="animate-spin" /> Loading claims…
        </div>
      )}

      {/* Empty */}
      {!loading && tableReady && claims.length === 0 && (
        <div className="py-12 text-center text-[var(--color-text-muted)] text-sm" data-testid="claims-empty">
          {showAll ? 'No claims found.' : 'No unverified claims — all clear.'}
        </div>
      )}

      {/* Table */}
      {!loading && tableReady && claims.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="claims-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">User</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Reward</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">LinkedIn URL</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Shared</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Status</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c, idx) => (
                <tr
                  key={c.id}
                  data-testid={`claim-row-${idx}`}
                  className={`border-b border-[var(--color-border)] last:border-0 transition-colors ${
                    c.linkedin_post_verified ? 'opacity-60' : 'hover:bg-[var(--color-surface)]/50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-text)]">{c.user_name || '—'}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{c.user_email || c.user_id?.slice(0, 8) + '...'}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{c.reward_title || '—'}</td>
                  <td className="px-4 py-3 max-w-[200px]">
                    {c.linkedin_post_url ? (
                      <a
                        href={c.linkedin_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`claim-url-${idx}`}
                        className="flex items-center gap-1 text-[var(--color-primary)] hover:underline truncate"
                        title={c.linkedin_post_url}
                      >
                        <ExternalLink size={12} className="shrink-0" />
                        <span className="truncate">{c.linkedin_post_url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{fmt(c.shared_at || c.claimed_at)}</td>
                  <td className="px-4 py-3">
                    {c.linkedin_post_verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-xs font-medium">
                        <CheckCircle2 size={11} /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-medium">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!c.linkedin_post_verified ? (
                      <div className="flex items-center gap-2">
                        <button
                          data-testid={`claim-verify-${idx}`}
                          onClick={() => handleAction(c.id, 'verify')}
                          disabled={!!processing[c.id]}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/15 hover:bg-green-500/25 text-green-400 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {processing[c.id] ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                          Verify
                        </button>
                        <button
                          data-testid={`claim-reject-${idx}`}
                          onClick={() => handleAction(c.id, 'reject')}
                          disabled={!!processing[c.id]}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {processing[c.id] ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">No action needed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Upload, Search, Loader2, X as XIcon } from 'lucide-react';
import { authFetch, authPost, fmt } from './adminUtils';

export default function WaitlistTab() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [err, setErr] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const reload = () => authFetch('/api/admin/waitlist').then(setData).catch(e => setErr(e.message));
  useEffect(() => { reload(); }, []);

  const handleImport = async () => {
    if (!csvText.trim()) { setImportResult({ error: 'Paste CSV content first.' }); return; }
    setImporting(true); setImportResult(null);
    try {
      const res = await authPost('/api/admin/waitlist/import', { csv: csvText });
      setImportResult(res);
      await reload();
    } catch (e) {
      setImportResult({ error: e.message });
    } finally {
      setImporting(false);
    }
  };

  if (err) return <div className="text-red-500 p-4">{err}</div>;
  if (!data) return <div className="p-4 text-[var(--color-text-muted)]">Loading…</div>;
  const filtered = data.entries.filter(e => !search || (e.email || '').toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium" data-testid="waitlist-total">
            {data.total} signups
          </span>
          <button
            type="button"
            onClick={() => { setShowImport(true); setImportResult(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent-purple)] hover:brightness-110 text-white text-sm font-medium transition-all"
            data-testid="waitlist-import-btn"
          >
            <Upload size={14} /> Import CSV
          </button>
        </div>
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email"
            data-testid="waitlist-search"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="waitlist-table">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Source</th><th className="p-3">Signup Date</th></tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="p-3 font-medium">{e.email || '—'}</td>
                <td className="p-3">{e.phone || '—'}</td>
                <td className="p-3">{e.source || e.referral_code || '—'}</td>
                <td className="p-3">{fmt(e.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-[var(--color-text-muted)]">No matches.</div>}
      </div>

      {showImport && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 py-6"
          data-testid="waitlist-import-modal"
          onClick={() => !importing && setShowImport(false)}
        >
          <div
            className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text)]">Import waitlist CSV</h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  Paste rows exported from Mongo. Headers required: <code className="text-xs bg-[var(--color-bg-card)] px-1 py-0.5 rounded">email</code>.
                  Optional: <code className="text-xs bg-[var(--color-bg-card)] px-1 py-0.5 rounded">first_name, timestamp, referral_code, position, referral_count, referred_by</code>. Existing emails are skipped.
                </p>
              </div>
              <button onClick={() => !importing && setShowImport(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="waitlist-import-close">
                <XIcon size={18} />
              </button>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"first_name,email,timestamp,referral_code\nAlex,alex@example.com,2026-06-11T10:00:00Z,ABC123\n..."}
              className="w-full h-56 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] font-mono text-xs resize-y"
              data-testid="waitlist-import-textarea"
              disabled={importing}
            />
            {importResult && (
              <div className="mt-3 text-sm">
                {importResult.error ? (
                  <div className="text-red-500" data-testid="waitlist-import-error">{importResult.error}</div>
                ) : (
                  <div className="text-[var(--color-text)]" data-testid="waitlist-import-result">
                    <div><span className="font-semibold text-emerald-500">{importResult.inserted}</span> inserted · <span className="text-[var(--color-text-muted)]">{importResult.skipped_existing}</span> skipped{importResult.errors?.length ? <> · <span className="text-amber-500">{importResult.errors.length}</span> errors</> : null}</div>
                    {importResult.errors?.length ? (
                      <details className="mt-2 text-xs text-[var(--color-text-muted)]">
                        <summary className="cursor-pointer">Show error details</summary>
                        <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(importResult.errors, null, 2)}</pre>
                      </details>
                    ) : null}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => !importing && setShowImport(false)} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]" disabled={importing} data-testid="waitlist-import-cancel">Close</button>
              <button type="button" onClick={handleImport} disabled={importing || !csvText.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:brightness-110 disabled:opacity-60" data-testid="waitlist-import-submit">
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Navigate, useSearchParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import CurriculumTab from './admin/CurriculumTab';
import ErrorsTab from './admin/ErrorsTab';
import { Search, Users, ListChecks, BookOpen, RefreshCw, Lock, CreditCard, Check, X as XIcon, Video, Upload, Trash2, Play, Loader2, GraduationCap, AlertTriangle, Link2 } from 'lucide-react';

const ADMIN_EMAIL = 'info@valuevade.com';
const API = process.env.REACT_APP_BACKEND_URL;

async function authFetch(path) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${session?.access_token || ''}` },
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

async function authPost(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!r.ok) {
    const msg = (json && (json.detail || json.message)) || text || `${r.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return json;
}

// Random 12-char password: letters (mixed case) + digits + a couple of symbols.
function generatePassword() {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const symbols = '@#$%&*';
  let out = '';
  for (let i = 0; i < 10; i++) out += alpha[Math.floor(Math.random() * alpha.length)];
  out += symbols[Math.floor(Math.random() * symbols.length)];
  out += Math.floor(Math.random() * 10);
  return out;
}

function AdminTabs({ tab, setTab }) {
  const tabs = [
    { k: 'waitlist',  label: 'Waitlist Signups',   icon: ListChecks },
    { k: 'users',     label: 'Enrolled Users',     icon: Users },
    { k: 'progress',  label: 'Per-User Progress',  icon: BookOpen },
    { k: 'payments',  label: 'Payments',           icon: CreditCard },
    { k: 'videos',    label: 'Session Videos',     icon: Video },
    { k: 'curriculum', label: 'View Course',       icon: GraduationCap },
    { k: 'errors',    label: 'Errors',             icon: AlertTriangle },
  ];
  return (
    <div className="flex gap-2 mb-6 border-b border-[var(--color-border)] flex-wrap" data-testid="admin-tabs">
      {tabs.map(({k, label, icon: Icon}) => (
        <button key={k}
          data-testid={`admin-tab-${k}`}
          onClick={() => setTab(k)}
          className={`px-4 py-3 flex items-center gap-2 font-medium border-b-2 transition-colors ${tab === k
            ? 'border-[var(--color-primary)] text-[var(--color-text)]'
            : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
          <Icon className="w-4 h-4" /> {label}
        </button>
      ))}
    </div>
  );
}

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function WaitlistTab() {
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
                    <div><span className="font-semibold text-emerald-500">{importResult.inserted}</span> inserted · <span className="text-[var(--color-text-muted)]">{importResult.skipped_existing}</span> skipped (already existed){importResult.errors?.length ? <> · <span className="text-amber-500">{importResult.errors.length}</span> errors</> : null}</div>
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
              <button
                type="button"
                onClick={() => !importing && setShowImport(false)}
                className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                disabled={importing}
                data-testid="waitlist-import-cancel"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || !csvText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:brightness-110 disabled:opacity-60"
                data-testid="waitlist-import-submit"
              >
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

function UsersTab({ onSelect }) {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [err, setErr] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const reload = () => authFetch('/api/admin/users').then(setData).catch(e => setErr(e.message));
  useEffect(() => { reload(); }, []);
  if (err) return <div className="text-red-500 p-4">{err}</div>;
  if (!data) return <div className="p-4 text-[var(--color-text-muted)]">Loading…</div>;
  const filtered = data.users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });
  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium" data-testid="users-total">
            {data.total} users
          </span>
          <button
            onClick={() => setShowCreate(true)}
            data-testid="create-user-button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent-purple)] hover:brightness-110 text-white text-sm font-medium transition-all"
          >
            <Users size={14} /> Create User
          </button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email"
          data-testid="users-search"
          className="w-72 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="users-table">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr>
              <th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Country</th>
              <th className="p-3">Enrolled</th><th className="p-3">Last Active</th><th className="p-3">Active Plan</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.user_id} className="border-t border-[var(--color-border)]">
                <td className="p-3 font-medium">{u.full_name || '—'}</td>
                <td className="p-3">{u.email || '—'}</td>
                <td className="p-3">{u.country_code || '—'}</td>
                <td className="p-3">{u.enrolled ? fmt(u.enrollment_at) : '—'}</td>
                <td className="p-3">{fmt(u.last_active)}</td>
                <td className="p-3">{u.active_plan ? <span className="text-green-500">●</span> : <span className="text-[var(--color-text-muted)]">○</span>}</td>
                <td className="p-3"><button data-testid={`view-progress-${u.user_id}`} onClick={() => onSelect(u)} className="text-[var(--color-primary)] hover:underline">View →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); reload(); }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('user');
  const [autoEnroll, setAutoEnroll] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const [success, setSuccess] = useState(null);   // { email, password, ... }
  const [copied, setCopied] = useState(false);

  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 8;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await authPost('/api/admin/users/create', {
        email: email.trim(),
        password,
        display_name: displayName.trim() || null,
        role,
        auto_enroll: autoEnroll,
      });
      setSuccess(res);
    } catch (e) {
      setErr(e.message || 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCreds = async () => {
    const text =
      `Valuevade credentials\n──────────────────────\nEmail:    ${success.email}\nPassword: ${success.password}\nLogin at: https://valuevade.com/login`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      data-testid="create-user-modal"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {success ? 'User created' : 'Create user'}
          </h2>
          <button
            onClick={() => !submitting && (success ? onCreated() : onClose())}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            data-testid="create-user-close"
          >
            <XIcon size={18} />
          </button>
        </div>

        {success ? (
          <div className="space-y-4" data-testid="create-user-success">
            <p className="text-sm text-[var(--color-text-muted)]">
              Share these credentials with the user. Password won't be shown again.
            </p>
            <div className="rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] p-4 font-mono text-sm space-y-1">
              <div><span className="text-[var(--color-text-muted)]">Email:</span> <span data-testid="new-user-email">{success.email}</span></div>
              <div><span className="text-[var(--color-text-muted)]">Password:</span> <span data-testid="new-user-password">{success.password}</span></div>
              {success.role && success.role !== 'user' && (
                <div><span className="text-[var(--color-text-muted)]">Role:</span> {success.role}</div>
              )}
              <div><span className="text-[var(--color-text-muted)]">Enrolled:</span> {success.enrolled ? 'Yes (Equity Research)' : 'No'}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyCreds}
                data-testid="copy-credentials-button"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:brightness-110 transition-all"
              >
                {copied ? <><Check size={16} /> Copied</> : <>Copy credentials</>}
              </button>
              <button
                onClick={onCreated}
                data-testid="create-user-done"
                className="px-4 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="create-user-form">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Email *</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                data-testid="cu-email"
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Password * <span className="text-[var(--color-text-muted)] normal-case">(min 8)</span></label>
              <div className="flex gap-2">
                <input
                  type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required
                  data-testid="cu-password"
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] font-mono"
                />
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  data-testid="cu-gen-password"
                  className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all whitespace-nowrap"
                >
                  Generate
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Display name <span className="normal-case">(optional)</span></label>
              <input
                type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                data-testid="cu-name"
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                placeholder="Priya Menon"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Role</label>
              <select
                value={role} onChange={(e) => setRole(e.target.value)}
                data-testid="cu-role"
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <label className="flex items-start gap-2 text-sm text-[var(--color-text)] cursor-pointer" data-testid="cu-autoenroll-label">
              <input
                type="checkbox" checked={autoEnroll} onChange={(e) => setAutoEnroll(e.target.checked)}
                data-testid="cu-autoenroll"
                className="mt-0.5 accent-[var(--color-primary)]"
              />
              <span>Auto-enroll in <b>Equity Research Analyst</b> (all 22 modules)</span>
            </label>
            {err && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-500" data-testid="cu-error">
                {err}
              </div>
            )}
            <button
              type="submit" disabled={!valid || submitting}
              data-testid="cu-submit"
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-accent-purple)] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? 'Creating…' : 'Create user'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ProgressModal({ user, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!user) return;
    authFetch(`/api/admin/users/${user.user_id}/progress`).then(setData).catch(() => setData({ error: 'failed' }));
  }, [user]);
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose} data-testid="progress-modal">
      <div className="bg-[var(--color-bg-card)] rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">{user.full_name || user.email}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="close-progress">✕</button>
        </div>
        {!data && <p className="text-[var(--color-text-muted)]">Loading…</p>}
        {data && !data.error && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Stat label="Total XP" value={data.stats.total_xp} />
              <Stat label="Level" value={data.stats.current_level} />
              <Stat label="Streak (days)" value={data.stats.current_streak_days} />
              <Stat label="Modules" value={`${data.modules_done} / ${data.modules_total}`} />
              <Stat label="Sessions" value={`${data.sessions_done} / ${data.sessions_total}`} />
              <Stat label="On-schedule streak" value={data.stats.on_schedule_streak} />
            </div>
            <div className="space-y-2">
              {data.modules.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)]">
                  <div>
                    <div className="font-medium text-[var(--color-text)]">M{m.order_index}: {m.title}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{m.sessions_done}/{m.sessions_total} sessions</div>
                  </div>
                  {m.is_completed ? <span className="text-green-500 text-sm font-medium">Completed</span> : <span className="text-[var(--color-text-muted)] text-sm">In progress</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-bg-card-hover)] border border-[var(--color-border)]">
      <div className="text-xs text-[var(--color-text-muted)] uppercase">{label}</div>
      <div className="text-lg font-semibold text-[var(--color-text)]">{value}</div>
    </div>
  );
}

const fmtINR = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n || 0));


export default function AdminPanel() {
  const { user, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'waitlist');
  const [selected, setSelected] = useState(null);

  useEffect(() => { setParams({ tab }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!user) return <Navigate to="/login" replace />;
  const email = (user?.email || profile?.email || '').toLowerCase();
  if (email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" data-testid="admin-denied">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">Admin access required.</h1>
          <p className="text-[var(--color-text-muted)] mb-4">Your account ({email || 'unknown'}) is not authorized for the admin panel.</p>
          <a href="/dashboard" className="text-[var(--color-primary)] hover:underline">← Back to dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-[var(--color-text)] font-bricolage">Admin Panel</h1>
            <button onClick={() => window.location.reload()} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1" data-testid="admin-refresh">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">Logged in as <strong>{email}</strong>.</p>
          <AdminTabs tab={tab} setTab={setTab} />
          {tab === 'waitlist'  && <WaitlistTab />}
          {tab === 'users'     && <UsersTab onSelect={(u) => { setSelected(u); setTab('users'); }} />}
          {tab === 'progress'  && <UsersTab onSelect={setSelected} />}
          {tab === 'payments'  && <PaymentsTab />}
          {tab === 'videos'    && <SessionVideosTab />}
          {tab === 'curriculum' && <CurriculumTab />}
          {tab === 'errors' && <ErrorsTab />}
        </div>
        <ProgressModal user={selected} onClose={() => setSelected(null)} />
      </main>
    </div>
  );
}

function PaymentsTab() {
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    Promise.all([
      authFetch('/api/admin/payments/overview'),
      authFetch('/api/admin/payments/recent?limit=20'),
    ]).then(([o, r]) => { setData(o); setRecent(r); })
      .catch(e => setErr(e.message));
  }, []);
  if (err) return <div className="text-red-500 p-4">{err}</div>;
  if (!data || !recent) return <div className="p-4 text-[var(--color-text-muted)]">Loading…</div>;
  const s = data.stats;
  return (
    <div data-testid="admin-payments-tab">
      {data.mock_mode && (
        <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
          <Lock className="w-3.5 h-3.5" /> Razorpay running in mock mode — transactions are simulated until live keys are configured.
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6" data-testid="payments-stats">
        <Stat label="Total Revenue" value={fmtINR(s.total_revenue_inr)} />
        <Stat label="Paid Users" value={s.paid_users} />
        <Stat label="Free Users" value={s.free_users} />
        <Stat label="Avg Transaction" value={fmtINR(s.avg_txn_inr)} />
      </div>

      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2 uppercase tracking-wider">Paid Users</h3>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] mb-6" data-testid="payments-users-table">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Tier</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Method</th>
              <th className="p-3">Paid at</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map(u => (
              <tr key={u.user_id} className="border-t border-[var(--color-border)]">
                <td className="p-3">
                  <div className="font-medium">{u.full_name || '—'}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{u.email}</div>
                </td>
                <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-card-hover)] border border-[var(--color-border)]">{u.pricing_tier || '—'}</span></td>
                <td className="p-3 text-right font-semibold">{fmtINR(u.amount_inr)}</td>
                <td className="p-3 capitalize">{u.method || '—'}</td>
                <td className="p-3">{fmt(u.paid_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.users.length === 0 && <div className="p-8 text-center text-[var(--color-text-muted)]">No paid users yet.</div>}
      </div>

      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2 uppercase tracking-wider">Recent Transactions</h3>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="payments-recent">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">User</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Method</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.payments.map((p, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="p-3">{fmt(p.created_at)}</td>
                <td className="p-3">
                  <div className="font-medium">{p.full_name || '—'}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{p.email}</div>
                </td>
                <td className="p-3 text-right font-semibold">{fmtINR(p.amount_inr)}</td>
                <td className="p-3 capitalize">{p.method || '—'}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    p.status === 'captured' ? 'bg-green-500/10 text-green-500 border-green-500/30' :
                    p.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                    'bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                  }`}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recent.payments.length === 0 && <div className="p-8 text-center text-[var(--color-text-muted)]">No transactions yet.</div>}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Session Videos tab — admin uploads / replaces / deletes lecture
// videos for any session across any module. Uses the same
// `session-videos` Supabase Storage bucket + `master_sessions.lecture_url`
// column that NotesPage reads.
// ─────────────────────────────────────────────────────────────
async function authFetchJson(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${session?.access_token || ''}`, ...(options.headers || {}) },
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

function VideoPreviewModal({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
         onClick={onClose} data-testid="admin-video-preview">
      <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
        <video src={src} controls autoPlay className="w-full rounded-lg border border-[var(--color-primary)]/40" />
        <div className="text-right mt-2">
          <button onClick={onClose} className="px-3 py-1 rounded text-sm border border-[var(--color-border)] text-[var(--color-text)]">Close</button>
        </div>
      </div>
    </div>
  );
}

function SessionVideosTab() {
  const [data, setData]         = useState(null);
  const [err, setErr]           = useState(null);
  const [selectedModule, setSelectedModule] = useState('');
  const [search, setSearch]     = useState('');
  const [busy, setBusy]         = useState({});
  const [progress, setProgress] = useState({});
  const [preview, setPreview]   = useState(null);

  const reload = () =>
    authFetchJson('/api/admin/sessions/videos').then(setData).catch((e) => setErr(e.message));
  useEffect(() => { reload(); }, []);
  useEffect(() => {
    if (data?.modules?.length && !selectedModule) {
      setSelectedModule(String(data.modules[0].module_number || ''));
    }
  }, [data, selectedModule]);

  const uploadFor = async (session_id, file) => {
    setBusy((b) => ({ ...b, [session_id]: 'upload' }));
    setProgress((p) => ({ ...p, [session_id]: 0 }));
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) throw new Error('You must be signed in as admin.');

      // Backend pre-creates the TUS session with service_role (bypasses RLS).
      const created = await authPost(`/api/admin/sessions/${session_id}/tus-create-upload`, {
        upload_length: file.size,
        content_type: file.type || 'video/mp4',
      });
      if (!created?.location) throw new Error('Backend did not return a TUS upload location.');

      // Chunk the file through the backend proxy — each chunk is patched to
      // the Supabase TUS location using service_role auth.
      const CHUNK = 8 * 1024 * 1024;
      let offset = 0;
      while (offset < file.size) {
        const end = Math.min(offset + CHUNK, file.size);
        const blob = file.slice(offset, end);
        const fd = new FormData();
        fd.append('location', created.location);
        fd.append('offset', String(offset));
        fd.append('chunk', blob, 'chunk.bin');
        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/tus-patch-chunk`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${authSession.access_token}` },
              body: fd,
            });
            if (!r.ok) {
              // eslint-disable-next-line no-await-in-loop
              const txt = await r.text();
              throw new Error(`chunk ${offset}-${end} failed [${r.status}]: ${txt.slice(0, 200)}`);
            }
            // eslint-disable-next-line no-await-in-loop
            const j = await r.json();
            offset = typeof j.upload_offset === 'number' && j.upload_offset > offset ? j.upload_offset : end;
            setProgress((p) => ({ ...p, [session_id]: Math.round((offset / file.size) * 100) }));
            break;
          } catch (e) {
            attempt += 1;
            if (attempt > 3) throw e;
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 800 * attempt));
          }
        }
      }

      await authPost(`/api/admin/sessions/${session_id}/video-url`, {
        public_url: created.public_url,
      });
      await reload();
    } catch (e) {
      alert(`Upload failed: ${e.message}`);
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[session_id]; return n; });
      setProgress((p) => { const n = { ...p }; delete n[session_id]; return n; });
    }
  };

  const pickAndUpload = (session_id) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'video/mp4,video/webm,video/quicktime';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      // 50 GB frontend guardrail (matches Pro-tier TUS ceiling).
      if (f.size > 50 * 1024 * 1024 * 1024) { alert(`File too large (${(f.size/1073741824).toFixed(2)} GB). Max 50 GB.`); return; }
      uploadFor(session_id, f);
    };
    input.click();
  };

  const pasteUrlFor = async (session_id, title) => {
    // Prompt for an external video URL — used when the file is larger than the
    // Supabase Storage cap (50 MB on Free tier). Host on YouTube / Vimeo /
    // Cloudflare Stream / Mux / BunnyCDN and paste the direct/embed URL.
    const u = window.prompt(
      `Paste an external video URL for "${title}":\n\n`
      + 'Use this for 30-min+ videos that exceed the Supabase Storage cap.\n'
      + 'Supported: YouTube, Vimeo, Cloudflare Stream, Mux, BunnyCDN, any direct .mp4 link.',
      '',
    );
    if (!u || !u.trim()) return;
    const url = u.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      alert('URL must start with http:// or https://');
      return;
    }
    setBusy((b) => ({ ...b, [session_id]: 'url' }));
    try {
      await authPost(`/api/admin/sessions/${session_id}/video-url`, { public_url: url });
      await reload();
    } catch (e) { alert(`Save URL failed: ${e.message}`); }
    finally { setBusy((b) => { const n = { ...b }; delete n[session_id]; return n; }); }
  };

  const deleteVideo = async (session_id, title) => {
    if (!window.confirm(`Remove the video for "${title}"?`)) return;
    setBusy((b) => ({ ...b, [session_id]: 'delete' }));
    try {
      await authFetchJson(`/api/admin/sessions/${session_id}/video`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[session_id]; return n; });
    }
  };

  if (err) return <div className="text-red-500 p-4" data-testid="admin-videos-error">{err}</div>;
  if (!data) return <div className="p-4 text-[var(--color-text-muted)]">Loading…</div>;

  const mod = data.modules.find((m) => String(m.module_number) === selectedModule) || data.modules[0];
  const sessions = mod ? mod.sessions.filter((s) =>
    !search || (s.title || '').toLowerCase().includes(search.toLowerCase())) : [];

  return (
    <div data-testid="admin-videos-tab">
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] font-mono"
          data-testid="admin-videos-module-select"
        >
          {data.modules.map((m) => (
            <option key={m.module_id} value={m.module_number || ''}>
              M{m.module_number} · {m.module_title.slice(0, 46)}
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search session titles…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            data-testid="admin-videos-search"
          />
        </div>
        <div className="ml-auto text-xs font-mono text-[var(--color-text-muted)]">
          {sessions.filter((s) => s.has_video).length} / {sessions.length} uploaded
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-[11px] font-mono uppercase tracking-wider">
            <tr>
              <th className="p-3 text-left w-20">Module.Session</th>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-left w-40">Status</th>
              <th className="p-3 text-right w-56">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const rowBusy = busy[s.id];
              const pct = progress[s.id];
              return (
                <tr key={s.id} className="border-t border-[var(--color-border)]" data-testid={`admin-video-row-${s.id}`}>
                  <td className="p-3 font-mono text-xs text-[var(--color-text-muted)]">M{mod.module_number}.{s.order_index}</td>
                  <td className="p-3 text-[var(--color-text)]">{s.title}</td>
                  <td className="p-3">
                    {s.has_video ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/40 text-green-400 text-[11px] font-mono">
                        <Check size={11} /> Uploaded
                        <button
                          onClick={() => setPreview(s.lecture_url)}
                          className="ml-1 text-green-300 hover:text-green-100 flex items-center gap-1"
                          data-testid={`admin-video-preview-${s.id}`}
                        >
                          <Play size={10} /> Preview
                        </button>
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-[var(--color-text-faint)]">No video</span>
                    )}
                    {rowBusy === 'upload' && pct != null && (
                      <div className="mt-1 h-1 w-32 bg-[var(--color-surface)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {rowBusy ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-text-muted)]">
                          <Loader2 size={12} className="animate-spin" />
                          {rowBusy === 'upload' ? `${pct ?? 0}%` : 'deleting…'}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => pickAndUpload(s.id)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 flex items-center gap-1"
                            data-testid={`admin-video-upload-${s.id}`}
                          >
                            <Upload size={11} /> {s.has_video ? 'Replace' : 'Upload'}
                          </button>
                          <button
                            onClick={() => pasteUrlFor(s.id, s.title)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-[var(--color-accent-purple)]/40 bg-[var(--color-accent-purple)]/10 text-[var(--color-accent-purple)] hover:bg-[var(--color-accent-purple)]/20 flex items-center gap-1"
                            data-testid={`admin-video-url-${s.id}`}
                            title="Paste a YouTube/Vimeo/Cloudflare Stream/Mux/BunnyCDN URL — use for 30-min+ videos that exceed the Supabase Storage cap."
                          >
                            <Link2 size={11} /> URL
                          </button>
                          {s.has_video && (
                            <button
                              onClick={() => deleteVideo(s.id, s.title)}
                              className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-1"
                              data-testid={`admin-video-delete-${s.id}`}
                            >
                              <Trash2 size={11} /> Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-[var(--color-text-muted)] text-sm">
                  No sessions match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <VideoPreviewModal src={preview} onClose={() => setPreview(null)} />
    </div>
  );
}


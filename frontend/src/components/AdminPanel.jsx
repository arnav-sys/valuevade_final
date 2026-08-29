import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import { Navigate, useSearchParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import CurriculumTab from './admin/CurriculumTab';
import ErrorsTab from './admin/ErrorsTab';
import MockInterviewsTab from './admin/MockInterviewsTab';
import FreeTrialsTab from './admin/FreeTrialsTab';
import { Search, Users, ListChecks, BookOpen, RefreshCw, Lock, CreditCard, Check, X as XIcon, Video, Upload, Trash2, Play, Loader2, GraduationCap, AlertTriangle, Link2, HelpCircle, Plus, Pencil, Sparkles, MessageSquareWarning, Gift, Download, Building2, Mail, FolderOpen } from 'lucide-react';

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
    { k: 'mock',      label: 'Mock Interviews',    icon: Building2 },
    { k: 'trials',    label: 'Free Trials',        icon: Mail },
    { k: 'customization', label: 'AI Customisation', icon: Sparkles },
    { k: 'feedback',  label: 'Session Feedback',  icon: MessageSquareWarning },
    { k: 'faqs',      label: 'FAQs',               icon: HelpCircle },
    { k: 'rewards',   label: 'Rewards',            icon: Gift },
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
              <span>Auto-enroll in <b>Equity Research Analyst</b> (all 21 modules)</span>
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
          {tab === 'faqs'      && <FaqsTab />}
          {tab === 'customization' && <CustomizationTab />}
          {tab === 'feedback' && <SessionFeedbackTab />}
          {tab === 'curriculum' && <CurriculumTab />}
          {tab === 'mock' && <MockInterviewsTab />}
          {tab === 'trials' && <FreeTrialsTab />}
          {tab === 'rewards' && <RewardsTab />}
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
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    Promise.all([
      authFetch('/api/admin/payments/overview'),
      authFetch('/api/admin/payments/recent?limit=20'),
    ]).then(([o, r]) => { setData(o); setRecent(r); })
      .catch(e => setErr(e.message));
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/admin/payments/export`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'valuevade_payments.csv';
      a.click();
      URL.revokeObjectURL(url);
      setExported(true);
      setTimeout(() => setExported(false), 8000);
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

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

      {/* Export to Google Sheets row */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider">Paid Users</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            data-testid="export-payments-csv"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:border-green-500/50 hover:text-green-500 transition-all disabled:opacity-50"
          >
            {exporting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Download className="w-3.5 h-3.5" />}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <a
            href="https://sheets.new"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="open-google-sheets"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] transition-all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
            Open Google Sheets
          </a>
        </div>
      </div>

      {/* Post-export guide */}
      {exported && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-400" data-testid="export-success-tip">
          <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>CSV downloaded!</strong> Now go to{' '}
            <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="underline font-semibold">sheets.new</a>
            {' '}→ <strong>File → Import → Upload</strong> → select <code className="px-1 bg-green-500/20 rounded">valuevade_payments.csv</code>. Your data will be in the sheet in seconds.
          </span>
        </div>
      )}
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

// ============================================================================
// REWARDS TAB (Feb 2026)
// LinkedIn-share → free-resource reward engine. Admins define which module or
// capstone triggers a reward, upload the file, and can edit / reorder / delete.
// ============================================================================
function RewardsTab() {
  const [state, setState] = useState({ rewards: [], table_ready: true, hint: null });
  const [triggers, setTriggers] = useState({ modules: [], capstones: [] });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // reward object or {isNew:true}

  const reload = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [rewards, trig] = await Promise.all([
        authFetch('/api/admin/rewards'),
        authFetch('/api/admin/rewards/triggers'),
      ]);
      setState(rewards);
      setTriggers(trig);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const del = async (r) => {
    if (!window.confirm(`Delete reward "${r.title}"? This also removes the uploaded file.`)) return;
    try {
      await authFetchJson(`/api/admin/rewards/${r.id}`, { method: 'DELETE' });
      reload();
    } catch (e) { alert(`Delete failed: ${e.message}`); }
  };

  const toggleActive = async (r) => {
    try {
      await authFetchJson(`/api/admin/rewards/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !r.is_active }),
      });
      reload();
    } catch (e) { alert(`Toggle failed: ${e.message}`); }
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
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Free resources unlocked when a learner shares a milestone on LinkedIn.
          </p>
        </div>
        <button
          onClick={() => setEditing({ isNew: true, trigger_type: 'module_complete', is_active: true, order_index: state.rewards.length + 1 })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:brightness-110"
          data-testid="admin-rewards-add-btn"
        >
          <Plus size={16} /> Add Reward
        </button>
      </div>

      {state.rewards.length === 0 && state.table_ready && (
        <div className="p-6 text-center rounded-2xl border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-muted)] font-bricolage">
          No rewards configured yet. Click <strong>Add Reward</strong> to attach a resource to a module or capstone completion.
        </div>
      )}

      <div className="space-y-3">
        {state.rewards.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4 flex flex-wrap items-start gap-4"
            data-testid={`admin-reward-row-${r.id}`}
          >
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)]">
                  {r.trigger_type === 'capstone_complete' ? 'Capstone' : 'Module'} · #{r.order_index}
                </span>
                {!r.is_active && (
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-amber-400">· inactive</span>
                )}
              </div>
              <div className="text-sm font-semibold text-[var(--color-text)] font-bricolage" data-testid={`admin-reward-title-${r.id}`}>
                {r.title}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{r.trigger_label}</div>
              {r.resource_file_name && (
                <div className="text-[11px] text-[var(--color-text-faint)] mt-1 truncate">
                  📎 {r.resource_file_name}{' '}
                  {r.resource_size_bytes ? `· ${(r.resource_size_bytes / 1024).toFixed(0)} KB` : ''}
                </div>
              )}
              {!r.resource_file_path && (
                <div className="text-[11px] text-amber-400 mt-1">⚠ No file uploaded — reward won&apos;t unlock until you attach one.</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleActive(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${r.is_active ? 'border-[var(--color-success)]/50 text-[var(--color-success)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'}`}
                data-testid={`admin-reward-toggle-${r.id}`}
              >
                {r.is_active ? 'Active' : 'Inactive'}
              </button>
              <button
                onClick={() => setEditing(r)}
                className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                data-testid={`admin-reward-edit-${r.id}`}
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => del(r)}
                className="p-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10"
                data-testid={`admin-reward-delete-${r.id}`}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <RewardEditorModal
          reward={editing}
          triggers={triggers}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

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
      let json = null; try { json = JSON.parse(text); } catch { /* ignore */ }
      if (!r.ok) throw new Error(json?.detail || text || 'Upload failed');
      setForm((f) => ({
        ...f,
        resource_file_path: json.resource_file_path,
        resource_file_name: json.resource_file_name,
        resource_mime: json.resource_mime,
        resource_size_bytes: json.resource_size_bytes,
      }));
    } catch (e) { alert(`Upload failed: ${e.message}`); }
    finally { setUploading(false); }
  }

  async function uploadFolder(fileList) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const zip = new JSZip();
      for (const file of fileList) {
        zip.file(file.webkitRelativePath || file.name, file);
      }
      const folderName = fileList[0].webkitRelativePath?.split('/')[0] || 'folder';
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      if (zipBlob.size > 50 * 1024 * 1024) { alert('Zipped folder exceeds 50 MB limit.'); return; }
      const zipFile = new File([zipBlob], `${folderName}.zip`, { type: 'application/zip' });
      await uploadFile(zipFile);
    } catch (e) { alert(`Folder zip failed: ${e.message}`); }
    finally { setUploading(false); }
  }

  async function save() {
    if (!form.title.trim() || !form.trigger_ref_id) {
      setError('Title and trigger target are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await authPost('/api/admin/rewards', form);
      } else {
        await authFetchJson(`/api/admin/rewards/${reward.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="admin-reward-editor"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--color-text)] font-bricolage">
              {isNew ? 'New Reward' : 'Edit Reward'}
            </h3>
            <button onClick={onClose} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <XIcon size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm"
                placeholder="e.g. Investment Banking Resume Template"
                data-testid="admin-reward-title-input"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm"
                placeholder="What's inside the resource"
                data-testid="admin-reward-desc-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">Trigger *</label>
                <select
                  value={form.trigger_type}
                  onChange={(e) => setForm({ ...form, trigger_type: e.target.value, trigger_ref_id: '' })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm"
                  data-testid="admin-reward-trigger-type"
                >
                  <option value="module_complete">Module Complete</option>
                  <option value="capstone_complete">Capstone Complete</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">Target *</label>
                <select
                  value={form.trigger_ref_id}
                  onChange={(e) => setForm({ ...form, trigger_ref_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm"
                  data-testid="admin-reward-trigger-ref"
                >
                  <option value="">— pick one —</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {form.trigger_type === 'module_complete'
                        ? `M${o.module_number} — ${o.title}`
                        : `${o.code || 'CAP'} — ${o.title}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">LinkedIn post text (optional)</label>
              <textarea
                value={form.linkedin_message}
                onChange={(e) => setForm({ ...form, linkedin_message: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-bricolage"
                placeholder="Leave blank to use the default template."
                data-testid="admin-reward-linkedin-msg"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1.5">
                Resource file or folder (≤50 MB)
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Single file upload */}
                <label
                  className="inline-flex items-center gap-1.5 cursor-pointer px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                  data-testid="admin-reward-file-label"
                >
                  <Upload size={13} /> Upload File
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(e) => uploadFile(e.target.files?.[0])}
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.zip,.pptx,.ppt,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
                    data-testid="admin-reward-file-input"
                  />
                </label>

                {/* Folder upload — browsers zip all files inside */}
                <label
                  className="inline-flex items-center gap-1.5 cursor-pointer px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                  data-testid="admin-reward-folder-label"
                >
                  <FolderOpen size={13} /> Upload Folder
                  <input
                    type="file"
                    className="sr-only"
                    webkitdirectory=""
                    mozdirectory=""
                    multiple
                    onChange={(e) => uploadFolder(e.target.files)}
                    data-testid="admin-reward-folder-input"
                  />
                </label>

                {uploading && (
                  <span className="flex items-center gap-1.5 text-xs text-[var(--color-primary)]">
                    <Loader2 size={14} className="animate-spin" /> Uploading…
                  </span>
                )}
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
                <input
                  type="number"
                  value={form.order_index}
                  onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value, 10) || 100 })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm"
                  data-testid="admin-reward-order-input"
                />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input
                  id="reward-active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  data-testid="admin-reward-active-input"
                />
                <label htmlFor="reward-active" className="text-sm text-[var(--color-text)] font-bricolage">Active</label>
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-sm font-bricolage" data-testid="admin-reward-editor-error">{error}</div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-40"
                data-testid="admin-reward-save-btn"
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Reward'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-sm"
                data-testid="admin-reward-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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


// -----------------------------------------------------------------------------
// FAQs Tab
// -----------------------------------------------------------------------------
function FaqsTab() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(null); // FAQ row or 'new'
  const [q, setQ] = useState('');

  const reload = () => authFetch('/api/admin/faqs').then(setData).catch((e) => setErr(e.message));
  useEffect(() => { reload(); }, []);

  const del = async (id) => {
    if (!window.confirm('Delete this FAQ permanently?')) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/faqs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${(await (await import('../lib/supabase')).supabase.auth.getSession()).data.session?.access_token || ''}` },
      });
      reload();
    } catch (e) { alert('Delete failed: ' + e.message); }
  };

  if (err) return <div className="text-red-500 p-4" data-testid="faqs-tab-error">{err}</div>;
  if (!data) return <div className="p-4 text-[var(--color-text-muted)]" data-testid="faqs-tab-loading">Loading…</div>;

  const filtered = data.faqs.filter((f) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (f.question || '').toLowerCase().includes(s)
      || (f.answer || '').toLowerCase().includes(s)
      || (f.category || '').toLowerCase().includes(s);
  });

  return (
    <div data-testid="faqs-tab">
      {data.table_ready === false && (
        <div
          className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-300"
          data-testid="faqs-migration-banner"
        >
          <div className="font-semibold mb-0.5">FAQs database table not created yet</div>
          <div className="text-xs">
            Run <code className="px-1 py-0.5 rounded bg-black/20 font-mono">/app/scripts/migrations/0033_faqs.sql</code> in Supabase Studio → SQL Editor to enable saving. The public landing page continues to show the 22 built-in FAQs until then.
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium" data-testid="faqs-total">
            {data.total} FAQs
          </span>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] hover:brightness-110 text-white text-sm font-medium transition-all"
            data-testid="faqs-add-btn"
          >
            <Plus size={14} /> Add FAQ
          </button>
        </div>
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search question, answer, category…"
            data-testid="faqs-search"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="faqs-table">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr>
              <th className="p-3 w-24">Order</th>
              <th className="p-3 w-32">Category</th>
              <th className="p-3">Question</th>
              <th className="p-3 w-24">Status</th>
              <th className="p-3 w-32 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} className="border-t border-[var(--color-border)]" data-testid={`faqs-row-${f.id}`}>
                <td className="p-3 font-mono text-xs text-[var(--color-text-muted)]">{f.order_index}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full bg-[var(--color-bg-card)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-primary)]">
                    {f.category}
                  </span>
                </td>
                <td className="p-3 font-medium">{f.question}</td>
                <td className="p-3">
                  {f.is_published ? (
                    <span className="text-emerald-500 text-xs font-medium" data-testid={`faqs-status-published-${f.id}`}>Published</span>
                  ) : (
                    <span className="text-amber-500 text-xs font-medium" data-testid={`faqs-status-draft-${f.id}`}>Draft</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(f)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 text-xs mr-1"
                    data-testid={`faqs-edit-${f.id}`}
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => del(f.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-500 hover:bg-red-500/10 text-xs"
                    data-testid={`faqs-delete-${f.id}`}
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-[var(--color-text-muted)]">No FAQs match.</div>}
      </div>

      {editing && (
        <FaqEditModal
          faq={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

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
    if (!category.trim() || !question.trim() || !answer.trim()) {
      setErr('Category, question, and answer are all required.');
      return;
    }
    setSaving(true); setErr(null);
    try {
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const body = JSON.stringify({
        category: category.trim(),
        question: question.trim(),
        answer: answer.trim(),
        tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean),
        order_index: Number(orderIndex) || 100,
        is_published: isPublished,
      });
      const url = isNew
        ? `${process.env.REACT_APP_BACKEND_URL}/api/admin/faqs`
        : `${process.env.REACT_APP_BACKEND_URL}/api/admin/faqs/${faq.id}`;
      const r = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body,
      });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 py-6"
      onClick={() => !saving && onClose()}
      data-testid="faq-edit-modal"
    >
      <div
        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">
            {isNew ? 'Add new FAQ' : 'Edit FAQ'}
          </h3>
          <button onClick={() => !saving && onClose()} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="faq-edit-close">
            <XIcon size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="faq-cat-suggest"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm"
                data-testid="faq-edit-category"
              />
              <datalist id="faq-cat-suggest">
                {['Course', 'Pricing', 'Certificate', 'Simulations', 'Support', 'Careers'].map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Order (lower = higher up)</label>
              <input
                type="number"
                value={orderIndex}
                onChange={(e) => setOrderIndex(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm"
                data-testid="faq-edit-order"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Question</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm"
              data-testid="faq-edit-question"
            />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Answer</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={6}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm font-bricolage"
              data-testid="faq-edit-answer"
            />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Tags (comma-separated — helps the chatbot search)</label>
            <input
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="e.g. refund, cancel, money back"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm font-mono"
              data-testid="faq-edit-tags"
            />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="w-4 h-4"
              data-testid="faq-edit-published"
            />
            Published (visible on landing page + chatbot)
          </label>

          {err && <div className="text-sm text-red-500" data-testid="faq-edit-error">{err}</div>}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            disabled={saving}
            data-testid="faq-edit-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:brightness-110 disabled:opacity-60"
            data-testid="faq-edit-save"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving…' : (isNew ? 'Create FAQ' : 'Save changes')}
          </button>
        </div>
      </div>
    </div>
  );
}


// -----------------------------------------------------------------------------
// AI Customisation Tab
// -----------------------------------------------------------------------------
function CustomizationTab() {
  const [mode, setMode] = useState(null); // 'off' | 'optional' | 'mandatory'
  const [modeSaving, setModeSaving] = useState(false);
  const [modeErr, setModeErr] = useState(null);
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null); // question row or 'new'
  const [dataErr, setDataErr] = useState(null);

  const reloadMode = () =>
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/app-settings/ai-customization`)
      .then((r) => r.json())
      .then((j) => setMode(j.mode || 'off'))
      .catch((e) => setModeErr(e.message));

  const reloadQuestions = () => authFetch('/api/admin/customization-questions')
    .then(setData)
    .catch((e) => setDataErr(e.message));

  useEffect(() => { reloadMode(); reloadQuestions(); }, []);

  const changeMode = async (newMode) => {
    setModeSaving(true); setModeErr(null);
    try {
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/app-settings/ai-customization`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ mode: newMode }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      setMode(newMode);
    } catch (e) {
      setModeErr(e.message);
    } finally {
      setModeSaving(false);
    }
  };

  const delQ = async (id) => {
    if (!window.confirm('Delete this customisation question permanently?')) return;
    try {
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/customization-questions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      reloadQuestions();
    } catch (e) { alert('Delete failed: ' + e.message); }
  };

  return (
    <div data-testid="customization-tab" className="space-y-6">
      {/* Mode toggle card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5" data-testid="customization-mode-card">
        <div className="flex items-start gap-2 mb-3">
          <Sparkles size={16} className="text-[var(--color-accent-purple)] mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">AI customisation flow</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Controls whether the &quot;Customise with AI&quot; button shows on the enrolment page.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
          {[
            { key: 'off', title: 'Off', desc: 'Only standard one-click enrol' },
            { key: 'optional', title: 'Optional', desc: 'Both CTAs — user chooses' },
            { key: 'mandatory', title: 'Mandatory', desc: 'Every new enrollee must customise' },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              disabled={modeSaving || mode === opt.key}
              onClick={() => changeMode(opt.key)}
              data-testid={`customization-mode-${opt.key}`}
              className={`text-left rounded-xl border px-4 py-3 transition-all ${
                mode === opt.key
                  ? 'border-[var(--color-accent-purple)] bg-[var(--color-accent-purple)]/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
              }`}
            >
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

      {/* Questions CRUD card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5" data-testid="customization-questions-card">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              Customisation questions
              <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-mono" data-testid="customization-total">
                {data ? data.total : '…'}
              </span>
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              These are asked in order when a user hits the AI customisation wizard.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] hover:brightness-110 text-white text-sm font-medium transition-all"
            data-testid="customization-add-btn"
          >
            <Plus size={14} /> Add question
          </button>
        </div>

        {dataErr && <div className="text-red-500 text-sm mb-3" data-testid="customization-questions-error">{dataErr}</div>}
        {!data && !dataErr && <div className="text-[var(--color-text-muted)] text-sm" data-testid="customization-questions-loading">Loading…</div>}

        {data?.table_ready === false && (
          <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300" data-testid="customization-table-missing">
            The <code className="font-mono">master_customization_questions</code> table isn't set up on Supabase yet.
          </div>
        )}

        {data && data.questions?.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="customization-questions-table">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg)] text-left text-[var(--color-text-muted)]">
                <tr>
                  <th className="p-3 w-16">#</th>
                  <th className="p-3">Question</th>
                  <th className="p-3 w-28">Type</th>
                  <th className="p-3 w-24">Options</th>
                  <th className="p-3 w-24">Required</th>
                  <th className="p-3 w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.questions.map((q) => (
                  <tr key={q.id} className="border-t border-[var(--color-border)]" data-testid={`customization-q-row-${q.id}`}>
                    <td className="p-3 font-mono text-xs text-[var(--color-text-muted)]">{q.order_index}</td>
                    <td className="p-3">
                      <div className="font-medium text-[var(--color-text)]">{q.question_text}</div>
                      {q.purpose && <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 max-w-lg truncate" title={q.purpose}>{q.purpose}</div>}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-[var(--color-bg)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-accent-purple)]">
                        {q.question_type}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-[var(--color-text-muted)]">
                      {Array.isArray(q.options) ? q.options.length : 0}
                    </td>
                    <td className="p-3 text-xs">
                      {q.is_required ? <span className="text-emerald-500">Yes</span> : <span className="text-[var(--color-text-muted)]">No</span>}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(q)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 text-xs mr-1"
                        data-testid={`customization-edit-${q.id}`}
                      >
                        <Pencil size={11} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => delQ(q.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-500 hover:bg-red-500/10 text-xs"
                        data-testid={`customization-delete-${q.id}`}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.questions?.length === 0 && data.table_ready !== false && (
          <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">
            No customisation questions yet. Click &quot;Add question&quot; above.
          </div>
        )}
      </div>

      {editing && (
        <CustomizationEditModal
          question={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reloadQuestions(); }}
        />
      )}
    </div>
  );
}

function CustomizationEditModal({ question, onClose, onSaved }) {
  const isNew = !question;
  const [questionText, setQuestionText] = useState(question?.question_text || '');
  const [questionType, setQuestionType] = useState(question?.question_type || 'single_select');
  const [purpose, setPurpose] = useState(question?.purpose || '');
  const [orderIndex, setOrderIndex] = useState(question?.order_index ?? 100);
  const [isRequired, setIsRequired] = useState(question?.is_required ?? true);
  const [pathId, setPathId] = useState(question?.path_id || '');
  // options is array of { value, label, sub? }. Managed via optionsJson string
  // for flexibility while keeping the UI simple.
  const [options, setOptions] = useState(Array.isArray(question?.options) ? question.options : []);
  const [pathOptions, setPathOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    // Fetch available master_paths so admin picks the right course
    (async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data } = await supabase.from('master_paths').select('id, title').order('created_at');
        setPathOptions(data || []);
        // Default to first path if creating new
        if (isNew && !pathId && data && data.length) setPathId(data[0].id);
      } catch { /* ignore */ }
    })();
  }, [isNew, pathId]);

  const addOption = () => setOptions([...options, { value: '', label: '', sub: '' }]);
  const updateOption = (idx, key, val) => {
    const copy = options.slice();
    copy[idx] = { ...copy[idx], [key]: val };
    setOptions(copy);
  };
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
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const body = {
        question_text: questionText.trim(),
        question_type: questionType,
        options: needsOptions ? options.filter((o) => o.value && o.label) : [],
        order_index: Number(orderIndex) || 100,
        is_required: isRequired,
        purpose: purpose.trim() || null,
        ...(isNew ? { path_id: pathId } : {}),
      };
      const url = isNew
        ? `${process.env.REACT_APP_BACKEND_URL}/api/admin/customization-questions`
        : `${process.env.REACT_APP_BACKEND_URL}/api/admin/customization-questions/${question.id}`;
      const r = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 py-6"
      onClick={() => !saving && onClose()}
      data-testid="customization-edit-modal"
    >
      <div
        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">
            {isNew ? 'Add customisation question' : 'Edit question'}
          </h3>
          <button onClick={() => !saving && onClose()} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="customization-edit-close">
            <XIcon size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {isNew && (
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Course</label>
              <select
                value={pathId}
                onChange={(e) => setPathId(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm"
                data-testid="customization-edit-path"
              >
                <option value="" disabled>Pick a course…</option>
                {pathOptions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Type</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm"
                data-testid="customization-edit-type"
              >
                <option value="single_select">Single select (radio)</option>
                <option value="multi_select">Multi select (checkboxes)</option>
                <option value="text">Free text</option>
                <option value="number">Number</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Order</label>
              <input
                type="number"
                value={orderIndex}
                onChange={(e) => setOrderIndex(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm"
                data-testid="customization-edit-order"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Question text</label>
            <input
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="e.g. What&apos;s your finance background?"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm"
              data-testid="customization-edit-question"
            />
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Purpose (internal note — not shown to user)</label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              placeholder="How this answer changes the curriculum"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs font-bricolage"
              data-testid="customization-edit-purpose"
            />
          </div>

          {needsOptions && (
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Options</label>
              <div className="space-y-2 mt-1">
                {options.map((opt, idx) => (
                  <div key={idx} className="grid grid-cols-[100px_1fr_1fr_28px] gap-2 items-center" data-testid={`customization-edit-option-${idx}`}>
                    <input
                      placeholder="value"
                      value={opt.value || ''}
                      onChange={(e) => updateOption(idx, 'value', e.target.value)}
                      className="px-2 py-1.5 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs font-mono"
                    />
                    <input
                      placeholder="Label"
                      value={opt.label || ''}
                      onChange={(e) => updateOption(idx, 'label', e.target.value)}
                      className="px-2 py-1.5 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs"
                    />
                    <input
                      placeholder="Subtext (optional)"
                      value={opt.sub || ''}
                      onChange={(e) => updateOption(idx, 'sub', e.target.value)}
                      className="px-2 py-1.5 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="text-red-500 hover:bg-red-500/10 rounded p-1"
                      data-testid={`customization-remove-option-${idx}`}
                      aria-label="Remove option"
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  data-testid="customization-add-option-btn"
                >
                  <Plus size={11} /> Add option
                </button>
              </div>
            </div>
          )}

          <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="w-4 h-4"
              data-testid="customization-edit-required"
            />
            Required (user must answer to proceed)
          </label>

          {err && <div className="text-sm text-red-500" data-testid="customization-edit-error">{err}</div>}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            disabled={saving}
            data-testid="customization-edit-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:brightness-110 disabled:opacity-60"
            data-testid="customization-edit-save"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving…' : (isNew ? 'Create question' : 'Save changes')}
          </button>
        </div>
      </div>
    </div>
  );
}


// -----------------------------------------------------------------------------
// Session Feedback Tab (admin view of student-submitted feedback per session)
// -----------------------------------------------------------------------------
function SessionFeedbackTab() {
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
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [filterCat, filterStatus]);

  const patchRow = async (id, patch) => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/session-feedback/${id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      reload();
    } catch (e) { alert('Update failed: ' + e.message); }
  };

  const delRow = async (id) => {
    if (!window.confirm('Delete this feedback entry permanently?')) return;
    try {
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/session-feedback/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (!r.ok) throw new Error((await r.json()).detail || `HTTP ${r.status}`);
      reload();
    } catch (e) { alert('Delete failed: ' + e.message); }
  };

  if (err) return <div className="text-red-500 p-4" data-testid="session-feedback-tab-error">{err}</div>;
  if (!data) return <div className="p-4 text-[var(--color-text-muted)]" data-testid="session-feedback-tab-loading">Loading…</div>;

  const CAT_LABELS = {
    content_issue: { label: 'Content', color: 'text-red-400 bg-red-500/10' },
    quality_issue: { label: 'Video/Audio', color: 'text-amber-400 bg-amber-500/10' },
    other:         { label: 'Other', color: 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' },
  };

  const filtered = data.feedback.filter((r) => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (r.message || '').toLowerCase().includes(s)
      || (r.user_email || '').toLowerCase().includes(s)
      || (r.session_title || '').toLowerCase().includes(s);
  });

  return (
    <div data-testid="session-feedback-tab">
      {data.table_ready === false && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-300" data-testid="session-feedback-migration-banner">
          <div className="font-semibold mb-0.5">Session feedback table not created yet</div>
          <div className="text-xs">
            Run <code className="px-1 py-0.5 rounded bg-black/20 font-mono">/app/scripts/migrations/0035_session_feedback.sql</code> in Supabase Studio → SQL Editor to enable this feature.
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium" data-testid="session-feedback-total">
            {data.counts?.open || 0} open · {data.counts?.resolved || 0} resolved
          </span>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs" data-testid="session-feedback-filter-status">
            <option value="open">Open only</option>
            <option value="resolved">Resolved only</option>
            <option value="all">All</option>
          </select>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="px-2 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs" data-testid="session-feedback-filter-category">
            <option value="all">All categories</option>
            <option value="content_issue">Content issue</option>
            <option value="quality_issue">Video / audio</option>
            <option value="other">Other</option>
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
                    <td className="p-3 text-xs">
                      <div className="text-[var(--color-text)]">{r.user_full_name || '—'}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{r.user_email || ''}</div>
                    </td>
                    <td className="p-3 text-xs text-[var(--color-text-muted)]">{fmt(r.created_at)}</td>
                    <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {r.resolved ? (
                        <button type="button" onClick={() => patchRow(r.id, { resolved: false })} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card)] text-xs mr-1" data-testid={`session-feedback-reopen-${r.id}`}>Reopen</button>
                      ) : (
                        <button type="button" onClick={() => patchRow(r.id, { resolved: true })} className="inline-flex items-center gap-1 px-2 py-1 rounded text-emerald-500 hover:bg-emerald-500/10 text-xs mr-1" data-testid={`session-feedback-resolve-${r.id}`}><Check size={11} /> Resolve</button>
                      )}
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


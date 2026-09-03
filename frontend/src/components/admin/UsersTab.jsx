import React, { useState, useEffect } from 'react';
import { Stat, authFetch, authPost, authFetchJson, fmt, generatePassword, API } from './adminUtils';
import { supabase } from '../../lib/supabase';
import { Users, Trash2, Loader2, X as XIcon, Check, CheckCircle2, Zap, Bot, TrendingUp, Sparkles } from 'lucide-react';

function CreateUserModal({ onClose, onCreated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('user');
  const [autoEnroll, setAutoEnroll] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const [success, setSuccess] = useState(null);
  const [copied, setCopied] = useState(false);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 8;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true); setErr(null);
    try {
      const res = await authPost('/api/admin/users/create', { email: email.trim(), password, display_name: displayName.trim() || null, role, auto_enroll: autoEnroll });
      setSuccess(res);
    } catch (e) { setErr(e.message || 'Failed to create user.'); }
    finally { setSubmitting(false); }
  };

  const copyCreds = async () => {
    const text = `Valuevade credentials\n──────────────────────\nEmail:    ${success.email}\nPassword: ${success.password}\nLogin at: https://valuevade.com/login`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="create-user-modal" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{success ? 'User created' : 'Create user'}</h2>
          <button onClick={() => !submitting && (success ? onCreated() : onClose())} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="create-user-close"><XIcon size={18} /></button>
        </div>
        {success ? (
          <div className="space-y-4" data-testid="create-user-success">
            <p className="text-sm text-[var(--color-text-muted)]">Share these credentials with the user. Password won't be shown again.</p>
            <div className="rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] p-4 font-mono text-sm space-y-1">
              <div><span className="text-[var(--color-text-muted)]">Email:</span> <span data-testid="new-user-email">{success.email}</span></div>
              <div><span className="text-[var(--color-text-muted)]">Password:</span> <span data-testid="new-user-password">{success.password}</span></div>
              {success.role && success.role !== 'user' && (<div><span className="text-[var(--color-text-muted)]">Role:</span> {success.role}</div>)}
              <div><span className="text-[var(--color-text-muted)]">Enrolled:</span> {success.enrolled ? 'Yes (Equity Research)' : 'No'}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={copyCreds} data-testid="copy-credentials-button" className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:brightness-110 transition-all">
                {copied ? <><Check size={16} /> Copied</> : <>Copy credentials</>}
              </button>
              <button onClick={onCreated} data-testid="create-user-done" className="px-4 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="create-user-form">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="cu-email" className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]" placeholder="user@example.com" />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Password * <span className="text-[var(--color-text-muted)] normal-case">(min 8)</span></label>
              <div className="flex gap-2">
                <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required data-testid="cu-password" className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] font-mono" />
                <button type="button" onClick={() => setPassword(generatePassword())} data-testid="cu-gen-password" className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all whitespace-nowrap">Generate</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Display name <span className="normal-case">(optional)</span></label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} data-testid="cu-name" className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]" placeholder="Priya Menon" />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} data-testid="cu-role" className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <label className="flex items-start gap-2 text-sm text-[var(--color-text)] cursor-pointer" data-testid="cu-autoenroll-label">
              <input type="checkbox" checked={autoEnroll} onChange={(e) => setAutoEnroll(e.target.checked)} data-testid="cu-autoenroll" className="mt-0.5 accent-[var(--color-primary)]" />
              <span>Auto-enroll in <b>Equity Research Analyst</b> (all 21 modules)</span>
            </label>
            {err && (<div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-500" data-testid="cu-error">{err}</div>)}
            <button type="submit" disabled={!valid || submitting} data-testid="cu-submit" className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-accent-purple)] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {submitting ? 'Creating…' : 'Create user'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ProgressModal({ user, onClose }) {
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

export default function UsersTab({ onSelect }) {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [err, setErr] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmEnroll, setConfirmEnroll] = useState(null);
  const [enrollingId, setEnrollingId] = useState(null);

  const reload = () => authFetch('/api/admin/users').then(setData).catch(e => setErr(e.message));
  useEffect(() => { reload(); }, []);

  const handleDeleteUser = async (u) => {
    setDeletingId(u.user_id);
    try {
      await authFetchJson(`/api/admin/users/${u.user_id}`, { method: 'DELETE' });
      setConfirmDelete(null); reload();
    } catch (e) { alert(`Delete failed: ${e.message}`); }
    finally { setDeletingId(null); }
  };

  const handleEnrollAndPay = async (u) => {
    setEnrollingId(u.user_id);
    try {
      await authFetchJson(`/api/admin/users/${u.user_id}/enroll-and-pay`, { method: 'POST' });
      setConfirmEnroll(null); reload();
    } catch (e) { alert(`Enroll & Pay failed: ${e.message}`); }
    finally { setEnrollingId(null); }
  };

  if (err) return <div className="text-red-500 p-4">{err}</div>;
  if (!data) return <div className="p-4 text-[var(--color-text-muted)]">Loading…</div>;

  const filtered = data.users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  const totalPariCost   = filtered.reduce((s, u) => s + (u.llm_pari_cost_inr || 0), 0);
  const totalEstCost    = filtered.reduce((s, u) => s + (u.llm_est_total_inr || 0), 0);
  const totalInterviews = filtered.reduce((s, u) => s + (u.llm_interview_attempts || 0), 0);
  const totalCustom     = filtered.reduce((s, u) => s + (u.llm_customize_gens || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium" data-testid="users-total">{data.total} users</span>
          <button onClick={() => setShowCreate(true)} data-testid="create-user-button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent-purple)] hover:brightness-110 text-white text-sm font-medium transition-all">
            <Users size={14} /> Create User
          </button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email" data-testid="users-search" className="w-72 px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5" data-testid="llm-cost-summary">
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1"><Zap size={12} className="text-amber-400" /><p className="text-[11px] text-amber-400 font-medium uppercase tracking-wide">Total LLM cost</p></div>
          <p className="text-2xl font-bold text-amber-400 font-mono" data-testid="llm-total-cost">₹{totalEstCost.toFixed(2)}</p>
          <p className="text-[10px] text-amber-400/60 mt-0.5">Pari + interviews (exact)</p>
        </div>
        <div className="rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1"><Bot size={12} className="text-[var(--color-primary)]" /><p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide">Pari AI spend</p></div>
          <p className="text-2xl font-bold text-[var(--color-text)] font-mono">₹{totalPariCost.toFixed(2)}</p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">chatbot + plan gen</p>
        </div>
        <div className="rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1"><TrendingUp size={12} className="text-green-400" /><p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide">Mock interviews</p></div>
          <p className="text-2xl font-bold text-[var(--color-text)]">{totalInterviews}</p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">cost tracked exactly now</p>
        </div>
        <div className="rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1"><Sparkles size={12} className="text-purple-400" /><p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide">Plan customizations</p></div>
          <p className="text-2xl font-bold text-[var(--color-text)]">{totalCustom}</p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">included in Pari cost</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="users-table">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr>
              <th className="p-3 whitespace-nowrap">Name</th>
              <th className="p-3 whitespace-nowrap">Email</th>
              <th className="p-3 whitespace-nowrap">Country</th>
              <th className="p-3 whitespace-nowrap">Enrolled</th>
              <th className="p-3 whitespace-nowrap">Payment</th>
              <th className="p-3 whitespace-nowrap">Last Active</th>
              <th className="p-3 whitespace-nowrap">Plan</th>
              <th className="p-3 whitespace-nowrap"><span className="flex items-center gap-1"><Zap size={11} className="text-amber-400" />LLM Cost</span></th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const estTotal = u.llm_est_total_inr || 0;
              const pariCost = u.llm_pari_cost_inr || 0;
              const intv     = u.llm_interview_attempts || 0;
              const intvCost = u.llm_est_interview_inr || 0;
              const custom   = u.llm_customize_gens || 0;
              return (
                <tr key={u.user_id} className="border-t border-[var(--color-border)] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 font-medium whitespace-nowrap">{u.full_name || '—'}</td>
                  <td className="p-3 whitespace-nowrap">{u.email || '—'}</td>
                  <td className="p-3 whitespace-nowrap">{u.country_code || '—'}</td>
                  <td className="p-3 whitespace-nowrap">{u.enrolled ? fmt(u.enrollment_at) : '—'}</td>
                  <td className="p-3 whitespace-nowrap">
                    {u.paid
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20" data-testid={`paid-badge-${u.user_id}`}><CheckCircle2 size={10} /> Paid</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--color-bg-card)] text-[var(--color-text-muted)] border border-[var(--color-border)]">Unpaid</span>
                    }
                  </td>
                  <td className="p-3 whitespace-nowrap">{fmt(u.last_active)}</td>
                  <td className="p-3">{u.active_plan ? <span className="text-green-500">●</span> : <span className="text-[var(--color-text-muted)]">○</span>}</td>
                  <td className="p-3 whitespace-nowrap" data-testid={`llm-cost-${u.user_id}`}>
                    <div className="relative group">
                      <span className={`font-mono text-xs font-semibold cursor-help ${estTotal > 50 ? 'text-red-400' : estTotal > 10 ? 'text-amber-400' : 'text-[var(--color-text-muted)]'}`}>₹{estTotal.toFixed(2)}</span>
                      <div className="pointer-events-none absolute bottom-full left-0 mb-2 w-56 hidden group-hover:block z-20 shadow-2xl">
                        <div className="rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3 text-xs">
                          <p className="font-semibold text-[var(--color-text)] mb-2 flex items-center gap-1.5"><Zap size={11} className="text-amber-400" /> LLM cost breakdown</p>
                          <div className="space-y-1.5">
                            <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Pari AI + plan gen</span><span className="font-mono text-[var(--color-text)]">₹{pariCost.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Interviews ({intv}×)</span><span className="font-mono text-[var(--color-text)]">₹{intvCost.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Plan customizations</span><span className="text-[var(--color-text)]">{custom}×</span></div>
                          </div>
                          <div className="border-t border-[var(--color-border)] mt-2 pt-2 flex justify-between font-semibold">
                            <span className="text-[var(--color-text-muted)]">Est. total</span>
                            <span className="font-mono text-amber-400">₹{estTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 flex items-center gap-2 whitespace-nowrap">
                    <button data-testid={`view-progress-${u.user_id}`} onClick={() => onSelect(u)} className="text-[var(--color-primary)] hover:underline text-xs">View →</button>
                    {(!u.enrolled || !u.paid) && (
                      <button data-testid={`enroll-pay-${u.user_id}`} onClick={() => setConfirmEnroll(u)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-green-500/40 text-green-400 hover:bg-green-500/10 transition-colors text-xs font-medium" title="Enroll in course and mark as paid">
                        <CheckCircle2 size={11} />
                        {!u.enrolled && !u.paid ? 'Enroll & Pay' : !u.enrolled ? 'Enroll' : 'Mark Paid'}
                      </button>
                    )}
                    <button data-testid={`delete-user-${u.user_id}`} onClick={() => setConfirmDelete(u)} className="p-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors" title="Delete user">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); reload(); }} />}

      {confirmEnroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="enroll-pay-modal" onClick={() => !enrollingId && setConfirmEnroll(null)}>
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-card)] border border-green-500/30 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-500/10 text-green-400"><CheckCircle2 size={20} /></div>
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">Enroll &amp; Mark Paid?</h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">This will{!confirmEnroll.enrolled ? ' enroll' : ''}{!confirmEnroll.enrolled && !confirmEnroll.paid ? ' and' : ''}{!confirmEnroll.paid ? ' mark as paid (₹999)' : ''} <strong className="text-[var(--color-text)]">{confirmEnroll.email}</strong> in the Equity Research Analyst course.</p>
                <div className="mt-3 flex flex-col gap-1.5">
                  <div className={`flex items-center gap-2 text-xs ${confirmEnroll.enrolled ? 'text-green-400' : 'text-[var(--color-text-muted)]'}`}><CheckCircle2 size={11} className={confirmEnroll.enrolled ? 'text-green-400' : 'text-[var(--color-border)]'} />Course enrollment {confirmEnroll.enrolled ? '(already enrolled — will skip)' : '(will be created)'}</div>
                  <div className={`flex items-center gap-2 text-xs ${confirmEnroll.paid ? 'text-green-400' : 'text-[var(--color-text-muted)]'}`}><CheckCircle2 size={11} className={confirmEnroll.paid ? 'text-green-400' : 'text-[var(--color-border)]'} />Payment status ₹999 upfront {confirmEnroll.paid ? '(already paid — will skip)' : '(will be set)'}</div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmEnroll(null)} disabled={!!enrollingId} data-testid="enroll-pay-cancel" className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={() => handleEnrollAndPay(confirmEnroll)} disabled={!!enrollingId} data-testid="enroll-pay-confirm" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {enrollingId ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : <><CheckCircle2 size={14} /> Confirm</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="delete-user-modal" onClick={() => !deletingId && setConfirmDelete(null)}>
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-card)] border border-red-500/30 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-400"><Trash2 size={20} /></div>
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">Delete user?</h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">This will permanently remove <strong className="text-[var(--color-text)]">{confirmDelete.email}</strong> and all their data — enrollments, progress, exam attempts, payments and reward claims. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} disabled={!!deletingId} data-testid="delete-user-cancel" className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={() => handleDeleteUser(confirmDelete)} disabled={!!deletingId} data-testid="delete-user-confirm" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {deletingId ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete permanently</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shared utilities used across all AdminPanel tab components. */
import { supabase } from '../../lib/supabase';

export const API = process.env.REACT_APP_BACKEND_URL;

export async function authFetch(path) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${session?.access_token || ''}` },
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

export async function authPost(path, body) {
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
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) {
    const msg = (json && (json.detail || json.message)) || text || `${r.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return json;
}

export async function authFetchJson(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${session?.access_token || ''}`, ...(options.headers || {}) },
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

export function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

export const fmtINR = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n || 0));

export function generatePassword() {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const symbols = '@#$%&*';
  let out = '';
  for (let i = 0; i < 10; i++) out += alpha[Math.floor(Math.random() * alpha.length)];
  out += symbols[Math.floor(Math.random() * symbols.length)];
  out += Math.floor(Math.random() * 10);
  return out;
}

export function Stat({ label, value }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-bg-card-hover)] border border-[var(--color-border)]">
      <div className="text-xs text-[var(--color-text-muted)] uppercase">{label}</div>
      <div className="text-lg font-semibold text-[var(--color-text)]">{value}</div>
    </div>
  );
}

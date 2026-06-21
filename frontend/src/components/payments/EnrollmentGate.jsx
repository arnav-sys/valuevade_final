import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const API = process.env.REACT_APP_BACKEND_URL;
const CACHE_KEY = 'vv:enrollment-status';
const CACHE_TTL_MS = 5_000;

/**
 * Routes that NEVER trigger the gate redirect. (Auth, the choice page itself,
 * the payments callback, etc.) Anything else where we should let the gate
 * decide where to send the user.
 */
const ALLOWLIST_EXACT = new Set([
  '/login', '/signup', '/', '/upgrade', '/start',
  '/payment-callback', '/admin-panel', '/profile', '/settings', '/my-orders',
]);
const ALLOWLIST_PREFIX = ['/p/', '/referral', '/waitlist-arnav'];

function isAllowlisted(pathname) {
  if (ALLOWLIST_EXACT.has(pathname)) return true;
  return ALLOWLIST_PREFIX.some(p => pathname.startsWith(p));
}

async function fetchEnrollmentStatus() {
  // 5-sec session cache
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const { ts, value } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL_MS) return value;
    }
  } catch { /* ignore */ }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  const r = await fetch(`${API}/api/me/enrollment-status`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!r.ok) return null;
  const value = await r.json();
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), value })); } catch { /* ignore */ }
  return value;
}

/**
 * Top-level gate: forces every authenticated user to /start until they've
 * picked free vs paid. Idempotent — does not write anything to DB on its own.
 * Disabled for public + payment-callback routes.
 */
export default function EnrollmentGate({ children }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [state, setState] = useState({ checked: false, target: null });

  useEffect(() => {
    let alive = true;
    if (authLoading) return;
    // Unauthed users: gate does nothing, individual route guards (PublicOnlyRoute etc.) handle it.
    if (!user?.id) { setState({ checked: true, target: null }); return; }
    // Public / allow-listed routes — never redirect away.
    if (isAllowlisted(location.pathname)) { setState({ checked: true, target: null }); return; }
    (async () => {
      const data = await fetchEnrollmentStatus();
      if (!alive) return;
      if (!data) { setState({ checked: true, target: null }); return; }
      // Decide redirect target
      let target = null;
      if (data.needs_start_choice) target = '/start';
      // else if needs_customize=true and the user is NOT inside a /course/*/customize|preview|confirm|loading
      // flow yet, send them to /courses to pick a course.
      else if (data.needs_customize) {
        const inCourseFlow = location.pathname.startsWith('/course/')
                          || location.pathname === '/courses';
        if (!inCourseFlow) target = '/courses';
      }
      if (target && target !== location.pathname) {
        setState({ checked: true, target });
      } else {
        setState({ checked: true, target: null });
      }
    })();
    return () => { alive = false; };
  }, [user?.id, authLoading, location.pathname]);

  if (authLoading || !state.checked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]" data-testid="enrollment-gate-loading">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] animate-spin" />
      </div>
    );
  }
  if (state.target) {
    return <Navigate to={state.target} replace state={{ from: location.pathname }} />;
  }
  return children;
}

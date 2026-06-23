// Sequential P2 — Step 5/5: Drift Recovery Banner
//
// Slim, soft-tone re-engagement banner. Fetches /api/dashboard/drift-recovery
// on mount; renders only when the backend says `show: true`. Auto-dismisses
// after 5 s of no interaction. Manual dismiss (×) hits the dismiss endpoint
// so the 24-hour cooldown starts immediately.
//
// Visual rules:
//   • Slim — one line of copy + CTA + close icon. NO illustrations.
//   • Soft — never accusatory. Mentions the drop only as a delta, not as
//     "you slacked off". Action verb is "Resume", not "Recover".
//   • One banner max — DashboardPage mounts this once at the top.
//   • Respects prefers-reduced-motion (no slide animation).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, TrendingDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
const AUTO_DISMISS_MS = 5000;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('not_authenticated');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export default function DriftRecoveryBanner() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, show: false, payload: null });
  const [hidden, setHidden] = useState(false);
  const autoTimerRef = useRef(null);
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  // Fetch the drift state once per mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${BACKEND}/api/dashboard/drift-recovery`, { headers });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (res.ok && data?.show) {
          setState({ loading: false, show: true, payload: data });
        } else {
          setState({ loading: false, show: false, payload: data });
        }
      } catch {
        if (alive) setState({ loading: false, show: false, payload: null });
      }
    })();
    return () => { alive = false; };
  }, []);

  // Auto-dismiss after AUTO_DISMISS_MS if visible and no interaction.
  // We DO NOT call the dismiss endpoint here — soft auto-hide is per-visit
  // only. The 24-hour cooldown is reserved for an explicit click.
  useEffect(() => {
    if (!state.show || hidden) return undefined;
    autoTimerRef.current = setTimeout(() => setHidden(true), AUTO_DISMISS_MS);
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current); };
  }, [state.show, hidden]);

  const cancelAutoDismiss = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const handleDismiss = useCallback(async () => {
    cancelAutoDismiss();
    setHidden(true);
    try {
      const headers = await authHeaders();
      await fetch(`${BACKEND}/api/dashboard/drift-recovery/dismiss`, {
        method: 'POST', headers,
      });
    } catch { /* swallow — banner already hidden client-side */ }
  }, [cancelAutoDismiss]);

  const handleResume = useCallback(() => {
    cancelAutoDismiss();
    const nxt = state.payload?.next_session;
    if (nxt?.id) {
      navigate(`/session/${nxt.id}/start`);
    } else {
      navigate('/dashboard');
    }
  }, [navigate, state.payload, cancelAutoDismiss]);

  if (state.loading || !state.show || hidden) return null;

  const recent = state.payload?.recent_xp ?? 0;
  const prior  = state.payload?.prior_xp  ?? 0;
  const animClass = reducedMotion.current ? '' : 'drift-banner-enter';

  return (
    <div
      role="status"
      data-testid="drift-recovery-banner"
      onMouseEnter={cancelAutoDismiss}
      className={`relative rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/[0.06] backdrop-blur-sm px-4 sm:px-5 py-3 sm:py-3.5 flex items-center gap-3 sm:gap-4 ${animClass}`}
    >
      <div className="shrink-0 w-9 h-9 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/25 flex items-center justify-center">
        <TrendingDown size={16} className="text-[var(--color-primary)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]" data-testid="drift-banner-label">
          Quick check-in
        </div>
        <div className="font-bricolage text-sm text-[var(--color-text)] leading-snug truncate sm:whitespace-normal" data-testid="drift-banner-copy">
          Your weekly XP dropped from <span className="font-semibold text-[var(--color-text)]">{prior}</span> → <span className="font-semibold text-[var(--color-primary)]">{recent}</span>. Want to lock in just 1 session today?
        </div>
      </div>
      <button
        onClick={handleResume}
        data-testid="drift-banner-resume"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-xs sm:text-sm font-semibold font-bricolage px-3.5 sm:px-4 py-2 hover:brightness-110 transition-all"
      >
        Resume now <ArrowRight size={14} />
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        data-testid="drift-banner-dismiss"
        className="shrink-0 rounded-full p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
      >
        <X size={14} />
      </button>
      <style>{`
        @keyframes drift-banner-slide-down {
          0%   { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .drift-banner-enter {
          animation: drift-banner-slide-down 320ms ease-out both;
          will-change: opacity, transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .drift-banner-enter { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

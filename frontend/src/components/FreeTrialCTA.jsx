/**
 * Landing-page section that offers a FREE one-time AI mock interview
 * (J.P. Morgan). Visitors enter their email, we generate a browser
 * fingerprint client-side + let the backend combine it with an IP-hash
 * to enforce "one trial per laptop". On success we drop them into
 * /free-trial/{trialId} which reuses the existing interview sim UI in
 * guest mode.
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Sparkles, ArrowRight, Loader2, Building2, Clock, Users } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Cheap fingerprint — combines browser, screen, tz, language. Cookies/IP
// backfill on the server catch clients who wipe localStorage.
function makeFingerprint() {
  try {
    const s = [
      navigator.userAgent, navigator.language, navigator.hardwareConcurrency || '?',
      screen.width + 'x' + screen.height, screen.colorDepth,
      new Date().getTimezoneOffset(),
    ].join('|');
    // Fast, deterministic hash — not crypto-secure but plenty for uniqueness.
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return `fp_${Math.abs(h).toString(36)}_${btoa(s).slice(0, 16)}`;
  } catch { return `fp_${Math.random().toString(36).slice(2)}`; }
}

export default function FreeTrialCTA() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const start = useCallback(async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error('Please enter a valid email');
      return;
    }
    // Blocked if this laptop already used the trial (belt on top of server).
    if (localStorage.getItem('vv_free_trial_used')) {
      toast.error('Free trial already used on this device.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/free-trial/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: clean,
          fingerprint: makeFingerprint(),
          ref: (typeof window !== 'undefined' ? window.location.search : ''),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.detail || 'Could not start trial.');
      localStorage.setItem('vv_free_trial_used', '1');
      localStorage.setItem('vv_free_trial_id', j.trial_id);
      localStorage.setItem('vv_free_trial_email', clean);
      nav(`/free-trial/${j.trial_id}`);
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
    } finally { setBusy(false); }
  }, [email, busy, nav]);

  return (
    <section
      className="relative py-20 px-4 sm:px-8 lg:px-16"
      data-testid="free-trial-section"
    >
      <div className="max-w-5xl mx-auto rounded-3xl border border-[var(--color-primary)]/30 bg-gradient-to-br from-[var(--color-primary)]/8 to-[var(--color-accent-purple)]/8 backdrop-blur-xl p-8 sm:p-12 shadow-[0_0_60px_rgba(36,107,253,0.15)]">
        <div className="flex flex-col lg:flex-row items-start gap-10">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-[10px] font-mono uppercase tracking-[0.2em] mb-4">
              <Sparkles size={11} />
              Free · One-time · No signup
            </div>
            <h2 className="font-clash text-3xl sm:text-4xl font-bold text-[var(--color-text)] leading-tight">
              Try a full <span className="text-[var(--color-primary)]">J.P. Morgan</span> Mock Interview.
              <br className="hidden sm:block" />
              Free. On us.
            </h2>
            <p className="mt-4 text-sm sm:text-base font-bricolage text-[var(--color-text-muted)] leading-relaxed">
              5 real rounds — application, aptitude, HR, technical, and a live case study in Excel.
              Pari (your AI interviewer) talks to you like a real analyst would. Get a full
              scorecard + verdict at the end.
            </p>
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px] font-mono text-[var(--color-text-muted)]">
              <div className="flex items-center gap-1.5"><Building2 size={12}/> J.P. Morgan sim</div>
              <div className="flex items-center gap-1.5"><Clock size={12}/> 30-45 min</div>
              <div className="flex items-center gap-1.5"><Users size={12}/> AI grades every round</div>
            </div>
          </div>

          <form onSubmit={start} className="w-full lg:w-96 shrink-0 space-y-3" data-testid="free-trial-form">
            <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Enter your email to begin
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@work.email"
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text)] font-bricolage focus:border-[var(--color-primary)] outline-none"
              data-testid="free-trial-email-input"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white font-semibold font-bricolage text-sm hover:brightness-110 disabled:opacity-60 transition-all shadow-[0_0_24px_rgba(36,107,253,0.35)]"
              data-testid="free-trial-start-btn"
            >
              {busy ? <Loader2 size={15} className="animate-spin"/> : null}
              {busy ? 'Starting…' : 'Start free simulation'}
              {!busy && <ArrowRight size={15}/>}
            </button>
            <p className="text-[10px] font-mono text-[var(--color-text-faint)] text-center">
              One free trial per email + device. We don&apos;t spam.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

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
import { ArrowRight, Loader2, Building2, Clock, Users } from 'lucide-react';

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
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-30" aria-hidden="true" />
      <div className="relative max-w-5xl mx-auto">
        {/* Chapter rail */}
        <div className="flex items-center gap-3 mb-8">
          <span className="lv-chapter">§ // TRIAL</span>
          <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
          <span className="lv-chapter">FREE · ONE-TIME · NO SIGNUP</span>
        </div>

        <div className="lv-panel p-8 sm:p-10">
          <div className="flex flex-col lg:flex-row items-start gap-10">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <span className="lv-live-dot" aria-hidden="true" />
                <span className="font-jetbrains text-[10.5px] uppercase tracking-[0.2em] text-[var(--color-accent-purple)]" data-testid="free-trial-badge">
                  FREE · ONE-TIME · NO SIGNUP
                </span>
              </div>
              <h2 className="font-clash text-3xl sm:text-4xl text-[var(--color-text)]" style={{ lineHeight: 1.08, letterSpacing: '-0.02em' }}>
                Try a full analyst mock interview.
                <br className="hidden sm:block" />
                <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-primary)' }}>
                  Free.
                </span>
              </h2>
              <div className="mt-5 h-px w-20 bg-[var(--color-primary)]/60" aria-hidden="true" />
              <p className="mt-5 text-[14px] font-bricolage text-[var(--color-text-muted)] leading-relaxed">
                Five rounds — application, aptitude, HR, technical, and a live Excel case study — run by
                Pari as a bulge-bracket-style interviewer. You get a full scorecard and verdict at the end.
                One free trial per person. No card required.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2 font-jetbrains text-[10.5px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                <div className="flex items-center gap-2"><Building2 size={12} strokeWidth={2}/> BULGE-BRACKET SIM</div>
                <div className="flex items-center gap-2"><Clock size={12} strokeWidth={2}/> 30-45 MIN</div>
                <div className="flex items-center gap-2"><Users size={12} strokeWidth={2}/> AI GRADES EACH ROUND</div>
              </div>
            </div>

            <form onSubmit={start} className="w-full lg:w-96 shrink-0 space-y-3" data-testid="free-trial-form">
              <label className="block font-jetbrains text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Enter your email to begin
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@work.email"
                className="lv-trial-input w-full px-4 py-3 border font-bricolage text-sm outline-none transition-colors"
                style={{ borderRadius: 2 }}
                data-testid="free-trial-email-input"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy}
                className="lv-cta w-full justify-center disabled:opacity-60"
                data-testid="free-trial-start-btn"
              >
                {busy ? <Loader2 size={13} className="animate-spin"/> : null}
                {busy ? 'STARTING…' : 'START FREE SIMULATION'}
                {!busy && <ArrowRight size={13} strokeWidth={2.5}/>}
              </button>
              <p className="font-jetbrains text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-faint)] text-center">
                ONE TRIAL PER EMAIL + DEVICE · NO SPAM
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

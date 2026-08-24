/**
 * FreeTrialPlayerPage
 * -------------------
 * Post-email landing for the free trial. Given the free trial reuses the
 * authenticated interview_sim endpoints, we take the pragmatic route:
 * the guest is asked to create a quick account (email is prefilled), then
 * they land in the standard J.P. Morgan simulation. The `free_mock_trials`
 * row we already stored tracks the fact that they used their free credit.
 *
 * This keeps the LLM key protected (no unauth calls) while still delivering
 * a "free one-time trial" experience.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

export default function FreeTrialPlayerPage() {
  const { trialId } = useParams();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const email = (typeof localStorage !== 'undefined' && localStorage.getItem('vv_free_trial_email')) || '';

  useEffect(() => { if (!email || !trialId) nav('/', { replace: true }); }, [email, trialId, nav]);

  const goToSimulation = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Auto-create an account with a random password + this email so the
      // rest of the app "just works". Users can later reset the password.
      const pw = `Trial-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36).slice(-6)}!`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: { data: { free_trial: true, trial_id: trialId } },
      });
      if (error && !/already registered/i.test(error.message)) throw error;
      // If already registered, we can't sign them in without password; ask them to log in.
      if (!data?.session) {
        toast.info('Please log in with the existing account for this email.');
        nav('/login', { state: { redirectTo: '/interview-sims', prefillEmail: email } });
        return;
      }
      // Provision the newly-created account so the JPM interview hub is
      // unlocked immediately (M20 + all sessions complete + paid).
      try {
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/free-trial/${trialId}/provision`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session.access_token}`,
          },
        });
      } catch (e) { console.warn('[free-trial] provision warning:', e?.message); }
      toast.success('Account created — heading to your free simulation.');
      nav('/interview-sims');
    } catch (e) {
      toast.error(e.message || 'Could not start simulation');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-primary)]" data-testid="free-trial-player">
      <div className="max-w-lg w-full rounded-3xl border border-[var(--color-primary)]/25 bg-[var(--color-bg-card)] p-8 space-y-5 shadow-[0_0_60px_rgba(36,107,253,0.15)]">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.2em] bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)]">
          <Sparkles size={11}/> Free J.P. Morgan simulation
        </div>
        <h1 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)]">
          You&apos;re in, {email.split('@')[0]}.
        </h1>
        <p className="text-sm font-bricolage text-[var(--color-text-muted)] leading-relaxed">
          Your free simulation is ready. We&apos;ll spin up a lightweight account
          with your email so your progress + score sticks — no password needed
          right now.
        </p>
        <ul className="text-xs font-mono text-[var(--color-text-muted)] space-y-1.5 py-2">
          <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-[var(--color-success)]"/> Application → Aptitude → HR → Technical → Case study</li>
          <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-[var(--color-success)]"/> AI grades every round + gives you a verdict</li>
          <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-[var(--color-success)]"/> Pari speaks the questions — like a real interview</li>
        </ul>
        <button
          onClick={goToSimulation}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white font-semibold font-bricolage text-sm hover:brightness-110 disabled:opacity-60 transition-all"
          data-testid="free-trial-continue-btn"
        >
          {busy ? <Loader2 size={15} className="animate-spin"/> : null}
          {busy ? 'Preparing…' : 'Start J.P. Morgan simulation'}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) setReady(true);
    });

    // Handles a refresh where the session was restored before the listener ran.
    const timer = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setReady(true);
        else setLinkInvalid(true);
      });
    }, 4000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (err) { setError(err.message); return; }

    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => navigate('/login'), 1600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--bg-primary)] relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[120px] animate-blob pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-[var(--color-primary)] opacity-[0.05] blur-[100px] animate-blob pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-md relative z-10">
        <div className="glass-card rounded-2xl p-8 sm:p-10" data-testid="reset-password-card">
          <div className="flex items-center gap-2.5 mb-8">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8" />
            <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
          </div>

          {linkInvalid ? (
            <div data-testid="reset-password-invalid-state">
              <h1 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-2">Link expired</h1>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage leading-relaxed mb-6">
                This reset link is invalid or has expired. Request a fresh one to continue.
              </p>
              <Link to="/forgot-password" className="inline-flex items-center justify-center w-full py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-semibold font-bricolage text-sm hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all" data-testid="reset-password-request-new-link">
                Request a new link
              </Link>
            </div>
          ) : !ready ? (
            <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)] font-bricolage" data-testid="reset-password-verifying">
              <Loader2 size={18} className="animate-spin" /> Opening secure reset session...
            </div>
          ) : done ? (
            <div data-testid="reset-password-success-state">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-success)]/10 flex items-center justify-center mb-5">
                <CheckCircle2 size={22} className="text-[var(--color-success)]" />
              </div>
              <h1 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-2">Password updated</h1>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage">Taking you to sign in...</p>
            </div>
          ) : (
            <>
              <h1 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-1" data-testid="reset-password-heading">Choose a new password</h1>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-8">Must be at least 8 characters.</p>

              {error && (
                <div className="mb-6 px-4 py-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm font-bricolage" data-testid="reset-password-error">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" data-testid="reset-password-form">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-2">New password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-11 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 font-bricolage text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(36,107,253,0.15)]"
                      placeholder="Enter new password"
                      data-testid="reset-password-input"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" data-testid="reset-password-toggle-visibility">
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Confirm password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 font-bricolage text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(36,107,253,0.15)]"
                    placeholder="Re-enter new password"
                    data-testid="reset-password-confirm-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-semibold font-bricolage text-sm hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  data-testid="reset-password-submit-button"
                >
                  {submitting ? <><Loader2 size={18} className="animate-spin" /> Updating...</> : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

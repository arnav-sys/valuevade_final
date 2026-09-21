import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    // Deliberately generic, don't reveal whether the account exists.
    if (err) setError(err.message);
    else setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--bg-primary)] relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[120px] animate-blob pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-[var(--color-primary)] opacity-[0.05] blur-[100px] animate-blob pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-md relative z-10">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-8 group" data-testid="forgot-password-back-login">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Sign In
        </Link>

        <div className="glass-card rounded-2xl p-8 sm:p-10" data-testid="forgot-password-card">
          <div className="flex items-center gap-2.5 mb-8">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8" />
            <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
          </div>

          {sent ? (
            <div data-testid="forgot-password-sent-state">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center mb-5">
                <MailCheck size={22} className="text-[var(--color-primary)]" />
              </div>
              <h1 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-2">Check your inbox</h1>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage leading-relaxed">
                If an account exists for <span className="text-[var(--color-text)]">{email}</span>, we've sent a link to reset your password. It'll land in a minute or two, check spam if you don't see it.
              </p>
            </div>
          ) : (
            <>
              <h1 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-1" data-testid="forgot-password-heading">Forgot password?</h1>
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-8">Enter your email and we'll send you a reset link.</p>

              {error && (
                <div className="mb-6 px-4 py-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm font-bricolage" data-testid="forgot-password-error">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" data-testid="forgot-password-form">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 font-bricolage text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(36,107,253,0.15)]"
                    placeholder="you@example.com"
                    data-testid="forgot-password-email-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-semibold font-bricolage text-sm hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  data-testid="forgot-password-submit-button"
                >
                  {submitting ? <><Loader2 size={18} className="animate-spin" /> Sending...</> : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-[var(--color-text-muted)] font-bricolage">
            Remembered it?{' '}
            <Link to="/login" className="text-[var(--color-primary)] hover:underline" data-testid="forgot-password-signin-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

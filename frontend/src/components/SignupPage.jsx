import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;

    // Capture ?ref= from URL into localStorage before signup
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get('ref');
      if (ref) localStorage.setItem('vv_pending_ref', ref);
    } catch { /* ignore */ }

    setSubmitting(true);
    const { error } = await signUp({ email: form.email, password: form.password, fullName: form.fullName });
    setSubmitting(false);

    if (error) {
      setApiError(error.message);
      return;
    }
    // Best-effort referral attach (non-blocking, errors swallowed)
    try {
      const ref = localStorage.getItem('vv_pending_ref');
      if (ref) {
        const { supabase } = await import('../lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          fetch(`${process.env.REACT_APP_BACKEND_URL}/api/referrals/attach`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ ref_code: ref }),
          }).catch(() => {});
        }
        localStorage.removeItem('vv_pending_ref');
      }
    } catch { /* */ }
    navigate('/courses');
  };

  const set = (field) => (e) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    setErrors((p) => ({ ...p, [field]: undefined }));
    setApiError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Animated bg orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[120px] animate-blob pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.05] blur-[100px] animate-blob pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-md relative z-10">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-8 group" data-testid="signup-back-home">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Home
        </Link>

        {/* Card */}
        <div className="glass-card rounded-2xl p-8 sm:p-10" data-testid="signup-card">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8" />
            <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
          </div>

          <h1 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-1" data-testid="signup-heading">Create your account</h1>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-8">Start your finance career journey</p>

          {apiError && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm font-bricolage" data-testid="signup-api-error">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" data-testid="signup-form">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={set('fullName')}
                className={`w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 font-bricolage text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(36,107,253,0.15)] ${errors.fullName ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'}`}
                placeholder="John Doe"
                data-testid="signup-fullname-input"
              />
              {errors.fullName && <p className="mt-1.5 text-xs text-[var(--color-error)]" data-testid="signup-fullname-error">{errors.fullName}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                className={`w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 font-bricolage text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(36,107,253,0.15)] ${errors.email ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'}`}
                placeholder="you@example.com"
                data-testid="signup-email-input"
              />
              {errors.email && <p className="mt-1.5 text-xs text-[var(--color-error)]" data-testid="signup-email-error">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  className={`w-full px-4 py-3 pr-11 rounded-xl bg-[var(--color-surface)] border text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 font-bricolage text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(36,107,253,0.15)] ${errors.password ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'}`}
                  placeholder="Min 8 characters"
                  data-testid="signup-password-input"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" data-testid="signup-toggle-password">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-[var(--color-error)]" data-testid="signup-password-error">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Confirm Password</label>
              <div className="relative">
                <input
                  type={showCpw ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  className={`w-full px-4 py-3 pr-11 rounded-xl bg-[var(--color-surface)] border text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 font-bricolage text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(36,107,253,0.15)] ${errors.confirmPassword ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'}`}
                  placeholder="Re-enter password"
                  data-testid="signup-confirm-password-input"
                />
                <button type="button" onClick={() => setShowCpw(!showCpw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" data-testid="signup-toggle-confirm-password">
                  {showCpw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1.5 text-xs text-[var(--color-error)]" data-testid="signup-confirm-password-error">{errors.confirmPassword}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-semibold font-bricolage text-sm hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="signup-submit-button"
            >
              {submitting ? <><Loader2 size={18} className="animate-spin" /> Creating account...</> : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-text-muted)] font-bricolage">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--color-primary)] hover:underline font-medium" data-testid="signup-login-link">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

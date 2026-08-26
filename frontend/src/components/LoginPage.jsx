import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (!form.password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    const { data, error } = await signIn({ email: form.email, password: form.password });
    setSubmitting(false);

    if (error) {
      setApiError(error.message);
      return;
    }

    // Check if user has an active enrollment — default to /courses on any failure
    const userId = data?.user?.id;
    if (userId) {
      try {
        const { data: enrollments } = await supabase
          .from('user_enrollments')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active');

        if (enrollments && enrollments.length > 0) {
          navigate('/dashboard');
          return;
        }
      } catch {
        // Enrollment check failed — proceed to courses
      }
    }
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
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-[120px] animate-blob pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-[var(--color-primary)] opacity-[0.05] blur-[100px] animate-blob pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-md relative z-10">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-8 group" data-testid="login-back-home">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Home
        </Link>

        {/* Card */}
        <div className="glass-card rounded-2xl p-8 sm:p-10" data-testid="login-card">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <img src="/valuevade-logo.svg" alt="Valuevade" className="w-8 h-8" />
            <span className="font-clash text-xl font-semibold logo-gradient">Valuevade</span>
          </div>

          <h1 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-1" data-testid="login-heading">Welcome back</h1>
          <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-8">Sign in to continue your journey</p>

          {apiError && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm font-bricolage" data-testid="login-api-error">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
            {/* Email */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                className={`w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 font-bricolage text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(36,107,253,0.15)] ${errors.email ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'}`}
                placeholder="you@example.com"
                data-testid="login-email-input"
              />
              {errors.email && <p className="mt-1.5 text-xs text-[var(--color-error)]" data-testid="login-email-error">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Password</label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-xs text-[var(--color-primary)] hover:underline font-bricolage"
                  data-testid="login-forgot-password"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  className={`w-full px-4 py-3 pr-11 rounded-xl bg-[var(--color-surface)] border text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 font-bricolage text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(36,107,253,0.15)] ${errors.password ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'}`}
                  placeholder="Enter your password"
                  data-testid="login-password-input"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" data-testid="login-toggle-password">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-[var(--color-error)]" data-testid="login-password-error">{errors.password}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-semibold font-bricolage text-sm hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="login-submit-button"
            >
              {submitting ? <><Loader2 size={18} className="animate-spin" /> Signing in...</> : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-text-muted)] font-bricolage" data-testid="login-signup-hint">
            New here? Contact your admin for an invite.
          </p>
        </div>
      </div>
    </div>
  );
}

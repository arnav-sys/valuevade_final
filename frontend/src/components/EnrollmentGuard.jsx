import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

/**
 * Guards routes that require an active or completed enrollment.
 * - While checking: shows branded loading shell
 * - No enrollment: redirects to /courses
 * - Has enrollment: renders children
 */
export default function EnrollmentGuard({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [state, setState] = useState({ checking: true, hasEnrollment: false });

  useEffect(() => {
    let mounted = true;
    async function check() {
      if (!user?.id) {
        if (mounted) setState({ checking: false, hasEnrollment: false });
        return;
      }
      try {
        const { data } = await supabase
          .from('user_enrollments')
          .select('id, status')
          .eq('user_id', user.id)
          .in('status', ['active', 'completed'])
          .limit(1);
        if (!mounted) return;
        setState({ checking: false, hasEnrollment: (data || []).length > 0 });
      } catch {
        if (mounted) setState({ checking: false, hasEnrollment: false });
      }
    }
    check();
    return () => { mounted = false; };
  }, [user?.id]);

  if (state.checking) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--bg-primary)]" data-testid="enrollment-guard-loading">
        <img src="/valuevade-logo.svg" alt="Valuevade" className="w-14 h-14 mb-5 animate-pulse" />
        <div className="w-40 h-1 rounded-full overflow-hidden bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] animate-[shimmer_1.5s_ease-in-out_infinite]"
            style={{ width: '60%' }}
          />
        </div>
        <p className="mt-4 text-xs text-[var(--color-text-muted)] font-bricolage">Checking your enrollment…</p>
      </div>
    );
  }

  if (!state.hasEnrollment) {
    return <Navigate to="/courses" replace state={{ from: location.pathname }} />;
  }

  return children;
}

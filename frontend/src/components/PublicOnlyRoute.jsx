import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Wraps routes that should be accessible only to logged-out users
 * (e.g. /login, /signuproute1). Authenticated users are redirected to /courses.
 */
export default function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--bg-primary)]" data-testid="auth-loading-screen">
        <img src="/valuevade-logo.svg" alt="Valuevade" className="w-16 h-16 mb-6 animate-pulse" />
        <div className="w-48 h-1 rounded-full overflow-hidden bg-white/10">
          <div className="h-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
        </div>
        <p className="mt-4 text-sm text-[var(--color-text-muted)] font-bricolage">Loading...</p>
      </div>
    );
  }

  if (user) return <Navigate to="/courses" replace />;

  return children;
}

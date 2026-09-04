import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

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

  // Pass the intended URL so LoginPage can redirect back after login.
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;

  return children;
}

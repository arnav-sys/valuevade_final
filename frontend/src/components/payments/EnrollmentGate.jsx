import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ALLOWLIST = new Set(['/login', '/signup', '/', '/upgrade', '/start', '/payment-callback', '/admin-panel', '/profile', '/settings', '/my-orders', '/purchases']);
export default function EnrollmentGate({ children }) {
  const { user, loading, enrollmentStatus, enrollmentLoading, enrollmentError, refreshEnrollment } = useAuth();
  const { pathname } = useLocation();
  if (!user || ALLOWLIST.has(pathname) || ['/p/', '/referral', '/waitlist-arnav', '/resources'].some(p => pathname.startsWith(p))) return children;
  if (loading || enrollmentLoading) return <div data-testid="enrollment-gate-loading" role="status">Checking your enrolment…</div>;
  if (!enrollmentStatus) return <div role="alert" data-testid="enrollment-gate-error">{enrollmentError}<button onClick={() => refreshEnrollment()} data-testid="enrollment-gate-retry">Retry</button></div>;
  const target = enrollmentStatus.needs_start_choice ? '/start' : enrollmentStatus.needs_customize && !pathname.startsWith('/course/') && pathname !== '/courses' ? '/courses' : null;
  return target ? <Navigate to={target} replace state={{ from: pathname }} /> : children;
}
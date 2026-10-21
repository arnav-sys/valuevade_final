import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PaywallModal from './PaywallModal';
import AILoader from '../common/AILoader';

const API = process.env.REACT_APP_BACKEND_URL;

/** Backend remains the authority; unavailable checks never grant access. */
export default function SessionPaymentGate({ children }) {
  const { sessionId } = useParams();
  const { session } = useAuth();
  const token = session?.access_token;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const requestKey = `${sessionId || 'course'}:${token || ''}:${attempt}`;

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    setState({ loading: true, data: null, error: null, key: requestKey });
    (async () => {
      try {
        if (!token) throw new Error('Your session is reconnecting. Please try again.');
        const query = sessionId ? `?${new URLSearchParams({ session_id: sessionId })}` : '';
        const response = await fetch(`${API}/api/payments/eligibility${query}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        if (!response.ok) throw new Error('We couldn’t confirm your access. Please try again.');
        const data = await response.json();
        if (typeof data.session_allowed !== 'boolean') throw new Error('We couldn’t confirm your access. Please try again.');
        if (alive) setState({ loading: false, data, error: null, key: requestKey });
      } catch (error) {
        if (alive) setState({ loading: false, data: null, key: requestKey,
          error: error.name === 'AbortError' ? 'The access check timed out. Please try again.' : error.message });
      } finally { clearTimeout(timeout); }
    })();
    return () => { alive = false; clearTimeout(timeout); controller.abort(); };
  }, [token, sessionId, requestKey]);

  const retry = () => setAttempt(value => value + 1);
  if (state.loading || state.key !== requestKey) return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]" data-testid="payment-gate-loading">
      <AILoader title="Checking your access" messages={['Connecting to your learning path…']} testid="payment-gate-ai-loader" />
    </div>
  );
  if (state.error) return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center p-6" data-testid="payment-gate-error" role="alert">
      <h1 className="text-2xl mb-3">Let’s reconnect to your course</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6" data-testid="payment-gate-error-message">{state.error}</p>
      <button onClick={retry} className="lv-cta" data-testid="payment-gate-retry"><RefreshCw size={16} /> Try again</button>
      <Link to="/courses" className="mt-5 text-sm text-[var(--color-primary)]" data-testid="payment-gate-back">Back to courses</Link>
    </main>
  );
  if (!state.data.session_allowed) return (
    <PaywallModal amountInr={state.data.amount_inr} tierAvailable={state.data.pricing_tier_available} onPaid={retry} />
  );
  return children;
}
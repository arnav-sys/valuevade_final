/**
 * Payment gating is temporarily disabled per product decision.
 * This component is now a pass-through so enrolled users can access
 * every session immediately without paying. The eligibility API + PaywallModal
 * are preserved untouched and can be re-enabled by reverting this file.
 */
export default function SessionPaymentGate({ children }) {
  return children;
}

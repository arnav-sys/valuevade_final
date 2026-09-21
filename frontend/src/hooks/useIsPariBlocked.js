import { useLocation } from 'react-router-dom';

// Feb 2026, routes where Pari should be silent so the student stays
// focused on the graded activity (quiz, mock interview, simulation).
//
// Note we only block the *active* pages, NOT the /start or /complete
// screens (those are already after the graded work).
const BLOCKED_PATH_PATTERNS = [
  /^\/session\/[^/]+\/quiz$/,
  /^\/session\/[^/]+\/interview$/,
  /^\/session\/[^/]+\/simulation$/,
  /^\/mock-interview(\/[^/]+)?$/,
  /^\/interview-sim\/[^/]+$/,
];

export function isPariBlockedPathname(pathname) {
  if (!pathname) return false;
  return BLOCKED_PATH_PATTERNS.some((re) => re.test(pathname));
}

export function useIsPariBlocked() {
  const location = useLocation();
  return isPariBlockedPathname(location.pathname || '');
}

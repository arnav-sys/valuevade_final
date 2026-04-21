import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

/**
 * Wraps routed content with a CSS-only fade/slide transition on route change.
 * No external deps — keyed by pathname so React remounts the inner tree with
 * a fresh animation on every navigation.
 */
export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  const [key, setKey] = useState(pathname);

  useEffect(() => {
    setKey(pathname);
  }, [pathname]);

  return (
    <div key={key} className="vv-page-transition" data-testid="page-transition">
      {children}
      <style>{`
        .vv-page-transition {
          animation: vvPageIn 280ms cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        @keyframes vvPageIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vv-page-transition { animation: none; }
        }
      `}</style>
    </div>
  );
}

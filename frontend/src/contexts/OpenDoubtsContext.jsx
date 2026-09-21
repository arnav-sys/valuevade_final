import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { listSessionDoubts } from '../utils/sessionDoubts';

// Phase B, Open-doubt count for sidebar pill.
//
// Lightweight provider: fetches the open-doubt list on auth/route changes
// and exposes a `count` plus a `refresh()` callback that the DoubtsPage
// can call after mutating a doubt (resolve / mark new) so the sidebar
// pill stays accurate without a full reload.

const OpenDoubtsContext = createContext({ count: 0, refresh: () => {} });

export function OpenDoubtsProvider({ children }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.id) { setCount(0); return; }
    try {
      const { ok, data } = await listSessionDoubts('open');
      if (ok && Array.isArray(data)) setCount(data.length);
    } catch {
      // best-effort; pill stays at last known count
    }
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);

  return <OpenDoubtsContext.Provider value={value}>{children}</OpenDoubtsContext.Provider>;
}

export function useOpenDoubts() {
  return useContext(OpenDoubtsContext);
}

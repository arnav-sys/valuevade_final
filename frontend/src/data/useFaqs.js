/**
 * useFaqs — fetches published FAQs from the backend on mount and caches
 * them in a module-level singleton so multiple components (accordion +
 * chatbot) don't duplicate the request. Falls back to the static
 * `FAQS` constant if the backend is unreachable.
 */
import { useEffect, useState } from 'react';
import { FAQS as STATIC_FAQS, FAQ_CATEGORIES } from './faqs';

const API = process.env.REACT_APP_BACKEND_URL;

// Module-level cache — shared across all component instances.
let _cache = null;
let _inflight = null;
const _subscribers = new Set();

async function _load() {
  try {
    const r = await fetch(`${API}/api/faqs`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const data = await r.json();
    const rows = Array.isArray(data.faqs) ? data.faqs : [];
    // If backend is set up but empty, fall back to static so users still see something.
    _cache = rows.length ? rows : STATIC_FAQS;
  } catch {
    _cache = STATIC_FAQS;
  }
  _subscribers.forEach((cb) => cb(_cache));
  return _cache;
}

export function invalidateFaqCache() {
  _cache = null;
  _inflight = null;
}

export function useFaqs() {
  const [faqs, setFaqs] = useState(_cache || STATIC_FAQS);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    let cancelled = false;
    if (_cache) {
      setFaqs(_cache);
      setLoading(false);
      return () => {};
    }
    const sub = (rows) => { if (!cancelled) { setFaqs(rows); setLoading(false); } };
    _subscribers.add(sub);
    if (!_inflight) _inflight = _load();
    _inflight.finally(() => { _inflight = null; });
    return () => { cancelled = true; _subscribers.delete(sub); };
  }, []);

  return { faqs, loading };
}

export { FAQ_CATEGORIES };

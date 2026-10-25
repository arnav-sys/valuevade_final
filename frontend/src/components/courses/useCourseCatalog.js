import { useEffect, useState } from 'react';
import { businessApi } from '../enterprise/api';

export const useCourseCatalog = () => {
  const [catalog, setCatalog] = useState({ paths: [], module_counts: {}, session_counts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    setLoading(true); setError('');
    businessApi('/courses/catalog', { signal: controller.signal })
      .then(data => { if (active) setCatalog(data); })
      .catch(e => { if (active) setError(e.name === 'AbortError' ? 'The course catalogue took too long to load. Please try again.' : e.message); })
      .finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt]);
  return { ...catalog, loading, error, retry: () => setAttempt(n => n + 1) };
};
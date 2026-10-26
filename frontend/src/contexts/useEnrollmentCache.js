import { useCallback, useEffect, useRef, useState } from 'react';
import { businessApi } from '../components/enterprise/api';
import { useLocation } from 'react-router-dom';

const PREFIX = 'vv:enrollment:v2:';
const TTL = 5 * 60 * 1000;
const read = id => {
  try {
    const entry = JSON.parse(localStorage.getItem(PREFIX + id));
    return entry?.userId === id && typeof entry.value?.is_enrolled === 'boolean' && Number.isFinite(entry.at) ? entry : null;
  } catch { return null; }
};
const clear = id => { try { localStorage.removeItem(PREFIX + id); } catch {} };
const fresh = entry => entry && Date.now() >= entry.at && Date.now() - entry.at < TTL;

/** Display-only cache: file and payment endpoints always check the current server entitlement. */
export const useEnrollmentCache = (session, authLoading) => {
  const { pathname } = useLocation();
  const uid = session?.user?.id;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState('');
  const entryRef = useRef(null);
  const requestRef = useRef(null);
  const previousUser = useRef(null);

  const refreshEnrollment = useCallback((force = true) => {
    const current = sessionRef.current;
    const userId = current?.user?.id;
    if (!userId) return Promise.resolve(null);
    if (!force && fresh(entryRef.current) && entryRef.current.userId === userId) return Promise.resolve(entryRef.current.value);
    if (requestRef.current?.userId === userId && !force) return requestRef.current.promise;
    requestRef.current?.controller.abort();
    const controller = new AbortController();
    const request = { userId, controller };
    requestRef.current = request;
    setError('');
    const timeout = setTimeout(() => controller.abort(), 25000);
    request.promise = businessApi('/me/enrollment-status', { token: current.access_token, signal: controller.signal })
      .then(value => {
        if (typeof value.is_enrolled !== 'boolean') throw new Error('Could not confirm your enrolment.');
        if (sessionRef.current?.user?.id !== userId || requestRef.current !== request) return null;
        const next = { userId, value, at: Date.now() };
        entryRef.current = next;
        setEntry(next);
        try { localStorage.setItem(PREFIX + userId, JSON.stringify(next)); } catch {}
        return value;
      })
      .catch(() => {
        if (sessionRef.current?.user?.id === userId && requestRef.current === request) setError('Could not confirm your enrolment. Please retry.');
        return null;
      })
      .finally(() => { clearTimeout(timeout); if (requestRef.current === request) requestRef.current = null; });
    return request.promise;
  }, []);

  useEffect(() => {
    if (previousUser.current && previousUser.current !== uid) {
      clear(previousUser.current);
      requestRef.current?.controller.abort();
      requestRef.current = null;
    }
    previousUser.current = uid;
    const cached = uid ? read(uid) : null;
    entryRef.current = cached;
    setEntry(cached);
    setError('');
    if (uid) refreshEnrollment(false);
    // Remove the legacy non-user-scoped gate cache.
    try { sessionStorage.removeItem('vv:enrollment-status'); } catch {}
  }, [uid, refreshEnrollment]);

  useEffect(() => {
    const onFocus = () => refreshEnrollment(false);
    const onStorage = event => {
      if (uid && event.key === PREFIX + uid) {
        const next = read(uid);
        entryRef.current = next;
        setEntry(next);
        refreshEnrollment(false);
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('storage', onStorage); };
  }, [uid, refreshEnrollment]);

  useEffect(() => () => requestRef.current?.controller.abort(), []);
  useEffect(() => { if (uid) refreshEnrollment(false); }, [pathname, uid, refreshEnrollment]);
  // Read synchronously on a restored session, before effects, without ever showing another user's value.
  const current = uid ? (entry?.userId === uid ? entry : read(uid)) : null;
  return {
    is_enrolled: current?.value.is_enrolled ?? (uid || authLoading ? null : false),
    enrollmentStatus: current?.value ?? null,
    enrollmentLoading: authLoading || (!!uid && !current && !error),
    enrollmentError: uid ? error : '',
    refreshEnrollment,
  };
};
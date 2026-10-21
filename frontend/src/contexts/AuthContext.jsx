import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const resolved = useRef(false);
  const hadSessionRef = useRef(false);
  const isReconnectingRef = useRef(false);
  const reconnectTimerRef = useRef(null);

  const done = useCallback(() => {
    if (!resolved.current) {
      resolved.current = true;
      setLoading(false);
    }
  }, []);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', userId)
        .single();
      if (!error && data) setProfile(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Safety timeout, never leave loading stuck
    const timeout = setTimeout(() => {
      if (mounted) done();
    }, 3000);

    // onAuthStateChange fires on INITIAL_SESSION and then on token changes.
    // This is the fastest path to getting the session on page load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        if (!mounted) return;
        // Detect brief lapse: had session, now null → show reconnecting banner
        if (hadSessionRef.current && !s && event !== 'SIGNED_OUT') {
          isReconnectingRef.current = true;
          setIsReconnecting(true);
        }
        // Session restored / token refreshed, hide banner after brief delay
        if (isReconnectingRef.current && s) {
          isReconnectingRef.current = false;
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => setIsReconnecting(false), 1500);
        }
        if (s) hadSessionRef.current = true;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          // Leave the Supabase auth lock before starting another client query.
          setTimeout(() => { if (mounted) fetchProfile(s.user.id); }, 0);
        } else {
          setProfile(null);
        }
        done();
      }
    );

    // Also call getSession as a fallback in case onAuthStateChange doesn't fire
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user.id);
      done();
    }).catch(() => {
      if (mounted) done();
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      subscription.unsubscribe();
    };
  }, [done, fetchProfile]);

  // Safari frequently drops cross-origin fetches on flaky networks ("Load failed",
  // "Failed to fetch", "NetworkError"). Retry transient network errors and surface
  // a friendly message so users aren't stuck on a cryptic error.
  const NETWORK_ERROR_PATTERNS = /load failed|failed to fetch|network|networkerror|timeout|abort/i;
  const isTransientNetworkError = (err) =>
    err && typeof err.message === 'string' && NETWORK_ERROR_PATTERNS.test(err.message);
  const FRIENDLY_NETWORK_MESSAGE =
    "Connection issue. Please check your internet and try again.";

  const withRetry = async (fn, { retries = 2, delayMs = 800 } = {}) => {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await fn();
        // supabase-js returns { data, error }, retry only if error is transient
        if (result?.error && isTransientNetworkError(result.error) && attempt < retries) {
          await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
          continue;
        }
        return result;
      } catch (err) {
        lastErr = err;
        if (isTransientNetworkError(err) && attempt < retries) {
          await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  };

  const signUp = async ({ email, password, fullName }) => {
    try {
      const { data, error } = await withRetry(() =>
        supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
      );
      if (error) {
        if (isTransientNetworkError(error)) {
          return { error: { ...error, message: FRIENDLY_NETWORK_MESSAGE } };
        }
        return { error };
      }
      return { data };
    } catch (err) {
      return {
        error: {
          message: isTransientNetworkError(err) ? FRIENDLY_NETWORK_MESSAGE : (err?.message || 'Sign up failed'),
        },
      };
    }
  };

  const signIn = async ({ email, password }) => {
    try {
      const { data, error } = await withRetry(() =>
        supabase.auth.signInWithPassword({ email, password })
      );
      if (error) {
        if (isTransientNetworkError(error)) {
          return { error: { ...error, message: FRIENDLY_NETWORK_MESSAGE } };
        }
        return { error };
      }
      if (data.user) await fetchProfile(data.user.id);
      return { data };
    } catch (err) {
      return {
        error: {
          message: isTransientNetworkError(err) ? FRIENDLY_NETWORK_MESSAGE : (err?.message || 'Sign in failed'),
        },
      };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const updateProfile = async (updates) => {
    if (!user?.id) return { error: new Error('Not signed in') };
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id, full_name, email')
      .single();
    if (error) return { error };
    setProfile(data);
    return { data };
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, isReconnecting, signUp, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

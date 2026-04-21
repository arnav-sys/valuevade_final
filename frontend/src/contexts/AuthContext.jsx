import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const resolved = useRef(false);

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

    // Safety timeout — never leave loading stuck
    const timeout = setTimeout(() => {
      if (mounted) done();
    }, 3000);

    // onAuthStateChange fires on INITIAL_SESSION and then on token changes.
    // This is the fastest path to getting the session on page load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        if (!mounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          // Fire profile fetch but don't block done() on it
          fetchProfile(s.user.id);
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
      subscription.unsubscribe();
    };
  }, [done, fetchProfile]);

  const signUp = async ({ email, password, fullName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error };
    return { data };
  };

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    if (data.user) await fetchProfile(data.user.id);
    return { data };
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
    <AuthContext.Provider value={{ user, profile, session, loading, signUp, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

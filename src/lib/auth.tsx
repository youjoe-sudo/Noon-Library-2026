import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string, phone: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingProfile = useRef(false);

  const fetchProfile = useCallback(async (uid: string, retries = 3) => {
    if (fetchingProfile.current) return;
    fetchingProfile.current = true;

    let lastError: string | null = null;
    for (let i = 0; i < retries; i++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (error) {
        lastError = error.message;
      } else if (data) {
        setProfile(data as Profile);
        fetchingProfile.current = false;
        return;
      }

      // Profile might not be created yet by the trigger — wait and retry
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    if (lastError) {
      console.error('Profile fetch error:', lastError);
    }
    fetchingProfile.current = false;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        setLoading(true);
        (async () => {
          await fetchProfile(newSession.user.id, 5);
          if (mounted) setLoading(false);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, username: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, phone } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      await fetchProfile(data.user.id, 5);
    }
    return { error: null };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      await fetchProfile(data.user.id, 5);
      // Check if account is disabled
      const { data: prof } = await supabase.from('profiles').select('is_disabled').eq('id', data.user.id).maybeSingle();
      if (prof?.is_disabled) {
        await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
        return { error: 'تم إيقاف هذا الحساب. يرجى التواصل مع الإدارة.' };
      }
    }
    return { error: null };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

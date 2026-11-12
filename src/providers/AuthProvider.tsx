import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { unregisterPush } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/lib/types';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const isRole = (v: unknown): v is Role => v === 'customer' || v === 'provider';

/**
 * Loads the user's profile. The role is chosen on the sign-up form and saved in the account's metadata;
 * if the profile row is missing it or doesn't exist yet, it is filled in from there — so users never
 * see the role picker after signing in.
 */
async function fetchProfile(userId: string, meta?: Record<string, unknown>): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('id, full_name, phone, role, avatar_url, bio').eq('id', userId).maybeSingle();
  const profile = (data as Profile | null) ?? null;
  const metaRole = meta?.role;

  if ((!profile || !profile.role) && isRole(metaRole)) {
    const { data: fixed } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        role: metaRole,
        full_name: profile?.full_name || (typeof meta?.full_name === 'string' ? meta.full_name : ''),
        phone: profile?.phone ?? (typeof meta?.phone === 'string' ? meta.phone : null),
      })
      .select('id, full_name, phone, role, avatar_url, bio')
      .single();
    return (fixed as Profile | null) ?? profile;
  }
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    setProfile(userId ? await fetchProfile(userId) : null);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      const p = data.session ? await fetchProfile(data.session.user.id, data.session.user.user_metadata) : null;
      if (!mounted) return;
      setSession(data.session);
      setProfile(p);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Supabase advises not awaiting other supabase calls inside this callback.
      setTimeout(async () => {
        const p = newSession ? await fetchProfile(newSession.user.id, newSession.user.user_metadata) : null;
        if (!mounted) return;
        // Session and profile change together, so screens never see "signed in but no role yet"
        // (which used to flash the role picker right after login).
        setSession(newSession);
        setProfile(p);
        setLoading(false);
      }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(
    () => loadProfile(session?.user.id),
    [loadProfile, session?.user.id],
  );

  const signOut = useCallback(async () => {
    await unregisterPush(); // while still signed in, so this phone stops getting this user's alerts
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

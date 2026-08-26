import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabaseClient';

const AuthContext = createContext(null);

async function loadProfile(authUser) {
  if (!authUser) return null;
  const { data: staff, error } = await supabase
    .from('staff')
    .select('id,auth_user_id,full_name,email,is_active,role_id,staff_role:staff_role(code,name)')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();
  if (error) throw error;
  return {
    id: authUser.id,
    staffId: staff?.id ?? null,
    email: authUser.email ?? staff?.email ?? '',
    name: staff?.full_name ?? authUser.user_metadata?.full_name ?? authUser.email ?? '',
    role: staff?.staff_role?.code?.toLowerCase() ?? authUser.user_metadata?.pms_role?.toLowerCase() ?? 'viewer',
    roleName: staff?.staff_role?.name ?? 'Viewer',
    verified: Boolean(authUser.email_confirmed_at),
    lastLogin: authUser.last_sign_in_at ?? null,
    isActive: staff?.is_active !== false,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      try { setUser(await loadProfile(session?.user ?? null)); }
      catch (error) { console.error('Unable to load staff profile:', error); setUser(null); }
      finally { setLoading(false); }
    };
    bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      try { setUser(await loadProfile(session?.user ?? null)); }
      catch (error) { console.error('Unable to load staff profile:', error); setUser(null); }
      finally { setLoading(false); }
    });
    return () => { mounted = false; subscription.subscription.unsubscribe(); };
  }, []);

  const value = useMemo(() => ({
    user, loading, isAuthed: Boolean(user),
    login: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    logout: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;

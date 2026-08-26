import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabaseClient';

const AuthContext = createContext(null);

const mapDbRoleToUiRole = (code) => {
  const role = String(code || '').toLowerCase();
  if (role === 'super_admin' || role === 'admin') return 'super_admin';
  if (role === 'manager') return 'manager';
  if (role === 'masb_team' || role === 'masbteam' || role === 'staff' || role === 'pic') return 'staff';
  if (['finance', 'sales', 'programme_pic', 'trainer', 'viewer'].includes(role)) return role;
  return 'viewer';
};

async function loadProfile(authUser) {
  if (!authUser) return null;
  const { data: staff, error } = await supabase
    .from('staff')
    .select('id,auth_user_id,full_name,email,is_active,role_id,staff_role:staff_role(code,name)')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();
  if (error) throw error;
  const dbRole = staff?.staff_role?.code ?? authUser.user_metadata?.pms_role;
  return {
    id: authUser.id,
    staffId: staff?.id ?? null,
    email: authUser.email ?? staff?.email ?? '',
    name: staff?.full_name ?? authUser.user_metadata?.full_name ?? authUser.email ?? '',
    role: mapDbRoleToUiRole(dbRole),
    roleName: staff?.staff_role?.name ?? 'Viewer',
    dbRole: String(dbRole || 'VIEWER').toUpperCase(),
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
    const load = async (session) => {
      try { if (mounted) setUser(await loadProfile(session?.user ?? null)); }
      catch (error) { console.error('Unable to load staff profile:', error); if (mounted) setUser(null); }
      finally { if (mounted) setLoading(false); }
    };
    supabase.auth.getSession().then(({ data: { session } }) => load(session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => { void load(session); });
    return () => { mounted = false; subscription.subscription.unsubscribe(); };
  }, []);

  const value = useMemo(() => ({
    user, loading, isAuthed: Boolean(user),
    login: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      return data;
    },
    logout: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;

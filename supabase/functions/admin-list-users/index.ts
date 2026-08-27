import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  Deno.env.get('APP_ORIGIN') ?? '',
  Deno.env.get('VITE_APP_ORIGIN') ?? '',
].filter(Boolean));

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
  if (allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, cors);
    const h = req.headers.get('Authorization');
    if (!h?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401, cors);
    const token = h.slice(7);
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error } = await caller.auth.getUser(token);
    if (error || !user) return json({ error: 'Invalid session' }, 401, cors);
    const { data: me } = await admin.from('staff').select('is_active,staff_role:staff_role(code)').eq('auth_user_id', user.id).maybeSingle();
    if (me?.is_active !== true || me?.staff_role?.code !== 'SUPER_ADMIN') return json({ error: 'Super Admin access required' }, 403, cors);
    const { data: users, error: userError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (userError) throw userError;
    const { data: staff } = await admin.from('staff').select('id,auth_user_id,email,full_name,is_active,role_id,staff_role:staff_role(code,name)').order('id');
    const staffByAuth = new Map((staff ?? []).map(s => [s.auth_user_id, s]));
    const rows = (users.users ?? []).map(u => {
      const s = staffByAuth.get(u.id);
      return { id: u.id, staffId: s?.id ?? null, name: s?.full_name ?? u.user_metadata?.full_name ?? u.email, email: u.email, role: s?.staff_role?.code?.toLowerCase() ?? 'viewer', roleName: s?.staff_role?.name ?? 'Viewer', verified: Boolean(u.email_confirmed_at), lastLogin: u.last_sign_in_at, isActive: s?.is_active !== false };
    });
    return json({ users: rows }, 200, cors);
  } catch {
    return json({ error: 'Request could not be completed' }, 500, cors);
  }
});
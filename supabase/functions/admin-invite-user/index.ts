import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  Deno.env.get('APP_ORIGIN') ?? '',
  Deno.env.get('VITE_APP_ORIGIN') ?? '',
].filter(Boolean));

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    const token = authHeader.slice('Bearer '.length);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: { user }, error: userError } = await caller.auth.getUser(token);
    if (userError || !user) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

    const { data: callerStaff, error: staffError } = await admin
      .from('staff')
      .select('staff_role:staff_role(code),is_active')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (staffError) throw staffError;
    if (callerStaff?.is_active !== true || callerStaff?.staff_role?.code !== 'SUPER_ADMIN') {
      return new Response(JSON.stringify({ error: 'Super Admin access required' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { name, email, role = 'MASB_TEAM' } = await req.json();
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedName = String(name ?? '').trim();
    const normalizedRole = String(role).trim().toUpperCase();
    if (!normalizedName || !normalizedEmail) return new Response(JSON.stringify({ error: 'Name and email are required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const allowedRoles = new Set(['SUPER_ADMIN', 'MASB_TEAM', 'MANAGER', 'FINANCE', 'SALES', 'PIC', 'TRAINER', 'INTERN']);
    if (!allowedRoles.has(normalizedRole)) return new Response(JSON.stringify({ error: 'Invalid PMS role' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const { data: roleRow, error: roleError } = await admin.from('staff_role').select('id,code').eq('code', normalizedRole).maybeSingle();
    if (roleError) throw roleError;
    if (!roleRow) return new Response(JSON.stringify({ error: 'Invalid PMS role' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, { data: { full_name: normalizedName } });
    if (inviteError) throw inviteError;

    const { data: staff, error: upsertError } = await admin.from('staff').upsert({
      email: normalizedEmail, full_name: normalizedName, role_id: roleRow.id, is_active: true, auth_user_id: invited.user.id,
    }, { onConflict: 'email' }).select('id,email,full_name,role_id,auth_user_id').single();
    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ staff }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Request could not be completed' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});

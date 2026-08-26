import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing authorization token');
    const token = authHeader.slice('Bearer '.length);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: { user }, error: userError } = await caller.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid session');
    const { data: callerStaff, error: staffError } = await admin.from('staff').select('role_id,staff_role:staff_role(code)').eq('auth_user_id', user.id).maybeSingle();
    if (staffError) throw staffError;
    if (!['SUPER_ADMIN','ADMIN'].includes(callerStaff?.staff_role?.code)) throw new Error('Administrator access required');

    const { name, email, role = 'STAFF' } = await req.json();
    if (!name || !email) throw new Error('name and email are required');
    const normalizedRole = String(role).toUpperCase();
    const { data: roleRow, error: roleError } = await admin.from('staff_role').select('id,code').eq('code', normalizedRole).maybeSingle();
    if (roleError) throw roleError;
    if (!roleRow) throw new Error(`Unknown PMS role: ${normalizedRole}`);

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name, pms_role: normalizedRole },
    });
    if (inviteError) throw inviteError;

    const { data: staff, error: upsertError } = await admin.from('staff').upsert({
      email, full_name: name, role_id: roleRow.id, is_active: true, auth_user_id: invited.user.id,
    }, { onConflict: 'email' }).select('id,email,full_name,role_id,auth_user_id').single();
    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ staff }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});

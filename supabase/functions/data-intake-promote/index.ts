import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN = new Set(['SUPER_ADMIN', 'ADMIN', 'DATA_ADMIN']);
const origins = () => new Set([Deno.env.get('APP_ORIGIN') ?? '', Deno.env.get('VITE_APP_ORIGIN') ?? ''].filter(Boolean));
const cors = (req: Request) => {
  const origin = req.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
  if (origins().has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
};
const out = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return out(req, { error: 'Method not allowed' }, 405);
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return out(req, { error: 'Authentication required' }, 401);
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !service) return out(req, { error: 'Service configuration unavailable' }, 500);

    const userDb = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: ue } = await userDb.auth.getUser();
    if (ue || !user) return out(req, { error: 'Authentication required' }, 401);
    const { data: me } = await userDb.from('staff')
      .select('role_id, is_active, staff_role:role_id(code)')
      .eq('auth_user_id', user.id).eq('is_active', true).maybeSingle();
    if (!me || !ADMIN.has(me.staff_role?.code)) return out(req, { error: 'Data administration access required' }, 403);

    const body = await req.json().catch(() => null);
    const changeSetId = Number(body?.change_set_id);
    if (!Number.isSafeInteger(changeSetId) || changeSetId <= 0) return out(req, { error: 'change_set_id is required' }, 400);

    const adminDb = createClient(url, service);
    const { data: changeSet, error: ce } = await adminDb.from('change_set')
      .select('id, status, approved_by, batch_id').eq('id', changeSetId).maybeSingle();
    if (ce || !changeSet) return out(req, { error: 'Change set not found' }, 404);
    if (changeSet.status !== 'APPROVED') return out(req, { error: 'Only approved change sets may be applied' }, 409);
    if (changeSet.approved_by !== user.id) return out(req, { error: 'Only the recorded approver may apply this change set' }, 403);

    const { data, error } = await adminDb.rpc('apply_change_set', { p_change_set_id: changeSetId });
    if (error) return out(req, { error: 'Change set could not be applied' }, 409);
    return out(req, data, 200);
  } catch {
    return out(req, { error: 'Request could not be completed' }, 500);
  }
});

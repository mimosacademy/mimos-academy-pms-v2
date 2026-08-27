import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([Deno.env.get('APP_ORIGIN') ?? '', Deno.env.get('VITE_APP_ORIGIN') ?? ''].filter(Boolean));
function headers(req: Request) { const origin = req.headers.get('Origin') ?? ''; const h: Record<string,string> = {'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}; if (allowedOrigins.has(origin)) h['Access-Control-Allow-Origin']=origin; return h; }
function json(body: unknown, status: number, h: Record<string,string>) { return new Response(JSON.stringify(body), { status, headers: {...h, 'Content-Type':'application/json'} }); }

Deno.serve(async req => {
 const h=headers(req); if(req.method==='OPTIONS') return new Response('ok',{headers:h});
 try {
  if(req.method!=='POST') return json({error:'Method not allowed'},405,h);
  const a=req.headers.get('Authorization'); if(!a?.startsWith('Bearer ')) return json({error:'Authentication required'},401,h);
  const token=a.slice(7), url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:ae}=await caller.auth.getUser(token); if(ae||!user) return json({error:'Invalid session'},401,h);
  const {data:me}=await admin.from('staff').select('id,is_active,staff_role:staff_role(code)').eq('auth_user_id',user.id).maybeSingle();
  if(me?.is_active !== true || me?.staff_role?.code !== 'SUPER_ADMIN') return json({error:'Super Admin access required'},403,h);
  const body=await req.json(), action=String(body?.action??'').toUpperCase();
  if(action==='APPROVE'||action==='DECLINE') {
   const requestId=Number(body?.request_id); if(!Number.isInteger(requestId)||requestId<1) return json({error:'Invalid request'},400,h);
   const {data:r,error:re}=await admin.from('user_registration_request').select('*').eq('id',requestId).eq('status','PENDING').maybeSingle(); if(re) throw re; if(!r) return json({error:'Pending request not found'},404,h);
   if(action==='DECLINE'){const {error}=await admin.from('user_registration_request').update({status:'DECLINED',reviewed_by:me.id,reviewed_at:new Date().toISOString()}).eq('id',requestId);if(error)throw error;return json({ok:true,status:'DECLINED'},200,h);}
   const {data:roleRow,error:roleError}=await admin.from('staff_role').select('id,code').eq('code',String(r.requested_role).toUpperCase()).maybeSingle(); if(roleError)throw roleError;if(!roleRow)return json({error:'Requested role is invalid'},400,h);
   const {data:existing}=await admin.from('staff').select('id,auth_user_id').ilike('email',r.email).maybeSingle(); if(existing?.auth_user_id)return json({error:'A staff account already exists for this email'},409,h);
   const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(r.email,{data:{full_name:r.full_name}});if(inviteError)throw inviteError;
   const {error:staffError}=await admin.from('staff').upsert({email:r.email,full_name:r.full_name,role_id:roleRow.id,is_active:true,auth_user_id:invited.user.id},{onConflict:'email'});if(staffError)throw staffError;
   const {error:updateError}=await admin.from('user_registration_request').update({status:'APPROVED',reviewed_by:me.id,reviewed_at:new Date().toISOString()}).eq('id',requestId);if(updateError)throw updateError;
   return json({ok:true,status:'APPROVED'},200,h);
  }
  if(action==='REMOVE') {
   const staffId=Number(body?.staff_id);if(!Number.isInteger(staffId)||staffId<1)return json({error:'Invalid staff'},400,h);if(staffId===me.id)return json({error:'You cannot remove your own administrator account'},400,h);
   const {data:target,error:te}=await admin.from('staff').select('id,auth_user_id,staff_role:staff_role(code)').eq('id',staffId).maybeSingle();if(te)throw te;if(!target)return json({error:'User not found'},404,h);
   if(target.staff_role?.code==='SUPER_ADMIN'){const {data:sr}=await admin.from('staff_role').select('id').eq('code','SUPER_ADMIN').single();const {count}=await admin.from('staff').select('id',{count:'exact',head:true}).eq('is_active',true).eq('role_id',sr.data?.id);if((count??0)<=1)return json({error:'Cannot remove the last active Super Admin'},409,h);}
   const {error:de}=await admin.from('staff').update({is_active:false,auth_user_id:null}).eq('id',staffId);if(de)throw de;if(target.auth_user_id){const {error:ue}=await admin.auth.admin.deleteUser(target.auth_user_id);if(ue)throw ue;}
   return json({ok:true,status:'REMOVED'},200,h);
  }
  return json({error:'Unsupported action'},400,h);
 } catch { return json({error:'Request could not be completed'},500,h); }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const h=req.headers.get('Authorization'); if(!h?.startsWith('Bearer '))throw new Error('Missing authorization token'); const token=h.slice(7);
  const url=Deno.env.get('SUPABASE_URL')!; const anon=Deno.env.get('SUPABASE_ANON_KEY')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!; const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}}); const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error}=await caller.auth.getUser(token); if(error||!user)throw new Error('Invalid session');
  const {data:me}=await admin.from('staff').select('staff_role:staff_role(code)').eq('auth_user_id',user.id).maybeSingle(); if(!['SUPER_ADMIN','ADMIN'].includes(me?.staff_role?.code))throw new Error('Administrator access required');
  const {data:users,error:userError}=await admin.auth.admin.listUsers({page:1,perPage:1000}); if(userError)throw userError;
  const {data:staff}=await admin.from('staff').select('id,auth_user_id,email,full_name,is_active,role_id,staff_role:staff_role(code,name)').order('id');
  const staffByAuth=new Map((staff??[]).map(s=>[s.auth_user_id,s]));
  const rows=(users.users??[]).map(u=>{const s=staffByAuth.get(u.id);return {id:u.id,staffId:s?.id??null,name:s?.full_name??u.user_metadata?.full_name??u.email,email:u.email,role:s?.staff_role?.code?.toLowerCase()??'viewer',roleName:s?.staff_role?.name??'Viewer',verified:Boolean(u.email_confirmed_at),lastLogin:u.last_sign_in_at,isActive:s?.is_active!==false};});
  return new Response(JSON.stringify({users:rows}),{headers:{...cors,'Content-Type':'application/json'}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'Unknown error'}),{status:400,headers:{...cors,'Content-Type':'application/json'}})}
});

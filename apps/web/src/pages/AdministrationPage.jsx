import React from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Check, Minus, Settings, ShieldCheck, UserCog, Users } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { NAV_SECTIONS, ROLES } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ROLE_BADGE_TONES={super_admin:'bg-violet-600 text-white',manager:'bg-violet-100 text-violet-800',finance:'bg-emerald-50 text-emerald-700',sales:'bg-blue-50 text-blue-700',programme_pic:'bg-amber-50 text-amber-700',trainer:'bg-cyan-50 text-cyan-700',viewer:'bg-slate-100 text-slate-600'};
const MODULES=NAV_SECTIONS.flatMap(s=>s.items.map(i=>({label:i.label,roles:i.roles})));
const initialsFor=u=>{const words=(u.name||u.email||'U').trim().split(/\s+/).filter(Boolean);return words.slice(0,2).map(w=>w[0]).join('').toUpperCase()||'U';};

function AddUserDialog({onCreated}){
 const [open,setOpen]=React.useState(false); const [form,setForm]=React.useState({name:'',email:'',role:'viewer'}); const [busy,setBusy]=React.useState(false);
 const submit=async e=>{e.preventDefault();setBusy(true);try{const role=String(form.role).toUpperCase()==='VIEWER'?'VIEWER':String(form.role).toUpperCase();const {data,error}=await supabase.functions.invoke('admin-invite-user',{body:{name:form.name,email:form.email,role}});if(error)throw error;if(data?.error)throw new Error(data.error);toast.success(`Invitation sent to ${form.email}.`);setOpen(false);setForm({name:'',email:'',role:'viewer'});onCreated?.();}catch(error){toast.error(error?.message||'Unable to invite user.')}finally{setBusy(false);}};
 return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="bg-violet-600 hover:bg-violet-700">Add User</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add User</DialogTitle><DialogDescription>Invite a staff member through Supabase Auth. The user will set their password from the invitation.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label>Full Name</Label><Input required value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))}/></div><div className="space-y-2"><Label>Email</Label><Input required type="email" value={form.email} onChange={e=>setForm(s=>({...s,email:e.target.value}))}/></div><div className="space-y-2"><Label>Role</Label><Select value={form.role} onValueChange={role=>setForm(s=>({...s,role}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(ROLES).map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy} type="submit" className="bg-violet-600 hover:bg-violet-700">{busy?'Sending…':'Send Invitation'}</Button></DialogFooter></form></DialogContent></Dialog>;
}

export default function AdministrationPage(){
 const [staffUsers,setStaffUsers]=React.useState([]);
 const loadUsers=React.useCallback(async()=>{try{const {data,error}=await supabase.functions.invoke('admin-list-users');if(error)throw error;if(data?.error)throw new Error(data.error);setStaffUsers(data?.users||[]);}catch(error){toast.error(error?.message||'Unable to load users.');}},[]);
 React.useEffect(()=>{loadUsers();},[loadUsers]);
 const verifiedUsers=staffUsers.filter(u=>u.verified).length;
 return <div><Helmet><title>Administration — MIMOS Academy PMS</title><meta name="description" content="System administration for MIMOS Academy PMS — user accounts, role-based access control and module permissions."/></Helmet>
  <PageHeader title="Administration" description="User accounts, roles and system access control."><AddUserDialog onCreated={loadUsers}/></PageHeader>
  <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Staff Accounts" value={staffUsers.length} icon={Users} tone="violet" hint="provisioned users"/><StatCard title="Roles Defined" value={Object.keys(ROLES).length} icon={ShieldCheck} tone="blue" hint="access profiles"/><StatCard title="Modules" value={MODULES.length} icon={Settings} tone="amber" hint="in the navigation"/><StatCard title="Verified Accounts" value={verifiedUsers} icon={UserCog} tone="emerald" hint="verified staff accounts"/></div>
  <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
   <section className="overflow-hidden rounded-xl border bg-white shadow-sm xl:col-span-3"><header className="border-b px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">User Accounts</h2><p className="mt-0.5 text-xs text-slate-400">Staff with access to the PMS</p></header><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Last Login</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y">{staffUsers.map(u=><tr key={u.id} className="hover:bg-violet-50/40"><td className="px-5 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-700">{initialsFor(u)}</div><div><p className="font-medium text-slate-800">{u.name||u.email}</p><p className="text-xs text-slate-400">{u.email}</p></div></div></td><td className="px-5 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE_TONES[u.role]||ROLE_BADGE_TONES.viewer}`}>{u.roleName||ROLES[u.role]||'Viewer'}</span></td><td className="whitespace-nowrap px-5 py-3 text-slate-500">{u.lastLogin?new Date(u.lastLogin).toLocaleString():'—'}</td><td className="px-5 py-3"><StatusBadge status={u.verified?'Active':'Pending'}/></td></tr>)}</tbody></table></div></section>
   <section className="overflow-hidden rounded-xl border bg-white shadow-sm xl:col-span-2"><header className="border-b px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Role Permission Matrix</h2><p className="mt-0.5 text-xs text-slate-400">Module access by role</p></header><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Module</th>{Object.values(ROLES).map(r=><th key={r} className="px-2 py-3 text-center" title={r}>{r.split(' ').map(w=>w[0]).join('')}</th>)}</tr></thead><tbody className="divide-y">{MODULES.map(m=><tr key={m.label} className="hover:bg-violet-50/40"><td className="whitespace-nowrap px-5 py-2.5 font-medium text-slate-700">{m.label}</td>{Object.keys(ROLES).map(roleKey=><td key={roleKey} className="px-2 py-2.5 text-center">{m.roles.includes(roleKey)?<Check className="mx-auto h-4 w-4 text-emerald-600" strokeWidth={2.2}/>:<Minus className="mx-auto h-4 w-4 text-slate-300" strokeWidth={2.2}/>}</td>)}</tr>)}</tbody></table></div><p className="border-t px-5 py-3 text-xs text-slate-400">Column headers use role initials — hover a header to see the full role name.</p></section>
  </div>
 </div>;
}

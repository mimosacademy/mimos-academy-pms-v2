import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePmsData } from '@/contexts/PmsDataContext';
import { Building2, Download, Plus, UserCheck, Users } from 'lucide-react';

const initialForm = { programme: '', client: '', name: '', email: '', company: '', phone: '', status: 'Confirmed' };

export default function ParticipantsPage() {
  const { participants, programmes, createRecord } = usePmsData();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const attending = participants.filter((p) => p.status === 'Attending').length;
  const confirmed = participants.filter((p) => p.status === 'Confirmed').length;
  const companies = new Set(participants.map((p) => p.company).filter(Boolean)).size;
  const canSubmit = useMemo(() => Boolean(form.programme && form.name.trim()), [form]);

  const saveParticipant = async (event) => {
    event.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const programme = programmes.find((p) => p.id === form.programme);
      await createRecord('participants', { ...form, client: form.client || programme?.client || undefined });
      toast.success('Participant registered.');
      setForm(initialForm);
      setShowForm(false);
    } catch (error) {
      toast.error(error?.message || 'Unable to register participant.');
    } finally { setSaving(false); }
  };

  const exportList = () => {
    const header = ['Name', 'Email', 'Company', 'Phone', 'Programme', 'Status'];
    const rows = participants.map((p) => [p.name, p.email, p.company, p.phone, p.programmeTitle, p.status]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `participants-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success('Participant list exported.');
  };

  const columns = [
    { key: 'name', label: 'Participant', render: (p) => <div className="flex min-w-48 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-700">{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div><div><p className="font-medium text-slate-800">{p.name}</p><p className="text-xs text-slate-400">{p.email}</p></div></div> },
    { key: 'company', label: 'Company', className: 'whitespace-nowrap' },
    { key: 'programmeTitle', label: 'Programme', className: 'min-w-52' },
    { key: 'phone', label: 'Phone', className: 'whitespace-nowrap text-slate-500' },
    { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <div>
      <Helmet><title>Participants — MIMOS Academy PMS</title><meta name="description" content="Participant enrolment and attendance tracking for MIMOS Academy training programmes." /></Helmet>
      <PageHeader title="Participants" description="Enrolments across all training programmes.">
        <Button variant="outline" onClick={exportList}><Download className="mr-2 h-4 w-4" /> Export List</Button>
        <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => setShowForm((v) => !v)}><Plus className="mr-2 h-4 w-4" /> Register Participant</Button>
      </PageHeader>

      {showForm && <form onSubmit={saveParticipant} className="mb-6 rounded-xl border bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium">Programme<select className="mt-1 w-full rounded-md border p-2" value={form.programme} onChange={(e) => setForm({ ...form, programme: e.target.value })} required><option value="">Select programme</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.title}</option>)}</select></label>
        <label className="text-sm font-medium">Name<Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label className="text-sm font-medium">Email<Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="text-sm font-medium">Company<Input className="mt-1" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></label>
        <label className="text-sm font-medium">Phone<Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label className="text-sm font-medium">Status<select className="mt-1 w-full rounded-md border p-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{['Confirmed','Attending','Waitlisted','Completed','Withdrawn'].map((v) => <option key={v}>{v}</option>)}</select></label>
      </div><div className="mt-4 flex gap-2"><Button type="submit" disabled={!canSubmit || saving}>{saving ? 'Saving…' : 'Save Participant'}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button></div></form>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Total Participants" value={participants.length} icon={Users} tone="violet" hint="on record" /><StatCard title="Attending" value={attending} icon={UserCheck} tone="blue" hint="in active sessions" /><StatCard title="Confirmed" value={confirmed} icon={UserCheck} tone="emerald" hint="for upcoming sessions" /><StatCard title="Companies" value={companies} icon={Building2} tone="amber" hint="represented" /></div>
      <DataTable columns={columns} data={participants} searchKeys={['name', 'email', 'company', 'programmeTitle']} searchPlaceholder="Search participants…" filters={[{ key: 'status', label: 'Status', options: ['Confirmed', 'Attending', 'Completed', 'Waitlisted', 'Withdrawn'] }, { key: 'programmeTitle', label: 'Programme', options: [...new Set(participants.map((p) => p.programmeTitle).filter(Boolean))] }]} emptyTitle="No participants found" emptyDescription="No participants match your current search or filters." />
    </div>
  );
}

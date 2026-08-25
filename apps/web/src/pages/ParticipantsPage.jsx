import React from 'react';
import { Helmet } from 'react-helmet';
import EntityDialog from '@/components/EntityDialog';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { usePmsData } from '@/contexts/PmsDataContext';
import { Building2, UserCheck, Users } from 'lucide-react';

export default function ParticipantsPage() {
  const { participants } = usePmsData();
  const attending = participants.filter((p) => p.status === 'Attending').length;
  const confirmed = participants.filter((p) => p.status === 'Confirmed').length;
  const companies = new Set(participants.map((p) => p.company).filter(Boolean)).size;
  const columns = [
    { key: 'name', label: 'Participant', render: (p) => <div className="flex min-w-48 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-700">{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div><div><p className="font-medium text-slate-800">{p.name}</p><p className="text-xs text-slate-400">{p.email}</p></div></div> },
    { key: 'company', label: 'Company', className: 'whitespace-nowrap' }, { key: 'programmeTitle', label: 'Programme', className: 'min-w-52' }, { key: 'phone', label: 'Phone', className: 'whitespace-nowrap text-slate-500' }, { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
  ];
  return <div>
    <Helmet><title>Participants — MIMOS Academy PMS</title><meta name="description" content="Participant enrolment and attendance tracking for MIMOS Academy training programmes." /></Helmet>
    <PageHeader title="Participants" description="Enrolments across all training programmes.">
      <EntityDialog collection="participants" title="Register Participant" description="Register a participant against a programme." triggerLabel="Register Participant" fields={[
        { name: 'programme', label: 'Programme', type: 'relation', relation: 'programmes', required: true }, { name: 'name', label: 'Participant Name', required: true }, { name: 'email', label: 'Email', type: 'email' }, { name: 'company', label: 'Company' }, { name: 'phone', label: 'Phone' },
        { name: 'status', label: 'Status', type: 'select', options: [{ value: 'Confirmed', label: 'Confirmed' }, { value: 'Attending', label: 'Attending' }, { value: 'Waitlisted', label: 'Waitlisted' }, { value: 'Completed', label: 'Completed' }, { value: 'Withdrawn', label: 'Withdrawn' }] },
      ]} />
    </PageHeader>
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Total Participants" value={participants.length} icon={Users} tone="violet" hint="on record" /><StatCard title="Attending" value={attending} icon={UserCheck} tone="blue" hint="in active sessions" /><StatCard title="Confirmed" value={confirmed} icon={UserCheck} tone="emerald" hint="upcoming sessions" /><StatCard title="Companies" value={companies} icon={Building2} tone="amber" hint="represented" /></div>
    <DataTable columns={columns} data={participants} searchKeys={['name', 'email', 'company', 'programmeTitle']} searchPlaceholder="Search participants…" filters={[{ key: 'status', label: 'Status', options: ['Confirmed', 'Attending', 'Completed', 'Waitlisted', 'Withdrawn'] }]} emptyTitle="No participants found" emptyDescription="No participants match your current search or filters." />
  </div>;
}

import React from 'react';
import { Helmet } from 'react-helmet';
import EntityDialog from '@/components/EntityDialog';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { usePmsData } from '@/contexts/PmsDataContext';
import { CalendarCheck, CalendarClock, UserCheck, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/format';

export default function TrainingPage() {
  const { trainingSessions } = usePmsData();
  const scheduled = trainingSessions.filter((t) => t.status === 'Scheduled').length;
  const completed = trainingSessions.filter((t) => t.status === 'Completed').length;
  const cancelled = trainingSessions.filter((t) => t.status === 'Cancelled').length;
  const trainers = new Set(trainingSessions.map((t) => t.trainer).filter(Boolean)).size;
  const columns = [
    { key: 'title', label: 'Session', render: (t) => <div className="min-w-56"><p className="font-medium text-slate-800">{t.title}</p><p className="text-xs text-slate-400">{t.programme} · {t.programmeCode}</p></div> },
    { key: 'date', label: 'Date', className: 'whitespace-nowrap text-slate-500', render: (t) => formatDate(t.date) },
    { key: 'time', label: 'Time', className: 'whitespace-nowrap text-slate-500' }, { key: 'trainer', label: 'Trainer', className: 'whitespace-nowrap' }, { key: 'venue', label: 'Venue', className: 'whitespace-nowrap text-slate-500' },
    { key: 'mode', label: 'Mode', render: (t) => <StatusBadge status={t.mode} /> }, { key: 'status', label: 'Status', render: (t) => <StatusBadge status={t.status} /> },
  ];
  return <div>
    <Helmet><title>Training Delivery — MIMOS Academy PMS</title><meta name="description" content="Training session scheduling and delivery for MIMOS Academy programmes." /></Helmet>
    <PageHeader title="Training Delivery" description="Schedule and track training sessions under each secured programme.">
      <EntityDialog collection="training_delivery" title="Schedule Session" description="Create a training delivery session linked to a programme." triggerLabel="Schedule Session" fields={[
        { name: 'programme', label: 'Programme', type: 'relation', relation: 'programmes', required: true }, { name: 'title', label: 'Session Title', required: true, full: true },
        { name: 'date', label: 'Date', type: 'date' }, { name: 'time', label: 'Time' }, { name: 'trainer', label: 'Trainer' }, { name: 'venue', label: 'Venue' },
        { name: 'mode', label: 'Mode', type: 'select', options: [{ value: 'In-Person', label: 'In-Person' }, { value: 'Virtual', label: 'Virtual' }, { value: 'Hybrid', label: 'Hybrid' }] },
        { name: 'status', label: 'Status', type: 'select', options: [{ value: 'Scheduled', label: 'Scheduled' }, { value: 'Completed', label: 'Completed' }, { value: 'Cancelled', label: 'Cancelled' }] },
      ]} />
    </PageHeader>
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Scheduled Sessions" value={scheduled} icon={CalendarClock} tone="violet" hint="upcoming deliveries" /><StatCard title="Completed" value={completed} icon={CalendarCheck} tone="emerald" hint="delivered sessions" /><StatCard title="Active Trainers" value={trainers} icon={UserCheck} tone="blue" hint="assigned to sessions" /><StatCard title="Cancelled" value={cancelled} icon={XCircle} tone="red" hint="requires rescheduling" /></div>
    <DataTable columns={columns} data={trainingSessions} searchKeys={['title', 'programme', 'programmeCode', 'trainer', 'venue']} searchPlaceholder="Search sessions…" filters={[{ key: 'status', label: 'Status', options: ['Scheduled', 'Completed', 'Cancelled'] }, { key: 'mode', label: 'Mode', options: ['In-Person', 'Virtual', 'Hybrid'] }]} emptyTitle="No sessions found" emptyDescription="No training sessions match your current search or filters." />
  </div>;
}

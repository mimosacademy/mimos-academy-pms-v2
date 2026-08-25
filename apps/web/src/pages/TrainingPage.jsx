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
import { formatDate } from '@/lib/format';
import { CalendarCheck, CalendarClock, Plus, UserCheck, XCircle } from 'lucide-react';

export default function TrainingPage() {
  const { trainingSessions, programmes, createRecord } = usePmsData();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ programme: '', title: '', date: '', time: '', trainer: '', venue: '', mode: 'In-Person', status: 'Scheduled' });

  const scheduled = trainingSessions.filter((t) => t.status === 'Scheduled').length;
  const completed = trainingSessions.filter((t) => t.status === 'Completed').length;
  const cancelled = trainingSessions.filter((t) => t.status === 'Cancelled').length;
  const trainers = new Set(trainingSessions.map((t) => t.trainer).filter(Boolean)).size;

  const canSubmit = useMemo(() => Boolean(form.programme && form.title.trim()), [form]);

  const saveSession = async (event) => {
    event.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      await createRecord('training_delivery', form);
      toast.success('Training session scheduled.');
      setForm({ programme: '', title: '', date: '', time: '', trainer: '', venue: '', mode: 'In-Person', status: 'Scheduled' });
      setShowForm(false);
    } catch (error) {
      toast.error(error?.message || 'Unable to schedule the session.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'title', label: 'Session', render: (t) => <div className="min-w-56"><p className="font-medium text-slate-800">{t.title}</p><p className="text-xs text-slate-400">{t.programme} · {t.programmeCode}</p></div> },
    { key: 'date', label: 'Date', className: 'whitespace-nowrap text-slate-500', render: (t) => formatDate(t.date) },
    { key: 'time', label: 'Time', className: 'whitespace-nowrap text-slate-500' },
    { key: 'trainer', label: 'Trainer', className: 'whitespace-nowrap' },
    { key: 'venue', label: 'Venue', className: 'whitespace-nowrap text-slate-500' },
    { key: 'mode', label: 'Mode', render: (t) => <StatusBadge status={t.mode} /> },
    { key: 'status', label: 'Status', render: (t) => <StatusBadge status={t.status} /> },
  ];

  return (
    <div>
      <Helmet><title>Training Delivery — MIMOS Academy PMS</title><meta name="description" content="Training session scheduling for MIMOS Academy." /></Helmet>
      <PageHeader title="Training Delivery" description="Session delivery under each secured programme.">
        <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => setShowForm((v) => !v)}><Plus className="mr-2 h-4 w-4" /> Schedule Session</Button>
      </PageHeader>

      {showForm && (
        <form onSubmit={saveSession} className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium">Programme<select className="mt-1 w-full rounded-md border p-2" value={form.programme} onChange={(e) => setForm({ ...form, programme: e.target.value })} required><option value="">Select programme</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.title}</option>)}</select></label>
            <label className="text-sm font-medium">Session title<Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
            <label className="text-sm font-medium">Date<Input className="mt-1" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="text-sm font-medium">Time<Input className="mt-1" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} placeholder="09:00–17:00" /></label>
            <label className="text-sm font-medium">Trainer<Input className="mt-1" value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} /></label>
            <label className="text-sm font-medium">Venue<Input className="mt-1" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></label>
            <label className="text-sm font-medium">Mode<select className="mt-1 w-full rounded-md border p-2" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>{['In-Person', 'Virtual', 'Hybrid'].map((v) => <option key={v}>{v}</option>)}</select></label>
          </div>
          <div className="mt-4 flex gap-2"><Button type="submit" disabled={!canSubmit || saving}>{saving ? 'Saving…' : 'Save Session'}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button></div>
        </form>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Scheduled Sessions" value={scheduled} icon={CalendarClock} tone="violet" hint="upcoming deliveries" />
        <StatCard title="Completed" value={completed} icon={CalendarCheck} tone="emerald" hint="completed deliveries" />
        <StatCard title="Active Trainers" value={trainers} icon={UserCheck} tone="blue" hint="assigned trainers" />
        <StatCard title="Cancelled" value={cancelled} icon={XCircle} tone="red" hint="requires rescheduling" />
      </div>
      <DataTable columns={columns} data={trainingSessions} searchKeys={['title', 'programme', 'programmeCode', 'trainer', 'venue']} searchPlaceholder="Search sessions…" filters={[{ key: 'status', label: 'Status', options: ['Scheduled', 'Completed', 'Cancelled'] }, { key: 'mode', label: 'Mode', options: ['In-Person', 'Virtual', 'Hybrid'] }]} emptyTitle="No sessions found" emptyDescription="No training sessions match your current search or filters." />
    </div>
  );
}

import React from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import EntityDialog from '@/components/EntityDialog';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { usePmsData } from '@/contexts/PmsDataContext';
import { Building2, Download, UserCheck, Users } from 'lucide-react';

const demoAction = () => toast.info('Export is available after data is loaded.');

export default function ClientsPage() {
  const { clients } = usePmsData();
  const active = clients.filter((c) => c.status === 'Active').length;
  const prospects = clients.filter((c) => c.status === 'Prospect').length;
  const industries = new Set(clients.map((c) => c.industry).filter(Boolean)).size;

  const columns = [
    { key: 'name', label: 'Client', render: (c) => <div className="flex min-w-52 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-xs font-bold text-violet-700">{c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div><div><p className="font-medium text-slate-800">{c.name}</p><p className="text-xs text-slate-400">{c.location} · since {c.since}</p></div></div> },
    { key: 'industry', label: 'Industry', className: 'whitespace-nowrap' },
    { key: 'contactPerson', label: 'Contact Person', className: 'whitespace-nowrap' },
    { key: 'email', label: 'Email', className: 'whitespace-nowrap text-slate-500' },
    { key: 'phone', label: 'Phone', className: 'whitespace-nowrap text-slate-500' },
    { key: 'status', label: 'Status', render: (c) => <StatusBadge status={c.status} /> },
  ];

  return <div>
    <Helmet><title>Clients — MIMOS Academy PMS</title><meta name="description" content="Client directory and engagement records for MIMOS Academy corporate training accounts." /></Helmet>
    <PageHeader title="Clients" description="Corporate client accounts and key contacts.">
      <Button variant="outline" onClick={demoAction}><Download className="mr-2 h-4 w-4" /> Export</Button>
      <EntityDialog collection="clients" title="Add Client" description="Create a client account for MIMOS Academy." triggerLabel="Add Client" fields={[
        { name: 'name', label: 'Client Name', required: true }, { name: 'industry', label: 'Industry' }, { name: 'contactPerson', label: 'Contact Person' },
        { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone' }, { name: 'location', label: 'Location' },
        { name: 'status', label: 'Status', type: 'select', options: [{ value: 'Active', label: 'Active' }, { value: 'Prospect', label: 'Prospect' }, { value: 'Inactive', label: 'Inactive' }] },
        { name: 'since', label: 'Since', placeholder: '2026' },
      ]} />
    </PageHeader>
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard title="Total Clients" value={clients.length} icon={Building2} tone="violet" hint="on record" />
      <StatCard title="Active Accounts" value={active} icon={UserCheck} tone="emerald" hint="with engagements" />
      <StatCard title="Prospects" value={prospects} icon={Users} tone="amber" hint="in qualification" />
      <StatCard title="Industries" value={industries} icon={Building2} tone="blue" hint="sectors covered" />
    </div>
    <DataTable columns={columns} data={clients} searchKeys={['name', 'contactPerson', 'email', 'industry']} searchPlaceholder="Search clients…" filters={[
      { key: 'status', label: 'Status', options: ['Active', 'Prospect', 'Inactive'] },
      { key: 'industry', label: 'Industry', options: [...new Set(clients.map((c) => c.industry).filter(Boolean))] },
    ]} emptyTitle="No clients found" emptyDescription="No client accounts match your current search or filters." />
  </div>;
}

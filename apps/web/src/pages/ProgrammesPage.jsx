import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import EntityDialog from '@/components/EntityDialog';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ExternalLink } from 'lucide-react';
import {
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Plus,
} from 'lucide-react';
import { usePmsData } from '@/contexts/PmsDataContext';
import { formatDate, formatRM, formatRMCompact } from '@/lib/format';



export default function ProgrammesPage() {
  const { programmes } = usePmsData();

  const inProgress = programmes.filter((p) => p.status === 'In Progress').length;
  const scheduled = programmes.filter((p) => p.status === 'Scheduled').length;
  const totalParticipants = programmes.reduce((s, p) => s + p.participants, 0);
  const orderBook = programmes.reduce((s, p) => s + (p.contractValue || 0), 0);

  const columns = [
    { key: 'code', label: 'Code', className: 'font-medium text-violet-700 whitespace-nowrap' },
    {
      key: 'title',
      label: 'Programme',
      render: (p) => (
        <div className="min-w-52">
          <p className="font-medium text-slate-800">{p.title}</p>
          <p className="text-xs text-slate-400">{p.category}</p>
        </div>
      ),
    },
    { key: 'clientName', label: 'Client', className: 'whitespace-nowrap' },
    {
      key: 'contractValue',
      label: 'Contract',
      className: 'whitespace-nowrap font-medium',
      render: (p) => formatRM(p.contractValue),
    },
    {
      key: 'startDate',
      label: 'Schedule',
      className: 'whitespace-nowrap text-slate-500',
      render: (p) => `${formatDate(p.startDate)} – ${formatDate(p.endDate)}`,
    },
    { key: 'pic', label: 'PIC', className: 'whitespace-nowrap' },
    { key: 'participants', label: 'Pax', className: 'text-center' },
    {
      key: 'progress',
      label: 'Completeness',
      render: (p) => (
        <div className="flex w-28 items-center gap-2">
          <Progress value={p.progress} className="h-2 bg-slate-100 [&>div]:bg-violet-600" />
          <span className="text-xs font-medium text-slate-500">{p.progress}%</span>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    {
      key: 'hub',
      label: '',
      render: (p) => (
        <Button asChild variant="ghost" size="sm" className="text-violet-700">
          <Link to={`/programmes/${p.id}`}>
            Open Hub <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Helmet>
        <title>Programmes — MIMOS Academy PMS</title>
        <meta
          name="description"
          content="Central programme hub for MIMOS Academy — every opportunity, PO, delivery and collection links here."
        />
      </Helmet>

      <PageHeader
        title="Programmes"
        description="The central business entity — every opportunity, PO, delivery and collection links here. Open a programme hub to see the full relationship chain."
      >
        <Button variant="outline" onClick={demoAction}>
          <CalendarRange className="mr-2 h-4 w-4" /> Export Schedule
        </Button>
        <EntityDialog
          collection="programmes"
          title="New Programme"
          description="Register a new programme and assign its initial delivery status."
          triggerLabel="New Programme"
          fields={[
            { name: 'client', label: 'Client', type: 'relation', relation: 'clients', required: true },
            { name: 'code', label: 'Programme Code', required: true },
            { name: 'title', label: 'Programme Title', required: true, full: true },
            { name: 'category', label: 'Category' },
            { name: 'programmeCategory', label: 'Programme Type', type: 'select', options: [
              { value: 'In-House', label: 'In-House' }, { value: 'Public', label: 'Public' }, { value: 'Workshop', label: 'Workshop' }
            ] },
            { name: 'startDate', label: 'Start Date', type: 'date' },
            { name: 'endDate', label: 'End Date', type: 'date' },
            { name: 'venue', label: 'Venue' },
            { name: 'pic', label: 'Programme PIC' },
            { name: 'trainer', label: 'Trainer' },
            { name: 'status', label: 'Status', type: 'select', options: [
              { value: 'Scheduled', label: 'Scheduled' }, { value: 'In Progress', label: 'In Progress' }, { value: 'Completed', label: 'Completed' }, { value: 'On Hold', label: 'On Hold' }
            ] },
            { name: 'participants', label: 'Participants', type: 'number', min: 0 },
            { name: 'progress', label: 'Progress (%)', type: 'number', min: 0, max: 100 },
            { name: 'contractValue', label: 'Contract Value (RM)', type: 'number', min: 0, step: '0.01' },
            { name: 'accountManager', label: 'Account Manager' },
            { name: 'sessionsPlanned', label: 'Sessions Planned', type: 'number', min: 0 },
            { name: 'sessionsDelivered', label: 'Sessions Delivered', type: 'number', min: 0 }
          ]}
        />
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Programmes" value={programmes.length} icon={GraduationCap} tone="violet" hint="active portfolio" />
        <StatCard title="In Delivery" value={inProgress} icon={CalendarRange} tone="blue" hint="currently delivering" />
        <StatCard title="Scheduled" value={scheduled} icon={CheckCircle2} tone="amber" hint="starting soon" />
        <StatCard title="Order Book Value" value={formatRMCompact(orderBook)} icon={ClipboardList} tone="emerald" hint={`${totalParticipants} participants enrolled`} />
      </div>

      <DataTable
        columns={columns}
        data={programmes}
        searchKeys={['title', 'code', 'clientName', 'trainer', 'pic']}
        searchPlaceholder="Search programmes…"
        filters={[
          { key: 'status', label: 'Status', options: ['Scheduled', 'In Progress', 'Completed', 'On Hold'] },
          { key: 'category', label: 'Category', options: ['AI & Data', 'Cybersecurity', 'Cloud', 'Leadership', 'Emerging Tech'] },
        ]}
        emptyTitle="No programmes found"
        emptyDescription="No programmes match your current search or filters."
      />
    </div>
  );
}

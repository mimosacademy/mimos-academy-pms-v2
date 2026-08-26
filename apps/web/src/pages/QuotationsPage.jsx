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
import { formatDate, formatRM, formatRMCompact, decimalAdd } from '@/lib/format';
import { CheckCircle2, FileText, Plus, Send } from 'lucide-react';

export default function QuotationsPage() {
  const { quotations } = usePmsData();
  const sent = quotations.filter((q) => q.status === 'Sent').length;
  const accepted = quotations.filter((q) => q.status === 'Accepted').length;
  const totalValue = quotations.reduce((total, q) => decimalAdd(total, q.amount), '0.00');
  const columns = [
    { key: 'quoteNo', label: 'Quote No.', className: 'whitespace-nowrap font-medium text-violet-700' },
    { key: 'clientName', label: 'Client', className: 'whitespace-nowrap' },
    { key: 'programme', label: 'Programme', render: (q) => <div className="min-w-52"><p className="font-medium text-slate-800">{q.programme}</p><p className="text-xs text-slate-400">{q.programmeCode || '—'}</p></div> },
    { key: 'amount', label: 'Amount', className: 'whitespace-nowrap font-medium', render: (q) => formatRM(q.amount) },
    { key: 'issueDate', label: 'Issued', className: 'whitespace-nowrap text-slate-500', render: (q) => formatDate(q.issueDate) },
    { key: 'validUntil', label: 'Valid Until', className: 'whitespace-nowrap text-slate-500', render: (q) => formatDate(q.validUntil) },
    { key: 'preparedBy', label: 'Prepared By', className: 'whitespace-nowrap' },
    { key: 'status', label: 'Status', render: (q) => <StatusBadge status={q.status} /> },
  ];
  return (
    <div>
      <Helmet><title>Quotations — MIMOS Academy PMS</title><meta name="description" content="Quotation management for MIMOS Academy training programmes — drafts, sent, accepted and expired quotes." /></Helmet>
      <PageHeader title="Quotations" description="Programme pricing after opportunity — precedes client purchase order.">
        <EntityDialog collection="quotations" title="New Quotation" description="Create a quotation linked to a client and programme." triggerLabel="New Quotation" fields={[
          { name: 'client', label: 'Client', type: 'relation', relation: 'clients', required: true }, { name: 'programme', label: 'Programme', type: 'relation', relation: 'programmes' }, { name: 'opportunity', label: 'Opportunity', type: 'relation', relation: 'opportunities' }, { name: 'quoteNo', label: 'Quotation No.', required: true }, { name: 'revision', label: 'Revision' },
          { name: 'quotationType', label: 'Quotation Type', type: 'select', options: [{ value: 'Training', label: 'Training' }, { value: 'Space Rental', label: 'Space Rental' }, { value: 'Consultancy', label: 'Consultancy' }, { value: 'Service', label: 'Service' }] },
          { name: 'amount', label: 'Amount (RM)', type: 'number', min: 0, step: '0.01', required: true }, { name: 'sstAmount', label: 'SST (RM)', type: 'number', min: 0, step: '0.01' }, { name: 'finalPrice', label: 'Final Price (RM)', type: 'number', min: 0, step: '0.01' },
          { name: 'status', label: 'Status', type: 'select', options: [{ value: 'Draft', label: 'Draft' }, { value: 'Sent', label: 'Sent' }, { value: 'Accepted', label: 'Accepted' }, { value: 'Rejected', label: 'Rejected' }, { value: 'Expired', label: 'Expired' }] },
          { name: 'issueDate', label: 'Issue Date', type: 'date' }, { name: 'validUntil', label: 'Valid Until', type: 'date' }, { name: 'preparedBy', label: 'Prepared By' }, { name: 'accountManager', label: 'Account Manager' }, { name: 'pic', label: 'PIC' }, { name: 'programmeTitle', label: 'Programme Title', full: true }, { name: 'programmeCode', label: 'Programme Code' }
        ]} />
      </PageHeader>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Quotations" value={quotations.length} icon={FileText} tone="violet" hint="issued YTD" />
        <StatCard title="Awaiting Response" value={sent} icon={Send} tone="blue" hint="sent to clients" />
        <StatCard title="Accepted" value={accepted} icon={CheckCircle2} tone="emerald" hint="converted to sales" />
        <StatCard title="Total Quoted Value" value={formatRMCompact(totalValue)} icon={FileText} tone="amber" hint="across all quotations" />
      </div>
      <DataTable columns={columns} data={quotations} searchKeys={['quoteNo', 'clientName', 'programme', 'preparedBy']} searchPlaceholder="Search quotations…" filters={[{ key: 'status', label: 'Status', options: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'] }]} emptyTitle="No quotations found" emptyDescription="No quotations match your current search or filters." />
    </div>
  );
}

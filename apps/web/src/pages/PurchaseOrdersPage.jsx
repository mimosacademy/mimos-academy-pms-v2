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
import { formatDate, formatRM, formatRMCompact } from '@/lib/format';
import { CheckCircle2, ClipboardList, Hourglass, Plus, Wallet } from 'lucide-react';



export default function PurchaseOrdersPage() {
  const { purchaseOrders, securedOrderBook } = usePmsData();

  const confirmed = purchaseOrders.filter((p) => p.status === 'Confirmed').length;
  const pending = purchaseOrders.filter((p) => p.status === 'Pending').length;
  const totalValue = purchaseOrders.reduce((s, p) => s + p.amount, 0);

  const columns = [
    { key: 'poNo', label: 'PO No.', className: 'whitespace-nowrap font-medium text-violet-700' },
    { key: 'clientName', label: 'Client', className: 'whitespace-nowrap' },
    {
      key: 'programmeTitle',
      label: 'Programme',
      render: (p) => (
        <div className="min-w-52">
          <p className="font-medium text-slate-800">{p.programmeTitle}</p>
          <p className="text-xs text-slate-400">{p.programmeCode}</p>
        </div>
      ),
    },
    { key: 'amount', label: 'Amount', className: 'whitespace-nowrap font-medium', render: (p) => formatRM(p.amount) },
    { key: 'issueDate', label: 'Issued', className: 'whitespace-nowrap text-slate-500', render: (p) => formatDate(p.issueDate) },
    {
      key: 'receivedDate',
      label: 'Received',
      className: 'whitespace-nowrap text-slate-500',
      render: (p) => (p.receivedDate ? formatDate(p.receivedDate) : '—'),
    },
    { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <div>
      <Helmet>
        <title>Purchase Orders — MIMOS Academy PMS</title>
        <meta
          name="description"
          content="Client purchase orders securing programme delivery for MIMOS Academy — confirmed order book and pending POs."
        />
      </Helmet>

      <PageHeader
        title="Purchase Orders"
        description="Client POs that secure programmes after quotation acceptance — next step before delivery."
      >
        <EntityDialog
          collection="purchase_orders"
          title="Record Purchase Order"
          description="Record a client PO and link it to the relevant quotation and programme."
          triggerLabel="Record PO"
          fields={[
            { name: 'client', label: 'Client', type: 'relation', relation: 'clients', required: true },
            { name: 'programme', label: 'Programme', type: 'relation', relation: 'programmes' },
            { name: 'quotation', label: 'Quotation', type: 'relation', relation: 'quotations' },
            { name: 'poNo', label: 'PO No.', required: true },
            { name: 'amount', label: 'PO Amount (RM)', type: 'number', min: 0, step: '0.01', required: true },
            { name: 'status', label: 'Status', type: 'select', options: [
              { value: 'Pending', label: 'Pending' }, { value: 'Confirmed', label: 'Confirmed' }, { value: 'Closed', label: 'Closed' }, { value: 'On Hold', label: 'On Hold' }
            ] },
            { name: 'issueDate', label: 'Issue Date', type: 'date' },
            { name: 'receivedDate', label: 'Received Date', type: 'date' }
          ]}
        />
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total POs" value={purchaseOrders.length} icon={ClipboardList} tone="violet" hint="on record" />
        <StatCard title="Confirmed" value={confirmed} icon={CheckCircle2} tone="emerald" hint="in order book" />
        <StatCard title="Pending" value={pending} icon={Hourglass} tone="amber" hint="awaiting confirmation" />
        <StatCard title="Secured Order Book" value={formatRMCompact(securedOrderBook)} icon={Wallet} tone="blue" hint={`of ${formatRMCompact(totalValue)} total PO value`} />
      </div>

      <DataTable
        columns={columns}
        data={purchaseOrders}
        searchKeys={['poNo', 'clientName', 'programmeTitle', 'programmeCode']}
        searchPlaceholder="Search purchase orders…"
        filters={[{ key: 'status', label: 'Status', options: ['Confirmed', 'Pending', 'Closed', 'On Hold'] }]}
        emptyTitle="No purchase orders found"
        emptyDescription="No purchase orders match your current search or filters."
      />
    </div>
  );
}

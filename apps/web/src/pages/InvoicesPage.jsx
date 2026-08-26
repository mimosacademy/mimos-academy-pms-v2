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
import { formatDate, formatRM, formatRMCompact, decimalCompare, decimalSubtract, decimalToNumberForDisplay } from '@/lib/format';
import { AlarmClock, HandCoins, Hourglass, Plus, Receipt } from 'lucide-react';

export default function InvoicesPage() {
  const { invoices, totals } = usePmsData();

  const overdueCount = invoices.filter((i) => i.status === 'Overdue').length;
  const collectionRate = decimalCompare(totals.revenue, '0') === 0
    ? 0
    : (decimalToNumberForDisplay(totals.collected) / decimalToNumberForDisplay(totals.revenue)) * 100;

  const columns = [
    { key: 'invoiceNo', label: 'Invoice No.', className: 'whitespace-nowrap font-medium text-violet-700' },
    { key: 'clientName', label: 'Client', className: 'whitespace-nowrap' },
    { key: 'programmeCode', label: 'Programme', className: 'whitespace-nowrap font-medium text-violet-700' },
    { key: 'description', label: 'Description', className: 'min-w-56 text-slate-500' },
    { key: 'amount', label: 'Amount', className: 'whitespace-nowrap font-medium', render: (i) => formatRM(i.amount) },
    { key: 'paidAmount', label: 'Paid', className: 'whitespace-nowrap text-emerald-700', render: (i) => formatRM(i.paidAmount) },
    {
      key: 'balance',
      label: 'Balance',
      className: 'whitespace-nowrap font-medium',
      render: (i) => {
        const balance = decimalSubtract(i.amount, i.paidAmount);
        return <span className={decimalCompare(balance, '0') > 0 ? 'text-red-600' : 'text-slate-400'}>{formatRM(balance)}</span>;
      },
    },
    { key: 'issueDate', label: 'Issued', className: 'whitespace-nowrap text-slate-500', render: (i) => formatDate(i.issueDate) },
    { key: 'dueDate', label: 'Due', className: 'whitespace-nowrap text-slate-500', render: (i) => formatDate(i.dueDate) },
    { key: 'status', label: 'Status', render: (i) => <StatusBadge status={i.status} /> },
  ];

  return (
    <div>
      <Helmet>
        <title>Invoices — MIMOS Academy PMS</title>
        <meta name="description" content="Invoice tracking for MIMOS Academy — billed amounts, balances, due dates and overdue follow-up." />
      </Helmet>

      <PageHeader title="Invoices" description="Programme billing after training delivery milestones.">
        <EntityDialog
          collection="invoices"
          title="New Invoice"
          description="Record an invoice and its collection status."
          triggerLabel="New Invoice"
          fields={[
            { name: 'programme', label: 'Programme', type: 'relation', relation: 'programmes', required: true },
            { name: 'client', label: 'Client', type: 'relation', relation: 'clients', required: true },
            { name: 'invoiceNo', label: 'Invoice No.', required: true },
            { name: 'description', label: 'Description', full: true },
            { name: 'amountExcludingSST', label: 'Amount Excl. SST (RM)', type: 'number', min: 0, step: '0.01' },
            { name: 'sstAmount', label: 'SST (RM)', type: 'number', min: 0, step: '0.01' },
            { name: 'totalAmount', label: 'Total Amount (RM)', type: 'number', min: 0, step: '0.01', required: true },
            { name: 'collectionAmount', label: 'Collection (RM)', type: 'number', min: 0, step: '0.01' },
            { name: 'paymentStatus', label: 'Payment Status', type: 'select', options: [
              { value: 'PAID', label: 'PAID' }, { value: 'UNPAID', label: 'UNPAID' }
            ] },
            { name: 'paymentMethod', label: 'Payment Method', type: 'select', options: [
              { value: 'HRDCorp Claimable', label: 'HRDCorp Claimable' }, { value: 'Self-Pay', label: 'Self-Pay' }, { value: 'ePerolehan', label: 'ePerolehan' }
            ] },
            { name: 'invoiceDate', label: 'Invoice Date', type: 'date' },
            { name: 'dueDate', label: 'Due Date', type: 'date' },
            { name: 'paymentDate', label: 'Payment Date', type: 'date' },
            { name: 'quotationReference', label: 'Quotation Reference' },
            { name: 'poReference', label: 'PO Reference' },
            { name: 'accountManager', label: 'Account Manager' },
            { name: 'pic', label: 'PIC' }
          ]}
        />
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Invoiced" value={formatRMCompact(totals.revenue)} icon={Receipt} tone="violet" hint={`${invoices.length} invoices issued`} />
        <StatCard title="Collected" value={formatRMCompact(totals.collected)} icon={HandCoins} tone="emerald" hint={`${Math.round(collectionRate)}% collection rate`} />
        <StatCard title="Outstanding" value={formatRMCompact(totals.outstanding)} icon={Hourglass} tone="amber" hint="awaiting payment" />
        <StatCard title="Overdue" value={formatRMCompact(totals.overdue)} icon={AlarmClock} tone="red" delta={`${overdueCount} invoices`} deltaDirection="down" hint="past due date" />
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        searchKeys={['invoiceNo', 'clientName', 'description']}
        searchPlaceholder="Search invoices…"
        filters={[
          { key: 'status', label: 'Status', options: ['Paid', 'Partial', 'Unpaid', 'Overdue'] },
        ]}
        emptyTitle="No invoices found"
        emptyDescription="No invoices match your current search or filters."
      />
    </div>
  );
}

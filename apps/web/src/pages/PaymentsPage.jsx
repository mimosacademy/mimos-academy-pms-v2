import React from 'react';
import { Helmet } from 'react-helmet';
import PageHeader from '@/components/PageHeader';
import EntityDialog from '@/components/EntityDialog';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { usePmsData } from '@/contexts/PmsDataContext';
import { formatDate, formatRM, formatRMCompact } from '@/lib/format';
import { CreditCard, HandCoins, Hourglass, Receipt } from 'lucide-react';

export default function PaymentsPage() {
  const { payments } = usePmsData();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const completed = payments.filter((p) => p.status === 'Completed');
  const pending = payments.filter((p) => p.status === 'Pending');
  const collectedTotal = completed.reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingTotal = pending.reduce((s, p) => s + Number(p.amount || 0), 0);
  const thisMonth = completed
    .filter((p) => p.date?.startsWith(currentMonth))
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const monthLabel = now.toLocaleString('en-MY', { month: 'short' });

  const columns = [
    { key: 'paymentNo', label: 'Payment No.', className: 'whitespace-nowrap font-medium text-violet-700' },
    { key: 'invoiceNo', label: 'Invoice', className: 'whitespace-nowrap text-slate-500' },
    { key: 'clientName', label: 'Client', className: 'whitespace-nowrap' },
    { key: 'programmeCode', label: 'Programme', className: 'whitespace-nowrap font-medium text-violet-700' },
    { key: 'amount', label: 'Amount', className: 'whitespace-nowrap font-medium', render: (p) => formatRM(p.amount) },
    { key: 'method', label: 'Method', className: 'whitespace-nowrap' },
    { key: 'date', label: 'Date', className: 'whitespace-nowrap text-slate-500', render: (p) => formatDate(p.date) },
    { key: 'reference', label: 'Reference', className: 'whitespace-nowrap text-slate-500' },
    { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <div>
      <Helmet>
        <title>Payments — MIMOS Academy PMS</title>
        <meta name="description" content="Payment collection records for MIMOS Academy — receipts, methods, references and reconciliation status." />
      </Helmet>

      <PageHeader title="Payment Collection" description="Final step in the programme flow — collections against programme invoices.">
        <EntityDialog
          collection="payments"
          title="Record Payment"
          description="Record a payment received and link it to the invoice."
          triggerLabel="Record Payment"
          fields={[
            { name: 'invoice', label: 'Invoice', type: 'relation', relation: 'invoices' },
            { name: 'programme', label: 'Programme', type: 'relation', relation: 'programmes', required: true },
            { name: 'client', label: 'Client', type: 'relation', relation: 'clients', required: true },
            { name: 'paymentNo', label: 'Payment No.', required: true },
            { name: 'amount', label: 'Amount (RM)', type: 'number', min: 0, step: '0.01', required: true },
            { name: 'method', label: 'Method', type: 'select', options: [
              { value: 'Bank Transfer', label: 'Bank Transfer' },
              { value: 'Cheque', label: 'Cheque' },
              { value: 'Online Banking', label: 'Online Banking' },
              { value: 'Credit Card', label: 'Credit Card' },
            ] },
            { name: 'date', label: 'Payment Date', type: 'date' },
            { name: 'reference', label: 'Reference' },
            { name: 'status', label: 'Status', type: 'select', options: [
              { value: 'Completed', label: 'Completed' },
              { value: 'Pending', label: 'Pending' },
              { value: 'Failed', label: 'Failed' },
            ] },
          ]}
        />
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Collected" value={formatRMCompact(collectedTotal)} icon={HandCoins} tone="emerald" hint={`${completed.length} confirmed payments`} />
        <StatCard title={`Collected in ${monthLabel}`} value={formatRMCompact(thisMonth)} icon={CreditCard} tone="violet" hint="current month" />
        <StatCard title="Pending Clearance" value={formatRMCompact(pendingTotal)} icon={Hourglass} tone="amber" hint={`${pending.length} payments clearing`} />
        <StatCard title="Transactions" value={payments.length} icon={Receipt} tone="blue" hint="recorded YTD" />
      </div>

      <DataTable
        columns={columns}
        data={payments}
        searchKeys={['paymentNo', 'invoiceNo', 'clientName', 'reference']}
        searchPlaceholder="Search payments…"
        filters={[
          { key: 'status', label: 'Status', options: ['Completed', 'Pending'] },
          { key: 'method', label: 'Method', options: ['Bank Transfer', 'Cheque', 'Online Banking', 'Credit Card'] },
        ]}
        emptyTitle="No payments found"
        emptyDescription="No payments match your current search or filters."
      />
    </div>
  );
}

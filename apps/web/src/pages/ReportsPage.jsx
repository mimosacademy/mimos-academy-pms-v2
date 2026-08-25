import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { usePmsData } from '@/contexts/PmsDataContext';
import { formatRM, formatRMCompact } from '@/lib/format';
import { Banknote, Download, HandCoins, Percent, Printer, Target } from 'lucide-react';

const STATUS_COLORS = { Paid: '#16a34a', Partial: '#d97706', Unpaid: '#94a3b8', Overdue: '#dc2626' };
const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

const printReport = () => window.print();

export default function ReportsPage() {
  const { invoices, monthlyFinancials, pipelineValue } = usePmsData();
  const ytdRevenue = monthlyFinancials.reduce((s, m) => s + m.revenue, 0);
  const ytdCollection = monthlyFinancials.reduce((s, m) => s + m.collection, 0);
  const collectionRate = ytdRevenue > 0 ? Math.round((ytdCollection / ytdRevenue) * 100) : 0;

  const normalizedInvoices = useMemo(() => invoices.map((i) => {
    const total = Number(i.totalAmount || i.amount || 0); const paid = Number(i.collectionAmount || i.paidAmount || 0); const outstanding = Math.max(total - paid, 0);
    const overdue = Boolean(i.dueDate && new Date(i.dueDate) < new Date() && outstanding > 0);
    return { ...i, total, paid, outstanding, effectiveStatus: i.status === 'Paid' || (total > 0 && paid >= total) ? 'Paid' : overdue || i.status === 'Overdue' ? 'Overdue' : paid > 0 ? 'Partial' : 'Unpaid' };
  }), [invoices]);

  const invoiceStatusData = ['Paid', 'Partial', 'Unpaid', 'Overdue'].map((status) => ({ name: status, value: normalizedInvoices.filter((i) => i.effectiveStatus === status).length }));
  const topClients = Object.entries(normalizedInvoices.reduce((acc, i) => { acc[i.clientName] = (acc[i.clientName] ?? 0) + i.total; return acc; }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  const maxClientValue = topClients[0]?.value ?? 1;

  const exportExcel = () => downloadCsv(`MIMOS-PMS-Report-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['Invoice No', 'Client', 'Programme', 'Invoice Date', 'Due Date', 'Total Amount', 'Collected', 'Outstanding', 'Status'],
    ...normalizedInvoices.map((i) => [i.invoiceNo, i.clientName, i.programme, i.invoiceDate, i.dueDate, i.total, i.paid, i.outstanding, i.effectiveStatus]),
  ]);

  return <div>
    <Helmet><title>Reports — MIMOS Academy PMS</title><meta name="description" content="Management reporting for MIMOS Academy." /></Helmet>
    <PageHeader title="Programme Reports" description="Revenue, collection, receivables and pipeline analytics.">
      <Button variant="outline" onClick={printReport}><Printer className="mr-2 h-4 w-4" /> Print / Save PDF</Button>
      <Button className="bg-violet-600 hover:bg-violet-700" onClick={exportExcel}><Download className="mr-2 h-4 w-4" /> Export Excel (CSV)</Button>
    </PageHeader>
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="YTD Revenue" value={formatRMCompact(ytdRevenue)} icon={Banknote} tone="violet" hint="from loaded invoices" /><StatCard title="YTD Collection" value={formatRMCompact(ytdCollection)} icon={HandCoins} tone="emerald" hint="recorded collections" /><StatCard title="Collection Rate" value={`${collectionRate}%`} icon={Percent} tone="blue" hint="of billed revenue" /><StatCard title="Open Pipeline" value={formatRMCompact(pipelineValue)} icon={Target} tone="amber" hint="unweighted opportunities" /></div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section className="rounded-xl border bg-white shadow-sm xl:col-span-2"><header className="border-b px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Revenue vs Collection</h2><p className="mt-0.5 text-xs text-slate-400">Monthly billed revenue against payments collected</p></header><div className="h-80 p-5"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyFinancials}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis tickFormatter={(v) => `${Math.round(v / 1000)}K`} /><Tooltip formatter={(v) => formatRM(v)} /><Legend /><Bar dataKey="revenue" name="Revenue" fill="#7c3aed" radius={[4,4,0,0]} /><Bar dataKey="collection" name="Collection" fill="#16a34a" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div></section>
      <section className="rounded-xl border bg-white shadow-sm"><header className="border-b px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Receivables by Status</h2><p className="mt-0.5 text-xs text-slate-400">Invoice count by effective payment status</p></header><div className="h-80 p-5"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={invoiceStatusData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={3} strokeWidth={0}>{invoiceStatusData.map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div></section>
    </div>
    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section className="rounded-xl border bg-white shadow-sm"><header className="border-b px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Top Clients by Billed Value</h2></header><ul className="space-y-4 p-5">{topClients.map((c) => <li key={c.name}><div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm"><span className="truncate font-medium text-slate-700">{c.name}</span><span className="shrink-0 font-semibold text-slate-900">{formatRMCompact(c.value)}</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${(c.value / maxClientValue) * 100}%` }} /></div></li>)}</ul></section>
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm xl:col-span-2"><header className="border-b px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Monthly Breakdown</h2></header><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Month</th><th className="px-5 py-3">Revenue</th><th className="px-5 py-3">Collection</th><th className="px-5 py-3">Outstanding</th><th className="px-5 py-3">Rate</th></tr></thead><tbody className="divide-y">{monthlyFinancials.map((m) => { const outstanding = Math.max(m.revenue - m.collection, 0); const rate = m.revenue > 0 ? Math.round((m.collection / m.revenue) * 100) : 0; return <tr key={m.month}><td className="px-5 py-3 font-medium">{m.month}</td><td className="px-5 py-3">{formatRM(m.revenue)}</td><td className="px-5 py-3">{formatRM(m.collection)}</td><td className="px-5 py-3">{formatRM(outstanding)}</td><td className="px-5 py-3">{rate}%</td></tr>; })}</tbody></table></div></section>
    </div>
    <style>{`@media print { nav, aside, button { display:none !important; } body { background:white !important; } section { break-inside: avoid; } }`}</style>
  </div>;
}

import React from 'react';
import { Helmet } from 'react-helmet';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { usePmsData } from '@/contexts/PmsDataContext';
import { formatRM, formatRMCompact, decimalAdd, decimalSubtract, decimalCompare, decimalToNumberForDisplay } from '@/lib/format';
import { Banknote, Download, HandCoins, Percent, Target } from 'lucide-react';

const STATUS_COLORS = { Paid: '#16a34a', Partial: '#d97706', Unpaid: '#94a3b8', Overdue: '#dc2626' };

const chartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md">{label && <p className="mb-1 font-semibold text-slate-800">{label}</p>}{payload.map((p) => <p key={p.dataKey ?? p.name} className="text-slate-600">{p.name}: <span className="font-semibold text-slate-900">{formatRM(p.value)}</span></p>)}</div>;
};

export default function ReportsPage() {
  const { invoices = [], monthlyFinancials = [], pipelineValue = '0.00' } = usePmsData();
  const ytdRevenue = monthlyFinancials.reduce((total, month) => decimalAdd(total, month.revenue), '0.00');
  const ytdCollection = monthlyFinancials.reduce((total, month) => decimalAdd(total, month.collection), '0.00');
  const collectionRate = decimalCompare(ytdRevenue, '0') > 0 ? Math.round((decimalToNumberForDisplay(ytdCollection) / decimalToNumberForDisplay(ytdRevenue)) * 100) : 0;
  const invoiceStatusData = ['Paid', 'Partial', 'Unpaid', 'Overdue'].map((status) => ({ name: status, count: invoices.filter((invoice) => invoice.status === status).length }));
  const topClients = Object.entries(invoices.reduce((acc, invoice) => { const key = invoice.clientName || 'Unknown'; acc[key] = decimalAdd(acc[key] || '0.00', invoice.totalAmount || invoice.amount); return acc; }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => decimalCompare(b.value, a.value)).slice(0, 6);
  const maxClientValue = topClients[0]?.value || '1.00';
  const exportCsv = () => {
    const rows = [['Month', 'Revenue', 'Collection', 'Variance'], ...monthlyFinancials.map((month) => [month.month, month.revenue, month.collection, decimalSubtract(month.collection, month.revenue)])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `pms-report-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div>
    <Helmet><title>Reports — MIMOS Academy PMS</title><meta name="description" content="Management reporting for MIMOS Academy." /></Helmet>
    <PageHeader title="Programme Reports" description="Programme revenue, collection and order-book analytics."><Button variant="outline" onClick={() => window.print()}><Download className="mr-2 h-4 w-4" /> Print / PDF</Button><Button className="bg-violet-600 hover:bg-violet-700" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button></PageHeader>
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="YTD Revenue" value={formatRMCompact(ytdRevenue)} icon={Banknote} tone="violet" hint="current year" /><StatCard title="YTD Collection" value={formatRMCompact(ytdCollection)} icon={HandCoins} tone="emerald" hint="current year" /><StatCard title="Collection Rate" value={`${collectionRate}%`} icon={Percent} tone="blue" hint="of billed revenue" /><StatCard title="Open Pipeline" value={formatRMCompact(pipelineValue)} icon={Target} tone="amber" hint="unweighted opportunities" /></div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3"><section className="rounded-xl border bg-white shadow-sm xl:col-span-2"><header className="border-b px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Revenue vs Collection</h2><p className="mt-0.5 text-xs text-slate-400">Monthly billed revenue against payments collected</p></header><div className="h-80 p-5"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyFinancials}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis tickFormatter={(value) => `${Math.round(Number(value || 0) / 1000)}K`} /><Tooltip content={chartTooltip} /><Legend /><Bar dataKey="revenue" name="Revenue" fill="#7c3aed" /><Bar dataKey="collection" name="Collection" fill="#16a34a" /></BarChart></ResponsiveContainer></div></section>
      <section className="rounded-xl border bg-white shadow-sm"><header className="border-b px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Receivables by Status</h2><p className="mt-0.5 text-xs text-slate-400">Invoice count by payment status</p></header><div className="h-80 p-5"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={invoiceStatusData} dataKey="count" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={3} strokeWidth={0}>{invoiceStatusData.map((status) => <Cell key={status.name} fill={STATUS_COLORS[status.name]} />)}</Pie><Tooltip /><Legend /></PieChart></div></section></div>
    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3"><section className="rounded-xl border bg-white shadow-sm"><header className="border-b px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Top Clients by Billed Value</h2></header><ul className="space-y-4 p-5">{topClients.map((client) => <li key={client.name}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate font-medium">{client.name}</span><span className="shrink-0 font-semibold">{formatRMCompact(client.value)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.min(100, (decimalToNumberForDisplay(client.value) / decimalToNumberForDisplay(maxClientValue)) * 100)}%` }} /></div></li>)}</ul></section>
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm xl:col-span-2"><header className="border-b px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Monthly Breakdown</h2></header><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500"><th className="px-5 py-3">Month</th><th className="px-5 py-3">Revenue</th><th className="px-5 py-3">Collection</th><th className="px-5 py-3">Variance</th><th className="px-5 py-3">Rate</th></tr></thead><tbody className="divide-y">{monthlyFinancials.map((month) => { const revenue = month.revenue || '0.00'; const collection = month.collection || '0.00'; const rate = decimalCompare(revenue, '0') > 0 ? Math.round((decimalToNumberForDisplay(collection) / decimalToNumberForDisplay(revenue)) * 100) : 0; return <tr key={month.month}><td className="px-5 py-3 font-medium">{month.month}</td><td className="px-5 py-3">{formatRM(revenue)}</td><td className="px-5 py-3">{formatRM(collection)}</td><td className="px-5 py-3">{formatRM(decimalSubtract(collection, revenue))}</td><td className="px-5 py-3">{rate}%</td></tr>; })}</tbody></table></div></section></div>
  </div>;
}

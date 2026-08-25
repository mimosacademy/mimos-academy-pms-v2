import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/lib/roles';
import { usePmsData } from '@/contexts/PmsDataContext';
import { formatDate, formatRMCompact, isOverdue } from '@/lib/format';
import { AlarmClock, Banknote, BookOpenCheck, ClipboardCheck, HandCoins, Hourglass, Target } from 'lucide-react';

function Widget({ title, subtitle, children, className = '' }) { return <section className={`rounded-xl border bg-white shadow-sm ${className}`}><header className="border-b px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}</header><div className="p-5">{children}</div></section>; }

export default function DashboardPage() {
  const { user } = useAuth();
  const { BUSINESS_FLOW, actionItems, funnelByStage, openOpportunities, pipelineValue, programmeCompletenessAvg, programmes, securedOrderBook, totals, trainingSessions, weightedPipelineValue } = usePmsData();
  const firstName = (user?.name ?? 'there').split(' ')[0];
  const outstandingRate = totals.revenue > 0 ? Math.round((totals.outstanding / totals.revenue) * 100) : 0;
  const overdueCount = (totals.overdueInvoices ?? 0);
  const inProgress = programmes.filter((p) => p.status === 'In Progress');
  const openActions = actionItems.filter((a) => a.status !== 'Completed').sort((a, b) => new Date(a.dueDate || '2999-12-31') - new Date(b.dueDate || '2999-12-31')).slice(0, 5);
  const upcoming = trainingSessions.filter((t) => t.status === 'Scheduled').sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 5);
  return <div>
    <Helmet><title>Dashboard — MIMOS Academy PMS</title><meta name="description" content="Programme-centric dashboard for MIMOS Academy." /></Helmet>
    <PageHeader title={`Welcome back, ${firstName}`} description={`Signed in as ${ROLES[user?.role] ?? 'Viewer'} — programme lifecycle at a glance.`} />
    <div className="mb-6 overflow-x-auto rounded-xl border bg-white px-4 py-3 shadow-sm"><p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Programme business flow</p><ol className="flex min-w-max items-center gap-1 text-xs font-medium text-slate-600">{BUSINESS_FLOW.map((step, i) => <li key={step} className="flex items-center gap-1"><span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-800 ring-1 ring-inset ring-violet-100">{step}</span>{i < BUSINESS_FLOW.length - 1 && <span className="px-1 text-slate-300">→</span>}</li>)}</ol></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Revenue" value={formatRMCompact(totals.revenue)} icon={Banknote} tone="violet" hint="from invoices" /><StatCard title="Collection" value={formatRMCompact(totals.collected)} icon={HandCoins} tone="emerald" hint="recorded payments" /><StatCard title="Outstanding" value={formatRMCompact(totals.outstanding)} icon={Hourglass} tone="amber" hint={`${outstandingRate}% of billed revenue`} /><StatCard title="Overdue" value={formatRMCompact(totals.overdue)} icon={AlarmClock} tone="red" hint={overdueCount ? `${overdueCount} invoices require follow-up` : 'No overdue invoices'} /></div>
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Forecast Funnel" value={formatRMCompact(pipelineValue)} icon={Target} tone="blue" hint={`${openOpportunities.length} open opportunities`} /><StatCard title="Weighted Funnel" value={formatRMCompact(weightedPipelineValue)} icon={Target} tone="violet" hint="probability-adjusted" /><StatCard title="Secured Order Book" value={formatRMCompact(securedOrderBook)} icon={ClipboardCheck} tone="emerald" hint="confirmed client POs" /><StatCard title="Programme Completeness" value={`${programmeCompletenessAvg}%`} icon={BookOpenCheck} tone="amber" hint="average delivery progress" /></div>
    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Widget title="Forecast Funnel" subtitle="Open opportunity value by stage" className="xl:col-span-2"><div className="space-y-4">{funnelByStage.map((s) => { const max = Math.max(...funnelByStage.map((x) => x.value), 1); return <div key={s.stage}><div className="mb-1.5 flex items-baseline justify-between text-sm"><span className="font-medium text-slate-700">{s.stage}<span className="ml-2 text-xs text-slate-400">{s.count} deals</span></span><span className="font-semibold text-slate-900">{formatRMCompact(s.value)}</span></div><div className="h-3 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.max((s.value / max) * 100, 4)}%`, backgroundColor: s.color }} /></div></div>; })}</div></Widget>
      <Widget title="Secured Order Book" subtitle="Top confirmed programmes"><p className="text-3xl font-bold tracking-tight text-slate-900">{formatRMCompact(securedOrderBook)}</p><ul className="mt-5 space-y-3">{programmes.filter((p) => p.contractValue).sort((a, b) => b.contractValue - a.contractValue).slice(0, 4).map((p) => <li key={p.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{p.code}</p><p className="truncate text-xs text-slate-400">{p.clientName}</p></div><span className="shrink-0 text-sm font-semibold">{formatRMCompact(p.contractValue)}</span></li>)}</ul></Widget>
    </div>
    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Widget title="Weighted Funnel" subtitle={formatRMCompact(weightedPipelineValue)}><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={funnelByStage}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="stage" tick={{ fontSize: 10 }} /><YAxis tickFormatter={(v) => `${Math.round(v / 1000)}K`} /><Tooltip formatter={(v) => formatRMCompact(v)} /><Bar dataKey="weighted" fill="#7c3aed" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div></Widget>
      <Widget title="Programme Completeness" subtitle={`${inProgress.length} programmes in delivery`}><ul className="space-y-5">{inProgress.map((p) => <li key={p.id}><div className="mb-1.5 flex items-baseline justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{p.title}</p><p className="text-xs text-slate-400">{p.clientName} · {p.sessionsDelivered}/{p.sessionsPlanned} sessions</p></div><span className="shrink-0 text-xs font-semibold text-violet-700">{p.progress}%</span></div><Progress value={p.progress} className="h-2 bg-slate-100 [&>div]:bg-violet-600" /></li>)}</ul></Widget>
      <Widget title="Upcoming Training Delivery" subtitle="Next scheduled sessions"><ul className="space-y-4">{upcoming.map((t) => <li key={t.id} className="flex items-start gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{t.title}</p><p className="text-xs text-slate-400">{formatDate(t.date)} · {t.trainer || 'Trainer TBD'} · {t.venue || 'Venue TBD'}</p></div></li>)}</ul></Widget>
    </div>
    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2"><Widget title="Open Action Items" subtitle="Priority follow-ups"><ul className="divide-y">{openActions.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium text-slate-800">{a.title}</p><p className="text-xs text-slate-400">{a.owner || 'Unassigned'} · due {formatDate(a.dueDate)}</p></div><StatusBadge status={a.priority} /></li>)}{!openActions.length && <li className="py-6 text-sm text-slate-400">No open action items.</li>}</ul></Widget><Widget title="Quick Navigation" subtitle="Common operational views"><div className="grid grid-cols-2 gap-3">{[['/programmes','Programmes'],['/opportunities','Opportunities'],['/invoices','Invoices'],['/payments','Payments'],['/training','Training'],['/reports','Reports']].map(([href,label]) => <Link key={href} to={href} className="rounded-lg border p-3 text-sm font-medium text-violet-700 hover:bg-violet-50">{label}</Link>)}</div></Widget></div>
  </div>;
}

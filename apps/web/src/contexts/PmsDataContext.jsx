import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext';

const PmsDataContext = createContext(null);

const fullList = async (collection, options = {}) => pb.collection(collection).getFullList({ sort: '-created', ...options });

const nameOf = (record, expandKey = 'client', fallback = '') =>
  record?.expand?.[expandKey]?.name || fallback || record?.[expandKey] || '—';

const mapClient = (r) => ({
  id: r.id, name: r.name, industry: r.industry || '', contactPerson: r.contactPerson || '',
  email: r.email || '', phone: r.phone || '', location: r.location || '', status: r.status || 'Prospect',
  since: r.since || (r.created ? new Date(r.created).getFullYear().toString() : ''),
});

const mapProgramme = (r) => ({
  id: r.id, code: r.code, title: r.title, category: r.category || r.programmeCategory || '',
  trainingType: r.trainingType || '', programmeCategory: r.programmeCategory || '',
  client: r.client, clientName: nameOf(r, 'client'), status: r.status || 'Scheduled',
  accountManager: r.accountManager || '', pic: r.pic || '', trainer: r.trainer || '',
  startDate: r.startDate || '', endDate: r.endDate || '', durationDays: Number(r.durationDays || 0),
  venue: r.venue || '', participants: Number(r.participants || 0), progress: Number(r.progress || 0),
  contractValue: Number(r.contractValue || 0), totalRevenueExclSST: Number(r.totalRevenueExclSST || 0),
  sstAmount: Number(r.sstAmount || 0), totalRevenueInclSST: Number(r.totalRevenueInclSST || 0),
  totalCollection: Number(r.totalCollection || 0), outstandingAmount: Number(r.outstandingAmount || 0),
  poNo: r.poNo || '', quotationId: r.quotation || null, poId: r.po || null, opportunityId: r.opportunity || null,
  sessionsPlanned: Number(r.sessionsPlanned || 0), sessionsDelivered: Number(r.sessionsDelivered || 0),
  account: r.account || '',
});

const mapOpportunity = (r) => {
  const value = Number(r.forecastValue ?? r.value ?? 0);
  const weighted = Number(r.weightedForecast ?? (value * Number(r.probability || 0) / 100));
  return {
    id: r.id, client: r.client, clientName: nameOf(r, 'client'), title: r.title, projectTitle: r.title,
    value, forecastValue: value, stage: r.opportunityStatus || r.stage || 'Early engagement',
    opportunityStatus: r.opportunityStatus || r.stage || 'Early engagement',
    probability: Number(r.probability || 0), weightedForecast: weighted, weighted,
    securedOrderBookValue: Number(r.securedOrderBookValue || 0), sector: r.sector || 'Private',
    accountManager: r.accountManager || '', salesman: r.salesman || '',
    expectedClose: r.expectedClose || '', year: Number(r.year || 0),
  };
};

const mapQuotation = (r) => ({
  id: r.id, quoteNo: r.quoteNo, revision: r.revision || '', quotationType: r.quotationType || 'Training',
  trainingType: r.trainingType || '', client: r.client, clientName: nameOf(r, 'client'),
  programme: r.programmeTitle || nameOf(r, 'programme', ''), programmeTitle: r.programmeTitle || '',
  programmeCode: r.programmeCode || r.expand?.programme?.code || '', programmeId: r.programme || null,
  opportunityId: r.opportunity || null, amount: Number(r.amount || r.finalPrice || 0),
  unitPriceExclSST: Number(r.unitPriceExclSST || 0), unitPriceInclSST: Number(r.unitPriceInclSST || 0),
  totalPriceExclSST: Number(r.totalPriceExclSST || 0), totalPriceInclSST: Number(r.totalPriceInclSST || 0),
  sstAmount: Number(r.sstAmount || 0), discountPercentage: Number(r.discountPercentage || 0),
  finalPrice: Number(r.finalPrice || r.amount || 0), accountManager: r.accountManager || '',
  pic: r.pic || '', status: r.status || 'Draft', issueDate: r.issueDate || '', validUntil: r.validUntil || '',
  preparedBy: r.preparedBy || '',
});

const mapPO = (r) => ({
  id: r.id, poNo: r.poNo, client: r.client, clientName: nameOf(r, 'client'),
  programmeId: r.programme || null, programmeCode: r.expand?.programme?.code || '',
  programmeTitle: r.expand?.programme?.title || '', quotationId: r.quotation || null,
  amount: Number(r.amount || 0), status: r.status || 'Pending', issueDate: r.issueDate || '',
  receivedDate: r.receivedDate || '',
});

const mapInvoice = (r) => {
  const amount = Number(r.amountExcludingSST ?? r.amount ?? 0);
  const paid = Number(r.collectionAmount ?? r.paidAmount ?? 0);
  const total = Number(r.totalAmount ?? amount);
  return {
    id: r.id, invoiceNo: r.invoiceNo, invoiceDate: r.invoiceDate || r.issueDate || '',
    issueDate: r.issueDate || r.invoiceDate || '', dueDate: r.dueDate || '',
    client: r.client, clientName: nameOf(r, 'client'), programmeId: r.programme || null,
    programmeCode: r.expand?.programme?.code || '', programme: r.expand?.programme?.title || '',
    quotationReference: r.quotationReference || '', poReference: r.poReference || '',
    description: r.description || '', amountExcludingSST: amount, amount, sstAmount: Number(r.sstAmount || 0),
    totalAmount: total, collectionAmount: paid, paidAmount: paid,
    outstandingAmount: Number(r.outstandingAmount ?? Math.max(total - paid, 0)),
    status: r.status || (paid >= total && total > 0 ? 'Paid' : 'Unpaid'),
    paymentStatus: r.paymentStatus || '', paymentMethod: r.paymentMethod || '',
    paymentDate: r.paymentDate || '', daysOutstanding: Number(r.daysOutstanding || 0),
    accountManager: r.accountManager || '', pic: r.pic || '',
  };
};

const mapPayment = (r) => ({
  id: r.id, paymentNo: r.paymentNo, invoice: r.invoice || null, invoiceNo: r.expand?.invoice?.invoiceNo || '',
  client: r.client, clientName: nameOf(r, 'client'), programmeId: r.programme || null,
  programmeCode: r.expand?.programme?.code || '', amount: Number(r.amount || 0), method: r.method || '',
  date: r.date || '', reference: r.reference || '', status: r.status || 'Completed',
});

const mapAction = (r) => ({
  id: r.id, client: r.client || '', service: r.service || '', title: r.title,
  relatedTo: r.relatedTo || '', programmeId: r.programme || null, programmeCode: r.expand?.programme?.code || '',
  owner: r.owner || '', personInCharge: r.personInCharge || '', personEmail: r.personEmail || '',
  dueDate: r.dueDate || '', status: r.status || 'Open', potentialRevenue: Number(r.potentialRevenue || 0),
  agingDays: Number(r.agingDays || 0), notes: r.notes || '', priority: r.priority || 'Medium',
});

const mapTrainingStat = (r) => ({
  id: r.id, programmeId: r.programme, trainingDate: r.trainingDate || '',
  trainingName: r.trainingName || r.expand?.programme?.title || '', trainingCategory: r.trainingCategory || '',
  domain: r.domain || '', workshopCount: Number(r.workshopCount || 0), trainingCount: Number(r.trainingCount || 0),
  totalCount: Number(r.totalCount || 0), bumiputeraCount: Number(r.bumiputeraCount || 0),
  nonBumiputeraCount: Number(r.nonBumiputeraCount || 0), totalCharges: Number(r.totalCharges || 0),
  sstAmount: Number(r.sstAmount || 0), finalCharges: Number(r.finalCharges || 0),
  sessionsPlanned: Number(r.sessionsPlanned || 0), sessionsDelivered: Number(r.sessionsDelivered || 0),
  attendanceRate: Number(r.attendanceRate || 0), completionRate: Number(r.completionRate || 0),
  avgScore: Number(r.avgScore || 0), npsScore: Number(r.npsScore || 0), lastSession: r.lastSession || '',
});

const mapTraining = (r) => ({
  id: r.id, title: r.title, programme: r.expand?.programme?.title || '',
  programmeCode: r.expand?.programme?.code || '', programmeId: r.programme,
  date: r.date || '', time: r.time || '', trainer: r.trainer || '',
  venue: r.venue || '', mode: r.mode || 'In-Person', status: r.status || 'Scheduled',
});

const mapParticipant = (r) => ({
  id: r.id, programmeId: r.programme, client: r.client || null,
  programmeCode: r.expand?.programme?.code || '', programmeTitle: r.expand?.programme?.title || '',
  name: r.name, email: r.email || '', company: r.company || '', phone: r.phone || '', status: r.status || 'Confirmed',
});

const mapDocument = (r) => ({
  id: r.id, programmeId: r.programme, name: r.name, type: r.type || '', uploadedBy: r.uploadedBy || '',
  date: r.date || '', size: r.size || '',
});

const mapAudit = (r) => ({
  id: r.id, programmeId: r.programme || null, action: r.action, entity: r.entity || '',
  description: r.description || '', user: r.user || '', timestamp: r.timestamp || r.created || '',
});

const makeTotals = (invoices) => {
  const revenue = invoices.reduce((s, i) => s + Number(i.totalAmount || i.amount || 0), 0);
  const collected = invoices.reduce((s, i) => s + Number(i.collectionAmount || i.paidAmount || 0), 0);
  const outstanding = invoices.reduce((s, i) => s + Math.max(Number(i.totalAmount || i.amount || 0) - Number(i.collectionAmount || i.paidAmount || 0), 0), 0);
  const overdue = invoices.reduce((s, i) => {
    const invoiceOutstanding = Math.max(Number(i.totalAmount || i.amount || 0) - Number(i.collectionAmount || i.paidAmount || 0), 0);
    const isOverdue = i.status === 'Overdue' || (i.dueDate && new Date(i.dueDate) < new Date());
    return s + (isOverdue ? invoiceOutstanding : 0);
  }, 0);
  return { revenue, collected, outstanding, overdue };
};

const makeMonthlyFinancials = (invoices) => {
  const months = new Map();
  invoices.forEach((i) => {
    const d = i.invoiceDate || i.issueDate;
    if (!d) return;
    const key = d.slice(0, 7);
    if (!months.has(key)) months.set(key, { month: key, revenue: 0, collection: 0 });
    const row = months.get(key);
    row.revenue += Number(i.totalAmount || i.amount || 0);
    row.collection += Number(i.collectionAmount || i.paidAmount || 0);
  });
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
};

export function PmsDataProvider({ children }) {
  const { isAuthed } = useAuth();
  const [state, setState] = useState({
    loading: true, error: '', clients: [], clientContacts: [], programmes: [], opportunities: [],
    quotations: [], purchaseOrders: [], invoices: [], payments: [], trainingSessions: [], trainingStatistics: [],
    participants: [], actionItems: [], documents: [], auditHistory: [], notifications: [],
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const [clientsRaw, contactsRaw, programmesRaw, opportunitiesRaw, quotationsRaw, poRaw, invoicesRaw, paymentsRaw,
        trainingRaw, statsRaw, participantsRaw, actionsRaw, documentsRaw, auditRaw] = await Promise.all([
        fullList('clients', { expand: 'createdBy' }),
        fullList('client_contacts', { expand: 'client' }),
        fullList('programmes', { expand: 'client,quotation,po,opportunity' }),
        fullList('opportunities', { expand: 'client,linkedProgramme' }),
        fullList('quotations', { expand: 'client,programme,opportunity' }),
        fullList('purchase_orders', { expand: 'client,programme,quotation' }),
        fullList('invoices', { expand: 'client,programme' }),
        fullList('payments', { expand: 'invoice,client,programme' }),
        fullList('training_delivery', { expand: 'programme' }),
        fullList('training_statistics', { expand: 'programme' }),
        fullList('participants', { expand: 'programme,client' }),
        fullList('action_items', { expand: 'programme' }),
        fullList('documents', { expand: 'programme' }),
        fullList('audit_history', { expand: 'programme' }),
      ]);
      setState({
        loading: false, error: '', clients: clientsRaw.map(mapClient), clientContacts: contactsRaw,
        programmes: programmesRaw.map(mapProgramme), opportunities: opportunitiesRaw.map(mapOpportunity),
        quotations: quotationsRaw.map(mapQuotation), purchaseOrders: poRaw.map(mapPO), invoices: invoicesRaw.map(mapInvoice),
        payments: paymentsRaw.map(mapPayment), trainingSessions: trainingRaw.map(mapTraining), trainingStatistics: statsRaw.map(mapTrainingStat),
        participants: participantsRaw.map(mapParticipant), actionItems: actionsRaw.map(mapAction), documents: documentsRaw.map(mapDocument),
        auditHistory: auditRaw.map(mapAudit), notifications: [],
      });
    } catch (error) {
      console.error(error);
      setState((s) => ({ ...s, loading: false, error: error?.message || 'Unable to load PMS data.' }));
    }
  }, []);

  useEffect(() => { if (isAuthed) refresh(); }, [isAuthed, refresh]);

  const createRecord = useCallback(async (collection, payload) => {
    const data = { ...payload };
    if (!data.createdBy && pb.authStore.record?.id && !['audit_history', 'users'].includes(collection)) data.createdBy = pb.authStore.record.id;
    const record = await pb.collection(collection).create(data);
    await refresh();
    return record;
  }, [refresh]);

  const updateRecord = useCallback(async (collection, id, payload) => {
    const record = await pb.collection(collection).update(id, payload);
    await refresh();
    return record;
  }, [refresh]);

  const deleteRecord = useCallback(async (collection, id) => {
    await pb.collection(collection).delete(id);
    await refresh();
  }, [refresh]);

  const derived = useMemo(() => {
    const { opportunities, programmes, invoices } = state;
    const openOpportunities = opportunities.filter((o) => o.stage !== 'Lost/No-go');
    const pipelineValue = openOpportunities.reduce((s, o) => s + o.value, 0);
    const weightedPipelineValue = openOpportunities.reduce((s, o) => s + o.weighted, 0);
    const securedOrderBook = opportunities.reduce((s, o) => s + Number(o.securedOrderBookValue || 0), 0);
    const funnelStages = [
      ['Contract signed/PO issued', '#10b981', 100], ['Verbal commitment', '#3b82f6', 90], ['Negotiation stage', '#8b5cf6', 70],
      ['Proposal/Tender submitted', '#f59e0b', 50], ['Qualified lead/Tender in progress', '#64748b', 30],
      ['Early engagement', '#94a3b8', 10], ['Lost/No-go', '#ef4444', 0],
    ];
    const funnelByStage = funnelStages.map(([stage, color, probability]) => ({
      stage, color, probability, count: opportunities.filter((o) => o.stage === stage).length,
      value: opportunities.filter((o) => o.stage === stage).reduce((s, o) => s + o.value, 0),
      weighted: opportunities.filter((o) => o.stage === stage).reduce((s, o) => s + o.weighted, 0),
    }));
    const totals = makeTotals(invoices);
    const monthlyFinancials = makeMonthlyFinancials(invoices);
    const programmeCompletenessAvg = programmes.length ? Math.round(programmes.reduce((s, p) => s + Number(p.progress || 0), 0) / programmes.length) : 0;
    return {
      openOpportunities, pipelineValue, weightedPipelineValue, securedOrderBook, funnelByStage, totals, monthlyFinancials,
      programmeCompletenessAvg,
      BUSINESS_FLOW: ['Opportunity', 'Quotation', 'Purchase Order', 'Programme', 'Training Delivery', 'Invoice', 'Payment Collection'],
    };
  }, [state]);

  const value = useMemo(() => ({ ...state, ...derived, refresh, createRecord, updateRecord, deleteRecord }), [state, derived, refresh, createRecord, updateRecord, deleteRecord]);
  return <PmsDataContext.Provider value={value}>{children}</PmsDataContext.Provider>;
}

export const usePmsData = () => {
  const ctx = useContext(PmsDataContext);
  if (!ctx) throw new Error('usePmsData must be used inside PmsDataProvider');
  return ctx;
};

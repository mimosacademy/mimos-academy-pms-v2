#!/usr/bin/env node
/**
 * Seed the V2 PocketBase database from the business data shipped with V2.
 *
 * Usage:
 *   PB_URL=https://api-pms.example.com \
 *   PB_SUPERUSER_EMAIL=... \
 *   PB_SUPERUSER_PASSWORD=... \
 *   node tools/seed-v2.mjs
 *
 * This script is intentionally separate from the frontend. After a successful
 * seed, the frontend never reads mockData.js.
 */
const PB_URL = (process.env.PB_URL || '').replace(/\/$/, '');
const EMAIL = process.env.PB_SUPERUSER_EMAIL || '';
const PASSWORD = process.env.PB_SUPERUSER_PASSWORD || '';

if (!PB_URL || !EMAIL || !PASSWORD) {
  console.error('Missing PB_URL, PB_SUPERUSER_EMAIL or PB_SUPERUSER_PASSWORD.');
  process.exit(1);
}

const data = await import('../apps/web/src/lib/mockData.js');

async function request(path, options = {}) {
  const res = await fetch(`${PB_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(body)}`);
  return body;
}

const auth = await request('/api/collections/_superusers/auth-with-password', {
  method: 'POST',
  body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
});
const token = auth.token;
const headers = { Authorization: token };

async function list(collection) {
  return request(`/api/collections/${collection}/records?perPage=500`, { headers });
}

async function create(collection, body) {
  return request(`/api/collections/${collection}/records`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function update(collection, id, body) {
  return request(`/api/collections/${collection}/records/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

const existing = await list('clients');
if (existing.totalItems > 0 && process.env.SEED_FORCE !== 'true') {
  console.error(`Seed stopped: clients collection already contains ${existing.totalItems} records.`);
  console.error('If this is intentional, re-run with SEED_FORCE=true (this may create duplicates).');
  process.exit(2);
}

const userRows = await list('users');
const createdBy = userRows.items[0]?.id;
if (!createdBy) throw new Error('No application user exists. Run PocketBase migrations and create the bootstrap Super Admin first.');

const clientMap = new Map();
const clientMapByName = new Map();
const opportunityMap = new Map();
const quotationMap = new Map();
const poMap = new Map();
const programmeMap = new Map();
const invoiceMap = new Map();
const programmeCodeCounts = new Map();

const safe = (v) => v === undefined || v === null ? '' : v;
const date = (v) => v || '';

console.log('1/10 Creating clients...');
for (const c of data.clients) {
  const r = await create('clients', {
    name: c.name, industry: safe(c.industry), contactPerson: safe(c.contactPerson),
    email: safe(c.email), phone: safe(c.phone), location: safe(c.location),
    status: c.status || 'Prospect', since: safe(c.since), createdBy,
  });
  clientMap.set(c.id, r.id); clientMapByName.set(c.name, r.id);
}

async function ensureClient(name) {
  const n = String(name || '').trim();
  if (!n) return '';
  if (clientMapByName.has(n)) return clientMapByName.get(n);
  const r = await create('clients', { name: n, status: 'Prospect', createdBy });
  clientMapByName.set(n, r.id);
  return r.id;
}

console.log('2/10 Creating opportunities...');
for (const o of data.opportunities) {
  const r = await create('opportunities', {
    client: clientMap.get(o.client) || await ensureClient(o.clientName),
    title: o.title,
    value: Number(o.value || 0),
    stage: ({'Early engagement':'Lead','Qualified lead/Tender in progress':'Qualified','Proposal/Tender submitted':'Proposal','Negotiation stage':'Negotiation','Verbal commitment':'Negotiation','Contract signed/PO issued':'Won','Lost/No-go':'Lost'})[o.stage] || 'Lead',
    probability: Number(o.probability || 0),
    expectedClose: date(o.expectedClose),
    owner: safe(o.accountManager),
    source: 'V2 Seed',
    programmeCode: '',
    opportunityStatus: ['Early engagement','Qualified lead/Tender in progress','Proposal/Tender submitted','Negotiation stage','Verbal commitment','Contract signed/PO issued','Lost/No-go'].includes(o.opportunityStatus || o.stage) ? (o.opportunityStatus || o.stage) : 'Negotiation stage',
    forecastValue: Number(o.forecastValue || o.value || 0),
    weightedForecast: Number(o.weightedForecast || o.weighted || 0),
    securedOrderBookValue: Number(o.securedOrderBookValue || 0),
    sector: o.sector === 'Government' ? 'Government' : 'Private',
    accountManager: safe(o.accountManager),
    salesman: safe(o.salesman || o.accountManager),
    year: Number(o.year || 2026),
    createdBy,
  });
  opportunityMap.set(o.id, r.id);
}

console.log('3/10 Creating quotations...');
for (const q of data.quotations) {
  const r = await create('quotations', {
    client: clientMap.get(q.client) || '',
    programme: '',
    opportunity: opportunityMap.get(q.opportunityId) || '',
    quoteNo: q.quoteNo,
    programmeTitle: safe(q.programmeTitle || q.programme),
    programmeCode: safe(q.programmeCode),
    amount: Number(q.amount || 0),
    status: q.status === 'Won' ? 'Accepted' : (['Draft','Sent','Accepted','Rejected','Expired'].includes(q.status) ? q.status : 'Draft'),
    issueDate: date(q.issueDate),
    validUntil: date(q.validUntil),
    preparedBy: safe(q.preparedBy),
    revision: safe(q.revision),
    quotationType: ['Training','Space Rental','Consultancy','Service'].includes(q.quotationType) ? q.quotationType : 'Training',
    trainingType: safe(q.trainingType),
    accountManager: safe(q.accountManager),
    pic: safe(q.pic),
    unitPriceExclSST: Number(q.unitPriceExclSST || 0),
    unitPriceInclSST: Number(q.unitPriceInclSST || 0),
    totalPriceExclSST: Number(q.totalPriceExclSST || 0),
    totalPriceInclSST: Number(q.totalPriceInclSST || 0),
    sstAmount: Number(q.sstAmount || 0),
    discountPercentage: Number(q.discountPercentage || 0),
    finalPrice: Number(q.finalPrice || q.amount || 0),
    createdBy,
  });
  quotationMap.set(q.id, r.id);
}

console.log('4/10 Creating purchase orders...');
for (const p of data.purchaseOrders) {
  const r = await create('purchase_orders', {
    client: clientMap.get(p.client) || '',
    programme: '',
    quotation: quotationMap.get(p.quotationId) || '',
    poNo: p.poNo,
    amount: Number(p.amount || 0),
    status: p.status || 'Pending',
    issueDate: date(p.issueDate),
    receivedDate: date(p.receivedDate),
    createdBy,
  });
  poMap.set(p.id, r.id);
}

console.log('5/10 Creating programmes...');
for (const p of data.programmes) {
  const originalCode = p.code;
  const occurrence = (programmeCodeCounts.get(originalCode) || 0) + 1;
  programmeCodeCounts.set(originalCode, occurrence);
  const programmeCode = occurrence === 1 ? originalCode : `${originalCode}-V2-${occurrence}`;
  const r = await create('programmes', {
    client: clientMap.get(p.client) || '',
    code: programmeCode,
    title: p.title,
    category: safe(p.category),
    startDate: date(p.startDate),
    endDate: date(p.endDate),
    venue: safe(p.venue),
    pic: safe(p.pic),
    trainer: safe(p.trainer),
    status: p.status || 'Scheduled',
    participants: Number(p.participants || 0),
    progress: Number(p.progress || 0),
    contractValue: Number(p.contractValue || 0),
    sessionsPlanned: Number(p.sessionsPlanned || 0),
    sessionsDelivered: Number(p.sessionsDelivered || 0),
    trainingType: safe(p.trainingType),
    programmeCategory: ['In-House','Public','Workshop'].includes(p.programmeCategory) ? p.programmeCategory : 'In-House',
    accountManager: safe(p.accountManager),
    durationDays: Number(p.durationDays || 0),
    totalRevenueExclSST: Number(p.totalRevenueExclSST || 0),
    sstAmount: Number(p.sstAmount || 0),
    totalRevenueInclSST: Number(p.totalRevenueInclSST || 0),
    totalCollection: Number(p.totalCollection || 0),
    outstandingAmount: Number(p.outstandingAmount || 0),
    poNo: safe(p.poNo),
    quotation: quotationMap.get(p.quotationId) || '',
    po: poMap.get(p.poId) || '',
    opportunity: opportunityMap.get(p.opportunityId) || '',
    createdBy,
  });
  programmeMap.set(p.id, r.id);
}

console.log('6/10 Linking quotations, POs and opportunities to programmes...');
for (const q of data.quotations) {
  if (q.programmeId && quotationMap.has(q.id) && programmeMap.has(q.programmeId))
    await update('quotations', quotationMap.get(q.id), { programme: programmeMap.get(q.programmeId) });
}
for (const p of data.purchaseOrders) {
  if (p.programmeId && poMap.has(p.id) && programmeMap.has(p.programmeId))
    await update('purchase_orders', poMap.get(p.id), { programme: programmeMap.get(p.programmeId) });
}

console.log('7/10 Creating invoices...');
for (const i of data.invoices) {
  const programmeId = programmeMap.get(i.programmeId) || '';
  const total = Number(i.totalAmount || i.amount || 0);
  const paid = Number(i.collectionAmount || i.paidAmount || 0);
  const r = await create('invoices', {
    programme: programmeId,
    client: clientMap.get(i.client) || '',
    invoiceNo: i.invoiceNo,
    description: safe(i.description),
    amount: Number(i.amount || i.amountExcludingSST || 0),
    paidAmount: paid,
    issueDate: date(i.issueDate || i.invoiceDate),
    dueDate: date(i.dueDate),
    status: i.status || (paid >= total && total > 0 ? 'Paid' : 'Unpaid'),
    amountExcludingSST: Number(i.amountExcludingSST || i.amount || 0),
    sstAmount: Number(i.sstAmount || 0),
    totalAmount: total,
    collectionAmount: paid,
    outstandingAmount: Number(i.outstandingAmount ?? Math.max(total - paid, 0)),
    paymentStatus: i.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID',
    paymentMethod: ['HRDCorp Claimable','Self-Pay','ePerolehan'].includes(i.paymentMethod) ? i.paymentMethod : 'Self-Pay',
    paymentDate: date(i.paymentDate),
    daysOutstanding: Number(i.daysOutstanding || 0),
    quotationReference: safe(i.quotationReference),
    poReference: safe(i.poReference),
    accountManager: safe(i.accountManager),
    pic: safe(i.pic),
    createdBy,
  });
  invoiceMap.set(i.id, r.id);
}

console.log('8/10 Creating payments...');
for (const p of data.payments) {
  await create('payments', {
    invoice: invoiceMap.get(p.invoice) || '',
    programme: programmeMap.get(p.programmeId) || '',
    client: clientMap.get(p.client) || '',
    paymentNo: p.paymentNo,
    amount: Number(p.amount || 0),
    method: p.method || 'Bank Transfer',
    date: date(p.date),
    reference: safe(p.reference),
    status: p.status || 'Completed',
    createdBy,
  });
}

console.log('9/10 Creating delivery, action and training records...');
for (const t of data.trainingSessions) {
  await create('training_delivery', {
    programme: programmeMap.get(t.programmeId) || '',
    title: t.title, date: date(t.date), time: safe(t.time), trainer: safe(t.trainer),
    venue: safe(t.venue), mode: t.mode || 'In-Person', status: t.status || 'Scheduled', createdBy,
  });
}
for (const s of data.trainingStatistics) {
  await create('training_statistics', {
    programme: programmeMap.get(s.programmeId) || '',
    sessionsPlanned: Number(s.sessionsPlanned || 0), sessionsDelivered: Number(s.sessionsDelivered || 0),
    attendanceRate: Number(s.attendanceRate || 0), completionRate: Number(s.completionRate || 0),
    avgScore: Number(s.avgScore || 0), npsScore: Number(s.npsScore || 0), lastSession: date(s.lastSession),
    trainingDate: date(s.trainingDate), trainingName: safe(s.trainingName), trainingCategory: safe(s.trainingCategory),
    domain: safe(s.domain), workshopCount: Number(s.workshopCount || 0), trainingCount: Number(s.trainingCount || 0),
    totalCount: Number(s.totalCount || 0), bumiputeraCount: Number(s.bumiputeraCount || 0),
    nonBumiputeraCount: Number(s.nonBumiputeraCount || 0), totalCharges: Number(s.totalCharges || 0),
    sstAmount: Number(s.sstAmount || 0), finalCharges: Number(s.finalCharges || 0), createdBy,
  });
}
for (const a of data.actionItems) {
  await create('action_items', {
    programme: programmeMap.get(a.programmeId) || '',
    title: a.title, relatedTo: safe(a.relatedTo), owner: safe(a.owner),
    dueDate: date(a.dueDate), priority: a.priority || 'Medium', status: a.status === 'Pending' ? 'Open' : (a.status || 'Open'),
    client: safe(a.client), service: safe(a.service), personInCharge: safe(a.personInCharge),
    personEmail: safe(a.personEmail), potentialRevenue: Number(a.potentialRevenue || 0),
    agingDays: Number(a.agingDays || 0), notes: safe(a.notes), createdBy,
  });
}

console.log('10/10 Creating audit history...');
for (const a of data.auditHistory) {
  await create('audit_history', {
    programme: programmeMap.get(a.programmeId) || '',
    action: a.action, entity: safe(a.entity), description: safe(a.description),
    user: safe(a.user), timestamp: date(a.timestamp), createdBy,
  });
}

console.log('Seed completed successfully.');
console.log(`Clients: ${clientMap.size}, Programmes: ${programmeMap.size}, Opportunities: ${opportunityMap.size}, Quotations: ${quotationMap.size}, POs: ${poMap.size}, Invoices: ${invoiceMap.size}`);

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const PmsDataContext = createContext(null);
const TABLES = {
  clients: 'client', client_contacts: 'client_contact', programmes: 'programme', opportunities: 'opportunity',
  quotations: 'quotation', purchase_orders: 'purchase_order', invoices: 'invoice', payments: 'payment',
  training_delivery: 'training_delivery', training_statistics: 'training_stat', participants: 'participant',
  action_items: 'action_item', documents: 'document', audit_history: 'audit_history',
};

const selectMap = {
  client: '*, sector:sector_id(code,name)',
  client_contact: '*, client:client_id(company_name)',
  programme: '*, client:client_id(id,company_name), programme_status:programme_status_id(code,name), training_type:training_type_id(code,name), programme_category:programme_category_id(code,name), account:account_id(code,name), account_manager:account_manager_id(full_name), pic:pic_id(full_name)',
  opportunity: '*, client:client_id(company_name), opportunity_status:opportunity_status_id(code,name), speed_to_market:speed_to_market_id(name,quarter,year), sector:sector_id(name), account_manager:account_manager_id(full_name), salesman:salesman_id(full_name)',
  quotation: '*, client:client_id(company_name), programme:programme_id(programme_code,title), quotation_status:quotation_status_id(code,name), quotation_type:quotation_type_id(code,name), training_type:training_type_id(code,name), account_manager:account_manager_id(full_name), pic:pic_id(full_name)',
  purchase_order: '*, client:client_id(company_name), programme:programme_id(programme_code,title), quotation:quotation_id(quotation_no)',
  invoice: '*, client:client_id(company_name), programme:programme_id(programme_code,title), payment_status:payment_status_id(code,name), payment_method:payment_method_id(code,name)',
  payment: '*, invoice:invoice_id(invoice_no), client:client_id(company_name), programme:programme_id(programme_code,title), payment_method:payment_method_id(code,name), payment_status:payment_status_id(code,name)',
  training_delivery: '*, programme:programme_id(programme_code,title)',
  training_stat: '*, programme:programme_id(programme_code,title)',
  participant: '*, programme:programme_id(programme_code,title), client:client_id(company_name)',
  action_item: '*, client:client_id(company_name), programme:programme_id(programme_code,title), action_item_status:action_item_status_id(code,name), assigned_to:assigned_to_id(full_name)',
  document: '*, programme:programme_id(programme_code,title)',
  audit_history: '*, programme:programme_id(programme_code,title)',
};

async function fullList(table) {
  let query = supabase.from(table).select(selectMap[table] || '*').order('created_at', { ascending: false });
  const { data, error } = await query.range(0, 9999);
  if (error) throw error;
  return data || [];
}

const moneyNumber = (v) => Number(v ?? 0);
const relationName = (r, key, fallback = '') => r?.[key]?.company_name || r?.[key]?.full_name || r?.[key]?.name || fallback;

const mapClient = (r) => ({ id:r.id, name:r.company_name, industry:r.sector?.name || '', contactPerson:'', email:'', phone:'', location:r.address || '', status:r.is_active ? 'Active' : 'Inactive', since:r.created_at?.slice(0,4) || '' });
const mapProgramme = (r) => ({ id:r.id, code:r.programme_code || '', title:r.title, category:r.programme_category?.name || '', trainingType:r.training_type?.name || '', programmeCategory:r.programme_category?.name || '', client:r.client_id, clientName:relationName(r,'client','—'), status:r.programme_status?.name || 'Planned', accountManager:r.account_manager?.full_name || '', pic:r.pic?.full_name || '', trainer:'', startDate:r.start_date || '', endDate:r.end_date || '', durationDays:moneyNumber(r.duration_days), venue:'', participants:moneyNumber(r.no_of_pax), progress:r.programme_status?.code === 'COMPLETED' ? 100 : 0, contractValue:moneyNumber(r.total_revenue_excl_tax), totalRevenueExclSST:moneyNumber(r.total_revenue_excl_tax), sstAmount:moneyNumber(r.total_sst_amount), totalRevenueInclSST:moneyNumber(r.total_revenue_incl_tax), totalCollection:moneyNumber(r.total_collected), outstandingAmount:moneyNumber(r.total_outstanding), poNo:'', quotationId:null, poId:null, opportunityId:null, sessionsPlanned:0, sessionsDelivered:0, account:r.account?.code || '' });
const mapOpportunity = (r) => ({ id:r.id, client:r.client_id, clientName:relationName(r,'client','—'), title:r.project_title, projectTitle:r.project_title, value:moneyNumber(r.forecast_value), forecastValue:moneyNumber(r.forecast_value), stage:r.opportunity_status?.name || 'Early Engagement', opportunityStatus:r.opportunity_status?.name || 'Early Engagement', probability:moneyNumber(r.probability_percentage), weightedForecast:moneyNumber(r.weighted_value), weighted:moneyNumber(r.weighted_value), securedOrderBookValue:moneyNumber(r.secured_value), sector:r.sector?.name || '', accountManager:r.account_manager?.full_name || '', salesman:r.salesman?.full_name || '', expectedClose:r.expected_close_date || '', year:r.speed_to_market?.year || 0 });
const mapQuotation = (r) => ({ id:r.id, quoteNo:r.quotation_no, revision:r.revision || '', quotationType:r.quotation_type?.name || 'Training', trainingType:r.training_type?.name || '', client:r.client_id, clientName:relationName(r,'client','—'), programme:r.programme?.title || '', programmeTitle:r.project_title || r.programme?.title || '', programmeCode:r.programme?.programme_code || '', programmeId:r.programme_id, opportunityId:null, amount:moneyNumber(r.final_price ?? r.total_price_incl_tax), unitPriceExclSST:moneyNumber(r.unit_price_excl_tax), unitPriceInclSST:moneyNumber(r.unit_price_incl_tax), totalPriceExclSST:moneyNumber(r.total_price_excl_tax), totalPriceInclSST:moneyNumber(r.total_price_incl_tax), sstAmount:moneyNumber(r.sst_amount), discountPercentage:moneyNumber(r.discount_percentage), finalPrice:moneyNumber(r.final_price), accountManager:r.account_manager?.full_name || '', pic:r.pic?.full_name || '', status:r.quotation_status?.name || 'Draft', issueDate:r.quotation_date || '', validUntil:r.valid_until || '', preparedBy:r.pic_full_name || '' });
const mapPO = (r) => ({ id:r.id, poNo:r.po_no, client:r.client_id, clientName:relationName(r,'client','—'), programmeId:r.programme_id, programmeCode:r.programme?.programme_code || '', programmeTitle:r.programme?.title || '', quotationId:r.quotation_id, amount:moneyNumber(r.po_value_incl_tax), status:r.po_status || 'Pending', issueDate:r.po_date || '', receivedDate:'' });
const mapInvoice = (r) => ({ id:r.id, invoiceNo:r.invoice_no, invoiceDate:r.invoice_date || '', issueDate:r.invoice_date || '', dueDate:r.due_date || '', client:r.client_id, clientName:relationName(r,'client','—'), programmeId:r.programme_id, programmeCode:r.programme?.programme_code || '', programme:r.programme?.title || '', quotationReference:r.quotation_no_ref || '', poReference:r.po_no_ref || '', description:'', amountExcludingSST:moneyNumber(r.amount_excl_tax), amount:moneyNumber(r.amount_excl_tax), sstAmount:moneyNumber(r.sst_amount), totalAmount:moneyNumber(r.total_incl_tax), collectionAmount:moneyNumber(r.amount_collected), paidAmount:moneyNumber(r.amount_collected), outstandingAmount:moneyNumber(r.amount_outstanding), status:r.payment_status?.name || 'Unpaid', paymentStatus:r.payment_status?.name || '', paymentMethod:r.payment_method?.name || '', paymentDate:r.payment_date || '', daysOutstanding:moneyNumber(r.days_outstanding), accountManager:'', pic:'' });
const mapPayment = (r) => ({ id:r.id, paymentNo:r.payment_reference, invoice:r.invoice_id, invoiceNo:r.invoice?.invoice_no || '', client:r.client_id, clientName:relationName(r,'client','—'), programmeId:r.programme_id, programmeCode:r.programme?.programme_code || '', amount:moneyNumber(r.amount), method:r.payment_method?.name || '', date:r.payment_date || '', reference:r.bank_reference || r.transaction_id || '', status:r.payment_status?.name || 'Pending' });
const mapAction = (r) => ({ id:r.id, client:r.client_id || '', service:r.service || '', title:r.action_description, relatedTo:'', programmeId:r.programme_id, programmeCode:r.programme?.programme_code || '', owner:r.assigned_to?.full_name || r.person_in_charge || '', personInCharge:r.person_in_charge || '', personEmail:r.person_email || '', dueDate:r.due_date || '', status:r.action_item_status?.name || 'Open', potentialRevenue:moneyNumber(r.potential_revenue), agingDays:moneyNumber(r.aging_days), notes:r.notes || '', priority:r.priority || 'Medium' });
const mapTrainingStat = (r) => ({ id:r.id, programmeId:r.programme_id, trainingDate:r.training_date || '', trainingName:r.training_name || r.programme?.title || '', trainingCategory:r.training_category || '', domain:r.domain_name || r.domain_code || '', workshopCount:moneyNumber(r.workshop_count), trainingCount:moneyNumber(r.training_count), totalCount:moneyNumber(r.total_count), bumiputeraCount:moneyNumber(r.bumiputera_count), nonBumiputeraCount:moneyNumber(r.non_bumiputera_count), totalCharges:moneyNumber(r.total_charges_excl_tax), sstAmount:moneyNumber(r.sst_amount), finalCharges:moneyNumber(r.final_charges_incl_tax), sessionsPlanned:0, sessionsDelivered:0, attendanceRate:0, completionRate:0, avgScore:0, npsScore:0, lastSession:r.training_date || '' });
const mapTraining = (r) => ({ id:r.id, title:r.title, programme:r.programme?.title || '', programmeCode:r.programme?.programme_code || '', programmeId:r.programme_id, date:r.delivery_date || '', time:r.delivery_time || '', trainer:r.trainer || '', venue:r.venue || '', mode:r.mode || 'In-Person', status:r.status || 'Scheduled' });
const mapParticipant = (r) => ({ id:r.id, programmeId:r.programme_id, client:r.client_id || null, programmeCode:r.programme?.programme_code || '', programmeTitle:r.programme?.title || '', name:r.full_name, email:r.email || '', company:r.organization || '', phone:r.phone || '', status:r.attendance_status || 'Confirmed' });
const mapDocument = (r) => ({ id:r.id, programmeId:r.programme_id, name:r.name, type:r.document_type || '', uploadedBy:r.uploaded_by_name || '', date:r.document_date || '', size:r.file_size_text || '', storagePath:r.storage_path || '' });
const mapAudit = (r) => ({ id:r.id, programmeId:r.programme_id || null, action:r.action, entity:r.entity || '', description:r.description || '', user:r.actor_name || '', timestamp:r.event_at || r.created_at || '' });

const makeTotals = (invoices) => ({
  revenue: invoices.reduce((s,i)=>s+moneyNumber(i.totalAmount||i.amount),0),
  collected: invoices.reduce((s,i)=>s+moneyNumber(i.collectionAmount||i.paidAmount),0),
  outstanding: invoices.reduce((s,i)=>s+moneyNumber(i.outstandingAmount),0),
  overdue: invoices.filter(i=>i.status==='Overdue').reduce((s,i)=>s+moneyNumber(i.outstandingAmount),0),
});
const makeMonthlyFinancials = (invoices) => { const m=new Map(); invoices.forEach(i=>{const k=(i.invoiceDate||'').slice(0,7); if(!k)return; if(!m.has(k))m.set(k,{month:k,revenue:0,collection:0}); const x=m.get(k); x.revenue+=moneyNumber(i.totalAmount); x.collection+=moneyNumber(i.collectionAmount);}); return [...m.values()].sort((a,b)=>a.month.localeCompare(b.month)); };

async function lookupId(table, value) {
  if (value == null || value === '') return null;
  const column = table === 'staff' ? 'full_name' : 'name';
  const { data } = await supabase.from(table).select('id').or(`${column}.ilike.${String(value).replace(/,/g,' ')},code.ilike.${String(value).replace(/,/g,' ')}`).limit(1);
  return data?.[0]?.id ?? null;
}

async function toDbPayload(collection, input) {
  const p={...input};
  if(collection==='clients') return { company_name:p.name ?? p.company_name, address:p.location ?? p.address, is_active:p.status !== 'Inactive', source_file:'pms-web' };
  if(collection==='programmes') return { client_id:p.client_id ?? p.client, programme_code:p.code ?? p.programme_code, title:p.title, start_date:p.startDate, end_date:p.endDate, duration_days:p.durationDays, no_of_pax:p.participants, total_revenue_excl_tax:p.contractValue, source_file:'pms-web' };
  if(collection==='opportunities') return { client_id:p.client_id ?? p.client, programme_id:p.programme_id ?? p.linkedProgramme, project_title:p.title ?? p.projectTitle, forecast_value:p.forecastValue ?? p.value, probability_percentage:p.probability, expected_close_date:p.expectedClose, remarks:p.remarks, source_file:'pms-web' };
  if(collection==='quotations') return { client_id:p.client_id ?? p.client, programme_id:p.programme_id ?? p.programme, quotation_no:p.quoteNo ?? p.quotation_no, project_title:p.programmeTitle, final_price:p.finalPrice ?? p.amount, quotation_date:p.issueDate, valid_until:p.validUntil, source_file:'pms-web' };
  if(collection==='purchase_orders') return { client_id:p.client_id ?? p.client, programme_id:p.programmeId ?? p.programme, quotation_id:p.quotationId ?? p.quotation, po_no:p.poNo, po_value_incl_tax:p.amount, po_date:p.issueDate, po_status:p.status, source_file:'pms-web' };
  if(collection==='invoices') return { client_id:p.client_id ?? p.client, programme_id:p.programmeId ?? p.programme, invoice_no:p.invoiceNo, invoice_date:p.invoiceDate ?? p.issueDate, due_date:p.dueDate, amount_excl_tax:p.amountExcludingSST ?? p.amount, sst_amount:p.sstAmount, total_incl_tax:p.totalAmount ?? p.amount, amount_collected:p.collectionAmount ?? p.paidAmount ?? 0, amount_outstanding:p.outstandingAmount, source_file:'pms-web' };
  if(collection==='payments') return { invoice_id:p.invoice ?? null, programme_id:p.programmeId ?? p.programme, client_id:p.client_id ?? p.client, payment_reference:p.paymentNo, amount:p.amount, payment_date:p.date, bank_reference:p.reference, source_file:'pms-web' };
  if(collection==='action_items') return { client_id:p.client || null, programme_id:p.programmeId ?? p.programme, action_description:p.title ?? p.action_description, person_in_charge:p.owner ?? p.personInCharge, person_email:p.personEmail, due_date:p.dueDate, potential_revenue:p.potentialRevenue, aging_days:p.agingDays, priority:String(p.priority||'MEDIUM').toUpperCase(), notes:p.notes, source_file:'pms-web' };
  if(collection==='training_delivery') return { programme_id:p.programmeId ?? p.programme, title:p.title, delivery_date:p.date, delivery_time:p.time, trainer:p.trainer, venue:p.venue, mode:p.mode, status:p.status, source_file:'pms-web' };
  if(collection==='training_statistics') return { programme_id:p.programmeId ?? p.programme, training_date:p.trainingDate, training_name:p.trainingName, training_category:p.trainingCategory, domain_name:p.domain, workshop_count:p.workshopCount, training_count:p.trainingCount, total_count:p.totalCount, bumiputera_count:p.bumiputeraCount, non_bumiputera_count:p.nonBumiputeraCount, total_charges_excl_tax:p.totalCharges, sst_amount:p.sstAmount, final_charges_incl_tax:p.finalCharges, source_file:'pms-web' };
  if(collection==='participants') return { programme_id:p.programmeId ?? p.programme, client_id:p.client || null, full_name:p.name, email:p.email, organization:p.company, phone:p.phone, attendance_status:p.status, source_file:'pms-web' };
  if(collection==='documents') return { programme_id:p.programmeId ?? p.programme, name:p.name, document_type:p.type, storage_path:p.storagePath, uploaded_by_name:p.uploadedBy, document_date:p.date, file_size_text:p.size, source_file:'pms-web' };
  if(collection==='audit_history') return { programme_id:p.programmeId ?? p.programme, action:p.action, entity:p.entity, description:p.description, actor_name:p.user, event_at:p.timestamp, source_file:'pms-web' };
  throw new Error(`Unsupported PMS collection: ${collection}`);
}

export function PmsDataProvider({ children }) {
  const { isAuthed } = useAuth();
  const [state,setState]=useState({loading:true,error:'',clients:[],clientContacts:[],programmes:[],opportunities:[],quotations:[],purchaseOrders:[],invoices:[],payments:[],trainingSessions:[],trainingStatistics:[],participants:[],actionItems:[],documents:[],auditHistory:[],notifications:[]});

  const refresh=useCallback(async()=>{
    setState(s=>({...s,loading:true,error:''}));
    try {
      const [a,b,c,d,e,f,g,h,i,j,k,l,m,n]=await Promise.all(['client','client_contact','programme','opportunity','quotation','purchase_order','invoice','payment','training_delivery','training_stat','participant','action_item','document','audit_history'].map(fullList));
      setState({loading:false,error:'',clients:a.map(mapClient),clientContacts:b,programmes:c.map(mapProgramme),opportunities:d.map(mapOpportunity),quotations:e.map(mapQuotation),purchaseOrders:f.map(mapPO),invoices:g.map(mapInvoice),payments:h.map(mapPayment),trainingSessions:i.map(mapTraining),trainingStatistics:j.map(mapTrainingStat),participants:k.map(mapParticipant),actionItems:l.map(mapAction),documents:m.map(mapDocument),auditHistory:n.map(mapAudit),notifications:[]});
    } catch(error) { console.error(error); setState(s=>({...s,loading:false,error:error?.message||'Unable to load PMS data.'})); }
  },[]);

  useEffect(()=>{ if(isAuthed) refresh(); },[isAuthed,refresh]);

  useEffect(()=>{
    if(!isAuthed) return undefined;
    const channel=supabase.channel('pms-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'programme'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'client'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'quotation'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'purchase_order'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'invoice'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'payment'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'opportunity'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'action_item'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'training_stat'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'participant'},refresh)
      .subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  },[isAuthed,refresh]);

  const createRecord=useCallback(async(collection,payload)=>{
    const table=TABLES[collection]; if(!table) throw new Error(`Unknown collection: ${collection}`);
    const row=await toDbPayload(collection,payload);
    const {data,error}=await supabase.from(table).insert(row).select('*').single();
    if(error) throw error; await refresh(); return data;
  },[refresh]);
  const updateRecord=useCallback(async(collection,id,payload)=>{ const table=TABLES[collection]; if(!table)throw new Error(`Unknown collection: ${collection}`); const row=await toDbPayload(collection,payload); const {data,error}=await supabase.from(table).update(row).eq('id',id).select('*').single(); if(error)throw error; await refresh(); return data; },[refresh]);
  const deleteRecord=useCallback(async(collection,id)=>{ const table=TABLES[collection]; if(!table)throw new Error(`Unknown collection: ${collection}`); const {error}=await supabase.from(table).delete().eq('id',id); if(error)throw error; await refresh(); },[refresh]);
  const uploadDocument=useCallback(async(programmeId,file,metadata={})=>{ const path=`programmes/${programmeId}/supporting-documents/${crypto.randomUUID()}-${file.name}`; const {error:uploadError}=await supabase.storage.from('pms-documents').upload(path,file,{upsert:false}); if(uploadError)throw uploadError; return createRecord('documents',{programmeId,name:metadata.name||file.name,type:metadata.type||file.type,storagePath:path,uploadedBy:metadata.uploadedBy||'',date:new Date().toISOString().slice(0,10),size:String(file.size)}); },[createRecord]);

  const derived=useMemo(()=>{ const openOpportunities=state.opportunities.filter(o=>!['Lost','Lost / No-go','WON','Won'].includes(o.stage)); const pipelineValue=openOpportunities.reduce((s,o)=>s+o.value,0); const weightedPipelineValue=openOpportunities.reduce((s,o)=>s+o.weighted,0); const securedOrderBook=state.opportunities.reduce((s,o)=>s+o.securedOrderBookValue,0); const funnelByStage=[...new Set(state.opportunities.map(o=>o.stage))].map(stage=>({stage,count:state.opportunities.filter(o=>o.stage===stage).length,value:state.opportunities.filter(o=>o.stage===stage).reduce((s,o)=>s+o.value,0),weighted:state.opportunities.filter(o=>o.stage===stage).reduce((s,o)=>s+o.weighted,0)})); return {openOpportunities,pipelineValue,weightedPipelineValue,securedOrderBook,funnelByStage,totals:makeTotals(state.invoices),monthlyFinancials:makeMonthlyFinancials(state.invoices),programmeCompletenessAvg:state.programmes.length?Math.round(state.programmes.reduce((s,p)=>s+p.progress,0)/state.programmes.length):0,BUSINESS_FLOW:['Opportunity','Quotation','Purchase Order','Programme','Training Delivery','Invoice','Payment Collection']}; },[state]);

  const value=useMemo(()=>({...state,...derived,refresh,createRecord,updateRecord,deleteRecord,uploadDocument}),[state,derived,refresh,createRecord,updateRecord,deleteRecord,uploadDocument]);
  return <PmsDataContext.Provider value={value}>{children}</PmsDataContext.Provider>;
}
export const usePmsData=()=>{const ctx=useContext(PmsDataContext);if(!ctx)throw new Error('usePmsData must be used inside PmsDataProvider');return ctx;};

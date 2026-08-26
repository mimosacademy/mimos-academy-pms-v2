import supabase from './supabaseClient';

const TABLES = Object.freeze({
  clients: 'client', clientContacts: 'client_contact', programmes: 'programme', opportunities: 'opportunity',
  quotations: 'quotation', purchaseOrders: 'purchase_order', invoices: 'invoice', payments: 'payment',
  trainingDeliveries: 'training_delivery', trainingStatistics: 'training_stat', participants: 'participant',
  actionItems: 'action_item', documents: 'document', auditHistory: 'audit_history',
});

export { TABLES };
const assertSafeTable = (table) => { if (!Object.values(TABLES).includes(table)) throw new Error('Unsupported PMS table.'); };
const getAuthenticatedUser = async () => { const { data, error } = await supabase.auth.getUser(); if (error || !data?.user?.id) throw new Error('Authentication required. Please sign in again.'); return data.user; };
const throwDatabaseError = (operation, table, error) => { if (!error) return; const message = String(error.message || '').toLowerCase(); if (message.includes('permission') || message.includes('row-level security') || error.code === '42501') throw new Error('You are not authorized to perform this operation.'); if (error.code === '23505') throw new Error('Duplicate transaction detected. The operation may already have been recorded.'); throw new Error(`${operation} failed for ${table}. Please try again or contact an administrator.`); };
const sanitizePageSize = (value) => { const size = Number(value); return Number.isInteger(size) && size > 0 ? Math.min(size, 200) : 50; };
const sanitizePage = (value) => { const page = Number(value); return Number.isInteger(page) && page > 0 ? page : 1; };

export async function listRecords(table, { select = '*', filters = {}, orderBy = 'created_at', ascending = false, page = 1, pageSize = 50 } = {}) { assertSafeTable(table); const safePage = sanitizePage(page), safePageSize = sanitizePageSize(pageSize); const from = (safePage - 1) * safePageSize, to = from + safePageSize - 1; let query = supabase.from(table).select(select, { count: 'exact' }).order(orderBy, { ascending }).range(from, to); for (const [column, value] of Object.entries(filters)) if (value !== undefined && value !== null && value !== '') query = query.eq(column, value); const { data, error, count } = await query; throwDatabaseError('List', table, error); return { data: data ?? [], count: count ?? 0, page: safePage, pageSize: safePageSize }; }
export async function getRecord(table, id, select = '*') { assertSafeTable(table); if (id === undefined || id === null || id === '') throw new Error(`Cannot fetch ${table}: record id is required.`); const { data, error } = await supabase.from(table).select(select).eq('id', id).single(); throwDatabaseError('Fetch', table, error); return data; }
export async function createRecord(table, payload = {}) { assertSafeTable(table); const user = await getAuthenticatedUser(); const row = { ...payload, created_by: user.id, updated_by: user.id }; delete row.actor_id; delete row.actor_name; const { data, error } = await supabase.from(table).insert(row).select().single(); throwDatabaseError('Create', table, error); return data; }

export async function createPaymentRecord(payload = {}) {
  const user = await getAuthenticatedUser();
  const operationId = payload.operation_id || crypto.randomUUID();
  const row = { ...payload, operation_id: operationId, created_by: user.id, updated_by: user.id };
  delete row.actor_id; delete row.actor_name;
  const { data, error } = await supabase.from('payment').insert(row).select().single();
  if (!error) return data;
  if (error.code === '23505') {
    const { data: existing, error: lookupError } = await supabase.from('payment').select('*').eq('operation_id', operationId).maybeSingle();
    if (lookupError) throwDatabaseError('Payment idempotency lookup', 'payment', lookupError);
    if (existing) return existing;
  }
  throwDatabaseError('Create', 'payment', error);
}

export async function updateRecord(table, id, payload = {}) { assertSafeTable(table); if (id === undefined || id === null || id === '') throw new Error(`Cannot update ${table}: record id is required.`); const user = await getAuthenticatedUser(); const row = { ...payload, updated_by: user.id }; delete row.created_by; delete row.actor_id; delete row.actor_name; const { data, error } = await supabase.from(table).update(row).eq('id', id).select().single(); throwDatabaseError('Update', table, error); return data; }
export async function deleteRecord(table, id) { assertSafeTable(table); if (id === undefined || id === null || id === '') throw new Error(`Cannot delete ${table}: record id is required.`); const { error } = await supabase.from(table).delete().eq('id', id); throwDatabaseError('Delete', table, error); }
export function subscribeToTable(table, callback, { event = '*', filter } = {}) { assertSafeTable(table); const changes = supabase.channel(`pms:${table}:${crypto.randomUUID()}`).on('postgres_changes', { event, schema: 'public', table, ...(filter ? { filter } : {}) }, callback); changes.subscribe((status) => { if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn(`Realtime subscription unavailable for ${table}.`); }); return () => { void supabase.removeChannel(changes); }; }
export async function uploadDocument(file, { programmeId } = {}) { if (!(file instanceof File)) throw new TypeError('uploadDocument requires a File'); if (!Number.isInteger(Number(programmeId)) || Number(programmeId) < 1) throw new Error('A valid programme is required before uploading a document.'); const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'document'; const path = `programmes/${Number(programmeId)}/${crypto.randomUUID()}-${safeName}`; const { error } = await supabase.storage.from('pms-documents').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'application/octet-stream' }); if (error) throw new Error('Document upload failed.'); return path; }
export async function createSignedDocumentUrl(path, expiresIn = 3600) { if (!path || !/^programmes\/\d+\/[^/]+$/.test(path)) throw new Error('Invalid document path.'); const safeExpiry = Math.min(Math.max(Number(expiresIn) || 3600, 60), 3600); const { data, error } = await supabase.storage.from('pms-documents').createSignedUrl(path, safeExpiry); if (error) throw new Error('Signed document URL could not be created.'); return data.signedUrl; }

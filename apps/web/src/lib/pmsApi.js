import supabase from './supabaseClient';

const TABLES = Object.freeze({
  clients: 'client',
  clientContacts: 'client_contact',
  programmes: 'programme',
  opportunities: 'opportunity',
  quotations: 'quotation',
  purchaseOrders: 'purchase_order',
  invoices: 'invoice',
  payments: 'payment',
  trainingDeliveries: 'training_delivery',
  trainingStatistics: 'training_stat',
  participants: 'participant',
  actionItems: 'action_item',
  documents: 'document',
  auditHistory: 'audit_history',
});

export { TABLES };

const assertSafeTable = (table) => {
  if (!Object.values(TABLES).includes(table)) throw new Error(`Unsupported PMS table: ${table}`);
};

export async function listRecords(table, { select = '*', filters = {}, orderBy = 'created_at', ascending = false, page = 1, pageSize = 50 } = {}) {
  assertSafeTable(table);
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;
  let query = supabase.from(table).select(select, { count: 'exact' }).order(orderBy, { ascending }).range(from, to);
  for (const [column, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    query = query.eq(column, value);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0, page, pageSize };
}

export async function getRecord(table, id, select = '*') {
  assertSafeTable(table);
  const { data, error } = await supabase.from(table).select(select).eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createRecord(table, payload) {
  assertSafeTable(table);
  const { data: { user } } = await supabase.auth.getUser();
  const row = { ...payload, created_by: payload.created_by ?? user?.id ?? null, updated_by: payload.updated_by ?? user?.id ?? null };
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateRecord(table, id, payload) {
  assertSafeTable(table);
  const { data: { user } } = await supabase.auth.getUser();
  const row = { ...payload, updated_by: payload.updated_by ?? user?.id ?? null };
  const { data, error } = await supabase.from(table).update(row).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRecord(table, id) {
  assertSafeTable(table);
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export function subscribeToTable(table, callback, { event = '*', filter } = {}) {
  assertSafeTable(table);
  let changes = supabase.channel(`pms:${table}:${crypto.randomUUID()}`).on(
    'postgres_changes',
    { event, schema: 'public', table, ...(filter ? { filter } : {}) },
    callback,
  );
  changes.subscribe();
  return () => { void supabase.removeChannel(changes); };
}

export async function uploadDocument(file, { programmeId, pathPrefix = 'programmes' } = {}) {
  if (!(file instanceof File)) throw new TypeError('uploadDocument requires a File');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${pathPrefix}/${programmeId ?? 'unassigned'}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from('pms-documents').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;
  return path;
}

export async function createSignedDocumentUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from('pms-documents').createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

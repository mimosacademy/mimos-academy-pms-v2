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

const getAuthenticatedUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Authentication lookup failed: ${error.message}`);
  if (!data?.user?.id) throw new Error('Authentication required. Please sign in again.');
  return data.user;
};

const throwDatabaseError = (operation, table, error) => {
  if (!error) return;
  const details = [error.message, error.details, error.hint, error.code].filter(Boolean).join(' | ');
  throw new Error(`${operation} failed for ${table}: ${details || 'Unknown database error'}`);
};

const sanitizePageSize = (value) => {
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1) return 50;
  return Math.min(size, 200);
};

const sanitizePage = (value) => {
  const page = Number(value);
  if (!Number.isInteger(page) || page < 1) return 1;
  return page;
};

export async function listRecords(table, { select = '*', filters = {}, orderBy = 'created_at', ascending = false, page = 1, pageSize = 50 } = {}) {
  assertSafeTable(table);
  const safePage = sanitizePage(page);
  const safePageSize = sanitizePageSize(pageSize);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  let query = supabase.from(table).select(select, { count: 'exact' }).order(orderBy, { ascending }).range(from, to);
  for (const [column, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    query = query.eq(column, value);
  }
  const { data, error, count } = await query;
  throwDatabaseError('List', table, error);
  return { data: data ?? [], count: count ?? 0, page: safePage, pageSize: safePageSize };
}

export async function getRecord(table, id, select = '*') {
  assertSafeTable(table);
  if (id === undefined || id === null || id === '') throw new Error(`Cannot fetch ${table}: record id is required.`);
  const { data, error } = await supabase.from(table).select(select).eq('id', id).single();
  throwDatabaseError('Fetch', table, error);
  return data;
}

export async function createRecord(table, payload = {}) {
  assertSafeTable(table);
  const user = await getAuthenticatedUser();
  const row = { ...payload, created_by: user.id, updated_by: user.id };
  delete row.actor_id;
  delete row.actor_name;
  const { data, error } = await supabase.from(table).insert(row).select().single();
  throwDatabaseError('Create', table, error);
  return data;
}

export async function updateRecord(table, id, payload = {}) {
  assertSafeTable(table);
  if (id === undefined || id === null || id === '') throw new Error(`Cannot update ${table}: record id is required.`);
  const user = await getAuthenticatedUser();
  const row = { ...payload, updated_by: user.id };
  delete row.created_by;
  delete row.actor_id;
  delete row.actor_name;
  const { data, error } = await supabase.from(table).update(row).eq('id', id).select().single();
  throwDatabaseError('Update', table, error);
  return data;
}

export async function deleteRecord(table, id) {
  assertSafeTable(table);
  if (id === undefined || id === null || id === '') throw new Error(`Cannot delete ${table}: record id is required.`);
  const { error } = await supabase.from(table).delete().eq('id', id);
  throwDatabaseError('Delete', table, error);
}

export function subscribeToTable(table, callback, { event = '*', filter } = {}) {
  assertSafeTable(table);
  const changes = supabase.channel(`pms:${table}:${crypto.randomUUID()}`).on(
    'postgres_changes',
    { event, schema: 'public', table, ...(filter ? { filter } : {}) },
    callback,
  );
  changes.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.error(`Realtime subscription failed for ${table}: ${status}`);
    }
  });
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
  if (error) throw new Error(`Document upload failed: ${error.message}`);
  return path;
}

export async function createSignedDocumentUrl(path, expiresIn = 3600) {
  if (!path) throw new Error('Document storage path is required.');
  const { data, error } = await supabase.storage.from('pms-documents').createSignedUrl(path, expiresIn);
  if (error) throw new Error(`Signed document URL failed: ${error.message}`);
  return data.signedUrl;
}
